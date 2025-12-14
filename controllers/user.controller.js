const User = require("../models/user.model");
const { ok, err } = require("../utils/response");
const crypto = require("crypto");
const mailer = require("../services/MailFacade"); // chỉnh path theo project của bạn
const Company = require("../models/company.model");
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
      // Các field cho phép cập nhật
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
        "face_image",   // ảnh chính diện
        "face_image2",  // ảnh nghiêng trái
        "face_image3",  // ảnh nghiêng phải
        "face_id",      // vector embedding 512-D (string hoặc JSON)
      ];

      const updates = {};

      allowed.forEach((key) => {
        if (req.body[key] !== undefined && req.body[key] !== null) {
          updates[key] = req.body[key];
        }
      });

      // Khi user tự cập nhật → phải duyệt lại
      updates.profile_approved = false;

      const updated = await User.findByIdAndUpdate(req.user.id, updates, {
        new: true,
      }).select("-password");

      return ok(res, { user: updated }, "Profile updated successfully");
    } catch (err) {
      console.error("updateMyProfile error:", err);
      return err(res, 400, err.message || "Update profile failed");
    }
  },

  approveUserProfile: async (req, res) => {
    try {
      const admin = await User.findById(req.user.id).select("company_id");
      if (!admin || !admin.company_id)
        return err(res, 403, "Bạn không thuộc công ty nào");

      const { status } = req.body; // "approved" | "rejected"
      if (!["approved", "rejected"].includes(status)) {
        return err(res, 400, "Trạng thái không hợp lệ");
      }

      const user = await User.findOne({
        _id: req.params.id,
        company_id: admin.company_id,
        record_status: 1,
      });

      if (!user) return err(res, 404, "User không tồn tại trong công ty bạn");

      user.profile_approved = status === "approved";
      await user.save();

      return ok(res, { user }, "Cập nhật trạng thái profile thành công");
    } catch (e) {
      console.error("approveUserProfile:", e);
      return err(res, 400, "Không thể cập nhật trạng thái profile");
    }
  },
  updateUserStatus: async (req, res) => {
    try {
      const admin = await User.findById(req.user.id).select("company_id");

      if (!admin || !admin.company_id)
        return err(res, 403, "Bạn không thuộc công ty nào");

      const { is_active } = req.body;

      const user = await User.findOneAndUpdate(
        {
          _id: req.params.id,
          company_id: admin.company_id,
          record_status: 1,
        },
        { is_active },
        { new: true }
      ).select("-password");

      if (!user)
        return err(res, 404, "User không tồn tại trong công ty bạn");

      return ok(res, { user }, "Cập nhật trạng thái user thành công");
    } catch (e) {
      console.error("updateUserStatus:", e);
      return err(res, 400, "Không thể cập nhật trạng thái user");
    }
  },
  updateUserByCompanyAdmin: async (req, res) => {
    try {
      const admin = await User.findById(req.user.id).select("company_id");

      if (!admin || !admin.company_id)
        return err(res, 403, "Không xác định được công ty của bạn");

      const allowedFields = [
        "full_name",
        "phone_number",
        "gender",
        "date_of_birth",
        "job_title",
        "department_id",
        "manager_id",
        "city_name",
        "full_address",
        "salary",
        "avatar",
      ];

      const updates = {};
      allowedFields.forEach(f => {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      });

      const updated = await User.findOneAndUpdate(
        {
          _id: req.params.id,
          company_id: admin.company_id,
          record_status: 1,
        },
        updates,
        { new: true }
      ).select("-password");

      if (!updated)
        return err(res, 404, "User không tồn tại trong công ty bạn");

      return ok(res, { user: updated }, "Update user thành công");
    } catch (e) {
      console.error("updateUserByCompanyAdmin:", e);
      return err(res, 400, "Không thể update user");
    }
  },
  getUserDetailByCompanyAdmin: async (req, res) => {
    try {
      const admin = await User.findById(req.user.id).select("company_id");

      if (!admin || !admin.company_id)
        return err(res, 403, "Bạn không thuộc công ty nào");

      const user = await User.findOne({
        _id: req.params.id,
        company_id: admin.company_id,
        record_status: 1,
      })
        .select("-password -old_password")
        .populate("department_id", "name department_code")
        .populate("manager_id", "full_name email");

      if (!user)
        return err(res, 404, "User không tồn tại trong công ty bạn");

      return ok(res, { user }, "Lấy thông tin nhân viên thành công");
    } catch (e) {
      console.error("getUserDetailByCompanyAdmin:", e);
      return err(res, 400, "Không thể lấy thông tin user");
    }
  },

};


// Haversine distance
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports.locationCheck = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) return err(res, 400, "Thiếu tọa độ");

    const user = await User.findById(req.user.id).select("company_id");

    if (!user || !user.company_id)
      return err(res, 400, "User chưa thuộc công ty nào");

    const company = await Company.findById(user.company_id).select(
      "checkin_location checkin_radius"
    );

    if (!company || !company.checkin_location)
      return err(res, 400, "Công ty chưa cấu hình điểm check-in");

    const { lat: officeLat, lng: officeLng } = company.checkin_location;
    const radius = company.checkin_radius ?? 100;

    const dist = distanceMeters(lat, lng, officeLat, officeLng);

    if (dist > radius) {
      return ok(res, {
        allowed: false,
        distance: dist,
        required_radius: radius,
      });
    }

    // Create 2-minute session token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 2 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      location_session_token: token,
      location_session_expires: expires,
    });

    return ok(res, {
      allowed: true,
      token,
      expires_at: expires,
      distance: dist,
    });
  } catch (e) {
    console.error(e);
    return err(res, 500, e.message);
  }
};

// Cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports.checkAttendance = async (req, res) => {
  try {
    const { type, face_id, image } = req.body;

    if (!["check_in", "check_out"].includes(type))
      return err(res, 400, "Loại check không hợp lệ");

    const user = await User.findById(req.user.id).select(
      "+face_id +location_session_token +location_session_expires"
    );

    if (!user) return err(res, 404, "Không tìm thấy user");
    if (!user.face_id) return err(res, 400, "User chưa đăng ký FaceID");

    // Check location token
    if (
      !user.location_session_token ||
      !user.location_session_expires ||
      user.location_session_expires < new Date()
    ) {
      return err(res, 403, "Bạn chưa xác thực vị trí");
    }

    // FACE VERIFY
    const dbVec = JSON.parse(user.face_id);
    const sim = cosineSimilarity(dbVec, face_id);

    if (sim < 0.45)
      return err(res, 400, `Face không khớp (sim=${sim.toFixed(2)})`);

    // Attendance logic
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);

    let logs = user.attendance_logs || [];
    let todayLog = logs.find((l) => l.date === today);

    // CHECK IN
    if (type === "check_in") {
      if (todayLog?.check_in_time)
        return err(res, 400, "Hôm nay đã check-in rồi");

      logs.push({
        date: today,
        check_in_time: time,
        check_in_image: image,
        created_at: now,
      });
    }

    // CHECK OUT
    if (type === "check_out") {
      if (!todayLog?.check_in_time)
        return err(res, 400, "Chưa check-in hôm nay");

      if (todayLog.check_out_time)
        return err(res, 400, "Đã check-out rồi");

      todayLog.check_out_time = time;
      todayLog.check_out_image = image;

      // Tính giờ
      const start = new Date(`${today}T${todayLog.check_in_time}:00`);
      const end = new Date(`${today}T${time}:00`);
      const hours = (end - start) / (1000 * 60 * 60);

      todayLog.total_hours = Math.round(hours * 100) / 100;
    }

    // Clear location session
    user.location_session_token = null;
    user.location_session_expires = null;

    user.attendance_logs = logs;
    await user.save();

    return ok(res, {
      success: true,
      type,
      similarity: sim,
      log: todayLog || logs.at(-1),
    });
  } catch (e) {
    console.error(e);
    return err(res, 500, e.message);
  }
};

/* =========================
   Helpers
========================= */
function parseDateStr(d) {
  // d: "YYYY-MM-DD"
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function toDateStr(dt) {
  return dt.toISOString().slice(0, 10);
}

function addDaysUTC(dt, days) {
  const x = new Date(dt);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function weekdayKeyUTC(dt) {
  // JS: 0=Sun..6=Sat -> map to keys used by your config
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[dt.getUTCDay()];
}

function enumerateDatesInclusive(startStr, endStr) {
  const start = parseDateStr(startStr);
  const end = parseDateStr(endStr);
  if (end < start) return [];
  const out = [];
  for (let d = start; d <= end; d = addDaysUTC(d, 1)) out.push(toDateStr(d));
  return out;
}

function countWorkingDays(dateStrList, config) {
  const workingDays = config?.working_hours?.working_days || [
    "mon", "tue", "wed", "thu", "fri", "sat",
  ];
  const holidays = new Set(config?.working_hours?.company_holidays || []);

  let count = 0;
  for (const ds of dateStrList) {
    if (holidays.has(ds)) continue;
    const wk = weekdayKeyUTC(parseDateStr(ds));
    if (!workingDays.includes(wk)) continue;
    count += 1;
  }
  return count;
}

function sumApprovedAnnualDays(user, config) {
  // sum approved annual leave working-days (respect holidays & working_days)
  const approvedAnnual = (user.leave_requests || []).filter(
    (r) => r.type === "annual" && r.status === "approved"
  );

  let total = 0;
  for (const r of approvedAnnual) {
    const dates = enumerateDatesInclusive(r.start_date, r.end_date);
    total += countWorkingDays(dates, config);
  }
  return total;
}

function hasOverlapPendingOrApproved(user, start_date, end_date) {
  const newDates = new Set(enumerateDatesInclusive(start_date, end_date));
  const existing = (user.leave_requests || []).filter(
    (r) => r.status === "pending" || r.status === "approved"
  );

  for (const r of existing) {
    const dates = enumerateDatesInclusive(r.start_date, r.end_date);
    for (const d of dates) {
      if (newDates.has(d)) return true;
    }
  }
  return false;
}

/* =========================================================
   USER: LEAVE
========================================================= */

// POST /api/requests/leave
module.exports.createLeaveRequest = async (req, res) => {
  try {
    const { type, start_date, end_date, reason = "", evidence_images = [] } = req.body;

    if (!type || !start_date || !end_date) {
      return err(res, 400, "Thiếu type/start_date/end_date");
    }
    if (!["annual", "sick", "unpaid"].includes(type)) {
      return err(res, 400, "Loại nghỉ không hợp lệ");
    }

    const user = await User.findById(req.user.id).select("company_id leave_requests record_status");
    if (!user || user.record_status !== 1) return err(res, 404, "User không tồn tại");

    if (!user.company_id) return err(res, 400, "User chưa thuộc công ty");

    const company = await Company.findById(user.company_id).select("attendance_config");
    if (!company?.attendance_config) return err(res, 400, "Company chưa cấu hình attendance");

    const config = company.attendance_config;

    // validate range & working days count
    const dates = enumerateDatesInclusive(start_date, end_date);
    if (dates.length === 0) return err(res, 400, "Khoảng ngày không hợp lệ");

    const reqWorkingDays = countWorkingDays(dates, config);
    if (reqWorkingDays <= 0) {
      return err(res, 400, "Khoảng ngày này không có ngày làm việc hợp lệ (vướng holiday/offday)");
    }

    // prevent overlap
    if (hasOverlapPendingOrApproved(user, start_date, end_date)) {
      return err(res, 400, "Khoảng ngày xin nghỉ bị trùng với đơn pending/approved khác");
    }

    // annual quota check
    if (type === "annual") {
      const maxDays = Number(config?.leave_policy?.annual_leave_days || 0);
      const used = sumApprovedAnnualDays(user, config);
      const remaining = Math.max(0, maxDays - used);

      if (reqWorkingDays > remaining) {
        return err(
          res,
          400,
          `Hết/không đủ phép năm (còn ${remaining} ngày làm việc). Hãy chọn nghỉ không lương (unpaid).`
        );
      }
    }

    user.leave_requests.push({
      type,
      start_date,
      end_date,
      reason,
      evidence_images,
      status: "pending",
      admin_note: "",
      created_at: new Date(),
    });

    await user.save();
    return ok(res, {}, "Tạo phiếu nghỉ phép thành công");
  } catch (e) {
    console.error("createLeaveRequest:", e);
    return err(res, 500, e?.message || "Create leave failed");
  }
};

// GET /api/requests/leave/me
module.exports.getMyLeaveRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("leave_requests record_status");
    if (!user || user.record_status !== 1) return err(res, 404, "User không tồn tại");

    // sort newest first
    const items = (user.leave_requests || []).slice().sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return ok(res, { leave_requests: items });
  } catch (e) {
    console.error("getMyLeaveRequests:", e);
    return err(res, 500, e?.message || "Get leave requests failed");
  }
};
/* =========================================================
   USER: CREATE OVERTIME REQUEST
========================================================= */
module.exports.createOvertimeRequest = async (req, res) => {
  try {
    const {
      date,
      start_time = null, // ✅ NEW
      hours,
      reason = "",
      evidence_images = [],
    } = req.body;

    /* ===== VALIDATE ===== */
    if (!date || hours === undefined) {
      return err(res, 400, "Thiếu date/hours");
    }

    const hrs = Number(hours);
    if (!Number.isFinite(hrs) || hrs <= 0) {
      return err(res, 400, "hours không hợp lệ");
    }

    if (start_time && !/^\d{2}:\d{2}$/.test(start_time)) {
      return err(res, 400, "start_time không đúng định dạng HH:mm");
    }

    /* ===== GET USER ===== */
    const user = await User.findById(req.user.id).select(
      "company_id overtime_logs record_status"
    );
    if (!user || user.record_status !== 1) {
      return err(res, 404, "User không tồn tại");
    }
    if (!user.company_id) {
      return err(res, 400, "User chưa thuộc công ty");
    }

    /* ===== GET COMPANY CONFIG ===== */
    const company = await Company.findById(user.company_id).select(
      "attendance_config"
    );
    const config = company?.attendance_config;
    if (!config) {
      return err(res, 400, "Company chưa cấu hình attendance");
    }

    /* ===== POLICY: MIN OT ===== */
    const minMinutes = Number(config?.overtime_policy?.min_ot_minutes || 0);
    if (hrs * 60 < minMinutes) {
      return err(res, 400, `OT tối thiểu ${minMinutes} phút`);
    }

    /* ===== BLOCK DUPLICATE DATE ===== */
    const existed = (user.overtime_logs || []).some(
      (o) =>
        o.date === date &&
        (o.status === "pending" || o.status === "approved")
    );
    if (existed) {
      return err(res, 400, "Đã có phiếu OT cho ngày này");
    }

    /* ===== PUSH OT ===== */
    user.overtime_logs.push({
      date,
      start_time, // ✅ LƯU START TIME
      hours: hrs,
      reason,
      evidence_images,

      status: "pending",
      admin_note: "",

      approved_by: {
        user_id: null,
        full_name: null,
        avatar: null,
        role: null,
      },

      approved_at: null,
      created_at: new Date(),
    });

    await user.save();
    return ok(res, {}, "Tạo phiếu OT thành công");
  } catch (e) {
    console.error("createOvertimeRequest:", e);
    return err(res, 500, e?.message || "Create overtime failed");
  }
};

/* =========================================================
   USER: GET MY OVERTIME REQUESTS
========================================================= */
module.exports.getMyOvertimeRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "overtime_logs record_status"
    );
    if (!user || user.record_status !== 1) {
      return err(res, 404, "User không tồn tại");
    }

    const items = (user.overtime_logs || [])
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return ok(res, { overtime_logs: items });
  } catch (e) {
    console.error("getMyOvertimeRequests:", e);
    return err(res, 500, e?.message || "Get overtime logs failed");
  }
};

/* =========================================================
   ADMIN: LIST PENDING REQUESTS
========================================================= */
module.exports.adminGetPendingRequests = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select(
      "company_id role record_status"
    );
    if (!admin || admin.record_status !== 1) {
      return err(res, 404, "Admin không tồn tại");
    }
    if (!admin.company_id) {
      return err(res, 403, "Bạn không thuộc công ty nào");
    }

    const type = req.query.type || "all";

    const users = await User.find({
      company_id: admin.company_id,
      record_status: 1,
    })
      .select("full_name email employee_code leave_requests overtime_logs")
      .lean();

    const leave = [];
    const overtime = [];

    for (const u of users) {
      if (type === "all" || type === "leave") {
        for (const r of u.leave_requests || []) {
          if (r.status === "pending") {
            leave.push({
              user_id: u._id,
              full_name: u.full_name,
              email: u.email,
              employee_code: u.employee_code,
              request: r,
            });
          }
        }
      }

      if (type === "all" || type === "overtime") {
        for (const o of u.overtime_logs || []) {
          if (o.status === "pending") {
            overtime.push({
              user_id: u._id,
              full_name: u.full_name,
              email: u.email,
              employee_code: u.employee_code,
              request: o,
            });
          }
        }
      }
    }

    leave.sort(
      (a, b) => new Date(b.request.created_at) - new Date(a.request.created_at)
    );
    overtime.sort(
      (a, b) => new Date(b.request.created_at) - new Date(a.request.created_at)
    );

    return ok(res, {
      pending_leave: leave,
      pending_overtime: overtime,
    });
  } catch (e) {
    console.error("adminGetPendingRequests:", e);
    return err(res, 500, e?.message || "Get pending requests failed");
  }
};

/* =========================================================
   ADMIN: APPROVE / REJECT OVERTIME
========================================================= */
module.exports.adminDecideOvertimeRequest = async (req, res) => {
  try {
    const { userId, otId } = req.params;
    const { status, admin_note = "" } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return err(res, 400, "status không hợp lệ");
    }

    const admin = await User.findById(req.user.id).select(
      "company_id full_name avatar role record_status"
    );
    if (!admin || admin.record_status !== 1) {
      return err(res, 404, "Admin không tồn tại");
    }
    if (!admin.company_id) {
      return err(res, 403, "Bạn không thuộc công ty nào");
    }

    const user = await User.findOne({
      _id: userId,
      company_id: admin.company_id,
      record_status: 1,
    }).select("overtime_logs company_id");

    if (!user) {
      return err(res, 404, "User không tồn tại trong công ty bạn");
    }

    const company = await Company.findById(user.company_id).select(
      "attendance_config"
    );
    const config = company?.attendance_config;
    if (!config) {
      return err(res, 400, "Company chưa cấu hình attendance");
    }

    const ot = user.overtime_logs.id(otId);
    if (!ot) {
      return err(res, 404, "Phiếu OT không tồn tại");
    }

    if (ot.status !== "pending") {
      return err(res, 400, "Phiếu OT đã được xử lý");
    }

    const minMinutes = Number(config?.overtime_policy?.min_ot_minutes || 0);
    if (status === "approved" && ot.hours * 60 < minMinutes) {
      return err(res, 400, `OT tối thiểu ${minMinutes} phút`);
    }

    ot.status = status;
    ot.admin_note = admin_note;
    ot.approved_at = new Date();
    ot.approved_by = {
      user_id: admin._id,
      full_name: admin.full_name,
      avatar: admin.avatar,
      role: admin.role,
    };

    await user.save();
    return ok(res, {}, "Cập nhật phiếu OT thành công");
  } catch (e) {
    console.error("adminDecideOvertimeRequest:", e);
    return err(res, 500, e?.message || "Decide overtime failed");
  }
};
module.exports.adminGetAllOvertimeRequests = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select(
      "company_id record_status"
    );

    if (!admin || admin.record_status !== 1)
      return err(res, 404, "Admin không tồn tại");

    if (!admin.company_id)
      return err(res, 403, "Bạn không thuộc công ty nào");

    const statusFilter = req.query.status || "all";

    const users = await User.find({
      company_id: admin.company_id,
      record_status: 1,
    })
      .select(
        `
        full_name
        email
        employee_code
        avatar
        job_title
        role
        department_id
        overtime_logs
        `
      )
      .populate("department_id", "name department_code")
      .lean();

    const result = [];

    for (const u of users) {
      for (const ot of u.overtime_logs || []) {
        if (statusFilter !== "all" && ot.status !== statusFilter) continue;

        result.push({
          /* ================= USER INFO ================= */
          user: {
            user_id: u._id,
            full_name: u.full_name,
            email: u.email,
            employee_code: u.employee_code,
            avatar: u.avatar || null,
            job_title: u.job_title || null,
            role: u.role,
            department: u.department_id
              ? {
                  id: u.department_id._id,
                  name: u.department_id.name,
                  code: u.department_id.department_code,
                }
              : null,
          },

          /* ================= OT INFO ================= */
          ot: {
            ot_id: ot._id,
            date: ot.date,
            start_time: ot.start_time || null,
            hours: ot.hours,
            reason: ot.reason,
            evidence_images: ot.evidence_images || [],

            status: ot.status,
            admin_note: ot.admin_note || "",

            approved_by: ot.approved_by
              ? {
                  user_id: ot.approved_by.user_id,
                  full_name: ot.approved_by.full_name,
                  avatar: ot.approved_by.avatar,
                  role: ot.approved_by.role,
                }
              : null,

            approved_at: ot.approved_at,
            created_at: ot.created_at,
          },
        });
      }
    }

    // newest first
    result.sort(
      (a, b) => new Date(b.ot.created_at) - new Date(a.ot.created_at)
    );

    return ok(res, {
      overtime_requests: result,
      total: result.length,
    });
  } catch (e) {
    console.error("adminGetAllOvertimeRequests:", e);
    return err(res, 500, e?.message || "Get all overtime failed");
  }
};
