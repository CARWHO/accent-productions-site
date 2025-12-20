// Xero integration placeholder
// TODO: Set up Xero OAuth2 authentication
// TODO: Implement invoice creation

export async function createInvoice(data: {
  contactName: string;
  contactEmail: string;
  description: string;
  amount: number;
}) {
  // TODO: Implement Xero invoice creation
  console.log('Creating Xero invoice:', data);
  throw new Error('Xero integration not yet implemented');
}
