import { Layout } from "@/components/layout/Layout";
import { 
  useGetCart, 
  getGetCartQueryKey,
  useGetUserProfile,
  getGetUserProfileQueryKey
} from "@workspace/api-client-react";
import { formatPrice } from "@/lib/format";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Loader2, ArrowLeft, Truck, X } from "lucide-react";
import { getApiUrl, getAssetUrl } from "@/lib/api";
import { useAuth } from "@clerk/react";

declare global { interface Window { Razorpay?: any } }

type PaymentResult =
  | { type: "success"; orderId: number }
  | { type: "failure"; error: string }
  | null;

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh",
];

/** GST rate for apparel (inclusive pricing): 5% ≤ ₹1000, 12% > ₹1000 */
function gstRate(priceInPaise: number) {
  return priceInPaise <= 100000 ? 0.05 : 0.12;
}

function calcGst(priceInPaise: number, qty: number) {
  const total = priceInPaise * qty;
  const rate = gstRate(priceInPaise);
  const base = Math.round(total / (1 + rate));
  return total - base;
}

interface ShippingRate {
  chargeInPaise: number;
  courierName: string;
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const { data: cart, isLoading: isLoadingCart } = useGetCart({
    query: { queryKey: getGetCartQueryKey() }
  });

  const { data: profile } = useGetUserProfile({
    query: { queryKey: getGetUserProfileQueryKey() }
  });

  const [formData, setFormData] = useState({
    shippingName: "",
    shippingAddress: "",
    shippingCity: "",
    shippingState: "",
    shippingPostalCode: "",
    shippingPhone: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        shippingName: profile.displayName || "",
        shippingAddress: profile.defaultShippingAddress || "",
        shippingPhone: profile.phone || ""
      }));
    }
  }, [profile]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ── Shipping rate fetch ───────────────────────────────────────────────
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const rateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const pincode = formData.shippingPostalCode;
    if (!/^\d{6}$/.test(pincode) || !cart) {
      setShippingRate(null);
      return;
    }

    if (rateTimerRef.current) clearTimeout(rateTimerRef.current);
    rateTimerRef.current = setTimeout(async () => {
      setShippingLoading(true);
      try {
        const token = await getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${getApiUrl()}/api/shipping/rates`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            pincode,
            itemCount: cart.items.reduce((s, i) => s + i.quantity, 0),
            orderValueRupees: Math.round(cart.totalInPaise / 100),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setShippingRate(data);
        }
      } catch (_) {
        setShippingRate({ chargeInPaise: 9900, courierName: "Standard Delivery" });
      } finally {
        setShippingLoading(false);
      }
    }, 600);

    return () => { if (rateTimerRef.current) clearTimeout(rateTimerRef.current); };
  }, [formData.shippingPostalCode, cart]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult>(null);

  useEffect(() => {
    if (paymentResult?.type !== "success") return;
    const t = setTimeout(() => setLocation(`/orders/${paymentResult.orderId}`), 3500);
    return () => clearTimeout(t);
  }, [paymentResult, setLocation]);

  async function authFetch(path: string, opts?: RequestInit) {
    const token = await getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts?.headers as any) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    return res.json();
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.shippingName || !formData.shippingAddress || !formData.shippingCity ||
        !formData.shippingState || !formData.shippingPostalCode || !formData.shippingPhone) {
      toast({ title: "Missing Information", description: "Please fill in all shipping fields.", variant: "destructive" });
      return;
    }

    if (!shippingRate) {
      toast({ title: "Shipping Not Calculated", description: "Please enter a valid 6-digit PIN code to calculate shipping.", variant: "destructive" });
      return;
    }

    if (!window.Razorpay) {
      toast({ title: "Payment unavailable", description: "Razorpay failed to load. Please refresh and try again.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    let modalShown = false;
    try {
      const { orderId, amount, currency, keyId } = await authFetch("/api/payment/order", {
        method: "POST",
        body: JSON.stringify({ ...formData, shippingChargeInPaise: shippingRate.chargeInPaise }),
      });
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: keyId,
          amount,
          currency,
          order_id: orderId,
          name: "KA.SHA",
          description: "Luxury bespoke order",
          prefill: {
            name: formData.shippingName,
            email: profile?.email ?? "",
            contact: formData.shippingPhone,
          },
          notes: { shipping_city: formData.shippingCity },
          theme: { color: "#000000" },
          handler: async (resp: any) => {
            try {
              const order = await authFetch("/api/payment/verify", {
                method: "POST",
                body: JSON.stringify({
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                }),
              });
              queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
              modalShown = true;
              setPaymentResult({ type: "success", orderId: order.id });
              resolve();
            } catch (err: any) {
              modalShown = true;
              setPaymentResult({ type: "failure", error: err.message ?? "Payment verification failed. Please contact support." });
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              toast({ title: "Payment Cancelled", description: "You closed the payment window.", variant: "destructive" });
              reject(new Error("dismissed"));
            },
          },
        });
        rzp.on("payment.failed", (resp: any) => {
          const errMsg = resp?.error?.description ?? "Your payment could not be processed. Please try again.";
          modalShown = true;
          setPaymentResult({ type: "failure", error: errMsg });
          reject(new Error(errMsg));
        });
        rzp.open();
      });
    } catch (e: any) {
      if (e?.message !== "dismissed" && !modalShown) {
        toast({ title: "Checkout Failed", description: e?.message ?? "There was an error processing your order.", variant: "destructive" });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingCart) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center flex flex-col items-center">
          <h2 className="text-2xl font-serif mb-4">Your bag is empty</h2>
          <Link href="/products">
            <Button className="rounded-none">Return to Shop</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  // ── GST breakdown ────────────────────────────────────────────────────
  const totalGst = cart.items.reduce((s, item) => s + calcGst(item.product.priceInPaise, item.quantity), 0);
  const subtotalExclGst = cart.totalInPaise - totalGst;
  const grandTotal = cart.totalInPaise + (shippingRate?.chargeInPaise ?? 0);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <Link href="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Bag
        </Link>
        
        <h1 className="text-3xl md:text-4xl font-serif font-medium mb-12">Checkout</h1>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Shipping Form */}
          <div>
            <h2 className="font-serif text-xl font-medium mb-6 border-b border-border/50 pb-2">Shipping Information</h2>
            <form onSubmit={handleCheckout} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="shippingName">Full Name</Label>
                <Input 
                  id="shippingName" 
                  value={formData.shippingName} 
                  onChange={(e) => handleChange("shippingName", e.target.value)} 
                  className="rounded-none border-border/50 bg-secondary/10"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingPhone">Mobile Number</Label>
                <Input 
                  id="shippingPhone" 
                  value={formData.shippingPhone} 
                  onChange={(e) => handleChange("shippingPhone", e.target.value)} 
                  className="rounded-none border-border/50 bg-secondary/10"
                  placeholder="+91"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingAddress">Street Address</Label>
                <Input 
                  id="shippingAddress" 
                  value={formData.shippingAddress} 
                  onChange={(e) => handleChange("shippingAddress", e.target.value)} 
                  className="rounded-none border-border/50 bg-secondary/10"
                  placeholder="House/Flat No., Building Name, Street"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shippingCity">City</Label>
                  <Input 
                    id="shippingCity" 
                    value={formData.shippingCity} 
                    onChange={(e) => handleChange("shippingCity", e.target.value)} 
                    className="rounded-none border-border/50 bg-secondary/10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shippingPostalCode">PIN Code</Label>
                  <Input 
                    id="shippingPostalCode" 
                    value={formData.shippingPostalCode} 
                    onChange={(e) => handleChange("shippingPostalCode", e.target.value)} 
                    className="rounded-none border-border/50 bg-secondary/10"
                    placeholder="6-digit PIN"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingState">State</Label>
                <Select value={formData.shippingState} onValueChange={(val) => handleChange("shippingState", val)}>
                  <SelectTrigger className="rounded-none border-border/50 bg-secondary/10">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-8">
                <h2 className="font-serif text-xl font-medium mb-6 border-b border-border/50 pb-2">Payment</h2>
                <div className="p-4 border border-border/50 bg-secondary/5 mb-8">
                  <p className="text-sm text-muted-foreground">Secured by Razorpay. You will be redirected to complete your payment via UPI, card, or netbanking.</p>
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full h-14 text-sm tracking-widest rounded-none"
                  disabled={isProcessing || !shippingRate}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : `PAY ${shippingRate ? formatPrice(grandTotal) : ""}`}
                </Button>
                {!shippingRate && formData.shippingPostalCode.length === 6 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">Calculating shipping...</p>
                )}
                {!formData.shippingPostalCode && (
                  <p className="text-xs text-muted-foreground text-center mt-2">Enter PIN code to see shipping rates</p>
                )}
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="bg-secondary/30 p-8 sticky top-24">
            <h2 className="font-serif text-xl font-medium mb-6">In Your Bag</h2>
            
            <div className="space-y-6 mb-8 max-h-[40vh] overflow-y-auto pr-2">
              {cart.items.map(item => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-16 aspect-[3/4] bg-secondary flex-shrink-0 relative">
                    {(item.product.thumbnailUrl || item.product.modelUrl) && (
                      <img 
                        src={getAssetUrl(item.product.thumbnailUrl || item.product.modelUrl)} 
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center text-sm">
                    <p className="font-serif font-medium">{item.product.name.replace(/\s+[—–-]\s*[A-Z]{1,3}\d+\s*$/, "")}</p>
                    <p className="text-muted-foreground">Qty: {item.quantity} | Size: {item.size}</p>
                    {item.customization && <p className="text-xs italic text-primary mt-1">Bespoke: {item.customization.name}</p>}
                  </div>
                  <div className="text-sm font-medium">
                    {formatPrice(item.product.priceInPaise * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="space-y-2.5 text-sm border-t border-b border-border/50 py-5 mb-5">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (excl. GST)</span>
                <span>{formatPrice(subtotalExclGst)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>GST (5% / 12% incl.)</span>
                <span>{formatPrice(totalGst)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Shipping
                </span>
                {shippingLoading ? (
                  <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Calculating...</span>
                ) : shippingRate ? (
                  <span>{shippingRate.chargeInPaise === 0 ? "Free" : formatPrice(shippingRate.chargeInPaise)}</span>
                ) : (
                  <span className="text-xs italic">Enter PIN code</span>
                )}
              </div>
              {shippingRate && (
                <p className="text-xs text-muted-foreground/70 italic">{shippingRate.courierName}</p>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <span className="font-serif text-xl font-medium">Total</span>
              <span className="text-xl font-medium text-primary">{formatPrice(grandTotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">All prices inclusive of GST · HSN 61099010</p>
          </div>
        </div>
      </div>
      {/* ── Payment Result Modal ────────────────────────────────────────── */}
      {paymentResult && (
        <>
          <style>{`
            @keyframes kasha-backdrop { from { opacity:0 } to { opacity:1 } }
            @keyframes kasha-card { from { opacity:0; transform:scale(0.92) translateY(12px) } to { opacity:1; transform:scale(1) translateY(0) } }
            @keyframes kasha-circle { from { stroke-dashoffset:164 } to { stroke-dashoffset:0 } }
            @keyframes kasha-check { from { stroke-dashoffset:80 } to { stroke-dashoffset:0 } }
            @keyframes kasha-cross { from { stroke-dashoffset:60 } to { stroke-dashoffset:0 } }
            @keyframes kasha-progress { from { width:100% } to { width:0% } }
            .kasha-backdrop { animation: kasha-backdrop 0.25s ease forwards; }
            .kasha-card { animation: kasha-card 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
            .kasha-circle { stroke-dasharray:164; stroke-dashoffset:164; animation: kasha-circle 0.5s ease-out 0.1s forwards; }
            .kasha-check { stroke-dasharray:80; stroke-dashoffset:80; animation: kasha-check 0.4s ease-out 0.55s forwards; }
            .kasha-cross { stroke-dasharray:60; stroke-dashoffset:60; animation: kasha-cross 0.35s ease-out 0.45s forwards; }
            .kasha-progress-bar { animation: kasha-progress 3.5s linear forwards; }
          `}</style>

          {/* Backdrop */}
          <div
            className="kasha-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
            onClick={() => paymentResult.type === "failure" && setPaymentResult(null)}
          >
            {/* Card */}
            <div
              className="kasha-card relative bg-white w-full max-w-sm shadow-2xl overflow-hidden"
              style={{ borderRadius: 4 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent */}
              <div className="h-1 w-full" style={{ background: paymentResult.type === "success" ? "#16a34a" : "#dc2626" }} />

              {/* Close button */}
              {paymentResult.type === "failure" && (
                <button
                  onClick={() => setPaymentResult(null)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              <div className="px-8 py-10 flex flex-col items-center text-center">
                {paymentResult.type === "success" ? (
                  <>
                    {/* Animated checkmark */}
                    <svg viewBox="0 0 52 52" className="w-20 h-20 mb-6" fill="none">
                      <circle cx="26" cy="26" r="26" className="kasha-circle" stroke="#16a34a" strokeWidth="2" fill="none" />
                      <path className="kasha-check" d="M14 27l8 8 16-16" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    <h2 className="font-serif text-2xl font-medium text-gray-900 mb-2">Payment Successful</h2>
                    <p className="text-gray-500 text-sm mb-1">Your order has been placed successfully.</p>
                    <p className="text-xs text-gray-400 mb-8">
                      Order #{String(paymentResult.orderId).padStart(6, "0")} · Redirecting to your order…
                    </p>
                    {/* Auto-close progress bar */}
                    <div className="w-full h-0.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="kasha-progress-bar h-full rounded-full" style={{ background: "#16a34a" }} />
                    </div>
                    <button
                      onClick={() => setLocation(`/orders/${paymentResult.orderId}`)}
                      className="mt-5 w-full py-3 text-sm tracking-widest font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
                    >
                      VIEW ORDER
                    </button>
                  </>
                ) : (
                  <>
                    {/* Animated X */}
                    <svg viewBox="0 0 52 52" className="w-20 h-20 mb-6" fill="none">
                      <circle cx="26" cy="26" r="26" className="kasha-circle" stroke="#dc2626" strokeWidth="2" fill="none" />
                      <path className="kasha-cross" d="M18 18l16 16M34 18L18 34" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </svg>
                    <h2 className="font-serif text-2xl font-medium text-gray-900 mb-2">Payment Failed</h2>
                    <p className="text-sm text-gray-500 mb-1">Payment was not received.</p>
                    <p className="text-xs text-gray-400 mb-8 max-w-xs">{paymentResult.error}</p>
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => setPaymentResult(null)}
                        className="flex-1 py-3 text-sm tracking-widest font-medium border border-gray-900 text-gray-900 hover:bg-gray-50 transition"
                      >
                        TRY AGAIN
                      </button>
                      <button
                        onClick={() => setLocation("/cart")}
                        className="flex-1 py-3 text-sm tracking-widest font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
                      >
                        BACK TO BAG
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
