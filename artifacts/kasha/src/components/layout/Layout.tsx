import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { getApiUrl } from "@/lib/api";
import { getGetCartQueryKey } from "@workspace/api-client-react";

interface LayoutProps {
  children: React.ReactNode;
}

const SYNC_FLAG_KEY = "kasha_guest_cart_synced";

function GuestCartSyncer() {
  const { isSignedIn, getToken } = useAuth();
  const { guestCart, clearGuestCart } = useCart();
  const queryClient = useQueryClient();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      sessionStorage.removeItem(SYNC_FLAG_KEY);
      return;
    }
    if (isSyncingRef.current) return;
    if (sessionStorage.getItem(SYNC_FLAG_KEY)) return;

    const itemsToSync = [...guestCart];
    if (itemsToSync.length === 0) {
      sessionStorage.setItem(SYNC_FLAG_KEY, "1");
      return;
    }

    isSyncingRef.current = true;
    sessionStorage.setItem(SYNC_FLAG_KEY, "1");

    const doSync = async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const apiBase = getApiUrl();
        await Promise.all(
          itemsToSync.map(item =>
            fetch(`${apiBase}/api/cart/items`, {
              method: "POST",
              headers,
              body: JSON.stringify({ productId: item.productId, quantity: item.quantity, size: item.size }),
            }).catch(() => null)
          )
        );
        clearGuestCart();
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      } catch {
        sessionStorage.removeItem(SYNC_FLAG_KEY);
      } finally {
        isSyncingRef.current = false;
      }
    };

    doSync();
  }, [isSignedIn]);

  return null;
}

function LayoutInner({ children }: LayoutProps) {
  return (
    <>
      <GuestCartSyncer />
      <div
        className="min-h-[100dvh] flex flex-col text-neutral-900 selection:bg-[#B8925A] selection:text-neutral-900"
        style={{ background: "#FAFAF7", fontFamily: "'Josefin Sans', sans-serif" }}
      >
        <Navbar />
        <main className="flex-1 w-full pt-16">{children}</main>
        <Footer />
      </div>
    </>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <CartProvider>
      <LayoutInner>{children}</LayoutInner>
    </CartProvider>
  );
}
