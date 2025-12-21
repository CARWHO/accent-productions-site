import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';

export async function sendInquiryNotification(data: any) {
  console.log('Attempting to send inquiry notification...');
  console.log('Target Email:', businessEmail);

  if (!resend) {
    console.warn('Resend API key missing, skipping email notification');
    return;
  }

  const {
    eventType,
    organization,
    eventName,
    eventDate,
    eventTime,
    setupTime,
    attendance,
    location,
    venueContact,
    content,
    indoorOutdoor,
    powerAccess,
    stageProvider,
    contactName,
    contactEmail,
    contactPhone,
    details
  } = data;

  try {
    const result = await resend.emails.send({
      from: 'Accent Productions <notifications@accent-productions.co.nz>',
      to: [businessEmail],
      subject: `New Inquiry: ${eventName} (${eventType})`,
      html: `
        <h1>New Inquiry Received</h1>
        <p><strong>Event:</strong> ${eventName}</p>
        <p><strong>Type:</strong> ${eventType}</p>
        <p><strong>Organization:</strong> ${organization || 'N/A'}</p>
        <p><strong>Date:</strong> ${eventDate}</p>
        <p><strong>Time:</strong> ${eventTime}</p>
        <p><strong>Setup/Packout:</strong> ${setupTime}</p>
        <p><strong>Attendance:</strong> ${attendance}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Venue Contact:</strong> ${venueContact || 'N/A'}</p>
        <p><strong>Indoor/Outdoor:</strong> ${indoorOutdoor}</p>
        <p><strong>Power Access:</strong> ${powerAccess}</p>
        <p><strong>Stage Provider:</strong> ${stageProvider || 'N/A'}</p>
        <p><strong>Content:</strong> ${content}</p>
        <hr />
        <h3>Contact Details</h3>
        <p><strong>Name:</strong> ${contactName}</p>
        <p><strong>Email:</strong> ${contactEmail}</p>
        <p><strong>Phone:</strong> ${contactPhone}</p>
        <p><strong>Additional Details:</strong> ${details || 'None'}</p>
      `,
    });
    console.log('Resend response:', result);
  } catch (error) {
    console.error('Error sending inquiry notification:', error);
    throw error;
  }
}

export async function sendQuoteEmail(data: {
  recipientEmail: string;
  recipientName: string;
  quoteDetails: string;
  paymentLink: string;
}) {
  if (!resend) return;

  try {
    await resend.emails.send({
      from: 'Accent Productions <hello@accent-productions.co.nz>',
      to: [data.recipientEmail],
      subject: 'Your Quote from Accent Productions',
      html: `
        <h1>Hello ${data.recipientName},</h1>
        <p>Thank you for choosing Accent Productions. Here are the details of your quote:</p>
        <div style="background: #f4f4f4; padding: 20px; border-radius: 8px;">
          ${data.quoteDetails}
        </div>
        <p>To confirm your booking, please pay the deposit using the link below:</p>
        <a href="${data.paymentLink}" style="display: inline-block; background: #F47B20; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Pay Deposit</a>
        <p>If you have any questions, feel free to reply to this email.</p>
      `,
    });
  } catch (error) {
    console.error('Error sending quote email:', error);
    throw error;
  }
}
