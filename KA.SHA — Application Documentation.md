# KA.SHA — Complete Application Documentation

**Platform:** Golf & Luxury Sportswear eCommerce  
**URL:** https://www.kashaonline.in  
**Last Updated:** June 2026

---

## Table of Contents

1. [System Overview](#system-overview)
2. [User Flow — Step by Step](#user-flow)
   - Registration & Login
   - Browsing & Search
   - Product Detail
   - Custom Studio (Bespoke)
   - Cart & Checkout
   - Payment
   - Order Tracking
   - Profile & Saved Designs
3. [Admin Flow — Step by Step](#admin-flow)
   - Dashboard
   - Product Management
   - Order Management
   - Order Status Lifecycle
   - CSV Export
   - Customer Management
   - Design Management
   - Site Settings
   - SKU Assets
   - Enquiries
4. [Order Status Reference](#order-status-reference)
5. [Email Notifications](#email-notifications)
6. [Feature Flags](#feature-flags)
7. [Shipping & Payments](#shipping--payments)

---

## System Overview

KA.SHA is a full-stack eCommerce application with two primary audiences:

| Audience | Entry Point | Key Actions |
|---|---|---|
| **Customer** | kashaonline.in | Browse, customize, buy, track |
| **Admin (Ka.Sha team)** | kashaonline.in/admin | Manage products, process orders, view designs, configure site |

**Technology at a glance:**
- Frontend: React + Vite (single-page app)
- Backend: Express API
- Database: PostgreSQL (hosted on Neon)
- Auth: Clerk (Google Sign-in supported)
- Payments: Razorpay
- Shipping: Shiprocket
- Email: SendGrid
- Image/Asset Storage: Cloudflare R2

---

## User Flow

### 1. Registration & Login

**Where:** `/sign-in` or `/sign-up`

Customers sign in using **Clerk authentication**, which supports:
- Email + password
- Google Sign-in (one click)

> **First-time customer:** Clicking "Sign In" from the navbar or from checkout redirects to `/sign-in`. After successful login, the customer is returned to their previous page.

**What happens on first login:**
- A user profile is created automatically in the database
- The cart (which may contain guest-selected items) is preserved

---

### 2. Browsing & Search

**Where:** `/` (Home) and `/products`

#### Home Page
The home page contains:
- **Hero banner** — full-width rotating image slides (managed from admin)
- **Men / Women category tiles** — click to filter products
- **Custom Studio call-to-action** — links to the bespoke studio
- **Bulk & Corporate section** — for Tournaments, Golf Academies, Social Golf Clubs (links to enquiry form)
- **Brand story teaser** — links to Heritage page

#### Product Listing (`/products`)
- Filters available: **Gender** (Men / Women), **Category** (Polo, T-Shirt, etc.)
- Search bar (`/search`) — searches by product name, description, category
- Products marked as **Hidden** by admin do NOT appear here
- Clicking a product card opens the Product Detail page

---

### 3. Product Detail

**Where:** `/products/:id`

Each product page shows:
- **Product images** — main + additional gallery (swipe/click)
- **Color swatch** — visual indicator of the garment colour from SKU
- **Size selector** — XS / S / M / L / XL / XXL / CUSTOM
- **Multi-piece pricing table** — discount tiers (1 pc / 2 pcs / 3 pcs / 4 pcs / 5+ pcs)
- **Price** (inclusive of GST)
- **Add to Cart** button
- **Customize This Garment** button (opens Custom Studio)

> **Hidden products:** If an admin marks a product as Hidden, visiting its URL directly returns a "Product not found" page — it is completely inaccessible.

> **Out of stock:** If stock = 0, "Add to Cart" is disabled and shows "Sold Out".

---

### 4. Custom Studio (Bespoke Customization)

**Where:** `/products/:id/customize` or `/customize`

The Custom Studio is a 3D garment design tool. Here's how it works step by step:

#### Step 1 — Choose a Style
When entering from a product page, customers first choose a design approach:
- **Solid Colors** — choose base body and collar colours from a palette
- **Print** — apply an all-over premium print design
- **Pattern** (for pattern-type products like KS1001B-KS1005B) — choose a Ka.Sha design with recolourable accent panels

#### Step 2 — Design Your Garment

The studio has two panels:
- **Left/Centre:** Live 3D model viewer — rotates and updates in real time as changes are made
- **Right sidebar:** Controls panel with tabs

**Colour Controls:**
- **Base Body** — sets the main garment colour (e.g. Artichoke / Brown derived from SKU)
- **Collar** — accent colour for the collar zone
- Colour picker + preset swatch grid

**Print Controls:**
- **All-over print gallery** — curated print thumbnails (GP001 through GP034+)
- Click a print thumbnail to apply it to the garment texture
- Works independently per zone: Full Body, Base Body, Collar

**Logo / Text Placement:**
- Upload your own image (PNG, SVG) — appears as a draggable overlay on the 3D model
- Add text with custom font, size, and colour
- Placement options: Left Chest, Right Chest, Back Centre, Left Sleeve, Right Sleeve, Collar Left, Collar Right

**3D Model Controls:**
- Camera presets: Front / Back / Left / Right views
- Auto-rotate toggle
- Model pauses when you're actively designing

#### Step 3 — Save or Add to Cart
- **Save Design** — stores the design to the account (visible in Profile → Saved Designs)
- **Add to Cart** — adds the bespoke item to cart with the custom design attached

> **Reset button:** Clears all applied colours, prints, and overlays so you can start fresh. This is required when switching between print and colour (e.g. if you applied a print and then want to change the base colour, click Reset first).

---

### 5. Cart

**Where:** `/cart` (protected — requires login)

The cart shows:
- Product thumbnail, name, colour, size, quantity
- Per-item price and subtotal
- **Bespoke tag** if the item has a custom design
- Remove item button
- Cart total (before shipping)
- "Proceed to Checkout" button

> **Guest cart:** Items added before login are held in browser local storage and transferred when the user signs in.

---

### 6. Checkout

**Where:** `/checkout` (protected)

**Step 1 — Shipping Details**
Customer fills in:
- Full name
- Phone number
- Complete address
- City, State
- PIN code (6 digits)

**Step 2 — Shipping Rate**
- After entering PIN code, the system calls Shiprocket to check serviceability and calculate cost
- Weight is calculated as: `total quantity × 0.4 kg` (e.g. 3 items = 1.2 kg)
- Available courier options and charges are displayed
- Customer selects their preferred option

**Step 3 — Payment Method**
- **Razorpay (Online)** — credit/debit card, UPI, net banking, wallets
- **COD (Cash on Delivery)** — available for standard products; **not available for bespoke/customized orders**

> **Order total** = items subtotal + selected shipping charge

---

### 7. Payment

#### Online Payment (Razorpay)
1. Customer clicks "Pay Now"
2. A Razorpay order is created on the server → a **pending** order record is saved in the database
3. The Razorpay payment modal opens in-browser
4. Customer completes payment (UPI, card, etc.)
5. On success, the server **verifies the Razorpay signature** cryptographically
6. Order status moves to **confirmed**
7. Fulfillment begins automatically in the background (see below)

#### COD (Cash on Delivery)
1. Customer clicks "Place Order (Pay on Delivery)"
2. Order is immediately created as **confirmed**
3. Fulfillment begins automatically

#### What Happens After Confirmation (Fulfillment)
Automatically triggered within seconds of order confirmation:
1. **Stock is deducted** for each ordered item
2. **Shiprocket order is created** — shipping label prepared, AWB number assigned
3. **Invoice PDF is generated** — includes order number, itemised bill, address, GST details
4. **Confirmation email is sent** to the customer with the invoice attached

---

### 8. Order Tracking

**Where:** `/orders` and `/orders/:id`

- **Orders list** — shows all past orders with status badges
- **Order detail** — full breakdown: items, sizes, quantities, prices, shipping address, payment details, Shiprocket tracking link (once shipped)

**Order status badges:**

| Status | Meaning |
|---|---|
| 🟡 Pending | Payment initiated but not yet captured |
| 🔵 Confirmed | Payment successful, being prepared |
| 🟣 Shipped | Handed to courier, AWB assigned |
| 🟢 Delivered | Order received by customer |
| 🔴 Cancelled | Order aborted or payment failed |

- **Track Shipment** button appears once AWB is assigned (links to Shiprocket tracking page)
- **Download Invoice** — customer can re-download their invoice PDF at any time

---

### 9. Profile & Saved Designs

**Where:** `/profile`

- View account details (name, email)
- **Saved Designs** tab — gallery of all bespoke designs saved in the Custom Studio
  - Click to reload a design back into the studio for editing
  - Delete saved designs
- **Orders** tab — shortcut to order history

---

## Admin Flow

**Where:** `/admin`  
**Access:** Must be logged in with an account that has `role: "admin"` in Clerk metadata, OR whose email is listed in the `ADMIN_EMAILS` environment variable.

The admin panel has **8 tabs:**

---

### Dashboard

**What you see:**
- **Revenue** — total confirmed + shipped + delivered order value
- **Orders** — total count across all statuses
- **Products** — total listed products
- **Saved Designs** — total bespoke designs across all customers
- **Users** — total registered accounts
- **Order status breakdown** — count of Confirmed, Shipped, Delivered, Pending orders
- **Recent orders** — last 5 orders at a glance

---

### Product Management

**Tab: Products**

#### Adding a New Product
1. Fill in the form fields:
   - **Name** — displayed on the product page
   - **Description** — product description text
   - **Category** — Polo / T-Shirt / Shorts / Trousers / Skort / Accessories
   - **Gender** — Men / Women / Unisex
   - **Sub-type** — (Golf / Sports / Casual etc.)
   - **SKU** — product code (e.g. `KS1002B-artichoke-brown`). This drives colour label and Custom Studio behaviour.
   - **Price** (in ₹ inclusive of GST)
   - **Stock** — number of units available
   - **Sizes available** — multi-select (XS/S/M/L/XL/XXL/CUSTOM)
   - **Default colour** — hex colour picker (used as fallback swatch)
   - **3D Model** — upload a `.glb` file (the 3D garment that appears in the Custom Studio)
   - **Thumbnail** — main product image (auto-compressed on upload)
   - **Additional Images** — up to 5 gallery images
2. Click **Add Product**

#### Editing a Product
- Click the ✏️ pencil icon next to any product in the list
- All fields are editable including status and stock
- Click **Save**

#### Hiding a Product
- In the product row, toggle **Available** off (or set to Hidden)
- Hidden products: do NOT appear in listings, and direct URL access returns 404
- Products can be re-activated at any time by toggling Available back on

#### Deleting a Product
- Click the 🗑️ trash icon
- The product and its associated uploaded assets are permanently deleted

---

### Order Management

**Tab: Orders**

This is the primary day-to-day workflow for the Ka.Sha team.

#### Viewing Orders
- All orders are listed newest first
- **Filter pills** at the top: All / Pending / Confirmed / Shipped / Delivered / Cancelled
- Click on any order row to **expand** it inline, or click **View** to open the full order modal

#### Full Order Modal (View)
Shows the complete order details:
- Customer name, email
- Order date, order number
- Current status
- Shipping address (name, address, city, state, pincode, phone)
- Payment verification badge (✅ Verified / ⏳ Pending / ❌ Failed)
- Payment ID and Razorpay Order ID
- Shiprocket Order # and AWB (if synced)
- Track Shipment link (if AWB available)
- Items with thumbnail, product name, size, quantity, price
- Bespoke design details (if applicable)

#### Updating Order Status
In the expanded order row or in the View modal:
- Click any status button: **Pending → Confirmed → Shipped → Delivered**
- You can also click **Cancelled** at any stage
- Status changes are instant and reflected in the customer's order page

#### Shiprocket Sync
- When an order is confirmed, Shiprocket is automatically triggered
- If the automatic sync failed (shows "Not synced" in amber), click **Sync to Shiprocket** button
- On success, the Shiprocket Order # and AWB appear

#### Issuing a Refund
- Click **Issue Refund** (rose/red button) on any non-cancelled order with a payment
- System calls Razorpay to issue a full refund
- Order is automatically moved to **Cancelled** status
- A confirmation with the Refund ID is shown

#### Exporting Orders to CSV
- Click **Export CSV (N)** button at the top-right of the filter bar
- Exports exactly the orders currently shown (use filters first to narrow down, e.g. "Confirmed" only)
- CSV columns include: Order #, Date, Status, Customer Name, Email, Phone, Ship Address, City, State, Pincode, Product, Category, Size, Qty, Item Price (₹), Order Total (₹), Shipping Charge (₹), Payment ID, Razorpay Order ID, Shiprocket Order #, AWB, Tracking URL
- File is named e.g. `kasha-orders-confirmed-2026-06-08.csv`
- Opens correctly in Excel and Google Sheets

---

### Order Status Lifecycle

```
                  Payment initiated
                       │
                       ▼
                   [PENDING]
                       │
         ┌─────────────┴──────────────┐
         │ Payment verified (online)  │ Order placed (COD)
         ▼                            ▼
                   [CONFIRMED]
                    │
                    │  Auto-triggers:
                    │  • Stock deduction
                    │  • Shiprocket order created
                    │  • Invoice PDF generated
                    │  • Confirmation email sent
                    ▼
                  [SHIPPED]
                    │  AWB assigned by Shiprocket
                    │  Tracking link available
                    ▼
                 [DELIVERED]

     Any stage ──────────────► [CANCELLED]
                                 (+ Refund if payment was captured)
```

**Actions available at each status:**

| Current Status | Can Change To | Refund Available |
|---|---|---|
| Pending | Confirmed, Cancelled | No |
| Confirmed | Shipped, Cancelled | Yes |
| Shipped | Delivered, Cancelled | Yes |
| Delivered | (none recommended) | Yes |
| Cancelled | (terminal) | N/A |

---

### Customer Management

**Tab: Users**

- Full list of all registered customers
- For each customer: name, email, registration date, total orders count
- Click **View Orders** to see the customer's complete order history
- **Toggle Admin** — grant or revoke admin access for any user

---

### Design Management

**Tab: Designs**

All bespoke designs saved by customers across the platform:
- Thumbnail preview of the 3D design
- Customer name and email
- Design name, date saved
- Colours and pattern/preset used
- **Export Design as PNG** — downloads the flat design texture (all sides) as PNG files for production use
- Full 3D viewer — can orbit/rotate the 3D model with the applied design

---

### Site Settings

**Tab: Site**

Control what customers see on the home page:
- **Hero Banners** — upload/replace the full-width banner images that rotate on the homepage
  - Each banner: image upload (auto-compressed), link destination, alt text
  - Drag to reorder banners
- Banner changes are live immediately for all visitors

---

### SKU Assets

**Tab: SKU Assets**

Manage design files tied to specific product SKUs:
- Upload print pattern images (`.jpeg`, `.png`)
- These appear in the Custom Studio's print gallery when a customer customizes the matching product
- File naming convention: `KS1000BGP001.jpeg` etc.

---

### Enquiries

**Tab: Enquiries**

All submissions from the **Connect With Us** (`/connect`) page:
- Customer name, email, phone
- Message content
- Date received
- Bulk/Corporate enquiries (Tournaments, Golf Academies, Social Clubs) also land here
- No reply functionality in the panel — replies are done via email externally

---

## Email Notifications

| Trigger | Recipient | Contents |
|---|---|---|
| Order confirmed | Customer + Admin (BCC) | Order summary, itemised list, shipping address, total, invoice PDF attached, Shiprocket tracking link |
| Contact form submitted | Admin | Customer's name, email, phone, message |

Emails are sent via **SendGrid**. The invoice PDF is auto-generated with:
- Ka.Sha branding
- Order number and date
- Customer billing details
- Line items with sizes, quantities, and prices
- Shipping charge
- Grand total

---

## Feature Flags

Certain features can be enabled or disabled without code changes by editing `artifacts/kasha/src/lib/features.ts`:

| Flag | Default | Controls |
|---|---|---|
| `SHOW_KIDS` | `false` | Kids' nav link, Kids tab on home, Kids filter on /products |
| `SHOW_CUSTOMIZATION` | `true` | Custom Studio nav button, bespoke cards, customize buttons |
| `SHOW_LOOKBOOK` | `false` | Lookbook nav link, footer link, /lookbook route |

To re-enable a feature: set the flag to `true` and redeploy.

---

## Shipping & Payments

### Shipping (Shiprocket)

- Serviceability and rates are checked by PIN code at checkout
- Weight calculation: **each garment = 0.4 kg** (e.g. 3 pieces = 1.2 kg)
- Box dimensions sent to Shiprocket: 35 × 30 × 5 cm (standard)
- If Shiprocket is unavailable, a fallback rate of ₹99 is shown
- After order confirmation, Shiprocket creates a shipping label automatically
- AWB (tracking number) is saved on the order and shown to the customer

### Payments (Razorpay)

- All prices are in **Indian Rupees (₹)**, inclusive of GST
- Supported methods: UPI, Credit/Debit Card, Net Banking, Wallets
- **COD** is available for standard (non-bespoke) orders only
- Payment verification uses Razorpay's HMAC-SHA256 signature check server-side — preventing any tampering
- Refunds are issued back to the original payment method via Razorpay (typically 5–7 business days)

### Multi-Piece Pricing

| Quantity | Discount |
|---|---|
| 1 piece | Base price |
| 2 pieces | 10% off |
| 3 pieces | 15% off |
| 4 pieces | 20% off |
| 5+ pieces | Bulk order → enquiry |

---

## Onboarding Checklist for New Team Members

### To process a new order:
1. Go to `/admin` → **Orders** tab
2. Filter by **Confirmed**
3. Click **View** on the order
4. Check: customer name, address, PIN, items, sizes, quantities
5. If Shiprocket shows "Not synced" → click **Sync to Shiprocket**
6. Once Shiprocket confirms → click **Shipped** to update status
7. Customer receives tracking link automatically

### To add a new product:
1. Go to `/admin` → **Products** tab
2. Fill in all fields (name, SKU, price, stock, sizes)
3. Upload 3D model (`.glb`) and thumbnail image
4. Click **Add Product**
5. Product is immediately live on the site

### To hide a product temporarily:
1. Go to `/admin` → **Products** tab
2. Find the product → click ✏️ edit
3. Toggle **Available** to off (Hidden)
4. Click Save — product is instantly inaccessible on the site

### To export this week's confirmed orders:
1. Go to `/admin` → **Orders** tab
2. Click the **Confirmed** filter pill
3. Click **Export CSV (N)** — file downloads immediately
4. Open in Excel — all order details including addresses and sizes are included
