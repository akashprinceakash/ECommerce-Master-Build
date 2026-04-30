# KA.SHA — Golf & Sportswear Fashion eCommerce

## Overview
KA.SHA is a full-stack luxury golf/sportswear fashion eCommerce web application, specializing in bespoke customization. It features product browsing, a Bespoke Customization Studio (supporting 3D model and 2D image uploads), secure authentication, a slide-out cart, Indian Rupee checkout, saved designs, order history, and user profiles. The project aims to provide a premium online shopping experience for golf and sportswear fashion with unique customization options.

## User Preferences
I prefer clear and concise communication. When making changes, prioritize iterative development and explain the rationale behind significant architectural or design decisions. Avoid making changes to the `lib/api-zod/src/index.ts` file directly, as it is generated, and ensure that `orval.config.ts` does not reintroduce `schemas` property in the Zod config.

## System Architecture

### Monorepo Structure
The project is organized as a pnpm monorepo, separating concerns into distinct packages:
- `artifacts/kasha`: React + Vite frontend.
- `artifacts/api-server`: Express 5 API backend.
- `lib/db`: Drizzle ORM for PostgreSQL schema management.
- `lib/api-spec`: OpenAPI specification for API definition.
- `lib/api-zod`: Generated Zod schemas for validation.
- `lib/api-client-react`: Generated React Query hooks for API interaction.

### Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui.
- **Backend**: Express 5, Zod validation, Drizzle ORM.
- **Database**: PostgreSQL.
- **Authentication**: Clerk.
- **State Management**: TanStack Query (React Query).
- **3D Viewer**: Google `model-viewer` web component with Fabric.js for texture design.
- **API Codegen**: Orval (generates React Query hooks and Zod schemas from OpenAPI spec).

### Design System
The application features a clean, minimal golf sportswear aesthetic with a white background, near-black primary elements, and red accents for CTAs. Fonts are Cormorant Garamond for headings and DM Sans for body text. Prices are displayed in Indian Rupees (₹) with appropriate formatting.

### Bespoke Customization Studio (`/products/:id/customize`)
This studio unifies 3D rendering with a Fabric.js design canvas.
- **Layout**: Features a header with design name input, Save, and Add to Cart. A left panel manages garment parts (Front, Back, Left Sleeve, Right Sleeve, Collar) with inline color pickers for zone-based coloring. A central Google `model-viewer` provides a live 3D preview, with a WebGL fallback displaying a product thumbnail.
- **Right Panel (Tabs)**:
    - **COLORS**: Provides GT design presets and color pickers for primary/accent colors.
    - **DESIGN**: Offers garment option toggles (Sleeves, Collar, Button Placket, Side Panel, Chest Stripe) and pattern overlay selectors.
    - **TEXT**: Allows text input, color/font selection, size adjustment, and predefined placement buttons.
    - **LOGO**: Supports image uploads (PNG/SVG/JPG), size adjustment, and predefined placement buttons.
    - **SHAPES**: Enables adding lines, curves, rectangles, circles, and stripe patterns with customizable colors and stroke widths.
    - **CANVAS**: Provides sliders for scaling, positioning elements, and a "Clear All" function.
- **Persistence**: Full design state, including `canvasJSON`, `matColors`, `canvasBg`, `primaryColor`, `secondaryColor`, `garmentState`, and `presetName`, is saved per user per product. A PNG snapshot is generated for admin preview and cart.
- **Texture Pipeline**: Fabric.js canvas content is converted to a PNG and applied as a `baseColorTexture` to the 3D model, syncing with every canvas, material, or garment toggle change.
- **GT Design Engine** (`src/components/3d/gt-styles.ts`): 32 predefined styles (GT001–GT032) grouped by silhouette (classic, sport-side, triple, wave, hourglass, pinstripe, raglan). `applyGtStyle()` dispatches by group. **Migrated groups use live zone-based rendering** — a `*Layout(colors)` function returns `RectSpec[]` derived from `ZONE_PRESETS` (in `patterns.ts`), and the shared `applyZoneLayout()` builds Fabric `Rect`s for body + trim, tags them `data: { tag:"__kashaGtBg__", styleId, layer }`, makes them draggable on the CANVAS tab, and stack-orders them so body sits at the back, trim above body, both below prints/text/logos. Recolour is instant (rebuild rects with new colours, no pixel walk). `clearGtStyle()` removes everything tagged `__kashaGtBg__`. Currently migrated: **Classic** (GT001–GT005, `classicLayout`: collar band + front/back hem + cuffs + centre placket; tunables `HEM_H, CUFF_H, PLACKET_W, PLACKET_H`) and **Sport-Side** (GT006–GT009, `sportSideLayout`: vertical side panels + shoulder caps on front/back + sleeve under-arm strips; tunables `SP_SIDE_W, SP_SHOULDER_H, SP_SLEEVE_H`). **Other groups** still use the legacy texture path: each style is a pre-baked 1024×1024 PNG in `GT_BASE_TEXTURES` (base64) and `recolorTexture()` pixel-walks an offscreen canvas to swap default colour values before pasting it as a single full-canvas Fabric image. They will be migrated to zone-based recipes once the client confirms the layout per group.

### Admin Panel (`/admin`)
A protected single-page application with five tabs:
- **Dashboard**: Displays KPIs, order status breakdown, and recent orders.
- **Products**: Provides full CRUD operations for products, including model and thumbnail uploads.
- **Orders**: Allows listing, filtering, and updating order statuses.
- **Users**: Manages Clerk users, including granting/revoking admin roles and deletion.
- **Designs**: Browses customer customizations with rich previews and deletion capabilities.

## External Dependencies

- **Clerk**: User authentication and authorization.
- **Google `model-viewer`**: 3D model rendering.
- **Fabric.js**: 2D canvas manipulation for design customization.
- **PostgreSQL**: Primary database.
- **Razorpay**: Payment gateway for Indian Rupee transactions.
- **Orval**: API client and schema generation tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **Vite**: Frontend build tool.
- **Express**: Backend web framework.
- **Drizzle ORM**: TypeScript ORM for database interaction.
- **TanStack Query (React Query)**: Data fetching and caching.