import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { Switch, Route, useLocation, useSearch, Redirect, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

import Home from "@/pages/home";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import ProductsPage from "@/pages/products";
import ProductDetailPage from "@/pages/product-detail";
import CustomizePage from "@/pages/customize";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import ProfilePage from "@/pages/profile";
import HeritagePage from "@/pages/heritage";
import AdminPage from "@/pages/admin";
import SearchPage from "@/pages/search";
import TermsPage from "@/pages/legal/terms";
import PrivacyPage from "@/pages/legal/privacy";
import ShippingPage from "@/pages/legal/shipping";
import ReturnsPage from "@/pages/legal/returns";
import IpPolicyPage from "@/pages/legal/ip-policy";

const queryClient = new QueryClient();
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

// Protected Route Wrapper
function ProtectedRoute({ component: Component, ...rest }: any) {
  return (
    <Route {...rest}>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </Route>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  const search = useSearch();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location, search]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ScrollToTop />
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/products" component={ProductsPage} />
          <Route path="/products/:id" component={ProductDetailPage} />
          <Route path="/products/:id/customize" component={CustomizePage} />
          <Route path="/heritage" component={HeritagePage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/search" component={SearchPage} />
          <Route path="/terms-of-service" component={TermsPage} />
          <Route path="/privacy-policy" component={PrivacyPage} />
          <Route path="/shipping-policy" component={ShippingPage} />
          <Route path="/returns-policy" component={ReturnsPage} />
          <Route path="/ip-policy" component={IpPolicyPage} />

          <ProtectedRoute path="/cart" component={CartPage} />
          <ProtectedRoute path="/checkout" component={CheckoutPage} />
          <ProtectedRoute path="/orders" component={OrdersPage} />
          <ProtectedRoute path="/orders/:id" component={OrderDetailPage} />
          <ProtectedRoute path="/profile" component={ProfilePage} />
          
          <Route>
            <div className="min-h-[70vh] flex items-center justify-center flex-col gap-6 text-center px-4">
              <h1 className="text-6xl font-serif text-primary">404</h1>
              <p className="text-xl font-serif">Page Not Found</p>
              <a href="/" className="text-sm font-medium tracking-widest border-b border-primary hover:text-primary transition-colors pb-1">
                RETURN TO COLLECTION
              </a>
            </div>
          </Route>
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
