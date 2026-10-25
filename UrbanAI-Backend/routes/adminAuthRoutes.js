const express = require("express");

function createAdminAuthRoutes(auth) {
  const router = express.Router();

  router.post("/login", auth.checkOrigin, auth.login);
  router.post(
    "/logout",
    auth.checkOrigin,
    auth.requireAdmin,
    auth.requireCsrf,
    auth.logout
  );
  router.get("/session", auth.requireAdmin, (req, res) => {
    res.status(200).json({ success: true, admin: req.admin });
  });

  return router;
}

module.exports = createAdminAuthRoutes;
