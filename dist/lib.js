"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
/**
 * Somewhat like _.extend, but with strong types & mandated additional properties
 * @param original Object to be extended
 * @param extendObj properties to add
 */
function extendMandadory(original, extendObj) {
    return _.extend(original, extendObj);
}
exports.extendMandadory = extendMandadory;
function isConstant(str) {
    return !!(isNumeric(str) ||
        (_.isString(str) &&
            (str.match(/^true$/) ||
                str.match(/^false$/))));
}
exports.isConstant = isConstant;
function isNumeric(str) {
    if (str === null)
        return false;
    if (_.isNumber(str))
        return true;
    if (_.isString(str))
        return !!(str.match(/^[\-\+]?[0-9\.]+$/) && !_.isNaN(parseFloat(str)));
    return false;
}
exports.isNumeric = isNumeric;
function sortEvents(events) {
    return events.sort(function (a, b) {
        if (a.time > b.time)
            return 1;
        if (a.time < b.time)
            return -1;
        var aId = a.data && (a.data.id || (a.data.instance && a.data.instance.id));
        var bId = b.data && (b.data.id || (b.data.instance && b.data.instance.id));
        if (aId && bId && aId === bId) {
            // If the event refer to the same ID, let the ending event be first:
            if (a.value && !b.value)
                return -1;
            if (!a.value && b.value)
                return 1;
        }
        if (a.value && !b.value)
            return 1;
        if (!a.value && b.value)
            return -1;
        return 0;
    });
}
exports.sortEvents = sortEvents;
/**
 * Clean up instances, join overlapping etc..
 * @param instances
 */
function cleanInstances(instances, allowMerge, allowZeroGaps) {
    // if (!allowMerge) throw new Error(`TODO: cleanInstances: allowMerge is temorarily removed`)
    if (allowZeroGaps === void 0) { allowZeroGaps = false; }
    var events = [];
    // let i: number = 1
    _.each(instances, function (instance) {
        // const id = 'i' + (i++)
        events.push({
            time: instance.start,
            value: true,
            data: { instance: instance },
            references: instance.references
        });
        if (instance.end !== null) {
            events.push({
                time: instance.end,
                value: false,
                data: { instance: instance },
                references: instance.references
            });
        }
    });
    return convertEventsToInstances(events, allowMerge, allowZeroGaps);
}
exports.cleanInstances = cleanInstances;
function convertEventsToInstances(events, allowMerge, allowZeroGaps) {
    if (allowZeroGaps === void 0) { allowZeroGaps = false; }
    sortEvents(events);
    var activeInstances = {};
    var activeInstanceId = null;
    var previousActive = false;
    var returnInstances = [];
    _.each(events, function (event) {
        var eventId = event.data.id || event.data.instance.id;
        var lastInstance = _.last(returnInstances);
        if (event.value) {
            activeInstances[eventId] = event;
        }
        else {
            delete activeInstances[eventId];
        }
        if (_.keys(activeInstances).length) {
            // There is an active instance
            previousActive = true;
            if (!allowMerge &&
                event.value &&
                lastInstance &&
                lastInstance.end === null &&
                activeInstanceId !== null &&
                activeInstanceId !== eventId) {
                // Start a new instance:
                lastInstance.end = event.time;
                returnInstances.push({
                    id: getId(),
                    start: event.time,
                    end: null,
                    references: event.references
                });
                activeInstanceId = eventId;
            }
            else if (!allowMerge &&
                !event.value &&
                lastInstance &&
                activeInstanceId === eventId) {
                // The active instance stopped playing, but another is still playing
                var latestInstance = _.reduce(activeInstances, function (memo, event, id) {
                    if (memo === null ||
                        memo.event.time < event.time) {
                        return {
                            event: event,
                            id: id
                        };
                    }
                    return memo;
                }, null);
                if (latestInstance) {
                    // Restart that instance now:
                    lastInstance.end = event.time;
                    returnInstances.push({
                        id: eventId + '_' + getId(),
                        start: event.time,
                        end: null,
                        references: latestInstance.event.references
                    });
                    activeInstanceId = latestInstance.id;
                }
            }
            else if (allowMerge &&
                !allowZeroGaps &&
                lastInstance &&
                lastInstance.end === event.time) {
                // The previously running ended just now
                // resume previous instance:
                lastInstance.end = null;
                lastInstance.references = joinReferences(lastInstance.references, event.references);
                addCapsToResuming(lastInstance, event.data.instance.caps);
            }
            else if (!lastInstance ||
                lastInstance.end !== null) {
                // There is no previously running instance
                // Start a new instance:
                returnInstances.push({
                    id: eventId,
                    start: event.time,
                    end: null,
                    references: event.references,
                    caps: event.data.instance.caps
                });
                activeInstanceId = eventId;
            }
            else {
                // There is already a running instance
                lastInstance.references = joinReferences(lastInstance.references, event.references);
                addCapsToResuming(lastInstance, event.data.instance.caps);
            }
            if (lastInstance && lastInstance.caps && !lastInstance.caps.length)
                delete lastInstance.caps;
        }
        else {
            // No instances are active
            if (lastInstance &&
                previousActive) {
                lastInstance.end = event.time;
            }
            previousActive = false;
        }
    });
    return returnInstances;
}
exports.convertEventsToInstances = convertEventsToInstances;
function invertInstances(instances) {
    if (instances.length) {
        instances = cleanInstances(instances, true, true);
        var invertedInstances_1 = [];
        if (instances[0].start !== 0) {
            invertedInstances_1.push({
                id: getId(),
                isFirst: true,
                start: 0,
                end: null,
                references: joinReferences(instances[0].references, instances[0].id)
            });
        }
        _.each(instances, function (instance) {
            var last = _.last(invertedInstances_1);
            if (last) {
                last.end = instance.start;
            }
            if (instance.end !== null) {
                invertedInstances_1.push({
                    id: getId(),
                    start: instance.end,
                    end: null,
                    references: joinReferences(instance.references, instance.id),
                    caps: instance.caps
                });
            }
        });
        return invertedInstances_1;
    }
    else {
        return [{
                id: getId(),
                isFirst: true,
                start: 0,
                end: null,
                references: []
            }];
    }
}
exports.invertInstances = invertInstances;
/**
 * Perform an action on 2 arrays. Behaves somewhat like the ".*"-operator in Matlab
 * @param array0
 * @param array1
 * @param operate
 */
function operateOnArrays(array0, array1, operate) {
    if (array0 === null ||
        array1 === null)
        return null;
    if (isReference(array0) &&
        isReference(array1)) {
        return operate(array0, array1);
    }
    var result = [];
    var minLength = Math.min(_.isArray(array0) ? array0.length : Infinity, _.isArray(array1) ? array1.length : Infinity);
    for (var i_1 = 0; i_1 < minLength; i_1++) {
        var a = (_.isArray(array0) ?
            array0[i_1] :
            { id: '', start: array0.value, end: array0.value, references: array0.references });
        var b = (_.isArray(array1) ?
            array1[i_1] :
            { id: '', start: array1.value, end: array1.value, references: array1.references });
        var start = (a.isFirst ?
            { value: a.start, references: a.references } :
            b.isFirst ?
                { value: b.start, references: b.references } :
                operate({ value: a.start, references: joinReferences(a.id, a.references) }, { value: b.start, references: joinReferences(b.id, b.references) }));
        var end = (a.isFirst ?
            (a.end !== null ? { value: a.end, references: a.references } : null) :
            b.isFirst ?
                (b.end !== null ? { value: b.end, references: b.references } : null) :
                operate(a.end !== null ? { value: a.end, references: joinReferences(a.id, a.references) } : null, b.end !== null ? { value: b.end, references: joinReferences(b.id, b.references) } : null));
        if (start !== null) {
            result.push({
                id: getId(),
                start: start.value,
                end: end === null ? null : end.value,
                references: joinReferences(start.references, end !== null ? end.references : []),
                caps: joinCaps(a.caps, b.caps)
            });
        }
    }
    return cleanInstances(result, false);
}
exports.operateOnArrays = operateOnArrays;
/**
 * Like operateOnArrays, but will multiply the number of elements in array0, with the number of elements in array1
 * @param array0
 * @param array1
 * @param operate
 */
/*export function operateOnArraysMulti (
    array0: Array<TimelineObjectInstance> | Reference | null,
    array1: Array<TimelineObjectInstance> | Reference | null,
    operate: (a: Reference | null, b: Reference | null) => Reference | null
) {
    if (array0 === null) return null

    if (_.isArray(array1)) {
        let resultArray: Array<TimelineObjectInstance> = []
        _.each(array1, (array1Val) => {
            const result = operateOnArrays(array0, { value: array1Val.start, references: array1Val.references } , operate)
            if (_.isArray(result)) {
                resultArray = resultArray.concat(result)
            } else if (result !== null) {
                resultArray.push({
                    id: getId(),
                    start: result.value,
                    end: (
                        array1Val.end !== null ?
                        result.value + (array1Val.end - array1Val.start) :
                        null
                    ),
                    references: result.references
                })
            }
        })
        return resultArray
    } else {
        return operateOnArrays(array0, array1, operate)
    }
}
*/
function applyRepeatingInstances(instances, repeatTime0, options) {
    if (repeatTime0 === null ||
        !repeatTime0.value)
        return instances;
    var repeatTime = repeatTime0.value;
    if (isReference(instances)) {
        instances = [{
                id: '',
                start: instances.value,
                end: null,
                references: instances.references
            }];
    }
    var repeatedInstances = [];
    _.each(instances, function (instance) {
        var startTime = Math.max(options.time - (options.time - instance.start) % repeatTime, instance.start);
        var endTime = (instance.end === null ?
            null :
            instance.end + (startTime - instance.start));
        var cap = (instance.caps ?
            _.find(instance.caps, function (cap) { return instance.references.indexOf(cap.id) !== -1; })
            : null) || null;
        var limit = options.limitCount || 2;
        for (var i_2 = 0; i_2 < limit; i_2++) {
            if (options.limitTime &&
                startTime >= options.limitTime)
                break;
            var cappedStartTime = (cap ?
                Math.max(cap.start, startTime) :
                startTime);
            var cappedEndTime = (cap && cap.end !== null && endTime !== null ?
                Math.min(cap.end, endTime) :
                endTime);
            if ((cappedEndTime || Infinity) > cappedStartTime) {
                repeatedInstances.push({
                    id: getId(),
                    start: cappedStartTime,
                    end: cappedEndTime,
                    references: joinReferences(instance.id, instance.references, repeatTime0.references)
                });
            }
            startTime += repeatTime;
            if (endTime !== null)
                endTime += repeatTime;
        }
    });
    return cleanInstances(repeatedInstances, false);
}
exports.applyRepeatingInstances = applyRepeatingInstances;
/**
 * Cap instances so that they are within their parentInstances
 * @param instances
 * @param parentInstances
 */
function capInstances(instances, parentInstances) {
    if (isReference(parentInstances) ||
        parentInstances === null)
        return instances;
    var returnInstances = [];
    _.each(instances, function (instance) {
        var parent = null;
        _.each(parentInstances, function (p) {
            if ((instance.start >= p.start &&
                instance.start < (p.end || Infinity)) || (instance.start < p.start &&
                (instance.end || Infinity) > (p.end || Infinity))) {
                if (parent === null ||
                    (p.end || Infinity) > (parent.end || Infinity)) {
                    parent = p;
                }
            }
        });
        if (!parent) {
            _.each(parentInstances, function (p) {
                if ((instance.end || Infinity) > p.start &&
                    (instance.end || Infinity) <= (p.end || Infinity)) {
                    if (parent === null ||
                        (p.end || Infinity) < (parent.end || Infinity)) {
                        parent = p;
                    }
                }
            });
        }
        if (parent) {
            var parent2 = parent; // cast type
            var i2 = _.clone(instance);
            if (parent2.end !== null &&
                (i2.end || Infinity) > parent2.end) {
                setInstanceEndTime(i2, parent2.end);
            }
            if ((i2.start || Infinity) < parent2.start) {
                setInstanceStartTime(i2, parent2.start);
            }
            returnInstances.push(i2);
        }
    });
    return returnInstances;
}
exports.capInstances = capInstances;
function isReference(ref) {
    return (_.isObject(ref) &&
        !_.isArray(ref) &&
        ref.value !== undefined &&
        _.isArray(ref.references) &&
        ref !== null);
}
exports.isReference = isReference;
function joinReferences() {
    var references = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        references[_i] = arguments[_i];
    }
    return _.compact(_.uniq(_.reduce(references, function (memo, ref) {
        if (_.isString(ref))
            return memo.concat([ref]);
        else
            return memo.concat(ref);
    }, []))).sort(function (a, b) {
        if (a > b)
            return 1;
        if (a < b)
            return -1;
        return 0;
    });
}
exports.joinReferences = joinReferences;
function addCapsToResuming(instance) {
    var caps = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        caps[_i - 1] = arguments[_i];
    }
    var capsToAdd = [];
    _.each(joinCaps.apply(void 0, caps), function (cap) {
        if (cap.end &&
            instance.end &&
            cap.end > instance.end) {
            capsToAdd.push({
                id: cap.id,
                start: 0,
                end: cap.end
            });
        }
    });
    instance.caps = joinCaps(instance.caps, capsToAdd);
}
exports.addCapsToResuming = addCapsToResuming;
function joinCaps() {
    var caps = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        caps[_i] = arguments[_i];
    }
    return (_.uniq(_.compact(_.reduce(caps, function (memo, cap) {
        if (cap !== undefined) {
            return (memo || []).concat(cap);
        }
        else
            return memo;
    }, [])), false, function (cap) {
        return cap.id;
    }));
}
exports.joinCaps = joinCaps;
var i = 0;
/**
 * Returns a unique id
 */
function getId() {
    return '@' + (i++).toString(36);
}
exports.getId = getId;
function resetId() {
    i = 0;
}
exports.resetId = resetId;
function setInstanceEndTime(instance, endTime) {
    instance.originalEnd = (instance.originalEnd !== undefined ?
        instance.originalEnd :
        instance.end);
    instance.end = endTime;
}
exports.setInstanceEndTime = setInstanceEndTime;
function setInstanceStartTime(instance, startTime) {
    instance.originalStart = (instance.originalStart !== undefined ?
        instance.originalStart :
        instance.start);
    instance.start = startTime;
}
exports.setInstanceStartTime = setInstanceStartTime;
//# sourceMappingURL=lib.js.map