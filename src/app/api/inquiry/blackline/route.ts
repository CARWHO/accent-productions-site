import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { equipment, otherEquipment, startDate, endDate, deliveryMethod, deliveryAddress, additionalNotes, contactName, contactEmail, contactPhone } = body;

    // Format equipment list for email
    const equipmentList = equipment
      .map((item: { name: string; quantity: number }) => `${item.name}: ${item.quantity}`)
      .join('\n');

    // Send email notification
    if (resend) {
      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [businessEmail],
        subject: `Backline Hire Inquiry from ${contactName}`,
        html: `
          <h1>New Backline Hire Inquiry</h1>
          <hr />

          <h2>Equipment Requested</h2>
          <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px;">${equipmentList || 'No standard equipment selected'}</pre>
          ${otherEquipment ? `<p><strong>Other Equipment:</strong> ${otherEquipment}</p>` : ''}

          <hr />

          <h2>Rental Details</h2>
          <p><strong>Start Date:</strong> ${startDate}</p>
          <p><strong>End Date:</strong> ${endDate}</p>
          <p><strong>Method:</strong> ${deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</p>
          ${deliveryMethod === 'delivery' ? `<p><strong>Delivery Address:</strong> ${deliveryAddress}</p>` : ''}
          ${additionalNotes ? `<p><strong>Additional Notes:</strong> ${additionalNotes}</p>` : ''}

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
      message: 'backline inquiry submitted successfully'
    });
  } catch (error) {
    console.error('Error processing backline inquiry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit inquiry' },
      { status: 500 }
    );
  }
}
