"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var _ = require("underscore");
var common_1 = require("./common");
var enums_1 = require("../api/enums");
var lib_1 = require("../lib");
function getState(resolved, time, eventLimit) {
    if (eventLimit === void 0) { eventLimit = 0; }
    var resolvedStates = (isResolvedStates(resolved) ?
        resolved :
        resolveStates(resolved, time));
    var state = {
        time: time,
        layers: {},
        nextEvents: _.filter(resolvedStates.nextEvents, function (e) { return e.time > time; })
    };
    if (eventLimit)
        state.nextEvents = state.nextEvents.slice(0, eventLimit);
    _.each(_.keys(resolvedStates.layers), function (layer) {
        var o = getStateAtTime(resolvedStates.state, layer, time);
        if (o)
            state.layers[layer] = o;
    });
    return state;
}
exports.getState = getState;
function resolveStates(resolved, onlyForTime) {
    var resolvedStates = {
        options: resolved.options,
        statistics: resolved.statistics,
        // These will be re-created during the state-resolving:
        objects: {},
        classes: {},
        layers: {},
        state: {},
        nextEvents: []
    };
    var resolvedObjects = _.values(resolved.objects);
    // Sort to make sure parent groups are evaluated before their children:
    resolvedObjects.sort(function (a, b) {
        if ((a.resolved.levelDeep || 0) > (b.resolved.levelDeep || 0))
            return 1;
        if ((a.resolved.levelDeep || 0) < (b.resolved.levelDeep || 0))
            return -1;
        if (a.id > b.id)
            return 1;
        if (a.id < b.id)
            return -1;
        return 0;
    });
    // Step 1: Collect all points-of-interest (which points in time we want to evaluate)
    // and which instances that are interesting
    var pointsInTime = {};
    var addPointInTime = function (time, enable, obj, instance) {
        if (!pointsInTime[time + ''])
            pointsInTime[time + ''] = [];
        pointsInTime[time + ''].push({ obj: obj, instance: instance, enable: enable });
    };
    var eventObjectTimes = {};
    _.each(resolvedObjects, function (obj) {
        if (!obj.disabled &&
            obj.resolved.resolved &&
            !obj.resolved.isKeyframe) {
            var parentTimes_1 = getTimesFromParents(resolved, obj);
            if (obj.layer) { // if layer is empty, don't put in state
                _.each(obj.resolved.instances, function (instance) {
                    var useInstance = true;
                    if (onlyForTime) {
                        useInstance = ((instance.start || 0) <= onlyForTime &&
                            (instance.end || Infinity) > onlyForTime);
                    }
                    if (useInstance) {
                        var timeEvents_1 = [];
                        timeEvents_1.push({ time: instance.start, enable: true });
                        if (instance.end)
                            timeEvents_1.push({ time: instance.end, enable: false });
                        // Also include times from parents, as they could affect the state of this instance:
                        _.each(parentTimes_1, function (parentTime) {
                            if (parentTime && (parentTime.time > (instance.start || 0) &&
                                parentTime.time < (instance.end || Infinity))) {
                                timeEvents_1.push(parentTime);
                            }
                        });
                        // Save a reference to this instance on all points in time that could affect it:
                        _.each(timeEvents_1, function (timeEvent) {
                            addPointInTime(timeEvent.time, timeEvent.enable, obj, instance);
                        });
                    }
                });
            }
        }
    });
    // Also add keyframes to pointsInTime:
    _.each(resolvedObjects, function (obj) {
        if (!obj.disabled &&
            obj.resolved.resolved &&
            obj.resolved.isKeyframe &&
            obj.resolved.parentId) {
            // console.log('kf', obj)
            _.each(obj.resolved.instances, function (instance) {
                // console.log('kf instance', instance)
                // console.log('add ', instance.start)
                // Keyframe start time
                addPointInTime(instance.start, true, obj, instance);
                // Keyframe end time
                if (instance.end !== null) {
                    addPointInTime(instance.end, false, obj, instance);
                    // console.log('add ', instance.end)
                }
            });
        }
    });
    // Step 2: Resolve the state for the points-of-interest
    // This is done by sweeping the points-of-interest chronologically,
    // determining the state for every point in time by adding & removing objects from aspiringInstances
    // Then sorting it to determine who takes precedence
    var currentState = {};
    var activeObjIds = {};
    var activeKeyframes = {};
    var activeKeyframesChecked = {};
    /** The objects in aspiringInstances  */
    var aspiringInstances = {};
    var keyframeEvents = [];
    var times = _.map(_.keys(pointsInTime), function (time) { return parseFloat(time); });
    // Sort chronologically:
    times.sort(function (a, b) {
        return a - b;
    });
    // console.log('times', times)
    _.each(times, function (time) {
        var instancesToCheck = pointsInTime[time];
        var checkedObjectsThisTime = {};
        instancesToCheck.sort(function (a, b) {
            if (a.obj.resolved && b.obj.resolved) {
                // Keyframes comes first:
                if (a.obj.resolved.isKeyframe && !b.obj.resolved.isKeyframe)
                    return -1;
                if (!a.obj.resolved.isKeyframe && b.obj.resolved.isKeyframe)
                    return 1;
                // Ending events come before starting events:
                if (a.enable && !b.enable)
                    return 1;
                if (!a.enable && b.enable)
                    return -1;
                // Deeper objects (children in groups) comes later, we want to check the parent groups first:
                if ((a.obj.resolved.levelDeep || 0) > (b.obj.resolved.levelDeep || 0))
                    return 1;
                if ((a.obj.resolved.levelDeep || 0) < (b.obj.resolved.levelDeep || 0))
                    return -1;
            }
            return 0;
        });
        _.each(instancesToCheck, function (o) {
            var obj = o.obj;
            var instance = o.instance;
            // console.log(`check ${obj.id} at ${time}`)
            var toBeEnabled = ((instance.start || 0) <= time &&
                (instance.end || Infinity) > time);
            var layer = obj.layer + '';
            if (!checkedObjectsThisTime[obj.id + '_' + instance.id + '_' + o.enable]) { // Only check each object and event-type once for every point in time
                checkedObjectsThisTime[obj.id + '_' + instance.id + '_' + o.enable] = true;
                if (!obj.resolved.isKeyframe) {
                    // If object has a parent, only set if parent is on a layer (if layer is set for parent)
                    if (toBeEnabled && obj.resolved.parentId) {
                        var parentObj = (obj.resolved.parentId ?
                            resolved.objects[obj.resolved.parentId] :
                            null);
                        toBeEnabled = !!(parentObj &&
                            (!parentObj.layer ||
                                activeObjIds[parentObj.id]));
                    }
                    if (!aspiringInstances[obj.layer])
                        aspiringInstances[obj.layer] = [];
                    if (toBeEnabled) {
                        // The instance wants to be enabled (is starting)
                        // Add to aspiringInstances:
                        aspiringInstances[obj.layer].push({ obj: obj, instance: instance });
                    }
                    else {
                        // The instance doesn't want to be enabled (is ending)
                        // Remove from aspiringInstances:
                        aspiringInstances[layer] = _.reject(aspiringInstances[layer] || [], function (o) { return o.obj.id === obj.id; });
                    }
                    // Evaluate the layer to determine who has the throne:
                    aspiringInstances[layer].sort(function (a, b) {
                        // Determine who takes precedence:
                        // First, sort using priority
                        if ((a.obj.priority || 0) < (b.obj.priority || 0))
                            return 1;
                        if ((a.obj.priority || 0) > (b.obj.priority || 0))
                            return -1;
                        // Then, sort using the start time
                        if ((a.instance.start || 0) < (b.instance.start || 0))
                            return 1;
                        if ((a.instance.start || 0) > (b.instance.start || 0))
                            return -1;
                        // Last resort: sort using id:
                        if (a.obj.id > b.obj.id)
                            return 1;
                        if (a.obj.id < b.obj.id)
                            return -1;
                        return 0;
                    });
                    // Now, the one on top has the throne
                    // Update current state:
                    var currentOnTopOfLayer = aspiringInstances[layer][0];
                    var prevObj = currentState[layer];
                    var replaceOldObj = (currentOnTopOfLayer &&
                        (!prevObj ||
                            prevObj.id !== currentOnTopOfLayer.obj.id ||
                            prevObj.instance.id !== currentOnTopOfLayer.instance.id));
                    var removeOldObj = (!currentOnTopOfLayer &&
                        prevObj);
                    if (replaceOldObj || removeOldObj) {
                        if (prevObj) {
                            // Cap the old instance, so it'll end at this point in time:
                            lib_1.setInstanceEndTime(prevObj.instance, time);
                            // Update activeObjIds:
                            delete activeObjIds[prevObj.id];
                            // Add to nextEvents:
                            if (!onlyForTime ||
                                time > onlyForTime) {
                                resolvedStates.nextEvents.push({
                                    type: enums_1.EventType.END,
                                    time: time,
                                    objId: prevObj.id
                                });
                                eventObjectTimes[instance.end + ''] = enums_1.EventType.END;
                            }
                        }
                    }
                    if (replaceOldObj) {
                        // Set the new object to State
                        // Construct a new object clone:
                        var newObj_1;
                        if (resolvedStates.objects[currentOnTopOfLayer.obj.id]) {
                            // Use the already existing one
                            newObj_1 = resolvedStates.objects[currentOnTopOfLayer.obj.id];
                        }
                        else {
                            newObj_1 = _.clone(currentOnTopOfLayer.obj);
                            newObj_1.content = JSON.parse(JSON.stringify(newObj_1.content));
                            newObj_1.resolved = tslib_1.__assign({}, newObj_1.resolved || {}, { instances: [] });
                            common_1.addObjectToResolvedTimeline(resolvedStates, newObj_1);
                        }
                        var newInstance_1 = tslib_1.__assign({}, currentOnTopOfLayer.instance, { 
                            // We're setting new start & end times so they match up with the state:
                            start: time, end: null, fromInstanceId: currentOnTopOfLayer.instance.id, originalEnd: (currentOnTopOfLayer.instance.originalEnd !== undefined ?
                                currentOnTopOfLayer.instance.originalEnd :
                                currentOnTopOfLayer.instance.end), originalStart: (currentOnTopOfLayer.instance.originalStart !== undefined ?
                                currentOnTopOfLayer.instance.originalStart :
                                currentOnTopOfLayer.instance.start) });
                        // Make the instance id unique:
                        _.each(newObj_1.resolved.instances, function (instance) {
                            if (instance.id === newInstance_1.id) {
                                newInstance_1.id = newInstance_1.id + '_$' + newObj_1.resolved.instances.length;
                            }
                        });
                        newObj_1.resolved.instances.push(newInstance_1);
                        var newObjInstance = tslib_1.__assign({}, newObj_1, { instance: newInstance_1 });
                        // Save to current state:
                        currentState[layer] = newObjInstance;
                        // Update activeObjIds:
                        activeObjIds[newObjInstance.id] = newObjInstance;
                        // Update the tracking state as well:
                        setStateAtTime(resolvedStates.state, layer, time, newObjInstance);
                        // Add to nextEvents:
                        if (newInstance_1.start > (onlyForTime || 0)) {
                            resolvedStates.nextEvents.push({
                                type: enums_1.EventType.START,
                                time: newInstance_1.start,
                                objId: obj.id
                            });
                            eventObjectTimes[newInstance_1.start + ''] = enums_1.EventType.START;
                        }
                    }
                    else if (removeOldObj) {
                        // Remove from current state:
                        delete currentState[layer];
                        // Update the tracking state as well:
                        setStateAtTime(resolvedStates.state, layer, time, null);
                    }
                }
                else {
                    // console.log('is kf')
                    // Is a keyframe
                    var keyframe = obj;
                    // Add keyframe to resolvedStates.objects:
                    resolvedStates.objects[keyframe.id] = keyframe;
                    var toBeEnabled_1 = ((instance.start || 0) <= time &&
                        (instance.end || Infinity) > time);
                    if (toBeEnabled_1) {
                        // console.log('enable')
                        var newObjInstance = tslib_1.__assign({}, obj, { instance: instance });
                        activeKeyframes[obj.id] = newObjInstance;
                    }
                    else {
                        // console.log('disable')
                        delete activeKeyframes[obj.id];
                        delete activeKeyframesChecked[obj.id];
                    }
                }
            }
        });
        // Go through keyframes:
        _.each(activeKeyframes, function (objInstance, objId) {
            // console.log('check kf', objId)
            var keyframe = objInstance;
            var instance = objInstance.instance;
            // Check if the keyframe's parent is currently active?
            if (keyframe.resolved.parentId) {
                var parentObj = activeObjIds[keyframe.resolved.parentId];
                if (parentObj && parentObj.layer) { // keyframe is on an active object
                    // console.log('parent active')
                    var parentObjInstance = currentState[parentObj.layer];
                    if (parentObjInstance) {
                        // console.log('got parent obj instance')
                        if (!activeKeyframesChecked[objId]) { // hasn't started before
                            // console.log('hasn\'t started before')
                            activeKeyframesChecked[objId] = true;
                            var keyframeInstance = tslib_1.__assign({}, keyframe, { instance: instance, isKeyframe: true, keyframeEndTime: instance.end });
                            // Note: The keyframes are a little bit special, since their contents are applied to their parents.
                            // That application is done in the getStateAtTime function.
                            // Add keyframe to the tracking state:
                            addKeyframeAtTime(resolvedStates.state, parentObj.layer + '', time, keyframeInstance);
                            // Add keyframe to nextEvents:
                            keyframeEvents.push({
                                type: enums_1.EventType.KEYFRAME,
                                time: instance.start,
                                objId: keyframe.id
                            });
                            if (instance.end !== null && (parentObjInstance.instance.end === null ||
                                instance.end < parentObjInstance.instance.end // Only add the keyframe if it ends before its parent
                            )) {
                                keyframeEvents.push({
                                    type: enums_1.EventType.KEYFRAME,
                                    time: instance.end,
                                    objId: keyframe.id
                                });
                            }
                        }
                        return;
                    }
                }
            }
            // else: the keyframe:s parent isn't active, remove/stop the keyframe then:
            delete activeKeyframesChecked[objId];
        });
    });
    // Go through the keyframe events and add them to nextEvents:
    _.each(keyframeEvents, function (keyframeEvent) {
        // tslint:disable-next-line
        if (eventObjectTimes[keyframeEvent.time + ''] === undefined) { // no need to put a keyframe event if there's already another event there
            resolvedStates.nextEvents.push(keyframeEvent);
            eventObjectTimes[keyframeEvent.time + ''] = enums_1.EventType.KEYFRAME;
        }
    });
    if (onlyForTime) {
        resolvedStates.nextEvents = _.filter(resolvedStates.nextEvents, function (e) { return e.time > onlyForTime; });
    }
    resolvedStates.nextEvents.sort(function (a, b) {
        if (a.time > b.time)
            return 1;
        if (a.time < b.time)
            return -1;
        if (a.type > b.type)
            return -1;
        if (a.type < b.type)
            return 1;
        if (a.objId < b.objId)
            return -1;
        if (a.objId > b.objId)
            return 1;
        return 0;
    });
    return resolvedStates;
}
exports.resolveStates = resolveStates;
function applyKeyframeContent(parentContent, keyframeContent) {
    _.each(keyframeContent, function (value, attr) {
        if (_.isArray(value)) {
            if (!_.isArray(parentContent[attr]))
                parentContent[attr] = [];
            applyKeyframeContent(parentContent[attr], value);
            parentContent[attr].splice(value.length, 99999);
        }
        else if (_.isObject(value)) {
            if (!_.isObject(parentContent[attr]) ||
                _.isArray(parentContent[attr]))
                parentContent[attr] = {};
            applyKeyframeContent(parentContent[attr], value);
        }
        else {
            parentContent[attr] = value;
        }
    });
}
exports.applyKeyframeContent = applyKeyframeContent;
function getTimesFromParents(resolved, obj) {
    var times = [];
    var parentObj = (obj.resolved.parentId ?
        resolved.objects[obj.resolved.parentId] :
        null);
    if (parentObj && parentObj.resolved.resolved) {
        _.each(parentObj.resolved.instances, function (instance) {
            times.push({ time: instance.start, enable: true });
            if (instance.end)
                times.push({ time: instance.end, enable: false });
        });
        times = times.concat(getTimesFromParents(resolved, parentObj));
    }
    return times;
}
function setStateAtTime(states, layer, time, objInstance) {
    if (!states[layer])
        states[layer] = {};
    states[layer][time + ''] = objInstance ? [objInstance] : objInstance;
}
function addKeyframeAtTime(states, layer, time, objInstanceKf) {
    if (!states[layer])
        states[layer] = {};
    if (!states[layer][time + ''])
        states[layer][time + ''] = [];
    // @ts-ignore object is possibly null
    states[layer][time + ''].push(objInstanceKf);
}
function getStateAtTime(states, layer, requestTime) {
    var layerStates = states[layer] || {};
    var times = _.map(_.keys(layerStates), function (time) { return parseFloat(time); });
    times.sort(function (a, b) {
        return a - b;
    });
    var state = null;
    var isCloned = false;
    _.find(times, function (time) {
        if (time <= requestTime) {
            // console.log(`${layer}: ${time}:`)
            var currentStateInstances = layerStates[time + ''];
            if (currentStateInstances && currentStateInstances.length) {
                // console.log('currentStateInstances', currentStateInstances)
                _.each(currentStateInstances, function (currentState, i) {
                    if (currentState &&
                        currentState.isKeyframe) {
                        // console.log(`instance ${i} isKeyframe`)
                        var keyframe = currentState;
                        if (state && keyframe.resolved.parentId === state.id) {
                            if ((keyframe.keyframeEndTime || Infinity) > requestTime) {
                                if (!isCloned) {
                                    isCloned = true;
                                    state = tslib_1.__assign({}, state, { content: JSON.parse(JSON.stringify(state.content)) });
                                }
                                // Apply the keyframe on the state:
                                applyKeyframeContent(state.content, keyframe.content);
                            }
                        }
                    }
                    else {
                        state = currentState;
                        isCloned = false;
                    }
                });
            }
            else {
                state = null;
                isCloned = false;
            }
            // console.log('continue')
            return false;
        }
        else {
            return true;
        }
    });
    return state;
}
function isResolvedStates(resolved) {
    return !!(resolved &&
        typeof resolved === 'object' &&
        resolved.objects &&
        resolved.state &&
        resolved.nextEvents);
}
//# sourceMappingURL=state.js.map