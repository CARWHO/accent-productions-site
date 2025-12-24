import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateQuote, QuoteInput, EquipmentItem } from '@/lib/gemini-quote';
import { generateQuotePDF } from '@/lib/pdf-quote';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';
const businessEmail = baseEmail.replace('@', '+dryhire@');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      equipment,
      otherEquipment,
      startDate,
      endDate,
      deliveryMethod,
      deliveryAddress,
      additionalNotes,
      contactName,
      contactEmail,
      contactPhone
    } = body;

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
    } catch (quoteError) {
      console.error('Error generating quote:', quoteError);
      // Continue without quote - email will still be sent
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
        `,
      };

      // Add PDF attachment if generated successfully
      if (pdfBuffer) {
        emailOptions.attachments = [
          {
            filename: `Quote-${quoteNumber}.pdf`,
            content: pdfBuffer
          }
        ];
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
