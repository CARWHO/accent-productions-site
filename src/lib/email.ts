// Email integration placeholder
// Recommended: Use Resend (resend.com) for transactional emails

export async function sendInquiryNotification(data: {
  eventType: string;
  attendance: number;
  eventDate: string;
  location: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  details: string;
}) {
  // TODO: Implement email sending with Resend
  console.log('Sending inquiry notification:', data);
  throw new Error('Email integration not yet implemented');
}

export async function sendQuoteEmail(data: {
  recipientEmail: string;
  recipientName: string;
  quoteDetails: string;
  paymentLink: string;
}) {
  // TODO: Implement quote email sending
  console.log('Sending quote email:', data);
  throw new Error('Email integration not yet implemented');
}
