import { Layout } from "@/components/layout/Layout";

export default function HeritagePage() {
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <section className="relative h-[60vh] overflow-hidden">
          <img
            src="/images/product-jacket.png"
            alt="KA.SHA Heritage"
            className="w-full h-full object-cover object-center opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90 flex items-end">
            <div className="container mx-auto px-4 pb-16">
              <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-3">Our Story</p>
              <h1 className="font-serif text-5xl md:text-7xl font-medium text-foreground leading-tight">
                Rooted in Heritage,<br />Reaching for the Future
              </h1>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-24 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-16 items-center mb-24">
            <div>
              <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-6">The Philosophy</p>
              <h2 className="font-serif text-3xl md:text-4xl font-medium mb-6 leading-snug">
                Quiet Confidence Rooted in South Asian Heritage
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                KA.SHA was born from a deep reverence for the artisans of the Indian subcontinent — the weavers of 
                Varanasi, the tailors of Lahore, the dyers of Jaipur. Each piece in our collection carries centuries 
                of technique and intention.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We believe luxury is not loudness. It is the hush of silk against skin. The precise weight of hand-loomed 
                khadi. The deliberate irregularities that mark the work of human hands.
              </p>
            </div>
            <div className="relative">
              <img
                src="/images/product-tshirt.png"
                alt="Artisanal craftsmanship"
                className="w-full aspect-square object-cover rounded-sm shadow-lg"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-12 mb-24">
            {[
              {
                num: "01",
                title: "Hand-Loomed Textiles",
                body: "Every fabric begins on a handloom operated by master weavers who have inherited their craft across generations. No machine can replicate the subtle imperfections that make each piece alive.",
              },
              {
                num: "02",
                title: "Natural Dyes",
                body: "Our palettes are drawn from the earth — indigo, turmeric, madder root, and pomegranate rind. These dyes deepen and evolve with time, making your garment a living document.",
              },
              {
                num: "03",
                title: "Bespoke Studio",
                body: "Every KA.SHA garment can be personalized. Our Bespoke Studio allows you to adapt color, silhouette, and detail — producing a piece that is unambiguously yours.",
              },
            ].map((item) => (
              <div key={item.num}>
                <p className="font-serif text-5xl text-primary/20 font-medium mb-4">{item.num}</p>
                <h3 className="font-serif text-xl font-medium mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-16">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="relative order-2 md:order-1">
                <img
                  src="/images/product-trousers.png"
                  alt="Bespoke craftsmanship"
                  className="w-full aspect-square object-cover rounded-sm shadow-lg"
                />
              </div>
              <div className="order-1 md:order-2">
                <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-6">Our Commitment</p>
                <h2 className="font-serif text-3xl md:text-4xl font-medium mb-6 leading-snug">
                  Craft That Outlasts Fashion
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We reject the seasonal churn of fast fashion. KA.SHA collections are designed to be worn for decades, 
                  not discarded after a season. We work with a small, curated network of artisan communities across India, 
                  ensuring fair wages and dignified working conditions.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  When you wear KA.SHA, you wear the story of its maker — and the story of a civilization that has 
                  understood the sacred relationship between human and cloth for five thousand years.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-secondary/30 py-20">
          <div className="container mx-auto px-4 text-center">
            <p className="font-serif italic text-2xl md:text-3xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              "The irregularities in the weave are features, not flaws.<br />They are proof that a human being made this."
            </p>
            <p className="text-sm tracking-widest text-muted-foreground mt-6 uppercase">— KA.SHA Founders</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
