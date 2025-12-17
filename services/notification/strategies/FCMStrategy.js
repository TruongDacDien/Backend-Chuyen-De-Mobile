const admin = require("../firebase");

class FCMStrategy {
  async send(targets, title, body) {
    const messages = targets.map((token) => ({
      token,
      notification: { title, body },
    }));

    const responses = await Promise.all(
      messages.map((msg) => admin.messaging().send(msg))
    );

    return responses;
  }
}

module.exports = FCMStrategy;
