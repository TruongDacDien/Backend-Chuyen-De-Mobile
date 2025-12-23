const express = require("express");
const router = express.Router();
const controller = require("../controllers/company.controller");
const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");

/**
 * @swagger
 * tags:
 *   name: Company
 *   description: API quản lý Công Ty
 */

/* =====================================================
   ⭐ CHECK-IN INFO (USER)
===================================================== */
router.get(
  "/checkin-info",
  auth,
  controller.getCheckinInfo
);

/* =====================================================
   ⭐ GET MY COMPANY (THEO TOKEN)
===================================================== */
router.get(
  "/me",
  auth,
  controller.getMyCompany
);

/* =====================================================
   ⭐ SYS ADMIN – DASHBOARD (TỔNG QUAN CÔNG TY)
===================================================== */
router.get(
  "/dashboard",
  auth,
  rbac("SYS_ADMIN"),
  controller.getCompaniesDashboard
);

/* =====================================================
   ⭐ SYS ADMIN – REVENUE REPORT
===================================================== */
router.get(
  "/dashboard/revenue",
  auth,
  rbac("SYS_ADMIN"),
  controller.getRevenueReport
);

/* =====================================================
   ⭐ SYS ADMIN – REVENUE BY MONTH (CHART)
===================================================== */
router.get(
  "/dashboard/revenue-by-month",
  auth,
  rbac("SYS_ADMIN"),
  controller.getRevenueByMonth
);

/* =====================================================
   ⭐ SYS ADMIN – PLAN STATISTICS
===================================================== */
router.get(
  "/dashboard/plan-stats",
  auth,
  rbac("SYS_ADMIN"),
  controller.getPlanStats
);

/* =====================================================
   ⭐ ATTENDANCE REPORT BY DATE
===================================================== */
router.get(
  "/attendance-report",
  auth,
  rbac("VIEW_SELF"),
  controller.getAttendanceReportByDate
);

/* =====================================================
   ⭐ ATTENDANCE CHART
===================================================== */
router.get(
  "/attendance-chart",
  auth,
  rbac("VIEW_SELF"),
  controller.getAttendanceChart
);

/* =====================================================
   ⭐ CHECK-IN CONFIG
===================================================== */
router.get(
  "/checkin-config",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.getCheckinConfig
);

router.put(
  "/checkin-config",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.updateCheckinConfig
);

/* =====================================================
   ⭐ ATTENDANCE CONFIG
===================================================== */
router.get(
  "/attendance-config",
  auth,
  rbac("VIEW_SELF"),
  controller.getAttendanceConfig
);

router.put(
  "/attendance-config",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.updateAttendanceConfig
);

/* =====================================================
   ⭐ CRUD COMPANY
===================================================== */
router.post(
  "/",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.createCompany
);

router.get(
  "/",
  auth,
  rbac("VIEW_SELF"),
  controller.getAllCompanies
);

router.post(
  "/search",
  auth,
  rbac("VIEW_SELF"),
  controller.searchCompany
);

/* =====================================================
   ⭐ PLAN HISTORY (SYS ADMIN)
===================================================== */
router.get(
  "/:id/plan-history",
  auth,
  rbac("SYS_ADMIN"),
  controller.getCompanyPlanHistory
);

router.post(
  "/:id/plan-history",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.addPlanHistory
);

/* =====================================================
   ⭐ USER STATS (SYS ADMIN)
===================================================== */
router.get(
  "/:id/user-stats",
  auth,
  rbac("SYS_ADMIN"),
  controller.getCompanyUserStats
);

/* =====================================================
   ⭐ LOCK / UNLOCK COMPANY (SYS ADMIN)
===================================================== */
router.put(
  "/:id/lock",
  auth,
  rbac("SYS_ADMIN"),
  controller.lockCompany
);

router.put(
  "/:id/unlock",
  auth,
  rbac("SYS_ADMIN"),
  controller.unlockCompany
);

/* =====================================================
   ⭐ CRUD COMPANY BY ID
===================================================== */
router.get(
  "/:id",
  auth,
  rbac("VIEW_SELF"),
  controller.getCompanyById
);

router.put(
  "/:id",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.updateCompany
);

router.delete(
  "/:id",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.deleteCompany
);

module.exports = router;
