import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';

const roleLabels: Record<string, string> = {
  sound_engineer: 'Sound Engineer',
  audio_technician: 'Audio Technician',
  dj: 'DJ',
  other: 'Other',
};

const eventTypeLabels: Record<string, string> = {
  wedding: 'Wedding',
  corporate: 'Corporate Event',
  festival: 'Festival',
  party: 'Private Party',
  other: 'Other',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roleType, otherRole, eventDate, startTime, endTime, location, eventType, specialRequirements, contactName, contactEmail, contactPhone } = body;

    const roleName = roleType === 'other' ? otherRole : roleLabels[roleType] || roleType;
    const eventTypeName = eventTypeLabels[eventType] || eventType;

    // Send email notification
    if (resend) {
      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [businessEmail],
        subject: `Contractor Inquiry: ${roleName} for ${eventTypeName}`,
        html: `
          <h1>New Contractor Inquiry</h1>
          <hr />

          <h2>Role Requested</h2>
          <p><strong>Role Type:</strong> ${roleName}</p>

          <hr />

          <h2>Event Details</h2>
          <p><strong>Event Date:</strong> ${eventDate}</p>
          <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
          <p><strong>Location:</strong> ${location}</p>
          <p><strong>Event Type:</strong> ${eventTypeName}</p>
          ${specialRequirements ? `<p><strong>Special Requirements:</strong> ${specialRequirements}</p>` : ''}

          <hr />

          <h2>Contact Information</h2>
          <p><strong>Name:</strong> ${contactName}</p>
          <p><strong>Email:</strong> ${contactEmail}</p>
          <p><strong>Phone:</strong> ${contactPhone}</p>
        `,
      });
    } else {
      console.warn('Resend API key missing, skipping email notification');
    }

    return NextResponse.json({
      success: true,
      message: 'Contractor inquiry submitted successfully'
    });
  } catch (error) {
    console.error('Error processing contractor inquiry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit inquiry' },
      { status: 500 }
    );
  }
}
