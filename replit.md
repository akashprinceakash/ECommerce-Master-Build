# KA.SHA — Golf & Sportswear Fashion eCommerce

## Overview

KA.SHA is a full-stack luxury golf/sportswear fashion eCommerce web application built as a pnpm monorepo. Features include product browsing, a Bespoke Customization Studio (supporting 3D model + 2D image upload), Clerk authentication, slide-out cart drawer, Indian Rupee (₹) checkout, saved designs, order history, and user profiles.

## Architecture

### Packages
- `artifacts/kasha` — React + Vite frontend (served at `/`)
- `artifacts/api-server` — Express 5 API backend (port 8080)
- `lib/db` — Drizzle ORM + PostgreSQL schema
- `lib/api-spec` — OpenAPI spec + Orval codegen config
- `lib/api-zod` — Generated Zod schemas (from Orval)
- `lib/api-client-react` — Generated React Query hooks (from Orval)

### Tech Stack
- **Monorepo**: pnpm workspaces
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui
- **Fonts**: Cormorant Garamond (serif headings), DM Sans (body)
- **Auth**: Clerk (VITE_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY)
- **3D Viewer**: Google `model-viewer` web component (dynamically loaded; with WebGL detection fallback) + Fabric.js v7 canvas for texture design
- **API**: Express 5 + Zod validation + Drizzle ORM
- **Database**: PostgreSQL (DATABASE_URL)
- **API Codegen**: Orval (from OpenAPI spec → React Query hooks + Zod)
- **State**: TanStack Query (React Query)
- **Cart**: Slide-out drawer via CartContext + CartDrawer component

## Design System
- **Theme**: Clean white/minimal golf sportswear aesthetic
- **Background**: White (`#ffffff`)
- **Primary**: Near-black (`hsl(0 0% 9%)`) — for buttons, CUSTOMISE badge
- **Accent/CTA**: Red (`#dc2626`) — for Checkout and Subscribe buttons
- **Navbar**: White, flat, black text — SHOP / TAILOR YOUR PLAY / PRINTS / ABOUT | MEN / WOMEN / KIDS | CUSTOMISE button
- **Footer**: Black background with column layout (Shop, Support, Newsletter)
- **Newsletter**: Dark olive/forest green (`#3d4a33`)
- **Radius**: 0.25rem (minimal, editorial)
- **Prices**: Stored in paise (integer), displayed as ₹ with Indian number formatting

## Key Components
- `src/components/layout/Navbar.tsx` — New design with category nav + CUSTOMISE button + cart icon
- `src/components/layout/CartDrawer.tsx` — Slide-out cart panel from right
- `src/contexts/CartContext.tsx` — Global open/close state for cart drawer
- `src/components/3d/ModelViewerCustomizer.tsx` — Bespoke Studio with 3D/2D upload support

## Admin Panel
- Route: `/admin` (single page with five tabs)
- Protected: requires Clerk `publicMetadata.role === "admin"` OR email matching `ADMIN_EMAILS` env var (comma-separated)
- **Dashboard tab**: KPI cards (revenue, orders, products, designs, customers, users), order status breakdown, recent orders feed (auto-refresh 30s)
- **Products tab**: Full product CRUD, .glb model + thumbnail upload
- **Orders tab**: List/filter all orders by status, expand to see line items + customer + shipping + payment IDs, update status (pending → confirmed → shipped → delivered → cancelled)
- **Users tab**: List all Clerk users with order/spend stats, grant/revoke admin via Clerk metadata, delete users (with confirmation)
- **Designs tab**: Browse all customer customizations with rich preview modal
- API routes:
  - Products: `GET/POST /api/admin/products`, `PUT/DELETE /api/admin/products/:id`
  - Uploads: `POST /api/admin/upload/model`, `POST /api/admin/upload/thumbnail`
  - Dashboard: `GET /api/admin/dashboard`
  - Orders: `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`
  - Users: `GET /api/admin/users`, `PATCH /api/admin/users/:id/admin`, `DELETE /api/admin/users/:id`
  - Designs: `GET /api/admin/customizations`

## Payments — Razorpay
- Real Razorpay integration replacing the previous mock checkout
- Required secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- Razorpay Checkout JS loaded via CDN in `index.html`
- Two-step server flow guards against tampering and replay:
  1. `POST /api/payment/order` — server snapshots cart into a `pending` DB order with `order_items`, creates a Razorpay order, returns `{ orderId, amount, currency, keyId }`
  2. `POST /api/payment/verify` — validates HMAC signature, fetches the payment from Razorpay API, asserts amount + order_id match the snapshotted DB order and `status === "captured"`, then marks the order `confirmed` and clears the cart
- Idempotent: replaying the same `razorpay_payment_id` returns the existing confirmed order instead of duplicating
- Legacy `POST /api/orders` is disabled (returns 410); orders can only be created via the verified payment flow
- Schema additions on `orders`: `razorpay_order_id`, `razorpay_signature` (alongside existing `payment_id`)
- Uploaded files stored in `artifacts/api-server/public/models/` and `public/thumbnails/`
- Served at `/api/public/models/*` and `/api/public/thumbnails/*`

To grant admin access to a user: In the Clerk Dashboard, find the user → Metadata → Public Metadata → set `{"role": "admin"}`

## Bespoke Studio (`/products/:id/customize`)
Full unified studio combining model-viewer 3D rendering with Fabric.js design canvas, per the client PDF specs.

### Layout
- **Header**: Back link, design name input, Save + Add to Cart buttons
- **Left panel**: Garment Parts (dynamic from .glb materials, per-part color pickers), Color Palette (13 luxury swatches), Auto Rotate toggle, Size (XS–XXL), Quantity, Save/Export
- **Center**: Google `model-viewer` web component for live 3D preview; WebGL fallback shows product thumbnail
- **Right panel (6 tabs)**: COLORS | DESIGN | TEXT | LOGO | SHAPES | CANVAS

### Right Panel Tabs
- **COLORS**: GT001–GT012 design presets with primary/secondary color chips; Primary Color swatch grid + custom picker (→ canvas bg + mat[0]); Secondary/Trim swatch grid + custom picker (→ mat[1] + garment overlays); live Design Summary panel
- **DESIGN**: Garment option toggles (Sleeves, Collar, Button Placket, Side Panel, Chest Stripe) → drawn as Fabric.js overlay shapes in Trim color; Pattern Overlay selector (None, Stripes, Grid, Dots)
- **TEXT**: content input, color + font picker (6 fonts), size slider (20–200), 6 placement buttons (Front Chest, Front Center, Back Top, Back Center, Left Sleeve, Right Sleeve), Add/Remove
- **LOGO**: file upload (PNG/SVG/JPG), 6 placement buttons, size slider, Apply/Remove
- **SHAPES**: shape/stroke color, stroke width, add Line/Curve/Rectangle/Circle/Stripe Pattern, Remove Selected
- **CANVAS**: texture background color, selected element scale/posX/posY sliders, Clear All, live Fabric.js canvas preview (drag to reposition elements)

### Persistence
Full design state saved per user per product: `canvasJSON` (with `data.garmentType` tags preserved via `fc.toJSON(["data"])`), `matColors`, `canvasBg`, `primaryColor`, `secondaryColor`, `garmentState` (5 booleans + pattern), `presetName`. PNG snapshot baked for admin viewer and cart preview.

### Texture Pipeline
Fabric.js 1024×1024 canvas → `toDataURL()` PNG → `model-viewer.createTexture()` → applied to mat[0] baseColorTexture. Syncs on every canvas change, material change, or garment toggle.

## Pages / Routes
| Route | Component | Auth |
|-------|-----------|------|
| `/` | Home | Public |
| `/products` | Products collection | Public |
| `/products/:id` | Product detail (with Add to Cart + Bespoke Studio) | Public |
| `/products/:id/customize` | Bespoke Customization Studio | Public |
| `/heritage` | Brand story/heritage page | Public |
| `/sign-in` | Clerk sign-in | Public |
| `/sign-up` | Clerk sign-up | Public |
| `/cart` | Shopping cart | Protected |
| `/checkout` | Indian checkout (₹) | Protected |
| `/orders` | Order history | Protected |
| `/orders/:id` | Order detail | Protected |
| `/profile` | User profile + saved designs | Protected |

## Database Schema
Tables: `user_profiles`, `products`, `customizations`, `carts`, `cart_items`, `orders`, `order_items`

### Seeded Products
- The Silk Kurta — ₹12,999 (thumbnail: `/images/product-tshirt.png`)
- The Linen Trouser — ₹8,999 (thumbnail: `/images/product-trousers.png`)  
- The Khadi Jacket — ₹18,999 (thumbnail: `/images/product-jacket.png`)

## Key Implementation Notes

### API Codegen
- `lib/api-zod/src/index.ts` must ONLY export `export * from "./generated/api"` — codegen overwrites and adds types that conflict with Zod const exports
- `orval.config.ts`: `schemas` property removed from zod config to prevent TypeScript type conflicts
- Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### 3D Viewer (WebGL Fallback)
- The `ProductViewer` component detects WebGL support before rendering the Three.js Canvas
- When WebGL is unavailable (e.g., server-side render, headless browser), it shows the product's `thumbnailUrl` image as a graceful fallback
- In production browsers with GPU support, the 3D interactive viewer renders normally

### Authentication
- Clerk is used for all auth
- Unauthenticated users can browse products and the homepage
- Cart/checkout/orders/profile require authentication (redirect to /sign-in)
- Cart icon shows item count badge when items are in cart

### Checkout
- Indian address format: name, address, city, state, pincode (6 digits), mobile phone
- All prices in Indian Rupees (₹)

## Key Commands
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm --filter @workspace/kasha run dev` — run frontend
