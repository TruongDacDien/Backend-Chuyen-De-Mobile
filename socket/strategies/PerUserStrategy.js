const BaseStrategy = require("./BaseStrategy");

class PerUserStrategy extends BaseStrategy {
  execute({ nsp, registry, payload }) {
    const { userId, action, data } = payload || {};
    if (!userId) return 0;

    const sockets = registry.getSocketsOf(userId);
    const ids = Array.from(sockets);
    console.log("🎯 [PerUserStrategy] ->", { userId, action, socketIds: ids });

    for (const sid of ids) {
      nsp.to(sid).emit("pinguser", {
        userId,
        action,
        data,
        serverTime: Date.now()
      });
    }
    console.log("📊 [PerUserStrategy] delivered:", ids.length);
    return ids.length;
  }
}
module.exports = PerUserStrategy;
