const mongoose = require("mongoose");

const FCMTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    token: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FCMToken", FCMTokenSchema);
