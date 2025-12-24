import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export interface EquipmentItem {
  name: string;
  quantity: number;
  dailyRate: number;
  notes?: string | null;
}

export interface QuoteInput {
  equipment: EquipmentItem[];
  otherEquipment?: string;
  startDate: string;
  endDate: string;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  additionalNotes?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export interface QuoteLineItem {
  description: string;
  amount: number;
}

export interface QuoteOutput {
  quoteNumber: string;
  title: string;
  description: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  gst: number;
  total: number;
  rentalDays: number;
}

function calculateRentalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
  return Math.max(1, diffDays);
}

function generateQuoteNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${year}-${random}`;
}

export async function generateQuote(input: QuoteInput): Promise<QuoteOutput> {
  const rentalDays = calculateRentalDays(input.startDate, input.endDate);
  const quoteNumber = generateQuoteNumber();

  // Calculate line items
  const lineItems: QuoteLineItem[] = [];
  let equipmentSubtotal = 0;

  // Equipment costs with day 2+ at 50%
  for (const item of input.equipment) {
    const day1Cost = item.quantity * item.dailyRate;
    const additionalDaysCost = rentalDays > 1
      ? (rentalDays - 1) * (item.quantity * item.dailyRate * 0.5)
      : 0;
    const totalItemCost = day1Cost + additionalDaysCost;

    let description = `${item.quantity} x ${item.name}`;
    if (item.dailyRate) {
      description += ` @ $${item.dailyRate}/day`;
    }
    if (rentalDays > 1) {
      description += ` (Day 1: $${day1Cost}, Days 2-${rentalDays} @ 50%)`;
    }

    lineItems.push({
      description,
      amount: totalItemCost
    });
    equipmentSubtotal += totalItemCost;
  }

  // Delivery fee if applicable
  if (input.deliveryMethod === 'delivery') {
    const deliveryFee = 150; // Base delivery fee
    lineItems.push({
      description: 'Delivery & Collection',
      amount: deliveryFee
    });
    equipmentSubtotal += deliveryFee;
  }

  const subtotal = equipmentSubtotal;
  const gst = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + gst;

  // Generate AI description if Gemini is available
  let description = '';
  let title = 'Backline Hire';

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const equipmentSummary = input.equipment
        .map(e => `${e.quantity}x ${e.name}${e.notes ? ` (${e.notes})` : ''}`)
        .join(', ');

      const prompt = `You are writing a professional quote description for an audio equipment hire company called Accent Entertainment in Wellington, New Zealand.

The customer is requesting the following equipment for ${rentalDays} day${rentalDays > 1 ? 's' : ''}:
${equipmentSummary}
${input.otherEquipment ? `\nAdditional requests: ${input.otherEquipment}` : ''}
${input.additionalNotes ? `\nNotes: ${input.additionalNotes}` : ''}

Delivery method: ${input.deliveryMethod === 'delivery' ? 'Delivery to ' + (input.deliveryAddress || 'customer location') : 'Customer pickup'}
Event dates: ${input.startDate} to ${input.endDate}

Generate two things:
1. A short title (5-10 words) for this quote like "Backline Hire @ [Location/Event]" or "Sound System Hire for [Event Type]"
2. A brief professional description (2-4 sentences) summarizing the equipment package and what it's suitable for.

Format your response as:
TITLE: [your title]
DESCRIPTION: [your description]

Keep it concise and professional. Do not include pricing - that's handled separately.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Parse the response
      const titleMatch = response.match(/TITLE:\s*(.+?)(?:\n|$)/i);
      const descMatch = response.match(/DESCRIPTION:\s*([\s\S]+?)$/i);

      if (titleMatch) title = titleMatch[1].trim();
      if (descMatch) description = descMatch[1].trim();
    } catch (error) {
      console.error('Gemini API error:', error);
      // Fall back to basic description
      description = generateBasicDescription(input, rentalDays);
    }
  } else {
    description = generateBasicDescription(input, rentalDays);
  }

  return {
    quoteNumber,
    title,
    description,
    lineItems,
    subtotal,
    gst,
    total,
    rentalDays
  };
}

function generateBasicDescription(input: QuoteInput, rentalDays: number): string {
  const itemCount = input.equipment.reduce((sum, e) => sum + e.quantity, 0);
  const categories = [...new Set(input.equipment.map(e => e.name.split(' ')[0]))];

  let desc = `${itemCount} item${itemCount > 1 ? 's' : ''} for ${rentalDays} day${rentalDays > 1 ? 's' : ''} hire.`;

  if (input.deliveryMethod === 'delivery' && input.deliveryAddress) {
    desc += ` Delivery to ${input.deliveryAddress}.`;
  } else {
    desc += ' Customer pickup.';
  }

  return desc;
}
