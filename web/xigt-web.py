
import sys
from xigt.codecs import xigtxml
from flask import Flask, flash, request, render_template, url_for

app = Flask(__name__)

#app.config.update(dict(
    # environment vars
#))

xc = xigtxml.load(open(sys.argv[1], 'r'))

@app.route('/')
def browse_corpus():
    return render_template('browse.html', xc=xc)

if __name__ == '__main__':
    app.debug = True
    app.run()