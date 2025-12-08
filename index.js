require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

// ROUTES
const mailRoutes = require("./routes/mail.routes");
const pingRoutes = require("./routes/ping.routes");
const uploadRoutes = require("./routes/upload.routes");
const momoRoutes = require("./routes/momo.routes");
const zaloRoutes = require("./routes/zalo.routes");
const stripeRoutes = require("./routes/stripe.routes");
const notificationRoutes = require("./routes/notification.routes");
const subscriptionPlanRoutes = require("./routes/subscriptionPlan.routes");
const companyRoutes = require("./routes/company.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const departmentRoutes = require("./routes/department.routes");
const sysTestRoutes = require("./routes/sysTest.routes");
const googleMapsRoutes = require("./routes/googleMaps.route");
const app = express();

/* ---------------------- MONGO CONNECT ---------------------- */
if (!process.env.MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* ---------------------- CORS ---------------------- */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ---------------------- STRIPE WEBHOOK (RAW BODY) — MUST BE FIRST ---------------------- */
app.use("/api/stripe", stripeRoutes);

/* ---------------------- JSON PARSER ---------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ---------------------- STATIC FILES ---------------------- */
app.use(express.static(path.join(__dirname, "public")));

/* ---------------------- ROUTES ---------------------- */
app.use("/api/mails", mailRoutes);
app.use("/api/ping", pingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/momo", momoRoutes);
app.use("/api/zalo", zaloRoutes);
app.use("/api/maps", googleMapsRoutes);
app.use("/api/notify", notificationRoutes);
app.use("/api/plans", subscriptionPlanRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/sys-test", sysTestRoutes);
/* ---------------------- SWAGGER ---------------------- */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* ---------------------- ROOT ---------------------- */
app.get("/", (req, res) => res.send("Server running 🚀"));

/* ---------------------- HTTP + SOCKET.IO ---------------------- */
const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

const attachGateway = require("./socket/gateway");
const { nsp } = attachGateway(io);

const StrategyContext = require("./socket/strategies/StrategyContext");
const strategyCtx = new StrategyContext(nsp);

app.set("io", io);
app.set("socketStrategy", strategyCtx);

/* ---------------------- START SERVER ---------------------- */
const PORT = process.env.PORT || 3000;

server.listen(
  {
    port: PORT,
    host: "0.0.0.0",
  },
  () => {
    console.log(`🚀 Server running on port ${PORT}`);
  }
);
