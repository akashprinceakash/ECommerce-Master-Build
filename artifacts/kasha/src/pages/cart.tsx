import { Layout } from "@/components/layout/Layout";
import {
  useGetCart,
  getGetCartQueryKey,
  useRemoveCartItem,
  useUpdateCartItem
} from "@workspace/api-client-react";
import { formatPrice } from "@/lib/format";
import { Link } from "wouter";
import { Minus, Plus, Trash2, ArrowRight, ChevronRight, Lock, ShoppingBag } from "lucide-react";
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
    await updateCartItem.mutateAsync({ id: itemId, data: { quantity: newQuantity } });
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
  };

  const handleRemove = async (itemId: number) => {
    await removeCartItem.mutateAsync({ id: itemId });
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
  };

  const hasItems = cart && cart.items && cart.items.length > 0;

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center gap-2 text-[11px] text-gray-400 font-medium">
          <Link href="/" className="hover:text-black transition-colors">HOME</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black">CART</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-black text-black mb-10">
          Your Cart
          {cart?.itemCount ? (
            <span className="text-gray-400 font-normal text-xl ml-3">({cart.itemCount} items)</span>
          ) : null}
        </h1>

        {isLoading ? (
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-6">
              {[1, 2].map(i => (
                <div key={i} className="flex gap-5 border-b pb-6">
                  <Skeleton className="w-28 h-36 bg-gray-100" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-1/3 bg-gray-100" />
                    <Skeleton className="h-4 w-1/4 bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="h-64 w-full bg-gray-100" />
          </div>
        ) : !hasItems ? (
          <div className="py-24 text-center flex flex-col items-center">
            <ShoppingBag className="w-16 h-16 text-gray-200 mb-6" />
            <p className="text-xl font-bold text-black mb-2">Your cart is empty</p>
            <p className="text-gray-500 mb-8 text-sm">Add some items from the collection to get started</p>
            <Link href="/products">
              <button className="bg-white text-neutral-900 text-[12px] font-bold tracking-[0.15em] px-10 py-4 hover:bg-gray-900 transition-colors">
                DISCOVER THE COLLECTION
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Items */}
            <div className="lg:col-span-2 space-y-6">
              {cart?.items.map((item) => (
                <div key={item.id} className="flex gap-5 border-b border-gray-100 pb-6">
                  <div className="w-28 aspect-[3/4] bg-gray-100 flex-shrink-0 overflow-hidden relative">
                    {item.customization?.previewImageUrl ? (
                      <>
                        <img
                          src={item.customization.previewImageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover object-center"
                        />
                        <span className="absolute top-1 left-1 bg-white/70 text-neutral-900 text-[9px] px-1.5 py-0.5 tracking-wider rounded-sm">CUSTOM</span>
                      </>
                    ) : item.product.thumbnailUrl ? (
                      <img
                        src={item.product.thumbnailUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-black">
                        KA.SHA
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-3 mb-1">
                        <Link href={`/products/${item.productId}`}>
                          <h3 className="text-[15px] font-bold text-black hover:underline">{item.product.name}</h3>
                        </Link>
                        <p className="font-bold text-black whitespace-nowrap">
                          {formatPrice(item.product.priceInPaise * item.quantity)}
                        </p>
                      </div>
                      <p className="text-[12px] text-gray-500">Size: {item.size}</p>
                      {item.customization && (
                        <p className="text-[12px] text-gray-500">Custom: {item.customization.name}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center border border-gray-300">
                        <button
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-black transition-colors disabled:opacity-40"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || updateCartItem.isPending}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-10 text-center text-[13px] font-bold">{item.quantity}</span>
                        <button
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-black transition-colors disabled:opacity-40"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={updateCartItem.isPending}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        className="text-gray-400 hover:text-red-500 flex items-center gap-1.5 transition-colors text-[12px] font-medium"
                        onClick={() => handleRemove(item.id)}
                        disabled={removeCartItem.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Promo Code */}
              <div className="pt-2">
                <button className="text-[12px] font-semibold text-gray-500 hover:text-black underline underline-offset-2 transition-colors">
                  + Enter a promo code
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 border border-gray-200 p-7 sticky top-24">
                <h3 className="text-[13px] font-black tracking-[0.1em] text-black mb-6">ORDER SUMMARY</h3>

                <div className="space-y-3 text-sm mb-6 pb-6 border-b border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal ({cart?.itemCount} items)</span>
                    <span className="font-semibold">{formatPrice(cart?.totalInPaise || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping</span>
                    <span className="font-semibold text-green-600">FREE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax</span>
                    <span className="text-gray-500">Calculated at checkout</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <span className="font-black text-black">ESTIMATED TOTAL</span>
                  <span className="font-black text-xl text-black">{formatPrice(cart?.totalInPaise || 0)}</span>
                </div>

                <Link href="/checkout">
                  <button className="w-full bg-red-600 hover:bg-red-700 text-neutral-900 text-[12px] font-bold tracking-[0.15em] py-4 transition-colors flex items-center justify-center gap-2 mb-3">
                    CHECKOUT <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-medium mt-3">
                  <Lock className="w-3 h-3" /> All transactions are secure and encrypted
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
