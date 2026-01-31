import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import { QuoteOutput } from './gemini-quote';
import { getLogoBase64, formatCurrency, formatDateShort } from './pdf-utils';

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

// Line item with optional extended data for labour detection
interface ExtendedLineItem {
  description: string;
  amount: number;
  quantity?: number;   // Hours for labour
  unitRate?: number;   // >0 for labour items (hourly rate)
}

// Categorize equipment into 6 categories: PA, Backline, Staging, Lighting, Transport, Technician
function categorizeEquipment(lineItems: ExtendedLineItem[]): { description: string; cost: number }[] {
  interface CategoryData {
    items: string[];
    total: number;
    hours?: number;
    rate?: number;
  }

  const categories: Record<string, CategoryData> = {
    'PA': { items: [], total: 0 },           // Speakers, subs, mics, console, DIs, cables
    'Backline': { items: [], total: 0 },     // Drums, amps, keyboards, guitars
    'Staging': { items: [], total: 0 },      // Risers, decks, platforms
    'Lighting': { items: [], total: 0 },     // LED, par, wash, uplights
    'Transport': { items: [], total: 0 },    // Vehicle, delivery
    'Technician': { items: [], total: 0, hours: 0, rate: 0 },
  };

  // Keywords for non-PA categories (everything else goes to PA)
  const patterns: { category: string; keywords: string[] }[] = [
    { category: 'Backline', keywords: ['drum', 'kit', 'amp', 'amplifier', 'keyboard', 'piano', 'guitar', 'bass', 'fender', 'marshall', 'ampeg', 'roland', 'nord'] },
    { category: 'Staging', keywords: ['riser', 'stage deck', 'platform', 'drum riser'] },
    { category: 'Lighting', keywords: ['light', 'led', 'par', 'wash', 'uplift', 'uplight', 'spot', 'moving head', 'dmx', 'fixture'] },
    { category: 'Transport', keywords: ['vehicle', 'transport', 'delivery', 'truck', 'van', 'travel', 'freight'] },
  ];

  // Keywords to identify labour/technician items
  const labourKeywords = ['technician', 'labour', 'labor', 'tech time', 'sound tech'];

  for (const item of lineItems) {
    const desc = item.description.toLowerCase();

    // Labour items detected by keyword (technician, labour, etc.)
    // unitRate provides hours breakdown if available
    if (labourKeywords.some(kw => desc.includes(kw))) {
      categories['Technician'].items.push(item.description);
      categories['Technician'].total += item.amount;
      if (item.unitRate && item.unitRate > 0) {
        categories['Technician'].hours = item.quantity || 0;
        categories['Technician'].rate = item.unitRate;
      }
      continue;
    }

    // Check specific categories
    let matched = false;
    for (const pattern of patterns) {
      if (pattern.keywords.some(kw => desc.includes(kw))) {
        categories[pattern.category].items.push(item.description);
        categories[pattern.category].total += item.amount;
        matched = true;
        break;
      }
    }

    // Default to PA (speakers, mics, console, monitors, DIs, cables, etc.)
    if (!matched) {
      categories['PA'].items.push(item.description);
      categories['PA'].total += item.amount;
    }
  }

  // Build result with bracket summaries
  const result: { description: string; cost: number }[] = [];

  const getBracketSummary = (category: string, items: string[]): string => {
    const types = new Set<string>();
    for (const item of items) {
      const lower = item.toLowerCase();
      if (category === 'PA') {
        if (lower.includes('speaker') || lower.includes('elx') || lower.includes('ekx') || lower.includes('zlx') || lower.includes('etx') || lower.includes('12p') || lower.includes('15p')) types.add('Speakers');
        if (lower.includes('sub') || lower.includes('18')) types.add('Subwoofers');
        if (lower.includes('monitor') || lower.includes('wedge')) types.add('Monitors');
        if (lower.includes('mic') || lower.includes('sm58') || lower.includes('sm57') || lower.includes('wireless')) types.add('Microphones');
        if (lower.includes('console') || lower.includes('mixer') || lower.includes('x32') || lower.includes('m32')) types.add('Mixer');
        if (lower.includes('di') || lower.includes('cable') || lower.includes('stand')) types.add('Accessories');
      } else if (category === 'Backline') {
        if (lower.includes('drum') || lower.includes('kit')) types.add('Drum Kit');
        if (lower.includes('guitar') && lower.includes('amp') || lower.includes('fender') || lower.includes('marshall')) types.add('Guitar Amp');
        if (lower.includes('bass') || lower.includes('ampeg')) types.add('Bass Amp');
        if (lower.includes('keyboard') || lower.includes('piano') || lower.includes('nord') || lower.includes('roland')) types.add('Keys');
      } else if (category === 'Staging') {
        if (lower.includes('drum riser')) types.add('Drum Riser');
        else types.add('Risers');
      } else if (category === 'Lighting') {
        if (lower.includes('led')) types.add('LED');
        if (lower.includes('par')) types.add('Par Cans');
        if (lower.includes('uplift') || lower.includes('uplight')) types.add('Uplights');
        if (lower.includes('wash')) types.add('Wash');
      }
    }
    return types.size > 0 ? Array.from(types).slice(0, 3).join(', ') : '';
  };

  // Display order
  const displayOrder = ['PA', 'Backline', 'Staging', 'Lighting', 'Transport', 'Technician'];

  for (const categoryName of displayOrder) {
    const cat = categories[categoryName];
    if (cat.total <= 0) continue;

    if (categoryName === 'Technician') {
      const hours = cat.hours || 0;
      const rate = cat.rate || 0;
      const desc = hours > 0 && rate > 0
        ? `Technician (${hours}hrs @ $${rate}/hr)`
        : 'Technician';
      result.push({ description: desc, cost: cat.total });
    } else {
      const summary = getBracketSummary(categoryName, cat.items);
      result.push({
        description: summary ? `${categoryName} (${summary})` : categoryName,
        cost: cat.total
      });
    }
  }

  return result;
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
  const issuedDate = options?.issuedDate || formatDateShort();
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
            <Text style={styles.totalLabel}>GST (15%)</Text>
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
