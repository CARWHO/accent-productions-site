import { GoogleGenerativeAI } from '@google/generative-ai';
import { TechRiderRequirements } from './parse-tech-rider';
import { getSupabaseAdmin } from './supabase';

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

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
  eventTime?: string;
  setupTime?: string;
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

// Default hourly rate for tech time
const DEFAULT_TECH_RATE = 60;

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

// Fetch available audio equipment from database
async function fetchAudioEquipment(): Promise<AudioEquipmentItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn('No Supabase connection, skipping inventory fetch');
    return [];
  }

  const { data, error } = await supabase
    .from('audio_equipment')
    .select('id, category, name, notes, hire_rate_per_day, stock_quantity')
    .eq('available', true)
    .order('category')
    .order('name');

  if (error) {
    console.error('Error fetching audio equipment:', error);
    return [];
  }

  return data || [];
}

// Validate suggested gear against inventory
function validateGearAgainstInventory(
  suggestedGear: SuggestedGearItem[],
  inventory: AudioEquipmentItem[]
): { validatedGear: SuggestedGearItem[]; unavailableGear: string[] } {
  const unavailableGear: string[] = [];

  const validatedGear = suggestedGear.map(gear => {
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

  if (genAI) {
    try {
      const result = await generateWithAI(input, basePrice, inventory);
      lineItems = result.lineItems;
      executionNotes = result.executionNotes;
      suggestedGear = result.suggestedGear;
    } catch (error) {
      console.error('Gemini API error:', error);
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
  inventory: AudioEquipmentItem[]
): Promise<{ lineItems: QuoteLineItems; executionNotes: string[]; suggestedGear: SuggestedGearItem[] }> {
  const model = genAI!.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const inventorySection = formatInventoryForPrompt(inventory);

  const prompt = `You are creating a quote for Accent Entertainment, an audio production company in Wellington, New Zealand.

${inventorySection}

EVENT DETAILS:
- Type: ${formatEventType(input.eventType)}
- Name: ${input.eventName || 'Not specified'}
- Package Size: ${input.package} (${formatPackageSize(input.package)})
- Date: ${input.eventDate || 'TBC'}
- Time: ${input.eventTime || 'TBC'}
- Setup/Packout: ${input.setupTime || 'TBC'}
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
    "foh": <number - FOH speakers cost>,
    "monitors": { "count": <number>, "cost": <number> },
    "console": <number - mixing console cost>,
    "cables": <number - cables and accessories cost>,
    "vehicle": <number - delivery/pickup cost, usually 50-150>,
    "techTime": { "hours": <number>, "rate": 60, "cost": <number = hours * rate> }
  },
  "executionNotes": [
    "<bullet point 1 - specific setup instruction>",
    "<bullet point 2 - monitor mix assignments>",
    "<bullet point 3 - FOH position>",
    "<etc - 5-8 concise execution notes>"
  ],
  "suggestedGear": [
    { "item": "EV ELX200-15P", "quantity": 2, "notes": "FOH L/R" },
    { "item": "SM58", "quantity": 4, "notes": "Vocals" },
    { "item": "etc", "quantity": 1 }
  ]
}

PRICING GUIDELINES:
- Small package ($500 total): FOH ~$200, monitors ~$0-100, console ~$100, cables ~$100, vehicle ~$50, tech ~$50-100
- Medium package ($1200 total): FOH ~$400, monitors ~$200-300, console ~$200, cables ~$150, vehicle ~$100, tech ~$200-300
- Large package ($3000 total): FOH ~$800, monitors ~$500-600, console ~$400, cables ~$300, vehicle ~$150, tech ~$600-800

EXECUTION NOTES should be concise instructions for the sound tech:
- Where to set up FOH position
- Monitor mix assignments (who gets what mix)
- Stage box/snake placement
- Any special routing or timing
- Band changeover notes if applicable
- Key moments (speeches, first dance, etc.)

SUGGESTED GEAR - IMPORTANT:
- ONLY suggest items that exist in the AVAILABLE INVENTORY list above
- Use the EXACT names from the inventory (e.g., "EV ELX200-15P" not just "ELX200")
- If inventory is not available, suggest standard professional audio gear
- Include: Speakers (FOH and monitors), Console/mixer, Microphones, DI boxes, Stage box if needed
- Stands and cables are assumed

Return ONLY the JSON object, no other text.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
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
  const techHours = isSmall ? 2 : isMedium ? 6 : 10;

  const lineItems: QuoteLineItems = {
    foh: isSmall ? 200 : isMedium ? 400 : 800,
    monitors: {
      count: monitorCount,
      cost: monitorCount * (isSmall ? 50 : 100)
    },
    console: isSmall ? 100 : isMedium ? 200 : 400,
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
  executionNotes.push(`Setup: ${input.setupTime || 'TBC'}`);

  // Helper to find item from inventory by keyword
  const findInInventory = (keyword: string): string | null => {
    const found = inventory.find(i =>
      i.name.toLowerCase().includes(keyword.toLowerCase())
    );
    return found ? found.name : null;
  };

  const suggestedGear: SuggestedGearItem[] = [];
  if (isSmall) {
    const foh = findInInventory('ZLX') || findInInventory('ELX200-12P') || 'EV ZLX-12P';
    suggestedGear.push({ item: foh, quantity: 2, notes: 'FOH' });
    const mixer = findInInventory('Compact Mixer') || findInInventory('Mixer') || 'Alto ZMX862';
    suggestedGear.push({ item: mixer, quantity: 1, notes: 'Mixer' });
    if (input.needsMic || input.hasSpeeches) {
      suggestedGear.push({ item: 'Wireless Mic', quantity: 1, notes: 'Speeches' });
    }
  } else if (isMedium) {
    const foh = findInInventory('ELX200-15P') || findInInventory('EKX-15P') || 'EV ELX200-15P';
    suggestedGear.push({ item: foh, quantity: 2, notes: 'FOH' });
    const monitor = findInInventory('ELX200-12P') || findInInventory('Monitor') || 'EV ELX200-12P';
    suggestedGear.push({ item: monitor, quantity: monitorCount, notes: 'Monitors' });
    const console = findInInventory('TF1') || findInInventory('X32') || 'Yamaha TF1';
    suggestedGear.push({ item: console, quantity: 1, notes: 'Console' });
    suggestedGear.push({ item: 'SM58', quantity: 4, notes: 'Vocals' });
    suggestedGear.push({ item: 'DI Box', quantity: 4 });
  } else {
    const foh = findInInventory('ETX-15P') || findInInventory('EKX-15P') || 'EV ETX-15P';
    suggestedGear.push({ item: foh, quantity: 4, notes: 'FOH' });
    const subs = findInInventory('ELX200-18SP') || findInInventory('Sub') || 'EV ELX200-18SP';
    suggestedGear.push({ item: subs, quantity: 2, notes: 'Subs' });
    const monitor = findInInventory('ELX200-12P') || 'EV ELX200-12P';
    suggestedGear.push({ item: monitor, quantity: monitorCount, notes: 'Monitors' });
    const console = findInInventory('CL1') || findInInventory('X32') || 'Yamaha CL1';
    suggestedGear.push({ item: console, quantity: 1, notes: 'Console' });
    const stageBox = findInInventory('Rio') || findInInventory('S16') || findInInventory('Stage Box');
    if (stageBox) {
      suggestedGear.push({ item: stageBox, quantity: 1, notes: 'Stage Box' });
    } else {
      suggestedGear.push({ item: 'Yamaha Rio1608-D', quantity: 1, notes: 'Stage Box' });
    }
    suggestedGear.push({ item: 'SM58', quantity: 6, notes: 'Vocals' });
    suggestedGear.push({ item: 'SM57', quantity: 4, notes: 'Instruments' });
    suggestedGear.push({ item: 'Beta 52A', quantity: 1, notes: 'Kick' });
    suggestedGear.push({ item: 'DI Box', quantity: 6 });
  }

  return { lineItems, executionNotes, suggestedGear };
}
