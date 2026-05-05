import { Link } from "wouter";
import logoImg from "@assets/WhatsApp_Image_2026-05-05_at_10.21.42_1777970390797.jpeg";

export function Footer() {
  return (
    <>
      {/* BRAND STRIP — cream */}
      <section className="bg-[#f7f3ee] border-y border-[#ece8e2] py-14 relative overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-10 text-center relative z-10">
          <p style={{ fontFamily: "Georgia, serif" }} className="text-[24px] text-[#1c1c1c] leading-tight">
            Premium meets edgy.
          </p>
          <p style={{ fontFamily: "Georgia, serif" }} className="text-[24px] text-[#9b8b6e] italic leading-tight mt-1">
            Performance matches flair.
          </p>
          <p className="text-[10px] tracking-[0.3em] text-[#6b6560] uppercase mt-4">
            KA.SHA &nbsp;—&nbsp; For Players
          </p>
        </div>
      </section>

      {/* FOOTER — charcoal */}
      <footer className="bg-[#1c1c1c] text-white">
        <div className="max-w-[1280px] mx-auto px-10 pt-14 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-10 mb-10">

            {/* BRAND */}
            <div>
              <div className="inline-block bg-[#FEC200] p-1.5 mb-4">
                <img src={logoImg} alt="KA.SHA" className="h-[36px] w-auto block" />
              </div>
              <p className="text-[12px] text-[#807870] leading-relaxed max-w-[240px]">
                Premium meets edgy. Performance matches flair. For players who play hard.
              </p>
            </div>

            {/* SHOP */}
            <div>
              <h3 className="text-[9px] tracking-[0.25em] text-[#9b8b6e] mb-5 uppercase">Shop</h3>
              <ul className="space-y-3">
                {[
                  { label: "Golf T-shirts", href: "/products?category=clothing" },
                  { label: "Trousers", href: "/products?category=trousers" },
                  { label: "Caps", href: "/products?category=accessories" },
                  { label: "New arrivals", href: "/products" },
                ].map(item => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-[11px] text-[#807870] hover:text-[#c8c0b8] transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* CUSTOMISE */}
            <div>
              <h3 className="text-[9px] tracking-[0.25em] text-[#9b8b6e] mb-5 uppercase">Customise</h3>
              <ul className="space-y-3">
                {[
                  { label: "Tailor your play", href: "/products/1/customize" },
                  { label: "Corporate orders", href: "/heritage" },
                  { label: "Tournament kits", href: "/heritage" },
                  { label: "Women's golf", href: "/products?gender=women" },
                ].map(item => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-[11px] text-[#807870] hover:text-[#c8c0b8] transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* KA.SHA */}
            <div>
              <h3 className="text-[9px] tracking-[0.25em] text-[#9b8b6e] mb-5 uppercase">KA.SHA</h3>
              <ul className="space-y-3">
                {[
                  { label: "About", href: "/heritage" },
                  { label: "Brand story", href: "/heritage" },
                  { label: "Size guide", href: "/heritage" },
                  { label: "Contact", href: "/heritage" },
                ].map(item => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-[11px] text-[#807870] hover:text-[#c8c0b8] transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* BOTTOM BAR */}
          <div className="border-t border-[#2a2a28] pt-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[10px] text-[#807870]">
              &copy; {new Date().getFullYear()} Ka.Sha. All rights reserved.
            </p>
            <p className="text-[10px] text-[#807870] tracking-[0.15em] uppercase">
              Precision · Flair · Golf
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
