import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Lock } from "lucide-react";
import { Link } from "wouter";
import { formatPrice } from "@/lib/format";
import { useRemoveCartItem, useUpdateCartItem, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Cart } from "@workspace/api-client-react";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart?: Cart;
}

export function CartDrawer({ open, onClose, cart }: CartDrawerProps) {
  const queryClient = useQueryClient();
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
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[400px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-black" />
            <h2 className="text-[13px] font-bold tracking-[0.1em] text-black">
              CART ({cart?.itemCount || 0} {cart?.itemCount === 1 ? "ITEM" : "ITEMS"})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-black" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!hasItems ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
              <ShoppingBag className="h-12 w-12 text-gray-300" />
              <div>
                <p className="text-[15px] font-semibold text-black mb-1">Your cart is empty</p>
                <p className="text-sm text-gray-500">Add some items to get started</p>
              </div>
              <Link href="/products" onClick={onClose}>
                <button className="bg-neutral-900 text-white text-[11px] font-bold tracking-[0.12em] px-8 py-3 hover:bg-neutral-700 transition-colors">
                  SHOP NOW
                </button>
              </Link>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-5">
              {cart?.items.map((item) => (
                <div key={item.id} className="flex gap-3 border-b border-gray-100 pb-5">
                  {/* Image — prefer custom preview, then product thumbnail */}
                  <div className="w-20 h-24 bg-gray-100 flex-shrink-0 overflow-hidden relative">
                    {item.customization?.previewImageUrl ? (
                      <>
                        <img
                          src={item.customization.previewImageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover object-center"
                        />
                        <span className="absolute bottom-0 right-0 bg-white/70 text-neutral-900 text-[9px] px-1 py-0.5 leading-tight">CUSTOM</span>
                      </>
                    ) : item.product.thumbnailUrl ? (
                      <img
                        src={item.product.thumbnailUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                        KA.SHA
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <Link href={`/products/${item.productId}`} onClick={onClose}>
                          <p className="text-[13px] font-semibold text-black leading-tight hover:underline">
                            {item.product.name}
                          </p>
                        </Link>
                        <p className="text-[13px] font-semibold text-black whitespace-nowrap">
                          {formatPrice(item.product.priceInPaise * item.quantity)}
                        </p>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">Size: {item.size}</p>
                      {item.customization && (
                        <p className="text-[11px] text-gray-500">Custom: {item.customization.name}</p>
                      )}
                    </div>

                    {/* Quantity + Remove */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-gray-300">
                        <button
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-black transition-colors disabled:opacity-40"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || updateCartItem.isPending}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-[12px] font-medium">{item.quantity}</span>
                        <button
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-black transition-colors disabled:opacity-40"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={updateCartItem.isPending}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                        onClick={() => handleRemove(item.id)}
                        disabled={removeCartItem.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Promo code */}
              <button className="text-[11px] font-semibold tracking-[0.06em] text-gray-500 hover:text-black transition-colors underline underline-offset-2">
                + Enter a promo code
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasItems && (
          <div className="border-t border-gray-200 px-5 py-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-bold tracking-[0.08em] text-gray-700">ESTIMATED TOTAL</span>
              <span className="text-[16px] font-bold text-black">{formatPrice(cart?.totalInPaise || 0)}</span>
            </div>

            <Link href="/checkout" onClick={onClose}>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white text-[12px] font-bold tracking-[0.15em] py-4 transition-colors flex items-center justify-center gap-2">
                CHECKOUT <ArrowRight className="w-4 h-4" />
              </button>
            </Link>

            <Link href="/cart" onClick={onClose}>
              <button className="w-full border border-black text-black text-[11px] font-bold tracking-[0.12em] py-3 hover:bg-gray-50 transition-colors">
                VIEW CART
              </button>
            </Link>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-medium">
              <Lock className="w-3 h-3" /> SECURE CHECKOUT
            </div>
          </div>
        )}
      </div>
    </>
  );
}
