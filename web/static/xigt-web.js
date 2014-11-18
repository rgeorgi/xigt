
function selectItem(igtElem, itemId) {
    return d3.select(igtElem).select("[data-id=\"" + itemId + "\"]");
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

function getItemContent(igt, itemId) {
    var item = selectItem(igt, itemId);
    var itemData = item.datum();
    if (itemData.text !== undefined)
        return itemData.text;
    if (itemData.content !== undefined)
        return resolveAlignmentExpression(igt, itemData.content);
    if (itemData.segmentation !== undefined)
        return resolveAlignmentExpression(igt, itemData.segmentation);
    // last resort, get the displayed text (is this a good idea?)
    return item.text();
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
    //  .enter().append("div")
    //    .attr("class", function(d) { return tierClasses(d).join(" "); });
    // tiers.append("div")
    //     .attr("class", "tier-header")
    //     .text(function(d) { return d.type; });
    // tiers.append("div")
    //     .attr("class", "tier-content");
    //igt.selectAll("div.tier.interlinear div.column");
}