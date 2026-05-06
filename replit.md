# KA.SHA — Golf & Sportswear Fashion eCommerce

## Run & Operate
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm --filter @workspace/kasha run dev` — run frontend

**Environment Variables:**
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `ADMIN_EMAILS` (comma-separated for admin panel access)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

## Stack
- **Monorepo**: pnpm workspaces
- **Frontend**: React 18 + Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express 5, Zod, Drizzle ORM
- **Database**: PostgreSQL
- **Auth**: Clerk
- **State Management**: TanStack Query (React Query)
- **3D Viewer**: Google `model-viewer` web component, Fabric.js v7
- **API Codegen**: Orval (from OpenAPI spec)

## Where things live
- `artifacts/kasha/` — React + Vite frontend
- `artifacts/api-server/` — Express 5 API backend
- `lib/db/schema.ts` — Drizzle ORM PostgreSQL schema (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI specification (source of truth)
- `lib/api-zod/` — Generated Zod schemas
- `lib/api-client-react/` — Generated React Query hooks
- `src/components/3d/patterns.ts` — Curated print library and zone presets for 3D customizer
- `src/components/3d/gt-styles.ts` — GT Design Style System logic
- `artifacts/api-server/public/models/` — Uploaded 3D models
- `artifacts/api-server/public/thumbnails/` — Uploaded thumbnails

## Architecture decisions
- **Monorepo Structure**: Uses pnpm workspaces to manage frontend, backend, and shared libraries (`db`, `api-spec`, `api-zod`, `api-client-react`) for better code organization and dependency management.
- **API Codegen**: Orval is used to generate React Query hooks and Zod schemas directly from an OpenAPI specification, ensuring type safety and consistency between frontend and backend.
- **3D Customizer Logic**: A unified Bespoke Studio combines `model-viewer` for 3D rendering with Fabric.js for 2D design, using a 1024x1024 texture pipeline for applying designs to the 3D model. GT Design styles are texture-based, allowing efficient recoloring.
- **Payment Flow Security**: Razorpay integration uses a two-step server-side verification process (order creation then payment verification) to prevent tampering and ensure idempotency.
- **Admin Panel Access Control**: Admin access is granted via Clerk's `publicMetadata.role` or an `ADMIN_EMAILS` environment variable, ensuring robust authorization for sensitive operations.

## Product
- **Product Catalog**: Browse golf/sportswear products.
- **Bespoke Customization Studio**: Users can customize garments with 3D model interaction, 2D image/text/pattern uploads, and a curated print library.
- **Authentication**: User accounts via Clerk, supporting sign-in, sign-up, and profile management.
- **Shopping Cart**: Slide-out cart drawer for managing selected items.
- **Checkout**: Indian Rupee (₹) checkout process with Razorpay integration.
- **Order Management**: View order history and detailed order information.
- **Saved Designs**: Users can save their customized designs.
- **Admin Panel**: Comprehensive dashboard for managing products, orders, users, and customer designs.

## User preferences
_Populate as you build_

## Gotchas
- `lib/api-zod/src/index.ts` must ONLY export `export * from "./generated/api"` to avoid conflicts during codegen.
- When adding new prints to the customizer, drop the image into `public/patterns/` and add an entry to `src/components/3d/patterns.ts`.
- Text and logos on the 3D model are added with `flipX:true` to counteract the body-UV horizontal mirror, ensuring correct readability.
- To grant admin access, set `{"role": "admin"}` in the user's Clerk Public Metadata or add their email to `ADMIN_EMAILS`.

## Pointers
- **Clerk Documentation**: [https://clerk.com/docs](https://clerk.com/docs)
- **Drizzle ORM Documentation**: [https://orm.drizzle.team/docs](https://orm.drizzle.team/docs)
- **Orval Documentation**: [https://orval.dev/docs](https://orval.dev/docs)
- **Fabric.js Documentation**: [http://fabricjs.com/docs](http://fabricjs.com/docs)
- **Google Model-Viewer Documentation**: [https://modelviewer.dev/docs/](https://modelviewer.dev/docs/)
- **Razorpay Integration Guide**: [https://razorpay.com/docs/](https://razorpay.com/docs/)