import PDFDocument from "pdfkit";
import { KASHA_LOGO_B64 } from "./logo-b64";

const GSTIN = "07AJWPS2501D1Z6";
const COMPANY_NAME = "PS FASHION";
const TRADE_NAME = "KA.SHA Golf & Sportswear";
const ADDRESS_LINE1 = "213-B, 3rd Floor, Shahpur Jat Village";
const ADDRESS_LINE2 = "New Delhi — 110049";
const SUPPORT_EMAIL = "support@kashaonline.in";
const SUPPORT_PHONE = "+91 95608 89594";
const HSN_CODE = "61099010";

const logoBuffer = Buffer.from(KASHA_LOGO_B64, "base64");

function gstRate(priceInPaise: number): number {
  return priceInPaise <= 100000 ? 0.05 : 0.12;
}

function formatRupees(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
}

export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Helpers ─────────────────────────────────────────────────────────
    const W = 495; // usable width (A4 595pt - 2×50pt margins)
    const GOLD = "#B8925A";
    const BLACK = "#111111";
    const MUTED = "#666666";
    const LIGHT = "#F5F2EC";

    // ── Logo ─────────────────────────────────────────────────────────────
    // Logo is landscape ~2.55:1. At width=200pt → height≈78pt
    const LOGO_W = 200;
    const LOGO_H = 78;
    const LOGO_X = 50 + (W - LOGO_W) / 2;
    doc.image(logoBuffer, LOGO_X, 44, { width: LOGO_W, height: LOGO_H });

    // ── Gold divider under logo ───────────────────────────────────────────
    doc.moveTo(50, 130).lineTo(545, 130).strokeColor(GOLD).lineWidth(1).stroke();

    // ── TAX INVOICE label ────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BLACK)
      .text("TAX INVOICE", 50, 138, { width: W, align: "center" });
    doc.moveTo(50, 156).lineTo(545, 156).strokeColor(GOLD).lineWidth(1).stroke();

    // ── Seller info (left) + Invoice meta (right) ────────────────────────
    const Y_META = 163;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLACK)
      .text(COMPANY_NAME, 50, Y_META);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(TRADE_NAME, 50, Y_META + 12)
      .text(ADDRESS_LINE1, 50, Y_META + 22)
      .text(ADDRESS_LINE2, 50, Y_META + 32)
      .text(`GSTIN: ${GSTIN}`, 50, Y_META + 42)
      .text(SUPPORT_EMAIL, 50, Y_META + 52);

    const invoiceDate = data.orderDate.toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLACK)
      .text("Invoice No.", 350, Y_META, { width: 80, align: "right" })
      .text("Date", 350, Y_META + 14, { width: 80, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(`#KASHA-${String(data.orderNumber).padStart(6, "0")}`, 435, Y_META, { width: 110, align: "right" })
      .text(invoiceDate, 435, Y_META + 14, { width: 110, align: "right" });

    // ── Bill-to ──────────────────────────────────────────────────────────
    const Y_BILL = Y_META + 72;
    doc.rect(50, Y_BILL, W, 14).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED)
      .text("BILL TO / SHIP TO", 55, Y_BILL + 3);

    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLACK)
      .text(data.customerName, 50, Y_BILL + 18);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(data.shippingAddress, 50, Y_BILL + 30)
      .text(`${data.shippingCity}, ${data.shippingState} — ${data.shippingPostalCode}`, 50, Y_BILL + 40)
      .text(data.shippingPhone, 50, Y_BILL + 50);

    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text("Email:", 350, Y_BILL + 18, { width: 80, align: "right" })
      .text(data.customerEmail, 350, Y_BILL + 28, { width: 195, align: "right" });

    // ── Table header ─────────────────────────────────────────────────────
    const Y_TABLE = Y_BILL + 70;
    doc.rect(50, Y_TABLE, W, 20).fill(BLACK);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF");
    const cols = { desc: 50, hsn: 218, qty: 280, rate: 312, gst: 392, total: 440 };
    const colW = { desc: 160, hsn: 54, qty: 28, rate: 72, gst: 40, total: 101 };
    doc.text("ITEM DESCRIPTION", cols.desc + 4, Y_TABLE + 6, { width: colW.desc });
    doc.text("HSN", cols.hsn + 4, Y_TABLE + 6, { width: colW.hsn });
    doc.text("QTY", cols.qty + 4, Y_TABLE + 6, { width: colW.qty });
    doc.text("UNIT PRICE", cols.rate + 4, Y_TABLE + 6, { width: colW.rate });
    doc.text("GST", cols.gst + 4, Y_TABLE + 6, { width: colW.gst });
    doc.text("AMOUNT", cols.total + 4, Y_TABLE + 6, { width: colW.total, align: "right" });

    // ── Table rows ───────────────────────────────────────────────────────
    let y = Y_TABLE + 20;
    let subtotalExclGst = 0;
    let totalGst = 0;

    for (const item of data.items) {
      const rate = gstRate(item.priceInPaise);
      const itemTotal = item.priceInPaise * item.quantity;
      const baseTotal = Math.round(itemTotal / (1 + rate));
      const gstTotal = itemTotal - baseTotal;
      subtotalExclGst += baseTotal;
      totalGst += gstTotal;

      const gstLabel = rate === 0.05 ? "5%" : "12%";

      const rowBg = data.items.indexOf(item) % 2 === 0 ? "#FAFAF7" : "#FFFFFF";
      doc.rect(50, y, W, 24).fill(rowBg);
      doc.font("Helvetica").fontSize(8).fillColor(BLACK);
      const displayName = item.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "");
      doc.text(`${displayName} (${item.size})`, cols.desc + 4, y + 8, { width: colW.desc, ellipsis: true });
      doc.text(HSN_CODE, cols.hsn + 4, y + 8, { width: colW.hsn });
      doc.text(String(item.quantity), cols.qty + 4, y + 8, { width: colW.qty });
      doc.text(formatRupees(item.priceInPaise), cols.rate + 4, y + 8, { width: colW.rate });
      doc.fillColor(MUTED).text(gstLabel, cols.gst + 4, y + 8, { width: colW.gst });
      doc.fillColor(BLACK).text(formatRupees(itemTotal), cols.total + 4, y + 8, { width: colW.total, align: "right" });

      y += 24;
    }

    // ── Shipping row ─────────────────────────────────────────────────────
    if (data.shippingChargeInPaise > 0) {
      doc.rect(50, y, W, 24).fill("#FAFAF7");
      doc.font("Helvetica").fontSize(8).fillColor(BLACK)
        .text("Shipping Charges (incl. GST)", cols.desc + 4, y + 8, { width: colW.desc });
      doc.text("—", cols.hsn + 4, y + 8, { width: colW.hsn });
      doc.text("—", cols.qty + 4, y + 8, { width: colW.qty });
      doc.text("—", cols.rate + 4, y + 8, { width: colW.rate });
      doc.fillColor(MUTED).text("18%", cols.gst + 4, y + 8, { width: colW.gst });
      doc.fillColor(BLACK).text(formatRupees(data.shippingChargeInPaise), cols.total + 4, y + 8, { width: colW.total, align: "right" });
      y += 24;
    }

    // ── Divider ──────────────────────────────────────────────────────────
    doc.moveTo(50, y).lineTo(545, y).strokeColor(GOLD).lineWidth(0.5).stroke();
    y += 8;

    // ── Totals block ─────────────────────────────────────────────────────
    const totalBefore = subtotalExclGst + data.shippingChargeInPaise;
    const grandTotal = totalBefore + totalGst;

    const isIntraState = data.shippingState.trim().toLowerCase() === "delhi";

    function totalRow(label: string, value: string, bold = false) {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 9 : 8)
        .fillColor(bold ? BLACK : MUTED)
        .text(label, 330, y, { width: 140, align: "right" })
        .fillColor(BLACK)
        .text(value, 480, y, { width: 65, align: "right" });
      y += bold ? 16 : 13;
    }

    totalRow("Subtotal (excl. GST)", formatRupees(subtotalExclGst));
    if (data.shippingChargeInPaise > 0) {
      totalRow("Shipping", formatRupees(data.shippingChargeInPaise));
    }
    if (isIntraState) {
      const cgst = Math.round(totalGst / 2);
      const sgst = totalGst - cgst;
      totalRow("CGST", formatRupees(cgst));
      totalRow("SGST", formatRupees(sgst));
    } else {
      totalRow("IGST", formatRupees(totalGst));
    }
    doc.moveTo(330, y).lineTo(545, y).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
    y += 4;
    totalRow("TOTAL (incl. GST)", formatRupees(grandTotal), true);

    // ── GST note ─────────────────────────────────────────────────────────
    y += 16;
    const gstTypeNote = isIntraState
      ? "CGST + SGST (intra-state, seller & buyer both in Delhi)."
      : "IGST (inter-state transaction).";
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(`GST at 5% for items under Rs. 1,000 and 12% for items above Rs. 1,000 (HSN: ${HSN_CODE}). ${gstTypeNote}`, 50, y, { width: W });

    // ── Footer ────────────────────────────────────────────────────────────
    doc.moveTo(50, 760).lineTo(545, 760).strokeColor(GOLD).lineWidth(0.5).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor(BLACK)
      .text(TRADE_NAME, 50, 766, { width: W, align: "center" });
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(`${ADDRESS_LINE1}, ${ADDRESS_LINE2}`, 50, 776, { width: W, align: "center" })
      .text(`${SUPPORT_EMAIL}  |  ${SUPPORT_PHONE}  |  kashaonline.in`, 50, 786, { width: W, align: "center" })
      .text("Returns accepted as per KA.SHA return policy available on kashaonline.in", 50, 796, { width: W, align: "center" })
      .text("This is a computer-generated invoice and does not require a physical signature.", 50, 806, { width: W, align: "center" });

    doc.end();
  });
}
