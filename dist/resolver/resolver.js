"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
var lib_1 = require("../lib");
var validate_1 = require("./validate");
var expression_1 = require("./expression");
var state_1 = require("./state");
var common_1 = require("./common");
var Resolver = /** @class */ (function () {
    function Resolver() {
    }
    /**
     * Go through all objects on the timeline and calculate all the timings.
     * Returns a ResolvedTimeline which can be piped into Resolver.getState()
     * @param timeline Array of timeline objects
     * @param options Resolve options
     */
    Resolver.resolveTimeline = function (timeline, options) {
        if (!_.isArray(timeline))
            throw new Error('resolveTimeline: parameter timeline missing');
        if (!options)
            throw new Error('resolveTimeline: parameter options missing');
        validate_1.validateTimeline(timeline, false);
        lib_1.resetId();
        var resolvedTimeline = {
            options: _.clone(options),
            objects: {},
            classes: {},
            layers: {},
            statistics: {
                unresolvedCount: 0,
                resolvedCount: 0,
                resolvedInstanceCount: 0,
                resolvedObjectCount: 0,
                resolvedGroupCount: 0,
                resolvedKeyframeCount: 0
            }
        };
        // Step 1: pre-populate resolvedTimeline with objects
        var addToResolvedTimeline = function (obj, levelDeep, parentId, isKeyframe) {
            if (resolvedTimeline.objects[obj.id])
                throw Error("All timelineObjects must be unique! (duplicate: \"" + obj.id + "\")");
            var o = lib_1.extendMandadory(_.clone(obj), {
                resolved: {
                    resolved: false,
                    resolving: false,
                    instances: [],
                    levelDeep: levelDeep
                }
            });
            if (parentId)
                o.resolved.parentId = parentId;
            if (isKeyframe)
                o.resolved.isKeyframe = true;
            common_1.addObjectToResolvedTimeline(resolvedTimeline, o);
            // Add children:
            if (obj.isGroup && obj.children) {
                _.each(obj.children, function (child) {
                    addToResolvedTimeline(child, levelDeep + 1, obj.id);
                });
            }
            // Add keyframes:
            if (obj.keyframes) {
                _.each(obj.keyframes, function (keyframe) {
                    var kf2 = lib_1.extendMandadory(_.clone(keyframe), {
                        layer: ''
                    });
                    addToResolvedTimeline(kf2, levelDeep + 1, obj.id, true);
                });
            }
        };
        _.each(timeline, function (obj) {
            addToResolvedTimeline(obj, 0);
        });
        // console.log('created flat tl', resolvedTimeline)
        // Step 2: go though and resolve the objects
        _.each(resolvedTimeline.objects, function (obj) {
            resolveTimelineObj(resolvedTimeline, obj);
        });
        return resolvedTimeline;
    };
    /** Calculate the state for all points in time.  */
    Resolver.resolveAllStates = function (resolvedTimeline) {
        return state_1.resolveStates(resolvedTimeline);
    };
    /**
     * Calculate the state at a given point in time.
     * Using a ResolvedTimeline calculated by Resolver.resolveTimeline() or
     * a ResolvedStates calculated by Resolver.resolveAllStates()
     * @param resolved ResolvedTimeline calculated by Resolver.resolveTimeline.
     * @param time The point in time where to calculate the state
     * @param eventLimit (Optional) Limits the number of returned upcoming events.
     */
    Resolver.getState = function (resolved, time, eventLimit) {
        return state_1.getState(resolved, time, eventLimit);
    };
    return Resolver;
}());
exports.Resolver = Resolver;
function resolveTimelineObj(resolvedTimeline, obj) {
    if (obj.resolved.resolved)
        return;
    if (obj.resolved.resolving)
        throw new Error("Circular dependency when trying to resolve \"" + obj.id + "\"");
    obj.resolved.resolving = true;
    // console.log(obj.id + ' resolving')
    var instances = [];
    var repeatingExpr = (obj.enable.repeating !== undefined ?
        expression_1.interpretExpression(obj.enable.repeating) :
        null);
    // console.log(obj.id + 'is repeating ' + repeatingExpr)
    var lookedupRepeating = lookupExpression(resolvedTimeline, obj, repeatingExpr, 'duration');
    // console.log(obj.id + 'looked up repeating', lookedupRepeating)
    if (_.isArray(lookedupRepeating)) {
        throw new Error("lookupExpression should never return an array for .duration lookup"); // perhaps tmp? maybe revisit this at some point
    }
    var start = (obj.enable.while !== undefined ?
        obj.enable.while :
        obj.enable.start !== undefined ?
            obj.enable.start :
            '');
    if (obj.enable.while + '' === '1') {
        start = 'true';
    }
    else if (obj.enable.while + '' === '0') {
        start = 'false';
    }
    // console.log(obj.id + 'start', start)
    var startExpr = expression_1.simplifyExpression(start);
    var parentInstances = null;
    var hasParent = false;
    var referToParent = false;
    if (obj.resolved.parentId) {
        // console.log(obj.id + 'has parent')
        hasParent = true;
        parentInstances = lookupExpression(resolvedTimeline, obj, expression_1.interpretExpression("#" + obj.resolved.parentId), 'start'); // a start-reference will always return an array, or null
        // console.log(obj.id + 'parents', parentInstances)
        if (lib_1.isConstant(startExpr)) {
            // console.log(obj.id + 'refer to parent')
            // Only use parent if the expression resolves to a number (ie doesn't contain any references)
            referToParent = true;
        }
    }
    // console.log(obj.id + ' look up expr', startExpr)
    var lookedupStarts = lookupExpression(resolvedTimeline, obj, startExpr, 'start');
    // console.log(obj.id + 'lookedup starts', lookedupStarts)
    var applyParentInstances = function (value) {
        var operate = function (a, b) {
            if (a === null || b === null)
                return null;
            return {
                value: a.value + b.value,
                references: lib_1.joinReferences(a.references, b.references)
            };
        };
        return lib_1.operateOnArrays(parentInstances, value, operate);
    };
    if (referToParent) {
        lookedupStarts = applyParentInstances(lookedupStarts);
    }
    if (obj.enable.while) {
        // console.log(obj.id + 'has .while')
        if (_.isArray(lookedupStarts)) {
            // console.log(obj.id + 'has looked up starts')
            instances = lookedupStarts;
        }
        else if (lookedupStarts !== null) {
            instances = [{
                    id: lib_1.getId(),
                    start: lookedupStarts.value,
                    end: null,
                    references: lookedupStarts.references
                }];
        }
        // console.log(obj.id + 'instances', instances)
    }
    else {
        var events_1 = [];
        var iStart_1 = 0;
        var iEnd_1 = 0;
        if (_.isArray(lookedupStarts)) {
            // console.log(obj.id + 'has lookedup starts')
            _.each(lookedupStarts, function (instance) {
                events_1.push({
                    time: instance.start,
                    value: true,
                    data: { instance: instance, id: obj.id + '_' + iStart_1++ },
                    references: instance.references
                });
            });
        }
        else if (lookedupStarts !== null) {
            events_1.push({
                time: lookedupStarts.value,
                value: true,
                data: { instance: { id: lib_1.getId(), start: lookedupStarts.value, end: null, references: lookedupStarts.references }, id: obj.id + '_' + iStart_1++ },
                references: lookedupStarts.references
            });
        }
        // console.log(obj.id + 'events', events)
        if (obj.enable.end !== undefined) {
            var endExpr = expression_1.interpretExpression(obj.enable.end);
            // console.log(obj.id + 'has end', endExpr)
            // lookedupEnds will contain an inverted list of instances. Therefore .start means an end
            var lookedupEnds = (endExpr ?
                lookupExpression(resolvedTimeline, obj, endExpr, 'end') :
                null);
            // console.log(obj.id + 'lookedupEnds (start = end)', lookedupEnds)
            if (referToParent && lib_1.isConstant(endExpr)) {
                lookedupEnds = applyParentInstances(lookedupEnds);
                // console.log(obj.id + 'referToParent & constant endExpr => lookedupEnds = ', lookedupEnds)
            }
            if (_.isArray(lookedupEnds)) {
                _.each(lookedupEnds, function (instance) {
                    events_1.push({
                        time: instance.start,
                        value: false,
                        data: { instance: instance, id: obj.id + '_' + iEnd_1++ },
                        references: instance.references
                    });
                });
            }
            else if (lookedupEnds !== null) {
                events_1.push({
                    time: lookedupEnds.value,
                    value: false,
                    data: { instance: { id: lib_1.getId(), start: lookedupEnds.value, end: null, references: lookedupEnds.references }, id: obj.id + '_' + iEnd_1++ },
                    references: lookedupEnds.references
                });
            }
            // console.log(obj.id + 'events', events)
        }
        else if (obj.enable.duration !== undefined) {
            // console.log(obj.id + 'has duration')
            var durationExpr = expression_1.interpretExpression(obj.enable.duration);
            var lookedupDuration = lookupExpression(resolvedTimeline, obj, durationExpr, 'duration');
            // console.log(obj.id + 'durationExpr', durationExpr)
            // console.log(obj.id + 'lookedupDuration', lookedupDuration)
            if (_.isArray(lookedupDuration) && lookedupDuration.length === 1) {
                lookedupDuration = {
                    value: lookedupDuration[0].start,
                    references: lookedupDuration[0].references
                };
            }
            if (_.isArray(lookedupDuration) && !lookedupDuration.length)
                lookedupDuration = null;
            // console.log(obj.id + 'lookupDuration', lookedupDuration)
            if (_.isArray(lookedupDuration)) {
                throw new Error("lookupExpression should never return an array for .duration lookup"); // perhaps tmp? maybe revisit this at some point
            }
            else if (lookedupDuration !== null) {
                if (lookedupRepeating !== null &&
                    lookedupDuration.value > lookedupRepeating.value)
                    lookedupDuration.value = lookedupRepeating.value;
                var tmpLookedupDuration_1 = lookedupDuration; // cast type
                _.each(events_1, function (e) {
                    if (e.value) {
                        var time = e.time + tmpLookedupDuration_1.value;
                        var references = lib_1.joinReferences(e.references, tmpLookedupDuration_1.references);
                        events_1.push({
                            time: time,
                            value: false,
                            data: { id: e.data.id, instance: { id: e.data.instance.id, start: time, end: null, references: references } },
                            references: references
                        });
                    }
                });
                // console.log(obj.id + 'events', events)
            }
        }
        instances = lib_1.convertEventsToInstances(events_1, false);
        // console.log(obj.id + 'instances', instances)
    }
    if (hasParent) {
        // console.log(obj.id + 'hasParent, figure out what parent-instance the instances are tied to, and cap them')
        // figure out what parent-instance the instances are tied to, and cap them
        var cappedInstances_1 = [];
        _.each(instances, function (instance) {
            if (parentInstances) {
                var parentInstance = _.find(parentInstances, function (parentInstance) {
                    return instance.references.indexOf(parentInstance.id) !== -1;
                });
                // console.log(obj.id + 'parentinstance', parentInstance)
                if (parentInstance) {
                    // If the child refers to its parent, there should be one specific instance to cap into
                    var cappedInstance = lib_1.capInstances([instance], [parentInstance])[0];
                    if (cappedInstance) {
                        if (!cappedInstance.caps)
                            cappedInstance.caps = [];
                        cappedInstance.caps.push({
                            id: parentInstance.id,
                            start: parentInstance.start,
                            end: parentInstance.end
                        });
                        cappedInstances_1.push(cappedInstance);
                    }
                }
                else {
                    // If the child doesn't refer to its parent, it should be capped within all of its parent instances
                    // console.log(obj.id + 'If the child doesn\'t refer to its parent, it should be capped within all of its parent instances')
                    _.each(parentInstances, function (parentInstance) {
                        var cappedInstance = lib_1.capInstances([instance], [parentInstance])[0];
                        if (cappedInstance) {
                            if (parentInstance) {
                                if (!cappedInstance.caps)
                                    cappedInstance.caps = [];
                                cappedInstance.caps.push({
                                    id: parentInstance.id,
                                    start: parentInstance.start,
                                    end: parentInstance.end
                                });
                            }
                            cappedInstances_1.push(cappedInstance);
                        }
                    });
                }
            }
        });
        instances = cappedInstances_1;
        // console.log(obj.id + 'instances', instances)
    }
    instances = lib_1.applyRepeatingInstances(instances, lookedupRepeating, resolvedTimeline.options);
    // console.log(obj.id + 'applied repeating', instances)
    // filter out zero-length instances:
    instances = _.filter(instances, function (instance) {
        return ((instance.end || Infinity) > instance.start);
    });
    // console.log(obj.id + 'remove zero length', instances)
    obj.resolved.resolved = true;
    obj.resolved.resolving = false;
    obj.resolved.instances = instances;
    if (instances.length) {
        // console.log(obj.id + 'resolved')
        resolvedTimeline.statistics.resolvedInstanceCount += instances.length;
        resolvedTimeline.statistics.resolvedCount += 1;
        if (obj.isGroup) {
            resolvedTimeline.statistics.resolvedGroupCount += 1;
        }
        if (obj.resolved.isKeyframe) {
            resolvedTimeline.statistics.resolvedKeyframeCount += 1;
        }
        else {
            resolvedTimeline.statistics.resolvedObjectCount += 1;
        }
    }
    else {
        // console.log(obj.id + 'unresolved')
        resolvedTimeline.statistics.unresolvedCount += 1;
    }
}
exports.resolveTimelineObj = resolveTimelineObj;
/**
 * Look up a reference on the timeline
 * Return values:
 * Array<TimelineObjectInstance>: Instances on the timeline where the reference expression is true
 * ValueWithReference: A singular value which can be combined arithmetically with Instances
 * null: Means "something is invalid", an null-value will always return null when combined with other values
 *
 * @param resolvedTimeline
 * @param obj
 * @param expr
 * @param context
 */
function lookupExpression(resolvedTimeline, obj, expr, context) {
    if (expr === null)
        return null;
    if (_.isString(expr) &&
        lib_1.isNumeric(expr)) {
        return {
            value: parseFloat(expr),
            references: []
        };
    }
    else if (_.isNumber(expr)) {
        return {
            value: expr,
            references: []
        };
    }
    else if (_.isString(expr)) {
        expr = expr.trim();
        if (lib_1.isConstant(expr)) {
            if (expr.match(/^true$/i)) {
                return {
                    value: 0,
                    references: []
                };
            }
            else if (expr.match(/^false$/i)) {
                return [];
            }
        }
        // Look up string
        var invert = false;
        var ignoreFirstIfZero = false;
        var referencedObjs_1 = [];
        var ref = context;
        var rest = '';
        var objIdsToReference = [];
        var referenceIsOk = false;
        // Match id, example: "#objectId.start"
        var m = expr.match(/^\W*#([^.]+)(.*)/);
        if (m) {
            var id = m[1];
            rest = m[2];
            referenceIsOk = true;
            objIdsToReference = [id];
        }
        else {
            // Match class, example: ".className.start"
            var m_1 = expr.match(/^\W*\.([^.]+)(.*)/);
            if (m_1) {
                var className = m_1[1];
                rest = m_1[2];
                referenceIsOk = true;
                objIdsToReference = resolvedTimeline.classes[className] || [];
            }
            else {
                // Match layer, example: "$layer"
                var m_2 = expr.match(/^\W*\$([^.]+)(.*)/);
                if (m_2) {
                    var layer = m_2[1];
                    rest = m_2[2];
                    referenceIsOk = true;
                    objIdsToReference = resolvedTimeline.layers[layer] || [];
                }
            }
        }
        _.each(objIdsToReference, function (objId) {
            var obj = resolvedTimeline.objects[objId];
            if (obj) {
                referencedObjs_1.push(obj);
            }
        });
        if (!referenceIsOk)
            return null;
        if (referencedObjs_1.length) {
            if (rest.match(/start/))
                ref = 'start';
            if (rest.match(/end/))
                ref = 'end';
            if (rest.match(/duration/))
                ref = 'duration';
            if (ref === 'duration') {
                // Duration refers to the first object on the resolved timeline
                var instanceDurations_1 = [];
                _.each(referencedObjs_1, function (referencedObj) {
                    resolveTimelineObj(resolvedTimeline, referencedObj);
                    if (referencedObj.resolved.resolved) {
                        var firstInstance = _.first(referencedObj.resolved.instances);
                        if (firstInstance) {
                            var duration = (firstInstance.end !== null ?
                                firstInstance.end - firstInstance.start :
                                null);
                            if (duration !== null) {
                                instanceDurations_1.push({
                                    value: duration,
                                    references: lib_1.joinReferences(referencedObj.id, firstInstance.references)
                                });
                            }
                        }
                    }
                });
                var firstDuration_1 = null;
                _.each(instanceDurations_1, function (d) {
                    if (firstDuration_1 === null || d.value < firstDuration_1.value)
                        firstDuration_1 = d;
                });
                return firstDuration_1;
            }
            else {
                var returnInstances_1 = [];
                if (ref === 'start') {
                    // nothing
                }
                else if (ref === 'end') {
                    invert = !invert;
                    ignoreFirstIfZero = true;
                }
                else
                    throw Error("Unknown ref: \"" + ref + "\"");
                _.each(referencedObjs_1, function (referencedObj) {
                    resolveTimelineObj(resolvedTimeline, referencedObj);
                    if (referencedObj.resolved.resolved) {
                        returnInstances_1 = returnInstances_1.concat(referencedObj.resolved.instances);
                    }
                });
                if (returnInstances_1.length) {
                    if (invert) {
                        returnInstances_1 = lib_1.invertInstances(returnInstances_1);
                    }
                    else {
                        returnInstances_1 = lib_1.cleanInstances(returnInstances_1, true, true);
                    }
                    if (ignoreFirstIfZero) {
                        var first = _.first(returnInstances_1);
                        if (first && first.start === 0) {
                            returnInstances_1.splice(0, 1);
                        }
                    }
                    return returnInstances_1;
                }
                else {
                    return [];
                }
            }
        }
        else {
            return [];
        }
    }
    else {
        if (expr) {
            var lookupExpr = {
                l: lookupExpression(resolvedTimeline, obj, expr.l, context),
                o: expr.o,
                r: lookupExpression(resolvedTimeline, obj, expr.r, context)
            };
            if (lookupExpr.o === '!') {
                // Discard l, invert and return r:
                if (lookupExpr.r && _.isArray(lookupExpr.r)) {
                    return lib_1.invertInstances(lookupExpr.r);
                }
                else {
                    // We can't invert a value
                    return lookupExpr.r;
                }
            }
            else {
                if (_.isNull(lookupExpr.l) ||
                    _.isNull(lookupExpr.r)) {
                    return null;
                }
                if (lookupExpr.o === '&' ||
                    lookupExpr.o === '|') {
                    var events_2 = [];
                    var addEvents = function (instances, left) {
                        _.each(instances, function (instance) {
                            if (instance.start === instance.end)
                                return; // event doesn't actually exist...
                            events_2.push({
                                left: left,
                                time: instance.start,
                                value: true,
                                references: [],
                                data: true,
                                instance: instance
                            });
                            if (instance.end !== null) {
                                events_2.push({
                                    left: left,
                                    time: instance.end,
                                    value: false,
                                    references: [],
                                    data: false,
                                    instance: instance
                                });
                            }
                        });
                    };
                    if (_.isArray(lookupExpr.l))
                        addEvents(lookupExpr.l, true);
                    if (_.isArray(lookupExpr.r))
                        addEvents(lookupExpr.r, false);
                    events_2 = lib_1.sortEvents(events_2);
                    var calcResult = (lookupExpr.o === '&' ?
                        function (left, right) { return !!(left && right); } :
                        lookupExpr.o === '|' ?
                            function (left, right) { return !!(left || right); } :
                            function () { return false; });
                    var leftValue = (lib_1.isReference(lookupExpr.l) ? !!lookupExpr.l.value : false);
                    var rightValue = (lib_1.isReference(lookupExpr.r) ? !!lookupExpr.r.value : false);
                    var leftInstance = null;
                    var rightInstance = null;
                    var resultValue = calcResult(leftValue, rightValue);
                    var resultReferences = lib_1.joinReferences((lib_1.isReference(lookupExpr.l) ? lookupExpr.l.references : []), (lib_1.isReference(lookupExpr.r) ? lookupExpr.r.references : []));
                    var instances_1 = [];
                    var updateInstance = function (time, value, references, caps) {
                        if (value) {
                            instances_1.push({
                                id: lib_1.getId(),
                                start: time,
                                end: null,
                                references: references,
                                caps: caps
                            });
                        }
                        else {
                            var last = _.last(instances_1);
                            if (last) {
                                last.end = time;
                                // don't update reference on end
                            }
                        }
                    };
                    updateInstance(0, resultValue, resultReferences, []);
                    for (var i = 0; i < events_2.length; i++) {
                        var e = events_2[i];
                        var next = events_2[i + 1];
                        if (e.left) {
                            leftValue = e.value;
                            leftInstance = e.instance;
                        }
                        else {
                            rightValue = e.value;
                            rightInstance = e.instance;
                        }
                        if (!next || next.time !== e.time) {
                            var newResultValue = calcResult(leftValue, rightValue);
                            var resultReferences_1 = lib_1.joinReferences(leftInstance ? leftInstance.references : [], rightInstance ? rightInstance.references : []);
                            var resultCaps = ((leftInstance ? leftInstance.caps || [] : []).concat(rightInstance ? rightInstance.caps || [] : []));
                            if (newResultValue !== resultValue) {
                                updateInstance(e.time, newResultValue, resultReferences_1, resultCaps);
                                resultValue = newResultValue;
                            }
                        }
                    }
                    return instances_1;
                }
                else {
                    var operateInner_1 = (lookupExpr.o === '+' ?
                        function (a, b) { return { value: a.value + b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                        lookupExpr.o === '-' ?
                            function (a, b) { return { value: a.value - b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                            lookupExpr.o === '*' ?
                                function (a, b) { return { value: a.value * b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                                lookupExpr.o === '/' ?
                                    function (a, b) { return { value: a.value / b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                                    lookupExpr.o === '%' ?
                                        function (a, b) { return { value: a.value % b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                                        function () { return null; });
                    var operate = function (a, b) {
                        if (a === null || b === null)
                            return null;
                        return operateInner_1(a, b);
                    };
                    var result = lib_1.operateOnArrays(lookupExpr.l, lookupExpr.r, operate);
                    return result;
                }
            }
        }
    }
    return null;
}
exports.lookupExpression = lookupExpression;
//# sourceMappingURL=resolver.js.map