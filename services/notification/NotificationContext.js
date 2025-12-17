class NotificationContext {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  async send(targets, title, body) {
    return this.strategy.send(targets, title, body);
  }
}

module.exports = NotificationContext;
