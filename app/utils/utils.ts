import { Request, Response, NextFunction } from "express";

/** Async wrapper used to wrap the controller functions.
 * This is needed because async functions in router.get/post/put/.. won't be caught by the global error middleware.
 * So a async wrapper is needed.
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  return Promise
    .resolve(fn(req, res, next))
    .catch(next);
};
