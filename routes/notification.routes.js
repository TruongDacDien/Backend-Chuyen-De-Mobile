const express = require("express");
const router = express.Router();
const controller = require("../controllers/notification.controller");

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Firebase Cloud Messaging APIs
 */

/**
 * @swagger
 * /api/notify/register:
 *   post:
 *     summary: Register FCM token for user
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             userId: "123"
 *             token: "fcm-token-xyz"
 *     responses:
 *       200:
 *         description: Token registered
 */
router.post("/register", controller.registerToken);

/**
 * @swagger
 * /api/notify/user:
 *   post:
 *     summary: Send notification to 1 user
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             userId: "123"
 *             title: "Hello"
 *             body: "This is a test notification"
 */
router.post("/user", controller.notifyUser);

/**
 * @swagger
 * /api/notify/all:
 *   post:
 *     summary: Send notification to ALL users
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             title: "🔥 Update mới!"
 *             body: "App vừa cập nhật thêm tính năng mới."
 */
router.post("/all", controller.notifyAll);

module.exports = router;
