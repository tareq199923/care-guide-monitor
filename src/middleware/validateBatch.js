const AppError = require('../utils/AppError');
const thresholds = require('../config/thresholds');

module.exports = function validateBatch(req, res, next) {
  if (!Array.isArray(req.body) || req.body.length === 0) {
    return next(new AppError(
      'Request body must be a non-empty array of check results',
      400,
    ));
  }

  const details = [];
  const items = req.body.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      details.push({ index, message: 'item must be an object' });
      return null;
    }

    const apiName = typeof item.api_name === 'string' ? item.api_name.trim() : '';

    if (apiName === '') {
      details.push({
        index,
        message: 'api_name must be a non-empty string',
      });
      return null;
    }

    if (apiName.length > thresholds.API_NAME_MAX_LENGTH) {
      details.push({
        index,
        message: `api_name must be ${thresholds.API_NAME_MAX_LENGTH} characters or fewer`,
      });
      return null;
    }

    return { ...item, api_name: apiName };
  });

  if (details.length > 0) {
    return next(new AppError('Validation failed', 400, details));
  }

  req.body = items;
  return next();
};
