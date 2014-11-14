from xigt.core import get_alignment_expression_ids

def item_groups(tier, method='left-align'):
    algntier_ref = tier.alignment or tier.segmentation
    if algntier_ref is None:
        return [list(tier.items)]
    else:
        algntier = tier.get_aligned_tier(algntier_ref)
        trellis = [[]] * len(algntier)
        algnids = [item.id for item in algntier]
        for item in tier:

        used = set()
        for algnitem in algntier:
            trellis.append([])
            for iitem in tier:
                if item.


# put column grouping code from exporters.latex in here