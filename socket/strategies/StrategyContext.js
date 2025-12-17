const { getSocketsOf, snapshot, getAll } = require("../registry");
const PerUserStrategy = require("./PerUserStrategy");
const BroadcastStrategy = require("./BroadcastStrategy");
const PerListStrategy = require("./PerListStrategy");

class StrategyContext {
  constructor(nsp) {
    this.nsp = nsp;
    this.strategies = {
      perUser: new PerUserStrategy(),
      broadcast: new BroadcastStrategy(),
      perList: new PerListStrategy()
    };
  }

  /**
   * @param {string} mode - perUser | broadcast | perList
   * @param {object} payload
   * @returns {number} deliveredTo
   */
  execute(mode, payload) {
    const strategy = this.strategies[mode] || this.strategies.perUser;
    return strategy.execute({
      nsp: this.nsp,
      registry: { getSocketsOf, snapshot, getAll },
      payload
    });
  }
}

module.exports = StrategyContext;
