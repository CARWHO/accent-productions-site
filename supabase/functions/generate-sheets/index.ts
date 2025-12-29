// Supabase Edge Function: generate-sheets
// Creates editable Google Sheets (Quote + Jobsheet) for admin review
// Triggered by database webhook when status = 'quote_generated'
// After sheets are created, status changes to 'sheets_ready' for email sending

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ENVIRONMENT & CONFIG
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID = Deno.env.get("GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID");
const GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID = Deno.env.get("GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID");
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

interface QuoteOutput {
  quoteNumber: string;
  title: string;
  description: string;
  lineItems: unknown;
  subtotal: number;
  gst: number;
  total: number;
  rentalDays?: number;
  executionNotes?: string[];
  suggestedGear?: { item: string; quantity: number; notes?: string }[];
  unavailableGear?: string[];
}

interface SheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

// ============================================
// UTILITIES
// ============================================

function isBacklineInquiry(formData: FormData): formData is BacklineFormData {
  return (formData as BacklineFormData).type === "backline";
}

// ============================================
// GOOGLE SHEETS GENERATION
// ============================================

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
    const templateId = folderType === "backline"
      ? GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID
      : GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID;

    if (!templateId) {
      console.log(`[generate-sheets] Sheet template not configured for ${folderType}, skipping`);
      return null;
    }

    console.log(`[generate-sheets] Creating Quote Sheet for ${folderType}...`);
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
      console.error("Quote Sheet failed:", await response.text());
      return null;
    }

    const result = await response.json();
    console.log(`[generate-sheets] Created Quote Sheet: ${result.spreadsheetId}`);
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
    console.log(`[generate-sheets] Creating Jobsheet Sheet for ${folderType}...`);
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
      console.error("Jobsheet Sheet failed:", await response.text());
      return null;
    }

    const result = await response.json();
    console.log(`[generate-sheets] Created Jobsheet Sheet: ${result.spreadsheetId}`);
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
    if (!inquiry_id) {
      return new Response(
        JSON.stringify({ error: "Missing inquiry_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-sheets] Processing: ${inquiry_id}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: inquiry, error: fetchError } = await supabase
      .from("inquiries")
      .select("*")
      .eq("id", inquiry_id)
      .single();

    if (fetchError || !inquiry) {
      throw new Error(`Failed to fetch inquiry: ${fetchError?.message}`);
    }

    // Only process if status is 'quote_generated'
    if (inquiry.status !== "quote_generated") {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: `Status is ${inquiry.status}, not quote_generated` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData: FormData = inquiry.form_data_json;
    const quote: QuoteOutput = inquiry.quote_data;
    const isBackline = isBacklineInquiry(formData);

    if (!quote) throw new Error("No quote_data found");

    const eventDate = isBackline
      ? `${formData.startDate} - ${formData.endDate}`
      : (formData as FullSystemFormData).eventDate || "TBC";

    // Build quote options for full system inquiries
    const quoteOptions = !isBackline ? {
      organization: (formData as FullSystemFormData).organization || undefined,
      packageName: (formData as FullSystemFormData).package || undefined,
      eventName: (formData as FullSystemFormData).eventName || undefined,
      location: (formData as FullSystemFormData).location || undefined,
    } : undefined;

    // 1. Generate Quote Sheet
    let quoteSheetId: string | null = null;
    let quoteSheetUrl: string | null = null;
    const quoteSheetResult = await generateQuoteSheet(
      quote,
      formData.contactName,
      formData.contactEmail,
      formData.contactPhone,
      eventDate,
      isBackline ? "backline" : "fullsystem",
      quoteOptions
    );
    if (quoteSheetResult) {
      quoteSheetId = quoteSheetResult.spreadsheetId;
      quoteSheetUrl = quoteSheetResult.spreadsheetUrl;
    }

    // 2. Generate Jobsheet Sheet
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

    // 3. Update inquiry with Sheet IDs and change status to sheets_ready
    const updateData: Record<string, unknown> = { status: "sheets_ready" };
    if (quoteSheetId) updateData.quote_sheet_id = quoteSheetId;
    if (jobsheetSheetId) updateData.jobsheet_sheet_id = jobsheetSheetId;

    await supabase.from("inquiries").update(updateData).eq("id", inquiry_id);

    // 4. Also update booking record if it exists
    const bookingUpdate: Record<string, unknown> = {};
    if (quoteSheetId) bookingUpdate.quote_sheet_id = quoteSheetId;
    if (jobsheetSheetId) bookingUpdate.jobsheet_sheet_id = jobsheetSheetId;
    if (Object.keys(bookingUpdate).length > 0) {
      await supabase.from("bookings").update(bookingUpdate).eq("inquiry_id", inquiry_id);
    }

    console.log(`[generate-sheets] Done, status -> sheets_ready`);
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
    console.error("[generate-sheets] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
