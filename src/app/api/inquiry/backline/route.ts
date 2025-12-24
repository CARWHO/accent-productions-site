import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateQuote, QuoteInput, EquipmentItem } from '@/lib/gemini-quote';
import { generateQuotePDF } from '@/lib/pdf-quote';
import { uploadQuoteToDrive } from '@/lib/google-drive';
import { randomUUID } from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';
const businessEmail = baseEmail.replace('@', '+dryhire@');
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // Parse form fields
    const equipmentRaw = formData.get('equipment') as string;
    const equipment = equipmentRaw ? JSON.parse(equipmentRaw) : [];
    const otherEquipment = formData.get('otherEquipment') as string || '';
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const deliveryMethod = formData.get('deliveryMethod') as 'pickup' | 'delivery';
    const deliveryAddress = formData.get('deliveryAddress') as string || '';
    const additionalNotes = formData.get('additionalNotes') as string || '';
    const contactName = formData.get('contactName') as string;
    const contactEmail = formData.get('contactEmail') as string;
    const contactPhone = formData.get('contactPhone') as string;
    const techRiderFile = formData.get('techRider') as File | null;

    // Format equipment list for email
    const equipmentList = equipment
      .map((item: { name: string; quantity: number }) => `${item.name}: ${item.quantity}`)
      .join('\n');

    // Fetch equipment prices from database
    let equipmentWithPrices: EquipmentItem[] = [];
    const supabase = getSupabaseAdmin();

    if (supabase && equipment.length > 0) {
      const equipmentNames = equipment.map((e: { name: string }) => e.name);
      const { data: dbItems } = await supabase
        .from('hire_items')
        .select('name, hire_rate_per_day, notes')
        .in('name', equipmentNames);

      if (dbItems) {
        equipmentWithPrices = equipment.map((item: { name: string; quantity: number }) => {
          const dbItem = dbItems.find(db => db.name === item.name);
          return {
            name: item.name,
            quantity: item.quantity,
            dailyRate: dbItem?.hire_rate_per_day || 0,
            notes: dbItem?.notes || null
          };
        });
      }
    }

    // Generate quote and PDF
    let pdfBuffer: Buffer | null = null;
    let quoteNumber = '';

    try {
      const quoteInput: QuoteInput = {
        equipment: equipmentWithPrices,
        otherEquipment,
        startDate,
        endDate,
        deliveryMethod,
        deliveryAddress,
        additionalNotes,
        contactName,
        contactEmail,
        contactPhone
      };

      const quote = await generateQuote(quoteInput);
      quoteNumber = quote.quoteNumber;

      // Generate PDF
      pdfBuffer = await generateQuotePDF(
        quote,
        contactName,
        contactEmail,
        contactPhone,
        `${startDate} - ${endDate}`
      );

      console.log(`Quote ${quoteNumber} generated successfully`);

      // Upload to Google Drive
      if (pdfBuffer) {
        await uploadQuoteToDrive(pdfBuffer, `Quote-${quoteNumber}.pdf`, 'backline');
      }
    } catch (quoteError) {
      console.error('Error generating quote:', quoteError);
      // Continue without quote - email will still be sent
    }

    // Create booking record for contractor scheduling
    let approvalToken: string | null = null;
    if (supabase && quoteNumber) {
      approvalToken = randomUUID();

      // Build rich details for contractor emails
      const detailsJson = {
        type: 'backline',
        equipment: equipment.map((item: { name: string; quantity: number }) => ({
          name: item.name,
          quantity: item.quantity,
        })),
        otherEquipment: otherEquipment || null,
        rentalPeriod: {
          start: startDate,
          end: endDate,
        },
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : null,
        additionalNotes: additionalNotes || null,
      };

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          quote_number: quoteNumber,
          booking_type: 'backline',
          status: 'pending',
          event_date: startDate || null,
          event_time: null,
          location: deliveryMethod === 'delivery' ? deliveryAddress : 'Pickup',
          event_name: `Backline Hire - ${contactName}`,
          job_description: additionalNotes || null,
          client_name: contactName,
          client_email: contactEmail,
          client_phone: contactPhone,
          approval_token: approvalToken,
          details_json: detailsJson,
        });

      if (bookingError) {
        console.error('Error creating booking:', bookingError);
        approvalToken = null; // Don't show button if booking failed
      }
    }

    // Send email notification
    if (resend) {
      const emailOptions: {
        from: string;
        to: string[];
        subject: string;
        html: string;
        attachments?: { filename: string; content: Buffer }[];
      } = {
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [businessEmail],
        subject: `Backline Hire Inquiry from ${contactName}${quoteNumber ? ` - Quote ${quoteNumber}` : ''}`,
        html: `
          <h1>New Backline Hire Inquiry</h1>
          ${quoteNumber ? `<p><strong>Quote Number:</strong> ${quoteNumber}</p>` : ''}
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

          ${pdfBuffer ? '<p><em>Quote PDF attached</em></p>' : '<p><em>Quote PDF generation failed - please create manually</em></p>'}
          ${techRiderFile ? '<p><em>Tech rider attached</em></p>' : ''}

          ${approvalToken ? `
          <hr />
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #0369a1;">
              Ready to book this job? Click below to approve and notify contractors:
            </p>
            <a href="${baseUrl}/api/approve-quote?token=${approvalToken}"
               style="display: inline-block; background: #16a34a; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              ✓ Approve Quote & Notify Contractors
            </a>
          </div>
          ` : ''}
        `,
      };

      // Add attachments
      const attachments: { filename: string; content: Buffer }[] = [];

      if (pdfBuffer) {
        attachments.push({
          filename: `Quote-${quoteNumber}.pdf`,
          content: pdfBuffer
        });
      }

      // Add tech rider if uploaded
      if (techRiderFile && techRiderFile.size > 0) {
        const techRiderBuffer = Buffer.from(await techRiderFile.arrayBuffer());
        attachments.push({
          filename: techRiderFile.name || 'tech-rider.pdf',
          content: techRiderBuffer
        });
      }

      if (attachments.length > 0) {
        emailOptions.attachments = attachments;
      }

      await resend.emails.send(emailOptions);
    } else {
      console.warn('Resend API key missing, skipping email notification');
    }

    return NextResponse.json({
      success: true,
      message: 'backline inquiry submitted successfully',
      quoteNumber: quoteNumber || undefined
    });
  } catch (error) {
    console.error('Error processing backline inquiry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit inquiry' },
      { status: 500 }
    );
  }
}
