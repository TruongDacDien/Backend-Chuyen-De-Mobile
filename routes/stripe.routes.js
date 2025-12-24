const express = require("express");
const router = express.Router();

const stripeController = require("../controllers/stripe.controller");
const auth = require("../middleware/auth.middleware");
const rbac = require("../middleware/rbac.middleware");

router.post(
  "/create-checkout-session",
  auth,
  rbac("MANAGE_BILLING"),
  express.json(),
  stripeController.createCheckoutSession
);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeController.webhookHandler
);

router.delete(
  "/cancel/:subscriptionId",
  auth,
  rbac("MANAGE_BILLING"),
  stripeController.cancelSubscription
);

router.post(
  "/cancel2",
  auth,
  rbac("MANAGE_BILLING"),
  stripeController.cancelSubscriptionDBOnly
);

router.post(
  "/renew",
  auth,
  rbac("MANAGE_BILLING"),
  stripeController.renewSubscriptionDBOnly
);

module.exports = router;