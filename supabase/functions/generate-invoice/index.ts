// Supabase Edge Function: generate-invoice
// Generates Invoice PDF from Google Sheet data, uploads to Drive
// Called by send-email-client when admin sends quote to client

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

// ============================================
// PDF GENERATION
// ============================================

async function generateInvoicePDF(
  sheetData: QuoteSheetData,
  invoiceNumber: string,
  folderId: string,
  accessToken: string,
  purchaseOrder?: string | null
): Promise<string | null> {
  try {
    console.log("[generate-invoice] Generating Invoice PDF from sheet data...");

    // Convert sheet data to quote format for PDF generation
    // Pass through all data - let PDF renderer handle categorization and formatting
    const quote = {
      quoteNumber: sheetData.quoteNumber,
      title: sheetData.eventName,
      description: sheetData.eventLocation,
      lineItems: sheetData.lineItems.map(item => ({
        description: item.gearName,
        amount: item.lineTotal,
        quantity: item.quantity,
        unitRate: item.unitRate,  // >0 for labour items, 0 for equipment
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
        options: { isInvoice: true, invoiceNumber, issuedDate: sheetData.issuedDate, purchaseOrder: purchaseOrder || undefined },
      }),
    });

    if (!response.ok) {
      console.error("Invoice PDF failed:", await response.text());
      return null;
    }

    const pdfBuffer = new Uint8Array(await response.arrayBuffer());
    console.log("[generate-invoice] Uploading Invoice PDF to Drive...");
    return await uploadToDrive(pdfBuffer, `Invoice-${invoiceNumber}.pdf`, folderId, accessToken);
  } catch (error) {
    console.error("Invoice PDF error:", error);
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

    // Only invoice PDF is supported (jobsheets generated via send-email-contractors)
    if (pdfType !== "invoice") {
      return new Response(
        JSON.stringify({ error: "pdfType must be 'invoice'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-invoice] Generating invoice PDF for ${inquiry_id || booking_id}`);
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

    // Generate Invoice PDF from Quote Sheet data
    const quoteSheetId = record.quote_sheet_id;
    if (!quoteSheetId) throw new Error("No quote_sheet_id found - cannot generate invoice");

    const sheetData = await readQuoteSheetData(quoteSheetId);
    if (!sheetData) throw new Error("Failed to read quote sheet data");

    const invoiceNumber = record.invoice_number || `INV-${sheetData.quoteNumber.replace("Quote-", "")}`;
    const purchaseOrder = record.purchase_order || null;
    const folderId = isBackline ? GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID : GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID;

    if (!folderId) throw new Error("Drive folder not configured");

    const driveFileId = await generateInvoicePDF(sheetData, invoiceNumber, folderId, accessToken, purchaseOrder);

    if (!driveFileId) {
      throw new Error("Failed to generate invoice PDF");
    }

    const driveLink = getDriveLink(driveFileId);

    // Update record with invoice drive file ID
    if (booking_id) {
      await supabase.from("bookings").update({ invoice_drive_file_id: driveFileId }).eq("id", booking_id);
    } else {
      await supabase.from("inquiries").update({ invoice_drive_file_id: driveFileId }).eq("id", inquiry_id);
    }

    console.log(`[generate-invoice] Invoice PDF generated: ${driveLink}`);
    return new Response(JSON.stringify({
      success: true,
      pdfType: "invoice",
      driveFileId,
      driveLink,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[generate-invoice] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
