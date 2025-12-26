import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';

export interface JobSheetInput {
  // Event info (from bookings)
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  location: string;
  quoteNumber: string;

  // Contractor assignment
  contractorName: string;
  hourlyRate: number | null;
  estimatedHours: number | null;
  payAmount: number;
  tasksDescription: string | null;

  // Equipment (from details_json)
  equipment: Array<{ name: string; quantity: number; notes?: string | null }>;

  // Event details (from details_json)
  eventType: string | null;
  attendance: string | null;
  setupTime: string | null;
  indoorOutdoor: string | null;
  contentRequirements: string[];
  additionalNotes: string | null;

  // Client
  clientName: string;
  clientPhone: string;
  clientEmail: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 15,
  },
  headerText: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  documentTitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  // Event header box
  eventBox: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 4,
    marginBottom: 15,
  },
  eventName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  eventDetail: {
    fontSize: 10,
    marginBottom: 3,
    color: '#374151',
  },
  // Pay box (highlighted green)
  payBox: {
    backgroundColor: '#f0fdf4',
    border: '2 solid #16a34a',
    padding: 15,
    borderRadius: 4,
    marginBottom: 15,
  },
  payLabel: {
    fontSize: 10,
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  },
  payAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#15803d',
  },
  // Section styling
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1 solid #e5e5e5',
    color: '#111827',
  },
  sectionContent: {
    paddingLeft: 5,
  },
  // Tasks
  taskItem: {
    fontSize: 10,
    marginBottom: 4,
    color: '#374151',
  },
  // Equipment table
  equipmentRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  equipmentQty: {
    width: 35,
    fontSize: 10,
    color: '#374151',
  },
  equipmentName: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
  },
  equipmentNotes: {
    fontSize: 8,
    color: '#6b7280',
    fontStyle: 'italic',
    marginLeft: 35,
    marginBottom: 4,
  },
  // Event details list
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    width: 100,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  detailValue: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
  },
  // Client contact box
  clientBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 4,
    marginBottom: 15,
  },
  clientName: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  clientDetail: {
    fontSize: 10,
    color: '#4b5563',
    marginBottom: 2,
  },
  // Notes section
  notesBox: {
    backgroundColor: '#fffbeb',
    border: '1 solid #fcd34d',
    padding: 12,
    borderRadius: 4,
  },
  notesText: {
    fontSize: 10,
    color: '#92400e',
    lineHeight: 1.4,
  },
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const cleanTime = timeStr.trim().toLowerCase();
  if (/^\d{1,2}(:\d{2})?\s*(am|pm)$/i.test(cleanTime)) {
    return timeStr.trim();
  }
  const match24 = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const mins = match24[2];
    const period = hours >= 12 ? 'pm' : 'am';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return mins === '00' ? `${hours}${period}` : `${hours}:${mins}${period}`;
  }
  return timeStr;
}

// Get logo as base64 for embedding in PDF
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

export async function generateJobSheetPDF(input: JobSheetInput): Promise<Buffer> {
  const logoBase64 = getLogoBase64();

  // Build pay breakdown string
  const payBreakdown = input.hourlyRate && input.estimatedHours
    ? `$${input.hourlyRate}/hr x ${input.estimatedHours} hrs = $${input.payAmount.toFixed(0)}`
    : `$${input.payAmount.toFixed(0)}`;

  // Parse tasks into array
  const tasks = input.tasksDescription
    ? input.tasksDescription.split('\n').filter(t => t.trim())
    : [];

  const pdfDocument = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with Logo */}
        <View style={styles.headerRow}>
          {logoBase64 && (
            <Image style={styles.logo} src={logoBase64} />
          )}
          <View style={styles.headerText}>
            <Text style={styles.businessName}>Accent Entertainment</Text>
            <Text style={styles.documentTitle}>Job Sheet</Text>
          </View>
        </View>

        {/* Event Details Box */}
        <View style={styles.eventBox}>
          <Text style={styles.eventName}>{input.eventName || 'Event'}</Text>
          <Text style={styles.eventDetail}>
            DATE: {formatDate(input.eventDate)}{input.eventTime ? `, ${formatTime(input.eventTime)}` : ''}
          </Text>
          <Text style={styles.eventDetail}>LOCATION: {input.location || 'TBC'}</Text>
          <Text style={styles.eventDetail}>QUOTE #: {input.quoteNumber}</Text>
        </View>

        {/* Pay Box */}
        <View style={styles.payBox}>
          <Text style={styles.payLabel}>Your Pay</Text>
          <Text style={styles.payAmount}>{payBreakdown}</Text>
        </View>

        {/* Tasks Section */}
        {tasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Tasks</Text>
            <View style={styles.sectionContent}>
              {tasks.map((task, index) => (
                <Text key={index} style={styles.taskItem}>• {task.trim()}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Equipment List Section */}
        {input.equipment.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Equipment List</Text>
            <View style={styles.sectionContent}>
              {input.equipment.map((item, index) => (
                <View key={index}>
                  <View style={styles.equipmentRow}>
                    <Text style={styles.equipmentQty}>{item.quantity}x</Text>
                    <Text style={styles.equipmentName}>{item.name}</Text>
                  </View>
                  {item.notes && (
                    <Text style={styles.equipmentNotes}>{item.notes}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Event Details Section */}
        {(input.eventType || input.attendance || input.setupTime || input.indoorOutdoor || input.contentRequirements.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            <View style={styles.sectionContent}>
              {input.eventType && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{input.eventType}</Text>
                </View>
              )}
              {input.attendance && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Attendance:</Text>
                  <Text style={styles.detailValue}>{input.attendance}</Text>
                </View>
              )}
              {input.setupTime && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Setup Time:</Text>
                  <Text style={styles.detailValue}>{input.setupTime}</Text>
                </View>
              )}
              {input.indoorOutdoor && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Venue:</Text>
                  <Text style={styles.detailValue}>{input.indoorOutdoor}</Text>
                </View>
              )}
              {input.contentRequirements.length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Content:</Text>
                  <Text style={styles.detailValue}>{input.contentRequirements.join(', ')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Client Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Contact</Text>
          <View style={styles.clientBox}>
            <Text style={styles.clientName}>{input.clientName}</Text>
            <Text style={styles.clientDetail}>{input.clientPhone}</Text>
            <Text style={styles.clientDetail}>{input.clientEmail}</Text>
          </View>
        </View>

        {/* Notes Section */}
        {input.additionalNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{input.additionalNotes}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdfDocument);
  return buffer;
}
