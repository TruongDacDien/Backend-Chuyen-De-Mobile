// @ts-nocheck
// routes/sysTest.routes.js
const express = require("express");
const router = express.Router();

const User = require("../models/user.model");
const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");
const authController = require("../controllers/auth.controller");
const { registerNoVerifyService } = require("../controllers/auth.controller");

/**
 * @swagger
 * tags:
 *   name: SYS Test
 *   description: Các API dùng để test đăng ký, login, role, verify
 */

/**
 * @swagger
 * /api/sys-test/seed-users:
 *   post:
 *     summary: Seed 3 user test (sys_admin, admin, user)
 *     tags: [SYS Test]
 *     security: []   # public
 *     responses:
 *       200:
 *         description: Danh sách user test + password
 *         content:
 *           application/json:
 *             example:
 *               message: "Seed users done (using registerNoVerifyService)"
 *               password: "123456"
 *               users:
 *                 - email: "sysadmin@test.com"
 *                   role: "sys_admin"
 *                 - email: "admin@test.com"
 *                   role: "admin"
 *                 - email: "user@test.com"
 *                   role: "user"
 */
router.post("/seed-users", async (req, res) => {
  try {
    const password = "123456";

    const usersData = [
      { email: "sysadmin@test.com", full_name: "System Admin", role: "sys_admin" },
      { email: "admin@test.com", full_name: "Company Admin", role: "admin" },
      { email: "user@test.com", full_name: "Normal User", role: "user" },
    ];

    const createdOrExisting = [];

    for (const u of usersData) {
      const user = await registerNoVerifyService({
        email: u.email,
        password,
        full_name: u.full_name,
        role: u.role,
        is_verified: true, // test cho nhanh
      });

      createdOrExisting.push({ email: user.email, role: user.role });
    }

    return res.json({
      message: "Seed users done (using registerNoVerifyService)",
      password,
      users: createdOrExisting,
    });
  } catch (err) {
    console.error("Seed users error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/sys-test/login:
 *   post:
 *     summary: Login test (dùng logic login thật, có check verify)
 *     tags: [SYS Test]
 *     security: []   # public
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             email: "admin@test.com"
 *             password: "123456"
 *     responses:
 *       200:
 *         description: Token + thông tin user
 */
router.post("/login", authController.login);

/**
 * @swagger
 * /api/sys-test/register-no-verify:
 *   post:
 *     summary: Đăng ký không cần verify (is_verified = true, không gửi mail)
 *     tags: [SYS Test]
 *     security: []   # public
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - full_name
 *               - company_name
 *               - company_address
 *               - company_email
 *               - company_phone
 *             properties:
 *               email: { type: string, example: "owner@acme.com" }
 *               password: { type: string, example: "123456" }
 *               full_name: { type: string, example: "Alice Owner" }
 *               company_name: { type: string, example: "ACME Corp" }
 *               company_address: { type: string, example: "123 Main St, HCMC" }
 *               company_email: { type: string, example: "contact@acme.com" }
 *               company_phone: { type: string, example: "0123456789" }
 *               # các field dưới là optional
 *               company_avatar: { type: string, example: "https://cdn.example.com/logo.png" }
 *               company_images:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["https://cdn.example.com/1.png", "https://cdn.example.com/2.png"]
 *               role: { type: string, example: "user" }
 *               job_title: { type: string, example: "Founder" }
 *               salary: { type: number, example: 1000 }
 *               face_id: { type: string, example: "FACE123" }
 *               avatar: { type: string, example: "https://cdn.example.com/u1.png" }
 *               gallery:
 *                 type: array
 *                 items: { type: string }
 *                 example: []
 *           example:
 *             email: "owner@acme.com"
 *             password: "123456"
 *             full_name: "Alice Owner"
 *             company_name: "ACME Corp"
 *             company_address: "123 Main St, HCMC"
 *             company_email: "contact@acme.com"
 *             company_phone: "0123456789"
 *             job_title: "Founder"
 *     responses:
 *       200:
 *         description: Tạo user thành công
 */
router.post("/register-no-verify", authController.registerNoVerify);

/**
 * @swagger
 * /api/sys-test/register-verify:
 *   post:
 *     summary: Đăng ký có verify (gửi mã OTP qua email)
 *     tags: [SYS Test]
 *     security: []   # public
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - full_name
 *               - company_name
 *               - company_address
 *               - company_email
 *               - company_phone
 *             properties:
 *               email: { type: string, example: "owner@acme.com" }
 *               password: { type: string, example: "123456" }
 *               full_name: { type: string, example: "Alice Owner" }
 *               company_name: { type: string, example: "ACME Corp" }
 *               company_address: { type: string, example: "123 Main St, HCMC" }
 *               company_email: { type: string, example: "contact@acme.com" }
 *               company_phone: { type: string, example: "0123456789" }
 *               # optional
 *               company_avatar: { type: string, example: "https://cdn.example.com/logo.png" }
 *               company_images:
 *                 type: array
 *                 items: { type: string }
 *                 example: []
 *               job_title: { type: string, example: "Founder" }
 *               salary: { type: number, example: 1000 }
 *               face_id: { type: string, example: "FACE123" }
 *               avatar: { type: string, example: "https://cdn.example.com/u1.png" }
 *               gallery:
 *                 type: array
 *                 items: { type: string }
 *                 example: []
 *           example:
 *             email: "owner@acme.com"
 *             password: "123456"
 *             full_name: "Alice Owner"
 *             company_name: "ACME Corp"
 *             company_address: "123 Main St, HCMC"
 *             company_email: "contact@acme.com"
 *             company_phone: "0123456789"
 *             job_title: "Founder"
 *     responses:
 *       200:
 *         description: Đăng ký + gửi OTP thành công
 */
router.post("/register-verify", authController.register);

/**
 * @swagger
 * /api/sys-test/resend-code:
 *   post:
 *     summary: Gửi lại mã xác nhận (OTP) cho user CHƯA verify
 *     tags: [SYS Test]
 *     security: []   # public
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             email: "user.verify@test.com"
 *     responses:
 *       200:
 *         description: Gửi lại OTP thành công
 */
router.post("/resend-code", authController.resendCode);

/**
 * @swagger
 * /api/sys-test/verify-account:
 *   post:
 *     summary: Xác nhận tài khoản bằng mã OTP
 *     tags: [SYS Test]
 *     security: []   # public
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             email: "user.verify@test.com"
 *             code: "123456"
 *     responses:
 *       200:
 *         description: Xác nhận tài khoản thành công
 */
router.post("/verify-account", authController.verifyAccount);

/**
 * @swagger
 * /api/sys-test/me:
 *   get:
 *     summary: Lấy thông tin user từ token (test đăng nhập)
 *     tags: [SYS Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin user từ DB + payload trong token
 */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    return res.json({ fromToken: req.user, user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/sys-test/check-admin:
 *   get:
 *     summary: Test quyền MANAGE_USERS (chỉ admin + sys_admin)
 *     tags: [SYS Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Có quyền MANAGE_USERS
 *       403:
 *         description: Không đủ quyền
 */
router.get("/check-admin", auth, rbac("MANAGE_USERS"), (req, res) => {
  return res.json({
    ok: true,
    message: "Bạn có quyền MANAGE_USERS (admin hoặc sys_admin)",
    role: req.user.role,
  });
});

/**
 * @swagger
 * /api/sys-test/check-user:
 *   get:
 *     summary: Test quyền VIEW_SELF (user, admin, sys_admin)
 *     tags: [SYS Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Có quyền VIEW_SELF
 *       403:
 *         description: Không đủ quyền
 */
router.get("/check-user", auth, rbac("VIEW_SELF"), (req, res) => {
  return res.json({
    ok: true,
    message: "Bạn có quyền VIEW_SELF",
    role: req.user.role,
  });
});

/**
 * @swagger
 * /api/sys-test/check-sys-admin:
 *   get:
 *     summary: Test chỉ SYS_ADMIN mới vào được
 *     tags: [SYS Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Là sys_admin
 *       403:
 *         description: Không phải sys_admin
 */
router.get("/check-sys-admin", auth, (req, res) => {
  if (req.user.role !== "sys_admin") {
    return res.status(403).json({ error: "Chỉ sys_admin mới được vào" });
  }

  return res.json({
    ok: true,
    message: "Xin chào SYS ADMIN",
    role: req.user.role,
  });
});

module.exports = router;
