const logger = require('../utils/logger');

module.exports = function requireSuperUser(req, res, next) {
  const roleName = req.user?.role?.rolename;
  if (roleName === 'SuperUser') {
    return next();
  }
  logger.warn('Forbidden: super user access required', {
    userId: req.user?._id,
    roleName,
    path: req.originalUrl,
    method: req.method,
    operatorId: req.user?.operatorId,
  });
  return res.status(403).json({ message: 'Forbidden' });
};
