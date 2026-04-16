import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t bg-background pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-1">
            <Link href="/" className="inline-block mb-6">
              <span className="font-serif text-2xl font-bold tracking-widest text-primary">KA.SHA</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Quiet confidence rooted in South Asian heritage. Minimal, editorial, aspirational.
            </p>
          </div>
          
          <div>
            <h3 className="font-serif font-semibold mb-6 tracking-wider">SHOP</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><Link href="/products" className="hover:text-primary transition-colors">New Arrivals</Link></li>
              <li><Link href="/products?category=clothing" className="hover:text-primary transition-colors">Clothing</Link></li>
              <li><Link href="/products?category=accessories" className="hover:text-primary transition-colors">Accessories</Link></li>
              <li><Link href="/products?category=bespoke" className="hover:text-primary transition-colors">Bespoke</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-serif font-semibold mb-6 tracking-wider">ATELIER</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-primary transition-colors">Our Story</Link></li>
              <li><Link href="/craftsmanship" className="hover:text-primary transition-colors">Craftsmanship</Link></li>
              <li><Link href="/sustainability" className="hover:text-primary transition-colors">Sustainability</Link></li>
              <li><Link href="/stores" className="hover:text-primary transition-colors">Boutiques</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-serif font-semibold mb-6 tracking-wider">CLIENT SERVICES</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><Link href="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
              <li><Link href="/shipping" className="hover:text-primary transition-colors">Shipping & Returns</Link></li>
              <li><Link href="/care" className="hover:text-primary transition-colors">Product Care</Link></li>
              <li><Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} KA.SHA. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
