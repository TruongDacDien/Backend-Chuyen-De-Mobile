// models/subscriptionPlan.model.js
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  max_employees: { type: Number, default: null },
  price_per_month: { type: Number, required: true },
  description: String,

  features: {},

  stripe_price_id: String,

  image_url: { type: String },  // ⬅️ NEW FIELD: ảnh đại diện gói

  record_status: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SubscriptionPlan", planSchema);
