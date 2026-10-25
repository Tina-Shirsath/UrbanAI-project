const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },

    trackingReference: {
      type: String,
      unique: true,
      sparse: true,
      match: /^UAI-[A-F0-9]{24}$/,
    },

    category: {
      type: String,
      enum: [
        "road_damage",
        "pothole",
        "garbage",
        "streetlight",
        "water_leakage",
        "drainage",
        "other",
      ],
      required: true,
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    priority: {
      type: String,
      enum: ["low", "normal", "urgent"],
      default: "normal",
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },

    image: {
      type: String,
      default: null,
    },

    department: {
      type: String,
      default: "General Department",
    },

    aiConfidence: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "reported",
        "investigating",
        "in_progress",
        "resolved",
      ],
      default: "reported",
    },

    isPotentialDuplicate: {
      type: Boolean,
      default: false,
      index: true,
    },

    duplicateMatches: [
      {
        matchedIncidentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Incident",
        },
        matchedTrackingReference: {
          type: String,
        },
        similarityScore: {
          type: Number,
        },
        distanceMeters: {
          type: Number,
          default: null,
        },
        matchReason: {
          type: String,
        },
      },
    ],
  },

  {
    timestamps: true,
  }
);

incidentSchema.pre("validate", function validateCoordinatePair() {
  const hasLatitude = this.latitude !== undefined && this.latitude !== null;
  const hasLongitude = this.longitude !== undefined && this.longitude !== null;
  if (hasLatitude !== hasLongitude) {
    const field = hasLatitude ? "longitude" : "latitude";
    this.invalidate(field, "Latitude and longitude must be provided together");
  }
});

const Incident = mongoose.model("Incident", incidentSchema);

module.exports = Incident;
