require("dotenv").config();

const mongoose = require("mongoose");
const { createApp } = require("./app");

const PORT = process.env.PORT || 5000;
const adminConfigReady = Boolean(
  process.env.ADMIN_USERNAME &&
  /^scrypt\$[a-f0-9]{32,128}\$[a-f0-9]{128}$/i.test(
    process.env.ADMIN_PASSWORD_HASH || ""
  ) &&
  (process.env.AUTH_TOKEN_SECRET || "").length >= 32 &&
  process.env.FRONTEND_ORIGIN
);

if (!adminConfigReady) {
  console.error(
    "Backend startup blocked: configure FRONTEND_ORIGIN, ADMIN_USERNAME, ADMIN_PASSWORD_HASH, and AUTH_TOKEN_SECRET."
  );
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
    createApp().listen(PORT, () => {
      console.log(`UrbanAI Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:");
    console.error(error.message);
  });
