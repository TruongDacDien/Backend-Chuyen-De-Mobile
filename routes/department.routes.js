const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");
const deptController = require("../controllers/department.controller");

// chỉ sys_admin & admin
router.post("/", auth, rbac("MANAGE_DEPARTMENTS"), deptController.createDepartment);
router.get("/", auth, rbac("MANAGE_DEPARTMENTS"), deptController.getAllDepartments);

// ⭐ GET detail department
router.get("/:id", auth, rbac("MANAGE_DEPARTMENTS"), deptController.getDepartmentDetail);

router.put("/:id", auth, rbac("MANAGE_DEPARTMENTS"), deptController.updateDepartment);
router.delete("/:id", auth, rbac("MANAGE_DEPARTMENTS"), deptController.deleteDepartment);

module.exports = router;
