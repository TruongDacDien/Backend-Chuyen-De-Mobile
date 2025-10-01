const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "User API",
      version: "1.0.0",
      description: "Simple API for managing users (Node.js + MongoDB + MVC)",
    },
    servers: [
      {
        url: "/", // 👈 Sử dụng chính domain của backend server
        description: "Dynamic base URL (used automatically by Swagger UI)",
      },
    ],
  },
  apis: ["./routes/*.js"], // nơi chứa mô tả Swagger
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
