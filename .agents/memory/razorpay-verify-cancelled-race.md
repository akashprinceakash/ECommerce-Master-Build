---
name: Razorpay verify must accept race-cancelled orders
description: /payment/verify status gate must match the webhook's and confirmOrder's leniency for cancelled+no-paymentId orders, or customers get told "payment failed" despite a successful capture.
---

If an order can be auto-cancelled (retry flow, cart-total-changed, expiry) while the customer is mid-checkout on Razorpay's hosted page, the synchronous `/payment/verify` handler must accept that "cancelled with no paymentId" state and fall through to signature verification + `confirmOrder`, not reject it outright.

**Why:** `confirmOrder`'s DB update and the async webhook handler both already treat `cancelled && !paymentId` as a recoverable race (money was captured, order was just administratively cancelled moments before). If the synchronous verify endpoint has a stricter status allowlist than those two, the customer sees an immediate false "payment failed" even though Razorpay captured the money — and the order only gets fixed later when the webhook fires (sometimes with real delay), which is confusing and support-generating. A live customer hit this on KA.SHA in 2026-06.

**How to apply:** Whenever multiple code paths reconcile the same payment/order status transition (verify endpoint, webhook, retry endpoint, confirmOrder), audit that their allowed-state gates are consistent with each other. The most permissive one (usually the webhook, since it's the ultimate source of truth) should define the floor for what the others must also accept.
