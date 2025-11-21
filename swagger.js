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
        url: "/", // sử dụng domain backend
        description: "Dynamic base URL (used automatically by Swagger UI)",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = require("swagger-jsdoc")(options);

module.exports = swaggerSpec;
