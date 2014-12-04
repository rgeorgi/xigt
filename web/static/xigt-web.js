
function escapeId(id) {
    /*
    From: http://www.w3.org/TR/CSS2/syndata.html
    In CSS, identifiers (including element names, classes, and IDs in
    selectors) can contain only the characters [a-zA-Z0-9] and ISO 10646
    characters U+00A0 and higher, plus the hyphen (-) and the underscore
    (_); they cannot start with a digit, two hyphens, or a hyphen
    followed by a digit. Identifiers can also contain escaped
    characters and any ISO 10646 character as a numeric code (see next
    item). For instance, the identifier "B&W?" may be written as
    "B\&W\?" or "B\26 W\3F".
    */
    function escapeIdChars(id) {
        return Array.prototype.map.call(id, function(c) {
                return /[-_a-zA-Z0-9\u00a0-\uffff]/.test(c) ? c : "\\" + c;
            }).join("")
            .replace(/^(--|-?\d+)/, function(match, c, offset, s){
                return "\\" + c.charCodeAt(0) + " " + c.slice(1);
            });
    }
    if (id.slice(0,1) == "#") return "#" + escapeIdChars(id.slice(1));
    else return escapeIdChars(id);
}

function selectItem(igt, itemId) {
    return d3.select(igt).select("[data-id=\"" + itemId + "\"]");
}

var algnexprRe = /([a-zA-Z][\-.\w]*)(\[[^\]]*\])?|\+|,/g;
var spanRe = /-?\d+:-?\d+|\+|,/g;

function alignmentExpressionIds(alex) {
    var ids = [], aeMatch;
    while ((aeMatch = algnexprRe.exec(alex)) !== null) {
        var aeFull = aeMatch[0],
            aeId = aeMatch[1],
            aeSpans = aeMatch[2];
        if (aeId) ids.push(aeId);
    }
    return ids;
}

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
            var s = getItemContent(igt, escapeId(aeTerm.id));
            if (aeTerm.span !== undefined) {
                s = s.slice(aeTerm.span[0], aeTerm.span[1]);
            }
            tokens.push(s);
        }
    })
    return tokens.join("");
}

function highlightReferents(igt, d, direct) {
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
                applySpans(igt, itemId, spans[itemId], refAttr, direct);
            }

        }
    });
}

function applySpans(igt, itemId, spans, spanclass, direct) {
    var text, chars, spanOn, length;
    selectItem(igt, itemId)
        .classed({"inherited": true, "referenced": direct})
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
        })
        .each(function(d) { highlightReferents(igt, d, false); });
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
    d3.select(igt).selectAll("div.item.inherited")
        .text(function(d) {
            return d._cache.text || getItemContent(igt, escapeId(d.id));
         })
        .classed({"inherited": false, "referenced": false});
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

/*
    Interlinear tiers get grouped into columns like this:
      AB-C
      1 -2
      <div class="interlinear-column">
        <div class="interlinear-row">
          <div class="item">AB-C</div>
        </div>
        <div class="interlinear-row">
          <div class="interlinear-column">
            <div class="interlinear-row">
              <div class="item">1</div>
              <div class="item">-2</div>
            </div>
          </div>
        </div>
      </div>

*/

function mergeColumns(c1, c2) {
    var children = [], left, right;
    for (i=0; i<c1.children.length; i++) {
        left = c1.children[i]; right = c2.children[i];
        if (left.class != "row") left = {"class": "row", "children": [left]};
        if (right.class != "row") right = {"class": "row", "children": [right]};
        children.push(Array.prototype.push.apply(left, right));
    }
    c1.children = children;
    return c1;
}

function hasIntersection(s1, s2) {
    for (i=0; i<s1.length; i++) {
        for (j=0; j<s2.length; j++) {
            if (s1[i] == s2[j]) return true;
        }
    }
    return false;
}

function collectGroupedItems(items) {
    var curIds = [], itemIds, groups = [], curgrp;
    items.forEach(function(item) {
        itemIds = alignmentExpressionIds(item.alignment || item.segmentation);
        if (curIds.length && itemIds && hasIntersection(curIds, itemIds)) {
            curIds = Array.prototype.push.apply(curIds, itemIds);
            curgrp = groups[groups.length-1];
            curgrp.items.push(item);
            curgrp.targets = curIds;
        } else {
            curIds = itemIds || [];
            groups.push({"items": [item], "targets": [curIds]);
        }
    });
    return groups;
}

function interlinearizeTier(tg, t) {
    var children = [];
    var srcItemGroups = collectGroupedItems(t.items);
    srcItemGroups.forEach(function(ig, i) {

    });
    return tg;
}

function computeTierGroups(igtData) {
    var groups = [], prevClass, curIds = [], igroups;
    igtData.tiers.forEach(function(t) {
        var algnTgt = t.alignment || t.segmentation;
        if (t.class == "interlinear"
                && prevClass == "interlinear"
                && curIds.indexOf(algnTgt) >= 0) {
            igroups = groups[groups.length -1].children;
            groups[groups.length -1].children = interlinearizeTier(igroups, t)
            groups[groups.length -1].tiers.push(t);
        } else {
            igroups = t.items.map(function(item) {
                return {"class": "item", "item": item};
            });
            groups.push({"tiers": [t], "class": t.class, "children": igroups});
            curIds = [];
        }
        prevClass = t.class;
        if (t.id) curIds.push(t.id)
    });
    return groups;
}

function populateItemGroup(ig, igData) {
    if (igData.class == "item") {
        ig.selectAll(".item")
            .data([igData.item])
          .enter().append("div")
            .classed("item", true)
            .attr("data-id", function(d) { return d.id; });
    }
    // if (!igData.children.length) {

    // } else {
    //     for (i=0; i<igData.children.length; i++) {

    //         populateItemGroup(ig.append())
    //     }
    // }
}

function populateTierGroup(tg, tgData) {
    // first a header, then the content
    var header = tg.append("div")
        .classed("tiergroup-header", true);
    header.selectAll("div.tier-label")
        .data(tgData.tiers)
      .enter().append("div")
        .classed("tier-label", true)
        .text(function(d) { return d.type || "(none)"; });
    var content = tg.append("div")
        .classed("tiergroup-content", true);
    content.selectAll(".itemgroup")
        .data(tgData.children)
      .enter().append("div")
        .classed("itemgroup", true)
        .each(function(d) { populateItemGroup(d3.select(this), d); });
}

function igtLayout(elemId, igtData) {
    elemId = escapeId(elemId);
    var igt = d3.select(elemId);
    //var igroups = interlinearItemGroups(tgroups);
    var tiergroups = igt.selectAll(".tiergroup")
        .data(computeTierGroups(igtData))
      .enter().append('div')
        .classed('tiergroup', true)
        .each(function(d) { populateTierGroup(d3.select(this), d); });
    igt.selectAll("div.itemgroup div.item")
        .each(function(d) { d._cache = {}; })
        .text(function(d) { return getItemContent(elemId, escapeId(d.id));});
    // var tiers = tiergroups.selectAll(".tier")
    //     .data(function(d) { return d; })
    //   .enter().append("div")
    //     .classed("tier", true);
    //var tiers = tiergroups.selectAll(".tier")
    //    .data(igtData.tiers);
    //tiers.each(function(td) {
        //var groups = d3.select(this).selectAll("div.tier-content div.column")
        //    .data(td.groups);
        //groups.each(function(gd) {
    //        d3.select(this).selectAll("div.item")
    //            .data(td.items)
    //            .each(function(d) { d._cache = {}; })  // setup a cache
    //            .on("mouseover", function(d) { highlightReferents(elemId, d, true); })
    //            .on("mouseout", function(d) { dehighlightReferents(elemId); });

            //items.append(groups.selectAll("div.item").data(gd.items));
        //});
    //});
    //var items = tiers.selectAll("div.item");
    //items.text(function(d) { return getItemContent(elemId, escapeId(d.id)); });
}