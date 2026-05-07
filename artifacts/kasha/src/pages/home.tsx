import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { formatPrice } from "@/lib/format";

const POLO_IMAGES = [
  "/images/golf/polo-pink-black.jpeg",
  "/images/golf/polo-green-black.jpeg",
  "/images/golf/polo-pink-curve.jpeg",
  "/images/golf/polo-beige-brown.png",
];

const FALLBACK_BADGES = ["Bestseller", "", "", "New", "", "", "Women's", "Kids'"];

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

function Swatches({ keys }: { keys: string[] }) {
  return (
    <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
      {keys.map((k, i) => (
        <div
          key={i}
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

export default function Home() {
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

  // Auto-advance hero
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

  const slides = [
    {
      cls: "s1",
      eye: "New Season · Golf Collection",
      head: (
        <>
          Dressed for the<br />clubhouse. Built<br />for every birdie.
        </>
      ),
      sub: "Technical golfwear · Men · Women · Kids",
      btn: "Shop the Collection",
      btnHref: "#shop",
    },
    {
      cls: "s2",
      eye: "Ready to Wear · 8 Patterns",
      head: (
        <>
          Solids. Stripes.<br />Argyle. Checks.<br />Your course, your style.
        </>
      ),
      sub: "Off-the-shelf · Ships in 5 days",
      btn: "Shop T-Shirts",
      btnHref: "#shop",
    },
    {
      cls: "s3",
      eye: "Bespoke Studio",
      head: (
        <>
          Your colour.<br />Your logo.<br />Your shirt.
        </>
      ),
      badge: "Colour · Print · Fit · Logo · Text · Trim",
      btn: "Open the Custom Studio",
      btnHref: "#custom",
    },
    {
      cls: "s4",
      eye: "Tournaments · Academies · Clubs",
      head: (
        <>
          One shirt.<br />Five hundred.<br />Delivered on brief.
        </>
      ),
      sub: "Bulk from 12 pieces · Pantone-matched",
      btn: "Get a Quote",
      btnHref: "#custom",
    },
  ];

  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Layout>
      <style>{`
        .kasha-html { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background:#f5f3ef; color:#1a1a1a; }
        .kasha-html *, .kasha-html *::before, .kasha-html *::after { box-sizing: border-box; }

        /* Hero */
        .kh-hero { position: relative; height: calc(100vh - 84px); min-height: 580px; overflow: hidden; }
        .kh-slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1.2s ease; display:flex; align-items:flex-end; }
        .kh-slide.active { opacity: 1; }
        .kh-slide::after { content:''; position:absolute; inset:0; background: linear-gradient(to bottom, transparent 28%, rgba(8,10,18,0.72) 100%); }
        .kh-s1 { background: linear-gradient(155deg,#1a2535 0%,#2d3f52 45%,#8aaab8 100%); }
        .kh-s2 { background: linear-gradient(148deg,#1c2d20 0%,#304838 48%,#6a9878 100%); }
        .kh-s3 { background: linear-gradient(152deg,#2c1f12 0%,#4a3522 48%,#b09060 100%); }
        .kh-s4 { background: linear-gradient(150deg,#1e1a2c 0%,#2e2848 48%,#8070b0 100%); }
        .kh-slide-content { position:relative; z-index:2; padding: 0 64px 72px; }
        .kh-eye { font-size:9px; letter-spacing:0.36em; color:#B8925A; text-transform:uppercase; margin-bottom:14px; opacity:0; transform:translateY(12px); transition:opacity .7s ease .3s, transform .7s ease .3s; }
        .kh-slide.active .kh-eye { opacity:1; transform:translateY(0); }
        .kh-head { font-size: clamp(38px,5.5vw,66px); font-weight:200; letter-spacing:.04em; color:#fff; line-height:1.12; margin-bottom:16px; opacity:0; transform:translateY(18px); transition: opacity .85s ease .5s, transform .85s ease .5s; }
        .kh-slide.active .kh-head { opacity:1; transform:translateY(0); }
        .kh-sub { font-size:11px; letter-spacing:.18em; color:rgba(255,255,255,.48); text-transform:uppercase; margin-bottom:34px; opacity:0; transform:translateY(10px); transition:opacity .7s ease .7s, transform .7s ease .7s; }
        .kh-slide.active .kh-sub { opacity:1; transform:translateY(0); }
        .kh-btn { display:inline-block; font-size:9px; letter-spacing:.26em; color:#0f1622; background:#B8925A; padding:13px 28px; text-transform:uppercase; text-decoration:none; opacity:0; transform:translateY(8px); transition:opacity .65s ease .9s, transform .65s ease .9s, background .2s; cursor:pointer; }
        .kh-slide.active .kh-btn { opacity:1; transform:translateY(0); }
        .kh-btn:hover { background:#ca9f64; }
        .kh-cbadge { display:inline-flex; align-items:center; gap:8px; margin-bottom:20px; font-size:9px; letter-spacing:.26em; color:rgba(255,255,255,.6); text-transform:uppercase; opacity:0; transform:translateY(10px); transition:opacity .7s ease .7s, transform .7s ease .7s; }
        .kh-slide.active .kh-cbadge { opacity:1; transform:translateY(0); }
        .kh-cbadge::before { content:''; width:20px; height:1px; background:#B8925A; }
        .kh-dots { position:absolute; bottom:28px; right:64px; z-index:10; display:flex; gap:8px; align-items:center; }
        .kh-dot { width:5px; height:5px; background:rgba(255,255,255,.3); cursor:pointer; transition:all .3s; }
        .kh-dot.active { width:22px; background:#B8925A; }
        .kh-bar { position:absolute; bottom:0; left:0; height:1.5px; background:#B8925A; width:0%; z-index:10; animation: kh-bar 5.2s linear forwards; }
        @keyframes kh-bar { from { width:0%; } to { width:100%; } }

        /* Section Divider */
        .kh-sechead { padding: 52px 48px 28px; display:flex; align-items:baseline; justify-content:space-between; border-bottom: .5px solid #c8c4bc; background:#f5f3ef; }
        .kh-sechead .eye { font-size:9px; letter-spacing:.32em; color:#B8925A; text-transform:uppercase; margin-bottom:8px; }
        .kh-sechead h2 { font-size:20px; font-weight:200; letter-spacing:.14em; color:#0f1622; text-transform:uppercase; }
        .kh-sechead a { font-size:9.5px; letter-spacing:.18em; color:#888; text-transform:uppercase; text-decoration:none; border-bottom:.5px solid #c8c4bc; padding-bottom:2px; white-space:nowrap; transition:color .2s, border-color .2s; }
        .kh-sechead a:hover { color:#B8925A; border-color:#B8925A; }

        /* Shirt grid */
        .kh-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:1px; background:#c8c4bc; }
        .kh-card { background:#f5f3ef; cursor:pointer; position:relative; }
        .kh-card:hover .kh-cimg { transform: scale(1.04); }
        .kh-card:hover .kh-hover { opacity: 1; }
        .kh-cwrap { aspect-ratio: 3/4; overflow:hidden; position:relative; background:#eceae4; }
        .kh-cimg { width:100%; height:100%; display:flex; align-items:center; justify-content:center; transition: transform .55s ease; position:relative; }
        .kh-cimg img { width:100%; height:100%; object-fit:cover; object-position:center; }
        .kh-badge { position:absolute; top:12px; left:12px; font-size:7.5px; letter-spacing:.2em; color:#fff; background:#B8925A; padding:3px 9px; text-transform:uppercase; z-index:2; }
        .kh-hover { position:absolute; bottom:0; left:0; right:0; background:#0f1622; color:#fff; text-align:center; font-size:8.5px; letter-spacing:.22em; text-transform:uppercase; padding:11px; opacity:0; transition: opacity .22s; z-index:2; }
        .kh-cinfo { padding:14px 16px 18px; background:#fff; }
        .kh-cname { font-size:10.5px; font-weight:400; letter-spacing:.14em; color:#0f1622; text-transform:uppercase; margin-bottom:6px; }
        .kh-cprice { font-size:10px; letter-spacing:.1em; color:#555; font-weight:300; }

        /* Bottoms */
        .kh-brow { display:grid; grid-template-columns: 1fr 1fr; gap:1px; background:#c8c4bc; margin-top:1px; }
        .kh-brow .kh-bcard { background:#fff; display:grid; grid-template-columns: 200px 1fr; cursor:pointer; }
        .kh-brow .kh-bcard:hover .kh-cimg { transform: scale(1.03); }
        .kh-brow .kh-bcard .kh-cwrap { aspect-ratio: auto; min-height: 220px; }
        .kh-binfo { padding:24px; display:flex; flex-direction:column; justify-content:center; }
        .kh-bname { font-size:11px; font-weight:400; letter-spacing:.14em; color:#0f1622; text-transform:uppercase; margin-bottom:4px; }
        .kh-bsub { font-size:10px; letter-spacing:.06em; color:#888; margin-bottom:10px; }
        .kh-feats { list-style:none; margin-bottom:12px; padding:0; }
        .kh-feats li { font-size:9.5px; letter-spacing:.1em; color:#888; text-transform:uppercase; padding:4px 0; border-bottom:.5px solid #eee; display:flex; align-items:center; gap:9px; }
        .kh-feats li::before { content:''; width:12px; height:1px; background:#B8925A; flex-shrink:0; }
        .kh-bprice { font-size:10px; letter-spacing:.1em; color:#555; }
        .kh-trouser { background: linear-gradient(160deg,#1a2540,#263050); width:100%; height:100%; }
        .kh-skort { background: linear-gradient(155deg,#2a1e2e,#4a3258); width:100%; height:100%; }

        /* Custom banner */
        .kh-cb { background:#0f1622; border-left:3px solid #B8925A; padding:48px 64px; display:flex; align-items:center; justify-content:space-between; gap:48px; }
        .kh-cbeye { font-size:9px; letter-spacing:.32em; color:#B8925A; text-transform:uppercase; margin-bottom:12px; }
        .kh-cbh { font-size:24px; font-weight:200; letter-spacing:.1em; color:#fff; line-height:1.38; }
        .kh-cbacts { display:flex; flex-direction:column; align-items:flex-start; gap:10px; flex-shrink:0; }
        .kh-cbcta { font-size:9px; letter-spacing:.26em; color:#0f1622; background:#B8925A; padding:13px 28px; text-transform:uppercase; border:none; cursor:pointer; white-space:nowrap; transition:background .2s; }
        .kh-cbcta:hover { background:#ca9f64; }
        .kh-cblink { font-size:9px; letter-spacing:.18em; color:rgba(255,255,255,.38); text-transform:uppercase; cursor:pointer; background:none; border:none; border-bottom:.5px solid rgba(255,255,255,.2); padding:0 0 2px; transition:color .2s; }
        .kh-cblink:hover { color:rgba(255,255,255,.7); }
        .kh-cgrid { display:grid; grid-template-columns: repeat(6, 1fr); gap:1px; background:#c8c4bc; }
        .kh-cc { background:#fff; padding:24px 20px 22px; }
        .kh-ccn { font-size:8px; letter-spacing:.28em; color:#B8925A; text-transform:uppercase; margin-bottom:8px; }
        .kh-cct { font-size:10.5px; font-weight:500; letter-spacing:.14em; color:#0f1622; text-transform:uppercase; margin-bottom:8px; }
        .kh-cctags { display:flex; flex-wrap:wrap; gap:3px; }
        .kh-cctag { font-size:7.5px; letter-spacing:.1em; color:#666; background:#f0ede7; padding:2px 7px; text-transform:uppercase; }

        /* Use cases */
        .kh-uc-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap:1px; background:#c8c4bc; }
        .kh-uc { background:#fff; padding:28px 26px; }
        .kh-ucn { font-size:8px; letter-spacing:.3em; color:#B8925A; text-transform:uppercase; margin-bottom:10px; }
        .kh-uct { font-size:12px; font-weight:500; letter-spacing:.12em; color:#0f1622; text-transform:uppercase; margin-bottom:8px; }
        .kh-ucb { font-size:12.5px; line-height:1.72; color:#666; margin-bottom:12px; }
        .kh-uc-tags { display:flex; flex-wrap:wrap; gap:4px; }
        .kh-uc-tag { font-size:8px; letter-spacing:.1em; color:#0f1622; background:#f0ede7; padding:2px 9px; text-transform:uppercase; }
        .kh-uc.wide { grid-column: 1 / -1; display:grid; grid-template-columns: 1fr 2fr; gap:28px; align-items:center; }
        .kh-uc.wide .kh-ucl { border-right: .5px solid #e8e4de; padding-right:28px; }

        /* CTA strip */
        .kh-cta { background:#0f1622; padding:26px 48px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
        .kh-cta span { font-size:12px; font-weight:200; letter-spacing:.16em; color:#fff; text-transform:uppercase; }
        .kh-cta button { font-size:9px; letter-spacing:.24em; color:#0f1622; background:#B8925A; padding:11px 24px; text-transform:uppercase; border:none; cursor:pointer; white-space:nowrap; transition:background .2s; }
        .kh-cta button:hover { background:#ca9f64; }

        /* Quick category strip just under hero */
        .kh-catstrip { display:grid; grid-template-columns: repeat(3, 1fr); gap:1px; background:#c8c4bc; border-bottom:.5px solid #c8c4bc; }
        .kh-catstrip a { background:#0f1622; color:#fff; text-align:center; padding:22px 16px; text-decoration:none; font-size:11px; letter-spacing:.32em; text-transform:uppercase; transition:background .2s, color .2s; }
        .kh-catstrip a:hover { background:#B8925A; color:#0f1622; }

        @media (max-width: 1000px) {
          .kh-grid { grid-template-columns: repeat(2, 1fr); }
          .kh-cgrid { grid-template-columns: repeat(3, 1fr); }
          .kh-brow { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .kh-sechead, .kh-cta { padding-left:20px; padding-right:20px; }
          .kh-slide-content { padding: 0 24px 52px; }
          .kh-head { font-size:32px; }
          .kh-uc-grid { grid-template-columns: 1fr; }
          .kh-uc.wide { grid-template-columns: 1fr; }
          .kh-uc.wide .kh-ucl { border-right:none; border-bottom:.5px solid #e8e4de; padding-right:0; padding-bottom:18px; }
          .kh-cb { flex-direction:column; padding:32px 24px; gap:24px; }
          .kh-cgrid { grid-template-columns: repeat(2, 1fr); }
          .kh-catstrip { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="kasha-html">
        {/* HERO CAROUSEL */}
        <section id="hero" className="kh-hero">
          {slides.map((s, i) => (
            <div key={i} className={`kh-slide kh-${s.cls} ${i === cur ? "active" : ""}`}>
              <div className="kh-slide-content">
                <div className="kh-eye">{s.eye}</div>
                <div className="kh-head">{s.head}</div>
                {s.sub && <div className="kh-sub">{s.sub}</div>}
                {s.badge && <div className="kh-cbadge">{s.badge}</div>}
                <a
                  href={s.btnHref}
                  className="kh-btn"
                  onClick={(e) => handleAnchor(e, s.btnHref)}
                >
                  {s.btn}
                </a>
              </div>
            </div>
          ))}
          <div className="kh-dots">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`kh-dot ${i === cur ? "active" : ""}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <div key={`bar-${barKey}-${cur}`} className="kh-bar" />
        </section>

        {/* Quick category strip — Men / Women / Kids */}
        <div className="kh-catstrip">
          <Link href="/products?gender=men">Shop Men</Link>
          <Link href="/products?gender=women">Shop Women</Link>
          <Link href="/products?gender=kids">Shop Kids</Link>
        </div>

        {/* T-SHIRT GRID */}
        <div id="shop">
          <div className="kh-sechead">
            <div>
              <div className="eye">Ready to Wear</div>
              <h2>Golf T-Shirts</h2>
            </div>
            <Link href="/products" className="">View all →</Link>
          </div>

          <div className="kh-grid">
            {(golfShirts.length > 0 ? golfShirts : Array.from({ length: 8 })).map((p: any, idx) => {
              const img = POLO_IMAGES[idx % POLO_IMAGES.length];
              const badge = FALLBACK_BADGES[idx % FALLBACK_BADGES.length];
              const swatches = FALLBACK_SWATCHES[idx % FALLBACK_SWATCHES.length];
              const productId = p?.id;
              const name = p?.name || "Golf Polo";
              const price = p ? formatPrice(p.priceInPaise) : "From ₹ 3,200";

              const cardInner = (
                <>
                  <div className="kh-cwrap">
                    <div className="kh-cimg">
                      <img src={img} alt={name} />
                    </div>
                    {badge && <div className="kh-badge">{badge}</div>}
                    <div className="kh-hover">Quick View</div>
                  </div>
                  <div className="kh-cinfo">
                    <div className="kh-cname">{name}</div>
                    <Swatches keys={swatches} />
                    <div className="kh-cprice">{price}</div>
                  </div>
                </>
              );

              return productId ? (
                <Link key={p.id} href={`/products/${productId}`} className="kh-card">
                  {cardInner}
                </Link>
              ) : (
                <div
                  key={`fb-${idx}`}
                  className="kh-card"
                  onClick={() => navigate("/products")}
                >
                  {cardInner}
                </div>
              );
            })}
          </div>

          {/* Bottoms */}
          <div className="kh-sechead" style={{ paddingTop: 40 }}>
            <div>
              <div className="eye">Bottoms</div>
              <h2>Trousers &amp; Skorts</h2>
            </div>
            <Link href="/products" className="">View all →</Link>
          </div>

          <div className="kh-brow">
            <div className="kh-bcard" onClick={() => navigate("/products")}>
              <div className="kh-cwrap">
                <div className="kh-trouser" />
                <div className="kh-badge">Men's</div>
              </div>
              <div className="kh-binfo">
                <div className="kh-bname">Pro Tour Trouser</div>
                <div className="kh-bsub">Slim tapered · 4-way stretch</div>
                <ul className="kh-feats">
                  <li>Velcro glove dock</li>
                  <li>3-slot tee holder</li>
                  <li>Zippered security pocket</li>
                </ul>
                <Swatches keys={["sw-navy", "sw-charcoal", "sw-ivory", "sw-olive"]} />
                <div className="kh-bprice">From ₹ 5,800</div>
              </div>
            </div>

            <div className="kh-bcard" onClick={() => navigate("/products")}>
              <div className="kh-cwrap">
                <div className="kh-skort" />
                <div className="kh-badge">Women's</div>
              </div>
              <div className="kh-binfo">
                <div className="kh-bname">Pro Tour Skort</div>
                <div className="kh-bsub">Tailored fit · Technical stretch</div>
                <ul className="kh-feats">
                  <li>Inner shorts panel</li>
                  <li>Full swing freedom</li>
                  <li>Clubhouse-ready finish</li>
                </ul>
                <Swatches keys={["sw-navy", "sw-charcoal", "sw-ivory"]} />
                <div className="kh-bprice">From ₹ 4,200</div>
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOM SECTION */}
        <div id="custom">
          <div className="kh-cb">
            <div>
              <div className="kh-cbeye">Bespoke &amp; Custom</div>
              <div className="kh-cbh">
                Every detail — yours to design.
                <br />
                One shirt or five hundred.
              </div>
            </div>
            <div className="kh-cbacts">
              <button
                className="kh-cbcta"
                onClick={() => navigate("/products/1/customize")}
              >
                Open the Custom Studio
              </button>
              <button className="kh-cblink" onClick={() => navigate("/products")}>
                Bulk &amp; corporate pricing →
              </button>
            </div>
          </div>

          <div className="kh-cgrid">
            {[
              { n: "01", t: "Colour", tags: ["Pantone match", "Club colours"] },
              { n: "02", t: "Print", tags: ["40+ prints", "Custom artwork"] },
              { n: "03", t: "Fit & Size", tags: ["Athletic", "Classic", "Custom size"] },
              { n: "04", t: "Logo", tags: ["5 placements", "Embroider / print"] },
              { n: "05", t: "Text", tags: ["Name", "Initials", "Club text"] },
              { n: "06", t: "Collar & Trim", tags: ["Contrast collar", "Tipping"] },
            ].map((c) => (
              <div className="kh-cc" key={c.n}>
                <div className="kh-ccn">{c.n}</div>
                <div className="kh-cct">{c.t}</div>
                <div className="kh-cctags">
                  {c.tags.map((t) => (
                    <span className="kh-cctag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* USE CASES */}
        <div className="kh-sechead">
          <div>
            <div className="eye">How Ka.Sha is Worn</div>
            <h2>Made for Every Context on the Course</h2>
          </div>
        </div>

        <div className="kh-uc-grid">
          <div className="kh-uc">
            <div className="kh-ucn">01</div>
            <div className="kh-uct">Tournaments</div>
            <div className="kh-ucb">
              Consistent kit across the field — tournament name, sponsor logo, player detail. From 12 pieces, Pantone-matched to brief.
            </div>
            <div className="kh-uc-tags">
              <span className="kh-uc-tag">From 12 pieces</span>
              <span className="kh-uc-tag">Player names</span>
              <span className="kh-uc-tag">Sponsor logo</span>
            </div>
          </div>
          <div className="kh-uc">
            <div className="kh-ucn">02</div>
            <div className="kh-uct">Golf Academies</div>
            <div className="kh-ucb">
              Academy crest, student name, cohort year. A uniform students are proud to wear — on the range and at the club. All sizes XS–5XL.
            </div>
            <div className="kh-uc-tags">
              <span className="kh-uc-tag">Academy crest</span>
              <span className="kh-uc-tag">Student names</span>
              <span className="kh-uc-tag">All sizes</span>
            </div>
          </div>
          <div className="kh-uc">
            <div className="kh-ucn">03</div>
            <div className="kh-uct">Sponsored Shirts</div>
            <div className="kh-ucb">
              Logo at five placements, colour-matched to brand guidelines. Corporate sponsors, club partners, brand ambassadors.
            </div>
            <div className="kh-uc-tags">
              <span className="kh-uc-tag">Brand logo</span>
              <span className="kh-uc-tag">Colour match</span>
              <span className="kh-uc-tag">5 placements</span>
            </div>
          </div>
          <div className="kh-uc">
            <div className="kh-ucn">04</div>
            <div className="kh-uct">Personal Wardrobe</div>
            <div className="kh-ucb">
              Your print, your fit, your initials. Single-piece orders handled — every detail from collar trim to interior label.
            </div>
            <div className="kh-uc-tags">
              <span className="kh-uc-tag">1-piece orders</span>
              <span className="kh-uc-tag">Any print</span>
              <span className="kh-uc-tag">Your fit</span>
            </div>
          </div>
          <div className="kh-uc wide">
            <div className="kh-ucl">
              <div className="kh-ucn">05</div>
              <div className="kh-uct">Social Golf Clubs</div>
            </div>
            <div>
              <div className="kh-ucb">
                Shared print, club name on chest, everyone in the same shirt — without anyone settling. From 12 pieces, mixed fits and sizes across the group.
              </div>
              <div className="kh-uc-tags">
                <span className="kh-uc-tag">From 12 pieces</span>
                <span className="kh-uc-tag">Club name</span>
                <span className="kh-uc-tag">Mixed sizes</span>
                <span className="kh-uc-tag">Group identity</span>
              </div>
            </div>
          </div>
        </div>

        <div className="kh-cta">
          <span>Start your order — one shirt or five hundred</span>
          <button onClick={() => navigate("/products/1/customize")}>
            Open the Custom Studio
          </button>
        </div>
      </div>
    </Layout>
  );
}
