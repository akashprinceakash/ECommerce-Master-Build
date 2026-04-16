import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Show, useUser } from "@clerk/react";

export default function Home() {
  const { user } = useUser();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-secondary/30">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/product-tshirt.png" 
            alt="Hero Background" 
            className="w-full h-full object-cover object-center opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>

        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl mx-auto space-y-8"
          >
            <Show when="signed-in">
              <h2 className="text-sm font-medium tracking-[0.2em] text-primary mb-4">
                WELCOME BACK, {user?.firstName?.toUpperCase() || 'MEMBER'}
              </h2>
            </Show>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-medium leading-tight tracking-tight text-foreground">
              Quiet Confidence. <br/>
              <span className="italic text-muted-foreground/80">South Asian Heritage.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Discover our latest collection of premium menswear, meticulously crafted for the modern gentleman.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/products">
                <Button size="lg" className="h-14 px-8 text-sm tracking-widest rounded-none">
                  EXPLORE COLLECTION
                </Button>
              </Link>
              <Link href="/products?category=bespoke">
                <Button size="lg" variant="outline" className="h-14 px-8 text-sm tracking-widest rounded-none border-primary/20 hover:bg-primary/5">
                  BESPOKE STUDIO
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-16">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-medium mb-4">Curated Selections</h2>
              <p className="text-muted-foreground">Elevate your wardrobe with our signature pieces.</p>
            </div>
            <Link href="/products" className="hidden md:flex items-center gap-2 text-sm font-medium tracking-wider hover:text-primary transition-colors group">
              VIEW ALL <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <CategoryCard 
              title="Tailored Trousers" 
              image="/images/product-trousers.png" 
              href="/products?category=trousers"
            />
            <CategoryCard 
              title="Luxury Essentials" 
              image="/images/product-tshirt.png" 
              href="/products?category=essentials"
            />
            <CategoryCard 
              title="Structured Jackets" 
              image="/images/product-jacket.png" 
              href="/products?category=jackets"
            />
          </div>
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-serif font-medium leading-tight">
              "Every pixel should feel intentional — nothing cheap, nothing filler."
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              KA.SHA represents the intersection of traditional craftsmanship and contemporary minimalism. We believe in the tactile experience of luxury, unhurried and deeply confident.
            </p>
            <div className="pt-8">
              <Link href="/about" className="inline-flex items-center gap-2 text-sm font-medium tracking-wider border-b border-primary pb-1 hover:text-primary transition-colors">
                DISCOVER OUR HERITAGE
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function CategoryCard({ title, image, href }: { title: string, image: string, href: string }) {
  return (
    <Link href={href} className="group cursor-pointer">
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary mb-6">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      <h3 className="text-xl font-serif font-medium group-hover:text-primary transition-colors">{title}</h3>
    </Link>
  );
}
