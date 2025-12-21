const Company = require("../models/company.model");
const User = require("../models/user.model");
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
      const companies = await Company.find({ record_status: 1 });
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
        return res.status(400).json({
          error: "User chưa thuộc công ty nào",
        });
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


