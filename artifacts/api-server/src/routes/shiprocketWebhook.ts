import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, orderEventsTable } from "@workspace/db";
import { clerkClient } from "@clerk/express";
import { sendOrderStatusUpdate } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const WEBHOOK_SECRET = process.env["SHIPROCKET_WEBHOOK_SECRET"] ?? "";

const SHIPROCKET_STATUS_MAP: Record<string, { appStatus: string; eventType: string; title: string }> = {
  "awb assigned":              { appStatus: "processing",       eventType: "awb_assigned",     title: "AWB Assigned" },
  "pickup scheduled":          { appStatus: "ready_to_ship",    eventType: "pickup_scheduled", title: "Pickup Scheduled" },
  "pickup generated":          { appStatus: "ready_to_ship",    eventType: "pickup_scheduled", title: "Pickup Scheduled" },
  "out for pickup":            { appStatus: "ready_to_ship",    eventType: "pickup_scheduled", title: "Out for Pickup" },
  "picked up":                 { appStatus: "shipped",          eventType: "picked_up",        title: "Picked Up" },
  "in transit":                { appStatus: "in_transit",       eventType: "in_transit",       title: "In Transit" },
  "reached at destination hub":{ appStatus: "in_transit",       eventType: "in_transit",       title: "Reached Destination Hub" },
  "out for delivery":          { appStatus: "out_for_delivery", eventType: "out_for_delivery", title: "Out for Delivery" },
  "delivered":                 { appStatus: "delivered",        eventType: "delivered",        title: "Delivered" },
  "rto initiated":             { appStatus: "returned",         eventType: "rto_initiated",    title: "Return Initiated" },
  "rto":                       { appStatus: "returned",         eventType: "returned",         title: "Returned to Origin" },
  "rto delivered":             { appStatus: "returned",         eventType: "returned",         title: "Returned to Warehouse" },
  "cancelled":                 { appStatus: "cancelled",        eventType: "cancelled",        title: "Cancelled" },
  "shipment cancelled":        { appStatus: "cancelled",        eventType: "cancelled",        title: "Shipment Cancelled" },
};

const STATUS_ORDER = [
  "pending", "confirmed", "processing", "ready_to_ship",
  "shipped", "in_transit", "out_for_delivery", "delivered",
];
function canProgress(current: string, next: string): boolean {
  if (next === "cancelled" || next === "returned") return true;
  const ci = STATUS_ORDER.indexOf(current);
  const ni = STATUS_ORDER.indexOf(next);
  return ci !== -1 && ni !== -1 && ni > ci;
}

// GET — reachability probe
router.get("/webhooks/fulfillment", (_req, res) => {
  res.status(200).json({ ok: true, service: "kasha-fulfillment-webhook" });
});

router.post("/webhooks/fulfillment", async (req, res) => {
  // ── DEBUG BLOCK ──────────────────────────────────────────────────────────
  console.log("=== SHIPROCKET WEBHOOK HIT ===");
  console.log("METHOD:", req.method);
  console.log("URL:", req.url);
  console.log("HEADERS:", JSON.stringify(req.headers, null, 2));
  console.log("BODY:", JSON.stringify(req.body, null, 2));
  console.log("CONTENT-TYPE:", req.headers["content-type"]);
  console.log("WEBHOOK_SECRET configured:", WEBHOOK_SECRET ? `YES (length=${WEBHOOK_SECRET.length})` : "NO");

  if (WEBHOOK_SECRET) {
    const xApiKey    = req.headers["x-api-key"] as string | undefined;
    const xSrToken   = req.headers["x-shiprocket-api-token"] as string | undefined;
    const authHeader = req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
    const bodyToken  = req.body?.token as string | undefined;

    console.log("x-api-key header value:           ", xApiKey   ?? "(not present)");
    console.log("x-shiprocket-api-token header:    ", xSrToken  ?? "(not present)");
    console.log("authorization header (stripped):  ", authHeader ?? "(not present)");
    console.log("body.token:                       ", bodyToken  ?? "(not present)");

    const matched =
      xApiKey   === WEBHOOK_SECRET ||
      xSrToken  === WEBHOOK_SECRET ||
      authHeader === WEBHOOK_SECRET ||
      bodyToken  === WEBHOOK_SECRET;
    console.log("SECRET MATCH:", matched ? "YES ✓" : "NO ✗ — request will be ignored");
  }
  // ── END DEBUG BLOCK ──────────────────────────────────────────────────────

  // Always respond 200 immediately so Shiprocket never retries on our side
  res.status(200).json({ ok: true });

  try {
    // Secret validation
    if (WEBHOOK_SECRET) {
      const headerToken =
        (req.headers["x-api-key"] as string | undefined) ??
        (req.headers["x-shiprocket-api-token"] as string | undefined) ??
        req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
      const bodyToken = req.body?.token as string | undefined;

      if (headerToken !== WEBHOOK_SECRET && bodyToken !== WEBHOOK_SECRET) {
        logger.warn("Shiprocket webhook: secret mismatch — skipping processing");
        return;
      }
    }

    const payload = req.body as {
      awb?: string;
      current_status?: string;
      current_status_id?: number;
      shipment_id?: number | string;
      order_id?: string;
      sr_order_id?: number | string;
      city?: string;
      etd?: string;
    };

    const awb = payload.awb?.trim();
    const rawStatus = payload.current_status?.trim().toLowerCase();
    const shiprocketOrderIdFromPayload = payload.sr_order_id ? String(payload.sr_order_id) : null;
    const location = payload.city?.trim() ?? null;

    logger.info({ awb, rawStatus, shiprocketOrderIdFromPayload }, "Shiprocket webhook received");

    if (!rawStatus) {
      logger.warn({ payload }, "Shiprocket webhook: no current_status in payload");
      return;
    }

    const mapping = SHIPROCKET_STATUS_MAP[rawStatus];
    if (!mapping) {
      logger.info({ rawStatus }, "Shiprocket webhook: unmapped status — recording event only");
    }

    // Find the order — AWB first, then Shiprocket order ID, then shipment ID
    let order: typeof ordersTable.$inferSelect | null = null;
    if (awb) {
      const [found] = await db.select().from(ordersTable).where(eq(ordersTable.shiprocketAwb, awb)).limit(1);
      order = found ?? null;
    }
    if (!order && shiprocketOrderIdFromPayload) {
      const [found] = await db.select().from(ordersTable).where(eq(ordersTable.shiprocketOrderId, shiprocketOrderIdFromPayload)).limit(1);
      order = found ?? null;
    }
    if (!order && payload.shipment_id) {
      const [found] = await db.select().from(ordersTable).where(eq(ordersTable.shiprocketShipmentId, String(payload.shipment_id))).limit(1);
      order = found ?? null;
    }

    if (!order) {
      logger.warn({ awb, shiprocketOrderIdFromPayload }, "Shiprocket webhook: no matching order found");
      return;
    }

    const updates: Partial<typeof ordersTable.$inferInsert> = {};
    if (awb && !order.shiprocketAwb) {
      updates.shiprocketAwb = awb;
      updates.trackingUrl = `https://shiprocket.co/tracking/${awb}`;
    }

    if (mapping) {
      const newStatus = mapping.appStatus;
      if (canProgress(order.status, newStatus)) {
        updates.status = newStatus;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(ordersTable).set(updates).where(eq(ordersTable.id, order.id));
    }

    const eventType = mapping?.eventType ?? "status_updated";
    const title = mapping?.title ?? `Status: ${payload.current_status}`;
    const description = location ? `Location: ${location}` : null;
    await db.insert(orderEventsTable).values({ orderId: order.id, eventType, title, description });

    logger.info({ orderId: order.id, eventType, newStatus: updates.status }, "Shiprocket webhook processed");

    // Send customer notification email for key delivery milestones (fire-and-forget)
    const NOTIFY_STATUSES = new Set(["processing", "ready_to_ship", "shipped", "delivered"]);
    if (updates.status && NOTIFY_STATUSES.has(updates.status)) {
      const finalOrder = { ...order, ...updates };
      void (async () => {
        try {
          const clerkUser = await clerkClient.users.getUser(order.userId);
          const customerEmail =
            clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
            ?? clerkUser.emailAddresses[0]?.emailAddress;
          if (customerEmail) {
            await sendOrderStatusUpdate({
              orderNumber: order.id,
              customerName: order.shippingName,
              customerEmail,
              status: updates.status as "processing" | "ready_to_ship" | "shipped" | "delivered",
              awb: finalOrder.shiprocketAwb ?? null,
              trackingUrl: finalOrder.trackingUrl ?? null,
            });
          }
        } catch (emailErr) {
          logger.error({ orderId: order.id, status: updates.status, emailErr }, "Shiprocket webhook: status notification email failed");
        }
      })();
    }
  } catch (e) {
    logger.error({ e }, "Shiprocket webhook processing error");
  }
});

export default router;
