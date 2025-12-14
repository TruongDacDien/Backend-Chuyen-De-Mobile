const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");
const userController = require("../controllers/user.controller");

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User management APIs
 *   - name: Requests
 *     description: Leave & Overtime APIs
 */

/* ======================================================
   USER MANAGEMENT
====================================================== */

router.post("/", auth, rbac("MANAGE_USERS"), userController.createUserByAdmin);
router.get("/", auth, rbac("MANAGE_USERS"), userController.getAllUsers);

router.get("/me", auth, rbac("VIEW_SELF"), userController.getMe);
router.put("/me", auth, rbac("VIEW_SELF"), userController.updateMyProfile);

router.get(
  "/company",
  auth,
  rbac("MANAGE_USERS"),
  userController.getUsersByCompany
);

router.get(
  "/company/:id",
  auth,
  rbac("MANAGE_USERS"),
  userController.getUserDetailByCompanyAdmin
);

router.put(
  "/company/:id",
  auth,
  rbac("MANAGE_USERS"),
  userController.updateUserByCompanyAdmin
);

router.patch(
  "/:id/approve",
  auth,
  rbac("MANAGE_USERS"),
  userController.approveUserProfile
);

router.patch(
  "/:id/status",
  auth,
  rbac("MANAGE_USERS"),
  userController.updateUserStatus
);

router.get("/:id", auth, rbac("VIEW_USER"), userController.getUserById);
router.put("/:id", auth, rbac("MANAGE_USERS"), userController.updateUser);
router.delete("/:id", auth, rbac("MANAGE_USERS"), userController.deleteUser);

/* ======================================================
   CHECK-IN / CHECK-OUT
====================================================== */

router.post(
  "/checkin/location-check",
  auth,
  rbac("VIEW_SELF"),
  userController.locationCheck
);

router.post(
  "/checkin",
  auth,
  rbac("VIEW_SELF"),
  userController.checkAttendance
);

/* ======================================================
   ⭐ LEAVE REQUESTS (USER)
====================================================== */

router.post(
  "/requests/leave",
  auth,
  rbac("VIEW_SELF"),
  userController.createLeaveRequest
);

router.get(
  "/requests/leave/me",
  auth,
  rbac("VIEW_SELF"),
  userController.getMyLeaveRequests
);

/* ======================================================
   ⭐ OVERTIME REQUESTS (USER)
====================================================== */

router.post(
  "/requests/overtime",
  auth,
  rbac("VIEW_SELF"),
  userController.createOvertimeRequest
);

router.get(
  "/requests/overtime/me",
  auth,
  rbac("VIEW_SELF"),
  userController.getMyOvertimeRequests
);

/* ======================================================
   ⭐ ADMIN – REQUESTS
====================================================== */

// Admin xem tất cả request pending (leave + overtime)
router.get(
  "/admin/requests/pending",
  auth,
  rbac("MANAGE_USERS"),
  userController.adminGetPendingRequests
);

// ✅ ADMIN: LẤY TẤT CẢ PHIẾU OT (ALL / FILTER STATUS)
router.get(
  "/admin/requests/overtime",
  auth,
  rbac("MANAGE_USERS"),
  userController.adminGetAllOvertimeRequests
);

// Admin duyệt / từ chối OT
router.patch(
  "/admin/requests/overtime/:userId/:otId",
  auth,
  rbac("MANAGE_USERS"),
  userController.adminDecideOvertimeRequest
);

module.exports = router;
