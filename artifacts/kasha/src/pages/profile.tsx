import { Layout } from "@/components/layout/Layout";
import { 
  useGetUserProfile, 
  getGetUserProfileQueryKey,
  useUpsertUserProfile,
  useListCustomizations,
  getListCustomizationsQueryKey
} from "@workspace/api-client-react";
import { formatPrice, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Palette, Shield } from "lucide-react";
import { Link, useSearch } from "wouter";

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchStr = useSearch();
  const defaultTab = new URLSearchParams(searchStr).get("tab") === "designs" ? "designs" : "profile";

  const { data: profile, isLoading: isLoadingProfile } = useGetUserProfile({
    query: { queryKey: getGetUserProfileQueryKey() }
  });

  const { data: customizations, isLoading: isLoadingCustomizations } = useListCustomizations({
    query: { queryKey: getListCustomizationsQueryKey() }
  });

  const upsertProfile = useUpsertUserProfile();

  const [formData, setFormData] = useState({
    displayName: "",
    phone: "",
    defaultShippingAddress: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || "",
        phone: profile.phone || "",
        defaultShippingAddress: profile.defaultShippingAddress || ""
      });
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertProfile.mutateAsync({
        data: formData
      });
      queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (isLoadingProfile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-5xl">
          <Skeleton className="h-12 w-64 mb-12 bg-secondary" />
          <div className="grid md:grid-cols-4 gap-8">
            <Skeleton className="h-48 w-full bg-secondary md:col-span-1" />
            <Skeleton className="h-96 w-full bg-secondary md:col-span-3" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <h1 className="text-4xl font-serif font-medium mb-12">Atelier Account</h1>

        <div className="grid md:grid-cols-4 gap-12 items-start">
          {/* Stats Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-secondary/30 p-6 border border-border/50 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-serif text-lg font-medium mb-1">{profile?.displayName || 'Member'}</h3>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>

            <div className="bg-background border border-border/50 p-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Orders</p>
                <p className="font-serif text-2xl">{profile?.totalOrders || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Spent</p>
                <p className="font-serif text-2xl text-primary">{formatPrice(profile?.totalSpentInPaise || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Saved Designs</p>
                <p className="font-serif text-2xl">{profile?.savedDesignsCount || 0}</p>
              </div>
            </div>
            
            <Link href="/orders">
              <Button variant="outline" className="w-full rounded-none border-border/50">
                View Order History
              </Button>
            </Link>
          </div>

          {/* Main Content Tabs */}
          <div className="md:col-span-3">
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-8">
                <TabsTrigger 
                  value="profile" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3 font-medium"
                >
                  Personal Details
                </TabsTrigger>
                <TabsTrigger 
                  value="designs" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3 font-medium"
                >
                  Bespoke Designs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="focus-visible:outline-none">
                <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input 
                      id="displayName" 
                      value={formData.displayName} 
                      onChange={(e) => setFormData({...formData, displayName: e.target.value})} 
                      className="rounded-none border-border/50 bg-secondary/5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex">
                      <span className="flex items-center px-3 border border-r-0 border-border/50 bg-secondary/20 text-sm text-muted-foreground select-none" style={{ fontFamily: "'Josefin Sans', sans-serif", letterSpacing: "0.04em" }}>+91</span>
                      <Input 
                        id="phone" 
                        value={formData.phone} 
                        onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10)})} 
                        className="flex-1 rounded-none rounded-l-none border-border/50 bg-secondary/5"
                        placeholder="10-digit mobile number"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultShippingAddress">Default Shipping Address</Label>
                    <Input 
                      id="defaultShippingAddress" 
                      value={formData.defaultShippingAddress} 
                      onChange={(e) => setFormData({...formData, defaultShippingAddress: e.target.value})} 
                      className="rounded-none border-border/50 bg-secondary/5"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full sm:w-auto h-12 px-8 tracking-widest text-xs rounded-none"
                    disabled={upsertProfile.isPending}
                  >
                    {upsertProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    SAVE CHANGES
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="designs" className="focus-visible:outline-none">
                {isLoadingCustomizations ? (
                  <div className="grid sm:grid-cols-2 gap-6">
                    {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full bg-secondary rounded-none" />)}
                  </div>
                ) : !customizations || customizations.length === 0 ? (
                  <div className="py-16 text-center border border-border/50 bg-secondary/5">
                    <Palette className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-serif mb-2">No designs saved yet</p>
                    <p className="text-sm text-muted-foreground mb-6">Create your own unique pieces in the Bespoke Studio.</p>
                    <Link href="/products?category=bespoke">
                      <Button variant="outline" className="rounded-none tracking-widest text-xs">
                        EXPLORE STUDIO
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-6">
                    {customizations.map(design => (
                      <div key={design.id} className="border border-border/50 bg-background group">
                        <div className="aspect-video bg-secondary/30 relative flex items-center justify-center overflow-hidden">
                          {(design as any).previewImageUrl || (design as any).frontImageUrl ? (
                            <img
                              src={(design as any).previewImageUrl || (design as any).frontImageUrl}
                              alt={design.name}
                              className="w-full h-full object-contain p-2"
                              onError={e => {
                                const el = e.currentTarget as HTMLImageElement;
                                el.style.display = "none";
                                (el.nextElementSibling as HTMLElement | null)?.removeAttribute("style");
                              }}
                            />
                          ) : null}
                          <div className="w-24 h-24 border border-border/20 shadow-lg" style={{ backgroundColor: design.color, display: ((design as any).previewImageUrl || (design as any).frontImageUrl) ? "none" : "block" }} />
                          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <Link href={`/products/${design.productId}/customize?from=saved`}>
                              <Button variant="outline" className="rounded-none border-foreground hover:bg-foreground hover:text-background">
                                Edit Design
                              </Button>
                            </Link>
                          </div>
                        </div>
                        <div className="p-4 border-t border-border/50">
                          <h4 className="font-serif font-medium truncate">{design.name}</h4>
                          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                            <span className="uppercase">Size {design.size}</span>
                            <span>{formatDate(design.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}
