const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    full_name: { type: String, required: true },

    role: {
      type: String,
      enum: ["sys_admin", "admin", "user"],
      default: "user",
    },

    // ⬇️ liên kết công ty
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

    face_id: { type: String },
    avatar: { type: String },
    gallery: [{ type: String }],

    // 🔹 verify tài khoản
    is_verified: { type: Boolean, default: false },
    verification_code: { type: String },
    verification_expires: { type: Date },

    // 🔑 quên mật khẩu
    reset_password_code: { type: String, default: null },
    reset_password_expires: { type: Date, default: null },

    record_status: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// so sánh password
userSchema.methods.comparePassword = function (rawPassword) {
  return bcrypt.compare(rawPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
