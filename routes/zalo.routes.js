const router = require("express").Router();
const zalo = require("../controllers/zalo.controller");

/**
 * @swagger
 * tags:
 *   - name: ZaloPay
 *     description: API mô phỏng Subscription (Auto-Debit) ZaloPay Sandbox
 */

/**
 * @swagger
 * /api/zalo/bind:
 *   post:
 *     summary: Tạo liên kết Auto-Debit (Binding)
 *     description: Sinh binding_url (QR/Link) để người dùng xác nhận ủy quyền thanh toán.
 *     tags: [ZaloPay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 example: user_demo_001
 *     responses:
 *       200:
 *         description: URL liên kết trả về
 */
router.post("/bind", zalo.createBinding);

/**
 * @swagger
 * /api/zalo/query-token:
 *   post:
 *     summary: Truy vấn token từ binding_id hoặc app_trans_id
 *     description: Dùng để lấy pay_token tương ứng binding đã liên kết.
 *     tags: [ZaloPay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               binding_id:
 *                 type: string
 *                 example: "251112blbQoVGVKv886HA2L1Mkmyj3W2"
 *               app_trans_id:
 *                 type: string
 *                 example: "251112_456306"
 *     responses:
 *       200:
 *         description: Trả về thông tin pay_token
 */
router.post("/query-token", zalo.queryToken);

/**
 * @swagger
 * /api/zalo/pay:
 *   post:
 *     summary: Thanh toán định kỳ qua token (PayByToken)
 *     description: Thu tiền từ tài khoản đã liên kết (Auto-Debit).
 *     tags: [ZaloPay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: "user_demo_001"
 *               pay_token:
 *                 type: string
 *                 example: "251112blbQoVGVKv886HA2L1Mkmyj3W2"
 *               amount:
 *                 type: number
 *                 example: 30000
 *               description:
 *                 type: string
 *                 example: "Thanh toán gói Premium tháng 11"
 *     responses:
 *       200:
 *         description: Kết quả thanh toán
 */
router.post("/pay", zalo.payByToken);

/**
 * @swagger
 * /api/zalo/unbind:
 *   post:
 *     summary: Hủy liên kết Auto-Debit
 *     description: Ngắt ủy quyền thanh toán của người dùng.
 *     tags: [ZaloPay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               binding_id:
 *                 type: string
 *                 example: "251112blbQoVGVKv886HA2L1Mkmyj3W2"
 *               reason:
 *                 type: string
 *                 example: "Người dùng hủy ủy quyền"
 *     responses:
 *       200:
 *         description: Kết quả hủy liên kết
 */
router.post("/unbind", zalo.unbind);

/**
 * @swagger
 * /api/zalo/bind-return:
 *   get:
 *     summary: Redirect sau khi user xác nhận liên kết
 *     tags: [ZaloPay]
 */
router.get("/bind-return", zalo.bindReturn);

/**
 * @swagger
 * /api/zalo/ipn:
 *   post:
 *     summary: Webhook/IPN nhận thông báo từ ZaloPay
 *     tags: [ZaloPay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 example:
 *                   app_trans_id: "251112_456306"
 *                   binding_id: "251112blbQoVGVKv886HA2L1Mkmyj3W2"
 *                   amount: 30000
 *                   status: "success"
 *               mac:
 *                 type: string
 *                 example: "fake_test"
 *     responses:
 *       200:
 *         description: Trả về return_code và return_message
 */
router.post("/ipn", zalo.ipn);

module.exports = router;