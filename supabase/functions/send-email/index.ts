// Supabase Edge Function: send-email
// Step 3 of 3: Sends email with Google Drive links to PDFs
// Triggered by database webhook when status = 'pdfs_ready'
// PDFs are linked from Google Drive (not attached) to avoid memory limits

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ENVIRONMENT & CONFIG
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const BUSINESS_EMAIL = Deno.env.get("BUSINESS_EMAIL") || "hello@accent-productions.co.nz";
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://accent-productions.co.nz";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACKAGE_LABELS: Record<string, string> = {
  small: "Small Event (10-50 people)",
  medium: "Medium Event (50-200 people)",
  large: "Large Event (200-1000 people)",
  "extra-large": "Extra-Large Event (1000+ people)",
};

// ============================================
// TYPES
// ============================================

interface BacklineFormData {
  type: "backline";
  equipment: { name: string; quantity: number }[];
  otherEquipment?: string;
  startDate: string;
  endDate: string;
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress?: string;
  additionalNotes?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface FullSystemFormData {
  type?: "fullsystem";
  package: string;
  eventType: string;
  eventName: string;
  organization: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventTime?: string;
  setupTime?: string;
  attendance?: number;
  playbackFromDevice: boolean;
  hasLiveMusic: boolean;
  needsMic: boolean;
  hasDJ: boolean;
  hasBand: boolean;
  bandCount?: number;
  bandNames: string;
  needsDJTable: boolean;
  needsCDJs: boolean;
  cdjType: string;
  hasSpeeches: boolean;
  needsWirelessMic: boolean;
  needsLectern: boolean;
  needsAmbientMusic: boolean;
  additionalInfo: string;
  location: string;
  venueContact: string;
  indoorOutdoor: string;
  wetWeatherPlan: string;
  needsGenerator: boolean;
  powerAccess: string;
  hasStage: boolean;
  stageDetails: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  details: string;
}

type FormData = BacklineFormData | FullSystemFormData;

interface QuoteOutput {
  quoteNumber: string;
  unavailableGear?: string[];
}

// ============================================
// UTILITIES
// ============================================

function isBacklineInquiry(formData: FormData): formData is BacklineFormData {
  return (formData as BacklineFormData).type === "backline";
}

// ============================================
// EMAIL
// ============================================

async function sendEmail(options: { to: string[]; subject: string; html: string }): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Accent Productions <notifications@accent-productions.co.nz>",
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });
  if (!response.ok) throw new Error(`Resend API error: ${await response.text()}`);
}

// ============================================
// EMAIL HTML BUILDERS
// ============================================

function getSheetEditLink(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

function buildBacklineEmailHtml(formData: BacklineFormData, quote: QuoteOutput, approvalToken: string, quoteSheetId: string | null, jobsheetSheetId: string | null): string {
  // Count total items
  const totalItems = formData.equipment.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
      <h1 style="margin-bottom: 5px;">Backline Hire Request</h1>
      <p style="color: #666; margin-top: 0;">Quote #${quote.quoteNumber}</p>

      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;"><strong>${formData.contactName}</strong></p>
        <p style="margin: 0 0 8px 0; color: #4b5563;">${formData.contactEmail} · ${formData.contactPhone}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;" />
        <p style="margin: 0 0 8px 0;"><strong>Dates:</strong> ${formData.startDate} → ${formData.endDate}</p>
        <p style="margin: 0 0 8px 0;"><strong>Items:</strong> ${totalItems} piece${totalItems !== 1 ? "s" : ""} of gear</p>
        <p style="margin: 0;"><strong>Method:</strong> ${formData.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}</p>
      </div>

      <div style="margin: 25px 0;">
        <a href="${SITE_URL}/review-quote?token=${approvalToken}"
           style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          Review Quote
        </a>
      </div>

      <div style="margin: 20px 0;">
        ${quoteSheetId ? `<a href="${getSheetEditLink(quoteSheetId)}" style="margin-right: 16px; color: #2563eb; font-size: 14px;">Edit Quote Sheet</a>` : ""}
        ${jobsheetSheetId ? `<a href="${getSheetEditLink(jobsheetSheetId)}" style="color: #2563eb; font-size: 14px;">Edit Jobsheet</a>` : ""}
      </div>
    </div>
  `;
}

function buildFullSystemEmailHtml(formData: FullSystemFormData, quote: QuoteOutput, approvalToken: string, quoteSheetId: string | null, jobsheetSheetId: string | null): string {
  const eventTime = formData.eventTime || (formData.eventStartTime && formData.eventEndTime ? `${formData.eventStartTime} - ${formData.eventEndTime}` : null);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
      <p style="margin: 0 0 15px 0;">
        <strong>${formData.contactName}</strong>${formData.organization ? ` · ${formData.organization}` : ""}<br>
        ${formData.eventName || "Sound System"} · ${formData.location || "TBC"}<br>
        ${formData.eventDate}${eventTime ? ` · ${eventTime}` : ""}
      </p>

      <div style="margin: 20px 0;">
        <a href="${SITE_URL}/review-quote?token=${approvalToken}"
           style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Review #${quote.quoteNumber}
        </a>
      </div>

      <div style="margin: 20px 0;">
        ${quoteSheetId ? `<a href="${getSheetEditLink(quoteSheetId)}" style="margin-right: 16px; color: #2563eb; font-size: 14px;">Edit Quote Sheet</a>` : ""}
        ${jobsheetSheetId ? `<a href="${getSheetEditLink(jobsheetSheetId)}" style="color: #2563eb; font-size: 14px;">Edit Jobsheet</a>` : ""}
      </div>
    </div>
  `;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const inquiry_id = payload.record?.id || payload.inquiry_id;
    if (!inquiry_id) return new Response(JSON.stringify({ error: "Missing inquiry_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`[send-email] Processing: ${inquiry_id}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: inquiry, error: fetchError } = await supabase.from("inquiries").select("*").eq("id", inquiry_id).single();
    if (fetchError || !inquiry) throw new Error(`Failed to fetch inquiry: ${fetchError?.message}`);
    if (inquiry.status !== "sheets_ready") return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const formData: FormData = inquiry.form_data_json;
    const quote: QuoteOutput = inquiry.quote_data;
    const isBackline = isBacklineInquiry(formData);

    if (!quote) throw new Error("No quote_data found");

    // Get Sheet IDs for edit links (no PDFs in initial email)
    const quoteSheetId = inquiry.quote_sheet_id || null;
    const jobsheetSheetId = inquiry.jobsheet_sheet_id || null;

    // Build email HTML
    const emailHtml = isBackline
      ? buildBacklineEmailHtml(formData, quote, inquiry.approval_token, quoteSheetId, jobsheetSheetId)
      : buildFullSystemEmailHtml(formData as FullSystemFormData, quote, inquiry.approval_token, quoteSheetId, jobsheetSheetId);

    console.log(`[send-email] Sending email...`);
    const emailTag = isBackline ? "+dryhire@" : "+fullevent@";
    await sendEmail({
      to: [BUSINESS_EMAIL.replace("@", emailTag)],
      subject: `${isBackline ? "Backline" : "Sound System"} Inquiry from ${formData.contactName} - Quote ${quote.quoteNumber}`,
      html: emailHtml,
    });

    // Update status to quoted
    await supabase.from("inquiries").update({ status: "quoted" }).eq("id", inquiry_id);

    console.log(`[send-email] Email sent, status -> quoted`);
    return new Response(JSON.stringify({ success: true, emailSent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[send-email] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
