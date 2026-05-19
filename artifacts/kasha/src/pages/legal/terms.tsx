import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";

const GOLD = "#B8925A";
const BG = "#FAFAF7";
const TX = "#0A0A0A";
const MUTED = "rgba(0,0,0,0.6)";
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI = "'Josefin Sans', sans-serif";

export default function TermsPage() {
  useEffect(() => { document.title = "Terms of Service — KA.SHA"; }, []);

  return (
    <Layout>
      <LegalPage title="Terms of Service" updated="15 May 2026">
        <Section title="1. Acceptance of Terms">
          <p>By accessing or placing an order on ka-sha.com ("Site"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree, please do not use the Site.</p>
        </Section>
        <Section title="2. Products & Bespoke Orders">
          <p>KA.SHA offers premium golf and sportswear, including bespoke customised garments. Product descriptions and images are provided in good faith. Slight variations in colour between screen display and actual fabric are inherent to the manufacturing process and not grounds for a refund.</p>
          <p>Bespoke or customised orders (products personalised through the Custom Studio) are made to order and are non-refundable once production has commenced, except in cases of a manufacturing defect.</p>
        </Section>
        <Section title="3. Pricing & Payment">
          <p>All prices are listed in Indian Rupees (₹) and are inclusive of applicable GST. KA.SHA reserves the right to modify prices at any time. Payment is processed securely through Razorpay. By completing a purchase you confirm that the payment method belongs to you.</p>
        </Section>
        <Section title="4. Order Confirmation & Cancellation">
          <p>An order confirmation email is sent upon successful payment. KA.SHA reserves the right to cancel any order due to stock unavailability or suspected fraud, with a full refund to the original payment method within 5–7 business days.</p>
          <p>You may cancel a standard (non-bespoke) order within 24 hours of placement by contacting us at hello@ka-sha.com.</p>
        </Section>
        <Section title="5. Intellectual Property">
          <p>All content on this Site — including text, images, logos, product designs, and the KA.SHA brand — is the exclusive property of KA.SHA and protected under Indian copyright law. Unauthorised reproduction or commercial use is strictly prohibited.</p>
        </Section>
        <Section title="6. User Accounts">
          <p>You are responsible for maintaining the confidentiality of your account credentials. KA.SHA is not liable for losses arising from unauthorised account access due to negligence on your part.</p>
        </Section>
        <Section title="7. Limitation of Liability">
          <p>To the fullest extent permitted by law, KA.SHA is not liable for any indirect, incidental, or consequential damages arising from your use of the Site or purchase of products. Our total liability shall not exceed the amount paid for the relevant order.</p>
        </Section>
        <Section title="8. Governing Law">
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Mumbai, Maharashtra.</p>
        </Section>
        <Section title="9. Contact">
          <p>For any queries regarding these Terms, write to us at <strong>support@kashaonline.in</strong> or call <strong>+91 95608 89594</strong>.</p>
        </Section>
      </LegalPage>
    </Layout>
  );
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div style={{ background: BG, minHeight: "calc(100vh - 64px)" }}>
      <div
        style={{
          background: "#F5F2EC",
          borderBottom: "1px solid rgba(184,146,90,0.25)",
          padding: "52px 24px 40px",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: FONT_UI, fontSize: 8, letterSpacing: "0.45em", color: GOLD, textTransform: "uppercase", marginBottom: 14 }}>
          Legal
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 400, color: TX, letterSpacing: "0.02em" }}>
          {title}
        </h1>
        <p style={{ fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.12em", color: MUTED, marginTop: 10 }}>
          Last updated: {updated}
        </p>
      </div>
      <div className="max-w-[760px] mx-auto px-6 py-14">
        <div className="flex flex-col gap-8" style={{ fontFamily: FONT_UI, fontSize: 13, lineHeight: 1.9, color: MUTED, letterSpacing: "0.02em" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 500, color: TX, letterSpacing: "0.02em", marginBottom: 10 }}>
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export { LegalPage, Section };
