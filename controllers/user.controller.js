const User = require("../models/user.model");
const { ok, err } = require("../utils/response");
const crypto = require("crypto");
const mailer = require("../services/MailFacade"); // chỉnh path theo project của bạn
module.exports = {
  // ===================== GET ALL USERS =====================
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find({ record_status: 1 })
        .select("-password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status",
          populate: {
            path: "subscription_plan",
            model: "SubscriptionPlan",
          },
        });

      return ok(res, { users });
    } catch (e) {
      console.error("getAllUsers error:", e);
      return err(res, 400, e?.message || "Get users failed");
    }
  },

  // ===================== GET USER BY ID =====================
  getUserById: async (req, res) => {
    try {
      const user = await User.findOne({
        _id: req.params.id,
        record_status: 1,
      })
        .select("-password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status",
          populate: {
            path: "subscription_plan",
            model: "SubscriptionPlan",
          },
        });

      if (!user) return err(res, 404, "User not found");

      const userObj = user.toObject();
      const company = userObj.company_id || null;

      return ok(res, {
        user: {
          ...userObj,
          subscription_plan: company?.subscription_plan || null,
          subscription_status: company?.subscription_status || "unactive",
        },
      });
    } catch (e) {
      console.error("getUserById error:", e);
      return err(res, 400, e?.message || "Get user failed");
    }
  },

  // ===================== GET ME (CURRENT USER) =====================
  getMe: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return err(res, 401, "Unauthorized");

      const user = await User.findOne({
        _id: userId,
        record_status: 1,
      })
        .select("-password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status",
          populate: {
            path: "subscription_plan",
            model: "SubscriptionPlan",
          },
        });

      if (!user) return err(res, 404, "User not found");

      const userObj = user.toObject();
      const company = userObj.company_id || null;

      return ok(res, {
        user: {
          ...userObj,
          subscription_plan: company?.subscription_plan || null,
          subscription_status: company?.subscription_status || "unactive",
        },
      });
    } catch (e) {
      console.error("getMe error:", e);
      return err(res, 400, e?.message || "Get me failed");
    }
  },

  // ===================== UPDATE USER (ADMIN) =====================
  updateUser: async (req, res) => {
    try {
      const updated = await User.findOneAndUpdate(
        { _id: req.params.id, record_status: 1 },
        req.body,
        { new: true }
      )
        .select("-password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status",
          populate: {
            path: "subscription_plan",
            model: "SubscriptionPlan",
          },
        });

      if (!updated) return err(res, 404, "User not found");

      const userObj = updated.toObject();
      const company = userObj.company_id || null;

      return ok(
        res,
        {
          user: {
            ...userObj,
            subscription_plan: company?.subscription_plan || null,
            subscription_status: company?.subscription_status || "unactive",
          },
        },
        "Update user success"
      );
    } catch (e) {
      console.error("updateUser error:", e);
      return err(res, 400, e?.message || "Update user failed");
    }
  },

  // ===================== DELETE USER =====================
  deleteUser: async (req, res) => {
    try {
      const deleted = await User.findOneAndUpdate(
        { _id: req.params.id, record_status: 1 },
        { record_status: 0 },
        { new: true }
      ).select("-password");

      if (!deleted) return err(res, 404, "User not found");

      return ok(res, { user: deleted }, "Deleted");
    } catch (e) {
      console.error("deleteUser error:", e);
      return err(res, 400, e?.message || "Delete user failed");
    }
  },

createUserByAdmin: async (req, res) => {
  try {
    const {
      full_name,
      job_title,
      department_id,
      email,
      employee_code,
      isAdmin,     // ⭐ NHẬN TỪ FE
    } = req.body;

    // -------- VALIDATION --------
    if (!full_name || !email) {
      return err(res, 400, "Họ tên và email là bắt buộc");
    }

    if (!employee_code) {
      return err(res, 400, "Mã nhân viên là bắt buộc");
    }

    // Check email tồn tại
    const existedEmail = await User.findOne({ email, record_status: 1 });
    if (existedEmail) {
      return err(res, 400, "Email đã tồn tại trong hệ thống");
    }

    // Check employee_code
    const existedCode = await User.findOne({ employee_code, record_status: 1 });
    if (existedCode) {
      return err(res, 400, "Mã nhân viên đã tồn tại");
    }

    // Lấy công ty của admin hiện tại
    const admin = await User.findById(req.user.id).select("company_id email");
    if (!admin || !admin.company_id) {
      return err(res, 400, "Admin chưa thuộc công ty nên không thể tạo nhân viên");
    }

    // -------- HANDLE ROLE + JOB TITLE --------
    let finalRole = "user";
    let finalJobTitle = job_title || "";
    let finalDepartmentId = department_id || null;

    if (isAdmin === true) {
      finalRole = "admin";          // ⭐ SET ROLE ADMIN
      finalJobTitle = "admin";      // ⭐ JOBTITLE ADMIN
      finalDepartmentId = null;     // ⭐ ADMIN không thuộc phòng ban
    }

    // -------- RANDOM PASSWORD --------
    const rawPassword = crypto.randomBytes(6).toString("base64");

    // -------- TẠO USER --------
    const newUser = await User.create({
      email,
      password: rawPassword,
      full_name,
      employee_code,
      job_title: finalJobTitle,
      department_id: finalDepartmentId,
      company_id: admin.company_id,

      is_active: true,
      is_verified: true,
      verification_code: null,
      verification_expires: null,
      profile_approved: false,

      role: finalRole,      // ⭐ ROLE SAU KHI XỬ LÝ
    });

    // Lưu old password hash
    newUser.old_password = newUser.password;
    await newUser.save();

    // -------- SEND MAIL --------
    try {
      await mailer.sendMail({
        toList: [email],
        subject: "Tài khoản nhân viên đã được tạo",
        html: `
          <p>Xin chào <b>${full_name}</b>,</p>
          <p>Tài khoản của bạn đã được tạo thành công.</p>
          <p><b>Email đăng nhập:</b> ${email}</p>
          <p><b>Mã nhân viên:</b> ${employee_code}</p>
          <p><b>Vai trò:</b> ${finalRole.toUpperCase()}</p>
          <p><b>Mật khẩu:</b> ${rawPassword}</p>
          <p>Vui lòng đăng nhập và đổi mật khẩu ngay lần đầu sử dụng.</p>
        `,
      });
    } catch (mailErr) {
      console.error("Lỗi gửi email khi tạo nhân viên:", mailErr);
    }

    const userObj = newUser.toObject();
    delete userObj.password;

    return ok(res, { user: userObj }, "Tạo nhân viên thành công");
  } catch (e) {
    console.error("Lỗi createUserByAdmin:", e);
    return err(res, 400, e?.message || "Không thể tạo nhân viên");
  }
},


 // ===================== GET USERS BY COMPANY =====================
getUsersByCompany: async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id).select("company_id");

    if (!currentUser || !currentUser.company_id) {
      return err(res, 400, "Không xác định được công ty của người dùng");
    }

    const companyId = currentUser.company_id;

    // -----------------------------------------
    // 1️⃣ LẤY DATA ĐẦY ĐỦ ĐỂ KIỂM TRA PASSWORD
    // -----------------------------------------
    const usersWithPassword = await User.find({
      company_id: companyId,
      record_status: 1,
    })
      .select("+password +old_password")    // ⭐ LẤY HASH BÊN TRONG BACKEND
      .lean();

    // -----------------------------------------
    // 2️⃣ LẤY DATA TRẢ VỀ CLIENT (KHÔNG PASSWORD)
    // -----------------------------------------
    let users = await User.find({
      company_id: companyId,
      record_status: 1,
    })
      .select("-password -old_password")    // ⭐ KHÔNG TRẢ RA CLIENT
      .populate({ path: "department_id", select: "name department_code" })
      .populate({ path: "manager_id", select: "full_name email" })
      .lean();

    // -----------------------------------------
    // 3️⃣ GHÉP 2 DANH SÁCH ĐỂ LẤY passwordChangeStatus
    // -----------------------------------------
    users = users.map((u) => {
      const full = usersWithPassword.find(x => String(x._id) === String(u._id));

      let pwdStatus = "waiting_for_password_change";

      if (full?.old_password && full?.password !== full.old_password) {
        pwdStatus = "password_changed";
      }

      return {
        ...u,
        passwordChangeStatus: pwdStatus,
      };
    });

    return ok(res, { users }, "Lấy danh sách nhân viên theo công ty thành công");
  } catch (e) {
    console.error("Lỗi getUsersByCompany:", e);
    return err(res, 400, e?.message || "Không thể lấy danh sách nhân viên");
  }
},



  // ===================== SELF UPDATE (USER) =====================
  updateMyProfile: async (req, res) => {
    try {
      const allowed = [
        "full_name",
        "phone_number",
        "gender",
        "date_of_birth",
        "country_code",
        "state_code",
        "city_name",
        "full_address",
        "avatar",
        "face_image",
      ];

      const updates = {};

      allowed.forEach((key) => {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      });

      // trạng thái duyệt = fail khi user tự sửa
      updates.profile_approved = false;


      const updated = await User.findByIdAndUpdate(req.user.id, updates, {
        new: true,
      }).select("-password");

      return ok(res, { user: updated }, "Profile updated");
    } catch (err) {
      console.error("updateMyProfile error:", err);
      return err(res, 400, err.message || "Update profile failed");
    }
  },

  
};
