import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';

export interface InvoiceInput {
  invoiceNumber: string;
  quoteNumber?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  organization?: string;
  eventName: string;
  eventDate: string;
  location?: string;
  lineItems: Array<{ description: string; amount: number }>;
  subtotal: number;
  gst: number;
  total: number;
  notes?: string;
  paymentUrl?: string;
}

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
  invoiceHeader: {
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
  dueNote: {
    fontSize: 12,
    color: '#dc2626',
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
  invoiceTitle: {
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 3,
  },
  invoiceSubtitle: {
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

function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getLogoBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo-quote.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
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

export async function generateInvoicePDF(input: InvoiceInput): Promise<Buffer> {
  const today = formatDate();
  const logoBase64 = getLogoBase64();

  // Build subtitle from event date and location
  const subtitle = `${formatEventDate(input.eventDate)}${input.location ? ` | ${input.location}` : ''}`;

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

        {/* Invoice Number and Date */}
        <Text style={styles.invoiceHeader}>
          Invoice Nº: {input.invoiceNumber}   Issued: {today}
        </Text>

        {/* Client Info */}
        <View style={styles.clientBlock}>
          <Text>{input.clientName}</Text>
          {input.organization && <Text>{input.organization}</Text>}
          <Text>{input.clientEmail}</Text>
          <Text>{input.clientPhone}</Text>
        </View>

        {/* Due Note */}
        <Text style={styles.dueNote}>Payment due prior to event</Text>

        {/* Invoice Table */}
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
              <Text style={styles.invoiceTitle}>{input.eventName}</Text>
              <Text style={styles.invoiceSubtitle}>{subtitle}</Text>
            </View>
          </View>

          {/* Line Items */}
          {input.lineItems.map((item, index) => (
            <View key={index} style={styles.lineItemRow}>
              <View style={styles.lineItemDescription}>
                <Text>{item.description}</Text>
              </View>
              <View style={styles.lineItemCost}>
                <Text>{formatCurrency(item.amount)}</Text>
              </View>
            </View>
          ))}

          {/* Subtotal Row */}
          <View style={styles.subtotalRow}>
            <View style={styles.subtotalLabel}>
              <Text>Subtotal</Text>
            </View>
            <View style={styles.subtotalValue}>
              <Text>{formatCurrency(input.subtotal)}</Text>
            </View>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (15%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(input.gst)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(input.total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdfDocument);
  return buffer;
}
