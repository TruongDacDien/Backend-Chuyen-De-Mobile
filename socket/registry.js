// Map userId -> Set<socketId>
const userSockets = new Map();

function addConnection(userId, socketId) {
  const set = userSockets.get(userId) || new Set();
  set.add(socketId);
  userSockets.set(userId, set);

  console.log("👤 addConnection:", { userId, socketId, totalSocketsOfUser: set.size });
  console.log("📦 registry snapshot:", snapshot());
}

function removeConnection(userId, socketId) {
  const set = userSockets.get(userId);
  if (!set) return;

  set.delete(socketId);
  if (set.size === 0) {
    userSockets.delete(userId);
  } else {
    userSockets.set(userId, set);
  }

  console.log("👋 removeConnection:", { userId, socketId, remaining: set ? set.size : 0 });
  console.log("📦 registry snapshot:", snapshot());
}

function getSocketsOf(userId) {
  return userSockets.get(userId) || new Set();
}

function snapshot() {
  const obj = {};
  for (const [uid, set] of userSockets.entries()) {
    obj[uid] = Array.from(set);
  }
  return obj;
}

function getAll() {
  return userSockets;
}

module.exports = {
  addConnection,
  removeConnection,
  getSocketsOf,
  getAll,
  snapshot
};
