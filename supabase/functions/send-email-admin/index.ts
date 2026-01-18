// Supabase Edge Function: send-email-admin
// Notifies admin of new inquiry with review/edit links
// Triggered by database webhook when status = 'sheets_ready'

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
  // Tech rider fields from form submission
  techRiderDriveFileId?: string;
  techRiderOriginalName?: string;
  // Legacy field for backwards compatibility
  techRiderStoragePath?: string;
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

function getSupabaseStorageUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/inquiry-files/${storagePath}`;
}

function getGoogleDriveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function getContentRequirements(formData: FullSystemFormData): string[] {
  const requirements: string[] = [];
  if (formData.hasDJ) requirements.push("DJ");
  if (formData.hasBand) requirements.push(`Live Band${formData.bandCount ? ` (${formData.bandCount})` : ""}`);
  if (formData.hasSpeeches) requirements.push("Speeches");
  if (formData.needsAmbientMusic) requirements.push("Ambient Music");
  if (formData.playbackFromDevice) requirements.push("Device Playback");
  if (formData.needsWirelessMic) requirements.push("Wireless Mic");
  if (formData.needsLectern) requirements.push("Lectern");
  if (formData.needsDJTable) requirements.push("DJ Table");
  if (formData.needsCDJs) requirements.push(`CDJs (${formData.cdjType || "TBC"})`);
  return requirements;
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
      <div style="margin-bottom: 24px;">
        <img src="${SITE_URL}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
      </div>

      <h1 style="color: #16a34a; margin: 0 0 20px 0;">New Backline Inquiry</h1>
      <p style="margin: 0 0 20px 0;">A new backline hire request has been submitted.</p>

      <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 20px 0;">
        <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Quote #${quote.quoteNumber}</div>
        <div style="font-size: 24px; font-weight: bold; color: #15803d; margin-bottom: 15px;">${formData.contactName}</div>
        <div style="border-top: 1px solid #bbf7d0; padding-top: 15px;">
          <p style="margin: 0 0 8px 0;"><strong>Contact:</strong> ${formData.contactEmail} · ${formData.contactPhone}</p>
          <p style="margin: 0 0 8px 0;"><strong>Dates:</strong> ${formData.startDate} → ${formData.endDate}</p>
          <p style="margin: 0 0 8px 0;"><strong>Items:</strong> ${totalItems} piece${totalItems !== 1 ? "s" : ""} of gear</p>
          <p style="margin: 0;"><strong>Method:</strong> ${formData.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}</p>
        </div>
      </div>

      ${formData.additionalNotes ? `
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Notes:</strong> ${formData.additionalNotes}</p>
      </div>
      ` : ""}

      <div style="margin: 30px 0;">
        <a href="${SITE_URL}/review-quote?token=${approvalToken}"
           style="display: inline-block; background: #16a34a; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Review Quote
        </a>
      </div>

      <div style="margin: 20px 0;">
        ${quoteSheetId ? `<a href="${getSheetEditLink(quoteSheetId)}" style="margin-right: 16px; color: #2563eb; font-size: 14px;">Edit Quote Sheet</a>` : ""}
        ${jobsheetSheetId ? `<a href="${getSheetEditLink(jobsheetSheetId)}" style="color: #2563eb; font-size: 14px;">Edit Jobsheet</a>` : ""}
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
      <p style="color: #999; font-size: 12px;">Accent Productions | Professional Sound & Lighting</p>
    </div>
  `;
}

function buildFullSystemEmailHtml(formData: FullSystemFormData, quote: QuoteOutput, approvalToken: string, quoteSheetId: string | null, jobsheetSheetId: string | null): string {
  const eventTime = formData.eventTime || (formData.eventStartTime && formData.eventEndTime ? `${formData.eventStartTime} - ${formData.eventEndTime}` : null);
  const packageLabel = PACKAGE_LABELS[formData.package] || formData.package;
  const contentRequirements = getContentRequirements(formData);
  // Get tech rider URL - prefer Google Drive, fall back to Supabase storage for legacy inquiries
  const techRiderUrl = formData.techRiderDriveFileId
    ? getGoogleDriveViewUrl(formData.techRiderDriveFileId)
    : (formData.techRiderStoragePath ? getSupabaseStorageUrl(formData.techRiderStoragePath) : null);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
      <div style="margin-bottom: 24px;">
        <img src="${SITE_URL}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
      </div>

      <h1 style="color: #16a34a; margin: 0 0 20px 0;">New Sound System Inquiry</h1>
      <p style="margin: 0 0 20px 0;">A new inquiry has been submitted for review.</p>

      <!-- Main Event Box -->
      <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 20px 0;">
        <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Quote #${quote.quoteNumber}</div>
        <div style="font-size: 24px; font-weight: bold; color: #15803d; margin-bottom: 15px;">${formData.eventName || "Sound System Inquiry"}</div>
        <div style="border-top: 1px solid #bbf7d0; padding-top: 15px;">
          <p style="margin: 0 0 8px 0;"><strong>Client:</strong> ${formData.contactName}${formData.organization ? ` · ${formData.organization}` : ""}</p>
          <p style="margin: 0 0 8px 0;"><strong>Contact:</strong> ${formData.contactEmail} · ${formData.contactPhone}</p>
          <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${formData.eventDate}${eventTime ? ` · ${eventTime}` : ""}</p>
          <p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${formData.location || "TBC"}</p>
          <p style="margin: 0 0 8px 0;"><strong>Package:</strong> ${packageLabel}${formData.attendance ? ` · ${formData.attendance} people` : ""}</p>
          ${formData.eventType ? `<p style="margin: 0;"><strong>Event Type:</strong> ${formData.eventType}</p>` : ""}
        </div>
      </div>

      ${formData.venueContact ? `
      <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Venue Contact:</strong> ${formData.venueContact}</p>
      </div>
      ` : ""}

      <!-- Content Requirements -->
      ${contentRequirements.length > 0 ? `
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Content:</strong> ${contentRequirements.join(" · ")}</p>
      </div>
      ` : ""}

      <!-- Venue Details -->
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Venue:</strong> ${formData.indoorOutdoor || "TBC"}</p>
        ${formData.powerAccess ? `<p style="margin: 0 0 8px 0;"><strong>Power:</strong> ${formData.powerAccess}</p>` : ""}
        ${formData.needsGenerator ? `<p style="margin: 0 0 8px 0;"><strong>Generator:</strong> Required</p>` : ""}
        ${formData.hasStage ? `<p style="margin: 0 0 8px 0;"><strong>Stage:</strong> ${formData.stageDetails || "Yes"}</p>` : ""}
        ${formData.wetWeatherPlan ? `<p style="margin: 0;"><strong>Wet Weather:</strong> ${formData.wetWeatherPlan}</p>` : ""}
      </div>

      <!-- Additional Info -->
      ${formData.additionalInfo ? `
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Notes:</strong> ${formData.additionalInfo}</p>
      </div>
      ` : ""}

      <div style="margin: 30px 0;">
        <a href="${SITE_URL}/review-quote?token=${approvalToken}"
           style="display: inline-block; background: #16a34a; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Review Quote
        </a>
      </div>

      <div style="margin: 20px 0;">
        ${quoteSheetId ? `<a href="${getSheetEditLink(quoteSheetId)}" style="margin-right: 16px; color: #2563eb; font-size: 14px;">Edit Quote Sheet</a>` : ""}
        ${jobsheetSheetId ? `<a href="${getSheetEditLink(jobsheetSheetId)}" style="margin-right: 16px; color: #2563eb; font-size: 14px;">Edit Jobsheet</a>` : ""}
        ${techRiderUrl ? `<a href="${techRiderUrl}" style="color: #2563eb; font-size: 14px;">View Tech Rider</a>` : ""}
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
      <p style="color: #999; font-size: 12px;">Accent Productions | Professional Sound & Lighting</p>
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

    console.log(`[send-email-admin] Processing: ${inquiry_id}`);
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

    // Build email HTML (tech rider URL is derived from formData.techRiderStoragePath for full system inquiries)
    const emailHtml = isBackline
      ? buildBacklineEmailHtml(formData, quote, inquiry.approval_token, quoteSheetId, jobsheetSheetId)
      : buildFullSystemEmailHtml(formData as FullSystemFormData, quote, inquiry.approval_token, quoteSheetId, jobsheetSheetId);

    console.log(`[send-email-admin] Sending email...`);
    const emailTag = isBackline ? "+dryhire@" : "+fullevent@";
    await sendEmail({
      to: [BUSINESS_EMAIL.replace("@", emailTag)],
      subject: `${isBackline ? "Backline" : "Sound System"} Inquiry from ${formData.contactName} - Quote ${quote.quoteNumber}`,
      html: emailHtml,
    });

    // Update status to quoted
    await supabase.from("inquiries").update({ status: "quoted" }).eq("id", inquiry_id);

    console.log(`[send-email-admin] Email sent, status -> quoted`);
    return new Response(JSON.stringify({ success: true, emailSent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[send-email-admin] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
