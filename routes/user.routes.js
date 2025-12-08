const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");
const userController = require("../controllers/user.controller");

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User management APIs
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Tạo nhân viên mới (Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", auth, rbac("MANAGE_USERS"), userController.createUserByAdmin);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lấy danh sách toàn bộ user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", auth, rbac("MANAGE_USERS"), userController.getAllUsers);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Lấy thông tin user hiện tại
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get("/me", auth, rbac("VIEW_SELF"), userController.getMe);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Cập nhật profile của tôi
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put("/me", auth, rbac("VIEW_SELF"), userController.updateMyProfile);

/**
 * @swagger
 * /api/users/company:
 *   get:
 *     summary: Lấy danh sách user thuộc công ty của tài khoản đang đăng nhập
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách nhân viên
 */
router.get(
  "/company",
  auth,
  rbac("MANAGE_USERS"),
  userController.getUsersByCompany
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Lấy thông tin user theo ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", auth, rbac("VIEW_USER"), userController.getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Cập nhật user (Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put("/:id", auth, rbac("MANAGE_USERS"), userController.updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Xóa mềm user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:id", auth, rbac("MANAGE_USERS"), userController.deleteUser);

module.exports = router;