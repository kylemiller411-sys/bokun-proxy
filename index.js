import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";
import serverless from "serverless-http";

console.log("🚀 Starting Bokun Proxy...");

const app = express();
app.use(express.json());

// ✅ Your real keys
const BOKUN_ACCESS_KEY = "ba609852b16b4a809ead8400f0a71c79";
const BOKUN_SECRET_KEY = "df3da766cf4a4ed5baf4c49ac6916077";

// ✅ Proxy key
const PROXY_KEY = "AFoxGPT2025Secret!";

const BOKUN_BASE = "https://api.bokun.io";

// Helper: UTC date in Bokun format
function bokunDate() {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace("T", " ");
}

// Helper: HMAC-SHA1 signature
function bokunSign(method, path, date, secret) {
  const stringToSign = date + method.toUpperCase() + path;
  console.log("📝 Signing:", stringToSign);
  return crypto.createHmac("sha1", secret).update(stringToSign).digest("base64");
}

// Middleware: check proxy key
app.use((req, res, next) => {
  console.log("🔑 Incoming headers:", req.headers);
  if (req.headers["x-proxy-key"] !== PROXY_KEY) {
    console.warn("❌ Unauthorized request");
    return res.status(401).json({ error: "Unauthorized" });
  }
  console.log("✅ Proxy key accepted");
  next();
});

// Root route
app.get("/", (req, res) => {
  console.log("📡 GET / called with query:", req.query);

  if (!req.query.action) {
    return res.json({
      ok: true,
      message: "Proxy is alive!",
      usage: {
        availability: "/?action=availability&productId=XXX&date=YYYY-MM-DD",
        book: "POST /?action=book with JSON body"
      }
    });
  }
  res.status(400).json({ error: "Invalid action" });
});

// Availability endpoint
app.get("/", async (req, res, next) => {
  if (req.query.action !== "availability") return next();

  console.log("📅 Availability check:", req.query);

  const { productId, date, adults = 1, children = 0 } = req.query;
  if (!productId || !date) {
    console.error("⚠️ Missing productId or date");
    return res.status(400).json({ error: "Missing productId or date" });
  }

  const method = "GET";
  const path = `/booking-api/availability?productId=${encodeURIComponent(productId)}&date=${encodeURIComponent(date)}&adults=${adults}&children=${children}`;
  const dateHeader = bokunDate();
  const signature = bokunSign(method, path, dateHeader, BOKUN_SECRET_KEY);

  try {
    const response = await fetch(BOKUN_BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Bokun-Date": dateHeader,
        "X-Bokun-AccessKey": BOKUN_ACCESS_KEY,
        "X-Bokun-Signature": signature
      }
    });

    console.log("📡 Bokun response status:", response.status);
    const data = await response.json();
    console.log("✅ Bokun response received");
    res.json(data);
  } catch (e) {
    console.error("💥 Error talking to Bokun:", e.message);
    res.status(502).json({ error: "Upstream error", detail: e.message });
  }
});

// Booking endpoint
app.post("/", async (req, res, next) => {
  if (req.query.action !== "book") return next();

  console.log("📝 Booking request body:", req.body);

  const { productId, date, slotStart, pax, customer } = req.body;
  if (!productId || !date || !slotStart || !pax || !customer?.name || !customer?.email) {
    console.error("⚠️ Missing booking fields");
    return res.status(400).json({ error: "Missing required booking fields" });
  }

  const payload = {
    productId,
    date,
    startTime: slotStart,
    pax,
    customer,
    payment: { currency: "EUR", offlineOk: false }
  };

  const method = "POST";
  const path = "/booking-api/bookings";
  const dateHeader = bokunDate();
  const signature = bokunSign(method, path, dateHeader, BOKUN_SECRET_KEY);

  try {
    const response = await fetch(BOKUN_BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Bokun-Date": dateHeader,
        "X-Bokun-AccessKey": BOKUN_ACCESS_KEY,
        "X-Bokun-Signature": signature
      },
      body: JSON.stringify(payload)
    });

    console.log("📡 Bokun booking response status:", response.status);
    const data = await response.json();
    console.log("✅ Booking created");
    res.json(data);
  } catch (e) {
    console.error("💥 Error creating booking:", e.message);
    res.status(502).json({ error: "Upstream error", detail: e.message });
  }
});

// Export handler for Vercel
export default serverless(app);
