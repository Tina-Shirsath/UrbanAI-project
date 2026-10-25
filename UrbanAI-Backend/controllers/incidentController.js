
const Incident = require("../models/Incident");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const fs = require("fs");
const path = require("path");
const { Blob } = require("buffer");
const { findPotentialDuplicates } = require("../utils/duplicateDetection");

const DEFAULT_AI_API_URL = "http://127.0.0.1:8000";
const ALLOWED_INCIDENT_STATUSES = [
  "reported",
  "investigating",
  "in_progress",
  "resolved",
];
const TRACKING_REFERENCE_PATTERN = /^UAI-[A-F0-9]{24}$/;
const ALLOWED_INCIDENT_CATEGORIES = [
  "road_damage", "pothole", "garbage", "streetlight", "water_leakage", "drainage", "other",
];
const COORDINATE_STRING_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function parseCoordinate(value, field, minimum, maximum) {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: `${field} must be a valid number` };
  }

  const normalized = value.trim();
  if (!COORDINATE_STRING_PATTERN.test(normalized)) {
    return { error: `${field} must be a valid number` };
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    return { error: `${field} must be a finite number` };
  }
  if (number < minimum || number > maximum) {
    return { error: `${field} must be between ${minimum} and ${maximum}` };
  }
  return { value: number };
}

function createIncidentController({
  IncidentModel = Incident,
  fetchImpl = global.fetch,
  aiApiUrl = DEFAULT_AI_API_URL,
  uploadsDirectory = path.resolve(process.cwd(), "uploads"),
} = {}) {

// --------------------------------------------------
// CREATE INCIDENT + TEXT AI + IMAGE AI
// --------------------------------------------------

const createIncident = async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
    const { description, category, location } = body;
    const hasLatitude = Object.hasOwn(body, "latitude");
    const hasLongitude = Object.hasOwn(body, "longitude");

    // Get uploaded image from Multer
    const uploadedImage = req.file || null;
    const image = uploadedImage ? uploadedImage.filename : null;

    // Validate required fields
    if (!description || !category || !location) {
      return res.status(400).json({
        success: false,
        message: "Description, category and location are required",
      });
    }
    if (typeof description !== "string" || description.trim().length > 2000 ||
        typeof category !== "string" || typeof location !== "string" || location.trim().length > 300) {
      return res.status(400).json({ success: false, message: "Enter a valid description, category and location" });
    }
    if (!description.trim() || !location.trim() || !ALLOWED_INCIDENT_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Enter a description and location and select a valid category" });
    }
    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({ success: false, message: "Latitude and longitude must be provided together" });
    }

    let latitude;
    let longitude;
    if (hasLatitude) {
      const parsedLatitude = parseCoordinate(body.latitude, "Latitude", -90, 90);
      if (parsedLatitude.error) {
        return res.status(400).json({ success: false, message: parsedLatitude.error });
      }
      const parsedLongitude = parseCoordinate(body.longitude, "Longitude", -180, 180);
      if (parsedLongitude.error) {
        return res.status(400).json({ success: false, message: parsedLongitude.error });
      }
      latitude = parsedLatitude.value;
      longitude = parsedLongitude.value;
    }

    // 1. Analyze complaint text using the Python AI API
    const aiResponse = await fetchImpl(`${aiApiUrl}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });

    if (!aiResponse.ok) {
      throw new Error(`Text AI request failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();

    // 2. Analyze uploaded image using YOLO
    let imageAnalysis = {
      success: false,
      model_status: "not_used",
      detection_count: 0,
      detections: [],
      message: "No image was uploaded.",
    };

    if (uploadedImage) {
      const imagePath = path.resolve(uploadedImage.path);
      const imageBuffer = await fs.promises.readFile(imagePath);

      const formData = new FormData();

      formData.append(
        "image",
        new Blob([imageBuffer], {
          type: uploadedImage.mimetype || "application/octet-stream",
        }),
        uploadedImage.originalname || uploadedImage.filename
      );

      const imageResponse = await fetchImpl(
        `${aiApiUrl}/predict-image`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (imageResponse.ok) {
        imageAnalysis = await imageResponse.json();
      } else {
        const errorText = await imageResponse.text();
        console.error("Image AI request failed:", errorText);

        imageAnalysis = {
          success: false,
          model_status: "unavailable",
          detection_count: 0,
          detections: [],
          message: "Image analysis could not be completed.",
        };
      }
    }

    console.log("Text AI result:", aiResult);
    console.log("Image AI result:", imageAnalysis);

    // 3. Validate AI predictions against the Incident schema
    const validPriorities = ["low", "normal", "urgent"];
    const predictedPriority = String(
      aiResult.priority || ""
    ).toLowerCase();

    const validSeverities = ["low", "medium", "high"];
    const predictedSeverity = String(
      aiResult.severity || ""
    ).toLowerCase();

    let trackingReference;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `UAI-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
      const existing = await IncidentModel.findOne({ trackingReference: candidate });
      if (!existing) {
        trackingReference = candidate;
        break;
      }
    }
    if (!trackingReference) throw new Error("Could not generate a unique tracking reference");

    const finalCategory = ALLOWED_INCIDENT_CATEGORIES.includes(aiResult.category)
      ? aiResult.category
      : category;

    // 4. Duplicate Complaint Detection against recent window
    let isPotentialDuplicate = false;
    let duplicateMatches = [];
    try {
      if (typeof IncidentModel.find === "function") {
        const potentialMatches = await findPotentialDuplicates(
          {
            description: description.trim(),
            category: finalCategory,
            location: location.trim(),
            ...(hasLatitude ? { latitude, longitude } : {}),
          },
          IncidentModel
        );
        if (Array.isArray(potentialMatches) && potentialMatches.length > 0) {
          isPotentialDuplicate = true;
          duplicateMatches = potentialMatches;
        }
      }
    } catch (duplicateErr) {
      console.error("Duplicate detection check failed:", duplicateErr.message);
      // Fail gracefully: Do not block complaint submission if duplicate check fails
    }

    const incident = new IncidentModel({
      description: description.trim(),

      // Use the predicted category when it is valid.
      // Otherwise, use the category selected by the user.
      category: finalCategory,

      severity: validSeverities.includes(predictedSeverity)
        ? predictedSeverity
        : "medium",

      priority: validPriorities.includes(predictedPriority)
        ? predictedPriority
        : "normal",

      location: location.trim(),
      ...(hasLatitude ? { latitude, longitude } : {}),
      trackingReference,
      image,

      department:
        aiResult.department || "General Department",

      aiConfidence: aiResult.confidence || 0,
      isPotentialDuplicate,
      duplicateMatches,
    });

    // IMPORTANT: Save the incident before using savedIncident.
    const savedIncident = await incident.save();

    console.log("Incident saved successfully:", savedIncident._id);

    // 4. Return incident and both AI analysis results
    return res.status(201).json({
      success: true,
      message: "Incident analyzed and created successfully",
      trackingReference: savedIncident.trackingReference,

      aiAnalysis: {
        category: savedIncident.category,
        severity: savedIncident.severity,
        priority: savedIncident.priority,
        department: savedIncident.department,
        confidence: savedIncident.aiConfidence,
      },

      imageAnalysis,

      incident: {
        trackingReference: savedIncident.trackingReference,
        category: savedIncident.category,
        status: savedIncident.status,
        createdAt: savedIncident.createdAt,
      },
    });
  } catch (error) {
    console.error("Create incident error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to analyze and create incident",
      error: error.message,
    });
  }
};

const getIncidentByTrackingReference = async (req, res) => {
  const reference = typeof req.params.trackingReference === "string"
    ? req.params.trackingReference.trim().toUpperCase()
    : "";
  if (!TRACKING_REFERENCE_PATTERN.test(reference)) {
    return res.status(400).json({ success: false, message: "Enter a valid tracking reference (for example, UAI- followed by 24 letters or numbers)." });
  }
  try {
    const incident = await IncidentModel.findOne({ trackingReference: reference })
      .select("trackingReference category status createdAt -_id");
    if (!incident) {
      return res.status(404).json({ success: false, message: "No complaint was found for that tracking reference." });
    }
    return res.status(200).json({
      success: true,
      incident: {
        trackingReference: incident.trackingReference,
        category: incident.category,
        status: incident.status,
        submittedAt: incident.createdAt,
      },
    });
  } catch (error) {
    console.error("Track incident failed");
    return res.status(500).json({ success: false, message: "Unable to look up this complaint right now. Please try again." });
  }
};

// --------------------------------------------------
// GET INCIDENTS
// --------------------------------------------------

const getIncidents = async (req, res) => {
  try {
    const incidents = await IncidentModel.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error) {
    console.error("Get incidents error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch incidents",
      error: error.message,
    });
  }
};

const updateIncidentStatus = async (req, res) => {
  const incidentId = req.params.id;
  if (!mongoose.isObjectIdOrHexString(incidentId)) {
    return res.status(400).json({
      success: false,
      message: "A valid incident ID is required",
    });
  }

  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.hasOwn(body, "status") ||
    typeof body.status !== "string" ||
    !ALLOWED_INCIDENT_STATUSES.includes(body.status)
  ) {
    return res.status(400).json({
      success: false,
      message: "Status must be one of: reported, investigating, in_progress, resolved",
    });
  }

  try {
    const incident = await IncidentModel.findByIdAndUpdate(
      incidentId,
      { $set: { status: body.status } },
      { new: true, runValidators: true }
    );

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: "Incident not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Incident status updated successfully",
      incident,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "A valid incident ID is required",
      });
    }
    console.error("Update incident status failed");
    return res.status(500).json({
      success: false,
      message: "Failed to update incident status",
    });
  }
};

const getIncidentImage = async (req, res) => {
  try {
    const incident = await IncidentModel.findById(req.params.id);
    if (!incident || !incident.image) {
      return res.status(404).json({
        success: false,
        message: "Incident image not found",
      });
    }

    const filename = incident.image;
    if (
      typeof filename !== "string" ||
      filename.length === 0 ||
      filename === "." ||
      filename === ".." ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("\0")
    ) {
      return res.status(404).json({
        success: false,
        message: "Incident image not found",
      });
    }

    const contentTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const contentType = contentTypes[path.extname(filename).toLowerCase()];
    if (!contentType) {
      return res.status(404).json({
        success: false,
        message: "Incident image not found",
      });
    }

    const root = await fs.promises.realpath(uploadsDirectory);
    const candidate = path.resolve(root, filename);
    const resolvedFile = await fs.promises.realpath(candidate);
    const relative = path.relative(root, resolvedFile);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      return res.status(404).json({
        success: false,
        message: "Incident image not found",
      });
    }

    const fileStat = await fs.promises.stat(resolvedFile);
    if (!fileStat.isFile()) {
      return res.status(404).json({
        success: false,
        message: "Incident image not found",
      });
    }

    res.set("Cache-Control", "private, no-store");
    res.set("Content-Type", contentType);
    res.set("X-Content-Type-Options", "nosniff");
    return res.sendFile(resolvedFile, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({
          success: false,
          message: "Incident image not found",
        });
      }
    });
  } catch (error) {
    if (error.name === "CastError" || error.code === "ENOENT") {
      return res.status(404).json({
        success: false,
        message: "Incident image not found",
      });
    }
    console.error("Get incident image failed");
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve incident image",
    });
  }
};

// --------------------------------------------------
// EXPORT CONTROLLERS
// --------------------------------------------------

  return { createIncident, getIncidents, getIncidentImage, updateIncidentStatus, getIncidentByTrackingReference };
}

module.exports = {
  createIncidentController,
  ...createIncidentController(),
};
