import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CartProvider } from "@/contexts/CartContext";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <CartProvider>
      <div className="min-h-[100dvh] flex flex-col bg-white text-black font-sans selection:bg-black selection:text-white">
        <Navbar />
        <main className="flex-1 w-full">
          {children}
        </main>
        <Footer />
      </div>
    </CartProvider>
  );
}
