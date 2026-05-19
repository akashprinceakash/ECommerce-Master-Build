import { logger } from "./logger";

const BASE = "https://apiv2.shiprocket.in/v1/external";
const EMAIL = process.env["SHIPROCKET_EMAIL"] ?? "";
const PASSWORD = process.env["SHIPROCKET_PASSWORD"] ?? "";
export const PICKUP_LOCATION = process.env["SHIPROCKET_PICKUP_LOCATION"] ?? "Primary";

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
}

export interface ShiprocketOrderResult {
  shiprocketOrderId: string | null;
  awb: string | null;
  trackingUrl: string | null;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "." };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export async function createShiprocketOrder(
  input: ShiprocketOrderInput,
): Promise<ShiprocketOrderResult> {
  if (!EMAIL || !PASSWORD) {
    logger.warn("Shiprocket not configured — skipping shipment creation");
    return { shiprocketOrderId: null, awb: null, trackingUrl: null };
  }

  const token = await getToken();
  const { first, last } = splitName(input.customerName);

  const totalWeight = Math.max(0.1, input.items.reduce((s, i) => s + i.units * 0.4, 0));

  const body = {
    order_id: `KASHA-${input.orderId}`,
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
      hsn: 6109,
    })),
    payment_method: "Prepaid",
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
    errors?: unknown;
  };

  if (!res.ok) {
    logger.error({ status: res.status, data }, "Shiprocket order creation failed");
    return { shiprocketOrderId: null, awb: null, trackingUrl: null };
  }

  logger.info({ orderId: input.orderId, srOrder: data.order_id }, "Shiprocket order created");

  const awb = data.awb_code ?? null;
  const trackingUrl = awb
    ? `https://shiprocket.co/tracking/${awb}`
    : null;

  return {
    shiprocketOrderId: data.order_id ? String(data.order_id) : null,
    awb,
    trackingUrl,
  };
}
