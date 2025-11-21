// controllers/auth.controller.js
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

function err(res, status = 400, message = "Bad request") {
  return res.status(status).json({
    success: false,
    error: message,
  });
}

function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Tạo/return company theo thông tin bắt buộc */
async function createCompanyFromBody(body) {
  const { company_name, company_address, company_email, company_phone } = body;

  if (!company_name || !company_address || !company_email || !company_phone) {
    throw new Error("company_name, company_address, company_email, company_phone are required");
  }

  const existed = await Company.findOne({
    $or: [
      { name: company_name },
      { contact_email: company_email },
      { contact_phone: company_phone },
    ],
    record_status: 1,
  });

  if (existed) return existed;

  const company = await Company.create({
    name: company_name,
    code: company_name.toLowerCase().replace(/\s+/g, "-"),
    address: company_address,
    contact_email: company_email,
    contact_phone: company_phone,
    avatar: body.company_avatar || undefined,
    images: Array.isArray(body.company_images) ? body.company_images : [],
  });

  return company;
}

/** tạo user không gửi mail, có thể chọn verify luôn */
async function registerNoVerifyService(input) {
  const { email, password, full_name } = input;

  let existed = await User.findOne({ email });
  if (existed) return existed;

  const user = await User.create({
    email,
    password,
    full_name,
    role: "admin",
    company_id: input.company_id || null,   // ⬅️ set company cho user
    department_id: input.department_id || null,
    manager_id: input.manager_id || null,
    job_title: input.job_title,
    salary: input.salary,
    face_id: input.face_id,
    avatar: input.avatar,
    gallery: input.gallery || [],
    is_verified: input.is_verified ?? true,
  });

  return user;
}

module.exports = {
  // 🔐 Đăng ký (có verify) — bắt buộc cả thông tin công ty, gán company_id cho user
  register: async (req, res) => {
    try {
      const {
        email,
        password,
        full_name,
        company_name,
        company_address,
        company_email,
        company_phone,
      } = req.body;

      if (!email || !password || !full_name || !company_name || !company_address || !company_email || !company_phone) {
        return err(res, 400, "email, password, full_name, company_name, company_address, company_email, company_phone are required");
      }

      const code = generateVerifyCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      // tạo/nhận company trước để có _id
      const company = await createCompanyFromBody(req.body);

      let user = await User.findOne({ email });

      if (user && user.is_verified) return err(res, 400, "Email already exists");

      if (user && !user.is_verified) {
        // update user cũ
        user.password = password;
        user.full_name = full_name;
        user.role = "admin";
        user.company_id = user.company_id || company._id; // ⬅️ gán nếu chưa có
        user.is_verified = false;
        user.verification_code = code;
        user.verification_expires = expires;
        await user.save();
      } else if (!user) {
        // tạo mới
        user = await User.create({
          email,
          password,
          full_name,
          role: "admin",
          company_id: company._id,          // ⬅️ gán company cho user mới
          is_verified: false,
          verification_code: code,
          verification_expires: expires,
        });
      }

      // gửi mail verify
      await mailFacade.sendMail({
        toList: [user.email],
        subject: "Xác nhận tài khoản của bạn",
        html: `
          <p>Chào ${user.full_name || ""},</p>
          <p>Mã xác nhận tài khoản của bạn là:</p>
          <h2>${code}</h2>
          <p>Mã sẽ hết hạn sau 15 phút.</p>
        `,
      });

      return ok(
        res,
        { userId: user._id, companyId: company._id },
        "Đăng ký thành công, vui lòng kiểm tra email để nhập mã xác nhận."
      );
    } catch (e) {
      console.error("Register error:", e);
      return err(res, 400, e?.message || "Register failed");
    }
  },

  // ✅ Đăng ký không verify (test) — tạo company + gán company_id cho user
  registerNoVerify: async (req, res) => {
    try {
      const { company_name, company_address, company_email, company_phone } = req.body;
      if (!company_name || !company_address || !company_email || !company_phone)
        return err(res, 400, "company_name, company_address, company_email, company_phone are required");

      const company = await createCompanyFromBody(req.body);

      const user = await registerNoVerifyService({
        ...req.body,
        company_id: company._id, // ⬅️ gán luôn
        is_verified: true,
      });

      // nếu user đã tồn tại từ trước (existed), có thể còn thiếu company_id → đảm bảo gán
      if (!user.company_id) {
        user.company_id = company._id;
        await user.save();
      }

      return ok(res, { user, companyId: company._id }, "Register (no verify) success");
    } catch (e) {
      console.error("RegisterNoVerify error:", e);
      return err(res, 400, e?.message || "Register (no verify) failed");
    }
  },

  // 📩 resend mã OTP
  resendCode: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return err(res, 400, "Email is required");

      const user = await User.findOne({ email, record_status: 1 });
      if (!user) return err(res, 400, "User not found");
      if (user.is_verified) return err(res, 400, "Account already verified");

      const code = generateVerifyCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      user.verification_code = code;
      user.verification_expires = expires;
      await user.save();

      await mailFacade.sendMail({
        toList: [user.email],
        subject: "Mã xác nhận tài khoản (gửi lại)",
        html: `
          <p>Chào ${user.full_name || ""},</p>
          <p>Mã xác nhận tài khoản mới của bạn là:</p>
          <h2>${code}</h2>
          <p>Mã sẽ hết hạn sau 15 phút.</p>
        `,
      });

      return ok(res, null, "Resend verification code success");
    } catch (e) {
      console.error("Resend code error:", e);
      return err(res, 400, e?.message || "Resend code failed");
    }
  },

  // 🔑 login
// 🔑 login (lấy subscription từ Company)
login: async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return err(res, 400, "email and password are required");

    // 👉 tìm user + populate company + subscription_plan
    const user = await User.findOne({ email, record_status: 1 })
      .populate({
        path: "company_id",
        select: "name code subscription_plan subscription_status",
        populate: {
          path: "subscription_plan",
          model: "SubscriptionPlan",
        },
      });

    if (!user) return err(res, 400, "User not found");
    if (!user.is_verified) return err(res, 403, "Account is not verified");
    // @ts-ignore
    const okPw = await user.comparePassword(password);
    if (!okPw) return err(res, 400, "Incorrect password");

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userObj = user.toObject();

    // 👇 Lấy sub từ company
    const company = userObj.company_id || null;
    const subscription_plan = company?.subscription_plan || null;
    const subscription_status = company?.subscription_status || "unactive";

    return ok(res, {
      token,
      user: {
        ...userObj,
        company_id: company,            // đã include subscription_* bên trong
        subscription_plan,              // tiện FE đọc trực tiếp
        subscription_status,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    return err(res, 400, e?.message || "Login failed");
  }
},


  // ✔ verify tài khoản bằng mã
  verifyAccount: async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) return err(res, 400, "email and code are required");

      const user = await User.findOne({ email, record_status: 1 });
      if (!user) return err(res, 400, "User not found");
      if (user.is_verified) return err(res, 400, "Account already verified");

      if (!user.verification_code || !user.verification_expires)
        return err(res, 400, "No verification code, please register again");

      if (user.verification_expires < new Date())
        return err(res, 400, "Verification code expired");

      if (user.verification_code !== code)
        return err(res, 400, "Verification code invalid");

      user.is_verified = true;
      user.verification_code = null;
      user.verification_expires = null;
      await user.save();

      return ok(res, null, "Account verified successfully");
    } catch (e) {
      console.error("Verify error:", e);
      return err(res, 400, e?.message || "Verify failed");
    }
  },
 // ====== MỚI: Đổi mật khẩu (yêu cầu token) ======
  changePassword: async (req, res) => {
    try {
      const userId = req.user?.id;
      const { old_password, new_password } = req.body;

      if (!userId) return err(res, 401, "Unauthorized");
      if (!old_password || !new_password)
        return err(res, 400, "old_password and new_password are required");
      if (old_password === new_password)
        return err(res, 400, "New password must be different from old password");

      const user = await User.findOne({ _id: userId, record_status: 1 });
      if (!user) return err(res, 404, "User not found");

      // @ts-ignore
      const okPw = await user.comparePassword(old_password);
      if (!okPw) return err(res, 400, "Old password is incorrect");

      user.password = new_password; // giả định user.model có pre-save hash
      await user.save();

      return ok(res, null, "Password changed successfully");
    } catch (e) {
      console.error("ChangePassword error:", e);
      return err(res, 400, e?.message || "Change password failed");
    }
  },

  // ====== MỚI: Quên mật khẩu — gửi mã ======
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return err(res, 400, "Email is required");

      const user = await User.findOne({ email, record_status: 1 });
      // Trả về 200 để tránh lộ tồn tại email, nhưng ở đây bạn đang trả message rõ ràng — tùy bạn:
      if (!user) return ok(res, null, "If the email exists, a reset code has been sent");

      // chỉ cho user đã verify mới reset
      if (!user.is_verified) return err(res, 403, "Account is not verified");

      const code = generateVerifyCode();
      const expires = addMinutes(new Date(), 15);

      user.reset_password_code = code;
      user.reset_password_expires = expires;
      await user.save();

      await mailFacade.sendMail({
        toList: [user.email],
        subject: "Mã đặt lại mật khẩu",
        html: `
          <p>Chào ${user.full_name || ""},</p>
          <p>Mã đặt lại mật khẩu của bạn là:</p>
          <h2>${code}</h2>
          <p>Mã sẽ hết hạn sau 15 phút.</p>
        `,
      });

      return ok(res, null, "Reset code sent to email");
    } catch (e) {
      console.error("ForgotPassword error:", e);
      return err(res, 400, e?.message || "Forgot password failed");
    }
  },

  // ====== MỚI: Xác nhận code & đặt mật khẩu mới ======
  resetPassword: async (req, res) => {
    try {
      const { email, code, new_password } = req.body;
      if (!email || !code || !new_password)
        return err(res, 400, "email, code and new_password are required");

      const user = await User.findOne({ email, record_status: 1 });
      if (!user) return err(res, 400, "User not found");

      if (!user.reset_password_code || !user.reset_password_expires)
        return err(res, 400, "No reset request or code already used");

      if (user.reset_password_expires < new Date())
        return err(res, 400, "Reset code expired");

      if (user.reset_password_code !== code)
        return err(res, 400, "Reset code invalid");

      // không cho new_password trùng mật khẩu cũ
      // @ts-ignore
      const sameAsOld = await user.comparePassword(new_password);
      if (sameAsOld) return err(res, 400, "New password must be different from old password");

      user.password = new_password; // pre-save hash
      user.reset_password_code = null;
      user.reset_password_expires = null;
      await user.save();

      return ok(res, null, "Password has been reset");
    } catch (e) {
      console.error("ResetPassword error:", e);
      return err(res, 400, e?.message || "Reset password failed");
    }
  },
  registerNoVerifyService,
};
function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000);
}
