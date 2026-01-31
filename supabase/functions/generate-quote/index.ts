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

// Tech rider requirements parsed from uploaded document
interface TechRiderRequirements {
  specificGear: string[];
  hasBackline: boolean;
  inputChannels: number | null;
  monitorMixes: number | null;
  hasBand: boolean;
  hasDJ: boolean;
  stageLayout: string | null;
  powerRequirements: string | null;
  notes: string | null;
}

interface FullSystemFormData {
  type?: "fullsystem";
  package: string;
  eventType: string;
  eventTypeOther?: string;
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
  // Timing fields for contractors
  siteAvailableFrom?: string;
  callTime?: string;
  packOutTime?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  details: string;
  // Tech rider data parsed from uploaded document
  techRiderRequirements?: TechRiderRequirements | null;
  techRiderOriginalName?: string | null;
}

type FormData = BacklineFormData | FullSystemFormData;

// Structured line items for itemized quotes (like Quote-2025-1685)
interface QuoteLineItems {
  foh: number;
  monitors: { count: number; cost: number };
  microphones: { count: number; cost: number };
  console: number;
  cables: number;
  vehicle: number;
  techTime: { hours: number; rate: number; cost: number };
  backline?: number; // Optional backline hire cost (drums, amps, keys, etc.)
}

interface QuoteOutput {
  quoteNumber: string;
  title: string;
  description: string;
  lineItems: QuoteLineItems;
  subtotal: number;
  gst: number;
  total: number;
  rentalDays?: number;
  executionNotes?: string[];
  suggestedGear?: { item: string; quantity: number; notes?: string }[];
  unavailableGear?: string[];
}

// Legacy format for backline quotes
interface BacklineQuoteOutput {
  quoteNumber: string;
  title: string;
  description: string;
  lineItems: { description: string; amount: number }[];
  suggestedGear: { item: string; quantity: number; days: number }[];
  subtotal: number;
  gst: number;
  total: number;
  rentalDays?: number;
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

// Default hourly rate for tech time (minimum $65/hr)
const DEFAULT_TECH_RATE = 65;

/**
 * Parse time string to 24-hour format
 */
function parseTimeTo24Hour(time: string): { hours: number; minutes: number } | null {
  if (!time) return null;
  const trimmed = time.trim().toUpperCase();

  // Try 12-hour format: "6:00 PM", "11:30 AM"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const period = match12[3];
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // Try 24-hour format: "18:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return { hours: parseInt(match24[1], 10), minutes: parseInt(match24[2], 10) };
  }
  return null;
}

/**
 * Calculate event duration in hours
 */
function calculateEventDuration(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 4;
  const start = parseTimeTo24Hour(startTime);
  const end = parseTimeTo24Hour(endTime);
  if (!start || !end) return 4;

  const startMinutes = start.hours * 60 + start.minutes;
  let endMinutes = end.hours * 60 + end.minutes;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60; // spans midnight
  return (endMinutes - startMinutes) / 60;
}

/**
 * Format time for display
 */
function formatTime(time?: string): string {
  if (!time) return "";
  if (time.toUpperCase().includes("AM") || time.toUpperCase().includes("PM")) return time;
  const parsed = parseTimeTo24Hour(time);
  if (!parsed) return time;
  const { hours, minutes } = parsed;
  const ampm = hours >= 12 && hours < 24 ? "PM" : "AM";
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

// ============================================
// EQUIPMENT RULES (from gemini-sound-quote.ts)
// ============================================

const EQUIPMENT_RULES = `
## CRITICAL: USE EXACT NAMES FROM INVENTORY
You MUST use the EXACT equipment names from the AVAILABLE INVENTORY list below.
Do NOT add brand prefixes, model suffixes, or modify names in any way.
If an item isn't in inventory, don't include it.

## BASE PACKAGES

### Small Package (10-50 people)
- 2x small/8" powered speakers (from Speakers category)
- 2x speaker stands
- 1x small mixer (from Mixers category)
- 1x handheld microphone + stand
- Supporting cabling
- 30 min setup time

### Medium Package (50-200 people)
- 2x medium/12" powered speakers - main FOH
- 2x small/8" powered speakers - delays
- 4x speaker stands
- 1x small mixer
- 1x handheld microphone + stand
- Supporting cabling
- 1 hour setup time

### Large Package (200-1000 people)
- 4x medium/12" powered speakers
- 2x small/8" powered speakers
- 6x speaker stands
- 1x small mixer
- 1x handheld microphone + stand
- Supporting cabling
- 2 hours setup time

## CONDITIONAL ADD-ONS

### Bluetooth Playback Only
- Use smallest mixer available
- Small powered speakers
- +15 min tech time

### DJ / Loud Dance Music (IMPORTANT - WHEN TO ADD SUBS)
Apply this rule when ANY of these are true:
- User has selected "DJ" option
- Event type is wedding/party with dancing expected
- Client mentions dance floor, DJ, loud music, bass, or club-style sound
- Tech rider mentions DJ equipment or heavy bass music

When triggered:
- ADD: 2x subwoofers (from Subs category) - REQUIRED for proper bass response
- ADD: 2x sub poles (these REPLACE 2 speaker stands - mains sit on subs)
- DO NOT include separate speaker stands for mains when subs are used
- +15 min tech time

### Professional DJ
- ADD: 1x booth monitor speaker

### Live Band (CRITICAL - READ CAREFULLY)
When there is a live band:

SPEAKERS:
- ADD: 2x subwoofers - REQUIRED for any band with drums/bass
- Mains: Use 12" powered speakers from inventory
- Delays: Only if venue is long/deep - for audience coverage

MONITORS (assign by STAGE POSITION, not mix count):
- 6 monitor mixes does NOT mean 6 wedges
- Typically: 1 wedge per vocal mic, 1-2 for drums
- Horn sections/brass can SHARE wedges (2-3 players per wedge)
- Use powered speakers from inventory as monitors
- Example: 11-piece brass band = 3-4 wedges, not 6

MICROPHONES (must be included in quote):
- Count ALL inputs from tech rider
- Use microphones from inventory that match the application
- Include microphone stands for each mic

CONSOLE & STAGE BOX:
- UPGRADE to digital console (for 16+ channels)
- ADD digital stage box (for clean stage runs)

### Wireless Microphone
- ADD wireless microphone system from inventory

### Backline Hire (WHEN TECH RIDER REQUESTS INSTRUMENTS)
When the tech rider or form mentions backline/instrument requests:
- Look for drum kits in inventory (e.g., "Ludwig" → Drum Kits category)
- Look for bass amps/cabs in inventory (e.g., "Ampeg SVT" → Bass Heads + Bass Cabinets)
- Look for guitar amps in inventory (e.g., "Fender Deluxe", "Vox AC30" → Guitar Amps category)
- Look for keyboards in inventory (e.g., "Nord", "Rhodes" → Keyboards category)
- Include matching items from inventory in suggestedGear
- Add backline costs to the appropriate line items

Common backline mappings:
- "Drum Kit" / "Ludwig" / "DW" → Find drum kits in Drum Kits category
- "SVT" / "Ampeg" / "Bass Rig" → Find bass heads + bass cabinets
- "Fender" / "Vox" / "Marshall" / "Guitar Amp" → Find items in Guitar Amps
- "Keys" / "Keyboard" / "Nord" / "Piano" → Find items in Keyboards

## TECH TIME CALCULATION (IMPORTANT)
Tech time = Event Duration + Setup Time + Load Time + Unload Time + Pack-out Time

Formula:
- Event duration: Parse from event time (e.g., 6pm-11pm = 5 hours)
- Setup time: From form input, or estimate (small=1hr, medium=2hr, large=3hr)
- Load time: 30 minutes (standard)
- Unload time: 30 minutes (standard)
- Pack-out time: Half of setup time

Example for 5hr event with 2hr setup:
5 + 2 + 0.5 + 0.5 + 1 = 9 hours total

NEVER just guess "4 hours" - always calculate using this formula.
`;

// ============================================
// INVENTORY
// ============================================

interface AudioEquipmentItem {
  id: string;
  category: string;
  name: string;
  notes: string | null;
  hire_rate_per_day: number;
  stock_quantity: number;
}

async function fetchAudioEquipment(supabase: ReturnType<typeof createClient>): Promise<AudioEquipmentItem[]> {
  // Fetch from consolidated equipment table
  const { data, error } = await supabase
    .from("equipment")
    .select("id, category, name, notes, hire_rate_per_day, stock_quantity")
    .eq("available", true)
    .order("category")
    .order("name");

  if (error) console.error("Error fetching equipment:", error);

  return data || [];
}

function formatInventoryForPrompt(inventory: AudioEquipmentItem[]): string {
  if (inventory.length === 0) return "No inventory data available - suggest standard professional audio gear.";

  const byCategory: Record<string, string[]> = {};
  for (const item of inventory) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(`${item.name} (qty: ${item.stock_quantity}, $${item.hire_rate_per_day}/day)`);
  }

  let result = "AVAILABLE INVENTORY - USE THESE ITEMS AND PRICES:\n";
  for (const [category, items] of Object.entries(byCategory)) {
    result += `\n${category}:\n`;
    result += items.map((i) => `  - ${i}`).join("\n");
  }
  return result;
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

async function generateBacklineQuote(formData: BacklineFormData, supabase: ReturnType<typeof createClient>): Promise<BacklineQuoteOutput> {
  const quoteNumber = generateQuoteNumber();
  const rentalDays = calculateRentalDays(formData.startDate, formData.endDate);

  const equipmentNames = formData.equipment.map((e) => e.name);
  const { data: dbItems } = await supabase.from("equipment").select("name, hire_rate_per_day").eq("type", "backline").in("name", equipmentNames);

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

  // Build suggestedGear with clean equipment names for Google Sheet VLOOKUP
  const suggestedGear = formData.equipment.map((item) => ({
    item: item.name,
    quantity: item.quantity,
    days: rentalDays,
  }));

  return { quoteNumber, title, description, lineItems, suggestedGear, subtotal, gst, total: subtotal + gst, rentalDays };
}

async function generateFullSystemQuote(formData: FullSystemFormData, supabase: ReturnType<typeof createClient>): Promise<QuoteOutput> {
  const quoteNumber = generateQuoteNumber();

  // Fetch inventory from database
  const inventory = await fetchAudioEquipment(supabase);
  console.log(`[generate-quote] Loaded ${inventory.length} equipment items from database`);

  // Calculate event duration and tech time
  const eventDuration = calculateEventDuration(formData.eventStartTime, formData.eventEndTime);
  const setupHours = formData.package === "small" ? 1 : formData.package === "medium" ? 2 : 3;
  const packoutHours = formData.package === "small" ? 0.5 : formData.package === "medium" ? 1 : 1.5;
  const totalTechHours = eventDuration + setupHours + 1 + packoutHours; // 1 hour for load/unload

  // Format package size for display
  const packageSizes: Record<string, string> = {
    small: "10-50 people",
    medium: "50-200 people",
    large: "200-1000 people",
  };

  const quotePrompt = `You are creating a quote for Accent Entertainment, an audio production company in Wellington, New Zealand.

## EQUIPMENT SELECTION RULES
Follow these rules to select equipment based on package size and requirements:
${EQUIPMENT_RULES}

## AVAILABLE INVENTORY
${formatInventoryForPrompt(inventory)}

## EVENT DETAILS
- Type: ${formData.eventType === 'other' && formData.eventTypeOther ? formData.eventTypeOther : (formData.eventType || "Event")}
- Name: ${formData.eventName || "Not specified"}
- Package Size: ${formData.package} (${packageSizes[formData.package] || "N/A"})
- Date: ${formData.eventDate || "TBC"}
- Event Time: ${formatTime(formData.eventStartTime)} - ${formatTime(formData.eventEndTime)}
- Event Duration: ${eventDuration} hours
- Location: ${formData.location || "TBC"}
- Environment: ${formData.indoorOutdoor || "TBC"}
${formData.powerAccess ? `- Power Access: ${formData.powerAccess}` : ""}
${formData.hasStage ? `- Stage: Yes ${formData.stageDetails ? `(${formData.stageDetails})` : ""}` : ""}

CONTENT REQUIREMENTS:
${formData.playbackFromDevice ? "- Playback from device (iPhone/Laptop)" : ""}
${formData.hasLiveMusic ? "- Live music" : ""}
${formData.hasBand ? "- Live band(s)" : ""}
${formData.hasDJ ? "- DJ setup required" : ""}
${formData.hasSpeeches ? "- Speeches/presentations" : ""}
${formData.needsWirelessMic ? "- Wireless microphones" : ""}
${formData.additionalInfo ? `- Additional: ${formData.additionalInfo}` : ""}
${formData.details ? `- Other details: ${formData.details}` : ""}
${formData.techRiderRequirements ? `
## TECH RIDER REQUIREMENTS (IMPORTANT - from uploaded document: ${formData.techRiderOriginalName || "tech rider"})
${formData.techRiderRequirements.specificGear?.length ? `- Specific gear requests: ${formData.techRiderRequirements.specificGear.join(", ")}` : ""}
${formData.techRiderRequirements.hasBackline ? "- BACKLINE REQUIRED - Include backline hire items from inventory" : ""}
${formData.techRiderRequirements.inputChannels ? `- Input channels needed: ${formData.techRiderRequirements.inputChannels}` : ""}
${formData.techRiderRequirements.monitorMixes ? `- Monitor mixes: ${formData.techRiderRequirements.monitorMixes}` : ""}
${formData.techRiderRequirements.hasBand ? "- Has live band (from tech rider)" : ""}
${formData.techRiderRequirements.hasDJ ? "- Has DJ (from tech rider)" : ""}
${formData.techRiderRequirements.stageLayout ? `- Stage layout: ${formData.techRiderRequirements.stageLayout}` : ""}
${formData.techRiderRequirements.powerRequirements ? `- Power requirements: ${formData.techRiderRequirements.powerRequirements}` : ""}
${formData.techRiderRequirements.notes ? `- Additional notes: ${formData.techRiderRequirements.notes}` : ""}

CRITICAL: The tech rider lists specific backline/gear requests. You MUST include these items in the quote if they exist in our inventory.
Match requested items to our inventory (e.g., "Ludwig Drum Kit" → find drum kits, "Ampeg SVT" → find bass amps, "Fender Deluxe/Vox AC30" → find guitar amps).
` : ""}

Return a JSON object with this EXACT structure:
{
  "title": "Sound System Hire @ [Location] ([Date])",
  "description": "Brief 2-3 sentence description",
  "lineItems": {
    "foh": <number - FOH speakers + subs cost>,
    "monitors": { "count": <number of wedges>, "cost": <number> },
    "microphones": { "count": <number of mics>, "cost": <number> },
    "console": <number - mixing console + stage box cost>,
    "cables": <number - cables, DI boxes, accessories cost>,
    "vehicle": <number - delivery/pickup cost, usually 100-150>,
    "techTime": { "hours": ${totalTechHours}, "rate": ${DEFAULT_TECH_RATE}, "cost": ${totalTechHours * DEFAULT_TECH_RATE} },
    "backline": <number - 0 if no backline requested, otherwise sum of drum kit, amps, keyboards hire rates>
  },
  "executionNotes": [
    "<bullet point 1 - specific setup instruction>",
    "<bullet point 2 - monitor mix assignments>",
    "<bullet point 3 - FOH position>",
    "<etc - 5-8 concise execution notes>"
  ],
  "suggestedGear": [
    { "item": "<exact name from inventory>", "quantity": 2, "notes": "FOH L/R" },
    { "item": "<exact name from inventory>", "quantity": 4, "notes": "Vocals" }
  ],
  "unavailableGear": []
}

## INSTRUCTIONS
1. Start with BASE PACKAGE equipment from EQUIPMENT SELECTION RULES for package: ${formData.package}
2. Apply CONDITIONAL ADD-ONS based on content requirements (DJ=${formData.hasDJ}, band=${formData.hasBand}, wireless=${formData.needsWirelessMic})
3. Match gear names to AVAILABLE INVENTORY where possible (use exact inventory names)
4. Calculate costs by summing hire rates from inventory for each category
5. Tech time is pre-calculated: ${totalTechHours} hours × $${DEFAULT_TECH_RATE}/hr = $${totalTechHours * DEFAULT_TECH_RATE}

## PRICING GUIDELINES
- FOH: Sum hire rates for all FOH speakers + subs
- Monitors: Sum hire rates for all monitor wedges
- Console: Hire rate for mixing console + stage box if needed
- Cables: $150-300 depending on complexity
- Vehicle: $100-150 depending on gear quantity
- Backline: Sum hire rates for all requested backline items (drums, guitar amps, bass amps, keyboards) - set to 0 if no backline requested

Return ONLY the JSON object, no other text.`;

  const aiResponse = await callGemini(quotePrompt);
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI quote response");

  const parsed = JSON.parse(jsonMatch[0]);

  // Parse structured line items
  const lineItems: QuoteLineItems = {
    foh: parsed.lineItems?.foh ?? 0,
    monitors: {
      count: parsed.lineItems?.monitors?.count ?? 0,
      cost: parsed.lineItems?.monitors?.cost ?? 0,
    },
    microphones: {
      count: parsed.lineItems?.microphones?.count ?? 0,
      cost: parsed.lineItems?.microphones?.cost ?? 0,
    },
    console: parsed.lineItems?.console ?? 0,
    cables: parsed.lineItems?.cables ?? 0,
    vehicle: parsed.lineItems?.vehicle ?? 100,
    techTime: {
      hours: parsed.lineItems?.techTime?.hours ?? totalTechHours,
      rate: parsed.lineItems?.techTime?.rate ?? DEFAULT_TECH_RATE,
      cost: parsed.lineItems?.techTime?.cost ?? totalTechHours * DEFAULT_TECH_RATE,
    },
    backline: parsed.lineItems?.backline ?? 0,
  };

  // Calculate subtotal from structured line items
  const subtotal =
    lineItems.foh +
    lineItems.monitors.cost +
    lineItems.microphones.cost +
    lineItems.console +
    lineItems.cables +
    lineItems.vehicle +
    lineItems.techTime.cost +
    (lineItems.backline || 0);

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
    title: parsed.title || `Sound System Hire @ ${formData.location || "TBC"}`,
    description: parsed.description || "",
    lineItems,
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

    let quote: BacklineQuoteOutput | QuoteOutput;
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
      quote = await generateFullSystemQuote(formData, supabase);
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
      // Timing fields from client form
      bookingData.site_available_from = formData.siteAvailableFrom || null;
      bookingData.call_time = formData.callTime || null;
      bookingData.pack_out_time = formData.packOutTime || null;
      const contentReqs: string[] = [];
      if (formData.playbackFromDevice) contentReqs.push("Playback");
      if (formData.hasDJ) contentReqs.push("DJ");
      if (formData.hasBand) contentReqs.push("Band");
      if (formData.hasSpeeches) contentReqs.push("Speeches");
      const fullQuote = quote as QuoteOutput;
      bookingData.details_json = { type: "fullsystem", package: formData.package, eventType: formData.eventType, eventTypeOther: formData.eventTypeOther, contentRequirements: contentReqs, lineItems: fullQuote.lineItems, executionNotes: fullQuote.executionNotes, suggestedGear: fullQuote.suggestedGear, unavailableGear: fullQuote.unavailableGear };
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
