import { createContext, useContext, useState, type ReactNode } from "react";

export interface GuestCartItem {
  productId: number;
  productName: string;
  thumbnailUrl?: string;
  priceInPaise: number;
  quantity: number;
  size: string;
}

interface CartContextType {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  guestCart: GuestCartItem[];
  addToGuestCart: (item: GuestCartItem) => void;
  removeFromGuestCart: (productId: number, size: string) => void;
  updateGuestCartQty: (productId: number, size: string, quantity: number) => void;
  clearGuestCart: () => void;
  guestCartCount: number;
  guestCartTotal: number;
}

const GUEST_CART_KEY = "kasha_guest_cart";

function loadGuestCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? (JSON.parse(raw) as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

const CartContext = createContext<CartContextType>({
  isCartOpen: false,
  openCart: () => {},
  closeCart: () => {},
  toggleCart: () => {},
  guestCart: [],
  addToGuestCart: () => {},
  removeFromGuestCart: () => {},
  updateGuestCartQty: () => {},
  clearGuestCart: () => {},
  guestCartCount: 0,
  guestCartTotal: 0,
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [guestCart, setGuestCartRaw] = useState<GuestCartItem[]>(loadGuestCart);

  function persist(next: GuestCartItem[]) {
    try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next)); } catch {}
  }

  function addToGuestCart(item: GuestCartItem) {
    setGuestCartRaw(prev => {
      const existing = prev.find(i => i.productId === item.productId && i.size === item.size);
      const next = existing
        ? prev.map(i =>
            i.productId === item.productId && i.size === item.size
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          )
        : [...prev, item];
      persist(next);
      return next;
    });
  }

  function removeFromGuestCart(productId: number, size: string) {
    setGuestCartRaw(prev => {
      const next = prev.filter(i => !(i.productId === productId && i.size === size));
      persist(next);
      return next;
    });
  }

  function updateGuestCartQty(productId: number, size: string, quantity: number) {
    if (quantity < 1) return;
    setGuestCartRaw(prev => {
      const next = prev.map(i =>
        i.productId === productId && i.size === size ? { ...i, quantity } : i
      );
      persist(next);
      return next;
    });
  }

  function clearGuestCart() {
    setGuestCartRaw([]);
    try { localStorage.removeItem(GUEST_CART_KEY); } catch {}
  }

  const guestCartCount = guestCart.reduce((s, i) => s + i.quantity, 0);
  const guestCartTotal = guestCart.reduce((s, i) => s + i.priceInPaise * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        toggleCart: () => setIsCartOpen(p => !p),
        guestCart,
        addToGuestCart,
        removeFromGuestCart,
        updateGuestCartQty,
        clearGuestCart,
        guestCartCount,
        guestCartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
