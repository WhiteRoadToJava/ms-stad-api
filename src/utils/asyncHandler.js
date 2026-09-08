/**
 * Wraps an async controller so rejected promises reach the error middleware
 * instead of hanging the request.
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
