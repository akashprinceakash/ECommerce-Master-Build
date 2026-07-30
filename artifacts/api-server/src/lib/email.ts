import { Resend } from "resend";
import { logger } from "./logger";

const RESEND_API_KEY  = process.env["RESEND_API_KEY"] ?? "";
const FROM_EMAIL      = "orders@kashaonline.in";
const FROM_NAME       = "KA.SHA Golf & Sportswear";
const ADMIN_CC_EMAIL  = "pranaysomaia715@gmail.com";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface OrderEmailItem {
  name: string;
  size: string;
  quantity: number;
  priceInPaise: number;
}

export interface OrderConfirmationData {
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  items: OrderEmailItem[];
  totalInPaise: number;
  shippingChargeInPaise?: number;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingPhone: string;
  invoicePdf?: Buffer;
  awb?: string | null;
  trackingUrl?: string | null;
}

function formatPrice(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildHtml(d: OrderConfirmationData): string {
  const shippingCharge = d.shippingChargeInPaise ?? 0;

  const itemRows = d.items.map((it) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #F0EDE8;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#333;">
        ${it.name}<br/>
        <span style="color:#888;font-size:12px;">Size: ${it.size} &nbsp;·&nbsp; Qty: ${it.quantity}</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #F0EDE8;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#333;text-align:right;">
        ${formatPrice(it.priceInPaise * it.quantity)}
      </td>
    </tr>`).join("");

  const shippingRow = shippingCharge > 0 ? `
    <tr>
      <td style="padding:8px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#888;">Shipping</td>
      <td style="padding:8px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#888;text-align:right;">${formatPrice(shippingCharge)}</td>
    </tr>` : "";

  const trackingSection = d.trackingUrl
    ? `<p style="margin:16px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#555;">
        AWB: <strong>${d.awb}</strong> &nbsp;·&nbsp;
        <a href="${d.trackingUrl}" style="color:#B8925A;">Track your order</a>
       </p>`
    : `<p style="margin:16px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#888;">
        Tracking details will be shared once your order is dispatched.
       </p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #EDE9E4;">
        <tr>
          <td style="background:#111;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-family:'Cormorant Garamond',Garamond,'Times New Roman',serif;font-size:26px;font-weight:500;letter-spacing:0.2em;color:#fff;">KA.SHA</p>
            <p style="margin:6px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.25em;color:#B8925A;text-transform:uppercase;">Golf &amp; Sportswear</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 0;text-align:center;">
            <p style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.2em;color:#B8925A;text-transform:uppercase;">Order Confirmed</p>
            <h1 style="margin:0;font-family:'Cormorant Garamond',Garamond,'Times New Roman',serif;font-size:32px;font-weight:400;color:#111;">Thank you, ${d.customerName.split(" ")[0]}.</h1>
            <p style="margin:12px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#666;line-height:1.6;">
              Your order #${d.orderNumber} has been confirmed and is being prepared for dispatch.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0 0 16px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">Order Summary</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemRows}
              ${shippingRow}
              <tr>
                <td style="padding:16px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;color:#111;border-top:1px solid #F0EDE8;">Total (incl. GST)</td>
                <td style="padding:16px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;color:#111;text-align:right;border-top:1px solid #F0EDE8;">${formatPrice(d.totalInPaise)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0 0 12px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">Delivering To</p>
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#333;line-height:1.8;">
              ${d.shippingAddress}<br/>
              ${d.shippingCity}, ${d.shippingState} - ${d.shippingPostalCode}<br/>
              ${d.shippingPhone}
            </p>
            ${trackingSection}
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;text-align:center;">
            <a href="https://kashaonline.in/orders/${d.orderNumber}" style="display:inline-block;background:#111;color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;padding:14px 32px;">
              View My Order
            </a>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #F0EDE8;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#999;line-height:1.8;">
              Questions? Email us at <a href="mailto:support@kashaonline.in" style="color:#B8925A;text-decoration:none;">support@kashaonline.in</a><br/>
              KA.SHA Golf &amp; Sportswear · Shahpur Jat, New Delhi 110049
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface RefundNotificationData {
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  amountInPaise: number;
  reason?: string | null;
  razorpayRefundId: string;
}

export async function sendRefundNotification(data: RefundNotificationData): Promise<void> {
  if (!resend) {
    logger.warn("Resend not configured — skipping refund notification email");
    return;
  }
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#FAFAF7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #EDE9E4;">
        <tr>
          <td style="background:#111;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-family:Garamond,serif;font-size:26px;font-weight:500;letter-spacing:0.2em;color:#fff;">KA.SHA</p>
            <p style="margin:6px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.25em;color:#B8925A;text-transform:uppercase;">Golf &amp; Sportswear</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 0;text-align:center;">
            <p style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.2em;color:#B8925A;text-transform:uppercase;">Refund Processed</p>
            <h1 style="margin:0;font-family:Garamond,serif;font-size:32px;font-weight:400;color:#111;">Refund Initiated</h1>
            <p style="margin:12px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#666;line-height:1.6;">
              Dear ${data.customerName.split(" ")[0]}, a refund of <strong>${formatPrice(data.amountInPaise)}</strong> has been initiated for Order #${data.orderNumber}.${data.reason ? `<br/>Reason: ${data.reason}` : ""}
            </p>
            <p style="margin:12px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#888;">
              Refund ID: ${data.razorpayRefundId}<br/>
              Refunds typically take 5–7 business days to reflect in your account.
            </p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #F0EDE8;padding:24px 40px;text-align:center;margin-top:32px;">
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#999;line-height:1.8;">
              Questions? Email us at <a href="mailto:support@kashaonline.in" style="color:#B8925A;text-decoration:none;">support@kashaonline.in</a><br/>
              KA.SHA Golf &amp; Sportswear · Shahpur Jat, New Delhi 110049
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    await resend.emails.send({
      to: data.customerEmail,
      cc: ADMIN_CC_EMAIL,
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      subject: `KA.SHA — Refund Initiated for Order #${data.orderNumber}`,
      text: `KA.SHA — Refund Initiated\n\nDear ${data.customerName},\n\nA refund of ${formatPrice(data.amountInPaise)} has been initiated for Order #${data.orderNumber}.\n\nRefund ID: ${data.razorpayRefundId}\n\nRefunds typically take 5–7 business days to reflect in your account.\n\nQuestions? Contact support@kashaonline.in`,
      html,
    });
    logger.info({ to: data.customerEmail, orderNumber: data.orderNumber, refundId: data.razorpayRefundId }, "Refund notification email sent");
  } catch (err) {
    logger.error({ err, to: data.customerEmail, refundId: data.razorpayRefundId }, "Failed to send refund notification email");
  }
}

// ── Order status update (processing / ready_to_ship / shipped / delivered) ────

export interface OrderStatusUpdateData {
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  status: "processing" | "ready_to_ship" | "shipped" | "delivered";
  awb?: string | null;
  trackingUrl?: string | null;
}

const STATUS_META: Record<
  OrderStatusUpdateData["status"],
  { subject: string; badge: string; headline: string; body: string }
> = {
  processing: {
    subject:  "Your order is being prepared",
    badge:    "Preparing Your Order",
    headline: "We're getting your order ready.",
    body:     "Our team has begun processing your order and it will be dispatched shortly.",
  },
  ready_to_ship: {
    subject:  "Your order is packed and ready",
    badge:    "Ready for Pickup",
    headline: "Your order is packed and ready to go.",
    body:     "Your order has been carefully packed and is awaiting collection by our courier partner.",
  },
  shipped: {
    subject:  "Your order is on its way",
    badge:    "Shipped",
    headline: "Your order is on its way.",
    body:     "Your package has been dispatched and is heading to you.",
  },
  delivered: {
    subject:  "Your order has been delivered",
    badge:    "Delivered",
    headline: "Your order has arrived.",
    body:     "Your KA.SHA order has been delivered. We hope you love it.",
  },
};

export async function sendOrderStatusUpdate(data: OrderStatusUpdateData): Promise<void> {
  if (!resend) {
    logger.warn("Resend not configured — skipping order status update email");
    return;
  }

  const meta = STATUS_META[data.status];
  const firstName = data.customerName.split(" ")[0];

  const trackingSection =
    data.trackingUrl
      ? `<tr><td style="padding:24px 40px 0;">
           <p style="margin:0 0 12px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">Tracking</p>
           ${data.awb ? `<p style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#333;">AWB: <strong>${data.awb}</strong></p>` : ""}
           <a href="${data.trackingUrl}" style="display:inline-block;background:#111;color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;padding:12px 28px;">
             Track My Order
           </a>
         </td></tr>`
      : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #EDE9E4;">
        <tr>
          <td style="background:#111;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-family:'Cormorant Garamond',Garamond,'Times New Roman',serif;font-size:26px;font-weight:500;letter-spacing:0.2em;color:#fff;">KA.SHA</p>
            <p style="margin:6px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.25em;color:#B8925A;text-transform:uppercase;">Golf &amp; Sportswear</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 0;text-align:center;">
            <p style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.2em;color:#B8925A;text-transform:uppercase;">${meta.badge}</p>
            <h1 style="margin:0;font-family:'Cormorant Garamond',Garamond,'Times New Roman',serif;font-size:32px;font-weight:400;color:#111;">${meta.headline}</h1>
            <p style="margin:12px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#666;line-height:1.6;">
              Hi ${firstName}, ${meta.body}
            </p>
            <p style="margin:8px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#888;">Order #${data.orderNumber}</p>
          </td>
        </tr>
        ${trackingSection}
        <tr>
          <td style="padding:32px 40px;text-align:center;">
            <a href="https://kashaonline.in/orders/${data.orderNumber}" style="display:inline-block;background:#111;color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;padding:14px 32px;">
              View My Order
            </a>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #F0EDE8;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#999;line-height:1.8;">
              Questions? Email us at <a href="mailto:support@kashaonline.in" style="color:#B8925A;text-decoration:none;">support@kashaonline.in</a><br/>
              KA.SHA Golf &amp; Sportswear · Shahpur Jat, New Delhi 110049
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `KA.SHA — Order #${data.orderNumber}: ${meta.subject}\n\nHi ${firstName},\n\n${meta.body}${data.awb ? `\n\nAWB: ${data.awb}` : ""}${data.trackingUrl ? `\nTrack: ${data.trackingUrl}` : ""}\n\nView your order: https://kashaonline.in/orders/${data.orderNumber}\n\nQuestions? Contact support@kashaonline.in`;

  try {
    await resend.emails.send({
      to: data.customerEmail,
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      subject: `KA.SHA — Order #${data.orderNumber}: ${meta.subject}`,
      text,
      html,
    });
    logger.info({ to: data.customerEmail, orderNumber: data.orderNumber, status: data.status }, "Order status update email sent");
  } catch (err) {
    logger.error({ err, to: data.customerEmail, orderNumber: data.orderNumber, status: data.status }, "Failed to send order status update email");
  }
}

export async function sendOrderConfirmation(data: OrderConfirmationData): Promise<void> {
  if (!resend) {
    logger.warn("Resend not configured (RESEND_API_KEY missing) — skipping order confirmation email");
    return;
  }

  const html = buildHtml(data);
  const text = `KA.SHA — Order #${data.orderNumber} Confirmed\n\nThank you ${data.customerName}!\n\nYour order has been confirmed. Total: ${formatPrice(data.totalInPaise)}\n\nView your orders at https://kashaonline.in/orders`;

  const attachments = data.invoicePdf
    ? [{ filename: `KASHA-Invoice-${String(data.orderNumber).padStart(6, "0")}.pdf`, content: data.invoicePdf }]
    : [];

  try {
    await resend.emails.send({
      to: data.customerEmail,
      cc: ADMIN_CC_EMAIL,
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      subject: `KA.SHA — Order #${data.orderNumber} Confirmed`,
      text,
      html,
      attachments,
    });
    logger.info({ to: data.customerEmail, orderNumber: data.orderNumber, hasInvoice: !!data.invoicePdf }, "Order confirmation email sent via Resend");
  } catch (err: unknown) {
    logger.error({ err, to: data.customerEmail }, "Failed to send order confirmation email via Resend");
  }
}
