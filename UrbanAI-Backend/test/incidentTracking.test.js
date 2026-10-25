const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createApp } = require("../app");
const { hashAdminPassword } = require("../middleware/adminAuth");

const knownIncident = {
  _id: "64c13ab0672fe2a1b0c12345",
  trackingReference: "UAI-0123456789ABCDEF01234567",
  description: "Private description",
  category: "pothole",
  status: "in_progress",
  createdAt: new Date("2026-02-03T12:00:00.000Z"),
  location: "Exact private address",
  image: "private-image.jpg",
  severity: "high",
  priority: "urgent",
  department: "Road Department",
  aiConfidence: 99,
};

class TrackingModel {
  static findOne(filter) {
    const found = filter.trackingReference === knownIncident.trackingReference ? knownIncident : null;
    return { select: async () => found };
  }
}

async function setup(t) {
  const passwordHash = await hashAdminPassword("test-password");
  const app = createApp({
    env: {
      ADMIN_USERNAME: "test-admin",
      ADMIN_PASSWORD_HASH: passwordHash,
      AUTH_TOKEN_SECRET: crypto.randomBytes(32).toString("hex"),
      FRONTEND_ORIGIN: "http://localhost:5173",
      NODE_ENV: "test",
    },
    IncidentModel: TrackingModel,
  });
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test("public complaint tracking validates references and returns a minimal summary", async (t) => {
  const baseUrl = await setup(t);

  await t.test("successful lookup includes only citizen tracking fields", async () => {
    const response = await fetch(`${baseUrl}/api/incidents/track/${knownIncident.trackingReference}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.incident, {
      trackingReference: knownIncident.trackingReference,
      category: "pothole",
      status: "in_progress",
      submittedAt: "2026-02-03T12:00:00.000Z",
    });
    assert.equal("_id" in data.incident, false);
    assert.equal("location" in data.incident, false);
    assert.equal("description" in data.incident, false);
    assert.equal("image" in data.incident, false);
    assert.equal("department" in data.incident, false);
    assert.equal("latitude" in data.incident, false);
    assert.equal("longitude" in data.incident, false);
  });

  await t.test("rejects malformed references", async () => {
    const response = await fetch(`${baseUrl}/api/incidents/track/not-a-reference`);
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /valid tracking reference/i);
  });

  await t.test("returns not found for unknown references", async () => {
    const response = await fetch(`${baseUrl}/api/incidents/track/UAI-FFFFFFFFFFFFFFFFFFFFFFFF`);
    assert.equal(response.status, 404);
    assert.match((await response.json()).message, /No complaint was found/i);
  });

  await t.test("never exposes the admin incident list publicly", async () => {
    const response = await fetch(`${baseUrl}/api/incidents`);
    assert.equal(response.status, 401);
  });
});
