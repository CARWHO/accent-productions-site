// Supabase Edge Function: generate-pdfs
// On-demand PDF generation from Google Sheet data
// Called when: 1) Admin completes review (Invoice PDF) 2) Contractor selected (Jobsheet PDF)
// Reads edited data from Google Sheets, generates PDF, uploads to Drive

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
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://accent-productions.co.nz";
const EDGE_FUNCTION_SECRET = Deno.env.get("EDGE_FUNCTION_SECRET") || "default-secret-change-me";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface QuoteSheetData {
  quoteNumber: string;
  issuedDate: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  lineItems: {
    gearName: string;
    quantity: number;
    days: number;
    unitRate: number;
    lineTotal: number;
  }[];
  subtotal: number;
  gst: number;
  total: number;
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

  await setDriveFilePublic(data.id, accessToken);
  return data.id;
}

async function setDriveFilePublic(fileId: string, accessToken: string): Promise<void> {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
  } catch (error) {
    console.error("Error setting file permission:", error);
  }
}

function getDriveLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

// ============================================
// READ DATA FROM GOOGLE SHEET
// ============================================

async function readQuoteSheetData(spreadsheetId: string): Promise<QuoteSheetData | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/read-quote-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify({ spreadsheetId }),
    });

    if (!response.ok) {
      console.error("Failed to read quote sheet:", await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error reading quote sheet:", error);
    return null;
  }
}

interface JobSheetSheetData {
  quoteNumber: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  location: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  loadInTime: string;
  soundCheckTime: string;
  doorsTime: string;
  setTime: string;
  finishTime: string;
  packDownTime: string;
  suggestedGear: Array<{ item: string; quantity: number; notes?: string }>;
  executionNotes: string[];
  equipment: Array<{ gearName: string; quantity: number; notes: string }>;
  crew: Array<{ role: string; name: string; phone: string; rate: number; hours: number }>;
}

async function readJobSheetSheetData(spreadsheetId: string): Promise<JobSheetSheetData | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/read-jobsheet-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify({ spreadsheetId }),
    });

    if (!response.ok) {
      console.error("Failed to read jobsheet sheet:", await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error reading jobsheet sheet:", error);
    return null;
  }
}

// ============================================
// PDF GENERATION
// ============================================

async function generateInvoicePDF(
  sheetData: QuoteSheetData,
  invoiceNumber: string,
  folderId: string,
  accessToken: string
): Promise<string | null> {
  try {
    console.log("[generate-pdfs] Generating Invoice PDF from sheet data...");

    // Convert sheet data to quote format for PDF generation
    // New format: gearName, quantity, days, unitRate, lineTotal
    const quote = {
      quoteNumber: sheetData.quoteNumber,
      title: sheetData.eventName,
      description: sheetData.eventLocation,
      lineItems: sheetData.lineItems.map(item => ({
        description: item.quantity > 1 || item.days > 1
          ? `${item.gearName} (${item.quantity}x, ${item.days} day${item.days > 1 ? 's' : ''})`
          : item.gearName,
        amount: item.lineTotal,
      })),
      subtotal: sheetData.subtotal,
      gst: sheetData.gst,
      total: sheetData.total,
    };

    const response = await fetch(`${SITE_URL}/api/generate-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify({
        quote,
        clientName: sheetData.clientName,
        clientEmail: sheetData.clientEmail,
        clientPhone: sheetData.clientPhone,
        eventDate: sheetData.eventDate,
        options: { isInvoice: true, invoiceNumber, issuedDate: sheetData.issuedDate },
      }),
    });

    if (!response.ok) {
      console.error("Invoice PDF failed:", await response.text());
      return null;
    }

    const pdfBuffer = new Uint8Array(await response.arrayBuffer());
    console.log("[generate-pdfs] Uploading Invoice PDF to Drive...");
    return await uploadToDrive(pdfBuffer, `Invoice-${invoiceNumber}.pdf`, folderId, accessToken);
  } catch (error) {
    console.error("Invoice PDF error:", error);
    return null;
  }
}

async function generateJobSheetPDF(
  input: JobSheetInput,
  folderId: string,
  accessToken: string
): Promise<string | null> {
  try {
    console.log("[generate-pdfs] Generating Job Sheet PDF...");
    const response = await fetch(`${SITE_URL}/api/generate-job-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      console.error("Job Sheet PDF failed:", await response.text());
      return null;
    }

    const pdfBuffer = new Uint8Array(await response.arrayBuffer());
    console.log("[generate-pdfs] Uploading Job Sheet PDF to Drive...");
    return await uploadToDrive(pdfBuffer, `JobSheet-${input.quoteNumber}.pdf`, folderId, accessToken);
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
    const { inquiry_id, booking_id, pdfType } = payload;

    // Require either inquiry_id or booking_id
    if (!inquiry_id && !booking_id) {
      return new Response(
        JSON.stringify({ error: "Missing inquiry_id or booking_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Require pdfType: 'invoice' or 'jobsheet'
    if (!pdfType || !["invoice", "jobsheet"].includes(pdfType)) {
      return new Response(
        JSON.stringify({ error: "pdfType must be 'invoice' or 'jobsheet'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-pdfs] Generating ${pdfType} PDF for ${inquiry_id || booking_id}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch inquiry or booking
    let record;
    if (booking_id) {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, inquiries(*)")
        .eq("id", booking_id)
        .single();
      if (error || !data) throw new Error(`Booking not found: ${error?.message}`);
      record = { ...data, inquiry: data.inquiries };
    } else {
      const { data, error } = await supabase
        .from("inquiries")
        .select("*")
        .eq("id", inquiry_id)
        .single();
      if (error || !data) throw new Error(`Inquiry not found: ${error?.message}`);
      record = data;
    }

    const isBackline = record.form_data_json?.type === "backline" || record.booking_type === "backline";

    // Get Drive access token
    const accessToken = await getDriveAccessToken();
    if (!accessToken) throw new Error("Failed to get Drive access token");

    let driveFileId: string | null = null;
    let driveLink: string | null = null;

    if (pdfType === "invoice") {
      // Generate Invoice PDF from Quote Sheet data
      const quoteSheetId = record.quote_sheet_id;
      if (!quoteSheetId) throw new Error("No quote_sheet_id found - cannot generate invoice");

      const sheetData = await readQuoteSheetData(quoteSheetId);
      if (!sheetData) throw new Error("Failed to read quote sheet data");

      const invoiceNumber = record.invoice_number || `INV-${sheetData.quoteNumber.replace("Quote-", "")}`;
      const folderId = isBackline ? GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID : GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID;

      if (!folderId) throw new Error("Drive folder not configured");

      driveFileId = await generateInvoicePDF(sheetData, invoiceNumber, folderId, accessToken);

      if (driveFileId) {
        driveLink = getDriveLink(driveFileId);
        // Update record with invoice drive file ID
        if (booking_id) {
          await supabase.from("bookings").update({ invoice_drive_file_id: driveFileId }).eq("id", booking_id);
        } else {
          await supabase.from("inquiries").update({ invoice_drive_file_id: driveFileId }).eq("id", inquiry_id);
        }
      }
    } else {
      // Generate Jobsheet PDF - read from Google Sheet (source of truth for admin edits)
      const jobsheetSheetId = record.jobsheet_sheet_id;
      const quoteData = record.quote_data || record.inquiry?.quote_data;
      const formData = record.form_data_json || record.inquiry?.form_data_json;

      const folderId = isBackline ? GOOGLE_DRIVE_BACKLINE_JOBSHEET_FOLDER_ID : GOOGLE_DRIVE_FULL_SYSTEM_JOBSHEET_FOLDER_ID;
      if (!folderId) throw new Error("Jobsheet folder not configured");

      // Try to read from Google Sheet first (has admin edits)
      let sheetData: JobSheetSheetData | null = null;
      if (jobsheetSheetId) {
        sheetData = await readJobSheetSheetData(jobsheetSheetId);
        if (sheetData) {
          console.log("[generate-pdfs] Using jobsheet data from Google Sheet");
        } else {
          console.warn("[generate-pdfs] Failed to read from sheet, falling back to quote_data");
        }
      }

      // Build job sheet input - prefer sheet data, fallback to quote_data/formData
      const jobSheetInput: JobSheetInput = {
        eventName: sheetData?.eventName || formData?.eventName || record.event_name || "Event",
        eventDate: sheetData?.eventDate || formData?.eventDate || record.event_date || "TBC",
        eventTime: sheetData?.eventTime || (formData?.eventStartTime && formData?.eventEndTime
          ? `${formData.eventStartTime} - ${formData.eventEndTime}`
          : null),
        location: sheetData?.location || formData?.location || record.location || "TBC",
        quoteNumber: sheetData?.quoteNumber || quoteData?.quoteNumber || record.quote_number,
        contractorName: record.contractor_name || "TBC",
        hourlyRate: record.contractor_hourly_rate || null,
        estimatedHours: record.contractor_hours || null,
        payAmount: record.contractor_pay || 0,
        tasksDescription: record.contractor_tasks || null,
        // AI content from sheet (admin-editable) or fallback to quote_data
        executionNotes: sheetData?.executionNotes || quoteData?.executionNotes || [],
        equipment: sheetData?.equipment?.map(e => ({ name: e.gearName, quantity: e.quantity, notes: e.notes })) || [],
        suggestedGear: sheetData?.suggestedGear || quoteData?.suggestedGear || [],
        unavailableGear: quoteData?.unavailableGear || [],
        eventType: formData?.eventType || null,
        attendance: formData?.attendance ? String(formData.attendance) : null,
        setupTime: formData?.setupTime || null,
        indoorOutdoor: formData?.indoorOutdoor || null,
        contentRequirements: [],
        additionalNotes: formData?.additionalInfo || null,
        clientName: sheetData?.clientName || formData?.contactName || record.client_name,
        clientPhone: sheetData?.clientPhone || formData?.contactPhone || record.client_phone,
        clientEmail: sheetData?.clientEmail || formData?.contactEmail || record.client_email,
      };

      driveFileId = await generateJobSheetPDF(jobSheetInput, folderId, accessToken);

      if (driveFileId) {
        driveLink = getDriveLink(driveFileId);
        // Update record with jobsheet drive file ID
        if (booking_id) {
          await supabase.from("bookings").update({ job_sheet_drive_file_id: driveFileId }).eq("id", booking_id);
        } else {
          await supabase.from("inquiries").update({ job_sheet_drive_file_id: driveFileId }).eq("id", inquiry_id);
        }
      }
    }

    if (!driveFileId) {
      throw new Error(`Failed to generate ${pdfType} PDF`);
    }

    console.log(`[generate-pdfs] ${pdfType} PDF generated: ${driveLink}`);
    return new Response(JSON.stringify({
      success: true,
      pdfType,
      driveFileId,
      driveLink,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[generate-pdfs] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
