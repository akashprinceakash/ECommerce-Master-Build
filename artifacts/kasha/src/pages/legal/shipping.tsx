import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { LegalPage, Section } from "./terms";

export default function ShippingPage() {
  useEffect(() => { document.title = "Shipping Policy — KA.SHA"; }, []);

  return (
    <Layout>
      <LegalPage title="Shipping Policy" updated="18 May 2026">
        <Section title="1. Order Processing">
          <p>All orders are processed within <strong>1–3 business days</strong> after successful payment confirmation. Orders placed on weekends or public holidays will be processed on the next working day. Once your order is shipped, you will receive a confirmation message/email with tracking details.</p>
        </Section>

        <Section title="2. Shipping Coverage">
          <p>We currently ship across India through trusted courier partners. Delivery availability may vary depending on the pin code and courier serviceability.</p>
        </Section>

        <Section title="3. Estimated Delivery Time">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.1)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Location</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Estimated Delivery Time</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Metro Cities", "3–5 Business Days"],
                ["Other Cities & Towns", "5–7 Business Days"],
                ["Remote Areas", "7–10 Business Days"],
              ].map(([loc, time]) => (
                <tr key={loc} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <td style={{ padding: "10px 12px" }}>{loc}</td>
                  <td style={{ padding: "10px 12px" }}>{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 8 }}>Delivery timelines are approximate and may vary during festivals, public holidays, weather conditions, or unforeseen logistics delays. Delivery time is referred to the amount of time taken by the courier once the package/items are handed over and not from the time of placement of the order.</p>
        </Section>

        <Section title="4. Shipping Charges">
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Free Shipping will only be applicable if specifically mentioned against an order.</li>
            <li>Shipping charges will be based on the charges levied by the shipping company.</li>
            <li>Shipping charges, if applicable, will be displayed during checkout.</li>
          </ul>
        </Section>

        <Section title="5. Order Tracking">
          <p>Once your order is dispatched, tracking details will be shared via email, SMS, or WhatsApp. Customers can use the tracking link to monitor shipment status in real time.</p>
        </Section>

        <Section title="6. Delayed or Failed Deliveries">
          <p>While we strive for timely delivery, delays may occur due to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Incorrect shipping address</li>
            <li>Courier partner issues</li>
            <li>Natural calamities or weather conditions</li>
            <li>Government restrictions or public holidays</li>
          </ul>
          <p>If delivery fails after multiple attempts, the order may be returned to us.</p>
        </Section>

        <Section title="7. Address Changes">
          <p>Customers are requested to provide accurate shipping information while placing the order. Address modifications can only be requested before dispatch. Once shipped, address changes may not be possible.</p>
        </Section>

        <Section title="8. Damaged or Open Packages">
          <p>If you receive a damaged, tampered, or open package:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Do not accept the package if possible.</li>
            <li>Take photos/videos immediately.</li>
            <li>Contact our support team within <strong>24 hours</strong> of delivery.</li>
          </ul>
        </Section>

        <Section title="9. International Shipping">
          <p>Currently, we only ship within India. International shipping is not available at this time.</p>
        </Section>

        <Section title="10. Contact Us">
          <p>For shipping-related queries, please contact us:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Email: <a href="https://mail.google.com/mail/?view=cm&to=support@kashaonline.in" target="_blank" rel="noopener noreferrer" style={{ color: "#B8925A" }}>support@kashaonline.in</a></li>
            <li>Phone: <strong>+91 9560889594</strong></li>
            <li>Business Hours: Monday to Saturday, 10:00 AM – 6:00 PM</li>
          </ul>
        </Section>

        <Section title="Important Note">
          <p>By placing an order on our website, you agree to the terms and conditions mentioned in this Shipping Policy.</p>
        </Section>
      </LegalPage>
    </Layout>
  );
}
