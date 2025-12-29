// Supabase Edge Function: generate-pdfs
// Step 2 of 3: Generates PDFs and uploads to Google Drive
// Triggered by database webhook when status = 'quote_generated'
// PDFs are stored in Drive only - fetched from Drive when emailing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// ============================================
// ENVIRONMENT & CONFIG
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID");
const GOOGLE_DRIVE_BACKLINE_JOBSHEET_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_BACKLINE_JOBSHEET_FOLDER_ID");
const GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID");
const GOOGLE_DRIVE_FULL_SYSTEM_JOBSHEET_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FULL_SYSTEM_JOBSHEET_FOLDER_ID");
// Google Sheets template IDs (optional - if set, will generate editable sheets)
const GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID = Deno.env.get("GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID");
const GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID = Deno.env.get("GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID");
const GOOGLE_SOUNDTECH_QUOTE_TEMPLATE_ID = Deno.env.get("GOOGLE_SOUNDTECH_QUOTE_TEMPLATE_ID");
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
  package: string;
  eventName: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventType: string;
  organization: string;
  attendance?: number;
  location: string;
  venueContact: string;
  indoorOutdoor: string;
  hasStage: boolean;
  stageDetails: string;
  powerAccess: string;
  wetWeatherPlan: string;
  needsGenerator: boolean;
  setupTime?: string;
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

// Structured line items for full system quotes (like Quote-2025-1685)
interface StructuredLineItems {
  foh: number;
  monitors: { count: number; cost: number };
  microphones: { count: number; cost: number };
  console: number;
  cables: number;
  vehicle: number;
  techTime: { hours: number; rate: number; cost: number };
}

// Legacy line items for backline quotes
interface LegacyLineItem {
  description: string;
  amount: number;
}

// Quote can have either structured (full system) or legacy (backline) line items
interface QuoteOutput {
  quoteNumber: string;
  title: string;
  description: string;
  lineItems: StructuredLineItems | LegacyLineItem[];
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
  eventEndTime?: string | null;
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
  // Venue details
  venueContact?: string | null;
  hasStage?: boolean;
  stageDetails?: string | null;
  powerAccess?: string | null;
  wetWeatherPlan?: string | null;
  needsGenerator?: boolean;
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

async function uploadToDrive(pdfBuffer: Uint8Array, filename: string, folderId: string, accessToken: string): Promise<string | null> {
  const boundary = "-------314159265358979323846";
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const pdfBase64 = base64Encode(pdfBuffer);

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

  // Set "anyone with link can view" permission for email links
  await setDriveFilePublic(data.id, accessToken);

  return data.id;
}

async function setDriveFilePublic(fileId: string, accessToken: string): Promise<void> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    });

    if (!response.ok) {
      console.error("Failed to set file permission:", await response.text());
    } else {
      console.log(`Set public permission for file ${fileId}`);
    }
  } catch (error) {
    console.error("Error setting file permission:", error);
  }
}

// ============================================
// PDF GENERATION & UPLOAD (one at a time to save memory)
// ============================================

async function generateAndUploadQuotePDF(
  quote: QuoteOutput,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  eventDate: string,
  folderId: string,
  accessToken: string,
  options?: { organization?: string; packageName?: string; eventName?: string }
): Promise<string | null> {
  try {
    console.log("[generate-pdfs] Generating Quote PDF...");
    const response = await fetch(`${SITE_URL}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${EDGE_FUNCTION_SECRET}` },
      body: JSON.stringify({ quote, clientName, clientEmail, clientPhone, eventDate, options }),
    });
    if (!response.ok) {
      console.error("Quote PDF failed:", await response.text());
      return null;
    }
    const pdfBuffer = new Uint8Array(await response.arrayBuffer());

    console.log("[generate-pdfs] Uploading Quote PDF to Drive...");
    const driveId = await uploadToDrive(pdfBuffer, `Quote-${quote.quoteNumber}.pdf`, folderId, accessToken);
    // Buffer will be garbage collected after this function returns
    return driveId;
  } catch (error) {
    console.error("Quote PDF error:", error);
    return null;
  }
}

async function generateAndUploadJobSheetPDF(
  input: JobSheetInput,
  folderId: string,
  accessToken: string
): Promise<string | null> {
  try {
    console.log("[generate-pdfs] Generating Job Sheet PDF...");
    const response = await fetch(`${SITE_URL}/api/generate-job-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${EDGE_FUNCTION_SECRET}` },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      console.error("Job Sheet PDF failed:", await response.text());
      return null;
    }
    const pdfBuffer = new Uint8Array(await response.arrayBuffer());

    console.log("[generate-pdfs] Uploading Job Sheet PDF to Drive...");
    const driveId = await uploadToDrive(pdfBuffer, `JobSheet-${input.quoteNumber}.pdf`, folderId, accessToken);
    // Buffer will be garbage collected after this function returns
    return driveId;
  } catch (error) {
    console.error("Job Sheet PDF error:", error);
    return null;
  }
}

// ============================================
// GOOGLE SHEETS GENERATION
// ============================================

interface SheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

async function generateQuoteSheet(
  quote: QuoteOutput,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  eventDate: string,
  folderType: "backline" | "fullsystem",
  options?: { organization?: string; packageName?: string; eventName?: string; location?: string }
): Promise<SheetResult | null> {
  try {
    // Check if sheet templates are configured
    const templateId = folderType === "backline"
      ? GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID
      : GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID;

    if (!templateId) {
      console.log(`[generate-pdfs] Sheet template not configured for ${folderType}, skipping sheet generation`);
      return null;
    }

    console.log(`[generate-pdfs] Generating Quote Sheet for ${folderType}...`);
    const response = await fetch(`${SITE_URL}/api/generate-quote-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`
      },
      body: JSON.stringify({
        quote,
        clientName,
        clientEmail,
        clientPhone,
        eventDate,
        folderType,
        options
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Quote Sheet generation failed:", errorText);
      return null;
    }

    const result = await response.json();
    console.log(`[generate-pdfs] Created Quote Sheet: ${result.spreadsheetId}`);
    return result;
  } catch (error) {
    console.error("Quote Sheet error:", error);
    return null;
  }
}

async function generateJobsheetSheet(
  quoteNumber: string,
  eventName: string,
  eventDate: string,
  eventTime: string | null,
  location: string,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  equipment: { item: string; quantity: number; notes?: string }[],
  folderType: "backline" | "fullsystem"
): Promise<SheetResult | null> {
  try {
    console.log(`[generate-pdfs] Generating Jobsheet Sheet for ${folderType}...`);
    const response = await fetch(`${SITE_URL}/api/generate-jobsheet-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`
      },
      body: JSON.stringify({
        quoteNumber,
        eventName,
        eventDate,
        eventTime: eventTime || "TBC",
        location,
        clientName,
        clientEmail,
        clientPhone,
        equipment,
        folderType
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Jobsheet Sheet generation failed:", errorText);
      return null;
    }

    const result = await response.json();
    console.log(`[generate-pdfs] Created Jobsheet Sheet: ${result.spreadsheetId}`);
    return result;
  } catch (error) {
    console.error("Jobsheet Sheet error:", error);
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

    // Get Drive access token once
    const accessToken = await getDriveAccessToken();
    if (!accessToken) throw new Error("Failed to get Drive access token");

    const eventDate = isBackline ? `${formData.startDate} - ${formData.endDate}` : (formData as FullSystemFormData).eventDate || "TBC";
    const quoteFolderId = isBackline ? GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID : GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID;

    // Build quote options for full system inquiries
    const quoteOptions = !isBackline ? {
      organization: (formData as FullSystemFormData).organization || undefined,
      packageName: (formData as FullSystemFormData).package || undefined,
      eventName: (formData as FullSystemFormData).eventName || undefined,
      location: (formData as FullSystemFormData).location || undefined,
    } : undefined;

    // Generate Google Sheet (editable version) if template is configured
    let quoteSheetId: string | null = null;
    let quoteSheetUrl: string | null = null;
    const sheetResult = await generateQuoteSheet(
      quote,
      formData.contactName,
      formData.contactEmail,
      formData.contactPhone,
      eventDate,
      isBackline ? "backline" : "fullsystem",
      quoteOptions
    );
    if (sheetResult) {
      quoteSheetId = sheetResult.spreadsheetId;
      quoteSheetUrl = sheetResult.spreadsheetUrl;
    }

    // Generate Jobsheet Sheet (for both backline and fullsystem)
    let jobsheetSheetId: string | null = null;
    let jobsheetSheetUrl: string | null = null;
    const fsData = !isBackline ? formData as FullSystemFormData : null;

    // Build equipment list from suggested gear
    const equipment = (quote.suggestedGear || []).map(item => ({
      item: item.item,
      quantity: item.quantity,
      notes: item.notes || ""
    }));

    const jobsheetResult = await generateJobsheetSheet(
      quote.quoteNumber,
      fsData?.eventName || "Backline Hire",
      fsData?.eventDate || (formData as BacklineFormData).startDate || "TBC",
      fsData?.eventStartTime || null,
      fsData?.location || "TBC",
      formData.contactName,
      formData.contactEmail,
      formData.contactPhone,
      equipment,
      isBackline ? "backline" : "fullsystem"
    );
    if (jobsheetResult) {
      jobsheetSheetId = jobsheetResult.spreadsheetId;
      jobsheetSheetUrl = jobsheetResult.spreadsheetUrl;
    }

    // Update inquiry with Sheet IDs (no PDFs at this stage)
    const updateData: Record<string, unknown> = { status: "sheets_ready" };
    if (quoteSheetId) updateData.quote_sheet_id = quoteSheetId;
    if (jobsheetSheetId) updateData.jobsheet_sheet_id = jobsheetSheetId;

    await supabase.from("inquiries").update(updateData).eq("id", inquiry_id);

    // Also update booking record
    const bookingUpdate: Record<string, unknown> = {};
    if (quoteSheetId) bookingUpdate.quote_sheet_id = quoteSheetId;
    if (jobsheetSheetId) bookingUpdate.jobsheet_sheet_id = jobsheetSheetId;
    if (Object.keys(bookingUpdate).length > 0) {
      await supabase.from("bookings").update(bookingUpdate).eq("inquiry_id", inquiry_id);
    }

    console.log(`[generate-pdfs] Done, status -> sheets_ready`);
    return new Response(JSON.stringify({
      success: true,
      quoteSheetId,
      quoteSheetUrl,
      jobsheetSheetId,
      jobsheetSheetUrl,
      hasQuoteSheet: !!quoteSheetId,
      hasJobsheetSheet: !!jobsheetSheetId
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[generate-pdfs] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
