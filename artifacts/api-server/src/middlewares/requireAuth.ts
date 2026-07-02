import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    // Use the pino-http request-scoped logger for correlation ID (reqId)
    (req as any).log?.warn(
      { method: req.method, path: req.path },
      "Auth: missing or invalid session token — 401",
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthenticatedRequest).userId = userId;
  next();
};
