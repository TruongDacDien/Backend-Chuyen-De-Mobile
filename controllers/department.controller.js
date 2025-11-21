// controllers/department.controller.js
const Department = require("../models/department.model");

module.exports = {
  createDepartment: async (req, res) => {
    try {
      const dept = await Department.create(req.body);
      return res.json(dept);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  getAllDepartments: async (req, res) => {
    try {
      const list = await Department.find({ record_status: 1 });
      return res.json(list);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  updateDepartment: async (req, res) => {
    try {
      const updated = await Department.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      return res.json(updated);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  deleteDepartment: async (req, res) => {
    try {
      const deleted = await Department.findByIdAndUpdate(
        req.params.id,
        { record_status: 0 },
        { new: true }
      );
      return res.json({ message: "Deleted", deleted });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
