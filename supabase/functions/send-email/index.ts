// Supabase Edge Function: send-email
// Step 3 of 3: Sends email with PDF attachments
// Triggered by database webhook when status = 'pdfs_ready'
// PDFs are fetched from Google Drive using stored file IDs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// ============================================
// ENVIRONMENT & CONFIG
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const BUSINESS_EMAIL = Deno.env.get("BUSINESS_EMAIL") || "hello@accent-productions.co.nz";
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://accent-productions.co.nz";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");

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
// GOOGLE DRIVE - Download files
// ============================================

async function getDriveAccessToken(): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    console.warn("Google Drive not configured");
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("Failed to refresh Drive token:", await response.text());
    return null;
  }
  return (await response.json()).access_token;
}

async function downloadFromDrive(fileId: string, accessToken: string): Promise<string | null> {
  try {
    console.log(`[send-email] Downloading file ${fileId} from Drive...`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error("Failed to download from Drive:", await response.text());
      return null;
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    const base64 = base64Encode(buffer);
    console.log(`[send-email] Downloaded ${fileId} (${buffer.length} bytes)`);
    return base64;
  } catch (error) {
    console.error("Drive download error:", error);
    return null;
  }
}

// ============================================
// EMAIL
// ============================================

async function sendEmail(options: { to: string[]; subject: string; html: string; attachments?: { filename: string; content: string }[] }): Promise<void> {
  const body: Record<string, unknown> = {
    from: "Accent Productions <notifications@accent-productions.co.nz>",
    to: options.to,
    subject: options.subject,
    html: options.html,
  };
  if (options.attachments && options.attachments.length > 0) {
    body.attachments = options.attachments;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Resend API error: ${await response.text()}`);
}

// ============================================
// EMAIL HTML BUILDERS
// ============================================

function buildBacklineEmailHtml(formData: BacklineFormData, quote: QuoteOutput, approvalToken: string, hasPdf: boolean): string {
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

    ${hasPdf ? "<p><em>Quote PDF attached</em></p>" : "<p><em>Quote PDF generation failed - please create manually</em></p>"}

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
  `;
}

function buildFullSystemEmailHtml(formData: FullSystemFormData, quote: QuoteOutput, approvalToken: string, hasPdf: boolean, hasJobSheet: boolean): string {
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

    ${hasPdf ? "<p><em>Quote PDF attached</em></p>" : "<p><em>Quote PDF not generated</em></p>"}
    ${hasJobSheet ? "<p><em>Job Sheet PDF attached (with AI-generated execution notes and suggested gear)</em></p>" : ""}

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

    // Get Drive access token for downloading PDFs
    const accessToken = await getDriveAccessToken();

    // Download PDFs from Google Drive (one at a time to save memory)
    const attachments: { filename: string; content: string }[] = [];

    if (inquiry.drive_file_id && accessToken) {
      const quoteBase64 = await downloadFromDrive(inquiry.drive_file_id, accessToken);
      if (quoteBase64) {
        attachments.push({ filename: `Quote-${quote.quoteNumber}.pdf`, content: quoteBase64 });
      }
    }

    if (inquiry.job_sheet_drive_file_id && accessToken) {
      const jobSheetBase64 = await downloadFromDrive(inquiry.job_sheet_drive_file_id, accessToken);
      if (jobSheetBase64) {
        attachments.push({ filename: `JobSheet-${quote.quoteNumber}.pdf`, content: jobSheetBase64 });
      }
    }

    const hasPdf = attachments.some(a => a.filename.startsWith("Quote-"));
    const hasJobSheet = attachments.some(a => a.filename.startsWith("JobSheet-"));

    // Build email HTML
    const emailHtml = isBackline
      ? buildBacklineEmailHtml(formData, quote, inquiry.approval_token, hasPdf)
      : buildFullSystemEmailHtml(formData as FullSystemFormData, quote, inquiry.approval_token, hasPdf, hasJobSheet);

    // Send email
    console.log(`[send-email] Sending email with ${attachments.length} attachments...`);
    const emailTag = isBackline ? "+dryhire@" : "+fullevent@";
    await sendEmail({
      to: [BUSINESS_EMAIL.replace("@", emailTag)],
      subject: `${isBackline ? "Backline" : "Sound System"} Inquiry from ${formData.contactName} - Quote ${quote.quoteNumber}`,
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    // Update status to quoted
    await supabase.from("inquiries").update({ status: "quoted" }).eq("id", inquiry_id);

    console.log(`[send-email] Email sent, status -> quoted`);
    return new Response(JSON.stringify({ success: true, emailSent: true, attachmentCount: attachments.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[send-email] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
