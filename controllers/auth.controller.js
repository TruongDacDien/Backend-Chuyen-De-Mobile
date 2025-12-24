const User = require("../models/user.model");
const Company = require("../models/company.model");
const jwt = require("jsonwebtoken");
const mailFacade = require("../services/MailFacade");

// ======= Helpers =======
function ok(res, data = {}, message) {
  return res.json({
    success: true,
    error: null,
    ...(message ? { message } : {}),
    data,
  });
}
function isLastDayOfMonth(date = new Date()) {
  const d = new Date(date);
  const tomorrow = new Date(d);
  tomorrow.setDate(d.getDate() + 1);
  return tomorrow.getDate() === 1;
}

function err(res, status = 400, message = "Yêu cầu không hợp lệ") {
  return res.status(status).json({
    success: false,
    error: message,
  });
}

function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================
// CREATE COMPANY
// ============================
async function createCompanyFromBody(body) {
  const { company_name, company_address, company_email, company_phone } = body;

  if (!company_name || !company_address || !company_email || !company_phone) {
    throw new Error("Thiếu thông tin công ty bắt buộc");
  }

  return Company.create({
    name: company_name,
    code: company_name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-"),
    address: company_address,
    contact_email: company_email,
    contact_phone: company_phone,
    avatar: body.company_avatar,
    images: Array.isArray(body.company_images) ? body.company_images : [],
  });
}


// ============================
// REGISTER (NO VERIFY SERVICE)
// ============================
async function registerNoVerifyService(input) {
  const { email, password, full_name } = input;

  let existed = await User.findOne({ email });
  if (existed) return existed;

  return User.create({
    email,
    password,
    full_name,
    role: "admin",
    company_id: input.company_id,
    department_id: input.department_id,
    manager_id: input.manager_id,
    job_title: input.job_title,
    salary: input.salary,
    face_id: input.face_id,
    avatar: input.avatar,
    gallery: input.gallery || [],
    is_verified: input.is_verified ?? true,
  });
}

module.exports = {
  // 🔐 REGISTER + COMPANY
  register: async (req, res) => {
    try {
      console.log("===== REGISTER START =====");
      console.log("REQ BODY:", req.body);

      const {
        email,
        password,
        full_name,
        company_name,
        company_address,
        company_email,
        company_phone,
      } = req.body;

      if (
        !email ||
        !password ||
        !full_name ||
        !company_name ||
        !company_address ||
        !company_email ||
        !company_phone
      ) {
        console.log("❌ Missing required fields");
        return err(res, 400, "Thiếu dữ liệu bắt buộc");
      }

      const code = generateVerifyCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      console.log("Generated verify code:", code);
      console.log("Verify expires at:", expires);

      console.log("Creating company...");
      const company = await createCompanyFromBody(req.body);
      console.log("Company created:", company);

      console.log("Finding user by email:", email);
      let user = await User.findOne({ email }).select("+password");
      console.log("User found:", user);

      if (user && user.is_verified) {
        console.log("❌ Email already exists & verified");
        return err(res, 400, "Email đã tồn tại");
      }

      if (user && !user.is_verified) {
        console.log("Updating existing unverified user");

        user.password = password;
        user.full_name = full_name;
        user.role = "admin";
        user.company_id = user.company_id || company._id;
        user.is_verified = false;
        user.verification_code = code;
        user.verification_expires = expires;

        await user.save();
        console.log("User updated:", user);
      } else {
        console.log("Creating new user");

        user = await User.create({
          email,
          password,
          full_name,
          role: "admin",
          company_id: company._id,
          is_verified: false,
          verification_code: code,
          verification_expires: expires,
        });

        console.log("User created:", user);
      }

      console.log("Sending verification email...");
      await mailFacade.sendMail({
        toList: [user.email],
        subject: "Mã xác nhận tài khoản",
        html: `
        <p>Xin chào ${user.full_name || ""},</p>
        <p>Mã xác nhận của bạn:</p>
        <h2>${code}</h2>
        <p>Hiệu lực 15 phút.</p>
      `,
      });
      console.log("✅ Email sent");

      console.log("===== REGISTER SUCCESS =====");
      return ok(
        res,
        { userId: user._id, companyId: company._id },
        "Đăng ký thành công, vui lòng kiểm tra email."
      );
    } catch (e) {
      console.error("🔥 REGISTER ERROR:", e);
      return err(res, 400, e?.message || "Đăng ký thất bại");
    }
  },


  // ⭐ REGISTER NO VERIFY
  registerNoVerify: async (req, res) => {
    try {
      const { company_name, company_address, company_email, company_phone } = req.body;

      if (!company_name || !company_address || !company_email || !company_phone)
        return err(res, 400, "Thiếu thông tin công ty");

      const company = await createCompanyFromBody(req.body);

      const user = await registerNoVerifyService({
        ...req.body,
        company_id: company._id,
        is_verified: true,
      });

      if (!user.company_id) {
        user.company_id = company._id;
        await user.save();
      }

      return ok(res, { user, companyId: company._id }, "Tạo tài khoản thành công");
    } catch (e) {
      return err(res, 400, e?.message);
    }
  },

  // 📤 RESEND OTP
  resendCode: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return err(res, 400, "Email là bắt buộc");

      const user = await User.findOne({ email, record_status: 1 });
      if (!user) return err(res, 400, "Không tìm thấy người dùng");
      if (user.is_verified) return err(res, 400, "Tài khoản đã xác minh");

      const code = generateVerifyCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      user.verification_code = code;
      user.verification_expires = expires;
      await user.save();

      await mailFacade.sendMail({
        toList: [user.email],
        subject: "Mã xác nhận mới",
        html: `<p>Mã mới của bạn:</p><h2>${code}</h2>`,
      });

      return ok(res, null, "Đã gửi lại mã xác nhận");
    } catch (e) {
      return err(res, 400, e?.message);
    }
  },

  // 🔑 LOGIN (FULL FIX PASSWORD)
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return err(res, 400, "Email và mật khẩu là bắt buộc");

      const user = await User.findOne({ email, record_status: 1 })
        .select("+password")
        .populate({
          path: "company_id",
          select: "name code subscription_plan subscription_status plan_history",
          populate: { path: "subscription_plan", model: "SubscriptionPlan" },
        });

      if (!user) return err(res, 400, "Không tìm thấy người dùng");
      if (!user.is_active) return err(res, 403, "Tài khoản đã bị vô hiệu hóa");
      if (!user.is_verified) return err(res, 403, "Tài khoản chưa xác minh");

      const okPw = await user.comparePassword(password);
      if (!okPw) return err(res, 400, "Mật khẩu không đúng");

      /* ======================================================
         ⭐ AUTO EXPIRE SUBSCRIPTION KHI LOGIN
      ====================================================== */
      const company = user.company_id;

      if (
        company &&
        company.subscription_status === "canceled" &&
        Array.isArray(company.plan_history) &&
        company.plan_history.length > 0 &&
        isLastDayOfMonth(new Date())
      ) {
        const latestPlan =
          company.plan_history[company.plan_history.length - 1];

        if (latestPlan?.end_date) {
          const today = new Date();
          const endDate = new Date(latestPlan.end_date);

          if (today >= endDate) {
            company.subscription_status = "expired";
            await company.save();
          }
        }
      }

      /* ====================================================== */

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const userObj = user.toObject();
      delete userObj.password;

      return ok(
        res,
        {
          token,
          user: {
            ...userObj,
            company_id: company,
            subscription_plan: company?.subscription_plan || null,
            subscription_status: company?.subscription_status || "unactive",
          },
        },
        "Đăng nhập thành công"
      );
    } catch (e) {
      console.error(e);
      return err(res, 400, "Đăng nhập thất bại");
    }
  },


  // ✔ VERIFY ACCOUNT
  verifyAccount: async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) return err(res, 400, "Thiếu dữ liệu");

      const user = await User.findOne({ email, record_status: 1 }).select("+password");
      if (!user) return err(res, 400, "Không tìm thấy người dùng");
      if (user.is_verified) return err(res, 400, "Tài khoản đã xác minh");

      if (!user.verification_code) return err(res, 400, "Không có mã xác nhận");
      if (user.verification_expires < new Date())
        return err(res, 400, "Mã xác nhận đã hết hạn");

      if (user.verification_code !== code)
        return err(res, 400, "Mã xác nhận không đúng");

      user.is_verified = true;
      user.verification_code = null;
      user.verification_expires = null;
      await user.save();

      return ok(res, null, "Xác minh tài khoản thành công");
    } catch (e) {
      return err(res, 400, e?.message);
    }
  },

  // 🔐 CHANGE PASSWORD
  changePassword: async (req, res) => {
    try {
      const userId = req.user?.id;
      const { old_password, new_password } = req.body;

      if (!userId) return err(res, 401, "Không có quyền");
      if (!old_password || !new_password)
        return err(res, 400, "Thiếu mật khẩu");

      const user = await User.findById(userId).select("+password");
      if (!user) return err(res, 404, "Không tìm thấy người dùng");

      const okPw = await user.comparePassword(old_password);
      if (!okPw) return err(res, 400, "Mật khẩu cũ không đúng");

      if (old_password === new_password)
        return err(res, 400, "Mật khẩu mới phải khác");

      user.password = new_password;
      await user.save();

      return ok(res, null, "Đổi mật khẩu thành công");
    } catch (e) {
      return err(res, 400, e?.message);
    }
  },

  // 📩 FORGOT PASSWORD
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return err(res, 400, "Email bắt buộc");

      const user = await User.findOne({ email, record_status: 1 });
      if (!user) return ok(res, null, "Nếu tài khoản tồn tại, mã sẽ được gửi");

      if (!user.is_verified)
        return err(res, 403, "Tài khoản chưa xác minh");

      const code = generateVerifyCode();
      const expires = addMinutes(new Date(), 15);

      user.reset_password_code = code;
      user.reset_password_expires = expires;
      await user.save();

      await mailFacade.sendMail({
        toList: [user.email],
        subject: "Mã đặt lại mật khẩu",
        html: `<h2>${code}</h2>`,
      });

      return ok(res, null, "Đã gửi mã đặt lại");
    } catch (e) {
      return err(res, 400, e?.message);
    }
  },

  // 🔁 RESET PASSWORD
  resetPassword: async (req, res) => {
    try {
      const { email, code, new_password } = req.body;

      if (!email || !code || !new_password)
        return err(res, 400, "Thiếu dữ liệu");

      const user = await User.findOne({ email, record_status: 1 }).select("+password");

      if (!user) return err(res, 400, "Không tìm thấy người dùng");
      if (!user.reset_password_code)
        return err(res, 400, "Không có yêu cầu đặt lại");

      if (user.reset_password_expires < new Date())
        return err(res, 400, "Mã đã hết hạn");

      if (user.reset_password_code !== code)
        return err(res, 400, "Mã không đúng");

      const sameAsOld = await user.comparePassword(new_password);
      if (sameAsOld)
        return err(res, 400, "Mật khẩu mới phải khác");

      user.password = new_password;
      user.reset_password_code = null;
      user.reset_password_expires = null;
      await user.save();

      return ok(res, null, "Đặt lại mật khẩu thành công");
    } catch (e) {
      return err(res, 400, e?.message);
    }
  },

  registerNoVerifyService,
};

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000);
}
