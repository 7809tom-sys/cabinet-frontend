/** Keeps the plan canvas visible even when mobile flex layout has not yet resolved its final height. */
export const DESIGNER_CANVAS_CONTAINER_CLASS = "relative flex flex-1 min-w-0 min-h-[300px] flex-col overflow-hidden lg:min-h-0 pb-16 lg:pb-0";

/** The consultant action belongs beside room and dimension controls, not over the canvas. */
export const DESIGNER_CONSULTANT_PLACEMENT = "room-controls" as const;
