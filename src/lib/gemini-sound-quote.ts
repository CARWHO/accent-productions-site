import { GoogleGenAI } from '@google/genai';
import { TechRiderRequirements } from './parse-tech-rider';
import { getSupabaseAdmin } from './supabase';

// Initialize Google GenAI with Vertex AI
function getGenAIClient(): GoogleGenAI | null {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';

  // GOOGLE_API_KEY is read automatically by the SDK from env
  if (!process.env.GOOGLE_API_KEY || !project) {
    console.warn('[SoundQuote] GenAI not configured - missing GOOGLE_API_KEY or GOOGLE_CLOUD_PROJECT');
    return null;
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });
}

// Audio equipment from database
interface AudioEquipmentItem {
  id: string;
  category: string;
  name: string;
  notes: string | null;
  hire_rate_per_day: number;
  stock_quantity: number;
}

export type PackageType = 'small' | 'medium' | 'large' | 'extra_large';
export type EventType = 'wedding' | 'corporate' | 'festival' | 'private_party' | 'other';

export interface SoundQuoteInput {
  package: PackageType;
  eventType?: EventType;
  eventName?: string;
  organization?: string;
  eventDate?: string;
  eventStartTime?: string; // 24hr format "18:00"
  eventEndTime?: string;   // 24hr format "23:00"
  attendance?: number;

  // Small event specifics
  playbackFromDevice?: boolean;
  hasLiveMusic?: boolean;
  needsMic?: boolean;
  hasDJ?: boolean;

  // Medium/Large event specifics
  hasBand?: boolean;
  bandCount?: number;
  bandNames?: string;
  bandSetup?: string;
  needsDJTable?: boolean;
  needsCDJs?: boolean;
  cdjType?: string;
  hasSpeeches?: boolean;
  needsWirelessMic?: boolean;
  needsLectern?: boolean;
  needsAmbientMusic?: boolean;
  additionalInfo?: string;

  // Venue details
  location?: string;
  venueContact?: string;
  indoorOutdoor?: string;
  wetWeatherPlan?: string;
  needsGenerator?: boolean;
  powerAccess?: string;
  hasStage?: boolean;
  stageDetails?: string;

  // Contact
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  details?: string;

  // Tech rider (parsed from uploaded PDF)
  techRiderRequirements?: TechRiderRequirements;
}

export interface QuoteLineItems {
  foh: number;
  monitors: { count: number; cost: number };
  microphones: { count: number; cost: number };
  console: number;
  cables: number;
  vehicle: number;
  techTime: { hours: number; rate: number; cost: number };
}

export interface SuggestedGearItem {
  item: string;
  quantity: number;
  notes?: string;
  matchedInInventory?: boolean;
  matchedName?: string; // The actual name from inventory if matched
}

export interface SoundQuoteOutput {
  quoteNumber: string;
  title: string;
  subtitle: string;

  // Structured line items for quote PDF (client-facing)
  lineItems: QuoteLineItems;

  // Internal job sheet data
  executionNotes: string[];
  suggestedGear: SuggestedGearItem[];
  unavailableGear: string[]; // Items that don't match inventory

  subtotal: number;
  gst: number;
  total: number;
}

// Package base prices
const packagePrices: Record<PackageType, number> = {
  small: 500,
  medium: 1200,
  large: 3000,
  extra_large: 5000
};

// Default hourly rate for tech time (minimum $65/hr)
const DEFAULT_TECH_RATE = 65;

/**
 * Parse time string to 24-hour format hours and minutes
 * Handles both "6:00 PM" (12-hour) and "18:00" (24-hour) formats
 */
function parseTimeTo24Hour(time: string): { hours: number; minutes: number } | null {
  if (!time) return null;

  const trimmed = time.trim().toUpperCase();

  // Try 12-hour format first: "6:00 PM", "11:30 AM", "6PM", etc.
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const period = match12[3];

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
  }

  // Try 24-hour format: "18:00", "09:30"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return {
      hours: parseInt(match24[1], 10),
      minutes: parseInt(match24[2], 10)
    };
  }

  return null;
}

/**
 * Calculate event duration in hours from start and end times
 * Handles both 12-hour (e.g., "6:00 PM") and 24-hour (e.g., "18:00") formats
 * Handles events that span midnight (e.g., 6:00 PM to 1:00 AM)
 */
function calculateEventDuration(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 4; // Default to 4 hours if not specified

  const start = parseTimeTo24Hour(startTime);
  const end = parseTimeTo24Hour(endTime);

  if (!start || !end) return 4; // Invalid format, use default

  const startMinutes = start.hours * 60 + start.minutes;
  let endMinutes = end.hours * 60 + end.minutes;

  // If end time is less than start time, event spans midnight
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

/**
 * Format time for display (pass through if already in 12-hour format)
 */
function formatTime(time?: string): string {
  if (!time) return '';

  // If already in 12-hour format (contains AM/PM), pass through
  if (time.toUpperCase().includes('AM') || time.toUpperCase().includes('PM')) {
    return time;
  }

  // Convert 24-hour to 12-hour format
  const parsed = parseTimeTo24Hour(time);
  if (!parsed) return time;

  const { hours, minutes } = parsed;
  const ampm = hours >= 12 && hours < 24 ? 'PM' : 'AM';
  const hour12 = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
  return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

// Equipment selection rules for quote generation
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

function generateQuoteNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${year}-${random}`;
}

function formatEventType(type?: EventType): string {
  const typeLabels: Record<EventType, string> = {
    wedding: 'Wedding',
    corporate: 'Corporate Event',
    festival: 'Festival',
    private_party: 'Private Party',
    other: 'Event'
  };
  return type ? typeLabels[type] : 'Event';
}

function formatPackageSize(pkg: PackageType): string {
  const sizes: Record<PackageType, string> = {
    small: '10-50 people',
    medium: '50-200 people',
    large: '200-1000 people',
    extra_large: '1000+ people'
  };
  return sizes[pkg];
}

// Fetch available equipment from consolidated equipment table
async function fetchAudioEquipment(): Promise<AudioEquipmentItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn('No Supabase connection, skipping inventory fetch');
    return [];
  }

  // Fetch from consolidated equipment table
  const { data, error } = await supabase
    .from('equipment')
    .select('id, category, name, notes, hire_rate_per_day, stock_quantity')
    .eq('available', true)
    .order('category')
    .order('name');

  if (error) {
    console.error('Error fetching equipment:', error);
  }

  return data || [];
}

// Generic items that don't need inventory matching (always assumed available)
const GENERIC_ITEMS = [
  'speaker stand',
  'microphone stand',
  'mic stand',
  'supporting cabling',
  'cabling',
  'cables',
  'xlr',
  'power cable',
  'aux cable',
  'di box',
  'sub pole',
  'pole',
  'power strip',
  'power board',
  'extension lead',
  'extension cord',
  'gaffer tape',
  'tape',
  'sandbag',
  'cable tie',
  'velcro',
];

// Check if an item is generic (doesn't need inventory validation)
function isGenericItem(itemName: string): boolean {
  const lower = itemName.toLowerCase();
  return GENERIC_ITEMS.some(generic => lower.includes(generic));
}

// Validate suggested gear against inventory
function validateGearAgainstInventory(
  suggestedGear: SuggestedGearItem[],
  inventory: AudioEquipmentItem[]
): { validatedGear: SuggestedGearItem[]; unavailableGear: string[] } {
  const unavailableGear: string[] = [];

  const validatedGear = suggestedGear.map(gear => {
    // Skip generic items - always mark as matched
    if (isGenericItem(gear.item)) {
      return {
        ...gear,
        matchedInInventory: true,
        matchedName: gear.item
      };
    }

    // Try to find a matching item in inventory (case-insensitive, partial match)
    const searchTerm = gear.item.toLowerCase();

    const match = inventory.find(inv => {
      const invName = inv.name.toLowerCase();
      // Exact match
      if (invName === searchTerm) return true;
      // Inventory contains the search term
      if (invName.includes(searchTerm)) return true;
      // Search term contains the inventory name
      if (searchTerm.includes(invName)) return true;
      // Check for model number match (e.g., "SM58" matches "Shure SM58")
      const searchWords = searchTerm.split(/[\s-]+/);
      const invWords = invName.split(/[\s-]+/);
      return searchWords.some(sw => invWords.some(iw => sw === iw && sw.length > 2));
    });

    if (match) {
      return {
        ...gear,
        matchedInInventory: true,
        matchedName: match.name
      };
    } else {
      unavailableGear.push(gear.item);
      return {
        ...gear,
        matchedInInventory: false
      };
    }
  });

  return { validatedGear, unavailableGear };
}

// Format inventory list for AI prompt
function formatInventoryForPrompt(inventory: AudioEquipmentItem[]): string {
  if (inventory.length === 0) {
    return 'No inventory data available - suggest standard professional audio gear.';
  }

  const byCategory: Record<string, string[]> = {};
  for (const item of inventory) {
    if (!byCategory[item.category]) {
      byCategory[item.category] = [];
    }
    byCategory[item.category].push(`${item.name} (qty: ${item.stock_quantity})`);
  }

  let result = 'AVAILABLE INVENTORY - ONLY SUGGEST ITEMS FROM THIS LIST:\n';
  for (const [category, items] of Object.entries(byCategory)) {
    result += `\n${category}:\n`;
    result += items.map(i => `  - ${i}`).join('\n');
  }

  return result;
}

export async function generateSoundQuote(input: SoundQuoteInput): Promise<SoundQuoteOutput> {
  const quoteNumber = generateQuoteNumber();
  const basePrice = packagePrices[input.package];

  // Generate title and subtitle
  const locationPart = input.location || 'TBC';
  const datePart = input.eventDate
    ? new Date(input.eventDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'TBC';

  const title = `Sound System Hire @ ${locationPart} (${datePart})`;
  const subtitle = input.eventName || `${formatEventType(input.eventType)}`;

  // Fetch available inventory from database
  const inventory = await fetchAudioEquipment();
  console.log(`Loaded ${inventory.length} audio equipment items from database`);

  // Generate quote with AI or fallback
  let lineItems: QuoteLineItems;
  let executionNotes: string[];
  let suggestedGear: SuggestedGearItem[];

  const client = getGenAIClient();
  if (client) {
    try {
      const result = await generateWithAI(input, basePrice, inventory, client);
      lineItems = result.lineItems;
      executionNotes = result.executionNotes;
      suggestedGear = result.suggestedGear;
    } catch (error) {
      console.error('GenAI error:', error);
      const fallback = generateFallbackQuote(input, basePrice, inventory);
      lineItems = fallback.lineItems;
      executionNotes = fallback.executionNotes;
      suggestedGear = fallback.suggestedGear;
    }
  } else {
    const fallback = generateFallbackQuote(input, basePrice, inventory);
    lineItems = fallback.lineItems;
    executionNotes = fallback.executionNotes;
    suggestedGear = fallback.suggestedGear;
  }

  // Validate suggested gear against inventory
  const { validatedGear, unavailableGear } = validateGearAgainstInventory(suggestedGear, inventory);

  // Calculate totals from line items
  const subtotal = lineItems.foh +
    lineItems.monitors.cost +
    lineItems.microphones.cost +
    lineItems.console +
    lineItems.cables +
    lineItems.vehicle +
    lineItems.techTime.cost;

  const gst = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + gst;

  return {
    quoteNumber,
    title,
    subtitle,
    lineItems,
    executionNotes,
    suggestedGear: validatedGear,
    unavailableGear,
    subtotal,
    gst,
    total
  };
}

async function generateWithAI(
  input: SoundQuoteInput,
  basePrice: number,
  inventory: AudioEquipmentItem[],
  client: GoogleGenAI
): Promise<{ lineItems: QuoteLineItems; executionNotes: string[]; suggestedGear: SuggestedGearItem[] }> {
  const inventorySection = formatInventoryForPrompt(inventory);

  const prompt = `You are creating a quote for Accent Entertainment, an audio production company in Wellington, New Zealand.

## EQUIPMENT SELECTION RULES
Follow these rules to select equipment based on package size and requirements:
${EQUIPMENT_RULES}

## AVAILABLE INVENTORY
${inventorySection}

## EVENT DETAILS
- Type: ${formatEventType(input.eventType)}
- Name: ${input.eventName || 'Not specified'}
- Package Size: ${input.package} (${formatPackageSize(input.package)})
- Date: ${input.eventDate || 'TBC'}
- Event Time: ${formatTime(input.eventStartTime)} - ${formatTime(input.eventEndTime)}
- Event Duration: ${calculateEventDuration(input.eventStartTime, input.eventEndTime)} hours
- Location: ${input.location || 'TBC'}
- Environment: ${input.indoorOutdoor || 'TBC'}
${input.powerAccess ? `- Power Access: ${input.powerAccess}` : ''}
${input.hasStage ? `- Stage: Yes ${input.stageDetails ? `(${input.stageDetails})` : ''}` : ''}

CONTENT REQUIREMENTS:
${input.playbackFromDevice ? '- Playback from device (iPhone/Laptop)' : ''}
${input.hasLiveMusic ? '- Live music' : ''}
${input.hasBand ? '- Live band(s)' : ''}
${input.hasDJ ? '- DJ setup required' : ''}
${input.hasSpeeches ? '- Speeches/presentations' : ''}
${input.needsMic ? '- Microphone required' : ''}
${input.needsWirelessMic ? '- Wireless microphones' : ''}
${input.additionalInfo ? `- Additional: ${input.additionalInfo}` : ''}
${input.details ? `- Other details: ${input.details}` : ''}
${input.techRiderRequirements ? `
TECH RIDER REQUIREMENTS (from uploaded document):
- Input channels needed: ${input.techRiderRequirements.inputChannels || 'Not specified'}
- Monitor mixes needed: ${input.techRiderRequirements.monitorMixes || 'Not specified'}
- Specific gear requested: ${input.techRiderRequirements.specificGear?.join(', ') || 'None specified'}
- Stage box needed: ${input.techRiderRequirements.stageBoxNeeded ? 'Yes' : 'No'}
- In-ear monitors: ${input.techRiderRequirements.iemNeeded ? 'Yes' : 'No'}
- Drum mics: ${input.techRiderRequirements.drumMicsNeeded ? 'Yes' : 'No'}
- Power requirements: ${input.techRiderRequirements.powerRequirements || 'Not specified'}
- Stage layout: ${input.techRiderRequirements.stageLayout || 'Not specified'}
- Notes: ${input.techRiderRequirements.additionalNotes || 'None'}
` : ''}

BASE PRICE GUIDE: $${basePrice} for ${input.package} package

Return a JSON object with this EXACT structure:
{
  "lineItems": {
    "foh": <number - FOH speakers + subs cost>,
    "monitors": { "count": <number of wedges>, "cost": <number> },
    "microphones": { "count": <number of mics>, "cost": <number> },
    "console": <number - mixing console + stage box cost>,
    "cables": <number - cables, DI boxes, accessories cost>,
    "vehicle": <number - delivery/pickup cost, usually 100-150>,
    "techTime": { "hours": <number>, "rate": ${DEFAULT_TECH_RATE}, "cost": <number = hours * rate> }
  },
  "executionNotes": [
    "<bullet point 1 - specific setup instruction>",
    "<bullet point 2 - monitor mix assignments>",
    "<bullet point 3 - FOH position>",
    "<etc - 5-8 concise execution notes>"
  ],
  "suggestedGear": [
    { "item": "<exact name from inventory>", "quantity": 2, "notes": "FOH L/R" },
    { "item": "<exact name from inventory>", "quantity": 4, "notes": "Vocals" },
    { "item": "<etc>", "quantity": 1 }
  ]
}

## INSTRUCTIONS
1. Start with the BASE PACKAGE equipment from EQUIPMENT SELECTION RULES for the selected package size
2. Apply CONDITIONAL ADD-ONS based on content requirements (DJ, band, wireless mic, etc.)
3. If tech rider specifies additional requirements, incorporate those
4. Match gear names to AVAILABLE INVENTORY where possible (use exact inventory names)
5. Calculate TECH TIME:
   - Event Duration: ${calculateEventDuration(input.eventStartTime, input.eventEndTime)} hours (calculated from ${formatTime(input.eventStartTime)} to ${formatTime(input.eventEndTime)})
   - Setup Time: ${input.package === 'small' ? 0.5 : input.package === 'medium' ? 1 : input.package === 'large' ? 2 : 3} hours (based on package size)
   - Load/Unload: 1 hour total (0.5 + 0.5)
   - Pack-out: ${input.package === 'small' ? 0.5 : input.package === 'medium' ? 0.5 : input.package === 'large' ? 1 : 1.5} hours
   - TOTAL = ${calculateEventDuration(input.eventStartTime, input.eventEndTime) + (input.package === 'small' ? 0.5 : input.package === 'medium' ? 1 : input.package === 'large' ? 2 : 3) + 1 + (input.package === 'small' ? 0.5 : input.package === 'medium' ? 0.5 : input.package === 'large' ? 1 : 1.5)} hours
6. For bands: ALWAYS include subs (from Subs category), microphones, and stage box

## PRICING GUIDELINES
Calculate prices by summing hire rates from the inventory for each category:
- FOH: Sum hire rates for all FOH speakers + subs
- Monitors: Sum hire rates for all monitor wedges
- Console: Hire rate for the mixing console + stage box
- Cables: $150-300 depending on complexity (more mics = more cables)
- Vehicle: $100-150 depending on gear quantity
- Tech time: hours × $${DEFAULT_TECH_RATE}/hr

IMPORTANT: Include microphone costs in "cables" category (mics + cables + DI boxes)

## EXECUTION NOTES
Concise instructions for the sound tech:
- Where to set up FOH position
- Monitor mix assignments (who gets what mix)
- Stage box/snake placement
- Any special routing or timing
- Band changeover notes if applicable
- Key moments (speeches, first dance, etc.)

## SUGGESTED GEAR
- Follow EQUIPMENT SELECTION RULES to determine what gear is needed
- Match items to AVAILABLE INVENTORY (use exact names from the inventory list)
- Include: Speakers (FOH, delays, monitors), Subs if DJ, Console, Microphones, DI boxes, Stage box if band
- Stands and cables are assumed

Return ONLY the JSON object, no other text.`;

  const result = await client.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
  });
  const responseText = result.text || '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      lineItems: {
        foh: parsed.lineItems?.foh ?? 0,
        monitors: {
          count: parsed.lineItems?.monitors?.count ?? 0,
          cost: parsed.lineItems?.monitors?.cost ?? 0
        },
        microphones: {
          count: parsed.lineItems?.microphones?.count ?? 0,
          cost: parsed.lineItems?.microphones?.cost ?? 0
        },
        console: parsed.lineItems?.console ?? 0,
        cables: parsed.lineItems?.cables ?? 0,
        vehicle: parsed.lineItems?.vehicle ?? 0,
        techTime: {
          hours: parsed.lineItems?.techTime?.hours ?? 0,
          rate: parsed.lineItems?.techTime?.rate ?? DEFAULT_TECH_RATE,
          cost: parsed.lineItems?.techTime?.cost ?? 0
        }
      },
      executionNotes: Array.isArray(parsed.executionNotes) ? parsed.executionNotes : [],
      suggestedGear: Array.isArray(parsed.suggestedGear)
        ? parsed.suggestedGear.map((g: { item?: string; quantity?: number; notes?: string }) => ({
            item: g.item || 'Unknown',
            quantity: g.quantity || 1,
            notes: g.notes
          }))
        : []
    };
  }

  throw new Error('Failed to parse AI response');
}

function generateFallbackQuote(
  input: SoundQuoteInput,
  basePrice: number,
  inventory: AudioEquipmentItem[]
): { lineItems: QuoteLineItems; executionNotes: string[]; suggestedGear: SuggestedGearItem[] } {
  // Fallback when AI is unavailable
  const isSmall = input.package === 'small';
  const isMedium = input.package === 'medium';
  const isLarge = input.package === 'large' || input.package === 'extra_large';

  const monitorCount = input.techRiderRequirements?.monitorMixes || (isSmall ? 0 : isMedium ? 2 : 4);

  // Calculate tech time from start/end times
  // Formula: event duration + setup + 30min load + 30min unload + (setup/2) packout
  const setupHours = isSmall ? 0.5 : isMedium ? 1 : isLarge ? 2 : 3;
  const packoutHours = isSmall ? 0.5 : isMedium ? 0.5 : isLarge ? 1 : 1.5;
  const eventHours = calculateEventDuration(input.eventStartTime, input.eventEndTime);
  const techHours = eventHours + setupHours + 1 + packoutHours; // 1 hour for load/unload

  // Helper to find item from inventory by keyword and return name + hire rate
  const findInInventory = (keyword: string): { name: string; rate: number } | null => {
    const found = inventory.find(i =>
      i.name.toLowerCase().includes(keyword.toLowerCase())
    );
    return found ? { name: found.name, rate: found.hire_rate_per_day } : null;
  };

  // Helper to get hire rate for a category by keyword
  const getRate = (keyword: string, fallbackRate: number): number => {
    const item = findInInventory(keyword);
    return item ? item.rate : fallbackRate;
  };

  // Build suggested gear with actual inventory items and calculate costs
  const suggestedGear: SuggestedGearItem[] = [];
  let fohCost = 0;
  let monitorCost = 0;
  let micCost = 0;
  let consoleCost = 0;
  let micCount = 0;

  if (isSmall) {
    // FOH speakers - only add if found in inventory
    const foh = findInInventory('ZLX') || findInInventory('ELX') || findInInventory('Speaker');
    if (foh) {
      suggestedGear.push({ item: foh.name, quantity: 2, notes: 'FOH' });
      fohCost = foh.rate * 2;
    }

    // Console
    const mixer = findInInventory('Flow') || findInInventory('Mixer') || findInInventory('Console');
    if (mixer) {
      consoleCost = mixer.rate;
      suggestedGear.push({ item: mixer.name, quantity: 1, notes: 'Mixer' });
    }

    // Mic if needed
    if (input.needsMic || input.hasSpeeches) {
      const mic = findInInventory('Wireless') || findInInventory('SM58');
      if (mic) {
        micCost = mic.rate;
        micCount = 1;
        suggestedGear.push({ item: mic.name, quantity: 1, notes: 'Speeches' });
      }
    }
  } else if (isMedium) {
    // FOH speakers
    const foh = findInInventory('EKX') || findInInventory('ELX') || findInInventory('Speaker');
    if (foh) {
      suggestedGear.push({ item: foh.name, quantity: 2, notes: 'FOH' });
      fohCost = foh.rate * 2;
    }

    // Monitors
    const monitor = findInInventory('ELX') || findInInventory('Monitor') || findInInventory('Wedge');
    if (monitor) {
      suggestedGear.push({ item: monitor.name, quantity: monitorCount, notes: 'Monitors' });
      monitorCost = monitor.rate * monitorCount;
    }

    // Console
    const consoleItem = findInInventory('X32') || findInInventory('Console') || findInInventory('Mixer');
    if (consoleItem) {
      consoleCost = consoleItem.rate;
      suggestedGear.push({ item: consoleItem.name, quantity: 1, notes: 'Console' });
    }

    // Mics
    const sm58 = findInInventory('SM58') || findInInventory('Vocal');
    micCount = input.hasBand ? 6 : 2;
    if (sm58) {
      suggestedGear.push({ item: sm58.name, quantity: micCount, notes: 'Vocals' });
      micCost = sm58.rate * micCount;
    }

    // DI Box
    const di = findInInventory('DI');
    if (di) {
      suggestedGear.push({ item: di.name, quantity: 4 });
    }
  } else {
    // Large package - FOH speakers
    const foh = findInInventory('EKX') || findInInventory('ETX') || findInInventory('Speaker');
    if (foh) {
      suggestedGear.push({ item: foh.name, quantity: 4, notes: 'FOH' });
      fohCost = foh.rate * 4;
    }

    // Subs
    const subs = findInInventory('Sub') || findInInventory('18');
    if (subs) {
      suggestedGear.push({ item: subs.name, quantity: 2, notes: 'Subs' });
      fohCost += subs.rate * 2;
    }

    // Monitors
    const monitor = findInInventory('ELX') || findInInventory('Monitor') || findInInventory('Wedge');
    if (monitor) {
      suggestedGear.push({ item: monitor.name, quantity: monitorCount, notes: 'Monitors' });
      monitorCost = monitor.rate * monitorCount;
    }

    // Console
    const consoleItem = findInInventory('X32') || findInInventory('Console');
    if (consoleItem) {
      consoleCost = consoleItem.rate;
      suggestedGear.push({ item: consoleItem.name, quantity: 1, notes: 'Console' });
    }

    // Stage box
    const stageBox = findInInventory('S16') || findInInventory('Stage Box') || findInInventory('Rio');
    if (stageBox) {
      suggestedGear.push({ item: stageBox.name, quantity: 1, notes: 'Stage Box' });
      consoleCost += stageBox.rate;
    }

    // Mics - look up each type from database
    const sm58 = findInInventory('SM58') || findInInventory('Vocal');
    const sm57 = findInInventory('SM57') || findInInventory('Instrument');
    const kickMic = findInInventory('Beta52') || findInInventory('D112') || findInInventory('Kick');

    if (sm58) {
      suggestedGear.push({ item: sm58.name, quantity: 6, notes: 'Vocals' });
      micCost += sm58.rate * 6;
      micCount += 6;
    }
    if (sm57) {
      suggestedGear.push({ item: sm57.name, quantity: 4, notes: 'Instruments' });
      micCost += sm57.rate * 4;
      micCount += 4;
    }
    if (kickMic) {
      suggestedGear.push({ item: kickMic.name, quantity: 1, notes: 'Kick' });
      micCost += kickMic.rate;
      micCount += 1;
    }

    // DI Box
    const di = findInInventory('DI');
    if (di) {
      suggestedGear.push({ item: di.name, quantity: 6 });
    }
  }

  const lineItems: QuoteLineItems = {
    foh: fohCost,
    monitors: {
      count: monitorCount,
      cost: monitorCost
    },
    microphones: {
      count: micCount,
      cost: micCost
    },
    console: consoleCost,
    cables: isSmall ? 100 : isMedium ? 150 : 300,
    vehicle: isSmall ? 50 : 100,
    techTime: {
      hours: techHours,
      rate: DEFAULT_TECH_RATE,
      cost: techHours * DEFAULT_TECH_RATE
    }
  };

  const executionNotes: string[] = [];
  executionNotes.push(`Set up FOH ${isSmall ? 'near front' : 'at back of room with clear sightline'}`);
  if (monitorCount > 0) {
    executionNotes.push(`${monitorCount} monitor mix${monitorCount > 1 ? 'es' : ''} required`);
  }
  if (input.hasSpeeches) {
    executionNotes.push('Wireless mic ready for speeches');
  }
  if (input.hasBand) {
    executionNotes.push('Stage setup for live band');
  }
  if (input.hasDJ) {
    executionNotes.push('DJ input channels on console');
  }
  executionNotes.push(`Event: ${formatTime(input.eventStartTime)} - ${formatTime(input.eventEndTime)}`);

  return { lineItems, executionNotes, suggestedGear };
}
