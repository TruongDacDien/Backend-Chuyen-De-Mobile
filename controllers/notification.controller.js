const FCMToken = require("../models/fcmToken.model");
const FCMStrategy = require("../services/notification/strategies/FCMStrategy");
const NotificationContext = require("../services/notification/NotificationContext");

const fcmStrategy = new FCMStrategy();
const notifyCtx = new NotificationContext(fcmStrategy);

module.exports = {
  // 1️⃣ Đăng ký Token
  registerToken: async (req, res) => {
    try {
      const { userId, token } = req.body;

      if (!userId || !token)
        return res.status(400).json({ message: "Missing userId or token" });

      await FCMToken.findOneAndUpdate(
        { userId },
        { token },
        { upsert: true, new: true }
      );

      res.json({ message: "Token registered OK" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 2️⃣ Gửi thông báo tới 1 user
  notifyUser: async (req, res) => {
    try {
      const { userId, title, body } = req.body;

      const user = await FCMToken.findOne({ userId });
      if (!user) return res.status(404).json({ message: "User not found" });

      await notifyCtx.send([user.token], title, body);

      res.json({ message: "Notification sent to user" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 3️⃣ Gửi thông báo tới toàn bộ user
  notifyAll: async (req, res) => {
    try {
      const { title, body } = req.body;

      const tokens = await FCMToken.find().select("token -_id");
      if (!tokens.length) return res.json({ message: "No users" });

      const tokenList = tokens.map((t) => t.token);

      await notifyCtx.send(tokenList, title, body);

      res.json({ message: "Notification sent to ALL users" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
