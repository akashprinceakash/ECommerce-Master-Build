---
name: Payment total integrity
description: Rule for keeping server-side checkout total in sync with cart display total — any new charge component must be added in both places.
---

## The rule
Every component that contributes to what the customer sees in the cart UI **must** also be included in `validateCheckoutCart()` in `payments.ts`. The two formulas must be identical:

```
per-unit price = discounted_product_price + customizationChargeInPaise
line total     = per_unit_price × quantity
itemsTotal     = Σ line totals
orderTotal     = itemsTotal + shippingCharge − couponDiscount
```

`validateCheckoutCart()` is the **single source of truth** for the amount Razorpay is told to charge. If it omits a component, the customer is undercharged and Razorpay captures less money than the invoice says.

## What broke (order #42)
`validateCheckoutCart()` only joined `productsTable`. It never fetched `customizationsTable`, so `customizationChargeInPaise` was silently dropped from `itemsTotalInPaise`. The Razorpay order was created for ₹2,099 (product + shipping) instead of ₹2,132 (product + customization + shipping). The customer paid ₹33 less than they should have.

**Why:** The function was written before customization charges existed and was never updated when they were added to the cart.

## How to apply
Any time a new per-item charge is introduced (e.g. gift wrapping, engraving, rush fee):
1. Add it to `cart.ts` `buildCartResponse` reduce.
2. Add the same logic to `validateCheckoutCart()` in `payments.ts` — including the DB join needed to fetch the charge.
3. Add it to both `orderItemsTable` insert calls (Razorpay path and COD path) so `priceInPaise` in stored order items equals the per-unit amount actually charged.
4. Check that the invoice generator's line total (`item.priceInPaise × item.quantity`) still produces the correct value.

## Files
- `artifacts/api-server/src/routes/payments.ts` — `validateCheckoutCart()`, both `orderItemsTable` inserts
- `artifacts/api-server/src/routes/cart.ts` — `buildCartResponse` reduce (the reference formula)
