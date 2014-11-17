
from __future__ import print_function
import re
import logging
from xigt.views import group_alignments
from xigt.exporters.util import sub

DEFAULT_TIER_TYPES = ('words', 'morphemes', 'glosses')
# order matters here
LATEX_CHARMAP = [
    ('\\', '\\textbackslash'),
    ('&', '\\&'),
    ('%', '\\%'),
    ('$', '\\$'),
    ('#', '\\#'),
    ('_', '\\_'),
    ('{', '\\{'),
    ('}', '\\}'),
    ('~', '\\textasciitilde'),
    ('^', '\\textasciicircum'),
]

header = '''
\\documentclass{article}
\\usepackage{gb4e}
\\begin{document}
'''

footer = '''
\\end{document}
'''

def xigt_export(xc, outpath, config=None):
    config = prepare_config(config)
    with open(outpath, 'w') as out_fh:
        print(header, file=out_fh)
        for s in export_corpus(xc, config):
            print(s, file=out_fh)
            print('', file=out_fh)  # separate with a blank line
        print(footer, file=out_fh)

def prepare_config(config):
    if config is None:
        config = {}
    config.setdefault('tier_types', DEFAULT_TIER_TYPES)
    config.setdefault('item_substitutions', [])
    config.setdefault('tier_substitutions', [])
    return config

def escape(s):
    # consider a re sub with a function. e.g.
    # _character_unescapes = {'\\s': _field_delimiter, '\\n': '\n', '\\\\': '\\'}
    # _unescape_func = lambda m: _character_unescapes[m.group(0)]
    # _unescape_re = re.compile(r'(\\s|\\n|\\\\)')
    # _unescape_re.sub(_unescape_func, string, re.UNICODE)
    for c, r in LATEX_CHARMAP:
        s = s.replace(c, r)
    return s

def export_corpus(xc, config):
    for igt in xc:
        logging.debug('Exporting {}'.format(str(igt.id)))
        x = export_igt(igt, config)
        yield x

def export_igt(igt, config):
    tier_types = config['tier_types']
    item_subs = config['item_substitutions']
    tier_subs = config['tier_substitutions']
    tiers = []
    for tier in igt.tiers:
        typ = tier.type
        if typ is not None and typ.lower() in tier_types:
            tiers.append(tier)
    if len(tiers) < 2:
        return '%\n% cannot export IGT {}\n%'.format(igt.id)
    logging.debug('Aligning tiers: {}'.format(', '.join(t.id for t in tiers)))
    lines = []
    all_groups = group_alignments(tiers)
    for col in all_groups:
        logging.debug('Col {}'.format([[i.id for i in r] for r in col]))
    lines.append('\\begin{exe}\\small')
    lines.append('\\ex\\g{}'.format('l' * len(tiers)))
    depth = len(all_groups[0])
    for i in range(depth):
        toks = []
        tier_type = tiers[i].type
        for col in all_groups:
            items = col[i]
            toks.append('{{{}}}'.format(
                ' '.join(
                    sub(escape(item.get_content() or '{}'),
                        tier_type,
                        item_subs)
                    for item in items
                )
            ))
        lines.append(sub(' '.join(toks) + '\\\\', tier_type, tier_subs))
    # add translation
    for tier in igt.tiers:
        if tier.type == 'translations' and len(tier) > 0:
            lines.append('\\trans {}'.format(
                sub(escape(tier[0].get_content() or '{}'),
                    tier.type,
                    tier_subs)
            ))
    lines.append('\\end{exe}')
    return '\n'.join(lines)
