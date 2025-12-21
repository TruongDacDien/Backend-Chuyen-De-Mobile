const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    old_password: { type: String, default: null, select: false },

    full_name: { type: String, required: true },
    employee_code: { type: String, trim: true },
    phone_number: { type: String },
    gender: { type: String, enum: ["male", "female"] },
    date_of_birth: { type: Date },

    country_code: { type: String },
    state_code: { type: String },
    city_name: { type: String },
    full_address: { type: String },

    face_image: { type: String },
    face_image2: { type: String },
    face_image3: { type: String },

    last_login: { type: Date },
    is_active: { type: Boolean, default: true },
    profile_approved: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["sys_admin", "admin", "user"],
      default: "user",
    },
    paid_leave_used: {
      type: Number,
      default: 0, // tổng ngày nghỉ có lương (annual + sick)
    },

    total_leave_used: {
      type: Number,
      default: 0, // tổng ngày nghỉ (paid + unpaid)
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    manager_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    job_title: { type: String },
    salary: { type: Number },

    avatar: { type: String },
    face_id: { type: String },
    gallery: [{ type: String }],

    is_verified: { type: Boolean, default: false },
    verification_code: { type: String },
    verification_expires: { type: Date },

    reset_password_code: { type: String, default: null },
    reset_password_expires: { type: Date, default: null },
    location_session_token: { type: String, default: null },
    location_session_expires: { type: Date, default: null },
    record_status: { type: Number, default: 1 },

    /* -------------------------------------------------------------
       🟦 CHẤM CÔNG (CHECK-IN / CHECK-OUT)
    ------------------------------------------------------------- */
    attendance_logs: [
      {
        date: { type: String, required: true }, // "2025-01-03"
        check_in_time: { type: String },        // "09:00"
        check_out_time: { type: String },       // "17:00"
        total_hours: { type: Number, default: 0 },

        check_in_image: { type: String },
        check_out_image: { type: String },

        created_at: { type: Date, default: Date.now },
      },
    ],

    /* -------------------------------------------------------------
       🟨 KHIẾU NẠI CHECK-IN / CHECK-OUT
    ------------------------------------------------------------- */
    checkin_complaints: [
      {
        date: { type: String, required: true },
        action: {
          type: String,
          enum: ["check_in", "check_out"],
          required: true,
        },
        time: { type: String, required: true },
        reason: { type: String, required: true },
        evidence_images: { type: [String], default: [] },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        admin_note: { type: String, default: "" },
        approved_at: { type: Date, default: null },
        created_at: { type: Date, default: Date.now },
      },
    ],
    annual_leave_used: {
      type: Number,
      default: 0, // tổng số ngày phép năm đã dùng
    },
    /* -------------------------------------------------------------
       🟧 NGHỈ PHÉP
    ------------------------------------------------------------- */
    leave_requests: [
      {
        type: {
          type: String,
          enum: ["annual", "sick", "unpaid"],
          required: true,
        },
        start_date: { type: String, required: true },
        end_date: { type: String, required: true },
        day_type: {
          type: String,
          enum: ["full", "half_morning", "half_afternoon"],
          default: "full",
        },
        reason: { type: String, required: true },
        evidence_images: { type: [String], default: [] },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        admin_note: String,
        approved_by: {
          user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          full_name: String,
          avatar: String,
          role: String,
        },
        approved_at: Date,
        created_at: { type: Date, default: Date.now },
      },
    ],
    online: { type: Boolean, default: false },

    /* ---------------------------------------------------
       💬 CHAT CÁ NHÂN
    --------------------------------------------------- */
    private_chats: [
      {
        peer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        peer_name: String,
        peer_avatar: String,

        messages: [
          {
            from_me: { type: Boolean, default: false },
            text: String,
            image_urls: { type: [String], default: [] },
            created_at: { type: Date, default: Date.now },
            is_seen: { type: Boolean, default: false },
          },
        ],

        last_message: String,
        last_time: Date,
        unread_count: { type: Number, default: 0 },
      },
    ],
    /* -------------------------------------------------------------
       🟩 OVERTIME (OT)
    ------------------------------------------------------------- */
    overtime_logs: [
      {
        date: {
          type: String, // "2025-12-14"
          required: true,
        },

        start_time: {
          type: String, // "18:30"
          required: false,
        },

        end_time: {
          type: String, // "21:30"
          default: null,
        },

        hours: {
          type: Number, // vẫn giữ để query nhanh
          required: true,
        },

        reason: String,
        evidence_images: [String],

        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },

        admin_note: String,

        approved_by: {
          user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          full_name: String,
          avatar: String,
          role: String,
        },

        approved_at: Date,
        created_at: { type: Date, default: Date.now },
      },
    ],

  },
  { timestamps: true }
);

// UNIQUE employee_code + company_id
userSchema.index({ employee_code: 1, company_id: 1 }, { unique: true });

// Hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (rawPassword) {
  return bcrypt.compare(rawPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
