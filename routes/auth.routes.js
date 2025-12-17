const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth.controller");
const auth = require("../middleware/auth.middleware"); // dùng cái này luôn

// Đăng ký có verify (gửi mail OTP)
router.post("/register", controller.register);

// Đăng ký không verify (dùng cho test / sys_admin tạo)
router.post("/register-no-verify", controller.registerNoVerify);

// Gửi lại mã xác nhận
router.post("/resend-code", controller.resendCode);

// Xác nhận tài khoản bằng OTP
router.post("/verify", controller.verifyAccount);

// Đăng nhập
router.post("/login", controller.login);

// ===== thêm mới =====
// Đổi mật khẩu (yêu cầu token)
router.post("/change-password", auth, controller.changePassword);

// Quên mật khẩu (gửi mã reset)
router.post("/forgot-password", controller.forgotPassword);

// Đặt lại mật khẩu bằng code
router.post("/reset-password", controller.resetPassword);

module.exports = router;
