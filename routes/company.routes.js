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
   ⭐ CHECK-IN INFO (PHẢI ĐỂ TRƯỚC /:id)
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
   ⭐ CHECK-IN CONFIG (PHẢI ĐỂ TRƯỚC /:id)
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
   ⭐ ATTENDANCE CONFIG (PHẢI ĐỂ TRƯỚC /:id)
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
   ⭐ ROUTES CŨ (CRUD)
===================================================== */
router.post("/", controller.createCompany);

router.get("/", controller.getAllCompanies);

router.post("/search", controller.searchCompany);

router.post("/:id/plan-history", controller.addPlanHistory);

router.get("/:id", controller.getCompanyById);

router.put("/:id", controller.updateCompany);

router.delete("/:id", controller.deleteCompany);

module.exports = router;
