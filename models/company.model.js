const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  // ---------- Thông Tin Chung ----------
  name: { type: String, required: true },
  code: { type: String, unique: true },

  avatar: { type: String },
  images: { type: [String], default: [] },

  address: { type: String },
  contact_email: { type: String },
  contact_phone: { type: String },

  // ---------- Subscription ----------
  subscription_plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubscriptionPlan"
  },
  subscription_status: {
    type: String,
    enum: ["active", "expired", "canceled","unactive"],
    default: "unactive",
  },
  stripe_subscription_id: { type: String },
  stripe_customer_id: { type: String },

  // ---------- Lịch sử gói ----------
  plan_history: [
    {
      plan: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan" },
      price: Number,
      start_date: Date,
      end_date: Date,
      created_at: { type: Date, default: Date.now },
    }
  ],

  // ---------- Cấu hình công ty ----------
  company_settings: {
    working_mode: {
      type: String,
      enum: ["office", "hybrid", "remote"],
      default: "office",
    },
    work_days_per_week: { type: Number, default: 6 },
    weekend_days: { type: [String], default: ["saturday", "sunday"] },
    holidays: { type: [Date], default: [] },
    allow_overtime: { type: Boolean, default: false },
    default_leave_days: { type: Number, default: 12 },
  },

  // ---------- Cấu hình chấm công ----------
  attendance_settings: {
    face_recognition: { type: Boolean, default: true },
    gps_checkin: { type: Boolean, default: true },
    allow_remote_checkin: { type: Boolean, default: false },

    working_hours: {
      checkin_start: { type: String, default: "07:30" },
      checkin_end: { type: String, default: "09:00" },
      checkout_earliest: { type: String, default: "16:00" },
      checkout_latest: { type: String, default: "19:00" },
    },
  },

  // ---------- Vị trí Check-in ----------
  checkin_location: {
    lat: Number,
    lng: Number,
    address: String,
  },
  checkin_radius: { type: Number, default: 100 },

  // ---------- Soft delete ----------
  record_status: { type: Number, default: 1 },

  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Company", companySchema);
