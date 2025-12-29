// Supabase Edge Function: generate-pdfs
// Step 2 of 3: Generates PDFs and uploads to Google Drive
// Triggered by database webhook when status = 'quote_generated'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Standard } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// ============================================
// ENVIRONMENT & CONFIG
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID");
const GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID");
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://accent-productions.co.nz";
const EDGE_FUNCTION_SECRET = Deno.env.get("EDGE_FUNCTION_SECRET") || "default-secret-change-me";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface BacklineFormData {
  type: "backline";
  startDate: string;
  endDate: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface FullSystemFormData {
  type?: "fullsystem";
  eventName: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventType: string;
  attendance?: number;
  location: string;
  indoorOutdoor: string;
  additionalInfo: string;
  playbackFromDevice: boolean;
  hasLiveMusic: boolean;
  needsMic: boolean;
  hasDJ: boolean;
  hasBand: boolean;
  hasSpeeches: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

type FormData = BacklineFormData | FullSystemFormData;

interface QuoteOutput {
  quoteNumber: string;
  title: string;
  description: string;
  lineItems: { description: string; amount: number }[];
  subtotal: number;
  gst: number;
  total: number;
  rentalDays?: number;
  executionNotes?: string[];
  suggestedGear?: { item: string; quantity: number; notes?: string }[];
  unavailableGear?: string[];
}

interface JobSheetInput {
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  location: string;
  quoteNumber: string;
  contractorName: string;
  hourlyRate: number | null;
  estimatedHours: number | null;
  payAmount: number;
  tasksDescription: string | null;
  executionNotes?: string[];
  equipment: { name: string; quantity: number; notes?: string | null }[];
  suggestedGear?: { item: string; quantity: number; notes?: string }[];
  unavailableGear?: string[];
  eventType: string | null;
  attendance: string | null;
  setupTime?: string | null;
  indoorOutdoor: string | null;
  contentRequirements: string[];
  additionalNotes: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
}

// ============================================
// UTILITIES
// ============================================

function isBacklineInquiry(formData: FormData): formData is BacklineFormData {
  return (formData as BacklineFormData).type === "backline";
}

// ============================================
// GOOGLE DRIVE
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

async function uploadToDrive(pdfBuffer: Uint8Array, filename: string, folderId: string): Promise<string | null> {
  const accessToken = await getDriveAccessToken();
  if (!accessToken) return null;

  const boundary = "-------314159265358979323846";
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const pdfBase64 = base64Standard(pdfBuffer);

  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${pdfBase64}\r\n--${boundary}--`;

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });

  if (!response.ok) {
    console.error("Failed to upload to Drive:", await response.text());
    return null;
  }
  const data = await response.json();
  console.log(`Uploaded ${filename} to Drive (ID: ${data.id})`);
  return data.id;
}

// ============================================
// PDF GENERATION
// ============================================

async function generateQuotePDF(quote: QuoteOutput, clientName: string, clientEmail: string, clientPhone: string, eventDate: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${EDGE_FUNCTION_SECRET}` },
      body: JSON.stringify({ quote, clientName, clientEmail, clientPhone, eventDate }),
    });
    if (!response.ok) {
      console.error("Quote PDF failed:", await response.text());
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.error("Quote PDF error:", error);
    return null;
  }
}

async function generateJobSheetPDF(input: JobSheetInput): Promise<Uint8Array | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/generate-job-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${EDGE_FUNCTION_SECRET}` },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      console.error("Job Sheet PDF failed:", await response.text());
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.error("Job Sheet PDF error:", error);
    return null;
  }
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

    console.log(`[generate-pdfs] Processing: ${inquiry_id}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: inquiry, error: fetchError } = await supabase.from("inquiries").select("*").eq("id", inquiry_id).single();
    if (fetchError || !inquiry) throw new Error(`Failed to fetch inquiry: ${fetchError?.message}`);
    if (inquiry.status !== "quote_generated") return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const formData: FormData = inquiry.form_data_json;
    const quote: QuoteOutput = inquiry.quote_data;
    const isBackline = isBacklineInquiry(formData);

    if (!quote) throw new Error("No quote_data found");

    const eventDate = isBackline ? `${formData.startDate} - ${formData.endDate}` : (formData as FullSystemFormData).eventDate || "TBC";

    // Generate Quote PDF
    console.log("[generate-pdfs] Generating Quote PDF...");
    const pdfBuffer = await generateQuotePDF(quote, formData.contactName, formData.contactEmail, formData.contactPhone, eventDate);

    // Generate Job Sheet PDF (fullsystem only)
    let jobSheetBuffer: Uint8Array | null = null;
    if (!isBackline) {
      const fsData = formData as FullSystemFormData;
      const contentReqs: string[] = [];
      if (fsData.playbackFromDevice) contentReqs.push("Playback from device");
      if (fsData.hasLiveMusic) contentReqs.push("Live music");
      if (fsData.needsMic) contentReqs.push("Microphone required");
      if (fsData.hasDJ) contentReqs.push("DJ");
      if (fsData.hasBand) contentReqs.push("Live band(s)");
      if (fsData.hasSpeeches) contentReqs.push("Speeches/presentations");

      const jobSheetInput: JobSheetInput = {
        eventName: fsData.eventName || "Event",
        eventDate: fsData.eventDate || "TBC",
        eventTime: fsData.eventStartTime && fsData.eventEndTime ? `${fsData.eventStartTime} - ${fsData.eventEndTime}` : null,
        location: fsData.location || "TBC",
        quoteNumber: quote.quoteNumber,
        contractorName: "TBC",
        hourlyRate: null,
        estimatedHours: null,
        payAmount: 0,
        tasksDescription: null,
        executionNotes: quote.executionNotes || [],
        equipment: [],
        suggestedGear: quote.suggestedGear || [],
        unavailableGear: quote.unavailableGear || [],
        eventType: fsData.eventType || null,
        attendance: fsData.attendance ? String(fsData.attendance) : null,
        setupTime: null,
        indoorOutdoor: fsData.indoorOutdoor || null,
        contentRequirements: contentReqs,
        additionalNotes: fsData.additionalInfo || null,
        clientName: fsData.contactName,
        clientPhone: fsData.contactPhone,
        clientEmail: fsData.contactEmail,
      };

      console.log("[generate-pdfs] Generating Job Sheet PDF...");
      jobSheetBuffer = await generateJobSheetPDF(jobSheetInput);
    }

    // Upload to Google Drive
    let driveFileId: string | null = null;
    const driveFolderId = isBackline ? GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID : GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID;
    if (pdfBuffer && driveFolderId) {
      console.log("[generate-pdfs] Uploading to Drive...");
      driveFileId = await uploadToDrive(pdfBuffer, `Quote-${quote.quoteNumber}.pdf`, driveFolderId);
    }

    // Save PDFs as base64 and update status
    const updateData: Record<string, unknown> = { status: "pdfs_ready" };
    if (pdfBuffer) updateData.quote_pdf_base64 = base64Standard(pdfBuffer);
    if (jobSheetBuffer) updateData.job_sheet_pdf_base64 = base64Standard(jobSheetBuffer);
    if (driveFileId) updateData.drive_file_id = driveFileId;

    await supabase.from("inquiries").update(updateData).eq("id", inquiry_id);

    if (driveFileId) {
      await supabase.from("bookings").update({ quote_drive_file_id: driveFileId }).eq("inquiry_id", inquiry_id);
    }

    console.log(`[generate-pdfs] Done, status -> pdfs_ready`);
    return new Response(JSON.stringify({ success: true, driveFileId, hasPdf: !!pdfBuffer, hasJobSheet: !!jobSheetBuffer }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[generate-pdfs] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
