const router = require("express").Router();
const momo = require("../controllers/momo.controller");

/**
 * @swagger
 * tags:
 *   name: MoMo
 *   description: Tích hợp thanh toán MoMo v2
 */

/**
 * @swagger
 * /api/momo/create:
 *   post:
 *     summary: Tạo đơn thanh toán MoMo (trả về payUrl/deeplink)
 *     description: Server ký HMAC SHA256 và gọi endpoint MoMo `/v2/gateway/api/create`.
 *     tags: [MoMo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: integer
 *                 example: 50000
 *               orderInfo:
 *                 type: string
 *                 example: "Thanh toán đơn #A123"
 *               extraData:
 *                 type: string
 *                 example: ""
 *     responses:
 *       200:
 *         description: Tạo đơn thành công
 *       400:
 *         description: Tham số không hợp lệ
 *       500:
 *         description: Lỗi hệ thống
 */
router.post("/create", momo.createPayment);

/**
 * @swagger
 * /api/momo/ipn:
 *   post:
 *     summary: IPN callback từ MoMo (server-to-server)
 *     description: MoMo gọi về để thông báo kết quả thanh toán. BE cần verify chữ ký và cập nhật trạng thái đơn.
 *     tags: [MoMo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               partnerCode: { type: string, example: "MOMOXXXX2025" }
 *               orderId:     { type: string, example: "M1731479999999" }
 *               requestId:   { type: string, example: "MOMOXXXX2025-1731479999999" }
 *               amount:      { type: integer, example: 50000 }
 *               resultCode:  { type: integer, example: 0 }
 *               message:     { type: string,  example: "Successful." }
 *               transId:     { type: string,  example: "3700444455" }
 *               orderInfo:   { type: string,  example: "Thanh toán đơn #A123" }
 *               signature:   { type: string,  example: "..." }
 *     responses:
 *       200:
 *         description: BE nhận và xử lý OK (resultCode 0 để MoMo không retry)
 */
router.post("/ipn", momo.ipnHandler);

/**
 * @swagger
 * /api/momo/status/{orderId}:
 *   get:
 *     summary: Lấy trạng thái đơn thanh toán
 *     tags: [MoMo]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *         example: "M1731479999999"
 *     responses:
 *       200:
 *         description: Trạng thái hiện tại của đơn
 *       404:
 *         description: Không tìm thấy đơn
 */
router.get("/status/:orderId", momo.getStatus);

/**
 * @swagger
 * /api/momo/return:
 *   get:
 *     summary: (Tuỳ chọn) Trang hiển thị kết quả khi redirect về
 *     tags: [MoMo]
 *     parameters:
 *       - in: query
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *         example: "M1731479999999"
 *     responses:
 *       200:
 *         description: Trang text đơn giản
 */
router.get("/return", momo.returnPage);

module.exports = router;
