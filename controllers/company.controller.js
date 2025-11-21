const Company = require("../models/company.model");

module.exports = {
  // CREATE
  createCompany: async (req, res) => {
    try {
      const company = await Company.create(req.body);
      return res.json(company);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // UPDATE
  updateCompany: async (req, res) => {
    try {
      const updated = await Company.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      return res.json(updated);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // DELETE (soft)
  deleteCompany: async (req, res) => {
    try {
      const updated = await Company.findByIdAndUpdate(
        req.params.id,
        { record_status: 0 },
        { new: true }
      );
      return res.json({ message: "Deleted", data: updated });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // GET ALL
  getAllCompanies: async (req, res) => {
    try {
      const companies = await Company.find({ record_status: 1 });
      return res.json(companies);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // GET ONE
  getCompanyById: async (req, res) => {
    try {
      const company = await Company.findById(req.params.id);
      return res.json(company);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // SEARCH tất cả field
  searchCompany: async (req, res) => {
    try {
      const query = req.body;
      query.record_status = 1;

      const results = await Company.find(query);
      return res.json(results);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // PUSH lịch sử plan
  addPlanHistory: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await Company.findByIdAndUpdate(
        id,
        { $push: { plan_history: req.body } },
        { new: true }
      );

      return res.json(updated);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
