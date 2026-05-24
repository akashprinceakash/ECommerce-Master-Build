import { useEffect, useRef } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCartQueryKey } from "@workspace/api-client-react";
import { getApiUrl } from "@/lib/api";

function GuestCartMerger() {
  const { user, isLoaded } = useUser();
  const { guestCart, clearGuestCart } = useCart();
  const queryClient = useQueryClient();
  const hasMergedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user?.id || hasMergedRef.current || guestCart.length === 0) return;

    hasMergedRef.current = true;
    const items = [...guestCart];
    const apiBase = getApiUrl();

    const doMerge = async () => {
      let token: string | null = null;
      try {
        token = await (window as unknown as { Clerk?: { session?: { getToken?: () => Promise<string> } } })
          .Clerk?.session?.getToken?.() ?? null;
      } catch {
        token = null;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await Promise.all(
        items.map(item =>
          fetch(`${apiBase}/api/cart/items`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              productId: item.productId,
              quantity: item.quantity,
              size: item.size,
            }),
          }).catch(() => null)
        )
      );

      clearGuestCart();
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
    };

    doMerge();
  }, [isLoaded, user?.id]);

  return null;
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <CartProvider>
      <GuestCartMerger />
      <div
        className="min-h-[100dvh] flex flex-col text-neutral-900 selection:bg-[#B8925A] selection:text-neutral-900"
        style={{ background: "#FAFAF7", fontFamily: "'Josefin Sans', sans-serif" }}
      >
        <Navbar />
        <main className="flex-1 w-full pt-16">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  );
}
