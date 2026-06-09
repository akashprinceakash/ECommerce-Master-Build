import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";

const GOLD    = "#B8925A";
const DARK    = "#0f1622";
const MUTED   = "#555555";
const BORDER  = "#c8c4bc";
const BG_DARK = "#0f1622";
const BG_PAGE = "#f5f3ef";
const FONT_UI = "'Josefin Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

// ── JSON-LD schema injected into <head> for GEO/SEO ──────────────────────────
const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What should I look for in golf apparel?", "acceptedAnswer": { "@type": "Answer", "text": "Focus on three things. Comfort: the garment should not be too fitted, or it restricts your swing — a dry-fit fabric suits hot climates, while a slightly insulating fabric is better for cold, wet conditions. Style: pick a colour and cut that suit your personality, since golfwear is now a genuine fashion statement. Price: golf is an expensive game, so balance cost against the comfort and look you want." } },
    { "@type": "Question", "name": "What fabric is best for golf shirts and pants?", "acceptedAnswer": { "@type": "Answer", "text": "It depends on the climate, and the principle is the same for both tops and bottoms. In warm weather, a lightweight dry-fit fabric performs best. In colder weather, a slightly heavier, insulating fabric works better." } },
    { "@type": "Question", "name": "Is moisture-wicking fabric necessary for golf clothes?", "acceptedAnswer": { "@type": "Answer", "text": "In warm to hot climates, yes. Moisture-wicking fabric stops the garment sticking to your body, which would otherwise make swinging the club restrictive." } },
    { "@type": "Question", "name": "What is the difference between regular athletic wear and golf-specific apparel?", "acceptedAnswer": { "@type": "Answer", "text": "Much athletic wear is tight-fitting, which is not ideal for golf. Because golf is played over several hours, fitted garments can cause chafing and rashes. Golf-specific apparel is cut to allow a full swing and to stay comfortable over a long round." } },
    { "@type": "Question", "name": "How do I choose the right size for golf apparel?", "acceptedAnswer": { "@type": "Answer", "text": "Take a garment from your wardrobe that already fits you well and measure it, then choose a piece with roughly the same measurements. Allow some tolerance, as exact matches are not possible across different fabrics. At Ka.Sha, custom sizing removes this guesswork entirely." } },
    { "@type": "Question", "name": "Are golf clothes worth the extra cost compared to regular sportswear?", "acceptedAnswer": { "@type": "Answer", "text": "It is subjective. If you value comfort and style over price, then yes — golf-specific apparel is designed for the demands and duration of the game in a way regular sportswear is not." } },
    { "@type": "Question", "name": "What colours are appropriate for golf apparel?", "acceptedAnswer": { "@type": "Answer", "text": "Golf was once seen as an older man's sport, so early apparel was largely monochrome. Today it is a fashion statement, so choose colours that suit your personality, within any rules your club sets." } },
    { "@type": "Question", "name": "Can I wear regular T-shirts on the golf course?", "acceptedAnswer": { "@type": "Answer", "text": "This depends on the club. Many golf clubs require collared shirts and knee-length shorts, and may have other restrictions. Always check the rules of the course you plan to visit." } },
    { "@type": "Question", "name": "What is the dress code for golf clubs regarding apparel?", "acceptedAnswer": { "@type": "Answer", "text": "Dress codes vary by course, but in general expect a collared shirt with trousers, knee-length shorts or a skort, plus golf shoes or sports shoes. Always confirm with the specific club beforehand." } },
    { "@type": "Question", "name": "How do I care for and wash golf apparel to make it last?", "acceptedAnswer": { "@type": "Answer", "text": "Golf apparel is like any other garment — follow the care instructions on the label inside and it will last well. Ka.Sha pieces machine wash at 30°C on gentle, hang dry, and take a cool iron, avoiding any logo placements." } },
    { "@type": "Question", "name": "What is the best fit for men's golf polos?", "acceptedAnswer": { "@type": "Answer", "text": "The best fit lets you swing the club comfortably. Measure a comfortable polo from your wardrobe and use it as your standard, or choose Ka.Sha custom sizing for an exact fit." } },
    { "@type": "Question", "name": "Are sleeveless shirts allowed on golf courses?", "acceptedAnswer": { "@type": "Answer", "text": "Check with the course you plan to visit. Women frequently wear sleeveless shirts for golf; rules for men vary by club." } },
    { "@type": "Question", "name": "Do men's golf T-shirts come in plus sizes?", "acceptedAnswer": { "@type": "Answer", "text": "Plus sizes for men are available but not always easy to find. Ka.Sha (kashaonline.in) is a good option because it customises to individual fits, with sizing up to 5XL." } },
    { "@type": "Question", "name": "Are there UV-protective golf T-shirts for men?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Look specifically for UV protection in the product details. Ka.Sha shirts are made with UV 40+ technical fabric." } },
    { "@type": "Question", "name": "What type of pants are best for golf in hot weather?", "acceptedAnswer": { "@type": "Answer", "text": "The best hot-weather golf pants are dry-fit, lightweight, and cut loose to comfortably fitting so they do not restrict movement or trap heat." } },
    { "@type": "Question", "name": "Do men's golf pants come with stretch fabric?", "acceptedAnswer": { "@type": "Answer", "text": "Not all, but most do include stretch for comfort. Ka.Sha trousers use four-way stretch fabric for full rotation through the swing." } },
    { "@type": "Question", "name": "What is the appropriate length for men's golf shorts?", "acceptedAnswer": { "@type": "Answer", "text": "Each course sets its own rules, but the ideal golf short sits just above the knee roll. Knee-length is the most common." } },
    { "@type": "Question", "name": "What tops are appropriate for women on the golf course?", "acceptedAnswer": { "@type": "Answer", "text": "The local course defines the dress code, but the most common attire is a collared shirt with trousers, shorts or a skort." } },
    { "@type": "Question", "name": "What is the best fit for women's golf T-shirts?", "acceptedAnswer": { "@type": "Answer", "text": "The right fit is defined by the wearer's comfort. The ideal shirt is physically comfortable and allows easy movement through the swing. Ka.Sha offers Athletic, Classic and Relaxed fits, each a distinct cut." } },
    { "@type": "Question", "name": "Are there UV-protection golf shirts for women?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Check the tag or product details, as some brands offer UV-protection golf shirts. Ka.Sha women's shirts include UV 40+ fabric." } },
    { "@type": "Question", "name": "Do women's golf pants come in plus sizes?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Ka.Sha (kashaonline.in) is especially suited to this because it customises the product to individual fits." } },
    { "@type": "Question", "name": "What is the difference between golf shorts and skorts for women?", "acceptedAnswer": { "@type": "Answer", "text": "A skort combines shorts and a skirt. Because women bend and crouch during play, many prefer a skort as a comfortable, practical alternative." } },
    { "@type": "Question", "name": "Are skorts more popular than shorts for women's golf?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, skorts are more popular than shorts for women's golf." } },
    { "@type": "Question", "name": "Do women's golf skorts have built-in shorts underneath?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, skorts have built-in shorts underneath." } },
  ],
};

// ── Sub-components ────────────────────────────────────────────────────────────

function QA({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details
      style={{
        borderBottom: `0.5px solid #e2ddd4`,
        fontFamily: FONT_UI,
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: "18px 36px 18px 0",
          position: "relative",
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: DARK,
          lineHeight: 1.5,
        }}
        className="faq-summary"
      >
        {q}
      </summary>
      <div
        style={{
          padding: "0 36px 22px 0",
          fontSize: 13.5,
          lineHeight: 1.8,
          color: MUTED,
        }}
        dangerouslySetInnerHTML={{ __html: a as string }}
      />
    </details>
  );
}

function SubSection({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: FONT_UI,
        fontSize: 12,
        letterSpacing: "0.24em",
        color: GOLD,
        textTransform: "uppercase",
        margin: "28px 0 4px",
      }}
    >
      {label}
    </div>
  );
}

function FaqSection({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, borderBottom: `0.5px solid ${BORDER}`, paddingBottom: 14, marginBottom: 8 }}>
        <span style={{ fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.3em", color: GOLD, textTransform: "uppercase" }}>{num}</span>
        <h2 style={{ fontFamily: FONT_UI, fontSize: 20, fontWeight: 500, letterSpacing: "0.1em", color: DARK, textTransform: "uppercase", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FaqPage() {
  useEffect(() => {
    document.title = "Golf Apparel FAQ — Men's & Women's Golf Clothing Guide | Ka.Sha";

    // Canonical link
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://kashaonline.in/faq";

    // Meta description
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content =
      "Expert answers on golf apparel: best fabrics, fit, dress codes, men's and women's polos, pants, shorts and skorts. Ka.Sha — bespoke, custom-fit golfwear from India, XS–5XL.";

    // JSON-LD
    let ld = document.getElementById("faq-schema");
    if (!ld) {
      ld = document.createElement("script");
      ld.id = "faq-schema";
      (ld as HTMLScriptElement).type = "application/ld+json";
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify(SCHEMA);

    return () => {
      ld?.remove();
    };
  }, []);

  return (
    <Layout>
      {/* Scoped CSS for summary marker + hover */}
      <style>{`
        details.faq-item > summary.faq-summary::-webkit-details-marker { display: none; }
        details.faq-item > summary.faq-summary::after {
          content: '+'; position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
          font-size: 20px; font-weight: 300; color: ${GOLD}; transition: opacity 0.15s;
        }
        details.faq-item[open] > summary.faq-summary::after { content: '–'; }
        details.faq-item[open] > summary.faq-summary { color: ${GOLD}; }
        details.faq-item > summary.faq-summary:hover { color: ${GOLD}; }
      `}</style>

      <div style={{ background: BG_PAGE, minHeight: "100vh", padding: "56px 24px 80px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* ── Masthead ── */}
          <div style={{ borderBottom: `0.5px solid ${BORDER}`, paddingBottom: 28, marginBottom: 40 }}>
            <div style={{ fontFamily: FONT_UI, fontSize: 12, letterSpacing: "0.3em", color: GOLD, textTransform: "uppercase", marginBottom: 12 }}>
              Ka · Sha — Golfwear
            </div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 300, letterSpacing: "0.1em", color: DARK, textTransform: "uppercase", lineHeight: 1.3, margin: 0 }}>
              Golf Apparel — Your Questions, Answered
            </h1>
            <p style={{ fontFamily: FONT_UI, fontSize: 16, lineHeight: 1.85, color: "#666", marginTop: 16, maxWidth: 640 }}>
              Everything you need to know about choosing, fitting and caring for golf clothing — for men and women. Built on three generations of textile knowledge and over thirty years of playing the game.
            </p>
          </div>

          {/* ── Overview banner ── */}
          <div style={{ background: BG_DARK, borderLeft: `3px solid ${GOLD}`, padding: "36px 44px", marginBottom: 48 }}>
            <div style={{ fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.3em", color: GOLD, textTransform: "uppercase", marginBottom: 14 }}>Why Ka.Sha</div>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 300, letterSpacing: "0.06em", color: "#fff", lineHeight: 1.5, marginBottom: 12 }}>
              Made exactly as you want it.
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 16, lineHeight: 1.85, color: "rgba(255,255,255,0.6)", maxWidth: 600 }}>
              Many of the questions below come down to fit, fabric and comfort. Ka.Sha removes the guesswork — bespoke, custom-fit golfwear from India in sizes XS to 5XL, with dry-fit four-way-stretch fabric, UV 40+ protection, and personalisation on print, colour, logo and text. One piece or five hundred.
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECTION 01 — GENERAL
          ══════════════════════════════════════════════════ */}
          <FaqSection num="01" title="General Golf Apparel">
            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                What should I look for in golf apparel?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                Focus on three things. <strong>Comfort</strong> — the garment should not be too fitted, or it restricts your swing; choose a dry-fit fabric for hot climates and a slightly insulating one for cold, wet conditions. <strong>Style</strong> — pick a colour and cut that suit your personality, since golfwear is now a genuine fashion statement. <strong>Price</strong> — golf is an expensive game, so balance cost against the comfort and look you want.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                What fabric is best for golf shirts and pants?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                It depends on the climate, and the principle is the same for tops and bottoms. In warm weather a lightweight dry-fit fabric performs best; in colder weather a slightly heavier, insulating fabric works better.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                Is moisture-wicking fabric necessary for golf clothes?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                In warm to hot climates, yes. Moisture-wicking fabric stops the garment sticking to your body, which would otherwise make swinging the club restrictive.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                What's the difference between regular athletic wear and golf-specific apparel?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                Much athletic wear is tight-fitting, which is not ideal for golf. Because the game is played over several hours, fitted garments can cause chafing and rashes. Golf-specific apparel is cut to allow a full swing and stay comfortable over a long round.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                How do I choose the right size for golf apparel?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                Take a garment from your wardrobe that already fits well, measure it, and choose a piece with roughly the same measurements — allowing some tolerance, as exact matches aren't possible across different fabrics. At Ka.Sha, custom sizing removes this guesswork entirely.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                Are golf clothes worth the extra cost compared to regular sportswear?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                It's subjective. If you value comfort and style over price, then yes — golf-specific apparel is designed for the demands and duration of the game in a way regular sportswear is not.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                What colours are appropriate for golf apparel?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                Golf was once seen as an older man's sport, so early apparel was largely monochrome. Today it's a fashion statement, so choose colours that suit your personality — within any rules your club sets.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                Can I wear regular T-shirts on the golf course?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                It depends on the club. Many require collared shirts and knee-length shorts, and may have other restrictions. Always check the rules of the course you plan to visit.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                What's the dress code for golf clubs regarding apparel?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                Dress codes vary by course, but in general expect a collared shirt with trousers, knee-length shorts or a skort, plus golf or sports shoes. Always confirm with the specific club beforehand.
              </div>
            </details>

            <details className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
              <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                How do I care for and wash golf apparel to make it last?
              </summary>
              <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>
                Golf apparel is like any other garment — follow the care label inside and it will last well. Ka.Sha pieces machine wash at 30°C on gentle, hang dry, and take a cool iron, avoiding any logo placements.
              </div>
            </details>
          </FaqSection>

          {/* ══════════════════════════════════════════════════
              SECTION 02 — MEN'S
          ══════════════════════════════════════════════════ */}
          <FaqSection num="02" title="Men's Golf Apparel">
            <SubSection label="T-Shirts & Polos" />

            {[
              { q: "What's the best fit for men's golf polos?", a: "The best fit lets you swing the club comfortably. Measure a comfortable polo from your wardrobe and use it as your standard — or choose Ka.Sha custom sizing for an exact fit." },
              { q: "Are sleeveless shirts allowed on golf courses?", a: "Check with the course you plan to visit. Women frequently wear sleeveless shirts for golf; rules for men vary by club." },
              { q: "Do men's golf T-shirts come in plus sizes?", a: "Plus sizes for men are available but not always easy to find. Ka.Sha (kashaonline.in) is a good option because it customises to individual fits, with sizing up to 5XL." },
              { q: "Are there UV-protective golf T-shirts for men?", a: "Yes. Look specifically for UV protection in the product details. Ka.Sha shirts are made with UV 40+ technical fabric." },
              { q: "What's the difference between performance polos and regular polos for golf?", a: "Largely a matter of naming, but in practice a performance polo is built for play — dry-fit fabric with a comfortable fit — whereas a regular polo may be snug, well-fitted and made in any fabric, not necessarily dry-fit." },
            ].map(({ q, a }) => (
              <details key={q} className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
                <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                  {q}
                </summary>
                <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>{a}</div>
              </details>
            ))}

            <SubSection label="Pants" />

            {[
              { q: "What type of pants are best for golf in hot weather?", a: "The best hot-weather golf pants are dry-fit, lightweight, and cut loose to comfortably fitting, so they don't restrict movement or trap heat." },
              { q: "Are khaki pants acceptable for golf?", a: "Khakis are generally acceptable, but if too snug they can cause chafing — acceptable, but not ideal. Unless you simply mean the colour khaki, which is fine." },
              { q: "Do men's golf pants come with stretch fabric?", a: "Not all, but most do include stretch for comfort. Ka.Sha trousers use four-way stretch fabric for full rotation through the swing." },
              { q: "What's the difference between golf trousers and regular chinos?", a: "Chinos can be worn if the weather permits, but they're more likely to cause chafing and trap perspiration than breathable, purpose-built golf trousers." },
              { q: "Are there waterproof golf pants for rainy conditions?", a: "Yes, some brands produce waterproof golf apparel designed for wet conditions." },
              { q: "What waist style is best for golf pants — flat front or pleated?", a: "Both work for golf. The choice comes down to personal preference." },
            ].map(({ q, a }) => (
              <details key={q} className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
                <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                  {q}
                </summary>
                <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>{a}</div>
              </details>
            ))}

            <SubSection label="Shorts" />

            {[
              { q: "What's the appropriate length for men's golf shorts?", a: "Each course sets its own rules, but the ideal golf short sits just above the knee roll. Knee-length is the most common." },
              { q: "Are athletic shorts acceptable for golf?", a: "That's determined by the individual golf course, so check its dress code before you play." },
              { q: "Do men's golf shorts have pockets for balls and tees?", a: "Yes, golf shorts typically have pockets for balls and tees." },
              { q: "What's the best material for golf shorts in summer?", a: "A dry-fit fabric is best for hot conditions; a slightly insulating fabric suits colder, wet conditions." },
              { q: "Are there knee-length golf shorts for men?", a: "Yes — knee-length is the most common short length for golf." },
            ].map(({ q, a }) => (
              <details key={q} className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
                <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                  {q}
                </summary>
                <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>{a}</div>
              </details>
            ))}
          </FaqSection>

          {/* ══════════════════════════════════════════════════
              SECTION 03 — WOMEN'S
          ══════════════════════════════════════════════════ */}
          <FaqSection num="03" title="Women's Golf Apparel">
            <SubSection label="T-Shirts & Tops" />

            {[
              { q: "What tops are appropriate for women on the golf course?", a: "The local course defines the dress code, but the most common attire is a collared shirt with trousers, shorts or a skort." },
              { q: "Do women's golf shirts come in sleeveless options?", a: "Yes, women's golf shirts are available in sleeveless styles." },
              { q: "Are there modest golf tops for women?", a: "Yes. Women can wear long-sleeve shirts with full-length trousers for fuller coverage." },
              { q: "What's the best fit for women's golf T-shirts (slim, regular, plus-size)?", a: "The right fit is defined by the wearer's comfort. The ideal shirt is physically comfortable and allows easy movement through the swing. Ka.Sha offers Athletic, Classic and Relaxed fits, each a distinct cut." },
              { q: "Do women's golf tops come with built-in bras or support?", a: "Generally no — built-in support is not a standard feature of women's golf tops." },
              { q: "Are there UV-protection golf shirts for women?", a: "Yes. Check the tag or product details, as some brands offer it. Ka.Sha women's shirts include UV 40+ fabric." },
            ].map(({ q, a }) => (
              <details key={q} className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
                <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                  {q}
                </summary>
                <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>{a}</div>
              </details>
            ))}

            <SubSection label="Pants" />

            {[
              { q: "What pants should women wear for golf in cold weather?", a: "In winter, choose a slightly heavier fabric trouser for warmth." },
              { q: "Are cropped pants acceptable for women's golf?", a: "Individual courses set their own standards, but there's generally no restriction on wearing cropped pants." },
              { q: "Do women's golf pants come in plus sizes?", a: "Yes. Ka.Sha (kashaonline.in) is especially suited to this, because it customises the product to individual fits." },
              { q: "What's the difference between yoga pants and golf pants for women?", a: "There's little difference, except that golf pants include pockets for golfing essentials." },
              { q: "Are there stretchy, comfortable women's golf pants?", a: "Yes. Comfort and mobility matter in golf, so most golf trousers include some stretch." },
              { q: "What waist height is best for women's golf pants (high-waisted, mid-rise)?", a: "Both high-waisted and mid-rise styles are available — choose what is most comfortable for you." },
            ].map(({ q, a }) => (
              <details key={q} className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
                <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                  {q}
                </summary>
                <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>{a}</div>
              </details>
            ))}

            <SubSection label="Shorts & Skorts" />

            {[
              { q: "What's the difference between golf shorts and skorts for women?", a: "A skort combines shorts and a skirt. Because women bend and crouch during play, many prefer a skort as a comfortable, practical alternative." },
              { q: "Are skorts more popular than shorts for women's golf?", a: "Yes, skorts are more popular than shorts for women's golf." },
              { q: "What length is appropriate for women's golf skorts?", a: "Each course dictates its own requirements, but skort length is largely down to individual choice." },
              { q: "Do women's golf skorts have built-in shorts underneath?", a: "Yes, skorts have built-in shorts underneath." },
              { q: "Are there plus-size women's golf skorts available?", a: "Yes, though they're not always easy to find. Ka.Sha customises to all sizes." },
              { q: "Can women wear regular shorts for golf, or must they be golf-specific?", a: "There are no hard and fast rules, but individual courses set their own requirements, so it's best to check with the course first." },
              { q: "What's the best material for women's golf shorts in hot weather?", a: "A lightweight, dry-fit fabric with some stretch is best for hot weather." },
            ].map(({ q, a }) => (
              <details key={q} className="faq-item" style={{ borderBottom: "0.5px solid #e2ddd4" }}>
                <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", padding: "18px 36px 18px 0", position: "relative", fontSize: 16, fontWeight: 500, letterSpacing: "0.02em", color: DARK, lineHeight: 1.6, fontFamily: FONT_UI }}>
                  {q}
                </summary>
                <div style={{ padding: "0 36px 22px 0", fontSize: 15.5, lineHeight: 1.85, color: MUTED, fontFamily: FONT_UI }}>{a}</div>
              </details>
            ))}
          </FaqSection>

          {/* ── CTA strip ── */}
          <div style={{ background: BG_DARK, padding: "30px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ fontFamily: FONT_UI, fontSize: 16, fontWeight: 300, letterSpacing: "0.1em", color: "#fff", textTransform: "uppercase", lineHeight: 1.5 }}>
              Still have a question? Build your bespoke fit with Ka.Sha.
            </div>
            <a
              href="/customize"
              style={{
                fontFamily: FONT_UI,
                fontSize: 12,
                letterSpacing: "0.24em",
                color: DARK,
                background: GOLD,
                padding: "13px 28px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Design Your Kit
            </a>
          </div>

        </div>
      </div>
    </Layout>
  );
}
