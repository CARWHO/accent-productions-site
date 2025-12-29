// Supabase Edge Function: generate-quote
// Step 1 of 3: Generates AI quote and saves to database
// Triggered by database webhook when status = 'pending_quote'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

// ============================================
// ENVIRONMENT & CONFIG
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const BUSINESS_EMAIL = Deno.env.get("BUSINESS_EMAIL") || "hello@accent-productions.co.nz";

const GOOGLE_CLOUD_LOCATION = "us-central1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let serviceAccount: { client_email: string; private_key: string; project_id: string };
try {
  serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
} catch {
  console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
}

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

// ============================================
// UTILITIES
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
// VERTEX AI
// ============================================

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", binaryDer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getVertexAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: serviceAccount.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };

  const encoder = new TextEncoder();
  const headerB64 = base64Encode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64Encode(encoder.encode(JSON.stringify(payload)));
  const signInput = `${headerB64}.${payloadB64}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoder.encode(signInput));
  const jwt = `${signInput}.${base64Encode(new Uint8Array(signature))}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });

  if (!tokenResponse.ok) throw new Error(`OAuth2 token error: ${await tokenResponse.text()}`);
  return (await tokenResponse.json()).access_token;
}

async function callGemini(prompt: string): Promise<string> {
  const accessToken = await getVertexAccessToken();
  const url = `https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${serviceAccount.project_id}/locations/${GOOGLE_CLOUD_LOCATION}/publishers/google/models/gemini-2.0-flash:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
  });

  if (!response.ok) throw new Error(`Vertex AI error: ${await response.text()}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ============================================
// EMAIL
// ============================================

async function sendEmail(options: { to: string[]; subject: string; html: string }): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: "Accent Productions <notifications@accent-productions.co.nz>", ...options }),
  });
  if (!response.ok) throw new Error(`Resend API error: ${await response.text()}`);
}

// ============================================
// QUOTE GENERATION
// ============================================

async function generateBacklineQuote(formData: BacklineFormData, supabase: ReturnType<typeof createClient>): Promise<QuoteOutput> {
  const quoteNumber = generateQuoteNumber();
  const rentalDays = calculateRentalDays(formData.startDate, formData.endDate);

  const equipmentNames = formData.equipment.map((e) => e.name);
  const { data: dbItems } = await supabase.from("hire_items").select("name, hire_rate_per_day").in("name", equipmentNames);

  const lineItems: { description: string; amount: number }[] = [];
  let equipmentSubtotal = 0;

  for (const item of formData.equipment) {
    const dbItem = dbItems?.find((db: { name: string }) => db.name === item.name);
    const dailyRate = dbItem?.hire_rate_per_day || 0;
    const day1Cost = item.quantity * dailyRate;
    const additionalDaysCost = rentalDays > 1 ? (rentalDays - 1) * (item.quantity * dailyRate * 0.5) : 0;
    const totalItemCost = day1Cost + additionalDaysCost;

    let description = `${item.quantity} x ${item.name}`;
    if (dailyRate) description += ` @ $${dailyRate}/day`;
    if (rentalDays > 1) description += ` (Day 1: $${day1Cost}, Days 2-${rentalDays} @ 50%)`;

    lineItems.push({ description, amount: totalItemCost });
    equipmentSubtotal += totalItemCost;
  }

  if (formData.deliveryMethod === "delivery") {
    lineItems.push({ description: "Delivery & Collection", amount: 150 });
    equipmentSubtotal += 150;
  }

  const subtotal = equipmentSubtotal;
  const gst = Math.round(subtotal * 0.15 * 100) / 100;

  let title = "Backline Hire";
  let description = "";

  try {
    const equipmentSummary = formData.equipment.map((e) => `${e.quantity}x ${e.name}`).join(", ");
    const prompt = `You are writing a professional quote description for an audio equipment hire company.
The customer is requesting: ${equipmentSummary} for ${rentalDays} day(s).
${formData.otherEquipment ? `Additional requests: ${formData.otherEquipment}` : ""}
Delivery: ${formData.deliveryMethod === "delivery" ? "Delivery to " + (formData.deliveryAddress || "customer") : "Pickup"}

Generate:
TITLE: [5-10 word title like "Backline Hire @ [Location]"]
DESCRIPTION: [2-3 sentence professional description]`;

    const response = await callGemini(prompt);
    const titleMatch = response.match(/TITLE:\s*(.+?)(?:\n|$)/i);
    const descMatch = response.match(/DESCRIPTION:\s*([\s\S]+?)$/i);
    if (titleMatch) title = titleMatch[1].trim();
    if (descMatch) description = descMatch[1].trim();
  } catch (error) {
    console.error("AI description error:", error);
    description = `${formData.equipment.length} items for ${rentalDays} day(s) hire.`;
  }

  return { quoteNumber, title, description, lineItems, subtotal, gst, total: subtotal + gst, rentalDays };
}

async function generateFullSystemQuote(formData: FullSystemFormData): Promise<QuoteOutput> {
  const quoteNumber = generateQuoteNumber();

  const eventSummary = `
Event: ${formData.eventName || "Event"}, Type: ${formData.eventType || "N/A"}
Date: ${formData.eventDate || "TBC"}, Time: ${formData.eventStartTime} - ${formData.eventEndTime}
Location: ${formData.location || "TBC"}, Attendance: ${formData.attendance || "N/A"}, Package: ${formData.package}
Content: Playback=${formData.playbackFromDevice}, LiveMusic=${formData.hasLiveMusic}, DJ=${formData.hasDJ}, Band=${formData.hasBand}, Speeches=${formData.hasSpeeches}
Venue: ${formData.indoorOutdoor || "N/A"}, Stage=${formData.hasStage}, Generator=${formData.needsGenerator}
${formData.additionalInfo ? `Notes: ${formData.additionalInfo}` : ""}`.trim();

  const quotePrompt = `You are a professional audio equipment hire company in New Zealand. Generate a quote:

${eventSummary}

Return JSON:
{"title": "Short title", "description": "2-3 sentences", "lineItems": [{"description": "Item", "amount": 123}], "executionNotes": ["Setup notes array"], "suggestedGear": [{"item": "Name", "quantity": 2, "notes": "optional"}], "unavailableGear": ["Items needing external hire"]}

Pricing (NZD): Small (10-50): $500-800, Medium (50-200): $1200-2000, Large (200-1000): $3000-5000
Only return JSON.`;

  const aiResponse = await callGemini(quotePrompt);
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI quote response");

  const parsed = JSON.parse(jsonMatch[0]);
  const subtotal = parsed.lineItems.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
  const gst = Math.round(subtotal * 0.15 * 100) / 100;

  let executionNotes: string[] = [];
  if (Array.isArray(parsed.executionNotes)) executionNotes = parsed.executionNotes;
  else if (typeof parsed.executionNotes === "string") executionNotes = parsed.executionNotes.split("\n").filter((n: string) => n.trim());

  let suggestedGear: { item: string; quantity: number; notes?: string }[] = [];
  if (Array.isArray(parsed.suggestedGear)) {
    suggestedGear = parsed.suggestedGear.map((g: string | { item: string; quantity?: number; notes?: string }) =>
      typeof g === "string" ? { item: g, quantity: 1 } : { item: g.item, quantity: g.quantity || 1, notes: g.notes }
    );
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
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const inquiry_id = payload.record?.id || payload.inquiry_id;
    if (!inquiry_id) return new Response(JSON.stringify({ error: "Missing inquiry_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`[generate-quote] Processing: ${inquiry_id}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: inquiry, error: fetchError } = await supabase.from("inquiries").select("*").eq("id", inquiry_id).single();
    if (fetchError || !inquiry) throw new Error(`Failed to fetch inquiry: ${fetchError?.message}`);
    if (inquiry.status !== "pending_quote") return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const formData: FormData = inquiry.form_data_json;
    const isBackline = isBacklineInquiry(formData);

    let quote: QuoteOutput;
    if (isBackline) {
      quote = await generateBacklineQuote(formData, supabase);
    } else {
      const validPackages = ["small", "medium", "large"];
      if (!formData.package || !validPackages.includes(formData.package)) {
        await sendEmail({
          to: [BUSINESS_EMAIL.replace("@", "+fullevent@")],
          subject: `Sound System Inquiry from ${formData.contactName}`,
          html: `<h1>New Sound System Inquiry</h1><p>Package: ${formData.package || "N/A"}</p><p>Event: ${formData.eventName || "N/A"}</p><p>Contact: ${formData.contactName} (${formData.contactEmail})</p><p>Requires manual quote.</p>`,
        });
        await supabase.from("inquiries").update({ status: "new" }).eq("id", inquiry_id);
        return new Response(JSON.stringify({ success: true, manual: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      quote = await generateFullSystemQuote(formData);
    }

    console.log(`[generate-quote] Quote ${quote.quoteNumber} generated`);

    // Create booking record
    const bookingData: Record<string, unknown> = {
      inquiry_id, quote_number: quote.quoteNumber, booking_type: isBackline ? "backline" : "fullsystem",
      status: "pending", client_name: formData.contactName, client_email: formData.contactEmail,
      client_phone: formData.contactPhone, approval_token: inquiry.approval_token, quote_total: quote.total,
    };

    if (isBackline) {
      bookingData.event_date = formData.startDate || null;
      bookingData.location = formData.deliveryMethod === "delivery" ? formData.deliveryAddress : "Pickup";
      bookingData.event_name = `Backline Hire - ${formData.contactName}`;
      bookingData.details_json = { type: "backline", equipment: formData.equipment, rentalPeriod: { start: formData.startDate, end: formData.endDate }, deliveryMethod: formData.deliveryMethod, lineItems: quote.lineItems, rentalDays: quote.rentalDays };
    } else {
      bookingData.event_date = formData.eventDate || null;
      bookingData.event_time = formData.eventStartTime && formData.eventEndTime ? `${formData.eventStartTime} - ${formData.eventEndTime}` : null;
      bookingData.location = formData.location || null;
      bookingData.event_name = formData.eventName || null;
      const contentReqs: string[] = [];
      if (formData.playbackFromDevice) contentReqs.push("Playback");
      if (formData.hasDJ) contentReqs.push("DJ");
      if (formData.hasBand) contentReqs.push("Band");
      if (formData.hasSpeeches) contentReqs.push("Speeches");
      bookingData.details_json = { type: "fullsystem", package: formData.package, eventType: formData.eventType, contentRequirements: contentReqs, lineItems: quote.lineItems, executionNotes: quote.executionNotes, suggestedGear: quote.suggestedGear, unavailableGear: quote.unavailableGear };
    }

    await supabase.from("bookings").insert(bookingData);
    await supabase.from("inquiries").update({ quote_data: quote, status: "quote_generated" }).eq("id", inquiry_id);

    console.log(`[generate-quote] Done, status -> quote_generated`);
    return new Response(JSON.stringify({ success: true, quoteNumber: quote.quoteNumber }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[generate-quote] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
