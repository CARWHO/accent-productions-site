import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import { SoundQuoteOutput } from './gemini-sound-quote';
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
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #000',
    backgroundColor: '#f5f5f5',
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
  },
  titleRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ccc',
  },
  titleCell: {
    flex: 1,
    padding: 10,
    paddingBottom: 8,
  },
  quoteTitle: {
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 3,
  },
  quoteSubtitle: {
    fontSize: 10,
    fontStyle: 'italic',
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
  subtotalRow: {
    flexDirection: 'row',
    borderTop: '1 solid #000',
    backgroundColor: '#f9f9f9',
  },
  subtotalLabel: {
    flex: 4,
    padding: 8,
    borderRight: '1 solid #000',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  subtotalValue: {
    flex: 1,
    padding: 8,
    textAlign: 'right',
    fontWeight: 'bold',
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

export async function generateSoundQuotePDF(
  quote: SoundQuoteOutput,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  organization?: string,
  options?: { isInvoice?: boolean; invoiceNumber?: string; issuedDate?: string }
): Promise<Buffer> {
  // Use provided issuedDate or fall back to today's date
  const issuedDate = options?.issuedDate || formatDate();
  const logoBase64 = getLogoBase64();
  const isInvoice = options?.isInvoice ?? false;
  const documentNumber = isInvoice ? (options?.invoiceNumber || quote.quoteNumber) : quote.quoteNumber;

  // Build line items array for rendering
  const lineItems: { description: string; cost: number }[] = [];

  if (quote.lineItems.foh > 0) {
    lineItems.push({ description: 'FOH System', cost: quote.lineItems.foh });
  }
  if (quote.lineItems.monitors.cost > 0) {
    const monitorLabel = quote.lineItems.monitors.count > 1
      ? `Monitors (${quote.lineItems.monitors.count}x)`
      : 'Monitor';
    lineItems.push({ description: monitorLabel, cost: quote.lineItems.monitors.cost });
  }
  if (quote.lineItems.microphones?.cost > 0) {
    const micLabel = quote.lineItems.microphones.count > 1
      ? `Microphones (${quote.lineItems.microphones.count}x)`
      : 'Microphone';
    lineItems.push({ description: micLabel, cost: quote.lineItems.microphones.cost });
  }
  if (quote.lineItems.console > 0) {
    lineItems.push({ description: 'Console', cost: quote.lineItems.console });
  }
  if (quote.lineItems.cables > 0) {
    lineItems.push({ description: 'Cables & Accessories', cost: quote.lineItems.cables });
  }
  if (quote.lineItems.vehicle > 0) {
    lineItems.push({ description: 'Vehicle', cost: quote.lineItems.vehicle });
  }
  if (quote.lineItems.techTime.cost > 0) {
    const techLabel = `Tech Time (${quote.lineItems.techTime.hours} hrs @ $${quote.lineItems.techTime.rate}/hr)`;
    lineItems.push({ description: techLabel, cost: quote.lineItems.techTime.cost });
  }

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
          {organization && <Text>{organization}</Text>}
          <Text>{clientEmail}</Text>
          <Text>{clientPhone}</Text>
        </View>

        {/* Validity Note / Payment Note */}
        <Text style={[styles.validityNote, isInvoice ? { color: '#dc2626' } : {}]}>
          {isInvoice ? 'Payment due prior to event' : 'Quote valid for 28 days'}
        </Text>

        {/* Quote Table */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            <View style={styles.tableHeaderLeft}>
              <Text style={styles.tableHeaderText}>Description</Text>
            </View>
            <View style={styles.tableHeaderRight}>
              <Text style={styles.tableHeaderText}>Cost</Text>
            </View>
          </View>

          {/* Title Row */}
          <View style={styles.titleRow}>
            <View style={styles.titleCell}>
              <Text style={styles.quoteTitle}>{quote.title}</Text>
              <Text style={styles.quoteSubtitle}>{quote.subtitle}</Text>
            </View>
          </View>

          {/* Line Items */}
          {lineItems.map((item, index) => (
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
          <View style={styles.subtotalRow}>
            <View style={styles.subtotalLabel}>
              <Text>Subtotal</Text>
            </View>
            <View style={styles.subtotalValue}>
              <Text>{formatCurrency(quote.subtotal)}</Text>
            </View>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (15%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.gst)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdfDocument);
  return buffer;
}
