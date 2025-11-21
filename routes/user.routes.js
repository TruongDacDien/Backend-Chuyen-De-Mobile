// routes/user.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");
const userController = require("../controllers/user.controller");

// sys_admin & admin: xem list user
router.get("/", auth, rbac("MANAGE_USERS"), userController.getAllUsers);

// user thường: xem profile bản thân
router.get("/me", auth, rbac("VIEW_SELF"), userController.getMe);

// sys_admin / admin: thao tác trên user bất kỳ
router.get("/:id", auth, rbac("VIEW_USER"), userController.getUserById);
router.put("/:id", auth, rbac("MANAGE_USERS"), userController.updateUser);
router.delete("/:id", auth, rbac("MANAGE_USERS"), userController.deleteUser);

module.exports = router;
