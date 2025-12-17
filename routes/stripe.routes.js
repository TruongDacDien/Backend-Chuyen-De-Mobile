// routes/stripe.routes.js
const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripe.controller");
const auth = require("../middleware/auth.middleware");     // ⬅️ JWT
const rbac = require("../middleware/rbac.middleware");     // ⬅️ RBAC(permission)

/**
 * @swagger
 * tags:
 *   name: Stripe
 *   description: Stripe Subscription APIs
 */

/**
 * @swagger
 * /api/stripe/create-checkout-session:
 *   post:
 *     summary: Create Stripe subscription checkout session
 *     description: |
 *       Tạo link thanh toán SUBSCRIPTION cho mobile app.  
 *       FE sẽ mở URL trả về trong WebView hoặc Chrome.
 *     tags: [Stripe]
 *     security:
 *       - bearerAuth: []            # ⬅️ yêu cầu token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "65df91c88e3ff0c90abc1234"
 *     responses:
 *       200:
 *         description: Checkout URL generated successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               error: null
 *               data:
 *                 checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123"
 *                 sessionId: "cs_test_123"
 *       401:
 *         description: Missing/invalid token
 *       403:
 *         description: Not allowed (need MANAGE_BILLING)
 */
router.post(
  "/create-checkout-session",
  auth,
  rbac("MANAGE_BILLING"),         // ⬅️ chỉ admin (và sys_admin nếu chain cho phép)
  express.json(),
  stripeController.createCheckoutSession
);

/**
 * @swagger
 * /api/stripe/webhook:
 *   post:
 *     summary: Stripe webhook receiver
 *     description: |
 *       Webhook MUST receive RAW body để verify signature.  
 *       Không dùng JSON parser ở đây!
 *     tags: [Stripe]
 *     security: []                  # public
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Stripe webhook raw body
 *     responses:
 *       200:
 *         description: Webhook received successfully
 *         content:
 *           text/plain:
 *             example: "OK"
 *       400:
 *         description: Signature or payload invalid
 *         content:
 *           text/plain:
 *             example: "Webhook Error: Signature verification failed"
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeController.webhookHandler
);

/**
 * @swagger
 * /api/stripe/cancel/{subscriptionId}:
 *   delete:
 *     summary: Cancel a Stripe subscription
 *     tags: [Stripe]
 *     security:
 *       - bearerAuth: []            # ⬅️ yêu cầu token
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *           example: "sub_1SSxHW8v9LZ8HHrlcxH6OZNw"
 *     responses:
 *       200:
 *         description: Subscription canceled
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               error: null
 *               data:
 *                 status: "canceled"
 *                 subscriptionId: "sub_1SSxHW8v9LZ8HHrlcxH6OZNw"
 *       401:
 *         description: Missing/invalid token
 *       403:
 *         description: Not allowed (need MANAGE_BILLING)
 */
router.delete(
  "/cancel/:subscriptionId",
  auth,
  rbac("MANAGE_BILLING"),         // ⬅️ chỉ admin
  stripeController.cancelSubscription
);

module.exports = router;
