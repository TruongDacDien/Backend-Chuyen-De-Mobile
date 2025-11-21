const BaseStrategy = require("./BaseStrategy");

class BroadcastStrategy extends BaseStrategy {
  execute({ nsp, payload }) {
    const { action, data } = payload || {};
    console.log("📣 [BroadcastStrategy] -> all", { action });
    nsp.emit("pinguser", { action, data, serverTime: Date.now() });
    // Không đếm chính xác số socket (có thể lấy từ adapter), tạm trả -1
    return -1;
  }
}
module.exports = BroadcastStrategy;
