/**
 * Check if the user's connection is configured and fast enough
 * to preload data in the background.
 */
export declare function networkSupportsPreloading(): boolean;
/**
 * Does this device support true hover/pointer interactions?
 */
export declare function deviceSupportsHover(): boolean;
/**
 * Safe requestIdleCallback function that falls back to setTimeout
 */
export declare const whenIdle: ((callback: IdleRequestCallback, options?: IdleRequestOptions | undefined) => number) & typeof requestIdleCallback;
