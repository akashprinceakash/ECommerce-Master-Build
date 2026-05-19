import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";

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
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(clerkMiddleware());

const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use("/api/public", express.static(publicDir));

app.use("/api", router);

export default app;
