import { logger } from "./logger";

const BASE = "https://apiv2.shiprocket.in/v1/external";
const EMAIL = process.env["SHIPROCKET_EMAIL"] ?? "";
const PASSWORD = process.env["SHIPROCKET_PASSWORD"] ?? "";
export const PICKUP_LOCATION = process.env["SHIPROCKET_PICKUP_LOCATION"] ?? "Primary";
export const PICKUP_PINCODE = "110049"; // Shahpur Jat, New Delhi

let _cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now) return _cachedToken.value;

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Shiprocket auth returned no token");

  _cachedToken = { value: data.token, expiresAt: now + 23 * 60 * 60 * 1000 };
  return data.token;
}

export interface ShiprocketRateResult {
  chargeInPaise: number;
  courierName: string;
}

export async function getShippingRates(
  deliveryPincode: string,
  weightKg: number,
  orderValueRupees: number,
  cod = false,
): Promise<ShiprocketRateResult | null> {
  if (!EMAIL || !PASSWORD) return null;

  try {
    const token = await getToken();
    const params = new URLSearchParams({
      pickup_postcode: PICKUP_PINCODE,
      delivery_postcode: deliveryPincode,
      weight: String(Math.max(0.1, weightKg)),
      length: "35",
      breadth: "30",
      height: "5",
      cod: cod ? "1" : "0",
      declared_value: String(Math.ceil(orderValueRupees)),
    });

    const res = await fetch(`${BASE}/courier/serviceability/?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Shiprocket rate fetch failed");
      return null;
    }

    const data = (await res.json()) as {
      data?: {
        available_courier_companies?: Array<{
          courier_name?: string;
          freight_charge?: number;
          rate?: number;
          is_recommended?: number; // 1 = Shiprocket's recommended courier for this route
        }>;
      };
    };

    const couriers = data?.data?.available_courier_companies ?? [];
    if (couriers.length === 0) return null;

    // Prefer Shiprocket's recommended courier — it matches what gets assigned at shipment time.
    // Falling back to cheapest causes under-collection when only a premium courier is available.
    const recommended = couriers.find(c => c.is_recommended === 1);
    const best = recommended ?? [...couriers].sort(
      (a, b) => (a.freight_charge ?? a.rate ?? 9999) - (b.freight_charge ?? b.rate ?? 9999),
    )[0];

    const rateRupees = best.freight_charge ?? best.rate ?? 0;

    return {
      chargeInPaise: Math.round(rateRupees * 100),
      courierName: best.courier_name ?? "Standard Delivery",
    };
  } catch (e) {
    logger.error({ e }, "Error fetching Shiprocket rates");
    return null;
  }
}

export interface ShiprocketItem {
  name: string;
  sku: string;
  units: number;
  sellingPrice: number;
}

export interface ShiprocketOrderInput {
  orderId: number;
  orderDate: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  items: ShiprocketItem[];
  totalInRupees: number;
  paymentMethod?: "online" | "cod";
}

export interface ShiprocketOrderResult {
  shiprocketOrderId: string | null;
  shiprocketShipmentId: string | null;
  awb: string | null;
  trackingUrl: string | null;
  errorMessage: string | null;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "." };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export async function createShiprocketOrder(
  input: ShiprocketOrderInput,
  orderIdSuffix?: string,
): Promise<ShiprocketOrderResult> {
  if (!EMAIL || !PASSWORD) {
    logger.warn("Shiprocket not configured — skipping shipment creation");
    return { shiprocketOrderId: null, shiprocketShipmentId: null, awb: null, trackingUrl: null, errorMessage: "Shiprocket credentials not configured" };
  }

  const token = await getToken();
  const { first, last } = splitName(input.customerName);

  const totalWeight = Math.max(0.1, input.items.reduce((s, i) => s + i.units * 0.4, 0));
  const orderId = orderIdSuffix ? `KASHA-${input.orderId}-${orderIdSuffix}` : `KASHA-${input.orderId}`;

  const body = {
    order_id: orderId,
    order_date: input.orderDate.toISOString().replace("T", " ").slice(0, 19),
    pickup_location: PICKUP_LOCATION,
    billing_customer_name: first,
    billing_last_name: last,
    billing_address: input.shippingAddress,
    billing_city: input.shippingCity,
    billing_pincode: input.shippingPostalCode,
    billing_state: input.shippingState,
    billing_country: "India",
    billing_email: input.customerEmail,
    billing_phone: input.customerPhone.replace(/\D/g, "").slice(-10),
    shipping_is_billing: true,
    order_items: input.items.map((it) => ({
      name: it.name,
      sku: it.sku || "KASHA-SKU",
      units: it.units,
      selling_price: it.sellingPrice,
      discount: 0,
      tax: 0,
      hsn: 61099010,
    })),
    payment_method: input.paymentMethod === "cod" ? "COD" : "Prepaid",
    sub_total: input.totalInRupees,
    length: 35,
    breadth: 30,
    height: 5,
    weight: totalWeight,
  };

  const res = await fetch(`${BASE}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    order_id?: number | string;
    shipment_id?: number | string;
    awb_code?: string;
    courier_name?: string;
    message?: string;
    errors?: Record<string, string[]> | string[] | string;
  };

  // Shiprocket sometimes returns HTTP 200 but with validation errors and no order_id.
  // Extract a human-readable error message from the response regardless of HTTP status.
  function extractError(): string | null {
    if (!data.errors && !data.message) return null;
    if (typeof data.errors === "object" && !Array.isArray(data.errors)) {
      const msgs = Object.entries(data.errors as Record<string, string[]>)
        .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
        .join("; ");
      return msgs || data.message || null;
    }
    if (Array.isArray(data.errors)) return (data.errors as string[]).join("; ");
    if (typeof data.errors === "string") return data.errors;
    return data.message ?? null;
  }

  if (!res.ok) {
    const errorMessage = extractError() ?? `HTTP ${res.status}`;
    logger.error({ status: res.status, data, srOrderId: orderId }, "Shiprocket order creation failed");
    return { shiprocketOrderId: null, shiprocketShipmentId: null, awb: null, trackingUrl: null, errorMessage };
  }

  // HTTP 200 but Shiprocket may still include errors with no order_id
  if (!data.order_id) {
    const errorMessage = extractError() ?? "Shiprocket returned no order ID (possible duplicate or validation error)";
    logger.error({ data, srOrderId: orderId }, "Shiprocket 200 but no order_id");
    return { shiprocketOrderId: null, shiprocketShipmentId: null, awb: null, trackingUrl: null, errorMessage };
  }

  logger.info({ orderId: input.orderId, srOrder: data.order_id, shipmentId: data.shipment_id }, "Shiprocket order created");

  const awb = data.awb_code ?? null;
  const trackingUrl = awb ? `https://shiprocket.co/tracking/${awb}` : null;
  const shiprocketShipmentId = data.shipment_id ? String(data.shipment_id) : null;

  return {
    shiprocketOrderId: String(data.order_id),
    shiprocketShipmentId,
    awb,
    trackingUrl,
    errorMessage: null,
  };
}

/**
 * Request a pickup from Shiprocket for the given shipment ID.
 * Returns { success, message } — success=true means pickup was scheduled.
 */
export async function requestShiprocketPickup(shipmentId: string): Promise<{ success: boolean; message: string }> {
  if (!EMAIL || !PASSWORD) return { success: false, message: "Shiprocket credentials not configured" };
  try {
    const token = await getToken();
    const res = await fetch(`${BASE}/courier/generate/pickup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shipment_id: [parseInt(shipmentId, 10)] }),
    });
    const data = (await res.json()) as { pickup_status?: number; response?: { pickup_scheduled_date?: string } };
    if (!res.ok) {
      logger.warn({ status: res.status, shipmentId, data }, "Shiprocket pickup request failed");
      return { success: false, message: `Shiprocket returned ${res.status}` };
    }
    const scheduled = data.response?.pickup_scheduled_date ?? "";
    return {
      success: true,
      message: scheduled ? `Pickup scheduled for ${scheduled}` : "Pickup request sent to Shiprocket",
    };
  } catch (e) {
    logger.error({ e, shipmentId }, "Error requesting Shiprocket pickup");
    return { success: false, message: "Network error contacting Shiprocket" };
  }
}

/**
 * Fetch a printable shipping label PDF URL from Shiprocket for a given shipment ID.
 * Returns the label URL string or null if unavailable.
 */
export async function getShiprocketLabel(shipmentId: string): Promise<string | null> {
  if (!EMAIL || !PASSWORD) return null;
  try {
    const token = await getToken();
    const res = await fetch(`${BASE}/courier/generate/label`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shipment_id: [parseInt(shipmentId, 10)] }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, shipmentId }, "Shiprocket label generation failed");
      return null;
    }
    const data = (await res.json()) as { label_url?: string; response?: { label_url?: string } };
    return data.label_url ?? data.response?.label_url ?? null;
  } catch (e) {
    logger.error({ e, shipmentId }, "Error fetching Shiprocket label");
    return null;
  }
}
