import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { CartProvider } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/format";

const POLO_IMAGES = [
  "/images/golf/polo-pink-black.jpeg",
  "/images/golf/polo-green-black.jpeg",
  "/images/golf/polo-pink-curve.jpeg",
  "/images/golf/polo-beige-brown.png",
];

const FALLBACK_NAMES = [
  "Solid Polo — Men's",
  "Classic Argyle — Men's",
  "Heritage Stripe — Men's",
  "Glen Check — Men's",
  "Houndstooth — Men's",
  "Geometric — Men's",
  "Solid Polo — Women's",
  "Junior Polo — Kids'",
];

const FALLBACK_BADGES = ["Bestseller", "", "", "New", "", "", "Women's", "Kids'"];
const FALLBACK_PRICES = [
  "From ₹ 3,200",
  "From ₹ 3,600",
  "From ₹ 3,400",
  "From ₹ 3,600",
  "From ₹ 3,600",
  "From ₹ 3,600",
  "From ₹ 3,200",
  "From ₹ 1,800",
];

const FALLBACK_SWATCHES: string[][] = [
  ["sw-navy", "sw-white", "sw-forest", "sw-charcoal", "sw-coral", "sw-burg", "sw-olive", "sw-sky"],
  ["sw-navy", "sw-forest", "sw-burg"],
  ["sw-navy", "sw-forest", "sw-burg", "sw-sky"],
  ["sw-navy", "sw-forest", "sw-charcoal"],
  ["sw-navy", "sw-charcoal", "sw-ivory"],
  ["sw-navy", "sw-charcoal", "sw-olive"],
  ["sw-white", "sw-navy", "sw-coral", "sw-sky", "sw-olive"],
  ["sw-forest", "sw-navy", "sw-coral"],
];

const SWATCH_HEX: Record<string, string> = {
  "sw-navy": "#1a2540",
  "sw-white": "#f0ece4",
  "sw-forest": "#2e4a34",
  "sw-charcoal": "#484848",
  "sw-coral": "#b86040",
  "sw-burg": "#6e2030",
  "sw-olive": "#5a6030",
  "sw-sky": "#5888aa",
  "sw-ivory": "#e0d8c8",
};

function Swatches({ keys, mb = 7 }: { keys: string[]; mb?: number }) {
  return (
    <div className="sc-swatches" style={{ display: "flex", gap: 5, marginBottom: mb }}>
      {keys.map((k, i) => (
        <div
          key={i}
          className={`sw ${k}`}
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            border: "0.5px solid rgba(0,0,0,0.12)",
            background: SWATCH_HEX[k] || "#999",
          }}
        />
      ))}
    </div>
  );
}

function HomeInner() {
  const [, navigate] = useLocation();
  const [cur, setCur] = useState(0);
  const [barKey, setBarKey] = useState(0);

  // Fetch fabric and pattern t-shirts (the "Ready to Wear Golf T-Shirts")
  const { data: fabricProducts } = useListProducts(
    { category: "fabric-tshirt" },
    { query: { queryKey: getListProductsQueryKey({ category: "fabric-tshirt" }) } }
  );
  const { data: patternProducts } = useListProducts(
    { category: "pattern" },
    { query: { queryKey: getListProductsQueryKey({ category: "pattern" }) } }
  );

  const golfShirts = [...(fabricProducts || []), ...(patternProducts || [])].slice(0, 8);

  useEffect(() => {
    const id = setInterval(() => {
      setCur((c) => (c + 1) % 4);
      setBarKey((k) => k + 1);
    }, 5400);
    return () => clearInterval(id);
  }, []);

  const goTo = (n: number) => {
    setCur(((n % 4) + 4) % 4);
    setBarKey((k) => k + 1);
  };

  const handleAnchor = (e: React.MouseEvent, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="kasha-page">
      <style>{`
        .kasha-page, .kasha-page *, .kasha-page *::before, .kasha-page *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .kasha-page { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background:#f5f3ef; color:#1a1a1a; overflow-x:hidden; min-height:100vh; }
        .kasha-page a { text-decoration:none; }
        .kasha-page ul { list-style:none; }

        /* NAV */
        .kp-nav { position: fixed; top:0; left:0; right:0; z-index:200; height:56px; background: rgba(245,243,239,0.97); border-bottom:.5px solid #c8c4bc; display:flex; align-items:center; padding:0 48px; }
        .kp-nav-left { display:flex; gap:28px; align-items:center; }
        .kp-nav-left a { font-size:10px; letter-spacing:.2em; color:#0f1622; text-transform:uppercase; opacity:.55; transition:opacity .2s; }
        .kp-nav-left a:hover { opacity:1; }
        .kp-nav-brand { position:absolute; left:50%; transform:translateX(-50%); font-size:19px; font-weight:200; letter-spacing:.42em; color:#0f1622; text-transform:uppercase; white-space:nowrap; }
        .kp-nav-brand em { color:#B8925A; font-style:normal; }
        .kp-nav-right { margin-left:auto; display:flex; gap:24px; align-items:center; }
        .kp-nav-right a { font-size:10px; letter-spacing:.18em; color:#0f1622; text-transform:uppercase; opacity:.55; transition:opacity .2s; }
        .kp-nav-right a:hover { opacity:1; }
        .kp-nav-shop { font-size:9px !important; letter-spacing:.22em !important; color:#0f1622 !important; background:#B8925A !important; padding:7px 16px; opacity:1 !important; }
        .kp-nav-shop:hover { background:#ca9f64 !important; }

        /* HERO */
        .kp-hero { margin-top:56px; position:relative; height: calc(100vh - 56px); min-height:580px; overflow:hidden; }
        .kp-slide { position:absolute; inset:0; opacity:0; transition: opacity 1.2s ease; display:flex; align-items:flex-end; }
        .kp-slide.active { opacity:1; }
        .kp-slide::after { content:''; position:absolute; inset:0; background: linear-gradient(to bottom, transparent 28%, rgba(8,10,18,0.72) 100%); }
        .kp-s1 { background: linear-gradient(155deg,#1a2535 0%,#2d3f52 45%,#8aaab8 100%); }
        .kp-s2 { background: linear-gradient(148deg,#1c2d20 0%,#304838 48%,#6a9878 100%); }
        .kp-s3 { background: linear-gradient(152deg,#2c1f12 0%,#4a3522 48%,#b09060 100%); }
        .kp-s4 { background: linear-gradient(150deg,#1e1a2c 0%,#2e2848 48%,#8070b0 100%); }
        .kp-slide-content { position:relative; z-index:2; padding: 0 64px 72px; }
        .kp-eye { font-size:9px; letter-spacing:.36em; color:#B8925A; text-transform:uppercase; margin-bottom:14px; opacity:0; transform:translateY(12px); transition: opacity .7s ease .3s, transform .7s ease .3s; }
        .kp-slide.active .kp-eye { opacity:1; transform:translateY(0); }
        .kp-head { font-size: clamp(38px,5.5vw,66px); font-weight:200; letter-spacing:.04em; color:#fff; line-height:1.12; margin-bottom:16px; opacity:0; transform:translateY(18px); transition: opacity .85s ease .5s, transform .85s ease .5s; }
        .kp-slide.active .kp-head { opacity:1; transform:translateY(0); }
        .kp-sub { font-size:11px; letter-spacing:.18em; color:rgba(255,255,255,.48); text-transform:uppercase; margin-bottom:34px; opacity:0; transform:translateY(10px); transition: opacity .7s ease .7s, transform .7s ease .7s; }
        .kp-slide.active .kp-sub { opacity:1; transform:translateY(0); }
        .kp-btn { display:inline-block; font-size:9px; letter-spacing:.26em; color:#0f1622; background:#B8925A; padding:13px 28px; text-transform:uppercase; opacity:0; transform:translateY(8px); transition: opacity .65s ease .9s, transform .65s ease .9s, background .2s; cursor:pointer; }
        .kp-slide.active .kp-btn { opacity:1; transform:translateY(0); }
        .kp-btn:hover { background:#ca9f64; }
        .kp-cbadge { display:inline-flex; align-items:center; gap:8px; margin-bottom:20px; font-size:9px; letter-spacing:.26em; color:rgba(255,255,255,.6); text-transform:uppercase; opacity:0; transform:translateY(10px); transition: opacity .7s ease .7s, transform .7s ease .7s; }
        .kp-slide.active .kp-cbadge { opacity:1; transform:translateY(0); }
        .kp-cbadge::before { content:''; width:20px; height:1px; background:#B8925A; }
        .kp-dots { position:absolute; bottom:28px; right:64px; z-index:10; display:flex; gap:8px; align-items:center; }
        .kp-dot { width:5px; height:5px; background:rgba(255,255,255,.3); cursor:pointer; transition:all .3s; }
        .kp-dot.active { width:22px; background:#B8925A; }
        .kp-bar { position:absolute; bottom:0; left:0; height:1.5px; background:#B8925A; width:0%; z-index:10; animation: kp-bar 5.2s linear forwards; }
        @keyframes kp-bar { from { width:0%; } to { width:100%; } }

        /* SECTION HEADER */
        .kp-sec { padding: 52px 48px 28px; display:flex; align-items:baseline; justify-content:space-between; border-bottom:.5px solid #c8c4bc; }
        .kp-sec-left .kp-sec-eye { font-size:9px; letter-spacing:.32em; color:#B8925A; text-transform:uppercase; margin-bottom:8px; }
        .kp-sec-left h2 { font-size:20px; font-weight:200; letter-spacing:.14em; color:#0f1622; text-transform:uppercase; }
        .kp-sec-right { font-size:9.5px; letter-spacing:.18em; color:#888; text-transform:uppercase; border-bottom:.5px solid #c8c4bc; padding-bottom:2px; white-space:nowrap; transition: color .2s, border-color .2s; }
        .kp-sec-right:hover { color:#B8925A; border-color:#B8925A; }

        /* SHIRT GRID */
        .kp-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:1px; background:#c8c4bc; }
        .kp-card { background:#f5f3ef; cursor:pointer; position:relative; color:inherit; display:block; }
        .kp-card:hover .kp-cimg { transform: scale(1.04); }
        .kp-card:hover .kp-hover { opacity:1; }
        .kp-cwrap { aspect-ratio: 3/4; overflow:hidden; position:relative; background:#eceae4; }
        .kp-cimg { width:100%; height:100%; display:flex; align-items:center; justify-content:center; transition: transform .55s ease; position:relative; }
        .kp-cimg img { width:100%; height:100%; object-fit:cover; object-position:center; display:block; }
        .kp-badge { position:absolute; top:12px; left:12px; font-size:7.5px; letter-spacing:.2em; color:#fff; background:#B8925A; padding:3px 9px; text-transform:uppercase; z-index:2; }
        .kp-hover { position:absolute; bottom:0; left:0; right:0; background:#0f1622; color:#fff; text-align:center; font-size:8.5px; letter-spacing:.22em; text-transform:uppercase; padding:11px; opacity:0; transition: opacity .22s; z-index:2; }
        .kp-cinfo { padding:14px 16px 18px; background:#fff; }
        .kp-cname { font-size:10.5px; font-weight:400; letter-spacing:.14em; color:#0f1622; text-transform:uppercase; margin-bottom:6px; }
        .kp-cprice { font-size:10px; letter-spacing:.1em; color:#555; font-weight:300; }

        /* BOTTOMS */
        .kp-brow { display:grid; grid-template-columns: 1fr 1fr; gap:1px; background:#c8c4bc; margin-top:1px; }
        .kp-bcard { background:#fff; display:grid; grid-template-columns: 200px 1fr; cursor:pointer; }
        .kp-bcard:hover .kp-cimg { transform: scale(1.03); }
        .kp-bcard .kp-cwrap { aspect-ratio: auto; min-height: 220px; }
        .kp-binfo { padding:24px; display:flex; flex-direction:column; justify-content:center; }
        .kp-bname { font-size:11px; font-weight:400; letter-spacing:.14em; color:#0f1622; text-transform:uppercase; margin-bottom:4px; }
        .kp-bsub { font-size:10px; letter-spacing:.06em; color:#888; margin-bottom:10px; }
        .kp-feats { margin-bottom:12px; }
        .kp-feats li { font-size:9.5px; letter-spacing:.1em; color:#888; text-transform:uppercase; padding:4px 0; border-bottom:.5px solid #eee; display:flex; align-items:center; gap:9px; }
        .kp-feats li::before { content:''; width:12px; height:1px; background:#B8925A; flex-shrink:0; }
        .kp-bprice { font-size:10px; letter-spacing:.1em; color:#555; }
        .kp-trouser { background: linear-gradient(160deg,#1a2540,#263050); width:100%; height:100%; }
        .kp-skort { background: linear-gradient(155deg,#2a1e2e,#4a3258); width:100%; height:100%; }

        /* CUSTOM */
        .kp-cb { background:#0f1622; border-left:3px solid #B8925A; padding:48px 64px; display:flex; align-items:center; justify-content:space-between; gap:48px; }
        .kp-cbeye { font-size:9px; letter-spacing:.32em; color:#B8925A; text-transform:uppercase; margin-bottom:12px; }
        .kp-cbh { font-size:24px; font-weight:200; letter-spacing:.1em; color:#fff; line-height:1.38; }
        .kp-cbacts { display:flex; flex-direction:column; align-items:flex-start; gap:10px; flex-shrink:0; }
        .kp-cbcta { font-size:9px; letter-spacing:.26em; color:#0f1622; background:#B8925A; padding:13px 28px; text-transform:uppercase; border:none; cursor:pointer; white-space:nowrap; transition:background .2s; }
        .kp-cbcta:hover { background:#ca9f64; }
        .kp-cblink { font-size:9px; letter-spacing:.18em; color:rgba(255,255,255,.38); text-transform:uppercase; cursor:pointer; background:none; border:none; border-bottom:.5px solid rgba(255,255,255,.2); padding:0 0 2px; transition:color .2s; }
        .kp-cblink:hover { color:rgba(255,255,255,.7); }
        .kp-cgrid { display:grid; grid-template-columns: repeat(6, 1fr); gap:1px; background:#c8c4bc; }
        .kp-cc { background:#fff; padding:24px 20px 22px; }
        .kp-ccn { font-size:8px; letter-spacing:.28em; color:#B8925A; text-transform:uppercase; margin-bottom:8px; }
        .kp-cct { font-size:10.5px; font-weight:500; letter-spacing:.14em; color:#0f1622; text-transform:uppercase; margin-bottom:8px; }
        .kp-cctags { display:flex; flex-wrap:wrap; gap:3px; }
        .kp-cctag { font-size:7.5px; letter-spacing:.1em; color:#666; background:#f0ede7; padding:2px 7px; text-transform:uppercase; }

        /* USE CASES */
        .kp-uc-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap:1px; background:#c8c4bc; }
        .kp-uc { background:#fff; padding:28px 26px; }
        .kp-ucn { font-size:8px; letter-spacing:.3em; color:#B8925A; text-transform:uppercase; margin-bottom:10px; }
        .kp-uct { font-size:12px; font-weight:500; letter-spacing:.12em; color:#0f1622; text-transform:uppercase; margin-bottom:8px; }
        .kp-ucb { font-size:12.5px; line-height:1.72; color:#666; margin-bottom:12px; }
        .kp-uctags { display:flex; flex-wrap:wrap; gap:4px; }
        .kp-uctag { font-size:8px; letter-spacing:.1em; color:#0f1622; background:#f0ede7; padding:2px 9px; text-transform:uppercase; }
        .kp-uc.wide { grid-column: 1 / -1; display:grid; grid-template-columns: 1fr 2fr; gap:28px; align-items:center; }
        .kp-uc.wide .kp-ucl { border-right:.5px solid #e8e4de; padding-right:28px; }

        /* CTA STRIP */
        .kp-cta { background:#0f1622; padding:26px 48px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
        .kp-cta span { font-size:12px; font-weight:200; letter-spacing:.16em; color:#fff; text-transform:uppercase; }
        .kp-cta button { font-size:9px; letter-spacing:.24em; color:#0f1622; background:#B8925A; padding:11px 24px; text-transform:uppercase; border:none; cursor:pointer; white-space:nowrap; transition:background .2s; }
        .kp-cta button:hover { background:#ca9f64; }

        /* FOOTER */
        .kp-footer { background:#0f1622; padding:48px 48px 32px; }
        .kp-fcols { display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap:40px; padding-bottom:36px; border-bottom:.5px solid rgba(255,255,255,.07); margin-bottom:28px; }
        .kp-fbrand { font-size:20px; font-weight:200; letter-spacing:.42em; color:#fff; margin-bottom:10px; }
        .kp-fbrand em { color:#B8925A; font-style:normal; }
        .kp-ftag { font-size:9.5px; letter-spacing:.14em; color:rgba(255,255,255,.28); text-transform:uppercase; line-height:1.9; }
        .kp-fcol h4 { font-size:8px; letter-spacing:.3em; color:rgba(255,255,255,.3); text-transform:uppercase; margin-bottom:16px; padding-bottom:8px; border-bottom:.5px solid rgba(255,255,255,.06); font-weight:500; }
        .kp-fcol a { display:block; font-size:10px; letter-spacing:.1em; color:rgba(255,255,255,.45); text-transform:uppercase; margin-bottom:10px; transition: color .2s; }
        .kp-fcol a:hover { color:#B8925A; }
        .kp-fbot { display:flex; justify-content:space-between; align-items:center; }
        .kp-fcopy { font-size:9px; letter-spacing:.1em; color:rgba(255,255,255,.18); text-transform:uppercase; }
        .kp-fmade { font-size:9px; letter-spacing:.18em; color:rgba(184,146,90,.35); text-transform:uppercase; }

        @media (max-width: 1000px) {
          .kp-grid { grid-template-columns: repeat(2, 1fr); }
          .kp-cgrid { grid-template-columns: repeat(3, 1fr); }
          .kp-brow { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .kp-nav { padding: 0 20px; }
          .kp-nav-left { gap: 14px; }
          .kp-nav-right { gap: 12px; }
          .kp-sec, .kp-cta { padding-left:20px; padding-right:20px; }
          .kp-slide-content { padding: 0 24px 52px; }
          .kp-head { font-size:32px; }
          .kp-uc-grid { grid-template-columns: 1fr; }
          .kp-uc.wide { grid-template-columns: 1fr; }
          .kp-uc.wide .kp-ucl { border-right:none; border-bottom:.5px solid #e8e4de; padding-right:0; padding-bottom:18px; }
          .kp-cb { flex-direction:column; padding:32px 24px; gap:24px; }
          .kp-fcols { grid-template-columns: 1fr 1fr; gap:28px; }
          .kp-cgrid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* NAV */}
      <nav className="kp-nav">
        <div className="kp-nav-left">
          <Link href="/products?gender=men">Men</Link>
          <Link href="/products?gender=women">Women</Link>
          <Link href="/products?gender=kids">Kids</Link>
        </div>
        <Link href="/" className="kp-nav-brand">
          Ka<em>.</em>Sha
        </Link>
        <div className="kp-nav-right">
          <a href="#custom" onClick={(e) => handleAnchor(e, "#custom")}>
            Bespoke &amp; Custom
          </a>
          <a href="#shop" className="kp-nav-shop" onClick={(e) => handleAnchor(e, "#shop")}>
            Shop Now
          </a>
        </div>
      </nav>

      {/* HERO CAROUSEL */}
      <section id="hero" className="kp-hero">
        <div className={`kp-slide kp-s1 ${cur === 0 ? "active" : ""}`}>
          <div className="kp-slide-content">
            <div className="kp-eye">New Season · Golf Collection</div>
            <div className="kp-head">
              Dressed for the<br />clubhouse. Built<br />for every birdie.
            </div>
            <div className="kp-sub">Technical golfwear · Men · Women · Kids</div>
            <a href="#shop" className="kp-btn" onClick={(e) => handleAnchor(e, "#shop")}>
              Shop the Collection
            </a>
          </div>
        </div>
        <div className={`kp-slide kp-s2 ${cur === 1 ? "active" : ""}`}>
          <div className="kp-slide-content">
            <div className="kp-eye">Ready to Wear · 8 Patterns</div>
            <div className="kp-head">
              Solids. Stripes.<br />Argyle. Checks.<br />Your course, your style.
            </div>
            <div className="kp-sub">Off-the-shelf · Ships in 5 days</div>
            <a href="#shop" className="kp-btn" onClick={(e) => handleAnchor(e, "#shop")}>
              Shop T-Shirts
            </a>
          </div>
        </div>
        <div className={`kp-slide kp-s3 ${cur === 2 ? "active" : ""}`}>
          <div className="kp-slide-content">
            <div className="kp-eye">Bespoke Studio</div>
            <div className="kp-head">
              Your colour.<br />Your logo.<br />Your shirt.
            </div>
            <div className="kp-cbadge">Colour · Print · Fit · Logo · Text · Trim</div>
            <a href="#custom" className="kp-btn" onClick={(e) => handleAnchor(e, "#custom")}>
              Open the Custom Studio
            </a>
          </div>
        </div>
        <div className={`kp-slide kp-s4 ${cur === 3 ? "active" : ""}`}>
          <div className="kp-slide-content">
            <div className="kp-eye">Tournaments · Academies · Clubs</div>
            <div className="kp-head">
              One shirt.<br />Five hundred.<br />Delivered on brief.
            </div>
            <div className="kp-sub">Bulk from 12 pieces · Pantone-matched</div>
            <a href="#custom" className="kp-btn" onClick={(e) => handleAnchor(e, "#custom")}>
              Get a Quote
            </a>
          </div>
        </div>
        <div className="kp-dots">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`kp-dot ${i === cur ? "active" : ""}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <div key={`bar-${barKey}-${cur}`} className="kp-bar" />
      </section>

      {/* T-SHIRT GRID */}
      <div id="shop">
        <div className="kp-sec">
          <div className="kp-sec-left">
            <div className="kp-sec-eye">Ready to Wear</div>
            <h2>Golf T-Shirts</h2>
          </div>
          <Link href="/products" className="kp-sec-right">View all →</Link>
        </div>

        <div className="kp-grid">
          {(golfShirts.length > 0 ? golfShirts : Array.from({ length: 8 })).map((p: any, idx) => {
            const img = POLO_IMAGES[idx % POLO_IMAGES.length];
            const badge = FALLBACK_BADGES[idx % FALLBACK_BADGES.length];
            const swatches = FALLBACK_SWATCHES[idx % FALLBACK_SWATCHES.length];
            const productId = p?.id;
            const name = p?.name || FALLBACK_NAMES[idx % FALLBACK_NAMES.length];
            const price = p ? formatPrice(p.priceInPaise) : FALLBACK_PRICES[idx % FALLBACK_PRICES.length];

            const inner = (
              <>
                <div className="kp-cwrap">
                  <div className="kp-cimg">
                    <img src={img} alt={name} />
                  </div>
                  {badge && <div className="kp-badge">{badge}</div>}
                  <div className="kp-hover">Quick View</div>
                </div>
                <div className="kp-cinfo">
                  <div className="kp-cname">{name}</div>
                  <Swatches keys={swatches} />
                  <div className="kp-cprice">{price}</div>
                </div>
              </>
            );

            return productId ? (
              <Link key={productId} href={`/products/${productId}`} className="kp-card">
                {inner}
              </Link>
            ) : (
              <div key={`fb-${idx}`} className="kp-card" onClick={() => navigate("/products")}>
                {inner}
              </div>
            );
          })}
        </div>

        {/* BOTTOMS */}
        <div className="kp-sec" style={{ paddingTop: 40 }}>
          <div className="kp-sec-left">
            <div className="kp-sec-eye">Bottoms</div>
            <h2>Trousers &amp; Skorts</h2>
          </div>
          <Link href="/products" className="kp-sec-right">View all →</Link>
        </div>

        <div className="kp-brow">
          <div className="kp-bcard" onClick={() => navigate("/products")}>
            <div className="kp-cwrap">
              <div className="kp-cimg"><div className="kp-trouser" /></div>
              <div className="kp-badge">Men's</div>
            </div>
            <div className="kp-binfo">
              <div className="kp-bname">Pro Tour Trouser</div>
              <div className="kp-bsub">Slim tapered · 4-way stretch</div>
              <ul className="kp-feats">
                <li>Velcro glove dock</li>
                <li>3-slot tee holder</li>
                <li>Zippered security pocket</li>
              </ul>
              <Swatches keys={["sw-navy", "sw-charcoal", "sw-ivory", "sw-olive"]} mb={8} />
              <div className="kp-bprice">From ₹ 5,800</div>
            </div>
          </div>

          <div className="kp-bcard" onClick={() => navigate("/products")}>
            <div className="kp-cwrap">
              <div className="kp-cimg"><div className="kp-skort" /></div>
              <div className="kp-badge">Women's</div>
            </div>
            <div className="kp-binfo">
              <div className="kp-bname">Pro Tour Skort</div>
              <div className="kp-bsub">Tailored fit · Technical stretch</div>
              <ul className="kp-feats">
                <li>Inner shorts panel</li>
                <li>Full swing freedom</li>
                <li>Clubhouse-ready finish</li>
              </ul>
              <Swatches keys={["sw-navy", "sw-charcoal", "sw-ivory"]} mb={8} />
              <div className="kp-bprice">From ₹ 4,200</div>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOM SECTION */}
      <div id="custom">
        <div className="kp-cb">
          <div>
            <div className="kp-cbeye">Bespoke &amp; Custom</div>
            <div className="kp-cbh">
              Every detail — yours to design.
              <br />
              One shirt or five hundred.
            </div>
          </div>
          <div className="kp-cbacts">
            <button className="kp-cbcta" onClick={() => navigate("/products/1/customize")}>
              Open the Custom Studio
            </button>
            <button className="kp-cblink" onClick={() => navigate("/products")}>
              Bulk &amp; corporate pricing →
            </button>
          </div>
        </div>

        <div className="kp-cgrid">
          {[
            { n: "01", t: "Colour", tags: ["Pantone match", "Club colours"] },
            { n: "02", t: "Print", tags: ["40+ prints", "Custom artwork"] },
            { n: "03", t: "Fit & Size", tags: ["Athletic", "Classic", "Custom size"] },
            { n: "04", t: "Logo", tags: ["5 placements", "Embroider / print"] },
            { n: "05", t: "Text", tags: ["Name", "Initials", "Club text"] },
            { n: "06", t: "Collar & Trim", tags: ["Contrast collar", "Tipping"] },
          ].map((c) => (
            <div className="kp-cc" key={c.n}>
              <div className="kp-ccn">{c.n}</div>
              <div className="kp-cct">{c.t}</div>
              <div className="kp-cctags">
                {c.tags.map((t) => (
                  <span className="kp-cctag" key={t}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* USE CASES */}
      <div className="kp-sec">
        <div className="kp-sec-left">
          <div className="kp-sec-eye">How Ka.Sha is Worn</div>
          <h2>Made for Every Context on the Course</h2>
        </div>
      </div>

      <div className="kp-uc-grid">
        <div className="kp-uc">
          <div className="kp-ucn">01</div>
          <div className="kp-uct">Tournaments</div>
          <div className="kp-ucb">Consistent kit across the field — tournament name, sponsor logo, player detail. From 12 pieces, Pantone-matched to brief.</div>
          <div className="kp-uctags">
            <span className="kp-uctag">From 12 pieces</span>
            <span className="kp-uctag">Player names</span>
            <span className="kp-uctag">Sponsor logo</span>
          </div>
        </div>
        <div className="kp-uc">
          <div className="kp-ucn">02</div>
          <div className="kp-uct">Golf Academies</div>
          <div className="kp-ucb">Academy crest, student name, cohort year. A uniform students are proud to wear — on the range and at the club. All sizes XS–5XL.</div>
          <div className="kp-uctags">
            <span className="kp-uctag">Academy crest</span>
            <span className="kp-uctag">Student names</span>
            <span className="kp-uctag">All sizes</span>
          </div>
        </div>
        <div className="kp-uc">
          <div className="kp-ucn">03</div>
          <div className="kp-uct">Sponsored Shirts</div>
          <div className="kp-ucb">Logo at five placements, colour-matched to brand guidelines. Corporate sponsors, club partners, brand ambassadors.</div>
          <div className="kp-uctags">
            <span className="kp-uctag">Brand logo</span>
            <span className="kp-uctag">Colour match</span>
            <span className="kp-uctag">5 placements</span>
          </div>
        </div>
        <div className="kp-uc">
          <div className="kp-ucn">04</div>
          <div className="kp-uct">Personal Wardrobe</div>
          <div className="kp-ucb">Your print, your fit, your initials. Single-piece orders handled — every detail from collar trim to interior label.</div>
          <div className="kp-uctags">
            <span className="kp-uctag">1-piece orders</span>
            <span className="kp-uctag">Any print</span>
            <span className="kp-uctag">Your fit</span>
          </div>
        </div>
        <div className="kp-uc wide">
          <div className="kp-ucl">
            <div className="kp-ucn">05</div>
            <div className="kp-uct">Social Golf Clubs</div>
          </div>
          <div>
            <div className="kp-ucb">Shared print, club name on chest, everyone in the same shirt — without anyone settling. From 12 pieces, mixed fits and sizes across the group.</div>
            <div className="kp-uctags">
              <span className="kp-uctag">From 12 pieces</span>
              <span className="kp-uctag">Club name</span>
              <span className="kp-uctag">Mixed sizes</span>
              <span className="kp-uctag">Group identity</span>
            </div>
          </div>
        </div>
      </div>

      <div className="kp-cta">
        <span>Start your order — one shirt or five hundred</span>
        <button onClick={() => navigate("/products/1/customize")}>Open the Custom Studio</button>
      </div>

      {/* FOOTER */}
      <footer className="kp-footer">
        <div className="kp-fcols">
          <div>
            <div className="kp-fbrand">
              Ka<em>.</em>Sha
            </div>
            <div className="kp-ftag">
              Elite craft,<br />worn on the course.<br />Made in India.
            </div>
          </div>
          <div className="kp-fcol">
            <h4>Shop</h4>
            <Link href="/products?gender=men">Men's Range</Link>
            <Link href="/products?gender=women">Women's Range</Link>
            <Link href="/products?gender=kids">Kids' Range</Link>
            <Link href="/products">Trousers</Link>
            <Link href="/products">Women's Skort</Link>
          </div>
          <div className="kp-fcol">
            <h4>Bespoke</h4>
            <Link href="/products/1/customize">Custom Studio</Link>
            <a href="#custom" onClick={(e) => handleAnchor(e, "#custom")}>Tournaments</a>
            <a href="#custom" onClick={(e) => handleAnchor(e, "#custom")}>Academies</a>
            <a href="#custom" onClick={(e) => handleAnchor(e, "#custom")}>Bulk Orders</a>
          </div>
          <div className="kp-fcol">
            <h4>Ka.Sha</h4>
            <Link href="/heritage">Our Story</Link>
            <a href="#">Size Guide</a>
            <a href="#">Shipping &amp; Returns</a>
            <a href="#">Contact</a>
          </div>
        </div>
        <div className="kp-fbot">
          <div className="kp-fcopy">© 2025 Ka.Sha Golfwear</div>
          <div className="kp-fmade">Crafted with precision · India</div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <CartProvider>
      <HomeInner />
    </CartProvider>
  );
}
