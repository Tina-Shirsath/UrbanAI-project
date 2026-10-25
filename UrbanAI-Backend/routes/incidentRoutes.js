const express = require("express");
const multer = require("multer");

function createIncidentRoutes({
  createIncident,
  getIncidents,
  getIncidentImage,
  updateIncidentStatus,
  getIncidentByTrackingReference,
  requireAdmin,
  requireCsrf,
}) {
  const router = express.Router();

  // Citizen submission remains public and retains the existing multipart
  // request and response contract.
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });
  const upload = multer({ storage });
  router.post("/", upload.single("image"), createIncident);

  // Public lookup returns a deliberately limited incident summary.
  router.get("/track/:trackingReference", getIncidentByTrackingReference);

  // All routes below this point expose or manage stored incident data.
  router.use(requireAdmin, requireCsrf);
  router.get("/", getIncidents);
  router.get("/:id/image", getIncidentImage);
  router.patch("/:id/status", updateIncidentStatus);

  return router;
}

module.exports = createIncidentRoutes;
