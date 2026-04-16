import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { 
  useGetProduct, 
  getGetProductQueryKey,
  useCreateCustomization,
  useGetLatestCustomizationForProduct,
  getGetLatestCustomizationForProductQueryKey,
  useAddToCart
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { ProductViewer } from "@/components/3d/ProductViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Loader2, Save, ShoppingBag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "@/lib/format";
import { Show } from "@clerk/react";

const PRESET_COLORS = [
  { name: "Ivory", hex: "#F5F0EB" },
  { name: "Black", hex: "#1A1A1A" },
  { name: "Navy", hex: "#1D2B45" },
  { name: "Burgundy", hex: "#5C2028" },
  { name: "Olive", hex: "#4A5240" },
  { name: "Beige", hex: "#D4C5B9" },
  { name: "Slate", hex: "#708090" },
  { name: "Forest", hex: "#228B22" }
];

const SIZES = ["S", "M", "L", "XL"];

export default function CustomizePage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState("M");
  const [designName, setDesignName] = useState("");
  const [parts, setParts] = useState({
    collar: true,
    leftSleeve: true,
    rightSleeve: true
  });

  const { data: product, isLoading: isLoadingProduct } = useGetProduct(id, { 
    query: { 
      enabled: !!id,
      queryKey: getGetProductQueryKey(id)
    } 
  });

  const { data: latestCustomization } = useGetLatestCustomizationForProduct(id, {
    query: {
      enabled: !!id,
      queryKey: getGetLatestCustomizationForProductQueryKey(id)
    }
  });

  useEffect(() => {
    if (product && !latestCustomization) {
      setColor(product.defaultColor || "#ffffff");
    }
  }, [product, latestCustomization]);

  useEffect(() => {
    if (latestCustomization) {
      setColor(latestCustomization.color);
      setSize(latestCustomization.size);
      setDesignName(latestCustomization.name);
      setParts(latestCustomization.partsEnabled as Record<string, boolean> || {
        collar: true,
        leftSleeve: true,
        rightSleeve: true
      });
    }
  }, [latestCustomization]);

  const createCustomization = useCreateCustomization();
  const addToCart = useAddToCart();

  const handleSaveDesign = async () => {
    if (!designName.trim()) {
      toast({
        title: "Design Name Required",
        description: "Please enter a name for your design before saving.",
        variant: "destructive"
      });
      return;
    }

    try {
      await createCustomization.mutateAsync({
        data: {
          productId: id,
          name: designName,
          color,
          size,
          partsEnabled: parts,
          canvasData: null,
          previewImageUrl: null
        }
      });
      
      toast({
        title: "Design Saved",
        description: "Your bespoke design has been saved to your profile.",
      });
      
      queryClient.invalidateQueries({ queryKey: getGetLatestCustomizationForProductQueryKey(id) });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to save design. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAddToCart = async () => {
    try {
      let customizationId = latestCustomization?.id;
      
      // If we don't have a saved customization or it's different from current state, create one
      if (!customizationId || 
          latestCustomization?.color !== color || 
          latestCustomization?.size !== size ||
          JSON.stringify(latestCustomization?.partsEnabled) !== JSON.stringify(parts)) {
        
        const newCust = await createCustomization.mutateAsync({
          data: {
            productId: id,
            name: designName || `${product?.name} - Custom`,
            color,
            size,
            partsEnabled: parts,
            canvasData: null,
            previewImageUrl: null
          }
        });
        customizationId = newCust.id;
      }

      await addToCart.mutateAsync({
        data: {
          productId: id,
          customizationId,
          quantity: 1,
          size
        }
      });
      
      toast({
        title: "Added to Cart",
        description: "Your customized item has been added to your bag.",
      });
      
      setLocation("/cart");
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to add to cart. Please sign in or try again.",
        variant: "destructive"
      });
    }
  };

  if (isLoadingProduct) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Studio Header */}
      <header className="h-16 border-b flex items-center justify-between px-4 lg:px-8 bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href={`/products/${id}`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif font-medium text-lg hidden sm:block">Bespoke Studio: {product.name}</h1>
            <p className="text-xs text-muted-foreground">{formatPrice(product.priceInPaise)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Input 
            value={designName} 
            onChange={(e) => setDesignName(e.target.value)} 
            placeholder="Name your design..."
            className="hidden md:block w-48 bg-transparent border-t-0 border-l-0 border-r-0 border-b border-border/50 rounded-none focus-visible:ring-0 focus-visible:border-primary px-0 h-8 text-sm"
          />
          <Show when="signed-out">
            <Link href="/sign-in">
              <Button variant="outline" className="text-xs tracking-wider rounded-none">Sign In to Save</Button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Button 
              variant="outline" 
              onClick={handleSaveDesign} 
              disabled={createCustomization.isPending}
              className="text-xs tracking-wider rounded-none flex items-center gap-2"
            >
              {createCustomization.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              <span className="hidden sm:inline">Save</span>
            </Button>
          </Show>
          <Button 
            onClick={handleAddToCart}
            disabled={addToCart.isPending}
            className="text-xs tracking-wider rounded-none flex items-center gap-2"
          >
            {addToCart.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingBag className="w-3 h-3" />}
            Add to Cart
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-64px)]">
        {/* 3D Canvas (Left) */}
        <div className="flex-1 lg:w-[60%] relative bg-secondary/20 min-h-[50vh] lg:min-h-full">
          <ProductViewer color={color} partsEnabled={parts} thumbnailUrl={product?.thumbnailUrl} />
          
          <div className="absolute bottom-4 left-4 text-xs font-mono text-muted-foreground flex gap-4 bg-background/80 backdrop-blur-sm p-2">
            <span>DRAG to rotate</span>
            <span>SCROLL to zoom</span>
          </div>
        </div>

        {/* Controls Panel (Right) */}
        <div className="w-full lg:w-[40%] bg-background border-l overflow-y-auto">
          <div className="p-6 lg:p-10 space-y-12">
            
            {/* Color Selection */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl font-medium tracking-wide">Color</h3>
                <span className="text-xs text-muted-foreground uppercase">{PRESET_COLORS.find(c => c.hex.toLowerCase() === color.toLowerCase())?.name || 'Custom'}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-4 gap-4">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setColor(preset.hex)}
                    className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center ${
                      color.toLowerCase() === preset.hex.toLowerCase() 
                        ? 'border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background' 
                        : 'border-border/50 hover:border-primary/50'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={preset.name}
                  >
                    {color.toLowerCase() === preset.hex.toLowerCase() && (
                      <Check className={`w-5 h-5 ${['#f5f0eb', '#ffffff'].includes(preset.hex.toLowerCase()) ? 'text-black' : 'text-white'}`} />
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4">
                <Label htmlFor="customColor" className="text-sm text-muted-foreground">Custom Hex</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="customColor"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 p-1 rounded-none border-border/50"
                  />
                  <Input 
                    type="text" 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)}
                    className="w-24 font-mono text-sm uppercase rounded-none border-border/50 focus-visible:ring-primary"
                  />
                </div>
              </div>
            </section>

            {/* Structure / Parts */}
            <section>
              <h3 className="font-serif text-xl font-medium tracking-wide mb-6">Structure</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="collar" className="text-base font-medium">Collar</Label>
                    <p className="text-xs text-muted-foreground">Standard pointed collar</p>
                  </div>
                  <Switch 
                    id="collar" 
                    checked={parts.collar} 
                    onCheckedChange={(c) => setParts({...parts, collar: c})} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="leftSleeve" className="text-base font-medium">Left Sleeve</Label>
                    <p className="text-xs text-muted-foreground">Full length</p>
                  </div>
                  <Switch 
                    id="leftSleeve" 
                    checked={parts.leftSleeve} 
                    onCheckedChange={(c) => setParts({...parts, leftSleeve: c})} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="rightSleeve" className="text-base font-medium">Right Sleeve</Label>
                    <p className="text-xs text-muted-foreground">Full length</p>
                  </div>
                  <Switch 
                    id="rightSleeve" 
                    checked={parts.rightSleeve} 
                    onCheckedChange={(c) => setParts({...parts, rightSleeve: c})} 
                  />
                </div>
              </div>
            </section>

            {/* Sizing */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl font-medium tracking-wide">Size</h3>
                <button className="text-xs text-muted-foreground underline hover:text-primary">Size Guide</button>
              </div>
              <div className="flex gap-4">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`flex-1 h-12 flex items-center justify-center font-medium border transition-colors ${
                      size === s 
                        ? 'border-primary bg-primary text-primary-foreground' 
                        : 'border-border/50 hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>

            {/* Graphic/Text Placeholder */}
            <section className="opacity-50 pointer-events-none pb-12">
              <h3 className="font-serif text-xl font-medium tracking-wide mb-4">Graphics & Monograms</h3>
              <p className="text-sm text-muted-foreground mb-4">2D Canvas editor coming soon.</p>
              <Button disabled variant="outline" className="w-full rounded-none">Open Editor</Button>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
