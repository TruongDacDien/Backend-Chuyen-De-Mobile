const RoleHandler = require("../RoleHandler");

class UserHandler extends RoleHandler {
  handle(role, action) {
    // ⬅️ admin cũng auto có quyền user
    if (role === "user" || role === "admin" || role === 'sys_admin') {
      const allowedActions = [
        "VIEW_SELF",
        "CHECKIN",
      ];
      if (allowedActions.includes(action)) return true;
    }

    return super.handle(role, action);
  }
}

module.exports = UserHandler;
