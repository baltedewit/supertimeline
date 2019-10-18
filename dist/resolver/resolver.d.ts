import { TimelineObject, ResolvedTimeline, ResolveOptions, Expression, ResolvedTimelineObject, TimelineObjectInstance, Time, TimelineState, ValueWithReference, ResolvedStates } from '../api/api';
export declare class Resolver {
    /**
     * Go through all objects on the timeline and calculate all the timings.
     * Returns a ResolvedTimeline which can be piped into Resolver.getState()
     * @param timeline Array of timeline objects
     * @param options Resolve options
     */
    static resolveTimeline(timeline: Array<TimelineObject>, options: ResolveOptions): ResolvedTimeline;
    /** Calculate the state for all points in time.  */
    static resolveAllStates(resolvedTimeline: ResolvedTimeline): ResolvedStates;
    /**
     * Calculate the state at a given point in time.
     * Using a ResolvedTimeline calculated by Resolver.resolveTimeline() or
     * a ResolvedStates calculated by Resolver.resolveAllStates()
     * @param resolved ResolvedTimeline calculated by Resolver.resolveTimeline.
     * @param time The point in time where to calculate the state
     * @param eventLimit (Optional) Limits the number of returned upcoming events.
     */
    static getState(resolved: ResolvedTimeline | ResolvedStates, time: Time, eventLimit?: number): TimelineState;
}
export declare function resolveTimelineObj(resolvedTimeline: ResolvedTimeline, obj: ResolvedTimelineObject): void;
declare type ObjectRefType = 'start' | 'end' | 'duration';
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
export declare function lookupExpression(resolvedTimeline: ResolvedTimeline, obj: TimelineObject, expr: Expression | null, context: ObjectRefType): Array<TimelineObjectInstance> | ValueWithReference | null;
export {};
