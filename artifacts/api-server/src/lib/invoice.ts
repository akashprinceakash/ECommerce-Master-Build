import PDFDocument from "pdfkit";
import { KASHA_LOGO_B64 } from "./logo-b64";

const GSTIN        = "07AJWPS2501D1Z6";
const COMPANY_NAME = "PS FASHION";
const TRADE_NAME   = "KA.SHA Golf & Sportswear";
const ADDR1        = "213-B, 3rd Floor, Shahpur Jat Village";
const ADDR2        = "New Delhi — 110049";
const EMAIL        = "support@kashaonline.in";
const PHONE        = "+91 95608 89594";
const WEBSITE      = "kashaonline.in";
const HSN_CODE     = "61099010";

const logoBuffer = Buffer.from(KASHA_LOGO_B64, "base64");

function gstRate(paise: number): number {
  return paise <= 100000 ? 0.05 : 0.12;
}

function fmt(paise: number): string {
  return `Rs.\u202f${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface InvoiceItem {
  name: string;
  size: string;
  quantity: number;
  priceInPaise: number;
}

export interface InvoiceData {
  orderNumber: number;
  orderDate: Date;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingPhone: string;
  items: InvoiceItem[];
  shippingChargeInPaise: number;
  totalInPaise: number;
  paymentMethod?: string;
  paymentId?: string | null;
}

export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Constants ─────────────────────────────────────────────────────────
    const L = 50;           // left margin
    const R = 545;          // right edge
    const W = 495;          // usable width
    const GOLD  = "#B8925A";
    const BLACK = "#111111";
    const MUTED = "#666666";
    const LIGHT = "#F5F2EC";

    // ── Helpers ───────────────────────────────────────────────────────────
    function hline(y: number, color = GOLD, lw = 0.75) {
      doc.moveTo(L, y).lineTo(R, y).strokeColor(color).lineWidth(lw).stroke();
    }

    // Column definitions for item table
    // Total used: 192+55+26+70+36+116 = 495
    const C = {
      desc:  { x: L,    w: 192 },
      hsn:   { x: 246,  w:  55 },
      qty:   { x: 305,  w:  26 },
      rate:  { x: 335,  w:  70 },
      gst:   { x: 409,  w:  36 },
      total: { x: 449,  w:  96 },
    };

    // ── Logo (centred) ────────────────────────────────────────────────────
    const LOGO_W = 180;
    const LOGO_H = Math.round(LOGO_W / 2.56);   // aspect ~2.56:1
    const LOGO_X = L + (W - LOGO_W) / 2;
    doc.image(logoBuffer, LOGO_X, 44, { width: LOGO_W, height: LOGO_H });

    let y = 44 + LOGO_H + 8;
    hline(y);

    // ── TAX INVOICE title ─────────────────────────────────────────────────
    y += 6;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK)
      .text("TAX INVOICE", L, y, { width: W, align: "center" });
    y += 14;
    hline(y);

    // ── Seller block (left) + Invoice meta (right) ────────────────────────
    const Y_META = y + 8;

    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLACK)
      .text(COMPANY_NAME, L, Y_META);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(TRADE_NAME,              L, Y_META + 12)
      .text(ADDR1,                   L, Y_META + 22)
      .text(ADDR2,                   L, Y_META + 32)
      .text(`GSTIN: ${GSTIN}`,       L, Y_META + 42)
      .text(EMAIL,                   L, Y_META + 52)
      .text(`${PHONE}  |  ${WEBSITE}`, L, Y_META + 62);

    // Invoice meta — right column
    const invoiceDate = data.orderDate.toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const metaRows: [string, string][] = [
      ["Invoice No.", `#KASHA-${String(data.orderNumber).padStart(6, "0")}`],
      ["Order #",    String(data.orderNumber)],
      ["Date",       invoiceDate],
    ];
    if (data.paymentMethod) {
      metaRows.push(["Payment", data.paymentMethod === "cod" ? "Cash on Delivery" : "Online (Razorpay)"]);
    }
    if (data.paymentId) {
      metaRows.push(["Payment ID", data.paymentId]);
    }

    const META_LABEL_X = 330;
    const META_VAL_X   = 414;
    const META_VAL_W   = R - META_VAL_X;   // 131pt

    metaRows.forEach(([label, value], i) => {
      const ym = Y_META + i * 13;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED)
        .text(label, META_LABEL_X, ym, { width: META_VAL_X - META_LABEL_X - 4, align: "right" });
      doc.font("Helvetica").fontSize(8).fillColor(BLACK)
        .text(value, META_VAL_X, ym, { width: META_VAL_W, align: "right" });
    });

    // ── Bill-to / Ship-to ─────────────────────────────────────────────────
    const Y_BILL = Y_META + 82;
    doc.rect(L, Y_BILL, W, 14).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
      .text("BILL TO / SHIP TO", L + 4, Y_BILL + 4);

    const Y_CUST = Y_BILL + 18;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLACK)
      .text(data.customerName, L, Y_CUST);

    // Address (allow natural wrap, max 260pt wide so email can sit on the right)
    const ADDR_W = 260;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(data.shippingAddress, L, Y_CUST + 12, { width: ADDR_W });
    const addrH = doc.heightOfString(data.shippingAddress, { width: ADDR_W });
    const Y_CITYL = Y_CUST + 12 + addrH + 2;

    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(`${data.shippingCity}, ${data.shippingState} — ${data.shippingPostalCode}`, L, Y_CITYL, { width: ADDR_W })
      .text(data.shippingPhone, L, Y_CITYL + 12, { width: ADDR_W });

    // Email (right side)
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text("Email:", 310, Y_CUST, { width: 70, align: "right" })
      .text(data.customerEmail, 310, Y_CUST + 10, { width: R - 310, align: "right" });

    // ── Item table ────────────────────────────────────────────────────────
    y = Y_CITYL + 28;

    // Header row
    const TH = 20;
    doc.rect(L, y, W, TH).fill(BLACK);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF");
    const hY = y + 6;
    doc.text("ITEM DESCRIPTION", C.desc.x + 3, hY, { width: C.desc.w });
    doc.text("HSN",              C.hsn.x  + 3, hY, { width: C.hsn.w  });
    doc.text("QTY",              C.qty.x  + 3, hY, { width: C.qty.w,   align: "right" });
    doc.text("UNIT PRICE",       C.rate.x + 3, hY, { width: C.rate.w,  align: "right" });
    doc.text("GST",              C.gst.x  + 3, hY, { width: C.gst.w,   align: "center" });
    doc.text("AMOUNT",           C.total.x+ 3, hY, { width: C.total.w, align: "right" });
    y += TH;

    // Item rows
    let subtotalExclGst = 0;
    let totalItemGst    = 0;

    for (let i = 0; i < data.items.length; i++) {
      const item   = data.items[i];
      const rate   = gstRate(item.priceInPaise);
      const lineTotal = item.priceInPaise * item.quantity;
      const base   = Math.round(lineTotal / (1 + rate));
      const gst    = lineTotal - base;
      subtotalExclGst += base;
      totalItemGst    += gst;

      const rowBg = i % 2 === 0 ? "#FAFAF7" : "#FFFFFF";
      doc.rect(L, y, W, 24).fill(rowBg);
      const rY = y + 8;
      const displayName = item.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "");
      doc.font("Helvetica").fontSize(8).fillColor(BLACK)
        .text(`${displayName} (${item.size})`, C.desc.x + 3, rY, { width: C.desc.w, ellipsis: true });
      doc.fillColor(MUTED).text(HSN_CODE,                 C.hsn.x  + 3, rY, { width: C.hsn.w });
      doc.fillColor(BLACK).text(String(item.quantity),    C.qty.x  + 3, rY, { width: C.qty.w,   align: "right" });
      doc.text(fmt(item.priceInPaise),                    C.rate.x + 3, rY, { width: C.rate.w,  align: "right" });
      doc.fillColor(MUTED).text(`${Math.round(rate * 100)}%`, C.gst.x + 3, rY, { width: C.gst.w, align: "center" });
      doc.fillColor(BLACK).text(fmt(lineTotal),           C.total.x+ 3, rY, { width: C.total.w, align: "right" });
      y += 24;
    }

    // Shipping row
    let shippingBase = 0;
    let shippingGst  = 0;
    if (data.shippingChargeInPaise > 0) {
      shippingBase = Math.round(data.shippingChargeInPaise / 1.18);
      shippingGst  = data.shippingChargeInPaise - shippingBase;

      const rowBg = data.items.length % 2 === 0 ? "#FAFAF7" : "#FFFFFF";
      doc.rect(L, y, W, 24).fill(rowBg);
      const rY = y + 8;
      doc.font("Helvetica").fontSize(8).fillColor(BLACK)
        .text("Shipping Charges",          C.desc.x + 3, rY, { width: C.desc.w });
      doc.fillColor(MUTED)
        .text("—",                          C.hsn.x  + 3, rY, { width: C.hsn.w  })
        .text("—",                          C.qty.x  + 3, rY, { width: C.qty.w,  align: "right" });
      doc.fillColor(BLACK)
        .text(fmt(shippingBase),            C.rate.x + 3, rY, { width: C.rate.w, align: "right" });
      doc.fillColor(MUTED)
        .text("18%",                        C.gst.x  + 3, rY, { width: C.gst.w,  align: "center" });
      doc.fillColor(BLACK)
        .text(fmt(data.shippingChargeInPaise), C.total.x + 3, rY, { width: C.total.w, align: "right" });
      y += 24;
    }

    // ── Gold divider ─────────────────────────────────────────────────────
    hline(y, GOLD, 0.5);
    y += 10;

    // ── Totals block ──────────────────────────────────────────────────────
    const isIntraState = data.shippingState.trim().toLowerCase() === "delhi";

    function totalRow(label: string, value: string, bold = false) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 9.5 : 8)
        .fillColor(bold ? BLACK : MUTED)
        .text(label, 310, y, { width: 130, align: "right" });
      doc.font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 9.5 : 8)
        .fillColor(BLACK)
        .text(value, 444, y, { width: R - 444, align: "right" });
      y += bold ? 17 : 13;
    }

    totalRow("Items (excl. GST)", fmt(subtotalExclGst));
    if (data.shippingChargeInPaise > 0) {
      totalRow("Shipping (excl. GST)", fmt(shippingBase));
    }

    if (isIntraState) {
      const cgstItem = Math.round(totalItemGst / 2);
      const sgstItem = totalItemGst - cgstItem;
      totalRow("Item CGST", fmt(cgstItem));
      totalRow("Item SGST", fmt(sgstItem));
      if (shippingGst > 0) {
        const cgstShip = Math.round(shippingGst / 2);
        const sgstShip = shippingGst - cgstShip;
        totalRow("Shipping CGST (9%)", fmt(cgstShip));
        totalRow("Shipping SGST (9%)", fmt(sgstShip));
      }
    } else {
      const itemGstLabel = data.items.length > 0
        ? `Item IGST (${Math.round(gstRate(data.items[0].priceInPaise) * 100)}%)`
        : "Item IGST";
      totalRow(itemGstLabel, fmt(totalItemGst));
      if (shippingGst > 0) {
        totalRow("Shipping IGST (18%)", fmt(shippingGst));
      }
    }

    // Separator + Grand total
    doc.moveTo(310, y).lineTo(R, y).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
    y += 4;
    totalRow("TOTAL (incl. GST)", fmt(data.totalInPaise), true);

    // ── GST note ─────────────────────────────────────────────────────────
    y += 10;
    const gstNote = isIntraState
      ? `CGST + SGST applied (intra-state: seller & buyer both in Delhi). Shipping GST @ 18%. HSN: ${HSN_CODE}.`
      : `IGST applied (inter-state transaction). Item GST: 5% (≤ Rs. 1,000) or 12% (> Rs. 1,000). Shipping GST: 18%. HSN: ${HSN_CODE}.`;
    doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(gstNote, L, y, { width: W });
    y += doc.heightOfString(gstNote, { width: W }) + 4;

    // ── Footer (same page, dynamically positioned) ────────────────────────
    const FOOTER_H = 52;
    // Push footer down to at least 680pt or further if content demands
    const footerY = Math.max(y + 20, 680);

    hline(footerY, GOLD, 0.5);
    let fy = footerY + 7;

    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BLACK)
      .text(TRADE_NAME, L, fy, { width: W, align: "center" });
    fy += 11;
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(`${ADDR1}, ${ADDR2}`, L, fy, { width: W, align: "center" });
    fy += 9;
    doc.text(`${EMAIL}  |  ${PHONE}  |  ${WEBSITE}`, L, fy, { width: W, align: "center" });
    fy += 9;
    doc.text("Returns accepted as per KA.SHA return policy available on kashaonline.in", L, fy, { width: W, align: "center" });
    fy += 9;
    doc.text("This is a computer-generated invoice and does not require a physical signature.", L, fy, { width: W, align: "center" });

    // Warn in console if footer would overflow A4 (841pt)
    if (fy > 830) {
      // Multi-page: let PDFKit handle the overflow naturally
    }

    doc.end();
  });
}
