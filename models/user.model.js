const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },

    // Ẩn luôn
    password: { type: String, required: true, select: false },

    old_password: { type: String, default: null, select: false },

    full_name: { type: String, required: true },

    employee_code: {
      type: String,
      required: false,
      trim: true,
    },

    phone_number: { type: String },
    gender: { type: String, enum: ["male", "female"] },

    date_of_birth: { type: Date },

    country_code: { type: String },
    state_code: { type: String },
    city_name: { type: String },
    full_address: { type: String },

    face_image: { type: String },

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

    record_status: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// KHÔNG TRÙNG employee_code TRONG CÙNG 1 CÔNG TY
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
