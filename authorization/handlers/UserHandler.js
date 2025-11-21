// authorization/handlers/UserHandler.js
const RoleHandler = require("../RoleHandler");

class UserHandler extends RoleHandler {
  handle(role, action) {
    if (role === "user") {
      const allowedActions = [
        "VIEW_SELF",   // xem chính mình
        "CHECKIN",     // sau này dùng cho chấm công
        
      ];
      if (allowedActions.includes(action)) return true;
    }
    return super.handle(role, action);
  }
}

module.exports = UserHandler;
