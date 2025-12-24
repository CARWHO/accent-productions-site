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

export async function generateQuotePDF(
  quote: QuoteOutput,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  eventDate: string
): Promise<Buffer> {
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
          <Text>Email hello@accent-productions.co.nz.com</Text>
        </View>

        {/* Quote Number and Date */}
        <Text style={styles.quoteHeader}>
          Quote Nº: {quote.quoteNumber}   Issued: {today}
        </Text>

        {/* Client Info */}
        <View style={styles.clientBlock}>
          <Text>{clientName}</Text>
          <Text>{clientEmail}</Text>
          <Text>{clientPhone}</Text>
        </View>

        {/* Validity Note */}
        <Text style={styles.validityNote}>Quote valid for 28 days</Text>

        {/* Quote Table */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderLeft}>
              <Text style={styles.tableHeaderText}></Text>
            </View>
            <View style={styles.tableHeaderRight}>
              <Text style={styles.tableHeaderText}>Cost</Text>
            </View>
          </View>

          {/* Table Body */}
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
