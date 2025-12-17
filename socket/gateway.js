const { addConnection, removeConnection } = require("./registry");

/**
 * Sự kiện:
 *  - init (client->server): { userId }
 *  - pinguser (server->client): do REST gọi strategy để emit
 *  - disconnect (tự động): gỡ kết nối
 */
module.exports = function attachGateway(io) {
  const nsp = io.of("/ping");

  nsp.on("connection", (socket) => {
    console.log("🔌 socket connected:", { socketId: socket.id, nsp: "/ping" });

    socket.on("init", ({ userId }) => {
      console.log("📨 [init] payload:", { socketId: socket.id, userId });

      if (!userId) {
        socket.emit("init:error", { message: "userId is required" });
        console.log("❌ [init] missing userId -> init:error sent");
        return;
      }

      socket.data.userId = userId;
      addConnection(userId, socket.id);

      socket.emit("init:ack", { ok: true, socketId: socket.id, userId });
      console.log("✅ [init] ack sent:", { socketId: socket.id, userId });
    });

    socket.on("disconnect", (reason) => {
      const userId = socket.data.userId;
      console.log("🔌 socket disconnected:", { socketId: socket.id, userId, reason });
      if (userId) removeConnection(userId, socket.id);
    });
  });

  // Trả nsp ra cho Strategy dùng
  return { nsp };
};
