const express = require("express");
const cors = require("cors");
const Incident = require("./models/Incident");
const { createAdminAuth } = require("./middleware/adminAuth");
const createAdminAuthRoutes = require("./routes/adminAuthRoutes");
const createIncidentRoutes = require("./routes/incidentRoutes");
const { createIncidentController } = require("./controllers/incidentController");

function createApp(options = {}) {
  const env = options.env || process.env;
  const frontendOrigin = env.FRONTEND_ORIGIN || "http://localhost:5173";
  const auth = createAdminAuth({
    username: env.ADMIN_USERNAME,
    passwordHash: env.ADMIN_PASSWORD_HASH,
    tokenSecret: env.AUTH_TOKEN_SECRET,
    frontendOrigin,
    tokenTtlSeconds: env.AUTH_TOKEN_TTL_SECONDS,
    nodeEnv: env.NODE_ENV,
  });
  const incidentController = createIncidentController({
    IncidentModel: options.IncidentModel || Incident,
    fetchImpl: options.fetchImpl,
    aiApiUrl: options.aiApiUrl || env.AI_API_URL,
    uploadsDirectory: options.uploadsDirectory,
  });

  const app = express();
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use(express.json());

  app.use("/api/admin/auth", createAdminAuthRoutes(auth));
  app.use(
    "/api/incidents",
    createIncidentRoutes({
      ...incidentController,
      requireAdmin: auth.requireAdmin,
      requireCsrf: auth.requireCsrf,
    })
  );

  app.get("/", (req, res) => {
    res.json({ success: true, message: "UrbanAI Backend is running!" });
  });

  // Uploaded files are only served after resolving the incident and checking
  // administrator authorization in the incident router.
  return app;
}

module.exports = { createApp };
