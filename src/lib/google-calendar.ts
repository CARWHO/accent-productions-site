import { google } from 'googleapis';

function getOAuth2Client() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  return oauth2Client;
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  location?: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM or text like "6pm"
  endTime?: string;
}

/**
 * Create a calendar event
 * Returns the event ID or null if failed
 */
export async function createCalendarEvent(input: CalendarEventInput): Promise<string | null> {
  try {
    const oauth2Client = getOAuth2Client();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    if (!oauth2Client) {
      console.warn('Google Calendar not configured, skipping event creation');
      return null;
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Parse start time - default to 9am if not provided
    let startDateTime: string;
    let endDateTime: string;

    if (input.startTime) {
      // Try to parse time like "6pm", "18:00", "6:00 PM"
      const parsedStart = parseTimeString(input.startTime, input.startDate);
      startDateTime = parsedStart;

      // End time: use provided or default to 4 hours later
      if (input.endTime) {
        endDateTime = parseTimeString(input.endTime, input.startDate);
      } else {
        const endDate = new Date(parsedStart);
        endDate.setHours(endDate.getHours() + 4);
        endDateTime = endDate.toISOString();
      }
    } else {
      // All-day event
      startDateTime = `${input.startDate}T09:00:00`;
      endDateTime = `${input.startDate}T17:00:00`;
    }

    const event = {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: {
        dateTime: startDateTime,
        timeZone: 'Pacific/Auckland',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Pacific/Auckland',
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    console.log(`Created calendar event: ${response.data.id}`);
    return response.data.id || null;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEventInput> & { summary?: string; description?: string }
): Promise<boolean> {
  try {
    const oauth2Client = getOAuth2Client();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    if (!oauth2Client) {
      console.warn('Google Calendar not configured');
      return false;
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get existing event first
    const existing = await calendar.events.get({
      calendarId,
      eventId,
    });

    // Merge updates
    const updatedEvent = {
      ...existing.data,
      summary: updates.summary || existing.data.summary,
      description: updates.description || existing.data.description,
      location: updates.location || existing.data.location,
    };

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: updatedEvent,
    });

    console.log(`Updated calendar event: ${eventId}`);
    return true;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return false;
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const oauth2Client = getOAuth2Client();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    if (!oauth2Client) {
      return false;
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    console.log(`Deleted calendar event: ${eventId}`);
    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}

/**
 * Parse a time string like "6pm", "18:00", "6:00 PM" into ISO datetime
 */
function parseTimeString(timeStr: string, dateStr: string): string {
  const date = new Date(dateStr);

  // Try to extract hours and minutes
  const cleanTime = timeStr.toLowerCase().trim();

  // Match patterns like "6pm", "6:30pm", "18:00", "6:00 pm"
  const match = cleanTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3];

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    date.setHours(hours, minutes, 0, 0);
  } else {
    // Default to 9am if can't parse
    date.setHours(9, 0, 0, 0);
  }

  return date.toISOString();
}
