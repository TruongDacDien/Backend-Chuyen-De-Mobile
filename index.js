require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const userRoutes = require("./routes/user.routes");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const cors = require("cors");

const app = express();
app.use(cors()); // 👈 Cho phép tất cả origin truy cập
app.use(express.json());

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api/users", userRoutes);

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root
app.get("/", (req, res) => {
  res.send("👋 Hello from user-api-app with Swagger!");
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
});
