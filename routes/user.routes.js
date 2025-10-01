const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API to manage users
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Minh
 *               email:
 *                 type: string
 *                 example: minh@example.com
 *     responses:
 *       201:
 *         description: User created
 *       500:
 *         description: Internal error
 */
router.post("/", userController.createUser);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 *       500:
 *         description: Internal error
 */
router.get("/", userController.getUsers);

module.exports = router;
