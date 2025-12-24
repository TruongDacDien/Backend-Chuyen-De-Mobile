const Company = require("../models/company.model");
const User = require("../models/user.model");
const moment = require("moment");
module.exports = {
  // CREATE
  createCompany: async (req, res) => {
    try {
      const company = await Company.create(req.body);
      return res.json(company);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // UPDATE
  updateCompany: async (req, res) => {
    try {
      const updated = await Company.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      return res.json(updated);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // DELETE (soft)
  deleteCompany: async (req, res) => {
    try {
      const updated = await Company.findByIdAndUpdate(
        req.params.id,
        { record_status: 0 },
        { new: true }
      );
      return res.json({ message: "Deleted", data: updated });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // GET ALL
  getAllCompanies: async (req, res) => {
    try {
      const companies = await Company.find();
      return res.json(companies);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // GET ONE
  getCompanyById: async (req, res) => {
    try {
      const company = await Company.findById(req.params.id);
      return res.json(company);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // SEARCH tất cả field
  searchCompany: async (req, res) => {
    try {
      const query = req.body;
      query.record_status = 1;

      const results = await Company.find(query);
      return res.json(results);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // PUSH lịch sử plan
  addPlanHistory: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await Company.findByIdAndUpdate(
        id,
        { $push: { plan_history: req.body } },
        { new: true }
      );

      return res.json(updated);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  /* =====================================================
     ⭐ GET CHECK-IN CONFIG (dựa vào công ty trong token)
  ====================================================== */
  getCheckinConfig: async (req, res) => {
    try {
      // ⭐ Lấy user từ DB
      const user = await User.findById(req.user.id).select("company_id");

      if (!user || !user.company_id) {
        return res.status(400).json({ error: "User chưa thuộc công ty nào" });
      }

      const company = await Company.findById(user.company_id).select(
        "checkin_location checkin_radius"
      );

      return res.json(company ?? {});
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  /* =====================================================
     ⭐ UPDATE CHECK-IN CONFIG (admin)
  ====================================================== */
  updateCheckinConfig: async (req, res) => {
    try {
      // ⭐ Lấy user từ DB
      const user = await User.findById(req.user.id).select("company_id");

      if (!user || !user.company_id) {
        return res.status(400).json({ error: "User chưa thuộc công ty nào" });
      }

      const { lat, lng, address, radius } = req.body;

      const updated = await Company.findByIdAndUpdate(
        user.company_id,
        {
          checkin_location: { lat, lng, address },
          checkin_radius: radius,
        },
        { new: true }
      );

      return res.json(updated);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  /* =====================================================
 ⭐ GET ATTENDANCE CONFIG
===================================================== */
  getAttendanceConfig: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select("company_id");

      if (!user || !user.company_id) {
        return res.status(400).json({ error: "User chưa thuộc công ty nào" });
      }

      const company = await Company.findById(user.company_id).select(
        "attendance_config"
      );

      return res.json(company?.attendance_config || {});
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  /* =====================================================
     ⭐ UPDATE ATTENDANCE CONFIG
  ===================================================== */
  updateAttendanceConfig: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select("company_id");

      if (!user || !user.company_id) {
        return res.status(400).json({ error: "User chưa thuộc công ty nào" });
      }

      // req.body EXPECT: { attendance_config: {...} }
      const updated = await Company.findByIdAndUpdate(
        user.company_id,
        { attendance_config: req.body },
        { new: true }
      ).select("attendance_config");

      return res.json(updated.attendance_config);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  /* =====================================================
   ⭐ GET CHECK-IN INFORMATION (USER)
===================================================== */
  getCheckinInfo: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select(
        "company_id attendance_logs full_name checkin_complaints profile_approved"
      );

      if (!user || !user.company_id) {
        return res.status(400).json({ error: "User chưa thuộc công ty nào" });
      }

      const company = await Company.findById(user.company_id).select(
        "checkin_location checkin_radius attendance_config name"
      );

      if (!company) {
        return res.status(404).json({ error: "Company không tồn tại" });
      }

      return res.json({
        company: {
          name: company.name,
          checkin_location: company.checkin_location,
          checkin_radius: company.checkin_radius,
          attendance_config: company.attendance_config,
        },
        user: {
          full_name: user.full_name,
          attendance_logs: user.attendance_logs || [],
          checkin_complaints: user.checkin_complaints || [],
          profile_approved: user.profile_approved ?? false,
        },
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  /* =====================================================
     ⭐ GET MY COMPANY (USER / ADMIN)
     → lấy company theo token
  ===================================================== */
  getMyCompany: async (req, res) => {
    try {
      /* =========================
         1️⃣ LẤY USER HIỆN TẠI (FULL)
      ========================= */
      const user = await User.findById(req.user.id)
        .populate("department_id", "name department_code")
        .lean();

      if (!user || !user.company_id) {
       


          return res.json([]);


      }

      /* =========================
         2️⃣ LẤY COMPANY
      ========================= */
      const company = await Company.findOne({
        _id: user.company_id,
        record_status: 1,
      }).lean();

      if (!company) {
        return res.status(404).json({
          error: "Company không tồn tại",
        });
      }

      /* =========================
         3️⃣ RESPONSE (TRẢ ĐỦ)
      ========================= */
      return res.json({
        company: {
          id: company._id,
          name: company.name,
          code: company.code,
          avatar: company.avatar,
          images: company.images,
          address: company.address,
          contact_email: company.contact_email,
          contact_phone: company.contact_phone,

          subscription_status: company.subscription_status,
          subscription_plan: company.subscription_plan,

          checkin_location: company.checkin_location,
          checkin_radius: company.checkin_radius,

          attendance_config: company.attendance_config,

          created_at: company.created_at,
        },

        // ✅ FULL USER – KHÔNG CẮT GÌ
        user: {
          ...user,
          id: user._id,

          // normalize nhẹ cho FE dễ xài
          department: user.department_id
            ? {
              id: user.department_id._id,
              name: user.department_id.name,
              code: user.department_id.department_code,
            }
            : null,
        },
      });
    } catch (err) {
      console.error("getMyCompany:", err);
      return res.status(500).json({
        error: err.message || "Get my company failed",
      });
    }
  },




};

module.exports.getAttendanceReportByDate = async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) {
      return res.status(400).json({ error: "Missing date" });
    }

    // 1️⃣ Lấy user hiện tại
    const currentUser = await User.findById(req.user.id).select("company_id");
    if (!currentUser?.company_id) {
      return res.status(400).json({ error: "User chưa thuộc công ty nào" });
    }

    // 2️⃣ Lấy config công ty
    const company = await Company.findById(currentUser.company_id).select(
      "attendance_config"
    );

    const workStart = company.attendance_config.working_hours.start_time;
    const workEnd = company.attendance_config.working_hours.end_time;
    const allowLate = Number(
      company.attendance_config.late_rule.allow_minutes
    );

    // 3️⃣ Lấy user trong công ty (❌ LOẠI ADMIN + SYS_ADMIN)
    const users = await User.find({
      company_id: currentUser.company_id,
      record_status: 1,
      is_active: true,
      role: { $nin: ["admin", "sys_admin"] },
    }).select(
      "full_name job_title avatar phone_number email attendance_logs leave_requests role"
    );

    // =====================
    // RESULT
    // =====================
    const result = {
      date,
      stats: {
        worked: 0,
        absent: 0,
        onTime: 0,
        late: 0,
        leaveEarly: 0,
        withPermit: 0,
        withoutPermit: 0,
      },
      lists: {
        onTime: [],
        late: [],
        leaveEarly: [],
        withPermit: [],
        withoutPermit: [],
      },
    };

    // =====================
    // LOOP USER
    // =====================
    for (const user of users) {
      const baseInfo = {
        id: user._id,
        name: user.full_name,
        role: user.job_title,
        avatar: user.avatar,
        phone: user.phone_number || null,
        email: user.email || null,
      };

      // --- 1. Check leave approved ---
      const leave = user.leave_requests?.find(
        (l) =>
          l.status === "approved" &&
          date >= l.start_date &&
          date <= l.end_date
      );

      if (leave) {
        result.stats.withPermit++;
        result.stats.absent++;

        result.lists.withPermit.push({
          ...baseInfo,
          status: `Xin nghỉ (${leave.type})`,
        });
        continue;
      }

      // --- 2. Check attendance log ---
      const log = user.attendance_logs?.find((l) => l.date === date);

      if (!log || !log.check_in_time) {
        result.stats.withoutPermit++;
        result.stats.absent++;

        result.lists.withoutPermit.push({
          ...baseInfo,
          status: "Vắng không phép",
        });
        continue;
      }

      result.stats.worked++;

      // --- 3. Tính phút đi trễ ---
      const lateMinutes = moment(log.check_in_time, "HH:mm").diff(
        moment(workStart, "HH:mm"),
        "minutes"
      );

      // --- 4. Tính về sớm ---
      const earlyMinutes = log.check_out_time
        ? moment(workEnd, "HH:mm").diff(
          moment(log.check_out_time, "HH:mm"),
          "minutes"
        )
        : 0;

      if (lateMinutes > allowLate) {
        result.stats.late++;
        result.lists.late.push({
          ...baseInfo,
          lateCount: lateMinutes,
          latePercent: Math.round((lateMinutes / 480) * 100),
          notePrefix: "Số phút đi trễ:",
        });
      } else if (earlyMinutes > 0) {
        result.stats.leaveEarly++;
        result.lists.leaveEarly.push({
          ...baseInfo,
          lateCount: earlyMinutes,
          latePercent: Math.round((earlyMinutes / 480) * 100),
          notePrefix: "Số phút về sớm:",
        });
      } else {
        result.stats.onTime++;
        result.lists.onTime.push({
          ...baseInfo,
          lateCount: 0,
          latePercent: 0,
          notePrefix: "Số phút đi trễ:",
        });
      }
    }

    return res.json(result);
  } catch (err) {
    console.error("getAttendanceReportByDate", err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports.getAttendanceChart = async (req, res) => {
  try {
    const {
      mode = "month",
      year,
      month,
      week,
      metric = "onTime",
    } = req.query;

    if (!year) {
      return res.status(400).json({ error: "Missing year" });
    }

    const user = await User.findById(req.user.id).select("company_id");
    if (!user?.company_id) {
      return res.status(400).json({ error: "User chưa thuộc công ty nào" });
    }

    const users = await User.find({
      company_id: user.company_id,
      record_status: 1,
      is_active: true,
      role: { $nin: ["admin", "sys_admin"] },
    }).select("attendance_logs leave_requests");

    /* ======================
       HELPERS
    ====================== */
    const isLeaveApproved = (u, date) =>
      u.leave_requests?.some(
        l =>
          l.status === "approved" &&
          date >= l.start_date &&
          date <= l.end_date
      );

    const isLate = (log, allowLate, workStart) =>
      moment(log.check_in_time, "HH:mm").diff(
        moment(workStart, "HH:mm"),
        "minutes"
      ) > allowLate;

    const isEarlyLeave = (log, workEnd) =>
      log.check_out_time &&
      moment(workEnd, "HH:mm").diff(
        moment(log.check_out_time, "HH:mm"),
        "minutes"
      ) > 0;

    /* ======================
       LOAD CONFIG
    ====================== */
    const company = await Company.findById(user.company_id).select(
      "attendance_config"
    );

    const workStart = company.attendance_config.working_hours.start_time;
    const workEnd = company.attendance_config.working_hours.end_time;
    const allowLate = Number(
      company.attendance_config.late_rule.allow_minutes
    );

    /* ======================
       YEAR
    ====================== */
    if (mode === "year") {
      const labels = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
      const data = Array(12).fill(0);

      users.forEach(u => {
        u.attendance_logs.forEach(log => {
          const d = moment(log.date);
          if (d.year() !== Number(year)) return;

          const m = d.month(); // 0-11

          if (metric === "absent") {
            if (!log.check_in_time) data[m]++;
          }

          if (metric === "onTime") {
            if (
              log.check_in_time &&
              !isLate(log, allowLate, workStart)
            )
              data[m]++;
          }

          if (metric === "late") {
            if (isLate(log, allowLate, workStart)) data[m]++;
          }

          if (metric === "leaveEarly") {
            if (isEarlyLeave(log, workEnd)) data[m]++;
          }
        });

        if (metric === "withPermit") {
          u.leave_requests?.forEach(l => {
            if (
              l.status === "approved" &&
              moment(l.start_date).year() === Number(year)
            ) {
              data[moment(l.start_date).month()]++;
            }
          });
        }
      });

      return res.json({ mode, metric, labels, data });
    }

    /* ======================
       MONTH
    ====================== */
    if (mode === "month") {
      if (!month)
        return res.status(400).json({ error: "Missing month" });

      const labels = ["Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4"];
      const data = [0, 0, 0, 0];

      users.forEach(u => {
        u.attendance_logs.forEach(log => {
          const d = moment(log.date);
          if (
            d.year() !== Number(year) ||
            d.month() + 1 !== Number(month)
          )
            return;

          const w = Math.min(3, Math.floor((d.date() - 1) / 7));

          if (metric === "absent" && !log.check_in_time) data[w]++;
          if (metric === "late" && isLate(log, allowLate, workStart))
            data[w]++;
          if (
            metric === "onTime" &&
            log.check_in_time &&
            !isLate(log, allowLate, workStart)
          )
            data[w]++;
          if (metric === "leaveEarly" && isEarlyLeave(log, workEnd))
            data[w]++;
        });
      });

      return res.json({ mode, metric, labels, data });
    }

    /* ======================
       WEEK
    ====================== */
    if (mode === "week") {
      if (!month || !week)
        return res
          .status(400)
          .json({ error: "Missing month/week" });

      const labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
      const data = Array(7).fill(0);

      const start = moment(`${year}-${month}-01`)
        .add((week - 1) * 7, "days");
      const end = moment(start).add(6, "days");

      users.forEach(u => {
        u.attendance_logs.forEach(log => {
          const d = moment(log.date);
          if (!d.isBetween(start, end, "day", "[]")) return;

          const idx = d.day() === 0 ? 6 : d.day() - 1;

          if (metric === "absent" && !log.check_in_time) data[idx]++;
          if (metric === "late" && isLate(log, allowLate, workStart))
            data[idx]++;
          if (
            metric === "onTime" &&
            log.check_in_time &&
            !isLate(log, allowLate, workStart)
          )
            data[idx]++;
          if (metric === "leaveEarly" && isEarlyLeave(log, workEnd))
            data[idx]++;
        });
      });

      return res.json({ mode, metric, labels, data });
    }

    return res.status(400).json({ error: "Invalid mode" });
  } catch (err) {
    console.error("getAttendanceChart:", err);
    return res.status(500).json({ error: err.message });
  }
};
// GET /api/companies/dashboard
// module.exports.getCompaniesDashboard = async (req, res) => {
//   try {
//     const companies = await Company.find({})
//       .populate("subscription_plan", "name code price_per_month")
//       .lean();

//     const companyIds = companies.map(c => c._id);

//     // đếm user theo company
//     const users = await User.find({
//       company_id: { $in: companyIds },
//       record_status: 1,
//     }).select("company_id");

//     const userCountMap = {};
//     users.forEach(u => {
//       const cid = u.company_id?.toString();
//       if (!cid) return;
//       userCountMap[cid] = (userCountMap[cid] || 0) + 1;
//     });

//     const result = companies.map(c => ({
//       id: c._id,
//       name: c.name,
//       code: c.code,

//       subscription_status: c.subscription_status,
//       subscription_plan: c.subscription_plan
//         ? {
//           id: c.subscription_plan._id,
//           name: c.subscription_plan.name,
//           code: c.subscription_plan.code,
//           price_per_month: c.subscription_plan.price_per_month,
//         }
//         : null,

//       users_count: userCountMap[c._id.toString()] || 0,

//       record_status: c.record_status,
//       created_at: c.created_at,
//     }));

//     return res.json(result);
//   } catch (err) {
//     console.error("getCompaniesDashboard:", err);
//     return res.status(500).json({ error: err.message });
//   }
// };

// GET /api/companies/:id/plan-history
module.exports.getCompanyPlanHistory = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate("plan_history.plan", "name code price_per_month")
      .select("plan_history");

    if (!company) {
      return res.status(404).json({ error: "Company không tồn tại" });
    }

    return res.json(company.plan_history || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
// GET /api/companies/:id/user-stats
module.exports.getCompanyUserStats = async (req, res) => {
  try {
    const total = await User.countDocuments({
      company_id: req.params.id,
    });

    const active = await User.countDocuments({
      company_id: req.params.id,
      is_active: true,
    });

    return res.json({
      total_users: total,
      active_users: active,
      inactive_users: total - active,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
// PUT /api/companies/:id/lock
module.exports.lockCompany = async (req, res) => {
  try {
    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      { record_status: 0 },
      { new: true }
    );

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
// PUT /api/companies/:id/unlock
module.exports.unlockCompany = async (req, res) => {
  try {
    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      { record_status: 1 },
      { new: true }
    );

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

;

/* =====================================================
   🔓 UNLOCK COMPANY (MẪU STYLE)
===================================================== */
module.exports.unlockCompany = async (req, res) => {
  try {
    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      { record_status: 1 },
      { new: true }
    );

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================================
   🔒 LOCK COMPANY
===================================================== */
module.exports.lockCompany = async (req, res) => {
  try {
    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      { record_status: 0 },
      { new: true }
    );

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================================
   👥 USER STATS BY COMPANY
   GET /companies/:id/user-stats
===================================================== */
module.exports.getCompanyUserStats = async (req, res) => {
  try {
    const companyId = req.params.id;

    const total_users = await User.countDocuments({
      company_id: companyId,
    });

    const active_users = await User.countDocuments({
      company_id: companyId,
      is_active: true,
    });

    const inactive_users = total_users - active_users;

    return res.json({
      total_users,
      active_users,
      inactive_users,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================================
   💰 TOTAL REVENUE REPORT
   GET /companies/dashboard/revenue
===================================================== */
module.exports.getRevenueReport = async (req, res) => {
  try {
    const rs = await Company.aggregate([
      { $unwind: "$plan_history" },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: "$plan_history.price" },
          total_orders: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      total_revenue: rs[0]?.total_revenue || 0,
      total_orders: rs[0]?.total_orders || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================================
   📊 REVENUE BY MONTH (CHART)
   GET /companies/dashboard/revenue-by-month
===================================================== */
module.exports.getRevenueByMonth = async (req, res) => {
  try {
    const rs = await Company.aggregate([
      { $unwind: "$plan_history" },
      {
        $group: {
          _id: {
            year: { $year: "$plan_history.start_date" },
            month: { $month: "$plan_history.start_date" },
          },
          revenue: { $sum: "$plan_history.price" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return res.json(
      rs.map(i => ({
        year: i._id.year,
        month: i._id.month,
        revenue: i.revenue,
        orders: i.orders,
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================================
   🏢 COMPANY DASHBOARD
   GET /companies/dashboard
===================================================== */
module.exports.getCompaniesDashboard = async (req, res) => {
  try {
    const total_companies = await Company.countDocuments();

    const active_companies = await Company.countDocuments({
      subscription_status: "active",
    });

    const unactive_companies =
      total_companies - active_companies;

    return res.json({
      total_companies,
      active_companies,
      unactive_companies,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================================
   📦 SUBSCRIPTION PLAN STATS
   GET /companies/dashboard/plan-stats
===================================================== */
module.exports.getPlanStats = async (req, res) => {
  try {
    const rs = await Company.aggregate([
      { $unwind: "$plan_history" },
      {
        $group: {
          _id: "$plan_history.plan",
          total_companies: { $sum: 1 },
          total_revenue: { $sum: "$plan_history.price" },
        },
      },
      {
        $lookup: {
          from: "subscriptionplans",
          localField: "_id",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $unwind: "$plan" },
    ]);

    return res.json(
      rs.map(i => ({
        plan_id: i._id,
        plan_name: i.plan.name,
        total_companies: i.total_companies,
        total_revenue: i.total_revenue,
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
