
import sys
import json
#from os import path
from xigt.codecs import xigtxml
from xigt.views import nested_columns
from flask import Flask, flash, request, render_template, url_for

app = Flask(__name__)
with open('config.json') as f:
    settings = json.loads(f.read())

#app.config.update(dict(
    # environment vars
#))

xc = xigtxml.load(open(sys.argv[1], 'r'))

def make_igt_object(igt):
    tiers = []
    for tier in igt.tiers:
        tier_obj = {
            'id': tier.id,
            'type': tier.type,
            'children': tier.items,
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

if __name__ == '__main__':
    app.debug = True
    app.run()
