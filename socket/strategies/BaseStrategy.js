class BaseStrategy {
  /**
   * @param {Object} ctx
   *  - nsp: Socket.IO namespace
   *  - registry: helpers (getSocketsOf, snapshot, getAll)
   *  - payload: { action, data?, userId?, userIds? }
   * @returns {number} deliveredTo
   */
  execute(ctx) {
    throw new Error("execute() not implemented");
  }
}
module.exports = BaseStrategy;
