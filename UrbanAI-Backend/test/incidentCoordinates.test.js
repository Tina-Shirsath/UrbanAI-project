const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createApp } = require("../app");
const { hashAdminPassword } = require("../middleware/adminAuth");
const Incident = require("../models/Incident");

class CoordinateIncident {
  static lastSaved = null;

  constructor(fields) {
    Object.assign(this, fields);
    this._id = "coordinate-incident-id";
    CoordinateIncident.lastSaved = this;
  }

  async save() {
    return this;
  }

  static findOne() {
    return {
      then: (resolve, reject) => Promise.resolve(null).then(resolve, reject),
      select: async () => null,
    };
  }
}

async function startServer(t) {
  const passwordHash = await hashAdminPassword("coordinate-test-password");
  const app = createApp({
    env: {
      ADMIN_USERNAME: "coordinate-test-admin",
      ADMIN_PASSWORD_HASH: passwordHash,
      AUTH_TOKEN_SECRET: crypto.randomBytes(32).toString("hex"),
      FRONTEND_ORIGIN: "http://localhost:5173",
      NODE_ENV: "test",
    },
    IncidentModel: CoordinateIncident,
    fetchImpl: async () => new Response(JSON.stringify({
      category: "pothole",
      severity: "medium",
      priority: "normal",
      department: "Road Department",
      confidence: 88,
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function submit(baseUrl, coordinates = {}) {
  const form = new FormData();
  form.set("description", "Pothole near the junction");
  form.set("category", "pothole");
  form.set("location", "Main Road near junction");
  for (const [key, value] of Object.entries(coordinates)) form.set(key, value);
  return fetch(`${baseUrl}/api/incidents`, { method: "POST", body: form });
}

test("incident creation accepts optional coordinate pairs and validates supplied values", async (t) => {
  const baseUrl = await startServer(t);

  await t.test("complaint without coordinates remains valid and preserves text location", async () => {
    const response = await submit(baseUrl);
    assert.equal(response.status, 201);
    assert.equal(CoordinateIncident.lastSaved.location, "Main Road near junction");
    assert.equal("latitude" in CoordinateIncident.lastSaved, false);
    assert.equal("longitude" in CoordinateIncident.lastSaved, false);
  });

  await t.test("valid coordinate pair is stored as numbers, including bounds", async () => {
    const response = await submit(baseUrl, { latitude: "-90", longitude: "180" });
    assert.equal(response.status, 201);
    assert.equal(CoordinateIncident.lastSaved.latitude, -90);
    assert.equal(CoordinateIncident.lastSaved.longitude, 180);
    assert.equal(typeof CoordinateIncident.lastSaved.latitude, "number");
    assert.equal(typeof CoordinateIncident.lastSaved.longitude, "number");
    assert.equal(CoordinateIncident.lastSaved.location, "Main Road near junction");
  });

  await t.test("rejects latitude without longitude", async () => {
    const response = await submit(baseUrl, { latitude: "12.5" });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /provided together/i);
  });

  await t.test("rejects longitude without latitude", async () => {
    const response = await submit(baseUrl, { longitude: "77.5" });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /provided together/i);
  });

  for (const latitude of ["", "abc", "Infinity", "NaN", "1e2", "90.0001", "-90.0001"]) {
    await t.test(`rejects invalid latitude ${JSON.stringify(latitude)}`, async () => {
      const response = await submit(baseUrl, { latitude, longitude: "77.5" });
      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /latitude/i);
    });
  }

  for (const longitude of ["", "abc", "Infinity", "NaN", "1e2", "180.0001", "-180.0001"]) {
    await t.test(`rejects invalid longitude ${JSON.stringify(longitude)}`, async () => {
      const response = await submit(baseUrl, { latitude: "12.5", longitude });
      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /longitude/i);
    });
  }
});

test("Incident schema keeps coordinates optional and validates pairs and bounds", async (t) => {
  const requiredFields = { description: "Pothole", category: "pothole", location: "Main Road" };

  await t.test("existing record shape without coordinates remains valid", async () => {
    await new Incident(requiredFields).validate();
  });

  await t.test("schema accepts a complete coordinate pair", async () => {
    await new Incident({ ...requiredFields, latitude: 90, longitude: -180 }).validate();
  });

  await t.test("schema rejects an incomplete coordinate pair", async () => {
    await assert.rejects(
      new Incident({ ...requiredFields, latitude: 1 }).validate(),
      (error) => error.name === "ValidationError",
    );
  });

  await t.test("schema rejects coordinates outside the geographic bounds", async () => {
    await assert.rejects(
      new Incident({ ...requiredFields, latitude: 0, longitude: 180.01 }).validate(),
      (error) => error.name === "ValidationError",
    );
  });
});
