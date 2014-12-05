
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

function containedIds(obj) {
    var ids = [], subIds;
    if (obj.class == "item" && item.id)
        ids.push(item.id);
    else {
        obj.children.forEach(function (c) {
            subIds = containedIds(c);
            ids = ids.concat(subIds);
        })
    }
    return ids;
}

function mergeColumns(c1, c2) {
    var children = [],
        depth = d3.max([c1.children.length, c2.children.length]),
        left, right;
    for (i=0; i<depth; i++) {
        left = c1.children[i] || {"class": "row", "children": []};
        right = c2.children[i] || {"class": "row", "children": []};
        if (left.class != "row") left = {"class": "row", "children": [left]};
        if (right.class != "row") right = {"class": "row", "children": [right]};
        children.push(left.concat(right));
    }
    c1.children = children;
    c1.ids = c1.ids.concat(c2.ids)
    return c1;
}

function hasIntersection(s1, s2) {
    var i, j;
    for (i=0; i<s1.length; i++) {
        for (j=0; j<s2.length; j++) {
            if (s1[i] == s2[j]) return true;
        }
    }
    return false;
}

function findColSpan(ig, cols, offset) {
    var start = -1, end = -1, i;
    for (i=offset; i<cols.length; i++) {
        if (hasIntersection(ig.targets, cols[i].ids || [])) {
            start = i; break;
        }
    }
    if (start < 0)
        return null;
    for (i=start+1; i<cols.length; i++) {
        if (hasIntersection(ig.targets, cols[i].ids || [])) end = i;
        else break;
    }
    return {"start": start, "end": end}
}

function collectGroupedItems(items) {
    var curIds = [], itemIds, groups = [], curgrp;
    items.forEach(function(item) {
        itemIds = alignmentExpressionIds(item.alignment || item.segmentation);
        if (curIds.length && itemIds && hasIntersection(curIds, itemIds)) {
            curIds = curIds.concat(itemIds);
            curgrp = groups[groups.length-1];
            curgrp.items.push(item);
            curgrp.targets = curIds;
        } else {
            curIds = itemIds || [];
            groups.push({"items": [item], "targets": d3.set(curIds)});
        }
    });
    return groups;
}

function interlinearizeItems(cols, ig, depth) {
    var i, span, maxDepth, colChild, subCols;
    while (cols.length > 1) {
        cols = [mergeColumns(cols[0], cols[1])].concat(cols.slice(2));
    }
    // from here cols is a single column
    cols = cols[0];
    // Now find the proper depth; depth is the number of rows in columns,
    // not nesting depth.
    for (i=0; i<depth; i++) {
        colChild = cols.children[i];
        if (colChild === undefined)
            cols.children[i] = emptyRow();
        else if (colChild.class == "row") {
            subCols = colChild.children;
            span = findColSpan(ig, subCols, 0);
            if (span !== null) {
                // do some recursive surgery to insert the new items
                cols.children[i] = (
                    subCols.slice(0, span.start) +
                    interlinearizeItems(
                        subCols.slice(span.start, span.end), ig, depth
                    ) +
                    subCols.slice(span.end)
                )
            }
            maxDepth = 
        }
    }
    return cols;
    // if (depth <= 0) {
    //     cols
    // }
}

function emptyRow() { return {"class": "row", "ids": [], "children": []}; }

function fillItemGroup(obj, depth) {
    var ig = [];
    for (i=0; i<depth-1; i++) ig.push(emptyRow());
    ig.push(obj);
    return ig;
}

function interlinearizeTier(tg, t, depth) {
    var children = [],
        tgIdx = 0,
        delay = [],
        colspan, curIds;
    (collectGroupedItems(t.items) || []).forEach(function(ig, i) {
        colspan = findColSpan(ig, tg, tgIdx);
        if (colspan !== null) {
            // first catch up to the next index by padding and undelaying
            while (tgIdx < colspan.start) {
                children.push(interlinearizeItems(
                    tg[tgIdx], {"items": [], "targets": []}, depth
                ));
                tgIdx += 1;
            }
            while (delay.length)
                children.push(fillItemGroup(delay.shift(), depth));
            // now add new items (align to as many columns as necessary)
            children.push(interlinearizeItems(
                tg.slice(colspan.start, colspan.end), ig, depth
            ));
            tgIdx = colspan.end;
        } else {
            delay.push(ig);
        }
    });
    // If there's any remaining or delayed items, add them
    while (tgIdx < tg.length) {
        children.push(interlinearizeItems(tg[tgIdx], [], depth));
        tgIdx += 1;
    }
    while (delay.length) children.push(fillItemGroup(delay.shift(), depth));

    return children;
}

function computeTierGroups(igtData) {
    var groups = [],
        curIds = [],
        depthCtr = {}, newDepth,
        prevClass, igroups, algnTgt;
    igtData.tiers.forEach(function(t) {
        igroups = null;
        algnTgt = t.alignment || t.segmentation;
        if (t.class == "interlinear"
                && prevClass == "interlinear"
                && curIds.indexOf(algnTgt) >= 0) {
            newDepth = depthCtr[algnTgt] + 1;
            igroups = interlinearizeTier(
                groups[groups.length-1].children, t, newDepth
            );
            if (igroups) {
                groups[groups.length-1].children = igroups;
                groups[groups.length-1].tiers.push(t);
                depthCtr[t.id] = newDepth;
            }
        }
        // igroups can be null if the tier isn't interlinear or if
        // interlinearization failed
        if (!igroups) {
            igroups = t.items.map(function(item) {
                return {"class": "item", "ids": [item.id], "item": item};
            });
            groups.push({"tiers": [t],
                         "ids": igroups.map(function(ig) { return ig.ids; }),
                         "class": t.class, "children": igroups});
            curIds = [];
            depthCtr[t.id] = 1;
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