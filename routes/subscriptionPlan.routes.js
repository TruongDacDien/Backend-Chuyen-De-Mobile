// routes/subscriptionPlan.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/subscriptionPlan.controller");

// middleware
const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");

/**
 * @swagger
 * tags:
 *   name: Subscription Plans
 *   description: API quản lý các gói subscription
 */

/**
 * @swagger
 * /api/plans:
 *   post:
 *     summary: Tạo mới gói (sys_admin)
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Created
 */
router.post(
  "/",
  auth,
  rbac("MANAGE_SUBSCRIPTION_PLANS"), // chỉ sys_admin pass
  controller.createPlan
);

/**
 * @swagger
 * /api/plans/search:
 *   post:
 *     summary: Search theo tất cả field (sys_admin)
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Kết quả
 */
router.post(
  "/search",
  auth,
  rbac("MANAGE_SUBSCRIPTION_PLANS"),
  controller.searchPlans
);

/**
 * @swagger
 * /api/plans:
 *   get:
 *     summary: Lấy danh sách gói (chỉ cần đăng nhập)
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách
 */
router.get(
  "/",
  auth,                 // chỉ cần token -> user/admin/sys_admin đều xem được
  controller.getAllPlans
);

/**
 * @swagger
 * /api/plans/{id}:
 *   get:
 *     summary: Lấy chi tiết 1 gói (sys_admin)
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Chi tiết
 */
router.get(
  "/:id",
  auth,
  rbac("MANAGE_SUBSCRIPTION_PLANS"),
  controller.getPlanById
);

/**
 * @swagger
 * /api/plans/{id}:
 *   put:
 *     summary: Cập nhật 1 gói (sys_admin)
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  "/:id",
  auth,
  rbac("MANAGE_SUBSCRIPTION_PLANS"),
  controller.updatePlan
);

/**
 * @swagger
 * /api/plans/{id}:
 *   delete:
 *     summary: Xoá mềm 1 gói (sys_admin)
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete(
  "/:id",
  auth,
  rbac("MANAGE_SUBSCRIPTION_PLANS"),
  controller.deletePlan
);

module.exports = router;
