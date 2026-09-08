/**
 * Error type carrying an HTTP status code, so controllers can throw and let
 * the central error handler decide what the client sees.
 */
export class AppError extends Error {
  statusCode;
  code;
  details;

  constructor(statusCode, message, code = 'ERROR', details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new AppError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Not allowed') {
    return new AppError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, message, 'NOT_FOUND');
  }

  static conflict(message) {
    return new AppError(409, message, 'CONFLICT');
  }
}
