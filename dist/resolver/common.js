"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
function addObjectToResolvedTimeline(resolvedTimeline, obj) {
    resolvedTimeline.objects[obj.id] = obj;
    if (obj.classes) {
        _.each(obj.classes, function (className) {
            if (className) {
                if (!resolvedTimeline.classes[className])
                    resolvedTimeline.classes[className] = [];
                resolvedTimeline.classes[className].push(obj.id);
            }
        });
    }
    if (obj.layer) {
        if (!resolvedTimeline.layers[obj.layer])
            resolvedTimeline.layers[obj.layer] = [];
        resolvedTimeline.layers[obj.layer].push(obj.id);
    }
}
exports.addObjectToResolvedTimeline = addObjectToResolvedTimeline;
//# sourceMappingURL=common.js.map