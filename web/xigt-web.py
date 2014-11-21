
import sys
import json
#from os import path
from xigt.codecs import xigtxml
from xigt.views import item_groups
from flask import Flask, flash, request, render_template, url_for
from os import path

app = Flask(__name__)
with open('config.json') as f:
    settings = json.loads(f.read())

#app.config.update(dict(
    # environment vars
#))

xc = xigtxml.load(open(sys.argv[1], 'r'))

def make_item_object(item):
    obj = {'id': item.id}
    if item.type: obj['type'] = item.type
    if item.text: obj['text'] = item.text
    obj.update(item.attributes)
    return obj

def make_igt_object(igt):
    tiers = []
    for tier in igt.tiers:
        tier_obj = {
            'id': tier.id,
            'type': tier.type,
            'items': [make_item_object(i) for i in tier.items],
            # 'groups': [{'ids': ig[0] or None,
            #             'items': [make_item_object(i) for i in ig[1]]}
            #            for ig in item_groups(tier)],
            'class': settings.get('tier_classes', {}).get(
                tier.type, settings.get('default_tier_class', '')
            )
        }
        tiers.append(tier_obj)
    return {'id': igt.id, 'tiers': tiers}

@app.route('/')
def browse_corpus():
    igts = list(xc.igts)
    igt_objs = map(make_igt_object, igts)
    return render_template('browse.html', igts=igt_objs, settings=settings)

@app.route('/corpus/<filename>')
def browse_example_corpus(filename):
    p = path.join('../examples/odin/{}'.format(filename))
    if not path.isfile(p):
        p = path.join('../examples/abkhaz/{}'.format(filename))
    if not path.isfile(p):
        return ""
    xc = xigtxml.load(open(p, 'r'))
    igts = list(xc.igts)
    igt_objs = map(make_igt_object, igts)
    return render_template('browse.html', igts=igt_objs, settings=settings)

if __name__ == '__main__':
    app.debug = True
    app.run()
