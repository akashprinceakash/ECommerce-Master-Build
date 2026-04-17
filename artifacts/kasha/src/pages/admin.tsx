import { useState, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { useUser, Show } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Upload, X, Check } from "lucide-react";
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

const EMPTY_FORM: Omit<Product, "id"> & { priceText: string } = {
  name: "",
  description: "",
  category: "polo",
  priceInPaise: 0,
  priceText: "",
  modelUrl: "",
  thumbnailUrl: "",
  available: true,
  sizes: ["S", "M", "L", "XL"],
  defaultColor: "#ffffff",
};

async function apiFetch(path: string, opts?: RequestInit) {
  const token = (window as any).__clerk_token_getter?.();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts?.headers as any) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

async function getToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) return clerk.session.getToken();
    return null;
  } catch { return null; }
}

async function apiFetchWithToken(path: string, opts?: RequestInit): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts?.body instanceof FormData) delete headers["Content-Type"];
  const res = await fetch(`${getApiUrl()}${path}`, { ...opts, headers: { ...headers, ...(opts?.headers as any) } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const modelFileRef = useRef<HTMLInputElement>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const isAdmin = user?.publicMetadata?.role === "admin"
    || (user?.primaryEmailAddress?.emailAddress && user.primaryEmailAddress.emailAddress.endsWith("@kasha.com"));

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["admin-products"],
    queryFn: () => apiFetchWithToken("/api/admin/products"),
    enabled: !!isLoaded && !!isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => apiFetchWithToken("/api/admin/products", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product created" }); resetForm(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => apiFetchWithToken(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product updated" }); resetForm(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetchWithToken(`/api/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(false); };

  const startEdit = (p: Product) => {
    setForm({ ...p, priceText: (p.priceInPaise / 100).toFixed(2), thumbnailUrl: p.thumbnailUrl ?? "" });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const data = {
      ...form,
      priceInPaise: Math.round(parseFloat(form.priceText || "0") * 100),
    };
    if (!data.name || !data.modelUrl) {
      toast({ title: "Name and Model URL are required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleModelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingModel(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append("model", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/admin/upload/model`, { method: "POST", body: fd, headers });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setForm(f => ({ ...f, modelUrl: url }));
      toast({ title: "Model uploaded successfully" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingModel(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleThumbFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append("thumbnail", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/admin/upload/thumbnail`, { method: "POST", body: fd, headers });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setForm(f => ({ ...f, thumbnailUrl: url }));
      toast({ title: "Thumbnail uploaded successfully" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingThumb(false);
      if (e.target) e.target.value = "";
    }
  };

  if (!isLoaded) {
    return <Layout><div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8" /></div></Layout>;
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
          <div className="text-6xl">🔒</div>
          <h1 className="text-4xl font-serif text-primary">Admin Access Required</h1>
          <p className="text-muted-foreground max-w-md">You do not have permission to access this page. If you are a KA.SHA team member, please contact your administrator to have your account upgraded.</p>
          <a href="/" className="text-sm font-medium tracking-widest border-b border-primary hover:text-primary transition-colors pb-1">RETURN TO COLLECTION</a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-serif tracking-wider">Admin Panel</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage products, models, and inventory</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 rounded-none">
            <Plus className="w-4 h-4" /> New Product
          </Button>
        </div>

        {/* Product Form */}
        {showForm && (
          <div className="border border-border rounded-none mb-8 p-6 bg-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-serif">{editingId ? "Edit Product" : "New Product"}</h2>
              <button onClick={resetForm}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs tracking-widest text-muted-foreground uppercase">Product Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Signature Polo" className="rounded-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs tracking-widest text-muted-foreground uppercase">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="h-10 border border-input bg-background px-3 text-sm rounded-none"
                >
                  {["polo", "shorts", "trousers", "jacket", "accessories"].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs tracking-widest text-muted-foreground uppercase">Description *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the product..."
                  rows={3}
                  className="border border-input bg-background px-3 py-2 text-sm rounded-none resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs tracking-widest text-muted-foreground uppercase">Price (INR) *</label>
                <Input
                  type="number"
                  value={form.priceText}
                  onChange={e => setForm(f => ({ ...f, priceText: e.target.value }))}
                  placeholder="e.g. 12500"
                  className="rounded-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs tracking-widest text-muted-foreground uppercase">Default Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.defaultColor} onChange={e => setForm(f => ({ ...f, defaultColor: e.target.value }))} className="w-10 h-10 cursor-pointer border border-input rounded-none p-0" />
                  <span className="text-sm text-muted-foreground">{form.defaultColor}</span>
                </div>
              </div>

              {/* Model URL */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs tracking-widest text-muted-foreground uppercase">3D Model (.glb) *</label>
                <div className="flex gap-2">
                  <Input value={form.modelUrl} onChange={e => setForm(f => ({ ...f, modelUrl: e.target.value }))} placeholder="https://... or upload below" className="rounded-none flex-1" />
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="rounded-none" asChild disabled={uploadingModel}>
                      <span>
                        {uploadingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span className="ml-2 hidden sm:inline">Upload .glb</span>
                      </span>
                    </Button>
                    <input ref={modelFileRef} type="file" accept=".glb,.gltf" onChange={handleModelFileUpload} className="hidden" />
                  </label>
                </div>
                {form.modelUrl && <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Model URL set</p>}
              </div>

              {/* Thumbnail URL */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs tracking-widest text-muted-foreground uppercase">Thumbnail Image</label>
                <div className="flex gap-2">
                  <Input value={form.thumbnailUrl || ""} onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))} placeholder="https://... or upload below" className="rounded-none flex-1" />
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="rounded-none" asChild disabled={uploadingThumb}>
                      <span>
                        {uploadingThumb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span className="ml-2 hidden sm:inline">Upload Image</span>
                      </span>
                    </Button>
                    <input ref={thumbFileRef} type="file" accept="image/*" onChange={handleThumbFileUpload} className="hidden" />
                  </label>
                </div>
                {form.thumbnailUrl && (
                  <img src={form.thumbnailUrl} alt="Thumbnail preview" className="h-24 w-24 object-cover mt-1 border border-input" />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs tracking-widest text-muted-foreground uppercase">Available</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.available}
                    onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Product is live and purchasable</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={resetForm} className="rounded-none">Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-none flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Save Changes" : "Create Product"}
              </Button>
            </div>
          </div>
        )}

        {/* Products Table */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No products yet. Create your first product above.</div>
        ) : (
          <div className="border border-border rounded-none overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ background: "rgba(0,0,0,0.3)" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs tracking-widest text-muted-foreground uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs tracking-widest text-muted-foreground uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs tracking-widest text-muted-foreground uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs tracking-widest text-muted-foreground uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs tracking-widest text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs tracking-widest text-muted-foreground uppercase">Model</th>
                  <th className="px-4 py-3 text-center text-xs tracking-widest text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.1)" }}>
                    <td className="px-4 py-3 text-muted-foreground">{p.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="w-10 h-10 object-cover" />}
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{p.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3">{formatPrice(p.priceInPaise)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${p.available ? "bg-emerald-400/20 text-emerald-400" : "bg-red-400/20 text-red-400"}`}>
                        {p.available ? "Live" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a href={p.modelUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline hover:no-underline truncate max-w-[120px] inline-block">
                        {p.modelUrl.split("/").pop() || "View"}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => startEdit(p)} className="p-1 hover:text-primary transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id); }}
                          className="p-1 hover:text-red-400 transition-colors"
                          title="Delete"
                          disabled={deleteMutation.isPending}
                        >
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
    </Layout>
  );
}
