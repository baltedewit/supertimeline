import { InstanceEvent, TimelineObjectInstance, ResolveOptions, ValueWithReference, Cap } from './api/api';
/**
 * Thanks to https://github.com/Microsoft/TypeScript/issues/23126#issuecomment-395929162
 */
export declare type OptionalPropertyNames<T> = {
    [K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];
export declare type RequiredPropertyNames<T> = {
    [K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];
export declare type OptionalProperties<T> = Pick<T, OptionalPropertyNames<T>>;
export declare type RequiredProperties<T> = Pick<T, RequiredPropertyNames<T>>;
/**
 * Returns the difference between object A and B
 */
declare type Difference<A, B extends A> = Pick<B, Exclude<keyof B, keyof RequiredProperties<A>>>;
/**
 * Somewhat like _.extend, but with strong types & mandated additional properties
 * @param original Object to be extended
 * @param extendObj properties to add
 */
export declare function extendMandadory<A, B extends A>(original: A, extendObj: Difference<A, B> & Partial<A>): B;
export declare function isConstant(str: string | number | null | any): str is string | number;
export declare function isNumeric(str: string | number | null | any): str is string | number;
export declare function sortEvents<T extends InstanceEvent>(events: Array<T>): Array<T>;
/**
 * Clean up instances, join overlapping etc..
 * @param instances
 */
export declare function cleanInstances(instances: Array<TimelineObjectInstance>, allowMerge: boolean, allowZeroGaps?: boolean): Array<TimelineObjectInstance>;
export declare type EventForInstance = InstanceEvent<{
    id?: string;
    instance: TimelineObjectInstance;
}>;
export declare function convertEventsToInstances(events: Array<EventForInstance>, allowMerge: boolean, allowZeroGaps?: boolean): Array<TimelineObjectInstance>;
export declare function invertInstances(instances: Array<TimelineObjectInstance>): Array<TimelineObjectInstance>;
/**
 * Perform an action on 2 arrays. Behaves somewhat like the ".*"-operator in Matlab
 * @param array0
 * @param array1
 * @param operate
 */
export declare function operateOnArrays(array0: Array<TimelineObjectInstance> | ValueWithReference | null, array1: Array<TimelineObjectInstance> | ValueWithReference | null, operate: (a: ValueWithReference | null, b: ValueWithReference | null) => ValueWithReference | null): Array<TimelineObjectInstance> | ValueWithReference | null;
/**
 * Like operateOnArrays, but will multiply the number of elements in array0, with the number of elements in array1
 * @param array0
 * @param array1
 * @param operate
 */
export declare function applyRepeatingInstances(instances: TimelineObjectInstance[], repeatTime0: ValueWithReference | null, options: ResolveOptions): TimelineObjectInstance[];
/**
 * Cap instances so that they are within their parentInstances
 * @param instances
 * @param parentInstances
 */
export declare function capInstances(instances: TimelineObjectInstance[], parentInstances: ValueWithReference | TimelineObjectInstance[] | null): TimelineObjectInstance[];
export declare function isReference(ref: any): ref is ValueWithReference;
export declare function joinReferences(...references: Array<Array<string> | string>): Array<string>;
export declare function addCapsToResuming(instance: TimelineObjectInstance, ...caps: Array<Array<Cap> | undefined>): void;
export declare function joinCaps(...caps: Array<Array<Cap> | undefined>): Array<Cap>;
/**
 * Returns a unique id
 */
export declare function getId(): string;
export declare function resetId(): void;
export declare function setInstanceEndTime(instance: TimelineObjectInstance, endTime: number | null): void;
export declare function setInstanceStartTime(instance: TimelineObjectInstance, startTime: number): void;
export {};
