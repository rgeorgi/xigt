import logging
from itertools import groupby, chain
try:
    from itertools import zip_longest
except ImportError:
    from itertools import izip_longest as zip_longest
from collections import deque
from xigt.core import get_alignment_expression_ids, alignment_closures

def item_groups(tier, relations=None):
    relations = list(relations or ['alignment', 'segmentation'])
    curids = set()
    curgrp = []
    for item in tier:
        rel = next(filter(item.attributes.__contains__, relations), None)
        if rel is None:
            ids = ['']
        else:
            ids = get_alignment_expression_ids(item.attributes[rel])
        if not curids or curids.intersection(ids):
            curids.update(ids)
            curgrp.append(item)
        else:
            yield ([] if '' in curids else sorted(curids), curgrp)
            curids = set(ids)
            curgrp = [item]
    if curgrp:
        yield ([] if '' in curids else sorted(curids), curgrp)

def nested_columns(igt, relations=None, method='left-align'):
    """
    Return a list of tiers where each tier is a sequence of columns
    (rather than items), and each column is a sequence of items.
    Items will be grouped if they align or segment another tier. For
    each set of aligned tiers, the number of columns is fixed at the
    minimum number among the tiers.
    """
    tiers = {}
    tiergroups = alignment_closures(igt.tiers, relations=relations)
    logging.debug(
        "Got tier groups: {}".format(
            ', '.join([
                ' '.join(t.id for t in tg)
                for tg in tiergroups
            ])
        )
    )
    for tg in tiergroups:
        if len(tg) > 1:
            trellis = group_alignments(tg)
            depth = len(trellis[0])
            for i in range(depth):
                t = tg[i]
                columns = [c[i] for c in trellis]
                tiers[t.id] = columns
        else:
            tiers[tg[0].id] = [list(tg[0].items)]
    # return them in order
    return [tiers[t.id] for t in igt.tiers]


def group_alignments(tiers):
    # trellis has positions with tokens or each row:
    #    visualized as a grid:
    # [ [ [w1..] ]  [ [w2..] ]  ... ]
    # | | [m1..] |  | [m2..] |  ... |
    # [ [ [g1..] ], [ [g2..] ], ... ]
    #    or as a list
    # [columns [rows [tokens]]]
    trellis = [[[item]] for item in tiers[0].items]
    for tier in tiers[1:]:
        trellis = align_tier(trellis, tier)
    return trellis


def align_tier(trellis, tier):
    depth = len(trellis[0])
    agenda = get_agenda(tier) # list of (aligned ids, item)
    delay = deque()  # when we need to postpone an agendum
    idx = -1  # current trellis position
    idxmap = build_idxmap(trellis, depth - 1) # regen when trellis size changes
    for agendum in agenda:
        ids, items = agendum
        logging.debug('Agendum: {} -> {}'.format([i.id for i in items], ids))
        debug_display_trellis(trellis)
        # no alignment
        if not ids:
            logging.debug('Delay')
            delay.append(agendum)
            continue
        # assumes ids are ordered
        start = idxmap[ids[0]]
        end = idxmap[ids[-1]]
        logging.debug('idx: {}\tstart: {}\tend: {}\tdepth: {}'
                      .format(idx, start, end, depth))
        # if the next aligned thing is ahead of idx, move ahead
        while idx < start:
            idx += 1
            trellis[idx].append([])
            logging.debug('Added row at idx {}'.format(idx))
        # now fill in from delayed agenda
        if delay:
            trellis, num = add_delayed(trellis, delay, start, depth)
            # this changed the size, so shift all indices up by num
            idx += num
            start += num
            end += num
            idxmap = build_idxmap(trellis, depth - 1)
        # now add new item, merging if necessary
        if start != end:
            # end + 1 so the slice gets the last column
            trellis = merge_columns(trellis, start, end + 1)
            idxmap = build_idxmap(trellis, depth - 1)
            debug_display_trellis(trellis)
        #trellis[idx]
        #trellis[idx][depth]
        trellis[idx][depth].extend(items)
        logging.debug('Added items at idx {} depth {}: {}'
                      .format(idx, depth, items))
    # when agendum is done, just append any remaining delayed items
    trellis, _ = add_delayed(trellis, delay, len(trellis), depth)
    # if the agenda was shorter than the prev tier, fill in empty values
    idx += 1
    while idx < len(trellis):
        logging.debug('Filling in empty slot at idx {}'.format(idx))
        trellis[idx].append([])
        idx += 1
    logging.debug('Agenda done.')
    for col in trellis:
        logging.debug('Col {}'.format(col))
    return trellis

def get_agenda(tier):
    agenda = [(get_alignment_expression_ids(item.alignment), item)
              for item in tier.items]
    # then group those with the same alignment (still a list [(ids, item)])
    agenda = deque(tuple([k, [g[1] for g in gs]])
                   for k, gs in groupby(agenda, key=lambda x: x[0]))
    return agenda

def build_idxmap(trellis, depth):
    idxmap = {it.id:i for i, col in enumerate(trellis) for it in col[depth]}
    logging.debug('Built idxmap for depth {}:\n  {}'.format(depth, idxmap))
    return idxmap

def add_delayed(trellis, delay, pos, depth):
    num = 0
    while delay:
        _, delayed_items = delay.popleft()
        col = [[]] * (depth)
        col.append(delayed_items)
        trellis.insert(pos, col)
        logging.debug('Added delayed items at {}: {}'
                      .format(pos, delayed_items))
        num += 1
    return trellis, num

def merge_columns(trellis, start, end):
    logging.debug('Merging columns {}:{}'.format(start, end-1))
    return (
        trellis[:start] +
        # too bad we need that ugly map(list...) in there :(
        [list(map(list,
                  map(chain.from_iterable,
                      zip_longest(*trellis[start:end], fillvalue=[]))))
        ] +
        trellis[end:]
    )

def debug_display_trellis(trellis):
    strs = []
    for col in trellis:
        toks = [' '.join(i.id for i in row) if row else '[]' for row in col]
        maxlen = max(len(t) for t in toks)
        toks = [t.ljust(maxlen) for t in toks]
        strs.append(toks)
    logging.debug(
        'Trellis:\n' +
        '\n'.join(' | '.join(toks)
                  for toks in zip_longest(*strs, fillvalue='--'))
    )
