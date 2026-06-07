import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const ALLOWED_ORIGINS = [
  "https://www.kashaonline.in",
  "https://kashaonline.in",
  "https://e-commerce-master-build-api-server.vercel.app",
  /\.vercel\.app$/,
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /localhost/,
];

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = ALLOWED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      callback(null, allowed ? origin : false);
    },
  }),
);
app.use(express.json({
  limit: "20mb",
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(clerkMiddleware());

// Resolve public dir relative to this file so the path is correct whether the
// server is started from the workspace root (production) or the artifact dir
// (development).  In both cases the compiled bundle lives in dist/, so ".."
// lands in artifacts/api-server/public/.
const __appDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__appDir, "..", "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// Smart image serving: WebP negotiation + long-term cache headers
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif"]);
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

app.use("/api/public", (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return next();

  const absPath = path.join(publicDir, req.path);
  const webpPath = absPath.replace(/\.[^.]+$/, ".webp");
  const acceptsWebP = (req.headers["accept"] ?? "").includes("image/webp");

  const serveFile = (filePath: string, mime: string) => {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Robots-Tag", "noindex, noarchive");
    res.setHeader("Content-Type", mime);
    res.sendFile(filePath);
  };

  if (acceptsWebP && fs.existsSync(webpPath)) {
    return serveFile(webpPath, "image/webp");
  }
  if (fs.existsSync(absPath)) {
    return serveFile(absPath, MIME[ext] ?? "application/octet-stream");
  }
  next();
});

// Non-image static files (models, etc.)
app.use("/api/public", express.static(publicDir, { maxAge: "365d", immutable: true }));

app.use("/api", router);

export default app;
