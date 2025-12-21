const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");
const userController = require("../controllers/user.controller");

/* ======================================================
   ✅ TIMESHEET / PAYROLL
====================================================== */
router.get("/timesheets/months/me", auth, userController.getMyTimesheetMonthsSummary);
router.get("/timesheets/month-detail/me", auth, userController.getMyMonthTimesheetDetail);
router.get("/timesheets/months/:userId", auth, userController.getUserTimesheetMonthsSummary);
router.get("/timesheets/month-detail/:userId", auth, userController.getUserMonthTimesheetDetail);

/* ======================================================
   USER MANAGEMENT
====================================================== */
router.post("/", auth, rbac("MANAGE_USERS"), userController.createUserByAdmin);
router.get("/", auth, rbac("MANAGE_USERS"), userController.getAllUsers);

router.get("/me", auth, rbac("VIEW_SELF"), userController.getMe);
router.put("/me", auth, rbac("VIEW_SELF"), userController.updateMyProfile);

router.get("/company", auth, rbac("VIEW_SELF"), userController.getUsersByCompany);
router.get("/company/:id", auth, rbac("MANAGE_USERS"), userController.getUserDetailByCompanyAdmin);
router.put("/company/:id", auth, rbac("MANAGE_USERS"), userController.updateUserByCompanyAdmin);

router.patch("/:id/approve", auth, rbac("MANAGE_USERS"), userController.approveUserProfile);
router.patch("/:id/status", auth, rbac("MANAGE_USERS"), userController.updateUserStatus);

router.get("/:id", auth, rbac("VIEW_USER"), userController.getUserById);
router.put("/:id", auth, rbac("MANAGE_USERS"), userController.updateUser);
router.delete("/:id", auth, rbac("MANAGE_USERS"), userController.deleteUser);

/* ======================================================
   CHECK-IN / CHECK-OUT
====================================================== */
router.post("/checkin/location-check", auth, rbac("VIEW_SELF"), userController.locationCheck);
router.post("/checkin", auth, rbac("VIEW_SELF"), userController.checkAttendance);

/* ======================================================
   LEAVE REQUESTS
====================================================== */
router.post("/requests/leave", auth, rbac("VIEW_SELF"), userController.createLeaveRequest);
router.get("/requests/leave/me", auth, rbac("VIEW_SELF"), userController.getMyLeaveRequests);
router.get("/admin/requests/leave", auth, rbac("MANAGE_USERS"), userController.adminGetAllLeaveRequests);
router.patch("/admin/requests/leave/:userId/:leaveId", auth, rbac("MANAGE_USERS"), userController.adminDecideLeaveRequest);

/* ======================================================
   CHECK-IN COMPLAINTS
====================================================== */
router.post("/requests/checkin-complaint", auth, rbac("VIEW_SELF"), userController.createCheckinComplaint);
router.get("/requests/checkin-complaint/me", auth, rbac("VIEW_SELF"), userController.getMyCheckinComplaints);
router.get("/admin/requests/checkin-complaint", auth, rbac("MANAGE_USERS"), userController.adminGetAllCheckinComplaints);
router.patch("/admin/requests/checkin-complaint/:userId/:complaintId", auth, rbac("MANAGE_USERS"), userController.adminDecideCheckinComplaint);

/* ======================================================
   OVERTIME REQUESTS
====================================================== */
router.post("/requests/overtime", auth, rbac("VIEW_SELF"), userController.createOvertimeRequest);
router.get("/requests/overtime/me", auth, rbac("VIEW_SELF"), userController.getMyOvertimeRequests);
router.get("/admin/requests/pending", auth, rbac("MANAGE_USERS"), userController.adminGetPendingRequests);
router.get("/admin/requests/overtime", auth, rbac("MANAGE_USERS"), userController.adminGetAllOvertimeRequests);
router.patch("/admin/requests/overtime/:userId/:otId", auth, rbac("MANAGE_USERS"), userController.adminDecideOvertimeRequest);

/* ======================================================
   💬 CHAT ROUTES
====================================================== */
router.get("/chat/list", auth, userController.getMyChatList);
router.get("/chat/detail/:peerId", auth, userController.getChatDetail);
router.get("/chat/group/:groupId", auth, userController.getGroupChatDetail);
router.post("/chat/send", auth, userController.sendMessage);
router.post("/chat/seen", auth, userController.markSeen);

module.exports = router;
