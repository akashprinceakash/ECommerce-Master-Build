import { Link } from "wouter";

const GOLD = "#B8925A";
const MUTED = "rgba(0,0,0,0.5)";
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};
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

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={LINK_STYLE}
      className="hover:!text-[#B8925A] transition-colors"
    >
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer
      style={{
        background: "#F5F2EC",
        borderTop: "1px solid rgba(184,146,90,0.3)",
        padding: "60px 24px 40px",
      }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-14 mb-12">
          {/* Brand */}
          <div>
            <div
              className="text-neutral-900"
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
              Crafted for the discerning golfer. Where technical performance
              meets luxury design — on the fairway and beyond.
            </p>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: MUTED,
                }}
              >
                PS Fashion (Sole Proprietorship)
              </span>
              <span
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: MUTED,
                }}
              >
                GSTIN: 07AJWPS2501D1Z6
              </span>
              <span
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.06em",
                  color: MUTED,
                  lineHeight: 1.6,
                }}
              >
                213-B, 3rd Floor, Shahpur Jat,
                <br />
                New Delhi — 110049
              </span>
            </div>
          </div>

          {/* Collections */}
          <div>
            <div style={COL_TITLE}>Collections</div>
            <ul className="flex flex-col gap-2.5">
              <li>
                <FooterLink href="/products?gender=men">Men's</FooterLink>
              </li>
              <li>
                <FooterLink href="/products?gender=women">Women's</FooterLink>
              </li>
              <li>
                <FooterLink href="/products?gender=kids">Kids'</FooterLink>
              </li>
              <li>
                <FooterLink href="/products?type=tshirts&style=patterns">
                  Ka·Sha Signature
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/products?type=tshirts&style=prints">
                  Flair
                </FooterLink>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <div style={COL_TITLE}>Services</div>
            <ul className="flex flex-col gap-2.5">
              <li>
                <FooterLink href="/products/1/customize">
                  Custom Studio
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/products/1/customize">
                  Bulk Orders
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/products/1/customize">Corporate</FooterLink>
              </li>
              <li>
                <FooterLink href="/products/1/customize">
                  Tournaments
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/products/1/customize">
                  Golf Academies
                </FooterLink>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div>
            <div style={COL_TITLE}>Company</div>
            <ul className="flex flex-col gap-2.5">
              <li>
                <FooterLink href="/heritage">About Ka·Sha</FooterLink>
              </li>
              <li>
                <FooterLink href="/products">Lookbook</FooterLink>
              </li>
              <li>
                <FooterLink href="/shipping-policy">Shipping Policy</FooterLink>
              </li>
              <li>
                <FooterLink href="/returns-policy">
                  Returns & Exchanges
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/terms-of-service">
                  Terms of Service
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/privacy-policy" >
                  Privacy Policy
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/ip-policy">
                  IP &amp; Indemnification
                </FooterLink>
              </li>
            </ul>
            <div style={{ marginTop: 24 }}>
              <div style={COL_TITLE}>Support</div>
              <div className="flex flex-col gap-1.5">
                <a
                  href="mailto:support@kashaonline.in"
                  style={{ ...LINK_STYLE, display: "block" }}
                  className="hover:!text-[#B8925A] transition-colors"
                >
                  support@kashaonline.in
                </a>
                <a
                  href="tel:+919560889594"
                  style={{ ...LINK_STYLE, display: "block" }}
                  className="hover:!text-[#B8925A] transition-colors"
                >
                  +91 95608 89594
                </a>
                <span style={{ ...LINK_STYLE, display: "block", fontSize: 9 }}>
                  Mon – Sat, 10 AM – 6 PM IST
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6"
          style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <span
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 9,
                letterSpacing: "0.15em",
                color: MUTED,
              }}
            >
              © 2026 PS Fashion. All rights reserved.
            </span>
            <span
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 9,
                letterSpacing: "0.1em",
                color: MUTED,
              }}
            >
              All prices are inclusive of GST.
            </span>
          </div>
          <div className="flex gap-4">
            {(["Instagram", "Facebook", "LinkedIn", "YouTube"] as const).map(
              (s) => (
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
              ),
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
