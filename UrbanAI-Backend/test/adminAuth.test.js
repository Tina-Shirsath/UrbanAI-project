const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createApp } = require("../app");
const { hashAdminPassword } = require("../middleware/adminAuth");

test("admin access is enforced while citizen report submission remains public", async (t) => {
  const password = "correct horse battery staple";
  const passwordHash = await hashAdminPassword(password);
  const uploadsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "urbanai-uploads-"));
  fs.writeFileSync(path.join(uploadsDirectory, "incident-photo.jpg"), "image-bytes");
  t.after(() => fs.rmSync(uploadsDirectory, { recursive: true, force: true }));

  const storedIncident = {
    _id: "64c13ab0672fe2a1b0c12345",
    description: "A deep pothole",
    category: "pothole",
    severity: "high",
    priority: "urgent",
    location: "Main Road",
    image: "incident-photo.jpg",
    department: "Road Department",
    aiConfidence: 94.2,
    status: "reported",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };

  class MockIncident {
    constructor(fields) {
      Object.assign(this, fields);
      this._id = "incident-created";
    }

    async save() {
      return this;
    }

    static async findOne() {
      return null;
    }

    static find() {
      return { sort: async () => [storedIncident] };
    }

    static async findById(id) {
      if (id === storedIncident._id) return storedIncident;
      if (id === "64c13ab0672fe2a1b0c12347") {
        return { image: "../outside.jpg" };
      }
      return null;
    }

    static async findByIdAndUpdate(id, update, options) {
      if (id !== storedIncident._id) return null;
      Object.assign(storedIncident, update.$set);
      this.lastUpdate = { id, update, options };
      return storedIncident;
    }
  }

  const app = createApp({
    env: {
      ADMIN_USERNAME: "city-admin",
      ADMIN_PASSWORD_HASH: passwordHash,
      AUTH_TOKEN_SECRET: crypto.randomBytes(32).toString("hex"),
      AUTH_TOKEN_TTL_SECONDS: "900",
      FRONTEND_ORIGIN: "http://localhost:5173",
      NODE_ENV: "test",
    },
    IncidentModel: MockIncident,
    uploadsDirectory,
    fetchImpl: async (url) => {
      assert.equal(url, "http://127.0.0.1:8000/predict");
      return new Response(JSON.stringify({
        success: true,
        category: "pothole",
        severity: "high",
        priority: "urgent",
        department: "Road Department",
        confidence: 94.2,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await t.test("rejects incident list and image access without admin credentials", async () => {
    const listResponse = await fetch(`${baseUrl}/api/incidents`);
    assert.equal(listResponse.status, 401);
    assert.deepEqual(await listResponse.json(), {
      success: false,
      message: "Administrator authentication required",
    });

    const imageResponse = await fetch(`${baseUrl}/api/incidents/${storedIncident._id}/image`);
    assert.equal(imageResponse.status, 401);

    const oldStaticResponse = await fetch(`${baseUrl}/uploads/incident-photo.jpg`);
    assert.equal(oldStaticResponse.status, 404);
  });

  await t.test("rejects an incorrect admin password", async () => {
    const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "city-admin", password: "incorrect password" }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Invalid administrator credentials",
    });
    assert.equal(response.headers.get("set-cookie"), null);
  });

  let cookieHeader;
  let csrfToken;
  await t.test("logs an admin in and allows authorized incident reads", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "city-admin", password }),
    });
    assert.equal(loginResponse.status, 200);
    const loginData = await loginResponse.json();
    assert.equal(loginData.success, true);
    csrfToken = loginData.csrfToken;

    const setCookies = loginResponse.headers.getSetCookie();
    assert.equal(setCookies.length, 2);
    assert.match(setCookies[0], /HttpOnly/);
    assert.match(setCookies[0], /SameSite=Strict/);
    cookieHeader = setCookies.map((value) => value.split(";", 1)[0]).join("; ");

    const listResponse = await fetch(`${baseUrl}/api/incidents`, {
      headers: { Cookie: cookieHeader },
    });
    assert.equal(listResponse.status, 200);
    const listData = await listResponse.json();
    assert.equal(listData.count, 1);
    assert.equal(listData.incidents[0]._id, storedIncident._id);
  });

  await t.test("serves only the image attached to an incident after authorization", async () => {
    const imageResponse = await fetch(`${baseUrl}/api/incidents/${storedIncident._id}/image`, {
      headers: { Cookie: cookieHeader },
    });
    assert.equal(imageResponse.status, 200);
    assert.equal(await imageResponse.text(), "image-bytes");
    assert.equal(imageResponse.headers.get("cache-control"), "private, no-store");

    const traversalResponse = await fetch(`${baseUrl}/api/incidents/64c13ab0672fe2a1b0c12347/image`, {
      headers: { Cookie: cookieHeader },
    });
    assert.equal(traversalResponse.status, 404);
    assert.doesNotMatch(await traversalResponse.text(), /outside|uploads|Users/);
  });

  await t.test("rejects unauthenticated incident status updates", async () => {
    const response = await fetch(`${baseUrl}/api/incidents/${storedIncident._id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    assert.equal(response.status, 401);
  });

  await t.test("rejects status updates without a valid CSRF header", async () => {
    const response = await fetch(`${baseUrl}/api/incidents/${storedIncident._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        "X-CSRF-Token": "invalid-token",
      },
      body: JSON.stringify({ status: "resolved" }),
    });
    assert.equal(response.status, 403);
  });

  await t.test("rejects invalid status values and unrelated update fields", async () => {
    const invalidStatus = await fetch(`${baseUrl}/api/incidents/${storedIncident._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ status: "closed" }),
    });
    assert.equal(invalidStatus.status, 400);

    const extraField = await fetch(`${baseUrl}/api/incidents/${storedIncident._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ status: "resolved", priority: "urgent" }),
    });
    assert.equal(extraField.status, 400);

    const invalidId = await fetch(`${baseUrl}/api/incidents/not-an-object-id/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ status: "resolved" }),
    });
    assert.equal(invalidId.status, 400);
  });

  await t.test("returns not found for a valid ID with no incident", async () => {
    const response = await fetch(`${baseUrl}/api/incidents/64c13ab0672fe2a1b0c12346/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ status: "resolved" }),
    });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).message, "Incident not found");
  });

  await t.test("updates only status when an authorized CSRF-protected request succeeds", async () => {
    const originalDescription = storedIncident.description;
    const originalPriority = storedIncident.priority;
    const response = await fetch(`${baseUrl}/api/incidents/${storedIncident._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ status: "in_progress" }),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.success, true);
    assert.equal(data.incident.status, "in_progress");
    assert.equal(storedIncident.description, originalDescription);
    assert.equal(storedIncident.priority, originalPriority);
    assert.deepEqual(MockIncident.lastUpdate.update, { $set: { status: "in_progress" } });
    assert.equal(MockIncident.lastUpdate.options.runValidators, true);
  });

  await t.test("keeps citizen report creation and its response contract public", async () => {
    const form = new FormData();
    form.set("description", "A pothole in the road");
    form.set("category", "pothole");
    form.set("location", "Main Road");

    const response = await fetch(`${baseUrl}/api/incidents`, {
      method: "POST",
      body: form,
    });
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.equal(data.success, true);
    assert.ok(data.aiAnalysis);
    assert.ok(data.imageAnalysis);
    assert.ok(data.incident);
    assert.match(data.incident.trackingReference, /^UAI-[A-F0-9]{24}$/);
    assert.equal(data.incident.category, "pothole");
    assert.equal("_id" in data.incident, false);
  });
});
