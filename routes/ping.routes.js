const router = require("express").Router();

/**
 * @swagger
 * tags:
 *   name: Ping
 *   description: Gửi ping từ server đến FE (qua Socket.IO) dùng Strategy Pattern
 */

/**
 * @swagger
 * /api/ping:
 *   post:
 *     summary: Ping theo strategy
 *     description: |
 *       - **perUser** (mặc định): cần `userId`
 *       - **perList**: cần `userIds` (mảng)
 *       - **broadcast**: không cần userId
 *     tags: [Ping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [perUser, perList, broadcast]
 *                 example: perUser
 *               userId:
 *                 type: string
 *                 example: "U123"
 *               userIds:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["U123","U456"]
 *               action:
 *                 type: string
 *                 example: "REFRESH_BADGE"
 *               data:
 *                 type: object
 *                 example: { "unreadCount": 5 }
 *     responses:
 *       200:
 *         description: Ping đã được emit
 *       400:
 *         description: Thiếu tham số
 *       404:
 *         description: Không tìm thấy user kết nối (perUser/perList)
 */
router.post("/", (req, res) => {
  const { mode = "perUser", userId, userIds, action, data } = req.body || {};
  console.log("🌐 [POST /api/ping] body:", req.body);

  if (!action) {
    return res.status(400).json({ success: false, message: "action is required" });
  }
  if (mode === "perUser" && !userId) {
    return res.status(400).json({ success: false, message: "userId is required for perUser mode" });
  }
  if (mode === "perList" && (!Array.isArray(userIds) || userIds.length === 0)) {
    return res.status(400).json({ success: false, message: "userIds is required for perList mode" });
  }

  const ctx = req.app.get("socketStrategy"); // lấy StrategyContext
  const delivered = ctx.execute(mode, { userId, userIds, action, data });

  // broadcast trả -1 vì không đếm socket
  if (mode !== "broadcast" && delivered === 0) {
    return res.status(404).json({ success: false, message: "User not connected", deliveredTo: 0 });
  }
  return res.json({ success: true, deliveredTo: delivered });
});

module.exports = router;
