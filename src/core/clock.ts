// "Transitions are driven by a clock the tests can fake" -- section 3.1.
// A function rather than a class: production code passes systemClock (or
// omits it, defaulting to systemClock), tests pass `() => new Date(...)`.
export type Clock = () => Date

export const systemClock: Clock = () => new Date()
