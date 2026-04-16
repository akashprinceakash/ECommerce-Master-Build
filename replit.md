# KA.SHA — Luxury Indian Fashion eCommerce

## Overview

KA.SHA is a full-stack premium Indian luxury fashion eCommerce web application built as a pnpm monorepo. Features include product browsing, a 3D Bespoke Customization Studio, Clerk authentication, cart, Indian Rupee (₹) checkout, saved designs, order history, and user profiles.

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

## Design System
- **Background**: Warm ivory (`hsl(16 10% 97%)`)
- **Primary**: Deep amber/gold (`hsl(35 45% 30%)`)
- **Radius**: 0.25rem (minimal, editorial)
- **Prices**: Stored in paise (integer), displayed as ₹ with Indian number formatting

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
