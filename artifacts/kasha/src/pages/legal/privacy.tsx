import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { LegalPage, Section } from "./terms";

export default function PrivacyPage() {
  useEffect(() => { document.title = "Privacy Policy — KA.SHA"; }, []);

  return (
    <Layout>
      <LegalPage title="Privacy Policy" updated="18 May 2026">
        <Section title="1. Information We Collect">
          <p>We may collect the following types of information:</p>
          <p><strong>Personal Information:</strong></p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Full name</li>
            <li>Email address</li>
            <li>Phone number</li>
            <li>Shipping and billing address</li>
            <li>Payment details (processed securely through payment gateways)</li>
          </ul>
          <p style={{ marginTop: 8 }}><strong>Non-Personal Information:</strong></p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>IP address</li>
            <li>Browser type and device information</li>
            <li>Website usage data through cookies and analytics tools</li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the collected information to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Process and deliver orders</li>
            <li>Provide customer support</li>
            <li>Improve our website and services</li>
            <li>Send order updates and promotional communications</li>
            <li>Prevent fraud and unauthorized transactions</li>
            <li>Comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="3. Payment Security">
          <p>We do not store your debit/credit card details on our servers. All payments are processed securely through trusted third-party payment gateways that follow industry-standard security practices.</p>
        </Section>

        <Section title="4. Cookies and Tracking Technologies">
          <p>Our website may use cookies and similar technologies to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Improve website functionality</li>
            <li>Remember customer preferences</li>
            <li>Analyse website traffic and performance</li>
            <li>Provide a better shopping experience</li>
          </ul>
          <p>You can disable cookies through your browser settings if preferred.</p>
        </Section>

        <Section title="5. Sharing of Information">
          <p>We do not sell, rent, or trade your personal information. Your information may be shared only with:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Delivery and logistics partners</li>
            <li>Payment gateway providers</li>
            <li>Service providers assisting in website operations</li>
            <li>Government authorities if required by law</li>
          </ul>
        </Section>

        <Section title="6. Data Protection">
          <p>We implement reasonable security measures to protect your personal information from unauthorised access, misuse, or disclosure. However, no online transmission or storage system can be guaranteed to be 100% secure.</p>
        </Section>

        <Section title="7. Third-Party Links">
          <p>Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of external websites. Customers are advised to review the privacy policies of those websites separately.</p>
        </Section>

        <Section title="8. User Rights">
          <p>Customers may request to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Access their personal data</li>
            <li>Correct inaccurate information</li>
            <li>Delete their personal information</li>
            <li>Opt out of promotional communications</li>
          </ul>
          <p>Requests can be made by contacting our support team at <strong>support@kashaonline.in</strong>.</p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>Our website is not intended for individuals below 18 years of age. We do not knowingly collect personal information from minors.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>We reserve the right to update or modify this Privacy Policy at any time. Changes will be posted on this page with the updated effective date.</p>
        </Section>

        <Section title="11. Contact Us">
          <p>If you have any questions regarding this Privacy Policy, please contact us:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Email: <strong>support@kashaonline.in</strong></li>
            <li>Phone: <strong>9560889594</strong></li>
            <li>Business Hours: Monday to Saturday, 10:00 AM – 6:00 PM</li>
          </ul>
        </Section>

        <Section title="Important Note">
          <p>By using our website, you consent to the terms mentioned in this Privacy Policy.</p>
        </Section>
      </LegalPage>
    </Layout>
  );
}
