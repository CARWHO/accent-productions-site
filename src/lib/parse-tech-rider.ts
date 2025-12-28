import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000; // 5 seconds

// Initialize Google GenAI with Vertex AI using Service Account
function getGenAIClient(): GoogleGenAI | null {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.warn('[TechRider] GenAI not configured - missing GOOGLE_SERVICE_ACCOUNT_JSON');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    return new GoogleGenAI({
      vertexai: true,
      project: serviceAccount.project_id,
      location,
      googleAuthOptions: {
        credentials: serviceAccount,
      },
    });
  } catch (error) {
    console.error('[TechRider] Failed to parse service account JSON:', error);
    return null;
  }
}

/**
 * Helper to call Gemini with retry logic for rate limits
 */
async function callGeminiWithRetry(
  client: GoogleGenAI,
  model: string,
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'],
  retries = MAX_RETRIES
): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.models.generateContent({
        model,
        contents,
      });
      return response.text || '';
    } catch (error: unknown) {
      const isRateLimit = error instanceof Error &&
        (error.message.includes('429') || error.message.includes('Too Many Requests') || error.message.includes('quota'));

      if (isRateLimit && attempt < retries) {
        console.log(`[TechRider] Rate limited, retrying in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        throw error;
      }
    }
  }
  return null;
}

export interface TechRiderRequirements {
  // Technical requirements
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

  // Form-mappable fields (for auto-fill)
  hasBand: boolean;
  hasDJ: boolean;
  bandSize: 'small' | 'medium' | 'large' | null;
  hasBackline: boolean;

  // Event/artist info extracted from rider
  artistName: string | null;
  eventName: string | null;
  eventType: 'wedding' | 'corporate' | 'festival' | 'private_party' | 'other' | null;
  organization: string | null;
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
  "additionalNotes": <string or null> - Any other important technical notes (special routing, timing, backline provided, etc),
  "hasBand": <boolean> - Whether this is for a live band (instruments, vocals, drums, etc),
  "hasDJ": <boolean> - Whether a DJ setup is mentioned (CDJs, turntables, DJ mixer, etc),
  "bandSize": <"small" | "medium" | "large" | null> - Estimated band size: small (1-3 musicians), medium (4-6 musicians), large (7+ musicians or full orchestra/big band),
  "hasBackline": <boolean> - Whether backline equipment is mentioned (guitar amps, bass amps, keyboard stands, drum kit provided, etc),
  "artistName": <string or null> - The band/artist/performer name - look in headers, titles, logos, watermarks, or INFER from filename if visible,
  "eventName": <string or null> - The event name - extract or INFER from context (e.g., venue name + date, or artist name + "Performance"),
  "eventType": <"wedding" | "corporate" | "festival" | "private_party" | "other" | null> - Type of event - INFER from context clues,
  "organization": <string or null> - The organization, company, venue, or production company name - look for logos, letterheads, contact info
}

Guidelines:
- If a drum kit is listed, set drumMicsNeeded to true and hasBand to true
- If more than 16 channels are needed, assume stageBoxNeeded is true
- Count each instrument/vocal as one channel unless a stereo source is specified (stereo = 2 channels)
- Common IEM indicators: "in-ear", "IEM", "wireless monitor", "personal monitor"
- For stage plots (visual diagrams): describe instrument positions relative to stage (upstage/downstage, stage left/right)
- If the document is mostly visual (hand-drawn stage plot), still extract what you can see
- For simple requirements (just bluetooth/playback), most fields will be null and hasBand/hasDJ should be false
- If there are any live instruments or vocals, set hasBand to true
- DJ indicators: "DJ", "CDJ", "turntable", "Serato", "Traktor", "DJ booth"
- Backline indicators: "backline", "amp", "amplifier", "combo", "cabinet", "wedge", "drum kit provided"

IMPORTANT - Event/Artist Info Extraction:
- artistName: Look for band names in headers, titles, logos, or even infer from the filename (e.g., "HootnAnnies-Stage-Plot.pdf" → "HootnAnnies" or "Hoot n' Annies")
- eventName: If not explicitly stated, construct one like "[Artist] Performance" or "[Venue] Event"
- eventType: Infer from context - brass bands/jazz = "private_party" or "corporate", large input lists = "festival", etc.
- organization: Look for production company names, venue names, or contact info in headers/footers

Only return the JSON object, no other text.`;

/**
 * Parse a tech rider PDF using Gemini vision
 */
export async function parseTechRiderPDF(
  pdfBuffer: Buffer,
  filename?: string
): Promise<TechRiderRequirements | null> {
  const client = getGenAIClient();

  if (!client) {
    console.warn('[TechRider] GenAI not configured');
    return null;
  }

  try {
    console.log(`[TechRider] Parsing PDF (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
    const startTime = Date.now();

    const base64PDF = pdfBuffer.toString('base64');

    // Include filename in prompt for artist name inference
    const promptWithFilename = filename
      ? `${TECH_RIDER_PROMPT}\n\nFilename: "${filename}" - Use this to help infer the artist/band name if not clearly visible in the document.`
      : TECH_RIDER_PROMPT;

    console.log('[TechRider] Sending PDF to Gemini...');
    const responseText = await callGeminiWithRetry(
      client,
      'gemini-2.5-flash',
      [
        { text: promptWithFilename },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64PDF,
          },
        },
      ]
    );

    if (!responseText) {
      console.warn('[TechRider] Gemini call returned null after retries');
      return null;
    }

    const duration = Date.now() - startTime;
    console.log(`[TechRider] Gemini response received in ${duration}ms`);
    console.log(`[TechRider] Response length: ${responseText.length} chars`);

    return parseGeminiResponse(responseText);
  } catch (error) {
    console.error('[TechRider] Error parsing PDF (after retries):', error);
    return null;
  }
}

/**
 * Parse a tech rider DOCX file
 * Extracts text with mammoth, then uses Gemini to analyze
 */
export async function parseTechRiderDOCX(
  docxBuffer: Buffer,
  filename?: string
): Promise<TechRiderRequirements | null> {
  const client = getGenAIClient();

  if (!client) {
    console.warn('[TechRider] GenAI not configured');
    return null;
  }

  try {
    console.log(`[TechRider] Parsing DOCX (${(docxBuffer.length / 1024).toFixed(2)} KB)`);
    const startTime = Date.now();

    // Extract text from DOCX using mammoth
    console.log('[TechRider] Extracting text with mammoth...');
    const { value: extractedText } = await mammoth.extractRawText({ buffer: docxBuffer });

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn('[TechRider] No text extracted from DOCX');
      return null;
    }

    console.log(`[TechRider] Extracted ${extractedText.length} chars from DOCX`);

    // Include filename in prompt for artist name inference
    const filenameHint = filename
      ? `\n\nFilename: "${filename}" - Use this to help infer the artist/band name if not clearly visible in the document.`
      : '';

    console.log('[TechRider] Sending DOCX text to Gemini...');
    const responseText = await callGeminiWithRetry(
      client,
      'gemini-2.5-flash',
      [
        { text: TECH_RIDER_PROMPT + filenameHint + `\n\nDocument content:\n${extractedText}` },
      ]
    );

    if (!responseText) {
      console.warn('[TechRider] Gemini call returned null after retries');
      return null;
    }

    const duration = Date.now() - startTime;
    console.log(`[TechRider] Gemini response received in ${duration}ms`);
    console.log(`[TechRider] Response length: ${responseText.length} chars`);

    return parseGeminiResponse(responseText);
  } catch (error) {
    console.error('[TechRider] Error parsing DOCX (after retries):', error);
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
    console.log(`[TechRider] Detected PDF format: ${filename}`);
    return parseTechRiderPDF(buffer, filename);
  } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    console.log(`[TechRider] Detected DOCX format: ${filename}`);
    return parseTechRiderDOCX(buffer, filename);
  } else {
    console.warn(`[TechRider] Unsupported format: ${filename}`);
    return null;
  }
}

/**
 * Parse Gemini response into TechRiderRequirements
 */
function parseGeminiResponse(responseText: string): TechRiderRequirements | null {
  console.log('[TechRider] Parsing Gemini response...');
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[TechRider] JSON parsed successfully');

      // Validate bandSize enum
      const validBandSizes = ['small', 'medium', 'large'];
      const bandSize = validBandSizes.includes(parsed.bandSize) ? parsed.bandSize : null;

      // Validate eventType enum
      const validEventTypes = ['wedding', 'corporate', 'festival', 'private_party', 'other'];
      const eventType = validEventTypes.includes(parsed.eventType) ? parsed.eventType : null;

      const result = {
        // Technical requirements
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

        // Form-mappable fields
        hasBand: Boolean(parsed.hasBand),
        hasDJ: Boolean(parsed.hasDJ),
        bandSize: bandSize,
        hasBackline: Boolean(parsed.hasBackline),

        // Event/artist info
        artistName: parsed.artistName ?? null,
        eventName: parsed.eventName ?? null,
        eventType: eventType,
        organization: parsed.organization ?? null,
      };

      console.log('[TechRider] Parsed requirements:', {
        inputChannels: result.inputChannels,
        monitorMixes: result.monitorMixes,
        specificGearCount: result.specificGear.length,
        hasBand: result.hasBand,
        hasDJ: result.hasDJ,
        bandSize: result.bandSize,
        hasBackline: result.hasBackline,
        drumMicsNeeded: result.drumMicsNeeded,
        iemNeeded: result.iemNeeded,
        artistName: result.artistName,
        eventName: result.eventName,
        eventType: result.eventType,
        organization: result.organization,
      });

      return result;
    } catch (parseError) {
      console.error('[TechRider] JSON parse error:', parseError);
    }
  } else {
    console.warn('[TechRider] No JSON object found in response');
  }

  console.warn('[TechRider] Could not parse tech rider response, first 200 chars:', responseText.substring(0, 200));
  return null;
}
