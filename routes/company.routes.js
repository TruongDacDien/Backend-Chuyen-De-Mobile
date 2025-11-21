const express = require("express");
const router = express.Router();
const controller = require("../controllers/company.controller");

/**
 * @swagger
 * tags:
 *   name: Company
 *   description: API quản lý Công Ty
 */

router.post("/", controller.createCompany);

router.put("/:id", controller.updateCompany);

router.delete("/:id", controller.deleteCompany);

router.get("/", controller.getAllCompanies);

router.get("/:id", controller.getCompanyById);

router.post("/search", controller.searchCompany);

// thêm lịch sử plan
router.post("/:id/plan-history", controller.addPlanHistory);

module.exports = router;
