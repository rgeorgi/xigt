
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
    tiers.each(function(td) {
        //var groups = d3.select(this).selectAll("div.tier-content div.column")
        //    .data(td.groups);
        //groups.each(function(gd) {
            d3.select(this).selectAll("div.item")
                .data(td.items)
                .on("mouseover", function(d) {
                    (alignmentExpressionSpans(d.segmentation) || []).forEach(function(term) {
                        if (term.id !== undefined) {
                            var item = igt.select("[data-id=\"" + term.id + "\"]");
                            item.classed("segmented", true);
                        }
                    });
                })
                .on("mouseout", function(d) {
                    igt.selectAll(".segmented")
                        .classed("segmented", false);
                });


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