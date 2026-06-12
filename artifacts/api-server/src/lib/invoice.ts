import PDFDocument from "pdfkit";
import { KASHA_LOGO_B64 } from "./logo-b64";

// ── Seller constants ──────────────────────────────────────────────────────────
const GSTIN         = "07AJWPS2501D1Z6";
const COMPANY_NAME  = "PS FASHION";
const TRADE_NAME    = "KA.SHA Golf & Sportswear";
const ADDR1         = "213-B, 3rd Floor, Shahpur Jat Village";
const ADDR2         = "New Delhi - 110049";
const SELLER_EMAIL  = "support@kashaonline.in";
const SELLER_PHONE  = "+91 95608 89594";
const WEBSITE       = "kashaonline.in";
const HSN_CODE      = "61099010";

const logoBuffer = Buffer.from(KASHA_LOGO_B64, "base64");

// ── Helpers ───────────────────────────────────────────────────────────────────
function gstRate(paise: number): number {
  return paise < 250_000 ? 0.05 : 0.18;   // <₹2,500 → 5%, ₹2,500+ → 18%
}

/** Plain rupee format — no Unicode special chars (PDFKit built-in fonts are Latin-1) */
function fmt(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Title-case normalisation for city / state names entered by customers */
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

// ── Public interfaces ─────────────────────────────────────────────────────────
export interface InvoiceItem {
  name: string;
  sku?: string;
  size: string;
  quantity: number;
  priceInPaise: number;
}

export interface DesignView {
  label: string;
  buffer: Buffer;
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
  designViews?: DesignView[];
}

// ── PDF generation ────────────────────────────────────────────────────────────
export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Page geometry
    const L = 50;          // left margin
    const R = 545;         // right edge  (595 - 50)
    const W = 495;         // usable width

    // Palette
    const GOLD  = "#B8925A";
    const BLACK = "#111111";
    const MUTED = "#777777";
    const LIGHT = "#F5F2EC";
    const WHITE = "#FFFFFF";

    // ── Layout helpers ────────────────────────────────────────────────────
    function hline(yPos: number, color = GOLD, lw = 0.75) {
      doc.moveTo(L, yPos).lineTo(R, yPos).strokeColor(color).lineWidth(lw).stroke();
    }

    // Table columns  (x = left edge of cell, w = cell width, all rows pad +3 inside)
    // Total cell widths: 185+56+28+72+36+92 = 469  +  6 gaps × (3+3) = 36  → rounded to 495
    const C = {
      desc:  { x: L + 3,  w: 185, align: "left"   as const },
      hsn:   { x: 241,    w:  56, align: "left"   as const },
      qty:   { x: 301,    w:  28, align: "center" as const },
      rate:  { x: 335,    w:  72, align: "right"  as const },
      gst:   { x: 412,    w:  36, align: "center" as const },
      total: { x: 452,    w:  90, align: "right"  as const },
    };

    // ── Logo ──────────────────────────────────────────────────────────────
    const LOGO_W = 170;
    const LOGO_H = Math.round(LOGO_W / 2.56);   // aspect ~2.56:1
    doc.image(logoBuffer, L + (W - LOGO_W) / 2, 44, { width: LOGO_W, height: LOGO_H });

    let y = 44 + LOGO_H + 8;
    hline(y);

    // ── "TAX INVOICE" title ───────────────────────────────────────────────
    y += 7;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK)
      .text("TAX INVOICE", L, y, { width: W, align: "center" });
    y += 15;
    hline(y);

    // ── Seller block (left) + Invoice meta (right) ────────────────────────
    const Y_META = y + 9;

    // Seller info
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLACK)
      .text(COMPANY_NAME, L, Y_META);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(TRADE_NAME,         L, Y_META + 12)
      .text(ADDR1,              L, Y_META + 22)
      .text(ADDR2,              L, Y_META + 32)
      .text(`GSTIN: ${GSTIN}`,  L, Y_META + 42);

    // Seller contact with labels
    const YC = Y_META + 54;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(`Email:    ${SELLER_EMAIL}`,  L, YC)
      .text(`Phone:    ${SELLER_PHONE}`,  L, YC + 10)
      .text(`Website:  ${WEBSITE}`,       L, YC + 20);

    // Invoice meta — right-aligned label + value pairs
    const invoiceDate = data.orderDate.toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const paymentLabel = data.paymentMethod === "cod" ? "Cash on Delivery" : "Online (Razorpay)";

    const metaRows: [string, string][] = [
      ["Invoice No.", `#KASHA-${String(data.orderNumber).padStart(6, "0")}`],
      ["Order #",    `#${data.orderNumber}`],
      ["Date",       invoiceDate],
      ["Payment",    paymentLabel],
    ];
    if (data.paymentId) {
      metaRows.push(["Payment ID", data.paymentId]);
    }

    const ML  = 310;          // meta label left edge
    const MVL = 395;          // meta value left edge
    const MVW = R - MVL;      // meta value width  (= 150pt)
    const MLW = MVL - ML - 4; // meta label width

    metaRows.forEach(([label, value], i) => {
      const ym = Y_META + i * 14;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED)
        .text(label, ML, ym, { width: MLW, align: "right" });
      doc.font("Helvetica").fontSize(8).fillColor(BLACK)
        .text(value, MVL, ym, { width: MVW, align: "right" });
    });

    // ── Bill-to / Ship-to ─────────────────────────────────────────────────
    const Y_BILL = Y_META + 88;
    doc.rect(L, Y_BILL, W, 14).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
      .text("BILL TO / SHIP TO", L + 4, Y_BILL + 4);

    const Y_CUST = Y_BILL + 19;
    // Customer name
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLACK)
      .text(toTitleCase(data.customerName), L, Y_CUST);

    // Address (wraps if needed; 265pt wide leaves room for email on right)
    const ADDR_W = 265;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(data.shippingAddress, L, Y_CUST + 12, { width: ADDR_W });
    const addrH = doc.heightOfString(data.shippingAddress, { width: ADDR_W });

    const Y_CITY = Y_CUST + 12 + addrH + 2;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(
        `${toTitleCase(data.shippingCity)}, ${toTitleCase(data.shippingState)} - ${data.shippingPostalCode}`,
        L, Y_CITY, { width: ADDR_W },
      )
      .text(data.shippingPhone, L, Y_CITY + 12, { width: ADDR_W });

    // Email — single text call so it stays on one line, right-aligned
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(`Email: ${data.customerEmail}`, 290, Y_CUST, { width: R - 290, align: "right" });

    // ── Item table ────────────────────────────────────────────────────────
    y = Y_CITY + 28;

    // Table header row
    doc.rect(L, y, W, 20).fill(BLACK);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHITE);
    const hY = y + 6;
    doc.text("ITEM DESCRIPTION", C.desc.x,  hY, { width: C.desc.w,  align: C.desc.align  });
    doc.text("HSN",              C.hsn.x,   hY, { width: C.hsn.w,   align: C.hsn.align   });
    doc.text("QTY",              C.qty.x,   hY, { width: C.qty.w,   align: C.qty.align   });
    doc.text("UNIT PRICE",       C.rate.x,  hY, { width: C.rate.w,  align: C.rate.align  });
    doc.text("GST %",            C.gst.x,   hY, { width: C.gst.w,   align: C.gst.align   });
    doc.text("AMOUNT",           C.total.x, hY, { width: C.total.w, align: C.total.align });
    y += 20;

    // ── Item rows ─────────────────────────────────────────────────────────
    let subtotalExclGst = 0;
    let totalItemGst    = 0;

    for (let i = 0; i < data.items.length; i++) {
      const item      = data.items[i];
      const rate      = gstRate(item.priceInPaise);
      const lineTotal = item.priceInPaise * item.quantity;
      const base      = Math.round(lineTotal / (1 + rate));
      const gst       = lineTotal - base;
      subtotalExclGst += base;
      totalItemGst    += gst;

      const ROW_H = item.sku ? 38 : 26;
      doc.rect(L, y, W, ROW_H).fill(i % 2 === 0 ? "#FAFAF7" : WHITE);
      const nameY = y + 7;
      const numY  = item.sku ? y + 13 : y + 9;
      const displayName = item.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "");

      doc.font("Helvetica").fontSize(8).fillColor(BLACK)
        .text(`${displayName} (${item.size})`, C.desc.x, nameY, { width: C.desc.w, align: C.desc.align, ellipsis: true });
      if (item.sku) {
        doc.font("Helvetica-Bold").fontSize(7).fillColor(GOLD)
          .text(`STYLE NO: ${item.sku}`, C.desc.x, nameY + 11, { width: C.desc.w, align: "left" });
      }
      doc.font("Helvetica").fontSize(8).fillColor(MUTED)
        .text(HSN_CODE,                          C.hsn.x,   numY, { width: C.hsn.w,   align: C.hsn.align   })
        .text(String(item.quantity),             C.qty.x,   numY, { width: C.qty.w,   align: C.qty.align   });
      doc.fillColor(BLACK)
        .text(fmt(item.priceInPaise),            C.rate.x,  numY, { width: C.rate.w,  align: C.rate.align  });
      doc.fillColor(MUTED)
        .text(`${Math.round(rate * 100)}%`,      C.gst.x,   numY, { width: C.gst.w,   align: C.gst.align   });
      doc.fillColor(BLACK)
        .text(fmt(lineTotal),                    C.total.x, numY, { width: C.total.w, align: C.total.align });
      y += ROW_H;
    }

    // ── Shipping row ──────────────────────────────────────────────────────
    let shippingBase = 0;
    let shippingGst  = 0;
    if (data.shippingChargeInPaise > 0) {
      shippingBase = Math.round(data.shippingChargeInPaise / 1.18);
      shippingGst  = data.shippingChargeInPaise - shippingBase;

      doc.rect(L, y, W, 24).fill(data.items.length % 2 === 0 ? "#FAFAF7" : WHITE);
      const rY = y + 8;
      doc.font("Helvetica").fontSize(8).fillColor(BLACK)
        .text("Shipping Charges",                C.desc.x,  rY, { width: C.desc.w,  align: C.desc.align  });
      doc.fillColor(MUTED)
        .text("-",                               C.hsn.x,   rY, { width: C.hsn.w,   align: C.hsn.align   })
        .text("-",                               C.qty.x,   rY, { width: C.qty.w,   align: C.qty.align   });
      doc.fillColor(BLACK)
        .text(fmt(shippingBase),                 C.rate.x,  rY, { width: C.rate.w,  align: C.rate.align  });
      doc.fillColor(MUTED)
        .text("18%",                             C.gst.x,   rY, { width: C.gst.w,   align: C.gst.align   });
      doc.fillColor(BLACK)
        .text(fmt(data.shippingChargeInPaise),   C.total.x, rY, { width: C.total.w, align: C.total.align });
      y += 24;
    }

    // Gold divider below table
    hline(y, GOLD, 0.5);
    y += 12;

    // ── Totals block ──────────────────────────────────────────────────────
    const isIntraState = data.shippingState.trim().toLowerCase() === "delhi";

    const TLABEL_X = 305;
    const TLABEL_W = 130;
    const TVAL_X   = 439;
    const TVAL_W   = R - TVAL_X;   // 106pt

    function totalRow(label: string, value: string) {
      doc.font("Helvetica").fontSize(8).fillColor(MUTED)
        .text(label, TLABEL_X, y, { width: TLABEL_W, align: "right" });
      doc.fillColor(BLACK)
        .text(value, TVAL_X, y, { width: TVAL_W, align: "right" });
      y += 13;
    }

    totalRow("Items (excl. GST)", fmt(subtotalExclGst));
    if (data.shippingChargeInPaise > 0) {
      totalRow("Shipping (excl. GST)", fmt(shippingBase));
    }

    const itemPct = data.items.length > 0 ? Math.round(gstRate(data.items[0].priceInPaise) * 100) : 5;
    const halfPct = itemPct / 2;  // 2.5 for 5% slab, 9 for 18% slab

    if (isIntraState) {
      const cgstItem = Math.round(totalItemGst / 2);
      totalRow(`Item CGST (${halfPct}%)`,      fmt(cgstItem));
      totalRow(`Item SGST (${halfPct}%)`,      fmt(totalItemGst - cgstItem));
      if (shippingGst > 0) {
        const cgstShip = Math.round(shippingGst / 2);
        totalRow("Shipping CGST (9%)",  fmt(cgstShip));
        totalRow("Shipping SGST (9%)",  fmt(shippingGst - cgstShip));
      }
    } else {
      totalRow(`Item IGST (${itemPct}%)`,    fmt(totalItemGst));
      if (shippingGst > 0) {
        totalRow("Shipping IGST (18%)", fmt(shippingGst));
      }
    }

    // Grand total — prominent row with light background
    y += 2;
    doc.rect(TLABEL_X - 4, y - 2, TVAL_X - TLABEL_X + TVAL_W + 8, 22).fill(LIGHT);
    hline(y - 2, GOLD, 0.75);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK)
      .text("TOTAL PAYABLE", TLABEL_X, y + 3, { width: TLABEL_W, align: "right" });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BLACK)
      .text(fmt(data.totalInPaise), TVAL_X, y + 3, { width: TVAL_W, align: "right" });
    y += 26;

    // ── GST note ─────────────────────────────────────────────────────────
    y += 8;
    const gstNote = isIntraState
      ? `CGST + SGST applied (intra-state: seller and buyer both in Delhi). Item GST: 5% for apparel below Rs. 2,500 and 18% for Rs. 2,500 and above. Shipping GST: 18%. HSN: ${HSN_CODE}.`
      : `IGST applied (inter-state transaction). Item GST: 5% for apparel items priced below Rs. 2,500 and 18% for Rs. 2,500 and above. Shipping GST: 18%. HSN: ${HSN_CODE}.`;
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(gstNote, L, y, { width: W });
    y += doc.heightOfString(gstNote, { width: W }) + 6;

    // ── Footer ────────────────────────────────────────────────────────────
    // Push footer down so it sits near the bottom; never overlap content
    const footerY = Math.max(y + 24, 695);

    // Brand line + address
    hline(footerY, GOLD, 0.5);
    let fy = footerY + 8;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(BLACK)
      .text(TRADE_NAME, L, fy, { width: W, align: "center" });
    fy += 12;
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(`${ADDR1}, ${ADDR2}`, L, fy, { width: W, align: "center" });
    fy += 10;
    doc.text(
      `Email: ${SELLER_EMAIL}  |  Phone: ${SELLER_PHONE}  |  Website: ${WEBSITE}`,
      L, fy, { width: W, align: "center" },
    );
    fy += 12;

    // Thin rule before disclaimers
    doc.moveTo(L + 80, fy).lineTo(R - 80, fy).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
    fy += 7;
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("Returns accepted as per KA.SHA return policy available on kashaonline.in", L, fy, { width: W, align: "center" });
    fy += 9;
    doc.text("This is a computer-generated invoice and does not require a physical signature.", L, fy, { width: W, align: "center" });

    // ── Production Design Sheet (page 2) ─────────────────────────────────
    if (data.designViews && data.designViews.length > 0) {
      doc.addPage();

      // Header bar
      doc.rect(L, 44, W, 22).fill(BLACK);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(WHITE)
        .text("PRODUCTION DESIGN SHEET", L + 4, 51, { width: W - 8, align: "left" });
      doc.font("Helvetica").fontSize(8).fillColor(GOLD)
        .text(`Order #${data.orderNumber}  ·  ${data.customerName}`, L + 4, 51, { width: W - 8, align: "right" });

      // Subtitle
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
        .text("This sheet shows the exact bespoke design ordered. Use all views for accurate production.", L, 74, { width: W, align: "center" });

      hline(85, GOLD, 0.5);

      // Grid: 3 images per row, max 2 rows = 6 images
      const COLS      = 3;
      const IMG_W     = 145;
      const IMG_H     = 145;
      const CELL_W    = IMG_W + 10;
      const CELL_H    = IMG_H + 20;
      const GRID_LEFT = L + (W - COLS * CELL_W) / 2;

      data.designViews.forEach((view, idx) => {
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        if (row > 1) return; // max 2 rows

        const cx = GRID_LEFT + col * CELL_W;
        const cy = 92 + row * (CELL_H + 12);

        // White image box with border
        doc.rect(cx, cy, IMG_W, IMG_H).fill("#FFFFFF").stroke("#E5E0D8");
        try {
          doc.image(view.buffer, cx + 2, cy + 2, { width: IMG_W - 4, height: IMG_H - 4, fit: [IMG_W - 4, IMG_H - 4], align: "center", valign: "center" });
        } catch {
          // If image embed fails, show placeholder text
          doc.font("Helvetica").fontSize(7).fillColor(MUTED)
            .text("(image unavailable)", cx, cy + IMG_H / 2 - 4, { width: IMG_W, align: "center" });
        }

        // Label below image
        doc.font("Helvetica-Bold").fontSize(7).fillColor(BLACK)
          .text(view.label.toUpperCase(), cx, cy + IMG_H + 4, { width: IMG_W, align: "center" });
      });

      // Footer note
      const noteY = 92 + 2 * (CELL_H + 12) + 8;
      hline(Math.max(noteY, 460), GOLD, 0.5);
      doc.font("Helvetica").fontSize(7).fillColor(MUTED)
        .text("Confidential — For internal production use only. Views shown are from the bespoke design studio at the time of order placement.", L, Math.max(noteY, 460) + 6, { width: W, align: "center" });
    }

    doc.end();
  });
}
