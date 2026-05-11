import { Link } from "wouter";

const GOLD = "#B8925A";
const MUTED = "rgba(255,255,255,0.45)";

const COL_TITLE: React.CSSProperties = {
  fontFamily: "'Josefin Sans', sans-serif",
  fontSize: 8,
  letterSpacing: "0.35em",
  color: GOLD,
  textTransform: "uppercase",
  marginBottom: 20,
};

const LINK_STYLE: React.CSSProperties = {
  fontFamily: "'Josefin Sans', sans-serif",
  fontSize: 10,
  letterSpacing: "0.1em",
  color: MUTED,
  textDecoration: "none",
};

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={LINK_STYLE} className="hover:!text-[#B8925A] transition-colors">
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer
      style={{
        background: "#0D1220",
        borderTop: "1px solid rgba(184,146,90,0.3)",
        padding: "60px 24px 40px",
      }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-14 mb-12">
          {/* Brand */}
          <div>
            <div
              className="text-white"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                letterSpacing: "0.15em",
                marginBottom: 6,
              }}
            >
              Ka·Sha
            </div>
            <div
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 7,
                letterSpacing: "0.45em",
                color: GOLD,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Premium Golf Apparel
            </div>
            <p
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.06em",
                color: MUTED,
                lineHeight: 1.8,
                maxWidth: 280,
              }}
            >
              Crafted for the discerning golfer. Where technical performance meets luxury design — on the fairway and beyond.
            </p>
          </div>

          {/* Collections */}
          <div>
            <div style={COL_TITLE}>Collections</div>
            <ul className="flex flex-col gap-2.5">
              <li><FooterLink href="/products?gender=men">Men's</FooterLink></li>
              <li><FooterLink href="/products?gender=women">Women's</FooterLink></li>
              <li><FooterLink href="/products?gender=kids">Kids'</FooterLink></li>
              <li><FooterLink href="/products?type=tshirts&style=patterns">Ka·Sha Signature</FooterLink></li>
              <li><FooterLink href="/products?type=tshirts&style=prints">Flair</FooterLink></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <div style={COL_TITLE}>Services</div>
            <ul className="flex flex-col gap-2.5">
              <li><FooterLink href="/products/1/customize">Custom Studio</FooterLink></li>
              <li><FooterLink href="/products/1/customize">Bulk Orders</FooterLink></li>
              <li><FooterLink href="/products/1/customize">Corporate</FooterLink></li>
              <li><FooterLink href="/products/1/customize">Tournaments</FooterLink></li>
              <li><FooterLink href="/products/1/customize">Golf Academies</FooterLink></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <div style={COL_TITLE}>Company</div>
            <ul className="flex flex-col gap-2.5">
              <li><FooterLink href="/heritage">About Ka·Sha</FooterLink></li>
              <li><FooterLink href="/products">Lookbook</FooterLink></li>
              <li><FooterLink href="/contact">Contact</FooterLink></li>
              <li><FooterLink href="/shipping">Size Guide</FooterLink></li>
              <li><FooterLink href="/shipping">Returns</FooterLink></li>
            </ul>
          </div>
        </div>

        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span
            style={{
              fontFamily: "'Josefin Sans', sans-serif",
              fontSize: 9,
              letterSpacing: "0.15em",
              color: MUTED,
            }}
          >
            © 2026 Ka·Sha. All rights reserved.
          </span>
          <div className="flex gap-4">
            {["Instagram", "Pinterest", "LinkedIn"].map((s) => (
              <a
                key={s}
                href="#"
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: 8,
                  letterSpacing: "0.2em",
                  color: MUTED,
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
                className="hover:!text-[#B8925A] transition-colors"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
