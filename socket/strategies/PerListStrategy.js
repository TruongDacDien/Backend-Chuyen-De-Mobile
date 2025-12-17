const BaseStrategy = require("./BaseStrategy");

class PerListStrategy extends BaseStrategy {
  execute({ nsp, registry, payload }) {
    const { userIds, action, data } = payload || {};
    if (!Array.isArray(userIds) || userIds.length === 0) return 0;

    let delivered = 0;
    for (const uid of userIds) {
      const sockets = registry.getSocketsOf(uid);
      const ids = Array.from(sockets);
      for (const sid of ids) {
        nsp.to(sid).emit("pinguser", { userId: uid, action, data, serverTime: Date.now() });
        delivered++;
      }
    }
    console.log("📊 [PerListStrategy] delivered:", delivered);
    return delivered;
  }
}
module.exports = PerListStrategy;
