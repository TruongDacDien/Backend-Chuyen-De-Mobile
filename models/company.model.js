const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  /* ================================
        Thông Tin Chung
  =================================*/
  name: { type: String, required: true },
  code: { type: String, unique: true },

  avatar: { type: String },
  images: { type: [String], default: [] },

  address: { type: String },
  contact_email: { type: String },
  contact_phone: { type: String },

  /* ================================
        Subscription
  =================================*/
  subscription_plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubscriptionPlan",
  },
  subscription_status: {
    type: String,
    enum: ["active", "expired", "canceled", "unactive"],
    default: "unactive",
  },
  stripe_subscription_id: String,
  stripe_customer_id: String,

  plan_history: [
    {
      plan: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan" },
      price: Number,
      start_date: Date,
      end_date: Date,
      created_at: { type: Date, default: Date.now },
    },
  ],

  /* ================================
        ⭐ Attendance Config (theo FE)
  =================================*/
  checkin_location: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
  },

  checkin_radius: { type: Number, default: 100 }, // mét 
  attendance_config: {
    working_hours: {
      start_time: { type: String, default: "08:00" },
      end_time: { type: String, default: "17:00" },
      break_start: { type: String, default: "12:00" },
      break_end: { type: String, default: "13:00" },
      working_days: {
        type: [String],
        default: ["mon", "tue", "wed", "thu", "fri", "sat"],
      },
      company_holidays: { type: [String], default: [] }, // YYYY-MM-DD
    },

    late_rule: {
      allow_minutes: { type: String, default: "5" },
      deduct_per_minute: { type: Boolean, default: true },
      unit_minutes: { type: String, default: "15" },
      max_late_as_absent_minutes: { type: String, default: "240" },
    },

    early_leave_rule: {
      deduct_per_minute: { type: Boolean, default: true },
      unit_minutes: { type: String, default: "15" },
      max_early_as_absent_minutes: { type: String, default: "240" },
    },

    overtime_policy: {
      min_ot_minutes: { type: String, default: "30" },
      round_to_minutes: { type: String, default: "30" },
      weekday_rate: { type: String, default: "1.5" },
      weekend_rate: { type: String, default: "2.0" },
      holiday_rate: { type: String, default: "3.0" },
    },

    leave_policy: {
      annual_leave_days: { type: String, default: "12" },
      allow_half_day: { type: Boolean, default: true },

      paid_leave_types: [
        {
          _id: { type: String },
          name: { type: String },
        },
      ],
    },

    salary_policy: {
      workdays_per_month: { type: String, default: "26" },
      hours_per_day: { type: String, default: "8" },
    },
  },

  /* ================================
        Soft Delete
  =================================*/
  record_status: { type: Number, default: 1 },

  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Company", companySchema);
