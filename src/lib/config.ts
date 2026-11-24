/** Build target, shared by server rendering and hydration. Never infer this
 * from a user agent, a query parameter or the presence of a window global. */
export const IS_DESKTOP_APP = process.env.NEXT_PUBLIC_IS_DESKTOP_APP !== "false";
