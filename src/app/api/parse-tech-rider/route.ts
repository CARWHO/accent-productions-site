import { NextRequest, NextResponse } from 'next/server';
import { parseTechRider } from '@/lib/parse-tech-rider';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[TechRider] Starting tech rider parse request');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      console.log('[TechRider] No file provided or empty file');
      return NextResponse.json(null);
    }

    console.log(`[TechRider] Received file: ${file.name} (${(file.size / 1024).toFixed(2)} KB, type: ${file.type})`);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the tech rider
    console.log('[TechRider] Starting Gemini parsing...');
    const result = await parseTechRider(buffer, file.name);

    const duration = Date.now() - startTime;

    if (result) {
      console.log(`[TechRider] Parsing successful in ${duration}ms`);
      console.log('[TechRider] Extracted data:', {
        hasBand: result.hasBand,
        hasDJ: result.hasDJ,
        bandSize: result.bandSize,
        inputChannels: result.inputChannels,
        monitorMixes: result.monitorMixes,
        specificGearCount: result.specificGear?.length || 0,
        hasBackline: result.hasBackline,
        drumMicsNeeded: result.drumMicsNeeded,
        iemNeeded: result.iemNeeded,
      });
    } else {
      console.log(`[TechRider] Parsing returned null after ${duration}ms`);
    }

    // Return parsed result (or null if parsing failed)
    return NextResponse.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TechRider] Error after ${duration}ms:`, error);
    // Return null on error - graceful degradation
    return NextResponse.json(null);
  }
}
