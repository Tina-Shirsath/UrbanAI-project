const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createApp } = require("../app");
const { hashAdminPassword } = require("../middleware/adminAuth");
const Incident = require("../models/Incident");
const {
  areCategoriesCompatible,
  tokenizeText,
  computeDescriptionSimilarity,
  calculateDistanceMeters,
  isValidCoordinates,
  evaluateDuplicateMatch,
  findPotentialDuplicates,
} = require("../utils/duplicateDetection");

test("duplicateDetection unit functions", async (t) => {
  await t.test("areCategoriesCompatible matches identical and related groups", () => {
    assert.equal(areCategoriesCompatible("pothole", "pothole"), true);
    assert.equal(areCategoriesCompatible("pothole", "road_damage"), true);
    assert.equal(areCategoriesCompatible("road_damage", "pothole"), true);
    assert.equal(areCategoriesCompatible("drainage", "water_leakage"), true);
    assert.equal(areCategoriesCompatible("water_leakage", "drainage"), true);
    assert.equal(areCategoriesCompatible("pothole", "streetlight"), false);
    assert.equal(areCategoriesCompatible("garbage", "drainage"), false);
    assert.equal(areCategoriesCompatible("", "pothole"), false);
  });

  await t.test("tokenizeText removes stopwords and punctuation", () => {
    const tokens = tokenizeText("There is a huge pothole in front of the road!!");
    assert.ok(tokens.has("huge"));
    assert.ok(tokens.has("pothole"));
    assert.equal(tokens.has("the"), false);
    assert.equal(tokens.has("of"), false);
  });

  await t.test("computeDescriptionSimilarity gives high score for identical or similar text", () => {
    const simIdentical = computeDescriptionSimilarity(
      "Deep dangerous pothole near junction",
      "Deep dangerous pothole near junction"
    );
    assert.equal(simIdentical, 1.0);

    const simClose = computeDescriptionSimilarity(
      "Dangerous deep pothole near junction breaking car tires",
      "Deep dangerous pothole near junction breaking tires"
    );
    assert.ok(simClose > 0.60);

    const simDifferent = computeDescriptionSimilarity(
      "Street light not working in the park",
      "Garbage pile overflowing with waste near market"
    );
    assert.ok(simDifferent < 0.2);
  });

  await t.test("calculateDistanceMeters calculates accurate distance using Haversine", () => {
    // London Eye to Big Ben ~ 700m
    const d = calculateDistanceMeters(51.5033, -0.1195, 51.5007, -0.1246);
    assert.ok(d > 400 && d < 700);

    // Exact same point
    assert.equal(calculateDistanceMeters(12.9716, 77.5946, 12.9716, 77.5946), 0);

    // Invalid coordinates return null
    assert.equal(calculateDistanceMeters(null, 77, 12, 77), null);
    assert.equal(calculateDistanceMeters(95, 77, 12, 77), null); // latitude > 90
    assert.equal(calculateDistanceMeters(12, 77, 12, 190), null); // longitude > 180
  });

  await t.test("isValidCoordinates validates bounds and finite numbers", () => {
    assert.equal(isValidCoordinates(12.5, 77.5), true);
    assert.equal(isValidCoordinates(-90, 180), true);
    assert.equal(isValidCoordinates(90.1, 77), false);
    assert.equal(isValidCoordinates(12, -180.1), false);
    assert.equal(isValidCoordinates(NaN, 77), false);
    assert.equal(isValidCoordinates("12", "77"), false);
  });

  await t.test("evaluateDuplicateMatch handles genuine duplicates with coordinates", () => {
    const candidate = {
      description: "Severe broken road and deep pothole causing traffic jam",
      category: "pothole",
      latitude: 12.9716,
      longitude: 77.5946,
      location: "MG Road Junction",
    };
    const existing = {
      _id: "existing-1",
      trackingReference: "UAI-AAAAAAAAAAAAAAAAAAAAAAAA",
      description: "Severe pothole and broken road at junction",
      category: "road_damage", // compatible category
      latitude: 12.9720,
      longitude: 77.5950, // ~60m away
      location: "MG Road Near Signal",
    };

    const match = evaluateDuplicateMatch(candidate, existing);
    assert.ok(match !== null);
    assert.equal(match.matchedIncidentId, "existing-1");
    assert.ok(match.similarityScore > 0.5);
    assert.ok(match.distanceMeters < 100);
    assert.match(match.matchReason, /proximity|Nearby/i);
  });

  await t.test("evaluateDuplicateMatch handles similar descriptions with different incompatible categories", () => {
    const candidate = {
      description: "Severe broken water leakage flooding the street",
      category: "water_leakage",
      latitude: 12.9716,
      longitude: 77.5946,
    };
    const existing = {
      _id: "existing-2",
      description: "Severe broken streetlight blinking and sparking",
      category: "streetlight", // incompatible
      latitude: 12.9716,
      longitude: 77.5946,
    };

    const match = evaluateDuplicateMatch(candidate, existing);
    assert.equal(match, null);
  });

  await t.test("evaluateDuplicateMatch handles complaints that are not duplicates", () => {
    const candidate = {
      description: "Overflowing trash bin with foul smell",
      category: "garbage",
      latitude: 12.9716,
      longitude: 77.5946,
    };
    const existing = {
      _id: "existing-3",
      description: "Broken streetlight pole on 5th cross",
      category: "streetlight",
      latitude: 12.9716,
      longitude: 77.5946,
    };

    const match = evaluateDuplicateMatch(candidate, existing);
    assert.equal(match, null);
  });

  await t.test("evaluateDuplicateMatch handles reports with missing coordinates", () => {
    const candidate = {
      description: "Streetlight not working on 5th Cross opposite community hall",
      category: "streetlight",
      location: "5th Cross opposite community hall",
      // No coordinates
    };
    const existing = {
      _id: "existing-4",
      trackingReference: "UAI-BBBBBBBBBBBBBBBBBBBBBBBB",
      description: "Streetlight not working on 5th Cross opposite community hall near gate",
      category: "streetlight",
      location: "5th Cross opposite community hall",
      // No coordinates
    };

    const match = evaluateDuplicateMatch(candidate, existing);
    assert.ok(match !== null);
    assert.equal(match.matchedIncidentId, "existing-4");
    assert.equal(match.distanceMeters, null);
    assert.ok(match.similarityScore >= 0.55);
  });

  await t.test("evaluateDuplicateMatch safely handles invalid coordinates without throwing", () => {
    const candidate = {
      description: "Large drainage overflow on Market Road",
      category: "drainage",
      latitude: "invalid",
      longitude: 999,
    };
    const existing = {
      _id: "existing-5",
      description: "Drainage overflow on Market Road",
      category: "drainage",
      latitude: null,
      longitude: null,
    };

    const match = evaluateDuplicateMatch(candidate, existing);
    // Should fallback safely to text similarity
    assert.ok(match !== null);
    assert.equal(match.distanceMeters, null);
  });
});

test("duplicate complaint detection integration in incident creation", async (t) => {
  const existingIncident = {
    _id: "64c13ab0672fe2a1b0c11111",
    trackingReference: "UAI-111111111111111111111111",
    description: "Huge pothole causing traffic disruption near city center",
    category: "pothole",
    severity: "high",
    priority: "urgent",
    location: "City Center Circle",
    latitude: 12.9716,
    longitude: 77.5946,
    department: "Road Department",
    status: "reported",
    createdAt: new Date(),
  };

  class DuplicateMockIncident {
    static lastCreated = null;

    constructor(fields) {
      Object.assign(this, fields);
      this._id = "new-duplicate-test-id";
      DuplicateMockIncident.lastCreated = this;
    }

    async save() {
      return this;
    }

    static find(filter) {
      return {
        sort: () => ({
          limit: async () => [existingIncident],
        }),
      };
    }

    static async findOne() {
      return null;
    }
  }

  const passwordHash = await hashAdminPassword("test-password");
  const app = createApp({
    env: {
      ADMIN_USERNAME: "dup-admin",
      ADMIN_PASSWORD_HASH: passwordHash,
      AUTH_TOKEN_SECRET: crypto.randomBytes(32).toString("hex"),
      FRONTEND_ORIGIN: "http://localhost:5173",
      NODE_ENV: "test",
    },
    IncidentModel: DuplicateMockIncident,
    fetchImpl: async () => new Response(JSON.stringify({
      category: "pothole",
      severity: "high",
      priority: "urgent",
      department: "Road Department",
      confidence: 90,
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });

  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await t.test("flags genuine duplicate match and records match details", async () => {
    const form = new FormData();
    form.set("description", "Huge pothole causing traffic disruption near city center circle");
    form.set("category", "pothole");
    form.set("location", "City Center Circle");
    form.set("latitude", "12.9717");
    form.set("longitude", "77.5947");

    const response = await fetch(`${baseUrl}/api/incidents`, { method: "POST", body: form });
    assert.equal(response.status, 201);
    const data = await response.json();

    // Verify response preserves citizen contract
    assert.equal(data.success, true);
    assert.ok(data.trackingReference);
    assert.equal("duplicateMatches" in data.incident, false); // Not exposed in citizen response

    // Verify stored model record has duplicate flag and match info
    assert.equal(DuplicateMockIncident.lastCreated.isPotentialDuplicate, true);
    assert.ok(DuplicateMockIncident.lastCreated.duplicateMatches.length > 0);
    assert.equal(
      String(DuplicateMockIncident.lastCreated.duplicateMatches[0].matchedIncidentId),
      existingIncident._id
    );
    assert.equal(
      DuplicateMockIncident.lastCreated.duplicateMatches[0].matchedTrackingReference,
      existingIncident.trackingReference
    );
    assert.ok(typeof DuplicateMockIncident.lastCreated.duplicateMatches[0].distanceMeters === "number");
  });

  await t.test("does not flag non-duplicate complaint with different category", async () => {
    const form = new FormData();
    form.set("description", "Streetlight on 4th cross is completely dark and broken");
    form.set("category", "other");
    form.set("location", "4th Cross Street");

    const response = await fetch(`${baseUrl}/api/incidents`, { method: "POST", body: form });
    assert.equal(response.status, 201);
    assert.equal(DuplicateMockIncident.lastCreated.isPotentialDuplicate, false);
    assert.equal(DuplicateMockIncident.lastCreated.duplicateMatches.length, 0);
  });

  await t.test("complaint with missing coordinates still detects duplicate based on high text similarity", async () => {
    const form = new FormData();
    form.set("description", "Huge pothole causing traffic disruption near city center circle");
    form.set("category", "pothole");
    form.set("location", "City Center Circle");
    // No latitude or longitude provided

    const response = await fetch(`${baseUrl}/api/incidents`, { method: "POST", body: form });
    assert.equal(response.status, 201);
    assert.equal(DuplicateMockIncident.lastCreated.isPotentialDuplicate, true);
    assert.ok(DuplicateMockIncident.lastCreated.duplicateMatches.length > 0);
    assert.equal(DuplicateMockIncident.lastCreated.duplicateMatches[0].distanceMeters, null);
  });
});
