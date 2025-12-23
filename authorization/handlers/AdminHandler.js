// authorization/handlers/AdminHandler.js
const RoleHandler = require("../RoleHandler");

class AdminHandler extends RoleHandler {
  handle(role, action) {
    if (role === "admin") {
      const allowedActions = [
        "MANAGE_USERS",
        "MANAGE_DEPARTMENTS",
        "VIEW_USER",
        "MANAGE_BILLING",  
        "MANAGE_SUBSCRIPTION_PLANS"     // ⬅️ thêm quyền billing
      ];
      if (allowedActions.includes(action)) return true;
    }
    return super.handle(role, action);
  }
}

module.exports = AdminHandler;
