const { addConnection, removeConnection, getSocketsOf } = require("./registry");
const User = require("../models/user.model");

module.exports = function attachGateway(io) {
  const nsp = io.of("/ping");

  // 🔔 helper ping toàn server
  const pingAll = (payload = {}) => {
    console.log("📡 Emit pinguser to ALL clients", payload);
    nsp.emit("pinguser", payload);
  };

  nsp.on("connection", (socket) => {
    console.log("🔌 socket connected:", {
      socketId: socket.id,
      nsp: "/ping",
    });

    // ===============================
    // INIT (client -> server)
    // ===============================
    socket.on("init", async ({ userId }) => {
      console.log("📨 [init]", { socketId: socket.id, userId });

      if (!userId) {
        socket.emit("init:error", { message: "userId is required" });
        return;
      }

      socket.data.userId = userId;
      addConnection(userId, socket.id);

      try {
        await User.findByIdAndUpdate(userId, { online: true });
        console.log(`🟢 User ${userId} ONLINE`);

        // 🔥 PING TOÀN SERVER (USER ONLINE)
        pingAll({
          type: "user_online",
          userId,
        });
      } catch (err) {
        console.error("❌ update online error:", err);
      }

      socket.emit("init:ack", {
        ok: true,
        socketId: socket.id,
        userId,
      });
    });

    // ===============================
    // DISCONNECT
    // ===============================
    socket.on("disconnect", async (reason) => {
      const userId = socket.data.userId;
      console.log("🔌 socket disconnected:", {
        socketId: socket.id,
        userId,
        reason,
      });

      if (!userId) return;

      removeConnection(userId, socket.id);

      // ❗ chỉ offline khi KHÔNG còn socket nào
      const sockets = getSocketsOf(userId);
      if (sockets.size === 0) {
        try {
          await User.findByIdAndUpdate(userId, { online: false });
          console.log(`⚫ User ${userId} OFFLINE`);

          // 🔥 PING TOÀN SERVER (USER OFFLINE)
          pingAll({
            type: "user_offline",
            userId,
          });
        } catch (err) {
          console.error("❌ update offline error:", err);
        }
      }
    });
  });

  return { nsp };
};
