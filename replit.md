# KA.SHA — Golf & Sportswear Fashion eCommerce

## Overview
KA.SHA is a full-stack luxury golf and sportswear fashion eCommerce web application. It features product browsing, a unique Bespoke Customization Studio with 3D model and 2D image upload capabilities, secure authentication, a slide-out cart, Indian Rupee (₹) checkout, saved designs, order history, and user profiles. The project aims to provide a high-end online shopping experience for customized athletic apparel.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes.

## System Architecture
The application is structured as a pnpm monorepo.

**Frontend:**
- Built with React and Vite.
- Utilizes Tailwind CSS and shadcn/ui for styling.
- Features custom fonts: Cormorant Garamond for headings and DM Sans for body text.
- Implements a slide-out cart drawer managed by `CartContext` and `CartDrawer` component.
- The Bespoke Customization Studio uses Google `model-viewer` for 3D rendering with WebGL detection and a fallback to product thumbnails. Fabric.js is used for 2D canvas design.
- The design system emphasizes a clean, minimal golf sportswear aesthetic with a white background, near-black primary elements, and red accents. Prices are stored in paise and displayed in Indian Rupee format.
- Key UI components include a redesigned `Navbar` with category navigation, `CartDrawer`, and `ModelViewerCustomizer` for the Bespoke Studio.
- The Customization Studio allows customers to apply patterns to the whole T-shirt or specific zones (Front, Back, Sleeves, Collar) and to customize using GT Design Styles (GT001–GT032). GT Styles utilize a hybrid rendering engine: Classic styles use live zone-based rendering with Fabric `Rect` objects, while other groups use pre-baked PNG textures with pixel-walking recoloring.
- The studio provides tabs for COLORS, DESIGN (garment options, pattern overlays), TEXT, LOGO, SHAPES, and CANVAS for detailed customization.
- Design state is persisted per user per product, including `canvasJSON`, material colors, garment state, and preset names. A PNG snapshot is generated for previews.
- The texture pipeline involves rendering Fabric.js canvas content to a 1024x1024 PNG, which is then applied to the `model-viewer`'s baseColorTexture.

**Backend:**
- An Express 5 API server handles backend logic.
- Uses Zod for validation and Drizzle ORM for database interactions.
- PostgreSQL is the chosen database.
- API specifications are defined using OpenAPI, with Orval used for codegen to generate React Query hooks and Zod schemas.
- Features an `/admin` panel with protected routes, requiring Clerk `publicMetadata.role === "admin"` or matching `ADMIN_EMAILS`. The admin panel includes dashboards, product CRUD, order management, user management, and design browsing/deletion.
- File uploads (3D models, thumbnails) are stored on the server.

**Authentication:**
- Clerk is used for all user authentication.
- Unauthenticated users can browse products, while cart, checkout, orders, and profile pages require authentication.

**Pages/Routes:**
- `/`, `/products`, `/products/:id`, `/products/:id/customize`, `/heritage`, `/sign-in`, `/sign-up`, `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/profile`.

**Database:**
- Schema includes `user_profiles`, `products`, `customizations`, `carts`, `cart_items`, `orders`, `order_items`.

## External Dependencies
- **Authentication:** Clerk
- **3D Viewer:** Google `model-viewer` web component
- **2D Design Canvas:** Fabric.js v7
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **API Specification:** OpenAPI
- **API Codegen:** Orval
- **State Management:** TanStack Query (React Query)
- **Payments:** Razorpay (requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)
- **Styling:** Tailwind CSS, shadcn/ui