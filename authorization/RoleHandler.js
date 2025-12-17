// authorization/RoleHandler.js
class RoleHandler {
  setNext(handler) {
    this.nextHandler = handler;
    return handler;
  }

  handle(role, action) {
    if (this.nextHandler) {
      return this.nextHandler.handle(role, action);
    }
    return false;
  }
}

module.exports = RoleHandler;
