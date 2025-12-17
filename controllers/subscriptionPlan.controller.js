const SubscriptionPlan = require("../models/subscriptionPlan.model");
const { ok, err } = require("../utils/response");

module.exports = {

  // CREATE
  createPlan: async (req, res) => {
    try {
      const plan = await SubscriptionPlan.create(req.body);
      return ok(res, plan, "Created");
    } catch (e) {
      return err(res, 400, e.message);
    }
  },

  // UPDATE
  updatePlan: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await SubscriptionPlan.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      return ok(res, updated, "Updated");
    } catch (e) {
      return err(res, 400, e.message);
    }
  },

  // DELETE (soft delete)
  deletePlan: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await SubscriptionPlan.findByIdAndUpdate(
        id,
        { record_status: 0 },
        { new: true }
      );

      return ok(res, updated, "Deleted");
    } catch (e) {
      return err(res, 400, e.message);
    }
  },

  // SEARCH (any field)
  searchPlans: async (req, res) => {
    try {
      const query = { ...req.body, record_status: 1 };
      const list = await SubscriptionPlan.find(query);

      return ok(res, list);
    } catch (e) {
      return err(res, 400, e.message);
    }
  },

  // GET ALL
  getAllPlans: async (req, res) => {
    try {
      const list = await SubscriptionPlan.find({ record_status: 1 });
      return ok(res, list);
    } catch (e) {
      return err(res, 400, e.message);
    }
  },

  // GET BY ID
  getPlanById: async (req, res) => {
    try {
      const plan = await SubscriptionPlan.findById(req.params.id);
      if (!plan) return err(res, 404, "Plan not found");

      return ok(res, plan);
    } catch (e) {
      return err(res, 400, e.message);
    }
  },
};
