import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import { QuoteOutput } from './gemini-quote';
import path from 'path';
import fs from 'fs';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  logo: {
    width: 60,
    height: 60,
    marginRight: 15,
  },
  headerText: {
    flex: 1,
  },
  tradingAs: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  businessName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 8,
  },
  addressBlock: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 15,
  },
  quoteHeader: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 10,
  },
  clientBlock: {
    marginBottom: 15,
    fontSize: 10,
    lineHeight: 1.4,
  },
  validityNote: {
    fontSize: 12,
    color: '#0066cc',
    marginBottom: 15,
  },
  tableContainer: {
    border: '1 solid #000',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1 solid #000',
    backgroundColor: '#ffffff',
  },
  tableHeaderLeft: {
    flex: 4,
    padding: 8,
    borderRight: '1 solid #000',
  },
  tableHeaderRight: {
    flex: 1,
    padding: 8,
    textAlign: 'right',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  tableBody: {
    flexDirection: 'row',
    minHeight: 250,
  },
  tableBodyLeft: {
    flex: 4,
    padding: 10,
    borderRight: '1 solid #000',
  },
  tableBodyRight: {
    flex: 1,
    padding: 10,
    textAlign: 'right',
  },
  quoteTitle: {
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 3,
  },
  quoteSubtitle: {
    fontSize: 10,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  lineItem: {
    fontSize: 9,
    marginBottom: 2,
  },
  lineItemNote: {
    fontSize: 9,
    marginTop: 8,
    fontStyle: 'italic',
  },
  totalsContainer: {
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    width: 180,
    marginBottom: 4,
  },
  totalLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 15,
    fontWeight: 'bold',
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
  },
  balanceRow: {
    flexDirection: 'row',
    width: 180,
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1 solid #000',
  },
  // New styles for grouped line items (invoice format)
  titleRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ccc',
  },
  titleCell: {
    flex: 1,
    padding: 10,
    paddingBottom: 8,
  },
  lineItemRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #eee',
  },
  lineItemDescription: {
    flex: 4,
    padding: 8,
    paddingLeft: 20,
    borderRight: '1 solid #000',
  },
  lineItemCost: {
    flex: 1,
    padding: 8,
    textAlign: 'right',
  },
  subtotalTableRow: {
    flexDirection: 'row',
    borderTop: '1 solid #000',
    backgroundColor: '#f9f9f9',
  },
  subtotalTableLabel: {
    flex: 4,
    padding: 8,
    borderRight: '1 solid #000',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  subtotalTableValue: {
    flex: 1,
    padding: 8,
    textAlign: 'right',
    fontWeight: 'bold',
  },
});

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Categorize equipment items for grouped display
function categorizeEquipment(lineItems: { description: string; amount: number }[]): { description: string; cost: number }[] {
  const categories: Record<string, { items: string[]; total: number }> = {
    'Speakers': { items: [], total: 0 },
    'Subwoofers': { items: [], total: 0 },
    'Monitors': { items: [], total: 0 },
    'Microphones': { items: [], total: 0 },
    'Console & Stage Box': { items: [], total: 0 },
    'Accessories': { items: [], total: 0 },
  };

  for (const item of lineItems) {
    const desc = item.description.toLowerCase();

    if (desc.includes('sub') || desc.includes('18')) {
      categories['Subwoofers'].items.push(item.description);
      categories['Subwoofers'].total += item.amount;
    } else if (desc.includes('monitor') || desc.includes('wedge')) {
      categories['Monitors'].items.push(item.description);
      categories['Monitors'].total += item.amount;
    } else if (desc.includes('elx') || desc.includes('ekx') || desc.includes('zlx') || desc.includes('etx') || desc.includes('speaker') || desc.includes('-p') || desc.includes('12p') || desc.includes('15p')) {
      categories['Speakers'].items.push(item.description);
      categories['Speakers'].total += item.amount;
    } else if (desc.includes('sm58') || desc.includes('sm57') || desc.includes('mic') || desc.includes('beta') || desc.includes('sennheiser') || desc.includes('akg') || desc.includes('d112') || desc.includes('e902') || desc.includes('ksm') || desc.includes('wireless')) {
      categories['Microphones'].items.push(item.description);
      categories['Microphones'].total += item.amount;
    } else if (desc.includes('console') || desc.includes('x32') || desc.includes('mixer') || desc.includes('s16') || desc.includes('stage box') || desc.includes('rio') || desc.includes('dl16') || desc.includes('dl32')) {
      categories['Console & Stage Box'].items.push(item.description);
      categories['Console & Stage Box'].total += item.amount;
    } else if (desc.includes('di') || desc.includes('cable') || desc.includes('stand') || desc.includes('snake') || desc.includes('power')) {
      categories['Accessories'].items.push(item.description);
      categories['Accessories'].total += item.amount;
    } else {
      // Default to accessories for unmatched items
      categories['Accessories'].items.push(item.description);
      categories['Accessories'].total += item.amount;
    }
  }

  // Build result array with only non-zero categories
  const result: { description: string; cost: number }[] = [];

  // Combine Speakers and Subs into "FOH System" if both exist
  const speakerTotal = categories['Speakers'].total + categories['Subwoofers'].total;
  if (speakerTotal > 0) {
    result.push({ description: 'FOH System', cost: speakerTotal });
  }

  if (categories['Monitors'].total > 0) {
    const count = categories['Monitors'].items.length;
    result.push({
      description: count > 1 ? `Monitors (${count}x)` : 'Monitor',
      cost: categories['Monitors'].total
    });
  }

  if (categories['Microphones'].total > 0) {
    const count = categories['Microphones'].items.length;
    result.push({
      description: count > 1 ? `Microphones (${count}x)` : 'Microphone',
      cost: categories['Microphones'].total
    });
  }

  if (categories['Console & Stage Box'].total > 0) {
    result.push({ description: 'Console & Stage Box', cost: categories['Console & Stage Box'].total });
  }

  if (categories['Accessories'].total > 0) {
    result.push({ description: 'Accessories', cost: categories['Accessories'].total });
  }

  return result;
}

// Get logo as base64 for embedding in PDF
function getLogoBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo-quote.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
    // Fallback to logoblack.png
    const fallbackPath = path.join(process.cwd(), 'public', 'images', 'logoblack.png');
    if (fs.existsSync(fallbackPath)) {
      const logoBuffer = fs.readFileSync(fallbackPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
  } catch (e) {
    console.error('Error loading logo:', e);
  }
  return null;
}

export async function generateQuotePDF(
  quote: QuoteOutput,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  eventDate: string,
  options?: {
    isInvoice?: boolean;
    invoiceNumber?: string;
    organization?: string;
    packageName?: string;
    eventName?: string;
    issuedDate?: string;
  }
): Promise<Buffer> {
  // Use provided issuedDate or fall back to today's date
  const issuedDate = options?.issuedDate || formatDate();
  const logoBase64 = getLogoBase64();
  const isInvoice = options?.isInvoice ?? false;
  const documentNumber = isInvoice ? (options?.invoiceNumber || quote.quoteNumber) : quote.quoteNumber;

  const pdfDocument = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with Logo */}
        <View style={styles.headerRow}>
          {logoBase64 && (
            <Image style={styles.logo} src={logoBase64} />
          )}
          <View style={styles.headerText}>
            <Text style={styles.tradingAs}>Barrie Hutton trading as</Text>
            <Text style={styles.businessName}>Accent Entertainment</Text>
            <Text style={styles.subtitle}>Production Company</Text>
          </View>
        </View>

        {/* Address */}
        <View style={styles.addressBlock}>
          <Text>23 Moxham Ave</Text>
          <Text>Hataitai Wellington 6021</Text>
          <Text>Tel 027 602 3869</Text>
          <Text>Email hello@accent-productions.co.nz</Text>
        </View>

        {/* Quote/Invoice Number and Date */}
        <Text style={styles.quoteHeader}>
          {isInvoice ? 'Invoice' : 'Quote'} Nº: {documentNumber}   Issued: {issuedDate}
        </Text>

        {/* Client Info */}
        <View style={styles.clientBlock}>
          <Text>{clientName}</Text>
          {options?.organization && <Text>{options.organization}</Text>}
          <Text>{clientEmail}</Text>
          <Text>{clientPhone}</Text>
          {options?.eventName && <Text style={{ marginTop: 5, fontWeight: 'bold' }}>Event: {options.eventName}</Text>}
          {options?.packageName && <Text>Package: {options.packageName}</Text>}
        </View>

        {/* Validity Note / Payment Note */}
        <Text style={[styles.validityNote, isInvoice ? { color: '#dc2626' } : {}]}>
          {isInvoice ? 'Payment due prior to event' : 'Quote valid for 28 days'}
        </Text>

        {/* Quote Table */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderLeft}>
              <Text style={styles.tableHeaderText}>{isInvoice ? 'Description' : ''}</Text>
            </View>
            <View style={styles.tableHeaderRight}>
              <Text style={styles.tableHeaderText}>Cost</Text>
            </View>
          </View>

          {isInvoice ? (
            /* Invoice: Grouped format like sound quotes */
            <>
              {/* Title Row */}
              <View style={styles.titleRow}>
                <View style={styles.titleCell}>
                  <Text style={styles.quoteTitle}>
                    Equipment Hire @ {quote.description || 'Event'} ({eventDate})
                  </Text>
                  {options?.eventName && (
                    <Text style={styles.quoteSubtitle}>{options.eventName}</Text>
                  )}
                </View>
              </View>

              {/* Grouped Line Items */}
              {categorizeEquipment(quote.lineItems).map((item, index) => (
                <View key={index} style={styles.lineItemRow}>
                  <View style={styles.lineItemDescription}>
                    <Text>{item.description}</Text>
                  </View>
                  <View style={styles.lineItemCost}>
                    <Text>{formatCurrency(item.cost)}</Text>
                  </View>
                </View>
              ))}

              {/* Subtotal Row */}
              <View style={styles.subtotalTableRow}>
                <View style={styles.subtotalTableLabel}>
                  <Text>Subtotal</Text>
                </View>
                <View style={styles.subtotalTableValue}>
                  <Text>{formatCurrency(quote.subtotal)}</Text>
                </View>
              </View>
            </>
          ) : (
            /* Quote: Original detailed format */
            <View style={styles.tableBody}>
              <View style={styles.tableBodyLeft}>
                <Text style={styles.quoteTitle}>
                  Backline Hire ({eventDate})
                </Text>
                {quote.description && (
                  <Text style={styles.quoteSubtitle}>{quote.description}</Text>
                )}
                {quote.lineItems.map((item, index) => (
                  <Text key={index} style={styles.lineItem}>
                    {item.description} ${item.amount.toFixed(0)}
                  </Text>
                ))}
                {quote.rentalDays > 1 && (
                  <Text style={styles.lineItemNote}>
                    Day 2+ @ 50% rate
                  </Text>
                )}
                <Text style={[styles.lineItem, { marginTop: 10, fontWeight: 'bold' }]}>
                  Total ${quote.subtotal.toFixed(0)}+GST
                </Text>
              </View>
              <View style={styles.tableBodyRight}>
                <Text style={{ fontWeight: 'bold' }}>{formatCurrency(quote.subtotal)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.gst)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.total)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.totalLabel}>Balance</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdfDocument);
  return buffer;
}
