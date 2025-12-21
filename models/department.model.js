const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    group_chats: [
      {
        title: { type: String, default: "" },
        messages: [
          {
            sender_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            sender_name: String,
            sender_avatar: String,
            text: String,
            image_urls: { type: [String], default: [] },
            created_at: { type: Date, default: Date.now },
            seen_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
          },
        ],
        last_message: { type: String },
        last_time: { type: Date },
      },
    ],
    department_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    manager_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    description: { type: String },
    record_status: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// ✅ Tự động tạo group chat mặc định khi tạo mới department
departmentSchema.pre("save", function (next) {
  if (this.isNew && (!this.group_chats || this.group_chats.length === 0)) {
    this.group_chats = [
      {
        title: this.name,
        messages: [],
        last_message: "",
        last_time: null,
      },
    ];
  }
  next();
});

const Department = mongoose.model("Department", departmentSchema);
module.exports = Department;
