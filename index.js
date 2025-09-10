import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";
import serverless from "serverless-http";

console.log("🚀 Proxy starting...");

const app = express();
app.use(express.json());

const BOKUN_ACCESS_KEY = "ba609852b16b4a809ead8400f0a71c79";
const BOKUN_SECRET_KEY = "df3da766cf4a4ed5baf4c49ac6916077";
const PROXY_KEY = "AFoxGPT2025Secret!";
const BOKUN_BASE = "https://api.bokun.io";

function bokunDate() {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace("T", " ");
}

function bokunSign(method, path, date, secret) {
  const stringToSign = date + method.toUpperCase() + path;
  return crypto.createHmac("sha1", secret).update(stringToSign).digest("base64");
}

// ✅ Middleware for proxy key
app.use((req, res, next) => {
  if (req.headers["x-proxy-key"] !== PROXY_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ✅ One GET route handles root + availability
app.get("/", async (req, res) => {
  const action = req.query.action;

  if (!action) {
    return res.json({
      ok: true,
      message: "Proxy is alive!",
      usage: {
        availability: "/?action=availability&productId=XXX&date=YYYY-MM-DD",
        book: "POST /?action=book with JSON body"
      }
    });
  }

  if (action === "availability") {
    const { productId, date, adults = 1, children = 0 } = req.query;
    if (!productId || !date) {
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
      const data = await response.json();
      return res.json(data);
    } catch (e) {
      return res.status(502).json({ error: "Upstream error", detail: e.message });
    }
  }

  return res.status(400).json({ error: "Invalid action" });
});

// ✅ POST booking
app.post("/", async (req, res) => {
  if (req.query.action !== "book") {
    return res.status(400).json({ error: "Invalid action" });
  }

  const { productId, date, slotStart, pax, customer } = req.body;
  if (!productId || !date || !slotStart || !pax || !customer?.name || !customer?.email) {
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
    const data = await response.json();
    return res.json(data);
  } catch (e) {
    return res.status(502).json({ error: "Upstream error", detail: e.message });
  }
});

export default serverless(app);

