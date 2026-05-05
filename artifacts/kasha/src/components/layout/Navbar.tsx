import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { ShoppingBag, X, Menu, User as UserIcon, ShieldCheck } from "lucide-react";
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
import logoImg from "@assets/WhatsApp_Image_2026-05-05_at_10.21.42_1777970390797.jpeg";

export function Navbar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { openCart, isCartOpen, closeCart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
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
    query: { enabled: !!user, queryKey: getGetCartQueryKey() }
  });
  const cartItemCount = cart?.itemCount || 0;

  const mainLinks = [
    { label: "SHOP", href: "/products" },
    { label: "TAILOR YOUR PLAY", href: "/products/1/customize" },
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
      {/* ANNOUNCEMENT BAR */}
      <div className="bg-[#f7f3ee] border-b border-[#ece8e2]">
        <div className="max-w-[1280px] mx-auto px-10 py-2 text-center text-[10px] tracking-[0.25em] text-[#9b8b6e] uppercase">
          New Season Arrivals — Shop the Full Collection &nbsp;·&nbsp; Free Shipping on Orders Above ₹5,000
        </div>
      </div>

      {/* MAIN NAV — 64px sticky */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-[#ece8e2]">
        <div className="max-w-[1280px] mx-auto px-10 h-[64px] flex items-center justify-between gap-4 relative">

          {/* LOGO */}
          <Link href="/" className="flex items-center shrink-0">
            <img src={logoImg} alt="KA.SHA" className="h-[40px] w-auto object-contain" />
          </Link>

          {/* CENTER NAV */}
          <nav className="hidden lg:flex items-center gap-8 flex-1 justify-center">
            {mainLinks.map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[10px] tracking-[0.2em] text-[#6b6560] hover:text-[#1c1c1c] transition-colors uppercase whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* RIGHT: categories + customise + account + cart */}
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-5">
              {categoryLinks.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[10px] tracking-[0.2em] text-[#6b6560] hover:text-[#1c1c1c] transition-colors uppercase"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {isAdmin && (
              <Link href="/admin" className="hidden md:flex items-center gap-1.5 bg-emerald-600 text-white text-[9px] tracking-[0.2em] px-3 py-2 hover:bg-emerald-700 transition-colors">
                <ShieldCheck className="w-3 h-3" /> ADMIN
              </Link>
            )}

            <Link href="/products/1/customize" className="hidden md:flex items-center bg-[#1c1c1c] text-white text-[9px] tracking-[0.25em] px-5 py-2.5 hover:bg-black transition-colors uppercase">
              Customise
            </Link>

            <Show when="signed-in">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center w-8 h-8 hover:bg-gray-50 transition-colors">
                    <UserIcon className="h-4 w-4 text-[#6b6560]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-none shadow-lg border-[#ece8e2]">
                  <div className="px-3 py-2 border-b border-[#ece8e2]">
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
              <Link href="/sign-in" className="hidden sm:flex text-[10px] tracking-[0.2em] text-[#6b6560] hover:text-[#1c1c1c] transition-colors uppercase">
                Sign in
              </Link>
            </Show>

            <button
              className="flex items-center justify-center w-8 h-8 relative hover:bg-gray-50 transition-colors"
              onClick={openCart}
            >
              <ShoppingBag className="h-4.5 w-4.5 text-[#1c1c1c]" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#c0302a] text-[9px] font-bold text-white">
                  {cartItemCount}
                </span>
              )}
            </button>

            <button
              className="md:hidden flex items-center justify-center w-9 h-9"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5 text-[#1c1c1c]" />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 h-16 border-b border-[#ece8e2]">
            <img src={logoImg} alt="KA.SHA" className="h-[36px] w-auto" />
            <button onClick={() => setMobileOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col p-6 gap-6">
            {mainLinks.map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] tracking-[0.15em] text-[#1c1c1c] uppercase"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-[#ece8e2] pt-4 flex gap-5">
              {categoryLinks.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[12px] tracking-[0.15em] text-[#6b6560] uppercase"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Link href="/products/1/customize" onClick={() => setMobileOpen(false)}>
              <button className="w-full bg-[#1c1c1c] text-white text-[11px] tracking-[0.25em] py-3 uppercase">
                Customise
              </button>
            </Link>
            <Show when="signed-out">
              <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
                <button className="w-full border border-[#1c1c1c] text-[#1c1c1c] text-[11px] tracking-[0.25em] py-3 uppercase">
                  Sign in
                </button>
              </Link>
            </Show>
          </nav>
        </div>
      )}

      <CartDrawer open={isCartOpen} onClose={closeCart} cart={cart} />
    </>
  );
}
