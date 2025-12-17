// middleware/rbac.middleware.js
const roleChain = require("../authorization/RoleHandlerChain");

module.exports = function rbac(action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const allowed = roleChain.handle(req.user.role, action);

    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
};
