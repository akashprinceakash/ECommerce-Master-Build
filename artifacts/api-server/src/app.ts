import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app: Express = express();

// ── Trust proxy (Render / load balancer) ─────────────────────────────────────
// Required for express-rate-limit to use the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);

// ── Security headers (helmet) ─────────────────────────────────────────────────
// Removes X-Powered-By, sets X-Frame-Options, X-Content-Type-Options, etc.
// CSP is strict (no HTML served from this API).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ── HTTP request logging ───────────────────────────────────────────────────────
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

// ── CORS ───────────────────────────────────────────────────────────────────────
// Allowlist: production domain + Render/Replit preview domains + localhost.
// Returns false (not null) for unknown origins so browsers get a proper rejection.
//
// To verify CORS headers in production (no app running needed):
//   curl -I -H "Origin: https://kashaonline.in" \
//        -H "Access-Control-Request-Method: GET" \
//        -X OPTIONS https://kashaonline.in/api/healthz
// Expected: Access-Control-Allow-Origin: https://kashaonline.in
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
      if (!allowed) {
        logger.warn({ origin }, "CORS: rejected unknown origin");
      }
      callback(null, allowed ? origin : false);
    },
  }),
);

// ── Body parsing (size limits) ────────────────────────────────────────────────
// Customization write routes: 50 MB override MUST be registered BEFORE the global
// 5 MB parser — Express runs middleware in registration order, so if the global
// parser runs first it will reject large bodies before any route-level parser sees them.
app.use("/api/customizations", (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    return express.json({
      limit: "50mb",
      verify: (r, _res, buf) => { (r as any).rawBody = buf; },
    })(req, res, next);
  }
  next();
});

// Global limit: 5 MB for all other JSON bodies. File-upload routes use multer (own limits).
app.use(express.json({
  limit: "5mb",
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ── Auth ───────────────────────────────────────────────────────────────────────
app.use(clerkMiddleware());

// ── Rate limiting ──────────────────────────────────────────────────────────────
// All limits are per-IP. A 429 is returned with Retry-After header.
// Trust proxy (set above) ensures the real IP is used, not the load-balancer IP.

const rateLimitHandler = (req: Request, res: Response) => {
  logger.warn({ ip: req.ip, path: req.path }, "Rate limit exceeded");
  res.status(429).json({ error: "Too many requests — please slow down and try again shortly." });
};

// Strict: payment flow, coupon validation, auth routes — 10 req/min per IP
const strictLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Admin mutations: POST/PATCH/PUT/DELETE on /api/admin/* — 5 req/min per IP
const adminMutationLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Standard: all other API routes — 100 req/min per IP
const standardLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Apply strict limiter to payment, coupon validation, and auth routes
app.use("/api/payment", strictLimiter);
app.use("/api/coupons/validate", strictLimiter);
app.use("/api/auth", strictLimiter);

// Apply admin mutation limiter to admin write endpoints
app.use(["/api/admin"], (req: Request, res: Response, next: NextFunction) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return adminMutationLimiter(req, res, next);
  }
  return next();
});

// Standard limiter for everything else under /api
app.use("/api", standardLimiter);

// ── Static files ──────────────────────────────────────────────────────────────
// Resolve public dir relative to this file so the path is correct whether the
// server is started from the workspace root (production) or the artifact dir.
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

// ── Application routes ────────────────────────────────────────────────────────
app.use("/api", router);

// ── Global error-handling middleware ─────────────────────────────────────────
// Catches any error thrown from route handlers (sync or async via Express 5
// async error propagation). Returns a safe generic response; never leaks stack.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const reqId = (req as any).id;
  logger.error({ err, reqId, method: req.method, path: req.path }, "Unhandled route error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
