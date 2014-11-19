
function selectItem(igt, itemId) {
    return d3.select(igt).select("[data-id=\"" + itemId + "\"]");
}

var algnexprRe = /([a-zA-Z][\-.\w]*)(\[[^\]]*\])?|\+|,/g;
var spanRe = /-?\d+:-?\d+|\+|,/g;

function alignmentExpressionSpans(alex) {
    var spans = [], aeMatch, spanMatch;
    while ((aeMatch = algnexprRe.exec(alex)) !== null) {
        var aeFull = aeMatch[0],
            aeId = aeMatch[1],
            aeSpans = aeMatch[2];
        if (aeFull == "+" || aeFull == ",") {  // operator
            spans.push({"operator": aeFull})
        } else if (aeSpans === undefined) {  // id without span
            spans.push({"id": aeId})
        } else { // id with span
            while ((spanMatch = spanRe.exec(aeSpans)) !== null) {
                var span = spanMatch[0];
                if (span == "+" || span == ",") {
                    spans.push({"operator": span});
                } else {
                    indices = span.split(":");
                    var start = parseInt(indices[0]),
                        end = parseInt(indices[1]);
                    spans.push({"id": aeId, "span": [start, end]});
                }
            }
        }
    }
    return spans;
}

function resolveAlignmentExpression(igt, alex) {
    var tokens = [];
    alignmentExpressionSpans(alex).forEach(function(aeTerm) {
        if (aeTerm.operator == "+") {
            tokens.push("");  // not necessary; here in case of extensions
        } else if (aeTerm.operator == ",") {
            tokens.push(" ");
        } else {
            var s = getItemContent(igt, aeTerm.id);
            if (aeTerm.span !== undefined) {
                s = s.slice(aeTerm.span[0], aeTerm.span[1]);
            }
            tokens.push(s);
        }
    })
    return tokens.join("");
}

function highlightReferents(igt, d) {
    (settings.reference_attributes || []).forEach(function(refAttr) {
        if (d[refAttr] == null) return;
        aeSpans = alignmentExpressionSpans(d[refAttr]);
        if (aeSpans == null) return;
        var spans = {};
        aeSpans.forEach(function(term) {
            if (term.id == null) return;
            if (term.operator != null) return;  // operators don't matter here
            if (spans[term.id] == null) spans[term.id] = [];
            spans[term.id].push(term.span);
        });
        for (var itemId in spans) {
            if (spans.hasOwnProperty(itemId)) {
                applySpans(igt, itemId, spans[itemId], refAttr);
            }
        }
    });
}

function applySpans(igt, itemId, spans, spanclass) {
    var text, chars, spanOn, length;
    selectItem(igt, itemId)
        .classed("highlighted", true)
        .html(function(d) {
            text = d._cache.text || getItemContent(igt, itemId);
            length = text.length;
            chars = Array.apply(null, new Array(length))
                        .map(Number.prototype.valueOf,0);
            (spans || []).forEach(function(span) {
                if (span == null) span = [0, length];
                span = normRange(span[0], span[1], length);
                for (i = span[0]; i < span[1]; i++) {
                    chars[i] += 1;
                }
            });
            spanOn = false;
            chars = chars.map(function(c, i) {
                var s = "";
                if (c > 0 && !spanOn) {
                    spanOn = true;
                    s = "<span class=\"" + spanclass + "\">";
                } else if (c == 0 && spanOn) {
                    spanOn = false;
                    s = "</span>";
                }
                s += text[i];
                if (i == length-1 && spanOn) s += "</span>";
                return s;
            })
            return chars.join("");
        });
}

function normRange(start, end, length) {
    start = start >= 0 ? start : length - start;
    end = end >= 0 ? end : length - end;
    if (end < start) {
        var tmp = start;
        start = end;
        end = tmp;
    }
    return [start, end];
}

function dehighlightReferents(igt) {
    d3.select(igt).selectAll("div.item.highlighted")
        .text(function(d) { return d._cache.text || getItemContent(igt, d.id); })
        .classed("highlighted", false);
}

function getItemContent(igt, itemId) {
    var item = selectItem(igt, itemId);
    var itemData = item.datum();
    var content;
    if (itemData.text !== undefined)
        content = itemData.text;
    else if (itemData.content !== undefined)
        content = resolveAlignmentExpression(igt, itemData.content);
    else if (itemData.segmentation !== undefined)
        content = resolveAlignmentExpression(igt, itemData.segmentation);
    // last resort, get the displayed text (is this a good idea?)
    else
        content = item.text();
    itemData._cache.text = content;  // needs to be invalidated if it changes
    return content;
}

function tierClasses(tier) {
    var classes = ["tier"];
    if (tier.class) {
        classes.push.apply(tier.class.split());
    }
    return classes;
}

function igtLayout(elemId, igtData) {
    var igt = d3.select(elemId);
    var tiers = igt.selectAll(".tier")
        .data(igtData.tiers);
    tiers.each(function(td) {
        //var groups = d3.select(this).selectAll("div.tier-content div.column")
        //    .data(td.groups);
        //groups.each(function(gd) {
            d3.select(this).selectAll("div.item")
                .data(td.items)
                .each(function(d) { d._cache = {}; })  // setup a cache
                .on("mouseover", function(d) { highlightReferents(elemId, d); })
                .on("mouseout", function(d) { dehighlightReferents(elemId); });

            //items.append(groups.selectAll("div.item").data(gd.items));
        //});
    });
    var items = tiers.selectAll("div.item");
    items.text(function(d) { return getItemContent(elemId, d.id); });
    // resize columns
    // some possibilities:
    // many to many
    // many to none
    // none to many
    // var interlinearTierIds = []
    // igt.selectAll("tier.interlinear").each(function(d){
    //     interlinearTierIds.push(d.id);
    // });
    // var sizeAffects = {};
    // var sizeDepends = {};

}