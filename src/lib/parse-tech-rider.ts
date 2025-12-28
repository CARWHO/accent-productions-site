import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';

export interface TechRiderRequirements {
  inputChannels: number | null;
  monitorMixes: number | null;
  specificGear: string[];
  stageBoxNeeded: boolean;
  iemNeeded: boolean;
  drumMicsNeeded: boolean;
  powerRequirements: string | null;
  stageLayout: string | null;
  additionalNotes: string | null;
  rawText: string;
}

const TECH_RIDER_PROMPT = `Analyze this tech rider document and extract the technical audio requirements.

Return a JSON object with these fields:
{
  "inputChannels": <number or null> - Total input channels needed (count all mic/DI inputs),
  "monitorMixes": <number or null> - Number of separate monitor mixes/aux sends needed,
  "specificGear": [<strings>] - Any specifically requested gear (console brands like "Yamaha CL5", mic models like "SM58", "D112", "SM57", etc),
  "stageBoxNeeded": <boolean> - Whether a stage box/snake/digital snake is mentioned or implied by channel count,
  "iemNeeded": <boolean> - Whether in-ear monitors (IEMs) are requested,
  "drumMicsNeeded": <boolean> - Whether drum microphones are needed (look for drum kit in input list),
  "powerRequirements": <string or null> - Power requirements (e.g., "4 x 240v outlets on stage", "20A circuit required"),
  "stageLayout": <string or null> - Description of stage layout from any stage plot diagram or text (e.g., "Drums center-back, keys stage left, 2 vocalists downstage, guitar stage right"),
  "additionalNotes": <string or null> - Any other important technical notes (special routing, timing, backline provided, etc)
}

Guidelines:
- If a drum kit is listed, set drumMicsNeeded to true
- If more than 16 channels are needed, assume stageBoxNeeded is true
- Count each instrument/vocal as one channel unless a stereo source is specified (stereo = 2 channels)
- Common IEM indicators: "in-ear", "IEM", "wireless monitor", "personal monitor"
- For stage plots (visual diagrams): describe instrument positions relative to stage (upstage/downstage, stage left/right)
- If the document is mostly visual (hand-drawn stage plot), still extract what you can see
- For simple requirements (just bluetooth/playback), most fields will be null - that's fine

Only return the JSON object, no other text.`;

/**
 * Parse a tech rider PDF using Gemini vision
 */
export async function parseTechRiderPDF(
  pdfBuffer: Buffer
): Promise<TechRiderRequirements | null> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  if (!process.env.GEMINI_API_KEY) {
    console.warn('Gemini API key not configured');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const base64PDF = pdfBuffer.toString('base64');

    const result = await model.generateContent([
      TECH_RIDER_PROMPT,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64PDF,
        },
      },
    ]);

    return parseGeminiResponse(result.response.text());
  } catch (error) {
    console.error('Error parsing tech rider PDF:', error);
    return null;
  }
}

/**
 * Parse a tech rider DOCX file
 * Extracts text with mammoth, then uses Gemini to analyze
 */
export async function parseTechRiderDOCX(
  docxBuffer: Buffer
): Promise<TechRiderRequirements | null> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  if (!process.env.GEMINI_API_KEY) {
    console.warn('Gemini API key not configured');
    return null;
  }

  try {
    // Extract text from DOCX using mammoth
    const { value: extractedText } = await mammoth.extractRawText({ buffer: docxBuffer });

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn('No text extracted from DOCX');
      return null;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      TECH_RIDER_PROMPT,
      `\n\nDocument content:\n${extractedText}`,
    ]);

    return parseGeminiResponse(result.response.text());
  } catch (error) {
    console.error('Error parsing tech rider DOCX:', error);
    return null;
  }
}

/**
 * Parse a tech rider file (auto-detects PDF vs DOCX by filename)
 */
export async function parseTechRider(
  buffer: Buffer,
  filename: string
): Promise<TechRiderRequirements | null> {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith('.pdf')) {
    return parseTechRiderPDF(buffer);
  } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    return parseTechRiderDOCX(buffer);
  } else {
    console.warn(`Unsupported tech rider format: ${filename}`);
    return null;
  }
}

/**
 * Parse Gemini response into TechRiderRequirements
 */
function parseGeminiResponse(responseText: string): TechRiderRequirements | null {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        inputChannels: parsed.inputChannels ?? null,
        monitorMixes: parsed.monitorMixes ?? null,
        specificGear: Array.isArray(parsed.specificGear) ? parsed.specificGear : [],
        stageBoxNeeded: Boolean(parsed.stageBoxNeeded),
        iemNeeded: Boolean(parsed.iemNeeded),
        drumMicsNeeded: Boolean(parsed.drumMicsNeeded),
        powerRequirements: parsed.powerRequirements ?? null,
        stageLayout: parsed.stageLayout ?? null,
        additionalNotes: parsed.additionalNotes ?? null,
        rawText: responseText,
      };
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }
  }

  console.warn('Could not parse tech rider response:', responseText);
  return null;
}
