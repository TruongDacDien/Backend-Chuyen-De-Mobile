// models/department.model.js
const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    manager_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // trưởng phòng
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],    // list user thuộc phòng

    description: { type: String },

    record_status: { type: Number, default: 1 }, // soft delete
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
