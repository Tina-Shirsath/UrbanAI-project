const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const AUTH_COOKIE = "urbanai_admin";
const CSRF_COOKIE = "urbanai_csrf";
const AUTH_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 10;

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return [];
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        return [[key, decodeURIComponent(value)]];
      } catch {
        return [];
      }
    })
  );
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

async function hashAdminPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function appendCookie(res, name, value, { httpOnly, secure, maxAge }) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ];
  if (httpOnly) attributes.push("HttpOnly");
  if (secure) attributes.push("Secure");
  res.append("Set-Cookie", attributes.join("; "));
}

function clearCookie(res, name, { httpOnly, secure }) {
  const attributes = [
    `${name}=`,
    "Path=/",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (httpOnly) attributes.push("HttpOnly");
  if (secure) attributes.push("Secure");
  res.append("Set-Cookie", attributes.join("; "));
}

function createAdminAuth(config = {}) {
  const username = config.username || "";
  const passwordHash = config.passwordHash || "";
  const tokenSecret = config.tokenSecret || "";
  const frontendOrigin = config.frontendOrigin || "http://localhost:5173";
  const secure = config.secureCookies ?? config.nodeEnv === "production";
  const requestedTtl = Number(config.tokenTtlSeconds || 900);
  const tokenTtlSeconds = Number.isInteger(requestedTtl) && requestedTtl > 0
    ? Math.min(requestedTtl, AUTH_COOKIE_MAX_AGE_SECONDS)
    : 900;
  const loginFailures = new Map();

  const configReady = Boolean(
    username &&
    tokenSecret.length >= 32 &&
    /^scrypt\$[a-f0-9]{32,128}\$[a-f0-9]{128}$/i.test(passwordHash)
  );

  function unavailable(res) {
    return res.status(503).json({
      success: false,
      message: "Administrator authentication is not configured",
    });
  }

  function checkOrigin(req, res, next) {
    const origin = req.get("origin");
    if (origin && origin !== frontendOrigin) {
      return res.status(403).json({
        success: false,
        message: "Request origin is not allowed",
      });
    }
    return next();
  }

  async function verifyPassword(password) {
    const [, salt, expectedHex] = passwordHash.split("$");
    const expected = Buffer.from(expectedHex, "hex");
    const actual = await scrypt(password, Buffer.from(salt, "hex"), expected.length);
    return crypto.timingSafeEqual(expected, actual);
  }

  function createAuthToken(subject) {
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      sub: subject,
      iat: now,
      exp: now + tokenTtlSeconds,
    })).toString("base64url");
    return `${payload}.${sign(payload, tokenSecret)}`;
  }

  function verifyAuthToken(token) {
    if (typeof token !== "string") return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    if (!safeEqual(signature, sign(payload, tokenSecret))) return null;

    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (
        claims.sub !== username ||
        !Number.isInteger(claims.exp) ||
        claims.exp <= Math.floor(Date.now() / 1000)
      ) return null;
      return claims;
    } catch {
      return null;
    }
  }

  function isValidCsrfToken(token) {
    if (typeof token !== "string") return false;
    const [random, signature, extra] = token.split(".");
    return Boolean(
      random && signature && !extra &&
      safeEqual(signature, sign(`csrf:${random}`, tokenSecret))
    );
  }

  async function login(req, res) {
    if (!configReady) return unavailable(res);
    const now = Date.now();
    if (loginFailures.size > 5000) {
      for (const [key, value] of loginFailures) {
        if (now - value.startedAt >= LOGIN_FAILURE_WINDOW_MS) {
          loginFailures.delete(key);
        }
      }
    }
    const clientKey = req.ip || req.socket.remoteAddress || "unknown";
    let attempt = loginFailures.get(clientKey);
    if (!attempt || now - attempt.startedAt >= LOGIN_FAILURE_WINDOW_MS) {
      attempt = { startedAt: now, failures: 0 };
      loginFailures.set(clientKey, attempt);
    }
    if (attempt.failures >= LOGIN_FAILURE_LIMIT) {
      const retryAfter = Math.ceil(
        (LOGIN_FAILURE_WINDOW_MS - (now - attempt.startedAt)) / 1000
      );
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message: "Too many failed sign-in attempts",
      });
    }

    const { username: suppliedUsername, password } = req.body || {};
    if (
      typeof suppliedUsername !== "string" ||
      typeof password !== "string" ||
      !safeEqual(suppliedUsername, username)
    ) {
      attempt.failures += 1;
      return res.status(401).json({
        success: false,
        message: "Invalid administrator credentials",
      });
    }

    let passwordMatches = false;
    try {
      passwordMatches = await verifyPassword(password);
    } catch {
      return unavailable(res);
    }
    if (!passwordMatches) {
      attempt.failures += 1;
      return res.status(401).json({
        success: false,
        message: "Invalid administrator credentials",
      });
    }
    loginFailures.delete(clientKey);

    const random = crypto.randomBytes(32).toString("base64url");
    const csrfToken = `${random}.${sign(`csrf:${random}`, tokenSecret)}`;
    appendCookie(res, AUTH_COOKIE, createAuthToken(username), {
      httpOnly: true,
      secure,
      maxAge: tokenTtlSeconds,
    });
    appendCookie(res, CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      maxAge: tokenTtlSeconds,
    });

    return res.status(200).json({
      success: true,
      csrfToken,
      expiresIn: tokenTtlSeconds,
    });
  }

  function requireAdmin(req, res, next) {
    if (!configReady) return unavailable(res);
    const token = parseCookies(req.headers.cookie)[AUTH_COOKIE];
    const claims = verifyAuthToken(token);
    if (!claims) {
      return res.status(401).json({
        success: false,
        message: "Administrator authentication required",
      });
    }
    req.admin = { username: claims.sub };
    return next();
  }

  function requireCsrf(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = req.get("x-csrf-token");
    if (
      !cookieToken ||
      !headerToken ||
      !safeEqual(cookieToken, headerToken) ||
      !isValidCsrfToken(cookieToken)
    ) {
      return res.status(403).json({
        success: false,
        message: "A valid CSRF token is required",
      });
    }
    return next();
  }

  function logout(req, res) {
    clearCookie(res, AUTH_COOKIE, { httpOnly: true, secure });
    clearCookie(res, CSRF_COOKIE, { httpOnly: false, secure });
    return res.status(200).json({ success: true, message: "Signed out" });
  }

  return { login, logout, requireAdmin, requireCsrf, checkOrigin };
}

module.exports = { createAdminAuth, hashAdminPassword };
