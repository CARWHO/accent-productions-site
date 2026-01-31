// Supabase Edge Function: send-email-client
// Sends invoice email to client with PDF attachment
// Reads total from Google Sheet (source of truth)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://accent-productions.co.nz";
const EDGE_FUNCTION_SECRET = Deno.env.get("EDGE_FUNCTION_SECRET") || "default-secret-change-me";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateUUID(): string {
  return crypto.randomUUID();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function readQuoteSheetData(spreadsheetId: string): Promise<{ total: number } | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/read-quote-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify({ spreadsheetId }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Accent Productions <notifications@accent-productions.co.nz>",
        to: [to],
        subject,
        html,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { bookingId, adjustedAmount, notes, depositPercent, purchaseOrder } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing booking ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return new Response(
        JSON.stringify({ success: false, message: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate invoice number
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${booking.quote_number?.split("-")[1] || generateUUID().slice(0, 4).toUpperCase()}`;

    // Generate client approval token
    const clientApprovalToken = generateUUID();

    // Get total from Google Sheet (source of truth)
    let finalAmount = adjustedAmount || booking.quote_total || 0;

    if (booking.quote_sheet_id) {
      const sheetData = await readQuoteSheetData(booking.quote_sheet_id);
      if (sheetData && sheetData.total > 0) {
        finalAmount = sheetData.total;
      }
    }

    // Calculate deposit
    const depositPercentValue = depositPercent ?? 50;
    const depositAmount = (finalAmount * depositPercentValue) / 100;

    // Check if resend
    const { data: existingApproval } = await supabase
      .from("client_approvals")
      .select("resend_count")
      .eq("booking_id", bookingId)
      .single();

    const isResend = !!existingApproval;
    const resendCount = (existingApproval?.resend_count || 0) + (isResend ? 1 : 0);

    // Create/update client_approvals
    const { error: approvalError } = await supabase
      .from("client_approvals")
      .upsert({
        booking_id: bookingId,
        adjusted_quote_total: finalAmount,
        quote_notes: notes || null,
        deposit_amount: depositAmount,
        client_approval_token: clientApprovalToken,
        sent_to_client_at: new Date().toISOString(),
        client_email: booking.client_email,
        resend_count: resendCount,
      }, { onConflict: "booking_id" });

    if (approvalError) {
      return new Response(
        JSON.stringify({ success: false, message: "Failed to create approval record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking with invoice number and purchase order
    await supabase
      .from("bookings")
      .update({
        status: "sent_to_client",
        invoice_number: invoiceNumber,
        purchase_order: purchaseOrder || null,
      })
      .eq("id", bookingId);

    // Generate invoice PDF via generate-invoice edge function
    let invoiceDriveLink: string | null = null;
    if (booking.quote_sheet_id) {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ booking_id: bookingId, pdfType: "invoice" }),
        });

        if (response.ok) {
          const result = await response.json();
          invoiceDriveLink = result.driveLink;
        }
      } catch (e) {
        console.error("Error generating invoice PDF:", e);
      }
    }

    // Send email
    const approveUrl = `${SITE_URL}/api/client-approve?token=${clientApprovalToken}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
        <div style="margin-bottom: 24px;">
          <img src="${SITE_URL}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
        </div>

        <h1 style="color: #16a34a; margin: 0 0 20px 0;">${isResend ? "Updated Quote" : "Invoice Ready"}</h1>

        <p>Hi ${booking.client_name.split(" ")[0]},</p>
        <p>${isResend
          ? "We've updated your quote based on your feedback. Please review the changes and approve when ready."
          : "Thanks for booking with us! Please review and approve your invoice to confirm the booking."
        }</p>

        <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 20px 0;">
          <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">${invoiceDriveLink ? `<a href="${invoiceDriveLink}" style="color: #166534; text-decoration: none;">Invoice #${invoiceNumber}</a>` : `Invoice #${invoiceNumber}`}</div>
          <div style="font-size: 36px; font-weight: bold; color: #15803d; margin-bottom: 15px;">$${finalAmount.toFixed(2)}</div>
          <div style="border-top: 1px solid #bbf7d0; padding-top: 15px;">
            <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${booking.event_name || "Your Event"}</p>
            <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${formatDate(booking.event_date)}</p>
            <p style="margin: 0;"><strong>Location:</strong> ${booking.location || "TBC"}</p>
          </div>
        </div>

        ${depositAmount > 0 ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="font-size: 14px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Deposit Required (${depositPercentValue}%)</div>
          <div style="font-size: 28px; font-weight: bold; color: #b45309;">$${depositAmount.toFixed(2)}</div>
          <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
            A ${depositPercentValue}% deposit is required to confirm your booking.
          </p>
        </div>
        ` : ""}

        ${notes ? `
        <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Note:</strong> ${notes}</p>
        </div>
        ` : ""}

        <p style="margin-top: 25px;">${depositAmount > 0 ? "Click below to approve and pay your deposit:" : "Click below to confirm your booking:"}</p>

        <div style="margin: 30px 0;">
          <a href="${approveUrl}"
             style="display: inline-block; background: #16a34a; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            ${depositAmount > 0 ? "Approve & Pay Deposit" : "Approve Quote"}
          </a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Questions? Reply to this email or call us on 027 602 3869.
        </p>

        ${invoiceDriveLink ? `
        <div style="margin: 20px 0;">
          <a href="${invoiceDriveLink}" style="color: #2563eb; font-size: 14px;">View Invoice</a>
        </div>
        ` : ""}

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
        <p style="color: #999; font-size: 12px;">
          Accent Productions | Professional Sound & Lighting
        </p>
      </div>
    `;

    const subject = isResend
      ? `Updated Quote from Accent Productions - ${booking.event_name || "Your Event"}`
      : `Invoice from Accent Productions - ${booking.event_name || "Your Event"}`;

    await sendEmail(booking.client_email, subject, emailHtml);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invoice sent to client",
        invoiceNumber,
        clientApprovalId: clientApprovalToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-email-client] Error:", error);
    return new Response(
      JSON.stringify({ success: false, message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
