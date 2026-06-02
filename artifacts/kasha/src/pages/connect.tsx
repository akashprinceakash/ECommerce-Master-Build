import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link, useLocation } from "wouter";

const GOLD = "#B8925A";

type InquiryType = "collaboration" | "sponsorship" | "bulk-order" | "customisation" | "other";

const INQUIRY_OPTIONS: { value: InquiryType; label: string; desc: string }[] = [
  { value: "collaboration",  label: "Collaboration",          desc: "Brand partnerships, athlete endorsements, co-created collections" },
  { value: "sponsorship",    label: "Sponsorship",            desc: "Tournament sponsorships, golf academies and events" },
  { value: "bulk-order",     label: "Bulk Order",             desc: "Corporate gifting, team kits, uniforms (5+ pieces)" },
  { value: "customisation",  label: "Customisation Request",  desc: "Bespoke garments with your brand, artwork or personal design" },
  { value: "other",          label: "Other Enquiry",          desc: "General queries not covered above" },
];

const FIELD: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(0,0,0,0.18)",
  background: "#fff",
  fontFamily: "'Josefin Sans', sans-serif",
  fontSize: 16,
  letterSpacing: "0.04em",
  color: "#1a1a1a",
  padding: "14px 16px",
  outline: "none",
  boxSizing: "border-box",
  borderRadius: 0,
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontFamily: "'Josefin Sans', sans-serif",
  fontSize: 14,
  letterSpacing: "0.22em",
  color: "rgba(0,0,0,0.5)",
  marginBottom: 8,
  textTransform: "uppercase",
};

export default function ConnectPage() {
  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [inquiryType,     setInquiryType]     = useState<InquiryType>("collaboration");
  const [stylePreference, setStylePreference] = useState("");
  const [message,         setMessage]         = useState("");
  const [focused,         setFocused]         = useState<string | null>(null);
  const [submitted,       setSubmitted]       = useState(false);
  const [sending,         setSending]         = useState(false);
  const [sendError,       setSendError]       = useState("");
  const [location] = useLocation();

  useEffect(() => { document.title = "Connect with Us — Ka.Sha"; }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type") as InquiryType | null;
    if (type && INQUIRY_OPTIONS.some(o => o.value === type)) {
      setInquiryType(type);
      setTimeout(() => {
        document.getElementById("connect-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [location]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError("");
    const label = INQUIRY_OPTIONS.find(o => o.value === inquiryType)?.label ?? inquiryType;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, inquiryType: label, stylePreference, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to send");
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Something went wrong. Please try emailing us directly.");
    } finally {
      setSending(false);
    }
  }

  const borderFor = (key: string) => focused === key ? GOLD : "rgba(0,0,0,0.18)";

  return (
    <Layout>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0a0c14", padding: "120px 24px 80px", textAlign: "center" }}>
        <p style={{
          fontFamily: "'Josefin Sans', sans-serif", fontSize: 14,
          letterSpacing: "0.45em", color: GOLD, textTransform: "uppercase", marginBottom: 20,
        }}>
          Ka.Sha — Partnerships &amp; Enquiries
        </p>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 400,
          color: "#fff", lineHeight: 1.1, marginBottom: 24, letterSpacing: "0.03em",
        }}>
          Connect With Us
        </h1>
        <p style={{
          fontFamily: "'Josefin Sans', sans-serif", fontSize: 16, letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.55)", maxWidth: 560, margin: "0 auto", lineHeight: 1.9,
        }}>
          Whether you're a golf academy, a tournament organiser, a corporate looking for team kits,
          or an individual seeking bespoke craftsmanship — we'd love to hear from you.
        </p>
      </section>

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <section id="connect-form" style={{ background: "#F9F8F6", padding: "80px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "60px 24px" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(184,146,90,0.1)", border: `1px solid ${GOLD}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: "#1a1a1a", marginBottom: 12 }}>
                Enquiry Sent
              </h2>
              <p style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 14, letterSpacing: "0.06em", color: "rgba(0,0,0,0.5)", lineHeight: 1.8, maxWidth: 440, margin: "0 auto 32px" }}>
                Thank you, {name}. Your enquiry has been sent directly to our team. We'll respond within 1–2 business days.
              </p>
              <button
                onClick={() => { setSubmitted(false); setName(""); setEmail(""); setMessage(""); setStylePreference(""); }}
                style={{
                  fontFamily: "'Josefin Sans', sans-serif", fontSize: 11, letterSpacing: "0.3em",
                  textTransform: "uppercase", padding: "14px 36px",
                  border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, cursor: "pointer",
                }}
              >
                Send Another Enquiry
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label style={LABEL}>Your Name *</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  style={{ ...FIELD, borderColor: borderFor("name") }}
                  onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} />
              </div>
              <div>
                <label style={LABEL}>Email Address *</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ ...FIELD, borderColor: borderFor("email") }}
                  onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} />
              </div>
            </div>

            {/* Inquiry Type */}
            <div>
              <label style={LABEL}>Type of Enquiry *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {INQUIRY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setInquiryType(opt.value)}
                    style={{
                      padding: "14px 16px", textAlign: "left", cursor: "pointer",
                      border: `1px solid ${inquiryType === opt.value ? GOLD : "rgba(0,0,0,0.18)"}`,
                      background: inquiryType === opt.value ? "#fff" : "transparent",
                      transition: "border-color 0.2s",
                    }}>
                    <div style={{
                      fontFamily: "'Josefin Sans', sans-serif", fontSize: 12, letterSpacing: "0.12em",
                      fontWeight: 600, marginBottom: 4,
                      color: inquiryType === opt.value ? GOLD : "#1a1a1a",
                    }}>{opt.label}</div>
                    <div style={{
                      fontFamily: "'Josefin Sans', sans-serif", fontSize: 11,
                      color: "rgba(0,0,0,0.45)", lineHeight: 1.5, letterSpacing: "0.02em",
                    }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Style Preference */}
            <div>
              <label style={LABEL}>Style Preference</label>
              <input type="text" value={stylePreference} onChange={e => setStylePreference(e.target.value)}
                placeholder="e.g. Minimalist polo, bold prints, monogrammed, team colours…"
                style={{ ...FIELD, borderColor: borderFor("style") }}
                onFocus={() => setFocused("style")} onBlur={() => setFocused(null)} />
            </div>

            {/* Message */}
            <div>
              <label style={LABEL}>Your Message *</label>
              <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={6}
                placeholder="Tell us about your requirements — quantities, timelines, budget, any specific requests…"
                style={{ ...FIELD, resize: "vertical", borderColor: borderFor("message") } as React.CSSProperties}
                onFocus={() => setFocused("message")} onBlur={() => setFocused(null)} />
            </div>

            {sendError && (
              <p style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 13, color: "#c0392b", letterSpacing: "0.04em" }}>
                {sendError}
              </p>
            )}
            <button type="submit" disabled={sending} style={{
              background: GOLD, color: "#fff",
              fontFamily: "'Josefin Sans', sans-serif", fontSize: 12,
              letterSpacing: "0.3em", textTransform: "uppercase",
              padding: "18px 48px", border: "none", cursor: sending ? "default" : "pointer",
              alignSelf: "flex-start", transition: "background 0.2s, opacity 0.2s",
              opacity: sending ? 0.6 : 1,
            }}>
              {sending ? "Sending…" : "Send Enquiry"}
            </button>

          </form>
          )}
        </div>
      </section>

      {/* ── Contact Details ────────────────────────────────────────────────── */}
      <section style={{
        background: "#fff", padding: "60px 24px", textAlign: "center",
        borderTop: "1px solid rgba(0,0,0,0.08)",
      }}>
        <p style={{
          fontFamily: "'Josefin Sans', sans-serif", fontSize: 14,
          letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase", marginBottom: 24,
        }}>
          Reach Us Directly
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <a href="https://mail.google.com/mail/?view=cm&to=support@kashaonline.in"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "'Josefin Sans', sans-serif", fontSize: 18, letterSpacing: "0.08em",
              color: "#1a1a1a", textDecoration: "none",
            }}
            className="hover:text-[#B8925A] transition-colors">
            support@kashaonline.in
          </a>
          <a href="tel:+919560889594" style={{
            fontFamily: "'Josefin Sans', sans-serif", fontSize: 17, letterSpacing: "0.08em",
            color: "rgba(0,0,0,0.55)", textDecoration: "none",
          }}
            className="hover:text-[#B8925A] transition-colors">
            +91 95608 89594
          </a>
          <p style={{
            fontFamily: "'Josefin Sans', sans-serif", fontSize: 14,
            letterSpacing: "0.06em", color: "rgba(0,0,0,0.38)", marginTop: 4,
          }}>
            Mon – Sat &nbsp;·&nbsp; 10 AM – 6 PM IST
          </p>
        </div>

        <div style={{ marginTop: 40 }}>
          <Link href="/products" style={{
            fontFamily: "'Josefin Sans', sans-serif", fontSize: 13, letterSpacing: "0.3em",
            color: "rgba(0,0,0,0.5)", textDecoration: "none", textTransform: "uppercase",
          }}
            className="hover:text-[#B8925A] transition-colors">
            ← Back to Collection
          </Link>
        </div>
      </section>

    </Layout>
  );
}
