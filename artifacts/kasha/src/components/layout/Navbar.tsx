import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { ShoppingBag, X, Menu, User as UserIcon, ShieldCheck } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { useCart } from "@/contexts/CartContext";

export function Navbar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { openCart, isCartOpen, closeCart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    const checkAdmin = async () => {
      try {
        const clerk = (window as any).Clerk;
        const token = clerk?.session ? await clerk.session.getToken() : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${getApiUrl()}/api/admin/check`, { headers });
        setIsAdmin(res.ok);
      } catch { setIsAdmin(false); }
    };
    checkAdmin();
  }, [user]);

  const { data: cart } = useGetCart({
    query: {
      enabled: !!user,
      queryKey: getGetCartQueryKey()
    }
  });

  const cartItemCount = cart?.itemCount || 0;

  const mainLinks = [
    { label: "SHOP", href: "/products" },
    { label: "TAILOR YOUR PLAY", href: "/products?category=bespoke" },
    { label: "PRINTS", href: "/products?category=prints" },
    { label: "ABOUT", href: "/heritage" },
  ];

  const categoryLinks = [
    { label: "MEN", href: "/products?gender=men" },
    { label: "WOMEN", href: "/products?gender=women" },
    { label: "KIDS", href: "/products?gender=kids" },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto px-6 max-w-[1400px]">
          {/* Main nav row */}
          <div className="h-[84px] flex items-center justify-between gap-4">
            {/* Left: Mobile menu + Logo */}
            <div className="flex items-center gap-4">
              <button
                className="md:hidden flex items-center justify-center w-9 h-9"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5 text-black" />
              </button>

              <Link href="/" className="flex items-center gap-2 shrink-0">
                <img
                  src="/images/kasha-logo.png"
                  alt="KA.SHA"
                  className="h-14 w-auto object-contain"
                />
              </Link>
            </div>

            {/* Center: Main nav links */}
            <nav className="hidden md:flex items-center gap-8">
              {mainLinks.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[13px] font-bold tracking-[0.14em] text-gray-700 hover:text-black transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right: Categories + Customise + Account + Cart */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-1">
                {categoryLinks.map(link => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`text-[13px] font-bold tracking-[0.12em] px-3.5 py-1.5 transition-colors ${
                      activeCategory === link.label
                        ? "text-black border-b-2 border-black"
                        : "text-gray-600 hover:text-black"
                    }`}
                    onClick={() => setActiveCategory(link.label)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {isAdmin && (
                <Link href="/admin">
                  <button className="hidden md:flex items-center gap-1.5 bg-emerald-600 text-white text-[12px] font-bold tracking-[0.14em] px-5 py-3 hover:bg-emerald-700 transition-colors whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3" /> ADMIN
                  </button>
                </Link>
              )}
              <Link href="/products/1/customize">
                <button className="hidden md:flex items-center bg-black text-white text-[12px] font-bold tracking-[0.14em] px-6 py-3 hover:bg-gray-900 transition-colors whitespace-nowrap">
                  CUSTOMISE
                </button>
              </Link>

              <Show when="signed-in">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors">
                      <UserIcon className="h-4.5 w-4.5 text-gray-700" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-none shadow-lg border-gray-200">
                    <div className="px-3 py-2 border-b">
                      <p className="text-sm font-medium">{user?.fullName || "Account"}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="w-full cursor-pointer text-sm">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/orders" className="w-full cursor-pointer text-sm">Orders</Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="w-full cursor-pointer text-sm font-semibold text-emerald-700 flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5" /> Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-sm text-red-600 focus:text-red-600"
                      onClick={() => signOut()}
                    >
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Show>

              <Show when="signed-out">
                <Link href="/sign-in">
                  <button className="hidden sm:flex text-[13px] font-bold tracking-[0.12em] text-gray-700 hover:text-black transition-colors">
                    SIGN IN
                  </button>
                </Link>
              </Show>

              <button
                className="flex items-center justify-center w-9 h-9 relative hover:bg-gray-100 rounded-full transition-colors"
                onClick={openCart}
              >
                <ShoppingBag className="h-5 w-5 text-black" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
                    {cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 h-16 border-b">
            <img src="/images/kasha-logo.png" alt="KA.SHA" className="h-9 w-auto object-contain" />
            <button onClick={() => setMobileOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col p-6 gap-6">
            {mainLinks.map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[15px] font-bold tracking-[0.1em] text-black"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t pt-4 flex gap-4">
              {categoryLinks.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm font-semibold text-gray-700"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Link href="/products/1/customize" onClick={() => setMobileOpen(false)}>
              <button className="w-full bg-black text-white text-[12px] font-bold tracking-[0.12em] py-3">
                CUSTOMISE
              </button>
            </Link>
            <Show when="signed-out">
              <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
                <button className="w-full border border-black text-black text-[12px] font-bold tracking-[0.12em] py-3">
                  SIGN IN
                </button>
              </Link>
            </Show>
          </nav>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer open={isCartOpen} onClose={closeCart} cart={cart} />
    </>
  );
}
