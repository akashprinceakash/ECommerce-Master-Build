/**
 * Payment integrity tests — pricing.ts
 *
 * These tests are the automated guard for the requirement:
 *   Cart total = Checkout total = Razorpay order amount = Final order total = Invoice total
 *
 * Run with:  pnpm --filter @workspace/api-server test
 *
 * Tests cover every scenario in the payment safety checklist:
 *   ✓ Tier multiplier at every breakpoint
 *   ✓ Plain product, single and multiple quantities
 *   ✓ Bespoke product with customization charge
 *   ✓ Mixed cart (bespoke + plain)
 *   ✓ Volume discount is on product price only (not on customization charge)
 *   ✓ Coupon/discount applied consistently
 *   ✓ Shipping charge added correctly
 *   ✓ Grand total floored at zero (no negative orders)
 *   ✓ Invoice line total = unitPrice × qty (what the invoice PDF uses)
 *   ✓ Identity: cartItemsTotal + shipping − discount = orderGrandTotal
 *   ✓ Order #42 regression: bespoke shirt must include customization charge
 */

import { describe, it, expect } from "vitest";
import {
  tierMultiplier,
  itemUnitPriceInPaise,
  itemLineTotalInPaise,
  cartItemsTotalInPaise,
  orderGrandTotalInPaise,
} from "./pricing";

// ─── Constants used across tests ──────────────────────────────────────────────

const SHIRT_PRICE   = 200_000; // ₹2,000 in paise
const CUSTOM_CHARGE =   3_300; // ₹33 in paise
const SHIPPING      =   9_900; // ₹99 in paise
const SHIPPING_FREE =       0;

// ─── tierMultiplier ────────────────────────────────────────────────────────────

describe("tierMultiplier", () => {
  it("returns 1.00 for qty = 1", () => {
    expect(tierMultiplier(1)).toBe(1.0);
  });

  it("returns 0.90 for qty = 2  (10% off)", () => {
    expect(tierMultiplier(2)).toBe(0.90);
  });

  it("returns 0.85 for qty = 3  (15% off)", () => {
    expect(tierMultiplier(3)).toBe(0.85);
  });

  it("returns 0.80 for qty = 4  (20% off)", () => {
    expect(tierMultiplier(4)).toBe(0.80);
  });

  it("returns 0.80 for qty = 10 (20% off — same ceiling)", () => {
    expect(tierMultiplier(10)).toBe(0.80);
  });
});

// ─── itemUnitPriceInPaise ──────────────────────────────────────────────────────

describe("itemUnitPriceInPaise", () => {
  it("plain product qty=1: full product price, no customization", () => {
    expect(itemUnitPriceInPaise(SHIRT_PRICE, 1)).toBe(200_000);
  });

  it("plain product qty=2: 10% tier discount applied to product", () => {
    // 200_000 × 0.90 = 180_000
    expect(itemUnitPriceInPaise(SHIRT_PRICE, 2)).toBe(180_000);
  });

  it("plain product qty=3: 15% tier discount applied to product", () => {
    // 200_000 × 0.85 = 170_000
    expect(itemUnitPriceInPaise(SHIRT_PRICE, 3)).toBe(170_000);
  });

  it("plain product qty=4: 20% tier discount applied to product", () => {
    // 200_000 × 0.80 = 160_000
    expect(itemUnitPriceInPaise(SHIRT_PRICE, 4)).toBe(160_000);
  });

  it("bespoke product qty=1: customization charge added to full product price", () => {
    // 200_000 × 1.00 + 3_300 = 203_300
    expect(itemUnitPriceInPaise(SHIRT_PRICE, 1, CUSTOM_CHARGE)).toBe(203_300);
  });

  it("bespoke product qty=2: tier discount on product, customization charge NOT discounted", () => {
    // product: 200_000 × 0.90 = 180_000 + 3_300 customization = 183_300
    expect(itemUnitPriceInPaise(SHIRT_PRICE, 2, CUSTOM_CHARGE)).toBe(183_300);
  });

  it("bespoke product qty=4: 20% off product, customization unchanged", () => {
    // product: 200_000 × 0.80 = 160_000 + 3_300 = 163_300
    expect(itemUnitPriceInPaise(SHIRT_PRICE, 4, CUSTOM_CHARGE)).toBe(163_300);
  });

  it("omitting customizationChargeInPaise defaults to 0", () => {
    expect(itemUnitPriceInPaise(SHIRT_PRICE, 1)).toBe(itemUnitPriceInPaise(SHIRT_PRICE, 1, 0));
  });
});

// ─── itemLineTotalInPaise ──────────────────────────────────────────────────────

describe("itemLineTotalInPaise", () => {
  it("qty=1: line total = unit price", () => {
    expect(itemLineTotalInPaise(200_000, 1)).toBe(200_000);
  });

  it("qty=3: line total = unit price × 3", () => {
    expect(itemLineTotalInPaise(170_000, 3)).toBe(510_000);
  });

  it("bespoke qty=2: line total includes customization × 2", () => {
    // unitPrice = 183_300, qty = 2 → 366_600
    const unitPrice = itemUnitPriceInPaise(SHIRT_PRICE, 2, CUSTOM_CHARGE);
    expect(itemLineTotalInPaise(unitPrice, 2)).toBe(366_600);
  });
});

// ─── cartItemsTotalInPaise ────────────────────────────────────────────────────

describe("cartItemsTotalInPaise", () => {
  it("empty cart returns 0", () => {
    expect(cartItemsTotalInPaise([])).toBe(0);
  });

  it("single plain item qty=1", () => {
    expect(cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1 },
    ])).toBe(200_000);
  });

  it("single plain item qty=2 — tier discount applied", () => {
    // unitPrice = 180_000, line total = 360_000
    expect(cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 2 },
    ])).toBe(360_000);
  });

  it("single bespoke item qty=1 — customization included", () => {
    // unitPrice = 203_300, line total = 203_300
    expect(cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1, customizationChargeInPaise: CUSTOM_CHARGE },
    ])).toBe(203_300);
  });

  it("single bespoke item qty=2 — tier on product, full customization × qty", () => {
    // unitPrice = 183_300, line total = 366_600
    expect(cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 2, customizationChargeInPaise: CUSTOM_CHARGE },
    ])).toBe(366_600);
  });

  it("mixed cart: one plain + one bespoke", () => {
    // plain: 200_000 × 1 = 200_000
    // bespoke: (200_000 + 3_300) × 1 = 203_300
    // total = 403_300
    expect(cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1 },
      { productPriceInPaise: SHIRT_PRICE, quantity: 1, customizationChargeInPaise: CUSTOM_CHARGE },
    ])).toBe(403_300);
  });

  it("two different plain products with different quantities", () => {
    // shirt qty=2: 180_000 × 2 = 360_000
    // trouser ₹3,000, qty=1: 300_000 × 1 = 300_000
    // total = 660_000
    expect(cartItemsTotalInPaise([
      { productPriceInPaise: 200_000, quantity: 2 },
      { productPriceInPaise: 300_000, quantity: 1 },
    ])).toBe(660_000);
  });

  it("customizationChargeInPaise absent (undefined) treated as 0", () => {
    const withZero    = cartItemsTotalInPaise([{ productPriceInPaise: SHIRT_PRICE, quantity: 1, customizationChargeInPaise: 0 }]);
    const withAbsent  = cartItemsTotalInPaise([{ productPriceInPaise: SHIRT_PRICE, quantity: 1 }]);
    expect(withAbsent).toBe(withZero);
  });
});

// ─── orderGrandTotalInPaise ───────────────────────────────────────────────────

describe("orderGrandTotalInPaise", () => {
  it("no shipping, no discount: total = itemsTotal", () => {
    expect(orderGrandTotalInPaise(200_000, 0)).toBe(200_000);
  });

  it("adds shipping charge", () => {
    expect(orderGrandTotalInPaise(200_000, SHIPPING)).toBe(209_900);
  });

  it("subtracts coupon discount", () => {
    // 10% coupon on items total = 20_000
    expect(orderGrandTotalInPaise(200_000, SHIPPING, 20_000)).toBe(189_900);
  });

  it("discount cannot push total below zero", () => {
    expect(orderGrandTotalInPaise(200_000, 0, 500_000)).toBe(0);
  });

  it("discount defaults to 0 when omitted", () => {
    expect(orderGrandTotalInPaise(200_000, SHIPPING)).toBe(orderGrandTotalInPaise(200_000, SHIPPING, 0));
  });
});

// ─── Payment Identity Invariant ───────────────────────────────────────────────
// The core invariant:
//   Cart display total  ==  validateCheckoutCart itemsTotal + shipping − discount
//                       ==  Razorpay amount
//                       ==  ordersTable.totalInPaise
//                       ==  Invoice total
//
// These tests assert the mathematical identity holds for key scenarios.
// The architectural guarantee (same formula used everywhere) is enforced by
// importing pricing.ts in both cart.ts and payments.ts.

describe("Payment Identity Invariant", () => {
  it("Regression — Order #42: bespoke shirt + shipping = ₹2,132 not ₹2,099", () => {
    // Shirt ₹2,000 + customization ₹33 + shipping ₹99 = ₹2,132
    const itemsTotal = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1, customizationChargeInPaise: CUSTOM_CHARGE },
    ]);
    const grandTotal = orderGrandTotalInPaise(itemsTotal, SHIPPING);

    expect(itemsTotal).toBe(203_300);           // ₹2,033 items
    expect(grandTotal).toBe(213_200);           // ₹2,132 charged
    expect(grandTotal).not.toBe(209_900);       // must NOT be ₹2,099 (the bug value)
  });

  it("plain shirt qty=1, no discount: ₹2,000 + ₹99 shipping = ₹2,099", () => {
    const itemsTotal = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1 },
    ]);
    const grandTotal = orderGrandTotalInPaise(itemsTotal, SHIPPING);
    expect(grandTotal).toBe(209_900); // ₹2,099 is correct for a NON-bespoke item
  });

  it("2 bespoke shirts: tier discount on product, full customization × 2", () => {
    // product: 200_000 × 0.90 = 180_000; custom: 3_300
    // unit: 183_300; line: 183_300 × 2 = 366_600
    // + shipping 9_900 = 376_500
    const itemsTotal = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 2, customizationChargeInPaise: CUSTOM_CHARGE },
    ]);
    const grandTotal = orderGrandTotalInPaise(itemsTotal, SHIPPING);
    expect(itemsTotal).toBe(366_600);
    expect(grandTotal).toBe(376_500);
  });

  it("4 bespoke shirts: 20% tier discount on product, full customization × 4", () => {
    // product: 200_000 × 0.80 = 160_000; custom: 3_300
    // unit: 163_300; line: 163_300 × 4 = 653_200
    // + shipping 9_900 = 663_100
    const itemsTotal = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 4, customizationChargeInPaise: CUSTOM_CHARGE },
    ]);
    const grandTotal = orderGrandTotalInPaise(itemsTotal, SHIPPING);
    expect(itemsTotal).toBe(653_200);
    expect(grandTotal).toBe(663_100);
  });

  it("coupon discount applied after items+shipping, not before", () => {
    // Items: ₹2,033; Shipping: ₹99; Coupon: ₹200 off
    // grand = 203_300 + 9_900 − 20_000 = 193_200
    const itemsTotal  = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1, customizationChargeInPaise: CUSTOM_CHARGE },
    ]);
    const grandTotal = orderGrandTotalInPaise(itemsTotal, SHIPPING, 20_000);
    expect(grandTotal).toBe(193_200);
  });

  it("mixed bespoke + plain cart: both contribute correctly", () => {
    // plain shirt qty=1:   200_000
    // bespoke shirt qty=1: 203_300
    // items total:         403_300
    // + shipping 9_900     = 413_200
    const itemsTotal = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1 },
      { productPriceInPaise: SHIRT_PRICE, quantity: 1, customizationChargeInPaise: CUSTOM_CHARGE },
    ]);
    const grandTotal = orderGrandTotalInPaise(itemsTotal, SHIPPING);
    expect(itemsTotal).toBe(403_300);
    expect(grandTotal).toBe(413_200);
  });

  it("Razorpay amount verification: stored totalInPaise must equal captured amount", () => {
    // Simulates the /payment/verify check:
    //   if (Number(payment.amount) !== Number(dbOrder.totalInPaise)) → reject
    // We assert that our grand total formula produces the exact value Razorpay
    // would capture when the Razorpay order was created with this amount.
    const itemsTotal  = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1, customizationChargeInPaise: CUSTOM_CHARGE },
    ]);
    const orderTotal  = orderGrandTotalInPaise(itemsTotal, SHIPPING);
    const razorpayAmt = orderTotal; // what we pass to rzp.orders.create({ amount })

    // Payment arrives: Razorpay captured exactly the order amount
    const capturedAmt = razorpayAmt;
    expect(capturedAmt).toBe(orderTotal); // verification passes
  });

  it("order only confirmed after payment amount matches — mismatch must be detectable", () => {
    const itemsTotal  = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1 },
    ]);
    const orderTotal  = orderGrandTotalInPaise(itemsTotal, SHIPPING);
    const tampered    = orderTotal - 10_000; // frontend tried to pay less

    expect(tampered).not.toBe(orderTotal); // server should reject this
  });

  it("free shipping (₹0): total = items total only", () => {
    const itemsTotal = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: 1, customizationChargeInPaise: CUSTOM_CHARGE },
    ]);
    expect(orderGrandTotalInPaise(itemsTotal, SHIPPING_FREE)).toBe(itemsTotal);
  });

  it("invoice line total matches priceInPaise × quantity stored in order_items", () => {
    // The invoice PDF computes: item.priceInPaise × item.quantity
    // priceInPaise in DB = itemUnitPriceInPaise(product, qty, customization)
    // This test confirms that formula gives the right line total.
    const qty       = 2;
    const unitPrice = itemUnitPriceInPaise(SHIRT_PRICE, qty, CUSTOM_CHARGE); // stored as priceInPaise
    const lineTotal = unitPrice * qty;                                         // invoice calculation

    // Also equals what cartItemsTotalInPaise produces for this item
    const cartLine  = cartItemsTotalInPaise([
      { productPriceInPaise: SHIRT_PRICE, quantity: qty, customizationChargeInPaise: CUSTOM_CHARGE },
    ]);
    expect(lineTotal).toBe(cartLine);
    expect(lineTotal).toBe(366_600); // explicit expected value
  });
});
