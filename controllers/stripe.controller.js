// controllers/stripe.controller.js
require("dotenv").config();
const { default: Stripe } = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET);

const User = require("../models/user.model");
const Company = require("../models/company.model");
const SubscriptionPlan = require("../models/subscriptionPlan.model");

// ========== Helpers ==========
function ok(res, data = {}, message) {
  return res.json({ success: true, error: null, ...(message ? { message } : {}), data });
}
function err(res, status = 400, message = "Bad request") {
  return res.status(status).json({ success: false, error: message });
}
function toId(maybe) { return !maybe ? undefined : (typeof maybe === "string" ? maybe : maybe.id); }

async function resolvePlanByCode(planCode) {
  if (!planCode) return null;
  return SubscriptionPlan.findOne({ code: planCode, record_status: 1 });
}

async function upsertStripeCustomerForCompany(company, emailFallback) {
  const id = company.stripe_customer_id;
  if (id) {
    try { await stripe.customers.retrieve(id); return id; } catch (_) { }
  }
  const customer = await stripe.customers.create({
    name: company.name,
    email: company.contact_email || emailFallback || undefined,
    metadata: { companyId: company._id.toString(), companyCode: company.code || "" },
  });
  company.stripe_customer_id = customer.id;
  await company.save();
  return customer.id;
}

module.exports = {
  // ===== Create checkout session: chỉ cần planCode, còn lại lấy từ token/user =====
  createCheckoutSession: async (req, res) => {
    try {
      // cần middleware auth trước route này để có req.user
      const authUserId = req?.user?.id;
      if (!authUserId) return err(res, 401, "Unauthorized");

      // nhận duy nhất planCode (alias: subscriptionPlanCode)
      const { planCode, subscriptionPlanCode, successUrl, cancelUrl } = req.body || {};
      const effectivePlanCode = planCode || subscriptionPlanCode;
      if (!effectivePlanCode) return err(res, 400, "Missing planCode");

      // lấy user + company từ DB
      const user = await User.findOne({ _id: authUserId, record_status: 1 });
      if (!user) return err(res, 404, "User not found");

      if (!user.company_id) return err(res, 400, "User has no company_id");
      const company = await Company.findOne({ _id: user.company_id, record_status: 1 });
      if (!company) return err(res, 404, "Company not found");

      // lấy plan theo code
      const plan = await resolvePlanByCode(effectivePlanCode);
      if (!plan) return err(res, 404, "Subscription plan not found");

      if (!plan.stripe_price_id) return err(res, 400, "Plan missing stripe_price_id");
      const priceId = plan.stripe_price_id;

      /** @type {import('stripe').Stripe.Checkout.SessionCreateParams} */
      const payload = {
        mode: "subscription",
        client_reference_id: String(authUserId),
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: String(successUrl || (process.env.BASE_URL + "/stripe-success.html")) + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: String(cancelUrl || (process.env.BASE_URL + "/stripe-cancel.html")),
        metadata: {
          userId: String(authUserId),
          companyId: company._id.toString(),
          planId: plan._id.toString(),
          planCode: plan.code,
        },
        subscription_data: {
          metadata: {
            userId: String(authUserId),
            companyId: company._id.toString(),
            planId: plan._id.toString(),
            planCode: plan.code,
          },
        },
      };

      // bảo đảm có Stripe Customer gắn với company
      const customerId = await upsertStripeCustomerForCompany(company, user.email);
      payload.customer = customerId;

      const session = await stripe.checkout.sessions.create(payload);
      return ok(res, { checkoutUrl: session.url, sessionId: session.id });
    } catch (e) {
      console.error("❌ Stripe createCheckoutSession error:", e);
      return err(res, 500, e?.message || "Create checkout session failed");
    }
  },

  // ===== Webhook =====
  webhookHandler: async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

      console.log("📩 Stripe event:", event.type);

      switch (event.type) {
        case "checkout.session.completed": {
          /** @type {import('stripe').Stripe.Checkout.Session} */
          const session = event.data.object;
          const subscriptionId = toId(session.subscription);
          const customerId = toId(session.customer);
          const meta = session.metadata || {};
          const companyId = meta.companyId;
          const planId = meta.planId;
          const planCode = meta.planCode;

          if (companyId) {
            const company = await Company.findOne({ _id: companyId, record_status: 1 });
            if (company) {
              company.stripe_customer_id = customerId || company.stripe_customer_id;
              if (subscriptionId) company.stripe_subscription_id = subscriptionId;
              company.subscription_status = "active";

              // gán plan
              let planDoc = null;
              if (planId) planDoc = await SubscriptionPlan.findOne({ _id: planId, record_status: 1 });
              if (!planDoc && planCode) planDoc = await SubscriptionPlan.findOne({ code: planCode, record_status: 1 });

              if (planDoc) {
                company.subscription_plan = planDoc._id;
                company.plan_history.push({
                  plan: planDoc._id,
                  price: planDoc.price_per_month,
                  start_date: new Date(),
                  end_date: null,
                  created_at: new Date(),
                });
              }
              await company.save();
            }
          }
          break;
        }

        case "invoice.payment_succeeded": {
          /** @type {import('stripe').Stripe.Invoice} */
          const invoice = event.data.object;
          // @ts-ignore: type đôi khi không expose subscription
          const subscriptionId = toId(invoice.subscription);
          if (subscriptionId) {
            const company = await Company.findOne({ stripe_subscription_id: subscriptionId, record_status: 1 });
            if (company) {
              company.subscription_status = "active";
              await company.save();
            }
          }
          console.log("✔️ Thanh toán gia hạn thành công");
          break;
        }

        case "invoice.payment_failed": {
          /** @type {import('stripe').Stripe.Invoice} */
          const invoice = event.data.object;
          // @ts-ignore
          const subscriptionId = toId(invoice.subscription);
          if (subscriptionId) {
            const company = await Company.findOne({ stripe_subscription_id: subscriptionId, record_status: 1 });
            if (company) {
              company.subscription_status = "expired";
              await company.save();
            }
          }
          console.log("❌ Gia hạn thất bại");
          break;
        }

        case "customer.subscription.deleted": {
          /** @type {import('stripe').Stripe.Subscription} */
          const subscription = event.data.object;
          const subscriptionId = toId(subscription);

          if (subscriptionId) {
            const company = await Company.findOne({ stripe_subscription_id: subscriptionId, record_status: 1 });
            if (company) {
              company.subscription_status = "canceled";
              const last = company.plan_history?.[company.plan_history.length - 1];
              if (last && !last.end_date) last.end_date = new Date();
              await company.save();
            }
          }
          console.log("⚠️ Subscription bị hủy");
          break;
        }

        default:
          break;
      }

      return res.status(200).send("OK");
    } catch (e) {
      console.error("❌ Webhook Error:", e.message);
      return res.status(400).send(`Webhook Error: ${e.message}`);
    }
  },

  // ===== Cancel subscription =====
  cancelSubscription: async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      if (!subscriptionId) return err(res, 400, "Missing subscriptionId");

      const canceled = await stripe.subscriptions.cancel(subscriptionId);

      const company = await Company.findOne({ stripe_subscription_id: subscriptionId, record_status: 1 });
      if (company) {
        company.subscription_status = "canceled";
        const last = company.plan_history?.[company.plan_history.length - 1];
        if (last && !last.end_date) last.end_date = new Date();
        await company.save();
      }

      return ok(res, { status: canceled.status, subscriptionId }, "Subscription canceled successfully");
    } catch (e) {
      console.error("❌ Cancel Subscription Error:", e);
      return err(res, 500, e?.message || "Cancel subscription failed");
    }
  },
  cancelSubscriptionDBOnly: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return err(res, 401, "Unauthorized");

      const user = await User.findOne({ _id: userId, record_status: 1 });
      if (!user || !user.company_id) {
        return err(res, 404, "User or company not found");
      }

      const company = await Company.findOne({ _id: user.company_id, record_status: 1 });
      if (!company) return err(res, 404, "Company not found");

      company.subscription_status = "canceled";

      const lastPlan = company.plan_history?.at(-1);
      if (lastPlan && !lastPlan.end_date) {
        lastPlan.end_date = new Date();
      }

      await company.save();

      return ok(
        res,
        {
          company_id: company._id,
          subscription_status: company.subscription_status,
        },
        "Subscription canceled in DB only"
      );
    } catch (e) {
      console.error("cancelSubscriptionDBOnly error:", e);
      return err(res, 500, "Cancel failed");
    }
  },
  renewSubscriptionDBOnly: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return err(res, 401, "Unauthorized");

      const user = await User.findOne({ _id: userId, record_status: 1 });
      if (!user || !user.company_id) {
        return err(res, 404, "User or company not found");
      }

      const company = await Company.findOne({ _id: user.company_id, record_status: 1 });
      if (!company) return err(res, 404, "Company not found");

      company.subscription_status = "active";

      const lastPlan = company.plan_history?.at(-1);
      if (lastPlan && lastPlan.end_date) {
        company.plan_history.push({
          plan: lastPlan.plan,
          price: lastPlan.price,
          start_date: new Date(),
          end_date: null,
          created_at: new Date(),
        });
      }

      await company.save();

      return ok(
        res,
        {
          company_id: company._id,
          subscription_status: company.subscription_status,
        },
        "Subscription renewed in DB only"
      );
    } catch (e) {
      console.error("renewSubscriptionDBOnly error:", e);
      return err(res, 500, "Renew failed");
    }
  },

};
