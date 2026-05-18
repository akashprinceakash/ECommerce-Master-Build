import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { ShoppingBag, X, Menu, User as UserIcon, ShieldCheck, Search } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { useCart } from "@/contexts/CartContext";

const GOLD = "#B8925A";
const GOLD_LIGHT = "#D4A96A";

export function Navbar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { openCart, isCartOpen, closeCart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      try {
        const clerk = (window as any).Clerk;
        const token = clerk?.session ? await clerk.session.getToken() : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${getApiUrl()}/api/admin/check`, { headers });
        setIsAdmin(res.ok);
      } catch { setIsAdmin(false); }
    })();
  }, [user]);

  const { data: cart } = useGetCart({
    query: { enabled: !!user, queryKey: getGetCartQueryKey() },
  });
  const cartItemCount = cart?.itemCount || 0;

  const links = [
    { label: "Home", href: "/" },
    { label: "Men's", href: "/products?gender=men" },
    { label: "Women's", href: "/products?gender=women" },
    { label: "Kids'", href: "/products?gender=kids" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    if (href.startsWith("/products")) {
      const target = new URLSearchParams(href.split("?")[1] || "").get("gender");
      const current = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("gender")
        : null;
      return location.startsWith("/products") && target === current;
    }
    return location.startsWith(href);
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 md:px-10 transition-colors duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.92)",
          borderBottom: "1px solid rgba(184,146,90,0.3)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0" aria-label="Ka·Sha home">
          <img
            src="/images/kasha-logo-new.jpeg"
            alt="Ka·Sha"
            className="h-12 w-auto object-contain"
            style={{ mixBlendMode: "multiply" }}
          />
        </Link>

        {/* Center nav */}
        <nav className="hidden lg:flex items-center gap-9">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.label}
                href={l.href}
                className="relative text-[10px] uppercase transition-colors hover:text-neutral-900"
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  letterSpacing: "0.28em",
                  color: active ? GOLD : "rgba(0,0,0,0.6)",
                }}
              >
                {l.label}
                <span
                  className="absolute -bottom-1 left-0 h-px transition-all duration-300"
                  style={{ width: active ? "100%" : 0, background: GOLD }}
                />
              </Link>
            );
          })}
          <Link
            href="/products/1/customize"
            className="text-[10px] uppercase text-white px-5 py-2 transition-colors"
            style={{
              fontFamily: "'Josefin Sans', sans-serif",
              letterSpacing: "0.2em",
              background: GOLD,
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.background = GOLD_LIGHT)}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.background = GOLD)}
          >
            Custom Studio
          </Link>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              href="/admin"
              className="hidden md:flex items-center gap-1.5 text-[9px] uppercase px-3 py-1.5 border"
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                letterSpacing: "0.25em",
                color: GOLD,
                borderColor: "rgba(184,146,90,0.3)",
              }}
            >
              <ShieldCheck className="w-3 h-3" /> Admin
            </Link>
          )}
          <Show when="signed-in">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-8 h-8 flex items-center justify-center hover:text-neutral-900 transition-colors"
                  style={{ color: "rgba(0,0,0,0.6)" }}
                >
                  <UserIcon className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-none border-0"
                style={{ background: "#FFFFFF", border: "1px solid rgba(184,146,90,0.3)", color: "#0A0A0A" }}
              >
                <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <p className="text-sm font-medium text-neutral-900">{user?.fullName || "Account"}</p>
                  <p className="text-xs truncate" style={{ color: "rgba(0,0,0,0.5)" }}>
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
                <DropdownMenuItem asChild className="focus:bg-black/5 focus:text-neutral-900">
                  <Link href="/profile" className="w-full cursor-pointer text-sm">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-black/5 focus:text-neutral-900">
                  <Link href="/orders" className="w-full cursor-pointer text-sm">Orders</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-black/10" />
                    <DropdownMenuItem asChild className="focus:bg-black/5">
                      <Link href="/admin" className="w-full cursor-pointer text-sm flex items-center gap-2" style={{ color: GOLD }}>
                        <ShieldCheck className="w-3.5 h-3.5" /> Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-black/10" />
                <DropdownMenuItem
                  className="cursor-pointer text-sm text-red-600 focus:text-red-700 focus:bg-black/5"
                  onClick={() => signOut()}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Show>
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="hidden sm:block text-[10px] uppercase hover:text-neutral-900 transition-colors"
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                letterSpacing: "0.28em",
                color: "rgba(0,0,0,0.6)",
              }}
            >
              Sign In
            </Link>
          </Show>
          <Link
            href="/search"
            className="w-8 h-8 hidden sm:flex items-center justify-center hover:text-neutral-900 transition-colors"
            style={{ color: "rgba(0,0,0,0.6)" }}
            title="Search"
          >
            <Search className="w-4 h-4" />
          </Link>
          <button
            className="w-8 h-8 flex items-center justify-center relative hover:text-neutral-900 transition-colors"
            style={{ color: "rgba(0,0,0,0.6)" }}
            onClick={openCart}
          >
            <ShoppingBag className="w-4 h-4" />
            {cartItemCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: GOLD }}
              >
                {cartItemCount}
              </span>
            )}
          </button>
          <button
            className="lg:hidden w-8 h-8 flex items-center justify-center"
            style={{ color: "rgba(0,0,0,0.6)" }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "#FAFAF7" }}>
          <div
            className="flex items-center justify-between px-6 h-16"
            style={{ borderBottom: "1px solid rgba(184,146,90,0.3)" }}
          >
            <span
              className="text-[20px] font-medium text-neutral-900"
              style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.15em" }}
            >
              Ka·Sha
            </span>
            <button onClick={() => setMobileOpen(false)} className="text-black/60">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex flex-col p-6 gap-5">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="text-[14px] uppercase text-neutral-900/80"
                style={{ fontFamily: "'Josefin Sans', sans-serif", letterSpacing: "0.28em" }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/products/1/customize"
              onClick={() => setMobileOpen(false)}
              className="mt-3 text-[12px] uppercase text-white text-center py-3"
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                letterSpacing: "0.2em",
                background: GOLD,
              }}
            >
              Custom Studio
            </Link>
            <Show when="signed-out">
              <Link
                href="/sign-in"
                onClick={() => setMobileOpen(false)}
                className="text-[12px] uppercase text-center py-3 border"
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  letterSpacing: "0.2em",
                  color: "rgba(0,0,0,0.7)",
                  borderColor: "rgba(0,0,0,0.12)",
                }}
              >
                Sign In
              </Link>
            </Show>
          </nav>
        </div>
      )}

      <CartDrawer open={isCartOpen} onClose={closeCart} cart={cart} />
    </>
  );
}
