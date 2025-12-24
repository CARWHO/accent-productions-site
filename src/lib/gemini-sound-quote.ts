import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

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
}

export interface SoundQuoteOutput {
  quoteNumber: string;
  title: string;
  subtitle: string;
  equipmentDescription: string;
  subtotal: number;
  gst: number;
  total: number;
}

// Package base prices
const packagePrices: Record<PackageType, number> = {
  small: 500,
  medium: 1200,
  large: 3000,
  extra_large: 5000 // Base for custom quote
};

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

export async function generateSoundQuote(input: SoundQuoteInput): Promise<SoundQuoteOutput> {
  const quoteNumber = generateQuoteNumber();
  const basePrice = packagePrices[input.package];

  // Calculate estimated price with add-ons
  let estimatedPrice = basePrice;

  // Add-ons based on requirements
  if (input.hasBand) estimatedPrice += 300;
  if (input.hasDJ) estimatedPrice += 200;
  if (input.hasSpeeches) estimatedPrice += 100;
  if (input.needsGenerator) estimatedPrice += 500;
  if (input.indoorOutdoor === 'Outdoor') estimatedPrice += 200;

  // Generate title and subtitle
  const locationPart = input.location || 'TBC';
  const datePart = input.eventDate
    ? new Date(input.eventDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'TBC';

  const title = `Sound System Hire @ ${locationPart} (${datePart})`;
  const subtitle = input.eventName || `${formatEventType(input.eventType)}`;

  // Generate equipment description with AI or fallback
  let equipmentDescription = '';

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are writing a professional equipment quote description for Accent Entertainment, an audio production company in Wellington, New Zealand.

Event Details:
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

Content Requirements:
${input.playbackFromDevice ? '- Playback from device (iPhone/Laptop)' : ''}
${input.hasLiveMusic ? '- Live music' : ''}
${input.hasBand ? '- Live band(s)' : ''}
${input.hasDJ ? '- DJ setup required' : ''}
${input.hasSpeeches ? '- Speeches/presentations' : ''}
${input.needsMic ? '- Microphone required' : ''}
${input.needsWirelessMic ? '- Wireless microphones' : ''}
${input.additionalInfo ? `- Additional: ${input.additionalInfo}` : ''}
${input.details ? `- Other details: ${input.details}` : ''}

Based on this ${input.package} package event, write an equipment list quote similar to this style:
"2 x EV12P (FOH)+2 x EV10P (Monitors)
2 x Speakers stands
1 x 6 ch Alto Mixer
5 x IEC+2 x AC extension Cables+1 x AC Multi Box
6 x XLR+1 x TRS-XLR
1 x Aux Cable
1 x AV DI
3 x WL Shure Mics
2 x spare wired Mics
3 x Mic stands (large mic clips)
Equipment $500
Tech $300+GST"

Requirements:
1. List appropriate equipment for the package size and event type
2. Use realistic audio equipment brands (EV, Shure, Behringer, Yamaha, etc.)
3. Include cables, stands, and accessories as needed
4. End with a simple price breakdown (Equipment + Tech if applicable)
5. For small events: simple PA, mixer, mics
6. For medium events: more speakers, better mixer, monitors, more mics
7. For large events: concert-grade system, subs, digital console, stage boxes, IEMs
8. Include "Delivered, setup, operated, packed out & collected" for medium/large
9. Keep it concise - just the equipment list, no introduction or closing

Write ONLY the equipment description, nothing else.`;

      const result = await model.generateContent(prompt);
      equipmentDescription = result.response.text().trim();
    } catch (error) {
      console.error('Gemini API error:', error);
      equipmentDescription = generateBasicDescription(input, estimatedPrice);
    }
  } else {
    equipmentDescription = generateBasicDescription(input, estimatedPrice);
  }

  const subtotal = estimatedPrice;
  const gst = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + gst;

  return {
    quoteNumber,
    title,
    subtitle,
    equipmentDescription,
    subtotal,
    gst,
    total
  };
}

function generateBasicDescription(input: SoundQuoteInput, price: number): string {
  const lines: string[] = [];

  if (input.package === 'small') {
    lines.push('2 x Powered Speakers (FOH)');
    lines.push('2 x Speaker Stands');
    lines.push('1 x Compact Mixer');
    lines.push('Audio cables & accessories');
    if (input.needsMic || input.hasSpeeches) {
      lines.push('1 x Wireless Microphone');
    }
    if (input.playbackFromDevice) {
      lines.push('1 x Aux/Bluetooth input');
    }
    lines.push(`Equipment & Setup $${price}+GST`);
  } else if (input.package === 'medium') {
    lines.push('4 x Powered Speakers (FOH + Monitors)');
    lines.push('2 x Subwoofers');
    lines.push('Speaker stands & rigging');
    lines.push('Digital Mixer');
    lines.push('Audio cables, DIs & accessories');
    if (input.hasBand || input.hasLiveMusic) {
      lines.push('Stage monitor setup');
      lines.push('Microphone package for live music');
    }
    if (input.hasDJ) {
      lines.push('DJ input channels');
    }
    if (input.hasSpeeches) {
      lines.push('2 x Wireless Microphones');
    }
    lines.push('Delivered, setup, operated, packed out & collected');
    lines.push(`Equipment $${Math.round(price * 0.6)}+GST`);
    lines.push(`Tech $${Math.round(price * 0.4)}+GST`);
  } else {
    lines.push('Concert Sound System');
    lines.push('8 x Main Speakers (Flown/Stacked)');
    lines.push('4-8 x Subwoofers');
    lines.push('Monitor wedges & sidefills');
    lines.push('Digital Console + Stage Boxes');
    lines.push('Full microphone package');
    lines.push('Wireless mics & IEMs');
    lines.push('All cabling, rigging & accessories');
    lines.push('Delivered, setup, operated, packed out & collected');
    lines.push('Sound tech team for duration of event');
    lines.push(`Total $${price}+GST`);
  }

  return lines.join('\n');
}
