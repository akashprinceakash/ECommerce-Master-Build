import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Pencil, Trash2, Upload, X, Check,
  ShieldCheck, Package, Users, Eye, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { getApiUrl } from "@/lib/api";

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  priceInPaise: number;
  modelUrl: string;
  thumbnailUrl?: string | null;
  available: boolean;
  sizes: string[];
  defaultColor: string;
}

interface UserDesign {
  id: number;
  userId: string;
  userEmail: string;
  userName: string;
  productId: number;
  productName: string | null;
  productModelUrl: string | null;
  productThumbnailUrl: string | null;
  name: string;
  color: string;
  size: string;
  canvasData: string | null;
  previewImageUrl: string | null;
  updatedAt: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "polo",
  priceText: "",
  modelUrl: "",
  thumbnailUrl: "",
  available: true,
  sizes: ["S", "M", "L", "XL"],
  defaultColor: "#ffffff",
};

async function getToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) return clerk.session.getToken();
    return null;
  } catch { return null; }
}

async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const token = await getToken();
  const isFormData = opts?.body instanceof FormData;
  const headers: Record<string, string> = { ...(opts?.headers as any) };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Design Viewer Modal ───────────────────────────────────────────────────────
function DesignViewerModal({ design, onClose }: { design: UserDesign; onClose: () => void }) {
  const [mvLoaded, setMvLoaded] = useState(false);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!document.querySelector('script[data-mv-loader]')) {
      const s = document.createElement("script");
      s.type = "module";
      s.setAttribute("data-mv-loader", "1");
      s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
      s.onload = () => setMvLoaded(true);
      document.head.appendChild(s);
    } else {
      setMvLoaded(true);
    }
  }, []);

  // Apply canvas texture to model after it loads
  useEffect(() => {
    if (!design.previewImageUrl || !viewerRef.current) return;
    const mv = viewerRef.current;
    const handleLoad = async () => {
      const model = mv.model;
      if (!model?.materials?.length) return;
      try {
        const texture = await mv.createTexture(design.previewImageUrl!);
        const printMat = model.materials.find((_: any, i: number) => i === (model.materials.length > 1 ? 1 : 0));
        if (printMat) printMat.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
      } catch {}
    };
    mv.addEventListener("load", handleLoad);
    return () => mv.removeEventListener("load", handleLoad);
  }, [design.previewImageUrl, mvLoaded]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ background: "#100d0b", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 3D Viewer */}
        <div className="flex-1 min-h-[300px] md:min-h-[500px] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          {design.productModelUrl && mvLoaded ? (
            <model-viewer
              ref={viewerRef}
              src={design.productModelUrl}
              camera-controls
              auto-rotate
              rotation-per-second="8deg"
              shadow-intensity="1"
              environment-image="neutral"
              exposure="1"
              style={{ width: "100%", height: "100%", minHeight: "300px", "--poster-color": "transparent" } as any}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/40 p-8">
              <Package className="w-12 h-12" />
              <p className="text-sm">No 3D model available</p>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="w-full md:w-72 p-6 overflow-y-auto" style={{ borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
          <h2 className="text-lg font-bold text-white mb-1">{design.name}</h2>
          <p className="text-xs text-white/40 mb-4">Customer Design</p>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Customer</p>
              <p className="text-white font-medium">{design.userName}</p>
              <p className="text-white/60 text-xs">{design.userEmail}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Product</p>
              <p className="text-white">{design.productName ?? "—"}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Size</p>
                <p className="text-white">{design.size}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Color</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-white/20" style={{ background: design.color }} />
                  <span className="text-white text-xs">{design.color}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Last Updated</p>
              <p className="text-white text-xs">{new Date(design.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Canvas Preview */}
          {design.previewImageUrl && (
            <div className="mt-5">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Design Canvas</p>
              <div className="rounded-lg overflow-hidden border border-white/10">
                <img src={design.previewImageUrl} alt="Customer Design" className="w-full aspect-square object-cover" />
              </div>
              <p className="text-white/30 text-xs mt-1 text-center">Design texture applied to 3D model ↑</p>
            </div>
          )}

          {!design.previewImageUrl && (
            <div className="mt-5 p-4 rounded-lg border border-white/10 text-center">
              <p className="text-white/40 text-xs">No canvas design saved yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const modelFileRef = useRef<HTMLInputElement>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"products" | "designs">("products");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [viewingDesign, setViewingDesign] = useState<UserDesign | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    getToken().then(async (token) => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${getApiUrl()}/api/admin/check`, { headers });
        setIsAdmin(res.ok);
      } catch { setIsAdmin(false); }
    });
  }, [user]);

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["admin-products"],
    queryFn: () => apiFetch("/api/admin/products"),
    enabled: isAdmin === true,
  });

  const { data: designs = [], isLoading: loadingDesigns } = useQuery<UserDesign[]>({
    queryKey: ["admin-designs"],
    queryFn: () => apiFetch("/api/admin/customizations"),
    enabled: isAdmin === true && activeTab === "designs",
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => apiFetch("/api/admin/products", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product created" }); resetForm(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => apiFetch(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product updated" }); resetForm(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(false); };

  const startEdit = (p: Product) => {
    setForm({ ...p, priceText: (p.priceInPaise / 100).toFixed(2), thumbnailUrl: p.thumbnailUrl ?? "" });
    setEditingId(p.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    const data = { ...form, priceInPaise: Math.round(parseFloat(form.priceText || "0") * 100) };
    if (!data.name || !data.modelUrl) { toast({ title: "Name and Model URL are required", variant: "destructive" }); return; }
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingModel(true);
    try {
      const token = await getToken();
      const fd = new FormData(); fd.append("model", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/admin/upload/model`, { method: "POST", body: fd, headers });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setForm(f => ({ ...f, modelUrl: url }));
      toast({ title: "Model uploaded" });
    } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
    finally { setUploadingModel(false); if (e.target) e.target.value = ""; }
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const token = await getToken();
      const fd = new FormData(); fd.append("thumbnail", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/admin/upload/thumbnail`, { method: "POST", body: fd, headers });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setForm(f => ({ ...f, thumbnailUrl: url }));
      toast({ title: "Thumbnail uploaded" });
    } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
    finally { setUploadingThumb(false); if (e.target) e.target.value = ""; }
  };

  // ── Loading / Access Guards ──
  if (!isLoaded || isAdmin === null) {
    return <Layout><div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8" /></div></Layout>;
  }

  if (!user) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
          <ShieldCheck className="w-16 h-16 text-muted-foreground" />
          <h1 className="text-4xl font-serif">Sign in Required</h1>
          <p className="text-muted-foreground">Please sign in to access the admin panel.</p>
          <a href="/sign-in" className="text-sm font-medium tracking-widest border-b border-primary hover:text-primary transition-colors pb-1">SIGN IN</a>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
          <div className="text-6xl">🔒</div>
          <h1 className="text-4xl font-serif">Admin Access Required</h1>
          <p className="text-muted-foreground max-w-md">You do not have permission to access this page. Contact your administrator to grant access.</p>
          <a href="/" className="text-sm font-medium tracking-widest border-b border-primary hover:text-primary pb-1">RETURN TO COLLECTION</a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-serif tracking-wider">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Signed in as {user.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-8">
          {[
            { id: "products", label: "Products", icon: Package, count: products.length },
            { id: "designs", label: "User Designs", icon: Users, count: designs.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {activeTab === "products" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">All Products</h2>
              <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 rounded-none text-xs tracking-widest">
                <Plus className="w-4 h-4" /> ADD PRODUCT
              </Button>
            </div>

            {/* Form */}
            {showForm && (
              <div className="border border-border mb-8 p-6 bg-card">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold">{editingId ? "Edit Product" : "New Product"}</h3>
                  <button onClick={resetForm}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Product Name *</label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Signature Polo" className="rounded-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Category</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="h-10 border border-input bg-background px-3 text-sm rounded-none">
                      {["polo", "shorts", "trousers", "jacket", "t-shirt", "accessories"].map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Description *</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the product..." rows={3} className="border border-input bg-background px-3 py-2 text-sm rounded-none resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Price (₹) *</label>
                    <Input type="number" value={form.priceText} onChange={e => setForm(f => ({ ...f, priceText: e.target.value }))} placeholder="e.g. 12500" className="rounded-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Default Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.defaultColor} onChange={e => setForm(f => ({ ...f, defaultColor: e.target.value }))} className="w-10 h-10 cursor-pointer border border-input rounded-none p-0" />
                      <span className="text-sm text-muted-foreground">{form.defaultColor}</span>
                    </div>
                  </div>

                  {/* 3D Model Upload */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">3D Model (.glb / .gltf) *</label>
                    <div className="flex gap-2">
                      <Input value={form.modelUrl} onChange={e => setForm(f => ({ ...f, modelUrl: e.target.value }))} placeholder="Paste URL or upload .glb file →" className="rounded-none flex-1 text-sm" />
                      <label className="cursor-pointer shrink-0">
                        <div className={`h-10 px-4 flex items-center gap-2 border border-input text-sm font-medium transition-colors ${uploadingModel ? "opacity-50" : "hover:bg-accent cursor-pointer"}`}>
                          {uploadingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span>Upload .glb</span>
                        </div>
                        <input ref={modelFileRef} type="file" accept=".glb,.gltf" onChange={handleModelUpload} className="hidden" disabled={uploadingModel} />
                      </label>
                    </div>
                    {form.modelUrl && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> {form.modelUrl.split("/").pop()}</p>
                    )}
                  </div>

                  {/* Thumbnail Upload */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Product Thumbnail Image</label>
                    <div className="flex gap-2">
                      <Input value={form.thumbnailUrl || ""} onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))} placeholder="Paste image URL or upload →" className="rounded-none flex-1 text-sm" />
                      <label className="cursor-pointer shrink-0">
                        <div className={`h-10 px-4 flex items-center gap-2 border border-input text-sm font-medium transition-colors ${uploadingThumb ? "opacity-50" : "hover:bg-accent cursor-pointer"}`}>
                          {uploadingThumb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span>Upload Image</span>
                        </div>
                        <input ref={thumbFileRef} type="file" accept="image/*" onChange={handleThumbUpload} className="hidden" disabled={uploadingThumb} />
                      </label>
                    </div>
                    {form.thumbnailUrl && (
                      <img src={form.thumbnailUrl} alt="Thumbnail" className="h-24 w-24 object-cover border border-input mt-1" />
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">Availability</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="w-4 h-4" />
                      <span className="text-sm">Product is live and purchasable</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
                  <Button variant="outline" onClick={resetForm} className="rounded-none text-xs tracking-widest">CANCEL</Button>
                  <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="rounded-none text-xs tracking-widest flex items-center gap-2">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingId ? "SAVE CHANGES" : "CREATE PRODUCT"}
                  </Button>
                </div>
              </div>
            )}

            {/* Products Table */}
            {loadingProducts ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border rounded-none">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No products yet.</p>
                <button onClick={() => { resetForm(); setShowForm(true); }} className="mt-3 text-sm underline text-primary">Add your first product</button>
              </div>
            ) : (
              <div className="border border-border overflow-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-muted/30">
                    <tr>
                      {["#", "Product", "Category", "Price", "Status", "3D Model", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widest text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.id} className={`border-t border-border ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.thumbnailUrl
                              ? <img src={p.thumbnailUrl} alt="" className="w-10 h-10 object-cover border border-border shrink-0" />
                              : <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 text-[9px] font-bold text-muted-foreground">IMG</div>
                            }
                            <div>
                              <p className="font-semibold leading-tight">{p.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{p.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground text-xs">{p.category}</td>
                        <td className="px-4 py-3 font-medium">{formatPrice(p.priceInPaise)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-1 tracking-wider font-semibold ${p.available ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                            {p.available ? "LIVE" : "HIDDEN"}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[140px]">
                          <a href={p.modelUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline hover:no-underline truncate block">
                            {p.modelUrl.split("/").pop() || "View"}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => startEdit(p)} className="p-1 hover:text-primary transition-colors" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id); }} className="p-1 hover:text-red-500 transition-colors" title="Delete" disabled={deleteMutation.isPending}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── USER DESIGNS TAB ── */}
        {activeTab === "designs" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Customer Designs</h2>
              <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-designs"] })} className="text-xs text-muted-foreground hover:text-foreground underline">Refresh</button>
            </div>

            {loadingDesigns ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>
            ) : designs.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No customer designs yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Designs appear here when customers customize and save products.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {designs.map(d => (
                  <div key={d.id} className="border border-border bg-card flex flex-col overflow-hidden hover:border-primary transition-colors group">
                    {/* Preview */}
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {d.previewImageUrl ? (
                        <img src={d.previewImageUrl} alt={d.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : d.productThumbnailUrl ? (
                        <img src={d.productThumbnailUrl} alt={d.name} className="w-full h-full object-cover opacity-50" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-xs font-bold">NO PREVIEW</div>
                      )}
                      {d.previewImageUrl && (
                        <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[9px] px-2 py-0.5 tracking-wider font-semibold">CUSTOMIZED</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.productName ?? "Unknown product"}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" style={{ background: d.color }} />
                        <span>Size {d.size}</span>
                        <span>·</span>
                        <span className="truncate">{d.userEmail}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60">{new Date(d.updatedAt).toLocaleDateString()}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-auto rounded-none text-[10px] tracking-widest w-full flex items-center gap-2"
                        onClick={() => setViewingDesign(d)}
                      >
                        <Eye className="w-3 h-3" /> VIEW DESIGN
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Design Viewer Modal */}
      {viewingDesign && (
        <DesignViewerModal design={viewingDesign} onClose={() => setViewingDesign(null)} />
      )}
    </Layout>
  );
}
