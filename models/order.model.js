const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  amount: Number,
  orderInfo: String,
  status: { type: String, enum: ["Pending", "Succeeded", "Failed"], default: "Pending" },
  resultCode: Number,
  message: String,
  transId: String,
  rawCreateResponse: Object,
  rawIpn: Object,
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);
