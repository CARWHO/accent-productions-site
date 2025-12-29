import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';

export interface JobSheetInput {
  // Event info (from bookings)
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  eventEndTime?: string | null;
  location: string;
  quoteNumber: string;

  // Contractor assignment
  contractorName: string;
  hourlyRate: number | null;
  estimatedHours: number | null;
  payAmount: number;
  tasksDescription: string | null;

  // AI-generated execution notes (used for initial job sheet before contractor assignment)
  executionNotes?: string[];

  // Equipment (from details_json - confirmed equipment after assignment)
  equipment: Array<{ name: string; quantity: number; notes?: string | null }>;

  // AI-suggested gear (for initial job sheet)
  suggestedGear?: Array<{ item: string; quantity: number; notes?: string; matchedInInventory?: boolean }>;

  // Items that don't match available inventory
  unavailableGear?: string[];

  // Event details (from details_json)
  eventType: string | null;
  attendance: string | null;
  setupTime?: string | null;
  indoorOutdoor: string | null;
  contentRequirements: string[];
  additionalNotes: string | null;

  // Venue details
  venueContact?: string | null;
  hasStage?: boolean;
  stageDetails?: string | null;
  powerAccess?: string | null;
  wetWeatherPlan?: string | null;
  needsGenerator?: boolean;

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
  // Suggested gear section
  suggestedHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1 solid #e5e5e5',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  suggestedLabel: {
    fontSize: 8,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  // Unavailable gear section (red warning)
  unavailableBox: {
    backgroundColor: '#fef2f2',
    border: '2 solid #dc2626',
    padding: 12,
    borderRadius: 4,
    marginBottom: 15,
  },
  unavailableTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 6,
  },
  unavailableLabel: {
    fontSize: 8,
    color: '#991b1b',
    marginBottom: 6,
  },
  unavailableItem: {
    fontSize: 10,
    color: '#dc2626',
    marginBottom: 3,
  },
  // Suggested gear with unavailable marker
  equipmentUnavailable: {
    flex: 1,
    fontSize: 10,
    color: '#dc2626',
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

  // Build pay breakdown string (only show if payAmount > 0, i.e., contractor assigned)
  const showPayBox = input.payAmount > 0;
  const payBreakdown = input.hourlyRate && input.estimatedHours
    ? `$${input.hourlyRate}/hr x ${input.estimatedHours} hrs = $${input.payAmount.toFixed(0)}`
    : `$${input.payAmount.toFixed(0)}`;

  // Use execution notes from AI, or parse tasksDescription as fallback
  const tasks = input.executionNotes && input.executionNotes.length > 0
    ? input.executionNotes
    : input.tasksDescription
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
            DATE: {formatDate(input.eventDate)}
            {input.eventTime ? `, ${formatTime(input.eventTime)}` : ''}
            {input.eventEndTime ? ` - ${formatTime(input.eventEndTime)}` : ''}
          </Text>
          <Text style={styles.eventDetail}>LOCATION: {input.location || 'TBC'}</Text>
          {input.venueContact && (
            <Text style={styles.eventDetail}>VENUE CONTACT: {input.venueContact}</Text>
          )}
          <Text style={styles.eventDetail}>QUOTE #: {input.quoteNumber}</Text>
        </View>

        {/* Pay Box - only show when contractor is assigned */}
        {showPayBox && (
          <View style={styles.payBox}>
            <Text style={styles.payLabel}>Your Pay</Text>
            <Text style={styles.payAmount}>{payBreakdown}</Text>
          </View>
        )}

        {/* Tasks / Execution Notes Section */}
        {tasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {input.executionNotes && input.executionNotes.length > 0 ? 'Execution Notes' : 'Your Tasks'}
            </Text>
            <View style={styles.sectionContent}>
              {tasks.map((task, index) => (
                <Text key={index} style={styles.taskItem}>• {task.trim()}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Unavailable Gear Warning Section - for initial job sheets */}
        {input.unavailableGear && input.unavailableGear.length > 0 && (
          <View style={styles.unavailableBox}>
            <Text style={styles.unavailableTitle}>⚠ Gear Requiring Attention</Text>
            <Text style={styles.unavailableLabel}>
              These items were suggested but do NOT exactly match available inventory:
            </Text>
            {input.unavailableGear.map((item, index) => (
              <Text key={index} style={styles.unavailableItem}>• {item}</Text>
            ))}
          </View>
        )}

        {/* Suggested Gear Section - for initial job sheets */}
        {input.suggestedGear && input.suggestedGear.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.suggestedHeader}>Suggested Gear</Text>
            <Text style={styles.suggestedLabel}>Based on event requirements - confirm before booking</Text>
            <View style={styles.sectionContent}>
              {input.suggestedGear.map((item, index) => (
                <View key={index}>
                  <View style={styles.equipmentRow}>
                    <Text style={styles.equipmentQty}>{item.quantity}x</Text>
                    <Text style={item.matchedInInventory === false ? styles.equipmentUnavailable : styles.equipmentName}>
                      {item.item}{item.matchedInInventory === false ? ' ⚠' : ''}
                    </Text>
                  </View>
                  {item.notes && (
                    <Text style={styles.equipmentNotes}>{item.notes}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Equipment List Section - for confirmed equipment */}
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
        {(input.eventType || input.attendance || input.setupTime || input.indoorOutdoor || input.contentRequirements.length > 0 || input.hasStage || input.powerAccess || input.wetWeatherPlan || input.needsGenerator) && (
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
              {(input.hasStage || input.stageDetails) && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Stage:</Text>
                  <Text style={styles.detailValue}>
                    {input.stageDetails || (input.hasStage ? 'Yes' : 'No')}
                  </Text>
                </View>
              )}
              {input.powerAccess && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Power Access:</Text>
                  <Text style={styles.detailValue}>{input.powerAccess}</Text>
                </View>
              )}
              {input.needsGenerator && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Generator:</Text>
                  <Text style={styles.detailValue}>Required</Text>
                </View>
              )}
              {input.wetWeatherPlan && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Wet Weather:</Text>
                  <Text style={styles.detailValue}>{input.wetWeatherPlan}</Text>
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
