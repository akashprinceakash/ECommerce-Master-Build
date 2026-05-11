import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CartProvider } from "@/contexts/CartContext";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <CartProvider>
      <div
        className="min-h-[100dvh] flex flex-col text-neutral-900 selection:bg-[#B8925A] selection:text-neutral-900"
        style={{ background: "#FFFFFF", fontFamily: "'Josefin Sans', sans-serif" }}
      >
        <Navbar />
        <main className="flex-1 w-full pt-16">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  );
}
