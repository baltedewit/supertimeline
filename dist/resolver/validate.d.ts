import { TimelineObject, TimelineKeyframe } from '../api/api';
/**
 * Validates all objects in the timeline. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some strict rules (rules that can possibly be ignored)
 */
export declare function validateTimeline(timeline: Array<TimelineObject>, strict?: boolean): void;
/**
 * Validates a Timeline-object. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some strict rules (rules that can possibly be ignored)
 */
export declare function validateObject(obj: TimelineObject, strict?: boolean): void;
/**
 * Validates a Timeline-keyframe. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some strict rules (rules that can possibly be ignored)
 */
export declare function validateKeyframe(keyframe: TimelineKeyframe, strict?: boolean): void;
