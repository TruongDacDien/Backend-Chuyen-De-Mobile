// authorization/handlers/SysAdminHandler.js
const RoleHandler = require("../RoleHandler");

class SysAdminHandler extends RoleHandler {
  handle(role, action) {
    if (role === "sys_admin") {
      // sys_admin full quyền luôn
      return true;
    }
    return super.handle(role, action);
  }
}

module.exports = SysAdminHandler;
