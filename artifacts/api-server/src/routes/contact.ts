import { Router } from "express";
import sgMail from "@sendgrid/mail";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { contactEnquiriesTable } from "@workspace/db/schema";

const router = Router();

const SENDGRID_API_KEY = process.env["SENDGRID_API_KEY"] ?? "";
const FROM_EMAIL = process.env["SENDGRID_FROM_EMAIL"] ?? "orders@kashaonline.in";
const ADMIN_EMAIL = "pranaysomaia715@gmail.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

router.post("/contact", async (req, res) => {
  const { name, email, inquiryType, stylePreference, message } = req.body as {
    name?: string;
    email?: string;
    inquiryType?: string;
    stylePreference?: string;
    message?: string;
  };

  if (!name || !email || !message) {
    res.status(400).json({ error: "Name, email and message are required" });
    return;
  }

  const [row] = await db.insert(contactEnquiriesTable).values({
    name,
    email,
    inquiryType: inquiryType ?? "Other",
    stylePreference: stylePreference || null,
    message,
    emailSent: false,
  }).returning({ id: contactEnquiriesTable.id });

  res.json({ ok: true });

  if (SENDGRID_API_KEY && row) {
    const subject = `${inquiryType ?? "General"} Enquiry from ${name}`;
    const html = `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#FAFAF7;">
        <p style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#B8925A;margin:0 0 20px;">Ka.Sha — Website Enquiry</p>
        <h2 style="font-size:22px;font-weight:400;color:#1a1a18;margin:0 0 24px;">${subject}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#444;">
          <tr><td style="padding:8px 0;color:#888;width:140px;">Name</td><td style="padding:8px 0;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#B8925A;">${email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#888;">Type</td><td style="padding:8px 0;">${inquiryType ?? "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Style Pref.</td><td style="padding:8px 0;">${stylePreference || "Not specified"}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#fff;border:1px solid #E8E4DE;border-radius:4px;">
          <p style="font-size:12px;color:#888;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em;">Message</p>
          <p style="font-size:14px;color:#1a1a18;white-space:pre-wrap;margin:0;">${message}</p>
        </div>
      </div>
    `;
    sgMail
      .send({
        to: ADMIN_EMAIL,
        from: { email: FROM_EMAIL, name: "Ka.SHA Website" },
        replyTo: { email, name },
        subject,
        html,
      })
      .then(() => {
        db.update(contactEnquiriesTable)
          .set({ emailSent: true })
          .where(eq(contactEnquiriesTable.id, row.id))
          .catch((e: unknown) => logger.warn({ err: e }, "Could not mark enquiry email_sent"));
      })
      .catch((err: unknown) => {
        logger.warn({ err }, "SendGrid failed — enquiry already saved to DB");
      });
  }
});

export default router;
