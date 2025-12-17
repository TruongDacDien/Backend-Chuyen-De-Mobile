/**
 * @swagger
 * tags:
 *   name: Mail
 *   description: API gửi mail đơn giản (không dùng template)
 */

/**
 * @swagger
 * /api/mails/send:
 *   post:
 *     summary: Gửi mail đến danh sách người nhận (không template)
 *     tags: [Mail]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, subject]
 *             properties:
 *               to:
 *                 type: array
 *                 items: { type: string, format: email }
 *                 example: ["gptsharep@gmail.com", "phutranngoc.se@gmail.com"]
 *               cc:
 *                 type: array
 *                 items: { type: string, format: email }
 *               bcc:
 *                 type: array
 *                 items: { type: string, format: email }
 *               subject:
 *                 type: string
 *                 example: "Thông báo hệ thống"
 *               html:
 *                 type: string
 *                 example: "<h3>Xin chào</h3><p>Tài khoản đã sẵn sàng!</p>"
 *               text:
 *                 type: string
 *                 example: "Tai khoan da san sang!"
 *     responses:
 *       200:
 *         description: Kết quả gửi
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       500:
 *         description: Lỗi server
 */

const router = require("express").Router();
const ctrl = require("../controllers/mail.controller");
router.post("/send", ctrl.bulkValidators, ctrl.sendBulk);
module.exports = router;
