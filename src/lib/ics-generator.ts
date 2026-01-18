/**
 * ICS (iCalendar) file generator for universal calendar support
 * Works with: iOS Calendar, Google Calendar, Outlook, Apple Mail, etc.
 */

interface ICSEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  organizer?: {
    name: string;
    email: string;
  };
}

/**
 * Escapes special characters in ICS text fields
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Formats a Date object to ICS date-time format (UTC)
 * Format: YYYYMMDDTHHMMSSZ
 */
function formatICSDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generates a unique identifier for the event
 */
function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@accent-productions.co.nz`;
}

/**
 * Generates an ICS file content string for a calendar event
 */
export function generateICSContent(event: ICSEvent): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Accent Productions//Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${generateUID()}`,
    `DTSTAMP:${formatICSDateTime(new Date())}`,
    `DTSTART:${formatICSDateTime(event.startDate)}`,
    `DTEND:${formatICSDateTime(event.endDate)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICSText(event.location)}`);
  }

  if (event.organizer) {
    lines.push(`ORGANIZER;CN=${escapeICSText(event.organizer.name)}:mailto:${event.organizer.email}`);
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  // ICS files use CRLF line endings
  return lines.join('\r\n');
}

/**
 * Builds an ICS event from booking data
 */
export function buildICSFromBooking(booking: {
  event_name?: string | null;
  event_date: string;
  event_time?: string | null;
  location?: string | null;
  client_name?: string;
  client_phone?: string;
  call_time?: string | null;
  pack_out_time?: string | null;
  call_out_notes?: string | null;
  band_names?: string | null;
  quote_number?: string;
}): string {
  // Parse the event date
  const startDate = new Date(booking.event_date);

  // Parse call_time or event_time for start
  const timeToUse = booking.call_time || booking.event_time;
  if (timeToUse) {
    const timeMatch = timeToUse.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      // Handle 24-hour format
      if (!meridiem && hours >= 0 && hours <= 23) {
        // Already in 24-hour format
      }
      startDate.setHours(hours, mins, 0, 0);
    }
  } else {
    startDate.setHours(9, 0, 0, 0); // Default to 9am
  }

  // Parse pack_out_time for end, or default to 4 hours after start
  const endDate = new Date(startDate);
  if (booking.pack_out_time) {
    const packOutMatch = booking.pack_out_time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (packOutMatch) {
      let hours = parseInt(packOutMatch[1], 10);
      const mins = packOutMatch[2] ? parseInt(packOutMatch[2], 10) : 0;
      const meridiem = packOutMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      endDate.setHours(hours, mins, 0, 0);
    }
  } else {
    endDate.setHours(endDate.getHours() + 4);
  }

  // Build description
  const descParts: string[] = [];
  if (booking.call_time) descParts.push(`Call Time: ${booking.call_time}`);
  if (booking.event_time && booking.event_time !== booking.call_time) {
    descParts.push(`Show Time: ${booking.event_time}`);
  }
  if (booking.pack_out_time) descParts.push(`Pack-out: ${booking.pack_out_time}`);
  if (booking.band_names) descParts.push(`Performing: ${booking.band_names}`);
  if (booking.client_name) descParts.push(`Client: ${booking.client_name}`);
  if (booking.client_phone) descParts.push(`Phone: ${booking.client_phone}`);
  if (booking.call_out_notes) descParts.push(`Notes: ${booking.call_out_notes}`);
  if (booking.quote_number) descParts.push(`Quote: #${booking.quote_number}`);
  descParts.push('', 'Booked via Accent Productions');

  return generateICSContent({
    title: `${booking.event_name || 'Event'} - Accent Productions`,
    description: descParts.join('\n'),
    location: booking.location || undefined,
    startDate,
    endDate,
    organizer: {
      name: 'Accent Productions',
      email: 'hello@accent-productions.co.nz',
    },
  });
}
