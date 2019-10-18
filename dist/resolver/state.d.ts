import { TimelineState, ResolvedTimeline, Time, Content, ResolvedStates } from '../api/api';
export declare function getState(resolved: ResolvedTimeline | ResolvedStates, time: Time, eventLimit?: number): TimelineState;
export declare function resolveStates(resolved: ResolvedTimeline, onlyForTime?: Time): ResolvedStates;
export declare function applyKeyframeContent(parentContent: Content, keyframeContent: Content): void;
