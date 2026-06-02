import { useState } from "react";
import { Link } from "wouter";
import { CustomizeEntryModal } from "./CustomizeEntryModal";

const GOLD = "#B8925A";
const MUTED = "rgba(0,0,0,0.68)";

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const COL_TITLE: React.CSSProperties = {
  fontFamily: "'Josefin Sans', sans-serif",
  fontSize: 16,
  letterSpacing: "0.35em",
  color: GOLD,
  textTransform: "uppercase",
  marginBottom: 20,
};

const LINK_STYLE: React.CSSProperties = {
  fontFamily: "'Josefin Sans', sans-serif",
  fontSize: 14,
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
      onClick={scrollToTop}
      className="hover:!text-[#B8925A] transition-colors"
    >
      {children}
    </Link>
  );
}

export function Footer() {
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
  return (
    <>
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
            <img
              src="https://pub-15ec2d2670b445b79fe9a23aa5c7f2f0.r2.dev/images/Horizontal%20logo%20coloured%20(350%20by%2075)%20(1).svg"
              alt="Ka.Sha"
              style={{ height: 40, width: "auto", objectFit: "contain", marginBottom: 16 }}
            />
            <p
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 14,
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
                  fontSize: 14,
                  letterSpacing: "0.08em",
                  color: MUTED,
                }}
              >
                PS Fashion (Sole Proprietorship)
              </span>
              <span
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  color: MUTED,
                }}
              >
                GSTIN: 07AJWPS2501D1Z6
              </span>
              <span
                style={{
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: 13,
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
                <FooterLink href="/products?gender=men">Men</FooterLink>
              </li>
              <li>
                <FooterLink href="/products?gender=women">Women</FooterLink>
              </li>
              {/* <li>
                <FooterLink href="/products?gender=kids">Kids'</FooterLink>
              </li> */}
              {/* <li>
                <FooterLink href="/products?type=tshirts&style=patterns">
                  Ka.Sha Signature
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/products?type=tshirts&style=prints">
                  Flair
                </FooterLink>
              </li> */}
            </ul>
          </div>

          {/* Services */}
          <div>
            <div style={COL_TITLE}>Services</div>
            <ul className="flex flex-col gap-2.5">
              <li>
                <button
                  onClick={() => setCustomizeModalOpen(true)}
                  style={{ ...LINK_STYLE, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  className="hover:!text-[#B8925A] transition-colors"
                >
                  Custom Studio
                </button>
              </li>
              <li>
                <FooterLink href="/contact?subject=bulk">
                  Bulk Orders
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/contact?subject=corporate">Corporate</FooterLink>
              </li>
              <li>
                <FooterLink href="/contact?subject=tournaments">
                  Tournaments
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/contact?subject=academies">
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
                <FooterLink href="/heritage">About Ka.Sha</FooterLink>
              </li>
              <li>
                <FooterLink href="/lookbook">Lookbook</FooterLink>
              </li>
              <li>
              <FooterLink href="/connect">Connect with Us</FooterLink>
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
                <FooterLink href="/privacy-policy">Privacy Policy</FooterLink>
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
                  href="https://mail.google.com/mail/?view=cm&to=support@kashaonline.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...LINK_STYLE, display: "block" }}
                  className="hover:!text-[#B8925A] transition-colors"
                >
                  support@kashaonline.in
                </a>
                <a
                  href="tel:+919560889594"
                  style={{ ...LINK_STYLE, display: "block" }}
                  onClick={scrollToTop}
                  className="hover:!text-[#B8925A] transition-colors"
                >
                  +91 95608 89594
                </a>
                <span style={{ ...LINK_STYLE, display: "block", fontSize: 13 }}>
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
                fontSize: 12,
                letterSpacing: "0.15em",
                color: MUTED,
              }}
            >
              © 2026 PS Fashion. All rights reserved.
            </span>
            <span
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 12,
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
                  onClick={scrollToTop}
                  style={{
                    fontFamily: "'Josefin Sans', sans-serif",
                    fontSize: 12,
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
    <CustomizeEntryModal isOpen={customizeModalOpen} onClose={() => setCustomizeModalOpen(false)} />
    </>
  );
}
