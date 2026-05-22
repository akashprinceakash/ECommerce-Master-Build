import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { LegalPage, Section } from "./terms";

export default function IpPolicyPage() {
  useEffect(() => { document.title = "Intellectual Property & Indemnification Policy — KA.SHA"; }, []);

  return (
    <Layout>
      <LegalPage title="Intellectual Property & Indemnification" updated="18 May 2026">
        <Section title="1. Ownership of Ka·Sha Intellectual Property">
          <p>All content on the Ka·Sha website and platform — including but not limited to brand names, logos, product designs, graphics, text, photographs, software, and the Custom Studio interface — is the exclusive intellectual property of Ka·Sha (PS Fashion) and is protected under applicable Indian and international copyright, trademark, and design laws. Unauthorised reproduction, modification, distribution, or commercial use of any Ka·Sha content is strictly prohibited.</p>
          <p><strong>Trade Dress:</strong> "Trade Dress" refers to the overall visual image and appearance of Ka·Sha's brand and products that identifies Ka·Sha as their source. This includes, but is not limited to, Ka·Sha's distinctive colour palette, garment silhouettes, label design, packaging aesthetics, the look and feel of the website, and the combination of design elements that together create Ka·Sha's recognisable identity. Ka·Sha's Trade Dress is legally protected and may not be copied, imitated, or used in any manner that is likely to cause confusion as to the source or origin of products.</p>
        </Section>

        <Section title="2. Customer-Submitted Designs and Content">
          <p>When you use the Ka·Sha Custom Studio or submit any artwork, graphics, text, logos, patterns, prints, or design elements ("Customer Content") for use in a customised garment order, you represent and warrant that:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>You are the original creator of the Customer Content, or you hold all necessary licences, rights, consents, and permissions to use and reproduce it.</li>
            <li>The Customer Content does not infringe any third-party intellectual property rights, including copyrights, trademarks, patents, design rights, or any other proprietary rights.</li>
            <li>The Customer Content does not violate any applicable law, regulation, or court order.</li>
            <li>The Customer Content is not defamatory, obscene, or otherwise objectionable.</li>
          </ul>
        </Section>

        <Section title="3. Ka·Sha's Limitation of Liability for Customer Content">
          <p>Ka·Sha acts solely as a manufacturer and production facilitator in producing garments based on Customer Content provided by you. Ka·Sha does not independently verify, review, or pre-approve Customer Content for intellectual property compliance prior to production. By submitting Customer Content, you accept full responsibility for ensuring it does not infringe any third-party rights. Accordingly:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Ka·Sha accepts <strong>no responsibility or liability</strong> for any infringement of third-party intellectual property rights arising from or in connection with any Customer Content submitted by you.</li>
            <li>Ka·Sha shall not be liable for any claims, damages, losses, or penalties — whether civil, criminal, or administrative — resulting from Customer Content that infringes any copyright, trademark, or other intellectual property right.</li>
          </ul>
        </Section>

        <Section title="4. Customer Indemnification">
          <p>You agree to <strong>fully indemnify, defend, and hold harmless</strong> Ka·Sha (PS Fashion), its employees, agents, licensors, and service providers from and against any and all claims, liabilities, damages, judgements, awards, losses, costs, expenses, or fees (including reasonable legal fees) arising out of or relating to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Any Customer Content you submit, upload, or provide to Ka·Sha;</li>
            <li>Any alleged or actual infringement of any intellectual property right, privacy right, or other proprietary right of any third party by Customer Content;</li>
            <li>Any breach of the representations and warranties set out in Section 2 above;</li>
            <li>Any use of products produced based on Customer Content in violation of applicable law.</li>
          </ul>
          <p>This indemnification obligation shall survive the completion of your order and the termination of your account.</p>
        </Section>

        <Section title="5. Right to Refuse Orders">
          <p>Ka·Sha reserves the right, at its sole discretion, to refuse, cancel, or suspend any order or account if Ka·Sha reasonably believes that the Customer Content:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Infringes or is likely to infringe any intellectual property right;</li>
            <li>Violates any applicable law or regulation;</li>
            <li>Is otherwise harmful, offensive, or contrary to Ka·Sha's values.</li>
          </ul>
          <p>In such cases, Ka·Sha will notify you and, where applicable, provide a full refund for the refused order.</p>
        </Section>

        <Section title="6. Reporting Infringement">
          <p>If you believe that any content on the Ka·Sha platform infringes your intellectual property rights, please notify us at <strong>support@ka-sha.com</strong> with the following information: a description of the copyrighted or trademarked work claimed to have been infringed; a description of where the allegedly infringing material is located on our platform; your contact information; and a statement that you have a good-faith belief that the use is not authorised. We will investigate and respond promptly.</p>
        </Section>

        <Section title="7. Governing Law">
          <p>This policy is governed by the laws of India, including the Copyright Act 1957, the Trade Marks Act 1999, and the Information Technology Act 2000. Any disputes arising under this policy shall be subject to the exclusive jurisdiction of the courts of Mumbai, Maharashtra.</p>
        </Section>

        <Section title="8. Contact Us">
          <p>For any intellectual property queries, please contact:</p>
          <ul style={{ paddingLeft: 20, marginTop: 4, listStyle: "disc" }}>
            <li>Email: <strong>support@ka-sha.com</strong></li>
            <li>Phone: <strong>9560889594</strong></li>
            <li>Business Hours: Monday to Saturday, 10:00 AM – 6:00 PM</li>
          </ul>
        </Section>
      </LegalPage>
    </Layout>
  );
}
