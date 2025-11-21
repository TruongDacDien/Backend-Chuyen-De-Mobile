// authorization/RoleHandlerChain.js
const SysAdminHandler = require("./handlers/SysAdminHandler");
const AdminHandler = require("./handlers/AdminHandler");
const UserHandler = require("./handlers/UserHandler");

// tạo chain: sys_admin -> admin -> user
const sysAdmin = new SysAdminHandler();
const admin = new AdminHandler();
const user = new UserHandler();

sysAdmin.setNext(admin).setNext(user);

module.exports = sysAdmin;
