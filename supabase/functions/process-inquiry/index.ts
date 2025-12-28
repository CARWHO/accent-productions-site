// Supabase Edge Function: process-inquiry
// Handles background processing of all inquiry types (backline & fullsystem)
// Triggered by database insert via Database Webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { encode as base64Standard } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Environment variables (set in Supabase Dashboard > Edge Functions > Secrets)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID");
const GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const BUSINESS_EMAIL = Deno.env.get("BUSINESS_EMAIL") || "hello@accent-productions.co.nz";
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://accent-productions.co.nz";
const EDGE_FUNCTION_SECRET = Deno.env.get("EDGE_FUNCTION_SECRET") || "default-secret-change-me";

// Parse service account credentials for Vertex AI
let serviceAccount: {
  client_email: string;
  private_key: string;
  project_id: string;
};

try {
  serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
} catch {
  console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
}

const GOOGLE_CLOUD_LOCATION = "us-central1";

// ============================================
// TYPE DEFINITIONS
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
  techRiderStoragePath?: string | null;
  techRiderOriginalName?: string | null;
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
  attendance?: number;
  playbackFromDevice: boolean;
  hasLiveMusic: boolean;
  needsMic: boolean;
  hasDJ: boolean;
  hasBand: boolean;
  bandCount?: number;
  bandNames: string;
  bandSetup: string;
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
  techRiderStoragePath: string | null;
  techRiderOriginalName: string | null;
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
  suggestedGear?: { item: string; quantity: number; notes?: string; matchedInInventory?: boolean }[];
  unavailableGear?: string[];
}

// Package labels for display
const PACKAGE_LABELS: Record<string, string> = {
  small: "Small Event (10-50 people)",
  medium: "Medium Event (50-200 people)",
  large: "Large Event (200-1000 people)",
  "extra-large": "Extra-Large Event (1000+ people)",
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateQuoteNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${year}-${random}`;
}

function calculateRentalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

function isBacklineInquiry(formData: FormData): formData is BacklineFormData {
  return (formData as BacklineFormData).type === "backline";
}

// ============================================
// VERTEX AI AUTHENTICATION
// ============================================

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getVertexAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64Encode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64Encode(encoder.encode(JSON.stringify(payload)));
  const signInput = `${headerB64}.${payloadB64}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encoder.encode(signInput)
  );
  const signatureB64 = base64Encode(new Uint8Array(signature));

  const jwt = `${signInput}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`OAuth2 token error: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// ============================================
// GOOGLE DRIVE INTEGRATION
// ============================================

async function getDriveAccessToken(): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    console.warn("Google Drive not configured - missing OAuth credentials");
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
    console.error("Failed to refresh Google Drive token:", await response.text());
    return null;
  }

  const data = await response.json();
  return data.access_token;
}

async function uploadToDrive(
  pdfBuffer: Uint8Array,
  filename: string,
  folderId: string
): Promise<string | null> {
  const accessToken = await getDriveAccessToken();
  if (!accessToken) return null;

  // Create multipart request body
  const boundary = "-------314159265358979323846";
  const metadata = {
    name: filename,
    parents: [folderId],
  };

  const metadataString = JSON.stringify(metadata);
  const pdfBase64 = base64Standard(pdfBuffer);

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadataString,
    `--${boundary}`,
    "Content-Type: application/pdf",
    "Content-Transfer-Encoding: base64",
    "",
    pdfBase64,
    `--${boundary}--`,
  ].join("\r\n");

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    console.error("Failed to upload to Drive:", await response.text());
    return null;
  }

  const data = await response.json();
  console.log(`Uploaded ${filename} to Google Drive (ID: ${data.id})`);
  return data.id;
}

// ============================================
// AI QUOTE GENERATION
// ============================================

async function callGemini(prompt: string): Promise<string> {
  const accessToken = await getVertexAccessToken();
  const url = `https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${serviceAccount.project_id}/locations/${GOOGLE_CLOUD_LOCATION}/publishers/google/models/gemini-2.0-flash:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vertex AI error: ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function generateBacklineQuote(
  formData: BacklineFormData,
  supabase: ReturnType<typeof createClient>
): Promise<QuoteOutput> {
  const quoteNumber = generateQuoteNumber();
  const rentalDays = calculateRentalDays(formData.startDate, formData.endDate);

  // Fetch equipment prices from database
  const equipmentNames = formData.equipment.map((e) => e.name);
  const { data: dbItems } = await supabase
    .from("hire_items")
    .select("name, hire_rate_per_day, notes")
    .in("name", equipmentNames);

  const lineItems: { description: string; amount: number }[] = [];
  let equipmentSubtotal = 0;

  // Calculate equipment costs with day 2+ at 50%
  for (const item of formData.equipment) {
    const dbItem = dbItems?.find((db: { name: string }) => db.name === item.name);
    const dailyRate = dbItem?.hire_rate_per_day || 0;

    const day1Cost = item.quantity * dailyRate;
    const additionalDaysCost = rentalDays > 1
      ? (rentalDays - 1) * (item.quantity * dailyRate * 0.5)
      : 0;
    const totalItemCost = day1Cost + additionalDaysCost;

    let description = `${item.quantity} x ${item.name}`;
    if (dailyRate) {
      description += ` @ $${dailyRate}/day`;
    }
    if (rentalDays > 1) {
      description += ` (Day 1: $${day1Cost}, Days 2-${rentalDays} @ 50%)`;
    }

    lineItems.push({ description, amount: totalItemCost });
    equipmentSubtotal += totalItemCost;
  }

  // Delivery fee if applicable
  if (formData.deliveryMethod === "delivery") {
    const deliveryFee = 150;
    lineItems.push({ description: "Delivery & Collection", amount: deliveryFee });
    equipmentSubtotal += deliveryFee;
  }

  const subtotal = equipmentSubtotal;
  const gst = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + gst;

  // Generate AI title/description
  let title = "Backline Hire";
  let description = "";

  try {
    const equipmentSummary = formData.equipment
      .map((e) => `${e.quantity}x ${e.name}`)
      .join(", ");

    const prompt = `You are writing a professional quote description for an audio equipment hire company.

The customer is requesting the following equipment for ${rentalDays} day${rentalDays > 1 ? "s" : ""}:
${equipmentSummary}
${formData.otherEquipment ? `\nAdditional requests: ${formData.otherEquipment}` : ""}
${formData.additionalNotes ? `\nNotes: ${formData.additionalNotes}` : ""}

Delivery method: ${formData.deliveryMethod === "delivery" ? "Delivery to " + (formData.deliveryAddress || "customer location") : "Customer pickup"}

Generate two things:
1. A short title (5-10 words) like "Backline Hire @ [Location/Event]"
2. A brief professional description (2-3 sentences)

Format your response as:
TITLE: [your title]
DESCRIPTION: [your description]`;

    const response = await callGemini(prompt);
    const titleMatch = response.match(/TITLE:\s*(.+?)(?:\n|$)/i);
    const descMatch = response.match(/DESCRIPTION:\s*([\s\S]+?)$/i);

    if (titleMatch) title = titleMatch[1].trim();
    if (descMatch) description = descMatch[1].trim();
  } catch (error) {
    console.error("AI description error:", error);
    description = `${formData.equipment.length} items for ${rentalDays} day${rentalDays > 1 ? "s" : ""} hire.`;
  }

  return {
    quoteNumber,
    title,
    description,
    lineItems,
    subtotal,
    gst,
    total,
    rentalDays,
  };
}

async function generateFullSystemQuote(formData: FullSystemFormData): Promise<QuoteOutput> {
  const quoteNumber = generateQuoteNumber();

  const eventSummary = `
Event: ${formData.eventName || "Event"}
Type: ${formData.eventType || "Not specified"}
Date: ${formData.eventDate || "TBC"}
Time: ${formData.eventStartTime} - ${formData.eventEndTime}
Location: ${formData.location || "TBC"}
Attendance: ${formData.attendance || "Not specified"}
Package: ${formData.package}

Content Requirements:
- Playback from device: ${formData.playbackFromDevice ? "Yes" : "No"}
- Live music: ${formData.hasLiveMusic ? "Yes" : "No"}
- Live band: ${formData.hasBand ? "Yes" : "No"}${formData.hasBand && formData.bandCount ? ` (${formData.bandCount} band${formData.bandCount > 1 ? "s" : ""})` : ""}
- DJ: ${formData.hasDJ ? "Yes" : "No"}${formData.hasDJ && formData.needsDJTable ? " (needs DJ table)" : ""}${formData.hasDJ && formData.needsCDJs ? ` (needs CDJs - ${formData.cdjType || "standard"})` : ""}
- Speeches: ${formData.hasSpeeches ? "Yes" : "No"}${formData.hasSpeeches && formData.needsWirelessMic ? " (wireless mic)" : ""}${formData.hasSpeeches && formData.needsLectern ? " (lectern)" : ""}

Venue:
- Indoor/Outdoor: ${formData.indoorOutdoor || "Not specified"}
- Stage: ${formData.hasStage ? "Yes" : "No"}${formData.hasStage && formData.stageDetails ? ` - ${formData.stageDetails}` : ""}
- Power access: ${formData.powerAccess || "Not specified"}
- Generator needed: ${formData.needsGenerator ? "Yes" : "No"}
- Wet weather plan: ${formData.wetWeatherPlan || "None"}
${formData.additionalInfo ? `Additional Info: ${formData.additionalInfo}` : ""}
`.trim();

  const quotePrompt = `You are a professional audio equipment hire company in New Zealand. Generate a quote for this event:

${eventSummary}

Return a JSON object with:
{
  "title": "Short title for the quote (e.g., 'Wedding Reception Sound System')",
  "description": "2-3 sentence professional description",
  "lineItems": [
    {"description": "Item description with quantity", "amount": 123.00}
  ],
  "executionNotes": [
    "Step-by-step notes for the sound engineer about setup",
    "Each note should be a separate string in the array",
    "Include timing, setup order, and key considerations"
  ],
  "suggestedGear": [
    {"item": "Equipment name", "quantity": 2, "notes": "Optional notes about this item"}
  ],
  "unavailableGear": ["Items that might need to be hired externally or may not be available"]
}

Base pricing guidelines (NZD):
- Small package (10-50 people): $500-800
- Medium package (50-200 people): $1200-2000
- Large package (200-1000 people): $3000-5000

For suggestedGear, include realistic quantities based on the event size and requirements.
For unavailableGear, list any items that are specialized, rarely available, or might need external hire (e.g., specific backline, specialty mics, large PA for outdoor events).

Only return the JSON object, no other text.`;

  const aiResponse = await callGemini(quotePrompt);

  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI quote response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const subtotal = parsed.lineItems.reduce(
    (sum: number, item: { amount: number }) => sum + item.amount,
    0
  );
  const gst = Math.round(subtotal * 0.15 * 100) / 100;

  // Parse execution notes - handle both string and array formats
  let executionNotes: string[] = [];
  if (Array.isArray(parsed.executionNotes)) {
    executionNotes = parsed.executionNotes;
  } else if (typeof parsed.executionNotes === "string" && parsed.executionNotes) {
    executionNotes = parsed.executionNotes.split("\n").filter((n: string) => n.trim());
  }

  // Parse suggested gear - handle both array of strings and array of objects
  let suggestedGear: { item: string; quantity: number; notes?: string; matchedInInventory?: boolean }[] = [];
  if (Array.isArray(parsed.suggestedGear)) {
    suggestedGear = parsed.suggestedGear.map((g: string | { item: string; quantity?: number; notes?: string }) => {
      if (typeof g === "string") {
        return { item: g, quantity: 1 };
      }
      return { item: g.item, quantity: g.quantity || 1, notes: g.notes };
    });
  }

  return {
    quoteNumber,
    title: parsed.title || "Sound System Hire",
    description: parsed.description || "",
    lineItems: parsed.lineItems || [],
    subtotal,
    gst,
    total: subtotal + gst,
    executionNotes,
    suggestedGear,
    unavailableGear: Array.isArray(parsed.unavailableGear) ? parsed.unavailableGear : [],
  };
}

// ============================================
// PDF GENERATION (via Next.js API)
// ============================================

async function generatePDF(
  quote: QuoteOutput,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  eventDate: string
): Promise<Uint8Array | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/generate-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify({
        quote,
        clientName,
        clientEmail,
        clientPhone,
        eventDate,
      }),
    });

    if (!response.ok) {
      console.error("PDF generation failed:", await response.text());
      return null;
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    return null;
  }
}

// ============================================
// JOB SHEET PDF GENERATION (via Next.js API)
// ============================================

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
  suggestedGear?: { item: string; quantity: number; notes?: string; matchedInInventory?: boolean }[];
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

async function generateJobSheetPDF(input: JobSheetInput): Promise<Uint8Array | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/generate-job-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      console.error("Job Sheet PDF generation failed:", await response.text());
      return null;
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.error("Job Sheet PDF generation error:", error);
    return null;
  }
}

// ============================================
// EMAIL SENDING
// ============================================

async function sendEmail(options: {
  to: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}): Promise<void> {
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const inquiry_id = payload.record?.id || payload.inquiry_id;

    if (!inquiry_id) {
      console.log("Invalid payload:", JSON.stringify(payload));
      return new Response(JSON.stringify({ error: "Missing inquiry_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing inquiry: ${inquiry_id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: inquiry, error: fetchError } = await supabase
      .from("inquiries")
      .select("*")
      .eq("id", inquiry_id)
      .single();

    if (fetchError || !inquiry) {
      throw new Error(`Failed to fetch inquiry: ${fetchError?.message}`);
    }

    if (inquiry.status !== "pending_quote") {
      console.log(`Inquiry ${inquiry_id} already processed, skipping`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData: FormData = inquiry.form_data_json;
    const isBackline = isBacklineInquiry(formData);

    console.log(`Inquiry type: ${isBackline ? "backline" : "fullsystem"}`);

    // Generate quote based on type
    let quote: QuoteOutput;
    let emailTag: string;
    let driveFolderId: string | undefined;
    let eventDate: string;

    if (isBackline) {
      quote = await generateBacklineQuote(formData, supabase);
      emailTag = "+dryhire@";
      driveFolderId = GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID;
      eventDate = `${formData.startDate} - ${formData.endDate}`;
    } else {
      // Check if valid package for auto-quote
      const validPackages = ["small", "medium", "large"];
      if (!formData.package || !validPackages.includes(formData.package)) {
        // Extra-large or no package - send notification and mark as new
        await sendEmail({
          to: [BUSINESS_EMAIL.replace("@", "+fullevent@")],
          subject: `Sound System Inquiry from ${formData.contactName}`,
          html: `
            <h1>New Sound System Inquiry</h1>
            <p><strong>Package:</strong> ${formData.package || "Not selected"}</p>
            <p><strong>Event:</strong> ${formData.eventName || "N/A"}</p>
            <p><strong>Contact:</strong> ${formData.contactName} (${formData.contactEmail})</p>
            <p>This inquiry requires manual quote generation.</p>
          `,
        });

        await supabase
          .from("inquiries")
          .update({ status: "new" })
          .eq("id", inquiry_id);

        return new Response(JSON.stringify({ success: true, manual: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      quote = await generateFullSystemQuote(formData);
      emailTag = "+fullevent@";
      driveFolderId = GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID;
      eventDate = formData.eventDate || "TBC";
    }

    console.log(`Quote ${quote.quoteNumber} generated`);

    // Generate Quote PDF
    const pdfBuffer = await generatePDF(
      quote,
      formData.contactName,
      formData.contactEmail,
      formData.contactPhone,
      eventDate
    );

    // Generate Job Sheet PDF (for full system inquiries only)
    let jobSheetBuffer: Uint8Array | null = null;
    if (!isBackline) {
      // Build content requirements for job sheet
      const contentReqs: string[] = [];
      if (formData.playbackFromDevice) contentReqs.push("Playback from device");
      if (formData.hasLiveMusic) contentReqs.push("Live music");
      if (formData.needsMic) contentReqs.push("Microphone required");
      if (formData.hasDJ) contentReqs.push("DJ");
      if (formData.hasBand) contentReqs.push("Live band(s)");
      if (formData.hasSpeeches) contentReqs.push("Speeches/presentations");

      const jobSheetInput: JobSheetInput = {
        eventName: formData.eventName || "Event",
        eventDate: formData.eventDate || "TBC",
        eventTime: formData.eventStartTime && formData.eventEndTime
          ? `${formData.eventStartTime} - ${formData.eventEndTime}`
          : null,
        location: formData.location || "TBC",
        quoteNumber: quote.quoteNumber,
        // No contractor assigned yet
        contractorName: "TBC",
        hourlyRate: null,
        estimatedHours: null,
        payAmount: 0,
        tasksDescription: null,
        // AI-generated notes
        executionNotes: quote.executionNotes || [],
        equipment: [], // Empty for initial job sheet
        suggestedGear: quote.suggestedGear || [],
        unavailableGear: quote.unavailableGear || [],
        // Event details
        eventType: formData.eventType || null,
        attendance: formData.attendance ? String(formData.attendance) : null,
        setupTime: null,
        indoorOutdoor: formData.indoorOutdoor || null,
        contentRequirements: contentReqs,
        additionalNotes: formData.additionalInfo || null,
        // Client
        clientName: formData.contactName,
        clientPhone: formData.contactPhone,
        clientEmail: formData.contactEmail,
      };

      console.log("Generating Job Sheet PDF...");
      jobSheetBuffer = await generateJobSheetPDF(jobSheetInput);
      if (jobSheetBuffer) {
        console.log("Job Sheet PDF generated successfully");
      } else {
        console.warn("Job Sheet PDF generation failed");
      }
    }

    // Upload to Google Drive
    let driveFileId: string | null = null;
    if (pdfBuffer && driveFolderId) {
      driveFileId = await uploadToDrive(
        pdfBuffer,
        `Quote-${quote.quoteNumber}.pdf`,
        driveFolderId
      );
    }

    // Create booking record
    const bookingData: Record<string, unknown> = {
      inquiry_id: inquiry_id,
      quote_number: quote.quoteNumber,
      booking_type: isBackline ? "backline" : "fullsystem",
      status: "pending",
      client_name: formData.contactName,
      client_email: formData.contactEmail,
      client_phone: formData.contactPhone,
      approval_token: inquiry.approval_token,
      quote_total: quote.total,
      quote_drive_file_id: driveFileId,
    };

    if (isBackline) {
      bookingData.event_date = formData.startDate || null;
      bookingData.event_time = null;
      bookingData.location = formData.deliveryMethod === "delivery" ? formData.deliveryAddress : "Pickup";
      bookingData.event_name = `Backline Hire - ${formData.contactName}`;
      bookingData.job_description = formData.additionalNotes || null;
      bookingData.details_json = {
        type: "backline",
        equipment: formData.equipment,
        otherEquipment: formData.otherEquipment || null,
        rentalPeriod: { start: formData.startDate, end: formData.endDate },
        deliveryMethod: formData.deliveryMethod,
        deliveryAddress: formData.deliveryMethod === "delivery" ? formData.deliveryAddress : null,
        lineItems: quote.lineItems,
        rentalDays: quote.rentalDays,
      };
    } else {
      bookingData.event_date = formData.eventDate || null;
      bookingData.event_time = formData.eventStartTime && formData.eventEndTime
        ? `${formData.eventStartTime} - ${formData.eventEndTime}`
        : null;
      bookingData.location = formData.location || null;
      bookingData.event_name = formData.eventName || null;

      const contentReqs: string[] = [];
      if (formData.playbackFromDevice) contentReqs.push("Playback from device");
      if (formData.hasLiveMusic) contentReqs.push("Live music");
      if (formData.needsMic) contentReqs.push("Microphone required");
      if (formData.hasDJ) contentReqs.push("DJ");
      if (formData.hasBand) contentReqs.push("Live band(s)");
      if (formData.hasSpeeches) contentReqs.push("Speeches/presentations");

      bookingData.details_json = {
        type: "fullsystem",
        package: formData.package,
        eventType: formData.eventType,
        attendance: formData.attendance || null,
        indoorOutdoor: formData.indoorOutdoor || null,
        contentRequirements: contentReqs,
        lineItems: quote.lineItems,
        executionNotes: quote.executionNotes,
        suggestedGear: quote.suggestedGear,
        unavailableGear: quote.unavailableGear,
      };
    }

    const { error: bookingError } = await supabase.from("bookings").insert(bookingData);
    if (bookingError) {
      console.error("Error creating booking:", bookingError);
    }

    // Build email HTML
    let emailHtml: string;
    if (isBackline) {
      const equipmentList = formData.equipment
        .map((item) => `${item.name}: ${item.quantity}`)
        .join("\n");

      emailHtml = `
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

        ${pdfBuffer ? "<p><em>Quote PDF attached</em></p>" : "<p><em>Quote PDF generation failed - please create manually</em></p>"}

        <hr />
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #0369a1;">
            Review the quote and send to client for approval:
          </p>
          <a href="${SITE_URL}/review-quote?token=${inquiry.approval_token}"
             style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Review Quote
          </a>
        </div>
      `;
    } else {
      // Build content requirements list
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

      // Get package label
      const packageLabel = PACKAGE_LABELS[formData.package] || formData.package;

      // Build unavailable gear warning HTML
      const unavailableGearHtml = quote.unavailableGear && quote.unavailableGear.length > 0
        ? `
          <div style="background: #fef2f2; border: 2px solid #dc2626; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #dc2626; margin: 0 0 12px 0; font-size: 16px;">⚠ Gear Requiring Attention</h3>
            <p style="color: #991b1b; font-size: 12px; margin: 0 0 10px 0;">These items may need to be hired externally or confirmed:</p>
            <ul style="margin: 0; padding-left: 20px; color: #dc2626;">
              ${quote.unavailableGear.map((item) => `<li>${item}</li>`).join("")}
            </ul>
          </div>
        `
        : "";

      emailHtml = `
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
        <p><strong>Time:</strong> ${formData.eventTime || "N/A"}</p>
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

        ${pdfBuffer ? "<p><em>Quote PDF attached</em></p>" : "<p><em>Quote PDF not generated (extra-large package or generation failed)</em></p>"}
        ${jobSheetBuffer ? "<p><em>Job Sheet PDF attached (with AI-generated execution notes and suggested gear)</em></p>" : ""}

        ${unavailableGearHtml}

        <hr />
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #0369a1;">
            Review the quote and send to client for approval:
          </p>
          <a href="${SITE_URL}/review-quote?token=${inquiry.approval_token}"
             style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Review Quote
          </a>
        </div>
      `;
    }

    // Send email with attachments
    const emailOptions: {
      to: string[];
      subject: string;
      html: string;
      attachments?: { filename: string; content: string }[];
    } = {
      to: [BUSINESS_EMAIL.replace("@", emailTag)],
      subject: `${isBackline ? "Backline" : "Sound System"} Inquiry from ${formData.contactName} - Quote ${quote.quoteNumber}`,
      html: emailHtml,
    };

    // Build attachments array
    const attachments: { filename: string; content: string }[] = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Quote-${quote.quoteNumber}.pdf`,
        content: base64Standard(pdfBuffer),
      });
    }
    if (jobSheetBuffer) {
      attachments.push({
        filename: `JobSheet-${quote.quoteNumber}.pdf`,
        content: base64Standard(jobSheetBuffer),
      });
    }
    if (attachments.length > 0) {
      emailOptions.attachments = attachments;
    }

    await sendEmail(emailOptions);

    // Update inquiry status
    await supabase
      .from("inquiries")
      .update({ status: "quoted" })
      .eq("id", inquiry_id);

    console.log(`Inquiry ${inquiry_id} processed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        quoteNumber: quote.quoteNumber,
        driveFileId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing inquiry:", error);

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
