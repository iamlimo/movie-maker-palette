import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import nodemailer from "https://esm.sh/nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTicketNotificationRequest {
  ticketId: string;
  ticketNumber: string;
  userId: string;
  userEmail: string;
  ticketTitle: string;
  ticketPriority: string;
  userMessage: string;
}

// Email templates
const emailTemplate = (ticketNumber: string, ticketTitle: string, priority: string, message: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
    .ticket-info { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea; }
    .priority { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .priority-high { background: #fee2e2; color: #991b1b; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-low { background: #dcfce7; color: #166534; }
    .message { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎫 Support Ticket Created</h1>
      <p>Your ticket has been created and is being reviewed</p>
    </div>
    
    <div class="content">
      <p>Hello,</p>
      
      <p>Thank you for reaching out to our support team. We have created a support ticket for you and assigned it to the appropriate team.</p>
      
      <div class="ticket-info">
        <h3 style="margin-top: 0; color: #1f2937;">Ticket Details</h3>
        <p><strong>Ticket Number:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${ticketNumber}</code></p>
        <p><strong>Title:</strong> ${ticketTitle}</p>
        <p><strong>Priority:</strong> <span class="priority priority-${priority.toLowerCase()}">${priority}</span></p>
      </div>
      
      <div class="message">
        <h3 style="margin-top: 0; color: #1f2937;">Your Ticket Message</h3>
        <p>${message.replace(/\n/g, '<br>')}</p>
      </div>
      
      <p><strong>What happens next?</strong></p>
      <ul>
        <li>Our team will review your ticket promptly</li>
        <li>We will update you via email on the status and resolution</li>
        <li>For urgent issues, you can expect a response within 24 hours</li>
      </ul>
      
      <p>If you need to provide additional information, please reply to this email or reference your ticket number: <strong>${ticketNumber}</strong></p>
      
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0;"><strong>ℹ️ Note:</strong> This is an automated notification. Please do not reply with attachments larger than 10MB.</p>
      </div>
      
      <div class="footer">
        <p>© 2026 Our Support Team. All rights reserved.</p>
        <p>Ticket Reference: ${ticketNumber}</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Zohomail SMTP Configuration
    const zohoSmtpHost = Deno.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com";
    const zohoSmtpPort = parseInt(Deno.env.get("ZOHO_SMTP_PORT") || "465");
    const zohoEmail = Deno.env.get("ZOHO_EMAIL") || "ceo@signaturetv.co";
    const zohoPassword = Deno.env.get("ZOHO_PASSWORD");
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "ceo@signaturetv.co";
    const replyToEmail = Deno.env.get("REPLY_TO_EMAIL") || adminEmail;

    if (!zohoPassword) {
      throw new Error("ZOHO_PASSWORD environment variable is required");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: SendTicketNotificationRequest = await req.json();
    const { ticketId, ticketNumber, userId, userEmail, ticketTitle, ticketPriority, userMessage } = body;

    console.log(`Processing ticket notification for ${userEmail}`);

    // Create Zohomail transporter
    const transporter = nodemailer.createTransport({
      host: zohoSmtpHost,
      port: zohoSmtpPort,
      secure: zohoSmtpPort === 465,
      auth: {
        user: zohoEmail,
        pass: zohoPassword,
      },
    });

    // Log email event
    try {
      await supabase.from("email_logs").insert({
        ticket_id: ticketId,
        recipient_email: userEmail,
        subject: `Support Ticket Created: ${ticketNumber}`,
        template_type: "ticket_created",
        status: "pending",
        sent_at: null,
      });
    } catch (err) {
      console.warn("Warning: Could not log email event", err);
    }

    // Send email to user using Zohomail SMTP
    try {
      const emailHtml = emailTemplate(ticketNumber, ticketTitle, ticketPriority, userMessage);

      const userEmailResult = await transporter.sendMail({
        from: `"Support Team" <${zohoEmail}>`,
        to: userEmail,
        subject: `Support Ticket Created: ${ticketNumber}`,
        html: emailHtml,
        replyTo: replyToEmail,
      });

      console.log(`Email sent successfully to ${userEmail}, Message ID: ${userEmailResult.messageId}`);

      // Update email log
      try {
        await supabase
          .from("email_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            external_id: userEmailResult.messageId,
          })
          .eq("ticket_id", ticketId)
          .eq("recipient_email", userEmail);
      } catch (err) {
        console.warn("Warning: Could not update email log", err);
      }

      // Also send notification to admin
      try {
        await transporter.sendMail({
          from: `"Support System" <${zohoEmail}>`,
          to: adminEmail,
          subject: `[ADMIN] New Support Ticket: ${ticketNumber} (${ticketPriority})`,
          replyTo: replyToEmail,
          html: `
            <h2>🎫 New Support Ticket Created</h2>
            <p><strong>Ticket Number:</strong> <code>${ticketNumber}</code></p>
            <p><strong>User Email:</strong> ${userEmail}</p>
            <p><strong>Title:</strong> ${ticketTitle}</p>
            <p><strong>Priority:</strong> <strong>${ticketPriority}</strong></p>
            <hr>
            <h3>User Message:</h3>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${userMessage}</pre>
            <p><a href="${supabaseUrl}/admin/tickets/${ticketId}" style="display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Ticket in Dashboard</a></p>
          `,
        });
        console.log(`Admin notification sent to ${adminEmail}`);
      } catch (err) {
        console.warn("Warning: Could not send admin notification", err);
      }
    } catch (error) {
      console.error("Email send failed:", error);

      // Update email log with error
      try {
        await supabase
          .from("email_logs")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("ticket_id", ticketId)
          .eq("recipient_email", userEmail);
      } catch (err) {
        console.warn("Warning: Could not update email log with error", err);
      }
    }

    // Update ticket status to mark as notified
    try {
      await supabase
        .from("tickets")
        .update({ notification_sent: true })
        .eq("id", ticketId);
    } catch (err) {
      console.warn("Warning: Could not update ticket notification status", err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Ticket notification processed",
        ticketNumber,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-ticket-notification:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
