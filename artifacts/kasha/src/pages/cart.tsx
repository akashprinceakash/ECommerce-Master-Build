import { Layout } from "@/components/layout/Layout";
import { 
  useGetCart, 
  getGetCartQueryKey,
  useRemoveCartItem,
  useUpdateCartItem
} from "@workspace/api-client-react";
import { formatPrice } from "@/lib/format";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function CartPage() {
  const queryClient = useQueryClient();
  
  const { data: cart, isLoading } = useGetCart({
    query: {
      queryKey: getGetCartQueryKey()
    }
  });

  const removeCartItem = useRemoveCartItem();
  const updateCartItem = useUpdateCartItem();

  const handleUpdateQuantity = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    await updateCartItem.mutateAsync({
      id: itemId,
      data: { quantity: newQuantity }
    });
    
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
  };

  const handleRemove = async (itemId: number) => {
    await removeCartItem.mutateAsync({ id: itemId });
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
  };

  const hasItems = cart && cart.items && cart.items.length > 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <h1 className="text-4xl md:text-5xl font-serif font-medium mb-12">Shopping Bag</h1>

        {isLoading ? (
          <div className="grid lg:grid-cols-3 gap-16">
            <div className="lg:col-span-2 space-y-8">
              {[1, 2].map(i => (
                <div key={i} className="flex gap-6 border-b pb-8">
                  <Skeleton className="w-32 h-40 bg-secondary" />
                  <div className="flex-1 space-y-4">
                    <Skeleton className="h-6 w-1/3 bg-secondary" />
                    <Skeleton className="h-4 w-1/4 bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-64 w-full bg-secondary" />
            </div>
          </div>
        ) : !hasItems ? (
          <div className="py-20 text-center flex flex-col items-center">
            <p className="text-xl text-muted-foreground mb-8 font-serif">Your bag is empty.</p>
            <Link href="/products">
              <Button size="lg" className="h-14 px-10 text-sm tracking-widest rounded-none">
                DISCOVER THE COLLECTION
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-16">
            {/* Items List */}
            <div className="lg:col-span-2 space-y-8">
              {cart?.items.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-6 border-b border-border/50 pb-8">
                  <div className="w-full sm:w-40 aspect-[3/4] bg-secondary flex-shrink-0 relative overflow-hidden">
                    {item.product.thumbnailUrl || item.product.modelUrl ? (
                      <img 
                        src={item.product.thumbnailUrl || item.product.modelUrl} 
                        alt={item.product.name}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-serif italic">
                        KA.SHA
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <Link href={`/products/${item.productId}`}>
                          <h3 className="font-serif text-xl font-medium hover:text-primary transition-colors">{item.product.name}</h3>
                        </Link>
                        <p className="font-medium">{formatPrice(item.product.priceInPaise * item.quantity)}</p>
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground mb-6">
                        <p>Size: <span className="text-foreground">{item.size}</span></p>
                        {item.customization && (
                          <>
                            <p>Color: <span className="text-foreground uppercase">{item.customization.color}</span></p>
                            <p className="text-primary italic font-serif mt-2">Bespoke Design: {item.customization.name}</p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-border/50">
                        <button 
                          className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || updateCartItem.isPending}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                        <button 
                          className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={updateCartItem.isPending}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <button 
                        className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-2 transition-colors disabled:opacity-50"
                        onClick={() => handleRemove(item.id)}
                        disabled={removeCartItem.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-secondary/30 p-8 sticky top-24">
                <h3 className="font-serif text-xl font-medium mb-6">Order Summary</h3>
                
                <div className="space-y-4 text-sm mb-8 border-b border-border/50 pb-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({cart?.itemCount} items)</span>
                    <span>{formatPrice(cart?.totalInPaise || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>Complimentary</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxes</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-8">
                  <span className="font-serif text-xl font-medium">Estimated Total</span>
                  <span className="text-xl font-medium">{formatPrice(cart?.totalInPaise || 0)}</span>
                </div>
                
                <Link href="/checkout">
                  <Button size="lg" className="w-full h-14 text-sm tracking-widest rounded-none flex justify-between items-center px-6">
                    <span>PROCEED TO CHECKOUT</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                
                <div className="mt-6 text-xs text-center text-muted-foreground space-y-2">
                  <p>All transactions are secure and encrypted.</p>
                  <p>14-day returns on non-customized items.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
