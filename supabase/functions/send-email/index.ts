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

function getDriveViewLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function buildBacklineEmailHtml(formData: BacklineFormData, quote: QuoteOutput, approvalToken: string, quoteFileId: string | null): string {
  const equipmentList = formData.equipment.map((item) => `${item.name}: ${item.quantity}`).join("\n");

  return `
    <h1>New Backline Hire Inquiry</h1>
    ${quote.quoteNumber ? `<p><strong>Quote Number:</strong> ${quote.quoteNumber}</p>` : ""}
    <hr />

    <h2>Equipment Requested</h2>
    <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px;">${equipmentList || "No standard equipment selected"}</pre>
    ${formData.otherEquipment ? `<p><strong>Other Equipment:</strong> ${formData.otherEquipment}</p>` : ""}

    <hr />

    <h2>Rental Details</h2>
    <p><strong>Start Date:</strong> ${formData.startDate}</p>
    <p><strong>End Date:</strong> ${formData.endDate}</p>
    <p><strong>Method:</strong> ${formData.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}</p>
    ${formData.deliveryMethod === "delivery" ? `<p><strong>Delivery Address:</strong> ${formData.deliveryAddress}</p>` : ""}
    ${formData.additionalNotes ? `<p><strong>Additional Notes:</strong> ${formData.additionalNotes}</p>` : ""}

    <hr />

    <h2>Contact Information</h2>
    <p><strong>Name:</strong> ${formData.contactName}</p>
    <p><strong>Email:</strong> ${formData.contactEmail}</p>
    <p><strong>Phone:</strong> ${formData.contactPhone}</p>

    <hr />
    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
      <p style="margin: 0 0 15px 0; font-size: 14px; color: #0369a1;">
        Review the quote and send to client for approval:
      </p>
      <a href="${SITE_URL}/review-quote?token=${approvalToken}"
         style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Review Quote
      </a>
    </div>
    ${quoteFileId ? `<p style="font-size: 11px; color: #94a3b8;"><a href="${getDriveViewLink(quoteFileId)}" style="color: #94a3b8;">Quote PDF</a></p>` : ""}
  `;
}

function buildFullSystemEmailHtml(formData: FullSystemFormData, quote: QuoteOutput, approvalToken: string, quoteFileId: string | null, jobSheetFileId: string | null): string {
  const contentReqs: string[] = [];
  if (formData.playbackFromDevice) contentReqs.push("Playback from device");
  if (formData.hasLiveMusic) contentReqs.push("Live music");
  if (formData.needsMic) contentReqs.push("Microphone required");
  if (formData.hasDJ) {
    let djText = "DJ";
    if (formData.needsDJTable) djText += " (table needed)";
    if (formData.needsCDJs) djText += ` (CDJs: ${formData.cdjType || "standard"})`;
    contentReqs.push(djText);
  }
  if (formData.hasBand) {
    let bandText = "Live band";
    if (formData.bandCount && formData.bandCount > 1) bandText += `s (${formData.bandCount})`;
    if (formData.bandNames) bandText += `: ${formData.bandNames}`;
    contentReqs.push(bandText);
  }
  if (formData.hasSpeeches) {
    let speechText = "Speeches/presentations";
    if (formData.needsWirelessMic) speechText += " (wireless mic)";
    if (formData.needsLectern) speechText += " (lectern)";
    contentReqs.push(speechText);
  }
  if (formData.needsAmbientMusic) contentReqs.push("Ambient music");

  const packageLabel = PACKAGE_LABELS[formData.package] || formData.package;

  const unavailableGearHtml = quote.unavailableGear && quote.unavailableGear.length > 0
    ? `
      <div style="background: #fef2f2; border: 2px solid #dc2626; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #dc2626; margin: 0 0 12px 0; font-size: 16px;">Gear Requiring Attention</h3>
        <p style="color: #991b1b; font-size: 12px; margin: 0 0 10px 0;">These items may need to be hired externally or confirmed:</p>
        <ul style="margin: 0; padding-left: 20px; color: #dc2626;">
          ${quote.unavailableGear.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  return `
    <h1>New Sound System Hire Inquiry</h1>
    ${quote.quoteNumber ? `<p><strong>Quote Number:</strong> ${quote.quoteNumber}</p>` : ""}
    <hr />

    <h2>Package Selected</h2>
    <p><strong>Package:</strong> ${packageLabel}</p>

    <hr />

    <h2>Event Details</h2>
    <p><strong>Event Type:</strong> ${formData.eventType || "N/A"}</p>
    <p><strong>Event Name:</strong> ${formData.eventName || "N/A"}</p>
    <p><strong>Organization:</strong> ${formData.organization || "N/A"}</p>
    <p><strong>Date:</strong> ${formData.eventDate || "N/A"}</p>
    <p><strong>Time:</strong> ${formData.eventTime || (formData.eventStartTime && formData.eventEndTime ? `${formData.eventStartTime} - ${formData.eventEndTime}` : "N/A")}</p>
    <p><strong>Setup/Packout:</strong> ${formData.setupTime || "N/A"}</p>
    <p><strong>Attendance:</strong> ${formData.attendance || "N/A"}</p>

    <hr />

    <h2>Content Requirements</h2>
    <p>${contentReqs.length > 0 ? contentReqs.join(", ") : "No specific content requirements"}</p>
    ${formData.additionalInfo ? `<p><strong>Additional Info:</strong> ${formData.additionalInfo}</p>` : ""}

    <hr />

    <h2>Venue Details</h2>
    <p><strong>Location:</strong> ${formData.location || "N/A"}</p>
    <p><strong>Venue Contact:</strong> ${formData.venueContact || "N/A"}</p>
    <p><strong>Indoor/Outdoor:</strong> ${formData.indoorOutdoor || "N/A"}</p>
    ${formData.indoorOutdoor === "Outdoor" ? `
      <p><strong>Power Access:</strong> ${formData.powerAccess || "N/A"}</p>
      <p><strong>Wet Weather Plan:</strong> ${formData.wetWeatherPlan || "N/A"}</p>
      <p><strong>Generator Needed:</strong> ${formData.needsGenerator ? "Yes" : "No"}</p>
    ` : ""}
    <p><strong>Stage Available:</strong> ${formData.hasStage ? "Yes" : "No"}</p>
    ${formData.stageDetails ? `<p><strong>Stage Details:</strong> ${formData.stageDetails}</p>` : ""}

    <hr />

    <h2>Contact Information</h2>
    <p><strong>Name:</strong> ${formData.contactName}</p>
    <p><strong>Email:</strong> ${formData.contactEmail}</p>
    <p><strong>Phone:</strong> ${formData.contactPhone}</p>
    ${formData.details ? `<p><strong>Additional Details:</strong> ${formData.details}</p>` : ""}

    ${unavailableGearHtml}

    <hr />
    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
      <p style="margin: 0 0 15px 0; font-size: 14px; color: #0369a1;">
        Review the quote and send to client for approval:
      </p>
      <a href="${SITE_URL}/review-quote?token=${approvalToken}"
         style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Review Quote
      </a>
    </div>
    <p style="font-size: 11px; color: #94a3b8;">
      ${quoteFileId ? `<a href="${getDriveViewLink(quoteFileId)}" style="color: #94a3b8;">Quote PDF</a>` : ""}
      ${quoteFileId && jobSheetFileId ? " · " : ""}
      ${jobSheetFileId ? `<a href="${getDriveViewLink(jobSheetFileId)}" style="color: #94a3b8;">Job Sheet</a>` : ""}
    </p>
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
    if (inquiry.status !== "pdfs_ready") return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const formData: FormData = inquiry.form_data_json;
    const quote: QuoteOutput = inquiry.quote_data;
    const isBackline = isBacklineInquiry(formData);

    if (!quote) throw new Error("No quote_data found");

    // Get Drive file IDs for links
    const quoteFileId = inquiry.drive_file_id || null;
    const jobSheetFileId = inquiry.job_sheet_drive_file_id || null;

    // Build email HTML
    const emailHtml = isBackline
      ? buildBacklineEmailHtml(formData, quote, inquiry.approval_token, quoteFileId)
      : buildFullSystemEmailHtml(formData as FullSystemFormData, quote, inquiry.approval_token, quoteFileId, jobSheetFileId);

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
