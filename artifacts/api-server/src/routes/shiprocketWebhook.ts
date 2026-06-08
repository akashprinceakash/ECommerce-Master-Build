import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, ordersTable, orderEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const WEBHOOK_SECRET = process.env["SHIPROCKET_WEBHOOK_SECRET"] ?? "";

const SHIPROCKET_STATUS_MAP: Record<string, { appStatus: string; eventType: string; title: string }> = {
  "awb assigned":             { appStatus: "processing",       eventType: "awb_assigned",        title: "AWB Assigned" },
  "pickup scheduled":         { appStatus: "ready_to_ship",    eventType: "pickup_scheduled",    title: "Pickup Scheduled" },
  "pickup generated":         { appStatus: "ready_to_ship",    eventType: "pickup_scheduled",    title: "Pickup Scheduled" },
  "out for pickup":           { appStatus: "ready_to_ship",    eventType: "pickup_scheduled",    title: "Out for Pickup" },
  "picked up":                { appStatus: "shipped",          eventType: "picked_up",           title: "Picked Up" },
  "in transit":               { appStatus: "in_transit",       eventType: "in_transit",          title: "In Transit" },
  "reached at destination hub":{ appStatus: "in_transit",      eventType: "in_transit",          title: "Reached Destination Hub" },
  "out for delivery":         { appStatus: "out_for_delivery", eventType: "out_for_delivery",    title: "Out for Delivery" },
  "delivered":                { appStatus: "delivered",        eventType: "delivered",           title: "Delivered" },
  "rto initiated":            { appStatus: "returned",         eventType: "rto_initiated",       title: "Return Initiated" },
  "rto":                      { appStatus: "returned",         eventType: "returned",            title: "Returned to Origin" },
  "rto delivered":            { appStatus: "returned",         eventType: "returned",            title: "Returned to Warehouse" },
  "cancelled":                { appStatus: "cancelled",        eventType: "cancelled",           title: "Cancelled" },
  "shipment cancelled":       { appStatus: "cancelled",        eventType: "cancelled",           title: "Shipment Cancelled" },
};

// Status ordering — only progress forward, never regress (except cancelled/returned).
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

/**
 * POST /webhooks/shiprocket
 * Shiprocket sends this when a shipment status changes.
 * Configure webhook URL in Shiprocket dashboard → Settings → Webhooks.
 * Optionally set SHIPROCKET_WEBHOOK_SECRET env var and configure the same token in Shiprocket.
 */
router.post("/webhooks/shiprocket", async (req, res) => {
  res.status(200).json({ ok: true }); // Respond immediately to avoid timeout retries

  try {
    // Optional secret validation — checks all headers Shiprocket may use
    if (WEBHOOK_SECRET) {
      const headerToken =
        (req.headers["x-api-key"] as string | undefined) ??
        (req.headers["x-shiprocket-api-token"] as string | undefined) ??
        req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
      const bodyToken = req.body?.token as string | undefined;
      if (headerToken !== WEBHOOK_SECRET && bodyToken !== WEBHOOK_SECRET) {
        logger.warn("Shiprocket webhook: secret mismatch — skipping");
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

    // Find the order — look up by AWB first, then by Shiprocket order ID
    let order: typeof ordersTable.$inferSelect | null = null;
    if (awb) {
      const [found] = await db.select().from(ordersTable).where(eq(ordersTable.shiprocketAwb, awb)).limit(1);
      order = found ?? null;
    }
    if (!order && shiprocketOrderIdFromPayload) {
      const [found] = await db.select().from(ordersTable).where(eq(ordersTable.shiprocketOrderId, shiprocketOrderIdFromPayload)).limit(1);
      order = found ?? null;
    }
    // Also try matching the AWB in shiprocketShipmentId if payload.shipment_id is present
    if (!order && payload.shipment_id) {
      const [found] = await db.select().from(ordersTable).where(eq(ordersTable.shiprocketShipmentId, String(payload.shipment_id))).limit(1);
      order = found ?? null;
    }

    if (!order) {
      logger.warn({ awb, shiprocketOrderIdFromPayload }, "Shiprocket webhook: no matching order found");
      return;
    }

    // Update AWB if newly assigned and we don't have it yet
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

    // Always record an event
    const eventType = mapping?.eventType ?? "status_updated";
    const title = mapping?.title ?? `Status: ${payload.current_status}`;
    const description = location ? `Location: ${location}` : null;
    await db.insert(orderEventsTable).values({
      orderId: order.id,
      eventType,
      title,
      description,
    });

    logger.info({ orderId: order.id, eventType, newStatus: updates.status }, "Shiprocket webhook processed");
  } catch (e) {
    logger.error({ e }, "Shiprocket webhook processing error");
  }
});

export default router;
