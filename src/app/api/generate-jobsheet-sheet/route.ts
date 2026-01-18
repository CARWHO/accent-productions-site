import { NextResponse } from 'next/server';
import {
  createJobSheet,
  type JobSheetEventData,
  type JobSheetEquipment,
  type JobSheetCrew,
} from '@/lib/google-sheets';
import type { FolderType } from '@/lib/google-drive';

const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

/**
 * Generate a jobsheet Google Sheet
 *
 * NEW FORMAT (2025):
 * - Event Data tab: Key-value pairs with event metadata + timing details
 * - Equipment tab: Gear names from Master Sheet with quantities
 * - Crew tab: Roles, names, rates (pay auto-calculated)
 *
 * Expected body format:
 * {
 *   quoteNumber: string,
 *   eventName?: string,
 *   eventDate?: string,
 *   eventTime?: string,
 *   location?: string,
 *   clientName: string,
 *   clientEmail?: string,
 *   clientPhone?: string,
 *   roomAvailableFrom?: string,  // When venue opens for setup
 *   loadInTime?: string,         // When crew arrives (call time)
 *   soundCheckTime?: string,
 *   doorsTime?: string,
 *   setTime?: string,
 *   finishTime?: string,
 *   packDownTime?: string,       // When teardown finishes (pack-out time)
 *   suggestedGear?: Array<{ item: string, quantity: number, notes?: string }>,
 *   executionNotes?: string[],
 *   equipment?: Array<{ gearName: string, quantity: number, notes?: string }>,
 *   crew?: Array<{ role: string, name?: string, phone?: string, rate?: number, hours?: number }>,
 *   folderType?: 'fullsystem' | 'backline' | 'soundtech'
 * }
 */
export async function POST(request: Request) {
  try {
    // Verify request is from Edge Function
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      quoteNumber,
      eventName,
      eventDate,
      eventTime,
      location,
      clientName,
      clientEmail,
      clientPhone,
      roomAvailableFrom,
      loadInTime,
      soundCheckTime,
      doorsTime,
      setTime,
      finishTime,
      packDownTime,
      suggestedGear,
      executionNotes,
      equipment,
      crew,
      folderType,
    } = body;

    if (!quoteNumber || !clientName) {
      return NextResponse.json(
        { error: 'Missing required fields: quoteNumber, clientName' },
        { status: 400 }
      );
    }

    const type: FolderType = folderType || 'backline';

    // Build event data
    const eventData: JobSheetEventData = {
      quoteNumber,
      eventName: eventName || 'Event',
      eventDate: eventDate || 'TBC',
      eventTime: eventTime || '',
      location: location || 'TBC',
      clientName,
      clientEmail: clientEmail || '',
      clientPhone: clientPhone || '',
      roomAvailableFrom: roomAvailableFrom || '',
      loadInTime: loadInTime || '',
      soundCheckTime: soundCheckTime || '',
      doorsTime: doorsTime || '',
      setTime: setTime || '',
      finishTime: finishTime || '',
      packDownTime: packDownTime || '',
      // AI-generated content (stored as JSON in sheet)
      suggestedGear: suggestedGear || undefined,
      executionNotes: executionNotes || undefined,
    };

    // Convert equipment to new format
    const equipmentItems: JobSheetEquipment[] = (equipment || []).map(
      (item: Record<string, unknown>) => ({
        gearName: String(item.gearName || item.item || item.name || ''),
        quantity: Number(item.quantity || item.qty || 1),
        notes: String(item.notes || ''),
      })
    );

    // Convert crew to new format (if provided)
    const crewMembers: JobSheetCrew[] | undefined = crew
      ? crew.map((member: Record<string, unknown>) => ({
          role: String(member.role || ''),
          name: member.name ? String(member.name) : undefined,
          phone: member.phone ? String(member.phone) : undefined,
          rate: member.rate ? Number(member.rate) : undefined,
          hours: member.hours ? Number(member.hours) : undefined,
        }))
      : undefined;

    const result = await createJobSheet(type, eventData, equipmentItems, crewMembers);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create jobsheet - check Google Sheets configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
    });
  } catch (error) {
    console.error('Error generating jobsheet:', error);
    return NextResponse.json(
      { error: 'Failed to generate jobsheet' },
      { status: 500 }
    );
  }
}
