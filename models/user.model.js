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
        date: { type: String, required: true }, // ngày chấm công

        // loại khiếu nại
        type: {
          type: String,
          enum: ["check_in", "check_out"],
          required: true,
        },

        // giờ sai
        expected_time: { type: String }, // giờ đúng đáng lẽ
        actual_time: { type: String },   // giờ hệ thống ghi

        // ảnh minh chứng
        evidence_images: [{ type: String }],

        // lý do
        reason_type: {
          type: String,
          enum: ["face_fail", "system_error", "wrong_time", "wrong_user", "other"],
          required: true,
        },

        description: { type: String, default: "" },

        // trạng thái duyệt
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },

        admin_note: { type: String, default: "" },

        created_at: { type: Date, default: Date.now },
      },
    ],

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
        reason: { type: String },
        evidence_images: [{ type: String }],
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        admin_note: { type: String },
        created_at: { type: Date, default: Date.now },
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
