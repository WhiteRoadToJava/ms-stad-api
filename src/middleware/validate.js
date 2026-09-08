/**
 * Validates and replaces req.body / req.query / req.params with parsed data,
 * so controllers always receive typed, trimmed, coerced input.
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
    if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
    next();
  } catch (error) {
    next(error);
  }
};
