import { useState } from "react";
import { Link } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { ShoppingBag, X, Menu, User as UserIcon } from "lucide-react";
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
          <div className="h-[68px] flex items-center justify-between gap-4">
            {/* Left: Mobile menu + Logo */}
            <div className="flex items-center gap-4">
              <button
                className="md:hidden flex items-center justify-center w-9 h-9"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5 text-black" />
              </button>

              <Link href="/" className="flex items-center gap-2 shrink-0">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2z" fill="#111"/>
                  <path d="M22 10c-1.5 0-2.8.8-3.5 2-1-.6-2.2-1-3.5-1-3.3 0-6 2.7-6 6s2.7 6 6 6c1.5 0 2.9-.5 3.9-1.4.8.9 2 1.4 3.1 1.4 2.2 0 4-1.8 4-4 0-1.5-.8-2.8-2-3.5.6-.7 1-1.6 1-2.5 0-1.7-1.3-3-3-3z" fill="white"/>
                </svg>
                <span className="text-[22px] font-black tracking-[0.15em] text-black">KA.SHA</span>
              </Link>
            </div>

            {/* Center: Main nav links */}
            <nav className="hidden md:flex items-center gap-8">
              {mainLinks.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[11px] font-bold tracking-[0.12em] text-gray-700 hover:text-black transition-colors whitespace-nowrap"
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
                    className={`text-[11px] font-bold tracking-[0.1em] px-3 py-1 transition-colors ${
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

              <Link href="/products/1/customize">
                <button className="hidden md:flex items-center bg-black text-white text-[10px] font-bold tracking-[0.12em] px-4 py-2 hover:bg-gray-900 transition-colors whitespace-nowrap">
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
                  <button className="hidden sm:flex text-[11px] font-bold tracking-[0.1em] text-gray-700 hover:text-black transition-colors">
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
            <span className="text-[20px] font-black tracking-[0.15em] text-black">KA.SHA</span>
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
