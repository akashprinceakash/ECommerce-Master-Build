/**
 * pricing.ts — single source of truth for all payment amount calculations.
 *
 * RULES:
 *   - cart.ts, payments.ts, and the invoice generator MUST all import from here.
 *   - Never copy-paste these formulas elsewhere.
 *   - Any new charge (gift-wrap, rush fee, etc.) must be added here first,
 *     then used in every call-site.
 *   - The server always recomputes the final amount; frontend totals are
 *     display-only and are never trusted for charging.
 */

/**
 * Volume-discount multiplier per item, based on that item's own quantity.
 *
 *   1 piece  → full price  (×1.00)
 *   2 pieces → 10% off     (×0.90)
 *   3 pieces → 15% off     (×0.85)
 *   4+ pieces → 20% off    (×0.80)
 *
 * The discount applies to the product price ONLY — customization charges are
 * fixed service fees and are never discounted.
 */
export function tierMultiplier(qty: number): number {
  if (qty >= 4) return 0.80;
  if (qty === 3) return 0.85;
  if (qty === 2) return 0.90;
  return 1.0;
}

/**
 * Per-unit price for a single SKU in an order or cart.
 *
 * = round(productPrice × tierMultiplier(qty)) + customizationCharge
 *
 * @param productPriceInPaise      Base product price in paise (before discount)
 * @param qty                      Quantity ordered (determines the tier)
 * @param customizationChargeInPaise  Bespoke service charge (0 for plain items)
 */
export function itemUnitPriceInPaise(
  productPriceInPaise: number,
  qty: number,
  customizationChargeInPaise = 0,
): number {
  const discountedProductPrice = Math.round(productPriceInPaise * tierMultiplier(qty));
  return discountedProductPrice + customizationChargeInPaise;
}

/**
 * Line total for one order item = unitPrice × quantity.
 * Kept as a named function so tests can verify the multiplication step
 * independently of unit-price calculation.
 */
export function itemLineTotalInPaise(unitPriceInPaise: number, qty: number): number {
  return unitPriceInPaise * qty;
}

/**
 * Sum of all line totals in a cart or order.
 *
 * Each element describes one cart/order item; all fields must come from the
 * DATABASE — never from the frontend request body.
 */
export function cartItemsTotalInPaise(
  items: Array<{
    productPriceInPaise: number;
    quantity: number;
    customizationChargeInPaise?: number;
  }>,
): number {
  return items.reduce((sum, item) => {
    const unitPrice = itemUnitPriceInPaise(
      item.productPriceInPaise,
      item.quantity,
      item.customizationChargeInPaise ?? 0,
    );
    return sum + itemLineTotalInPaise(unitPrice, item.quantity);
  }, 0);
}

/**
 * Final payable amount charged to the customer.
 *
 * THIS VALUE must equal:
 *   - The amount passed to `rzp.orders.create({ amount })`
 *   - The `totalInPaise` stored in `ordersTable`
 *   - The `totalInPaise` on the invoice
 *   - The amount verified against `payment.amount` in /payment/verify
 *
 * Any divergence between these four is a payment integrity bug.
 *
 * @param itemsTotalInPaise    From cartItemsTotalInPaise()
 * @param shippingChargeInPaise Verified from Shiprocket / fallback ₹99
 * @param discountInPaise       Validated server-side coupon discount (0 if none)
 */
export function orderGrandTotalInPaise(
  itemsTotalInPaise: number,
  shippingChargeInPaise: number,
  discountInPaise = 0,
): number {
  return Math.max(0, itemsTotalInPaise + shippingChargeInPaise - discountInPaise);
}
