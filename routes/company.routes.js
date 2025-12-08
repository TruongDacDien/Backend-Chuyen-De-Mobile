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
   ⭐ CHECK-IN CONFIG (PHẢI ĐỂ TRƯỚC /:id)
===================================================== */

/**
 * @swagger
 * /api/company/checkin-config:
 *   get:
 *     summary: Lấy cấu hình vị trí check-in của công ty (admin)
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/checkin-config",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.getCheckinConfig
);

/**
 * @swagger
 * /api/company/checkin-config:
 *   put:
 *     summary: Cập nhật vị trí & bán kính check-in (admin)
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/checkin-config",
  auth,
  rbac("MANAGE_COMPANY"),
  controller.updateCheckinConfig
);

/* =====================================================
   ⭐ ROUTES CŨ
===================================================== */

router.post("/", controller.createCompany);

router.put("/:id", controller.updateCompany);

router.delete("/:id", controller.deleteCompany);

router.get("/", controller.getAllCompanies);

router.get("/:id", controller.getCompanyById);

router.post("/search", controller.searchCompany);

router.post("/:id/plan-history", controller.addPlanHistory);

module.exports = router;
