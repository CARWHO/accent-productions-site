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
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 10,
    color: '#16a34a',
  },
  invoiceSubheader: {
    textAlign: 'center',
    fontSize: 10,
    marginBottom: 15,
    color: '#666',
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
    fontWeight: 'bold',
  },
  tableContainer: {
    border: '1 solid #000',
    marginBottom: 20,
  },
  tableHeader: {
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
  tableBody: {
    flexDirection: 'row',
    minHeight: 200,
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
  eventTitle: {
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 3,
  },
  eventSubtitle: {
    fontSize: 10,
    marginBottom: 10,
    fontStyle: 'italic',
    color: '#666',
  },
  lineItem: {
    fontSize: 9,
    marginBottom: 2,
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
    borderTop: '2 solid #16a34a',
  },
  balanceLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 15,
    fontWeight: 'bold',
    fontSize: 12,
    color: '#16a34a',
  },
  balanceValue: {
    width: 80,
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#16a34a',
  },
  paymentBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    border: '1 solid #16a34a',
  },
  paymentTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#166534',
  },
  paymentText: {
    fontSize: 9,
    marginBottom: 3,
    color: '#374151',
  },
  notesBox: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  notesText: {
    fontSize: 9,
    color: '#92400e',
  },
  paymentUrlBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#dcfce7',
    borderRadius: 4,
  },
  paymentUrlLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 4,
  },
  paymentUrlText: {
    fontSize: 8,
    color: '#166534',
    wordBreak: 'break-all',
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

        {/* Invoice Header */}
        <Text style={styles.invoiceHeader}>
          TAX INVOICE
        </Text>
        <Text style={styles.invoiceSubheader}>
          Invoice #: {input.invoiceNumber}   |   Date: {today}
          {input.quoteNumber ? `   |   Quote Ref: ${input.quoteNumber}` : ''}
        </Text>

        {/* Client Info */}
        <View style={styles.clientBlock}>
          <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>Bill To:</Text>
          <Text>{input.clientName}</Text>
          <Text>{input.clientEmail}</Text>
          <Text>{input.clientPhone}</Text>
        </View>

        {/* Due Note */}
        <Text style={styles.dueNote}>Payment Due: Prior to event</Text>

        {/* Invoice Table */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderLeft}>
              <Text style={styles.tableHeaderText}>Description</Text>
            </View>
            <View style={styles.tableHeaderRight}>
              <Text style={styles.tableHeaderText}>Amount</Text>
            </View>
          </View>

          {/* Table Body */}
          <View style={styles.tableBody}>
            <View style={styles.tableBodyLeft}>
              <Text style={styles.eventTitle}>{input.eventName}</Text>
              <Text style={styles.eventSubtitle}>
                {formatEventDate(input.eventDate)}
                {input.location ? ` | ${input.location}` : ''}
              </Text>
              {input.lineItems.map((item, index) => (
                <Text key={index} style={styles.lineItem}>
                  • {item.description} - ${item.amount.toFixed(2)}
                </Text>
              ))}
            </View>
            <View style={styles.tableBodyRight}>
              <Text style={{ fontWeight: 'bold' }}>{formatCurrency(input.subtotal)}</Text>
            </View>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(input.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (15%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(input.gst)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>TOTAL DUE</Text>
            <Text style={styles.balanceValue}>{formatCurrency(input.total)}</Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentBox}>
          <Text style={styles.paymentTitle}>Payment Options</Text>

          {input.paymentUrl && (
            <View style={styles.paymentUrlBox}>
              <Text style={styles.paymentUrlLabel}>Pay Online (Visa/Mastercard):</Text>
              <Text style={styles.paymentUrlText}>{input.paymentUrl}</Text>
            </View>
          )}

          <Text style={styles.paymentText}>Bank Transfer:</Text>
          <Text style={styles.paymentText}>   Account: Accent Entertainment</Text>
          <Text style={styles.paymentText}>   Bank: ANZ</Text>
          <Text style={styles.paymentText}>   Account #: 01-0505-0123456-00</Text>
          <Text style={styles.paymentText}>   Reference: {input.invoiceNumber}</Text>
        </View>

        {/* Notes */}
        {input.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{input.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdfDocument);
  return buffer;
}
