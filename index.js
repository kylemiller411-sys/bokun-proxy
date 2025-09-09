import express from "express";
import serverless from "serverless-http";

const app = express();
app.use(express.json());

// 🔴 Same proxy key you use in GPT Builder
const PROXY_KEY = "AFoxGPT2025Secret!";

// ✅ Middleware: check proxy key
app.use((req, res, next) => {
  if (req.headers["x-proxy-key"] !== PROXY_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ✅ Root route
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Proxy is alive and running on Vercel!",
    usage: {
      availability: "/?action=availability (disabled in test mode)",
      book: "/?action=book (disabled in test mode)"
    }
  });
});

// ✅ Export handler for Vercel
export default serverless(app);
