
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

function interlinearizeTier(tg, t) {
    var children = [];
    t.items.forEach(function(item, i) {

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
                    return {"class": "col",
                            "depth": 1,
                            "children": [{"class": "item", "item": item}]};
            });
            groups.push({"tiers": [t], "class": t.class, "children": igroups});
            curIds = [];
        }
        prevClass = t.class;
        if (t.id) curIds.push(t.id)
    });
    return groups;
}


// function interlinearTierGroups(igtData) {
//     var groups = [], curgroup = [];
//     igtData.tiers.forEach(function(t) {
//         var algntgt = t.alignment || t.segmentation;
//         var ingroup = curgroup.length == 0;  // always true for empty curgroup
//         if (algntgt) {
//             for (i=0; i<curgroup.length; i++) {
//                 if (curgroup[i].id == algntgt) ingroup = true;
//             }
//         }
//         if (t.class == "interlinear" && ingroup) {
//             curgroup.push(t);
//         } else {
//             if (curgroup.length) groups.push(buildItemGroups(curgroup));
//             curgroup = [];
//             groups.push(buildItemGroups([t]));
//         }
//     })
//     if (curgroup.length) groups.push(buildItemGroups(curgroup));
//     return groups;
// }

// function buildItemGroups(i, idx, tgroup) {
    
//         Group those that overlap (share an ID). E.g.
//             1  2  3  4  5
//             a: [1, 2]; b: [2, 4]; c: [3]; d: [2, 4]; e: [4, 5]
//         This would have 3 groups:
//           [a, b]: [1, 2, 4]
//           [c] : [3]
//           [d, e] : [2, 4, 5]
//         In b's case, 4 is not considered because it is not contiguous with the
//         matched alignments. In d's case, it doesn't group with b because they
//         aren't adjacent, but it does group with e. If we pull out c and 3, we
//         would have 1 group: [a, b, d, e] : [1, 2, 4, 5]
    
//     var src = tgroup[i], tgt = idx[()];
//     var tgtIdMap = {};
//     for (i=0; i<tgt.items.length; i++) tgtIdMap[tgt.items[i].id] = i;
//     var srcIdx = 0; tgtIdx = 0, cols = [];
//     while (srcIdx < src.items.length) {
//         var item = src.items[srcIdx];
//         var tgtIds = alignmentExpressionIds(src.alignment || src.segmentation);
//         var min = d3.min(tgtIds), max = d3.max(tgtIds);
//         if (cols.length) {
//             cols.push({"source": [item], "target": tgtIds});
//         } else
//         srcIdx += 1;
//     }
// }

// function interlinearItemGroups(tgroup) {
//     // assumptions:
//     //  * root tier (that doesn't align to any other in tgroup) is first tier
//     //  * there will be exactly one "root" tier
//     //  * all subsequent tiers align to tiers above them
//     var idx, groups;
//     for (i=0; i<tgroup.length; i++) {
//         if (! (tgroup[i].alignment || tgroup[i].segmentation)) root = i;
//     }
//     idx = tgroup.reduce(
//         function(o, t, i) {
//             o[t.id] = {
//                 "index": i,
//                 "target": t.alignment || t.segmentation,
//                 "targetOf": []
//             }
//             return o;
//         }, {});
//     tgroup.forEach(function(t) {
//         var tgt = t.alignment || t.segmentation;
//         if (tgt !== undefined) idx[tgt].targetOf.push(t.id)
//     });
//     groups = buildGroups(i, idx, tgroup);

//     var igroups = [], maxCols = -1;

//     var alnIdx = tgroup.reduce(function(o, t, i) {})

//     for (i=0; i<tgroup.items.length; i++) { idIdx[tgroup.items[i].id] = i; }
//     // map each tier id (if given) to its index in the tiergroup
//     for (i=0; i<tgroup.length; i++) { depthMap[tgroup[i].id] = i; }
//     // find the tier requiring the fewest columns; these will be the outer divs
//     for (i=0; i<tgroup.length; i++) {
//         var tier = tgroup[i], igroup = [];
//         // for ()
//     }
//     var revAlgnMap = {};
//     // tgroup.forEach(function(t) {
//     //     t.items.forEach(function(i) {

//     //     });
//     // });
//     // makeColumn = function() {
//     //     var col = [];
//     //     for (i=0; i<tgroups.length; i++) col.push([]);
//     //     return col;
//     // }
//     // var depthMap = {}, indices=[], revAlgnMap = {}, root = 0;
//     // for (i=0; i<tgroups.length; i++) {
//     //     var t = tgroups[i];
//     //     depthMap[t.id] = i;  // doesn't matter if a source tier has no id?
//     //     indices[i] = 0;
//     //     if (t.alignment) { }
//     //     if (! (t.alignment || t.segmentation)) root = i;
//     // }
//     // var trellis = [];
//     // var t = tgroups[root];
//     // for (i=0; i<t.items.length; i++) {
//     //     trellis.push(makeColumn());
//     //     trellis[i][0].push(t.items[i]);
//     // }
//     // // done setting up; now to do real work
//     // for (i=0; i<tgroups.length; i++) {

//     // }
//     // return trellis;
// }

function populateItemGroup(ig, igData) {
    if (!igData.children.length) {

    } else {
        for (i=0; i<igData.children.length; i++) {

            populateItemGroup(ig.append())
        }
    }
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