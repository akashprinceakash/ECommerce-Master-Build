import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { LegalPage, Section } from "./terms";

export default function ReturnsPage() {
  useEffect(() => { document.title = "Return & Refund Policy — KA.SHA"; }, []);

  return (
    <Layout>
      <LegalPage title="Return & Refund Policy" updated="18 May 2026">
        <Section title="1. Eligibility for Returns">
          <p>We accept returns under the following conditions:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>The product must be unused, unwashed, and in its original condition.</li>
            <li>Original tags, packaging, and invoice must be available.</li>
            <li>Return requests must be raised within <strong>7 days</strong> of delivery.</li>
            <li>Products purchased during clearance sales, special discounts, or promotional offers may not be eligible for return.</li>
          </ul>
        </Section>

        <Section title="2. Non-Returnable Items">
          <p>The following items are not eligible for return or exchange:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Innerwear and personal wear items</li>
            <li>Gift cards or vouchers</li>
            <li>Customized or altered products</li>
            <li>Damaged products due to misuse by the customer</li>
          </ul>
        </Section>

        <Section title="3. Return Process">
          <p>To initiate a return:</p>
          <ol style={{ paddingLeft: 20, marginTop: 4, listStyle: "decimal" }}>
            <li>Contact our support team at <strong>support@kashaonline.in</strong> or call <strong>+91 95608 89594</strong> with your order details.</li>
            <li>Share photos/videos if the item is damaged or incorrect.</li>
            <li>Our team will verify the request and arrange pickup where applicable.</li>
            <li>Once the product is received and inspected, the return will be approved.</li>
          </ol>
        </Section>

        <Section title="4. Refund Policy">
          <p>Refunds will be processed after successful quality inspection of the returned item.</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Approved refunds will be credited to the original payment method.</li>
            <li>Refund processing may take <strong>5–10 business days</strong> depending on the bank/payment provider.</li>
            <li>For Cash on Delivery (COD) orders, customers may be asked to provide bank account details for refund processing.</li>
          </ul>
        </Section>

        <Section title="5. Exchange Policy">
          <p>We offer exchanges subject to product availability. Exchange requests can be made for:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Size issues</li>
            <li>Wrong product received</li>
            <li>Defective or damaged products</li>
          </ul>
          <p>If the requested size/product is unavailable, a refund or store credit may be provided.</p>
        </Section>

        <Section title="6. Damaged or Incorrect Products">
          <p>If you receive a damaged, defective, or incorrect product:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Report the issue within <strong>24 hours</strong> of delivery.</li>
            <li>Share clear photos/videos of the package and product.</li>
            <li>Our team will resolve the issue at the earliest possible time.</li>
          </ul>
        </Section>

        <Section title="7. Cancellation Policy">
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Orders can be cancelled before dispatch.</li>
            <li>Once the order is shipped, cancellation requests may not be accepted.</li>
            <li>Refunds for prepaid cancelled orders will be processed within <strong>5–7 business days</strong>.</li>
          </ul>
        </Section>

        <Section title="8. Shipping Charges for Returns">
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Return shipping may be free for damaged, defective, or incorrect products.</li>
            <li>For other returns, shipping charges may be deducted from the refund amount.</li>
          </ul>
        </Section>

        <Section title="9. Contact Us">
          <p>For return, refund, or exchange-related support, contact us:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Email: <strong>support@kashaonline.in</strong></li>
            <li>Phone: <strong>9560889594</strong></li>
            <li>Business Hours: Monday to Saturday, 10:00 AM – 6:00 PM</li>
          </ul>
        </Section>

        <Section title="Important Note">
          <p>By placing an order on our website, you agree to the terms and conditions mentioned in this Return &amp; Refund Policy.</p>
        </Section>
      </LegalPage>
    </Layout>
  );
}
