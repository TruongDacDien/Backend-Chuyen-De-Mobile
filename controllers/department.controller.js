// controllers/department.controller.js
const Department = require("../models/department.model");
const User = require("../models/user.model");

module.exports = {
  // ===========================
  // CREATE DEPARTMENT
  // ===========================
  createDepartment: async (req, res) => {
    try {
      const {
        name,
        department_code,
        manager_id,
        users = [],
        description,
      } = req.body;

      if (!name || !department_code) {
        return res
          .status(400)
          .json({ error: "Tên và mã phòng ban là bắt buộc" });
      }

      // Check mã phòng ban trùng
      const exists = await Department.findOne({
        department_code,
        record_status: 1,
      });
      if (exists) {
        return res.status(400).json({ error: "Mã phòng ban đã tồn tại" });
      }

      // 1) Tạo phòng ban
      const dept = await Department.create({
        name,
        department_code,
        manager_id: manager_id || null,
        users,
        description,
      });

      // 2) Gán user vào phòng ban
      if (Array.isArray(users) && users.length > 0) {
        await User.updateMany(
          { _id: { $in: users } },
          { department_id: dept._id }
        );
      }

      // 3) Gán trưởng phòng
      if (manager_id) {
        await User.findByIdAndUpdate(manager_id, {
          department_id: dept._id,
          manager_id: null,
        });
      }

      return res.json({
        success: true,
        message: "Tạo phòng ban thành công",
        data: dept,
      });
    } catch (err) {
      console.error("CreateDept Error:", err);
      return res.status(400).json({ error: err.message });
    }
  },

  // ===========================
  // GET ALL DEPARTMENTS
  // ===========================
  getAllDepartments: async (req, res) => {
    try {
      const list = await Department.find({ record_status: 1 })
        .populate("manager_id", "full_name email employee_code avatar")
        .populate("users", "full_name email employee_code avatar job_title");

      return res.json({
        success: true,
        data: list,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // ===========================
  // ⭐ GET DEPARTMENT DETAIL
  // ===========================
  getDepartmentDetail: async (req, res) => {
    try {
      const { id } = req.params;

      const dept = await Department.findById(id)
        .populate("manager_id", "full_name email employee_code avatar")
        .populate("users", "full_name email employee_code avatar job_title");

      if (!dept) {
        return res.status(404).json({
          success: false,
          message: "Department not found",
        });
      }

      return res.json({
        success: true,
        data: dept,
      });
    } catch (error) {
      console.error("Get department detail error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },

  // ===========================
  // UPDATE DEPARTMENT
  // ===========================
updateDepartment: async (req, res) => {
  try {
    console.log("==== [UPDATE DEPARTMENT] START ====");
    console.log("Params id:", req.params.id);
    console.log("Body:", req.body);

    const { name, department_code, manager_id, users, description } = req.body;

    const dept = await Department.findById(req.params.id);
    if (!dept) {
      console.log("❌ Dept not found");
      return res.status(404).json({ error: "Không tìm thấy phòng ban" });
    }

    console.log("✅ Found dept before update:", {
      id: dept._id.toString(),
      name: dept.name,
      department_code: dept.department_code,
      manager_id: dept.manager_id?.toString?.() || null,
      users: dept.users.map((u) => u.toString()),
    });

    // Update thông tin cơ bản
    if (name) console.log("➡️ Update name:", dept.name, "=>", name);
    if (department_code)
      console.log(
        "➡️ Update department_code:",
        dept.department_code,
        "=>",
        department_code
      );
    if (manager_id)
      console.log(
        "➡️ Update manager_id:",
        dept.manager_id?.toString?.() || null,
        "=>",
        manager_id
      );
    if (description)
      console.log("➡️ Update description:", dept.description, "=>", description);

    dept.name = name ?? dept.name;
    dept.department_code = department_code ?? dept.department_code;
    dept.manager_id = manager_id ?? dept.manager_id;
    dept.description = description ?? dept.description;

    const oldUsers = dept.users.map((id) => id.toString());
    const newUsers = Array.isArray(users) ? users : oldUsers;

    console.log("👥 oldUsers:", oldUsers);
    console.log("👥 newUsers (from body or old):", newUsers);

    dept.users = newUsers;
    await dept.save();
    console.log("💾 Dept saved with new users");

    // User bị remove phòng ban
    const removedUsers = oldUsers.filter((u) => !newUsers.includes(u));
    console.log("🧹 removedUsers:", removedUsers);

    if (removedUsers.length > 0) {
      const result = await User.updateMany(
        { _id: { $in: removedUsers } },
        { department_id: null }
      );
      console.log("🧹 updateMany removedUsers result:", result);
    }

    // User mới được add vào phòng ban
    const addedUsers = newUsers.filter((u) => !oldUsers.includes(u));
    console.log("➕ addedUsers:", addedUsers);

    if (addedUsers.length > 0) {
      const result = await User.updateMany(
        { _id: { $in: addedUsers } },
        { department_id: dept._id }
      );
      console.log("➕ updateMany addedUsers result:", result);
    }

    // Cập nhật trưởng phòng
    if (manager_id) {
      console.log("👑 Update manager user:", manager_id);
      const result = await User.findByIdAndUpdate(manager_id, {
        department_id: dept._id,
        manager_id: null,
      });
      console.log("👑 Manager user after update:", result?._id?.toString?.());
    } else {
      console.log("👑 manager_id không truyền lên, bỏ qua cập nhật trưởng phòng");
    }

    console.log("==== [UPDATE DEPARTMENT] DONE ====");

    return res.json({
      success: true,
      message: "Cập nhật phòng ban thành công",
      data: dept,
    });
  } catch (err) {
    console.error("🔥 [UPDATE DEPARTMENT] ERROR:", err);
    return res.status(400).json({ error: err.message });
  }
},

  // ===========================
  // DELETE DEPARTMENT
  // ===========================
  deleteDepartment: async (req, res) => {
    try {
      const dept = await Department.findById(req.params.id);
      if (!dept)
        return res.status(404).json({ error: "Không tìm thấy phòng ban" });

      dept.record_status = 0;
      await dept.save();

      // Remove department khỏi user
      await User.updateMany(
        { department_id: dept._id },
        { department_id: null }
      );

      return res.json({
        success: true,
        message: "Xóa phòng ban thành công",
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
