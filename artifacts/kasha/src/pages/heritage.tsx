import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";

const HERO_IMG = "/images/sindhu_v_roy_show_5_golfers_playing._golf_wear_lifestyle_shot_09bb8fce-9600-42a9-bfa2-6ca663b6a518_1.png";
const SHIRT_IMG = "/images/Woman%27s_prints_tshirt.png";
const TROUSER_IMG = "/images/Men%27s_Bottoms_Trouser.png";

export default function HeritagePage() {
  return (
    <Layout>
      <div className="min-h-screen bg-[#FAFAF7]">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
          <img
            src={HERO_IMG}
            alt="Ka.Sha golfers on the course"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <p className="text-[10px] tracking-[0.4em] text-white/70 uppercase mb-5 font-medium">
              Ka·Sha Golf &amp; Sportswear
            </p>
            <h1 className="font-serif text-5xl md:text-7xl font-medium text-white leading-tight mb-6">
              Our Story
            </h1>
            <p className="text-white/80 text-sm md:text-base tracking-wide max-w-md font-light">
              Made by a golfer. Backed by generations in textiles.
            </p>
          </div>
        </section>

        {/* ── Founder Story ─────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-15 text-center">
          <p className="text-[10px] tracking-[0.4em] text-[#B8925A] uppercase mb-6 font-medium">
            The Beginning
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-medium text-gray-900 leading-snug mb-10">
            Made by a golfer.<br />Backed by generations in textiles.
          </h2>
          <div className="space-y-3 text-gray-600 text-[15px] leading-relaxed text-left md:text-center">
            <p>
              Ka.Sha was born of one man's passion for golf. After 30 years on the course,
              our founder Pranay Somaia knew exactly what golf wear needed to be — easy to move in,
              crafted to let you focus on your game, and of course, stylish.
            </p>
            <p>
              Add to this a family legacy in textiles across India and Africa, and the result is gear
              built for players who care just as much about how they play as how they look doing it.
            </p>
          </div>
        </section>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="max-w-[120px] mx-auto border-t border-[#B8925A]/40" />

        {/* ── The Golf Shirt ────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Image */}
            <div className="relative overflow-hidden aspect-[3/4] bg-[#F0EDE8]">
              {SHIRT_IMG && (
                <img
                  src={SHIRT_IMG}
                  alt="Ka.Sha Golf Shirt"
                  className="w-full h-full object-cover object-center"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            {/* Copy */}
            <div>
              <p className="text-[10px] tracking-[0.4em] text-[#B8925A] uppercase mb-4 font-medium">
                The Garment
              </p>
              <h2 className="font-serif text-4xl md:text-5xl font-medium text-gray-900 leading-tight mb-6">
                The Golf T-Shirt
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-10">
                The finesse is in the detail. Breathable, OEKO-TEX certified stretch fabric that
                moves with you — without compromise on the styling.
              </p>

              <div className="space-y-8">
                <div className="flex gap-5">
                  <span className="font-serif text-3xl text-[#B8925A]/30 font-medium leading-none mt-1 shrink-0">01</span>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2 tracking-wide text-sm uppercase">Built for the Swing</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      The shoulder line is cut specifically for the address position, so it never fights your movement.
                    </p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <span className="font-serif text-3xl text-[#B8925A]/30 font-medium leading-none mt-1 shrink-0">02</span>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2 tracking-wide text-sm uppercase">Zero Distractions</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      A stay-flat button-down collar requires no fussing.
                    </p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <span className="font-serif text-3xl text-[#B8925A]/30 font-medium leading-none mt-1 shrink-0">03</span>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2 tracking-wide text-sm uppercase">Make it Yours</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Fully customizable prints, fits, logos, and initials.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <Link
                  href="/products?gender=men&type=tshirts"
                  className="inline-block border border-[#B8925A] text-[#B8925A] text-[11px] tracking-[0.25em] uppercase px-8 py-3 hover:bg-[#B8925A] hover:text-white transition-colors duration-300"
                >
                  Shop T-Shirts
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── The Golf Trouser ──────────────────────────────────────────── */}
        <section className="bg-[#F5F2EE] py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">

              {/* Copy */}
              <div className="order-2 md:order-1">
                <p className="text-[10px] tracking-[0.4em] text-[#B8925A] uppercase mb-4 font-medium">
                  The Garment
                </p>
                <h2 className="font-serif text-4xl md:text-5xl font-medium text-gray-900 leading-tight mb-6">
                  The Golf Trouser
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-10">
                  Touches only a golfer would think of. Lightweight, crease-resistant Sorona stretch
                  fabric that holds a sharp silhouette for 18 holes — packed with player-first details.
                </p>

                <div className="space-y-8">
                  <div className="flex gap-5">
                    <span className="font-serif text-3xl text-[#B8925A]/30 font-medium leading-none mt-1 shrink-0">01</span>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2 tracking-wide text-sm uppercase">Glove Docks</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        Four discreet velcro patches to secure your glove between shots.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <span className="font-serif text-3xl text-[#B8925A]/30 font-medium leading-none mt-1 shrink-0">02</span>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2 tracking-wide text-sm uppercase">Smart Tee Holder</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        Angled on the thigh so tees are easy to grab and won't poke.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <span className="font-serif text-3xl text-[#B8925A]/30 font-medium leading-none mt-1 shrink-0">03</span>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2 tracking-wide text-sm uppercase">Strategic Zips</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        Two below-the-knee pockets for scorecards or glasses.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <span className="font-serif text-3xl text-[#B8925A]/30 font-medium leading-none mt-1 shrink-0">04</span>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2 tracking-wide text-sm uppercase">Grip Strip</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        An inner waistband strip keeps your shirt perfectly tucked through every drive.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <span className="font-serif text-3xl text-[#B8925A]/30 font-medium leading-none mt-1 shrink-0">05</span>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2 tracking-wide text-sm uppercase">Customizable</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        Need something specific? We tailor exactly to your specs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-12">
                  <Link
                    href="/products?gender=men&type=bottoms"
                    className="inline-block border border-[#B8925A] text-[#B8925A] text-[11px] tracking-[0.25em] uppercase px-8 py-3 hover:bg-[#B8925A] hover:text-white transition-colors duration-300"
                  >
                    Shop Bottoms
                  </Link>
                </div>
              </div>

              {/* Image */}
              <div className="order-1 md:order-2 relative overflow-hidden aspect-[3/4] bg-[#EDE9E4]">
                {TROUSER_IMG && (
                  <img
                    src={TROUSER_IMG}
                    alt="Ka.Sha Golf Trousers"
                    className="w-full h-full object-cover object-center"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Closing Quote ─────────────────────────────────────────────── */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-serif italic text-2xl md:text-3xl text-gray-700 leading-relaxed mb-8">
              "Gear built for players who care just as much about how they play<br className="hidden md:block" /> as how they look doing it."
            </p>
            <p className="text-[10px] tracking-[0.4em] text-[#B8925A] uppercase font-medium">
              — Pranay Somaia, Founder
            </p>
          </div>
        </section>

        {/* ── CTA Banner ────────────────────────────────────────────────── */}
        <section className="bg-gray-900 py-20 px-6 text-center">
          <p className="text-[10px] tracking-[0.4em] text-[#B8925A] uppercase mb-5 font-medium">
            Ready to Play?
          </p>
          <h3 className="font-serif text-3xl md:text-4xl font-medium text-white mb-8">
            Explore the Collection
          </h3>
          <Link
            href="/products"
            className="inline-block bg-[#B8925A] text-white text-[11px] tracking-[0.25em] uppercase px-10 py-4 hover:bg-[#A07840] transition-colors duration-300"
          >
            Shop Now
          </Link>
        </section>

      </div>
    </Layout>
  );
}
