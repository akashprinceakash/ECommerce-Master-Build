import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="max-w-[1400px] mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-14">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-5">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2z" fill="white"/>
                <path d="M22 10c-1.5 0-2.8.8-3.5 2-1-.6-2.2-1-3.5-1-3.3 0-6 2.7-6 6s2.7 6 6 6c1.5 0 2.9-.5 3.9-1.4.8.9 2 1.4 3.1 1.4 2.2 0 4-1.8 4-4 0-1.5-.8-2.8-2-3.5.6-.7 1-1.6 1-2.5 0-1.7-1.3-3-3-3z" fill="black"/>
              </svg>
              <span className="text-[20px] font-black tracking-[0.15em] text-white">KA.SHA</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[220px]">
              Elevated golf performance wear. Crafted for the modern game.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.2em] text-white mb-6">SHOP</h3>
            <ul className="space-y-3">
              {[
                { label: "All Products", href: "/products" },
                { label: "Collections", href: "/products" },
                { label: "Polos & T-Shirts", href: "/products?category=clothing" },
                { label: "Trousers", href: "/products?category=trousers" },
                { label: "Outerwear", href: "/products?category=jackets" },
                { label: "Accessories", href: "/products?category=accessories" },
              ].map(item => (
                <li key={item.label}>
                  <Link href={item.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.2em] text-white mb-6">SUPPORT</h3>
            <ul className="space-y-3">
              {[
                { label: "FAQ", href: "/faq" },
                { label: "Shipping & Returns", href: "/shipping" },
                { label: "Contact Us", href: "/contact" },
                { label: "Our Story", href: "/heritage" },
                { label: "Sustainability", href: "/sustainability" },
              ].map(item => (
                <li key={item.label}>
                  <Link href={item.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.2em] text-white mb-6">NEWSLETTER</h3>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              New drops, exclusive offers, and style tips — straight to your inbox.
            </p>
            <form className="flex flex-col gap-2" onSubmit={e => e.preventDefault()}>
              <input
                type="email"
                placeholder="Email address"
                className="bg-white/10 border border-white/20 text-white placeholder:text-gray-500 text-sm px-3 py-2.5 focus:outline-none focus:border-white/50 w-full"
              />
              <button
                type="submit"
                className="bg-white text-black text-[11px] font-bold tracking-[0.2em] py-2.5 hover:bg-gray-100 transition-colors"
              >
                JOIN
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} KA.SHA. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-gray-500">
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/returns" className="hover:text-white transition-colors">Return Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
