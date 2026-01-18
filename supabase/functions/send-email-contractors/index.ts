// Supabase Edge Function: send-email-contractors
// Sends job offer emails to contractors with personalized job sheet PDFs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://accent-productions.co.nz";
const EDGE_FUNCTION_SECRET = Deno.env.get("EDGE_FUNCTION_SECRET") || "default-secret-change-me";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobSheetInput {
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  eventEndTime?: string | null;
  location: string;
  quoteNumber: string;
  contractorName: string;
  hourlyRate: number | null;
  estimatedHours: number | null;
  payAmount: number;
  tasksDescription: string | null;
  equipment: { name: string; quantity: number; notes?: string | null }[];
  eventType: string | null;
  attendance: string | null;
  setupTime?: string | null;
  indoorOutdoor: string | null;
  contentRequirements: string[];
  additionalNotes: string | null;
  venueContact?: string | null;
  hasStage?: boolean;
  stageDetails?: string | null;
  powerAccess?: string | null;
  wetWeatherPlan?: string | null;
  needsGenerator?: boolean;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  suggestedGear?: { item: string; quantity: number; notes?: string }[];
  executionNotes?: string[];
  // Group 2 fields
  callTime?: string | null;
  packOutTime?: string | null;
  roomAvailableFrom?: string | null;
  callOutNotes?: string | null;
  bandNames?: string | null;
}

type FolderType = "backline" | "fullsystem" | "soundtech";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null): string | null {
  if (!timeStr) return null;
  const cleanTime = timeStr.trim().toLowerCase();
  if (/^\d{1,2}(:\d{2})?\s*(am|pm)$/i.test(cleanTime)) {
    return timeStr.trim();
  }
  const match24 = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const mins = match24[2];
    const period = hours >= 12 ? "pm" : "am";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return mins === "00" ? `${hours}${period}` : `${hours}:${mins}${period}`;
  }
  return timeStr;
}

function getJobSheetFolderType(bookingType: string | null): FolderType {
  if (bookingType === "backline") return "backline";
  if (bookingType === "soundgear" || bookingType === "full_system") return "fullsystem";
  return "soundtech";
}

async function readJobSheetData(spreadsheetId: string): Promise<{ suggestedGear?: unknown[]; executionNotes?: string[] } | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/read-jobsheet-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify({ spreadsheetId }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function generateAndUploadJobSheet(
  jobSheetInput: JobSheetInput,
  filename: string,
  folderType: FolderType
): Promise<{ fileId: string; driveLink: string } | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/generate-upload-jobsheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
      body: JSON.stringify({ jobSheetInput, filename, folderType }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
}

async function sendEmail(to: string, subject: string, html: string, attachments?: EmailAttachment[]): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const emailPayload: Record<string, unknown> = {
      from: "Accent Productions <notifications@accent-productions.co.nz>",
      to: [to],
      subject,
      html,
    };

    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchTechRiderAttachment(fileId: string): Promise<EmailAttachment | null> {
  try {
    // Fetch from Google Drive via our API
    const response = await fetch(`${SITE_URL}/api/export-sheet-pdf?fileId=${fileId}&type=drive`, {
      headers: {
        Authorization: `Bearer ${EDGE_FUNCTION_SECRET}`,
      },
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    return {
      filename: "TechRider.pdf",
      content: base64,
    };
  } catch (error) {
    console.error("Error fetching tech rider:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, bookingId } = await req.json();

    if (!token || !bookingId) {
      return new Response(
        JSON.stringify({ message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch booking with inquiry
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, inquiries(form_data_json)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ message: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token
    if (booking.contractor_selection_token !== token && booking.approval_token !== token) {
      return new Response(
        JSON.stringify({ message: "Invalid token" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch pending assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from("booking_contractor_assignments")
      .select("*, contractors(*)")
      .eq("booking_id", bookingId)
      .eq("status", "pending");

    if (assignmentsError || !assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No assignments to notify" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get form data
    const inquiryData = booking.inquiries as { form_data_json: Record<string, unknown> } | null;
    const details = inquiryData?.form_data_json || booking.details_json || {};

    // Read from Google Sheet
    let suggestedGear: { item: string; quantity: number; notes?: string }[] | undefined;
    let executionNotes: string[] | undefined;

    if (booking.jobsheet_sheet_id) {
      const sheetData = await readJobSheetData(booking.jobsheet_sheet_id);
      if (sheetData) {
        suggestedGear = sheetData.suggestedGear as typeof suggestedGear;
        executionNotes = sheetData.executionNotes;
      }
    }

    // Get equipment with notes
    let equipmentWithNotes: { name: string; quantity: number; notes?: string | null }[] = [];
    if (details?.equipment && Array.isArray(details.equipment)) {
      const equipmentNames = (details.equipment as { name: string }[]).map(e => e.name);
      const { data: equipmentItems } = await supabase
        .from("equipment")
        .select("name, notes")
        .in("name", equipmentNames);

      equipmentWithNotes = (details.equipment as { name: string; quantity: number }[]).map(item => ({
        name: item.name,
        quantity: item.quantity,
        notes: equipmentItems?.find(e => e.name === item.name)?.notes || null,
      }));
    }

    // Fetch tech rider attachment if available
    let techRiderAttachment: EmailAttachment | null = null;
    if (booking.tech_rider_file_id) {
      techRiderAttachment = await fetchTechRiderAttachment(booking.tech_rider_file_id);
    }

    let notifiedCount = 0;

    for (const assignment of assignments) {
      const contractor = assignment.contractors;
      if (!contractor) continue;

      const assignmentToken = crypto.randomUUID();

      // Update assignment
      await supabase
        .from("booking_contractor_assignments")
        .update({
          assignment_token: assignmentToken,
          status: "notified",
          notified_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);

      const acceptUrl = `${SITE_URL}/api/contractor-respond?token=${assignmentToken}&action=accept`;
      const declineUrl = `${SITE_URL}/api/contractor-respond?token=${assignmentToken}&action=decline`;

      // Build pay breakdown
      const hourlyRate = Number(assignment.hourly_rate) || 0;
      const hours = Number(assignment.estimated_hours) || 0;
      const totalPay = Number(assignment.pay_amount) || (hourlyRate * hours);
      const payBreakdown = hourlyRate && hours
        ? `$${hourlyRate}/hr × ${hours} hrs = $${totalPay.toFixed(0)}`
        : `$${totalPay.toFixed(0)}`;

      // Build content requirements
      const contentRequirements: string[] = [];
      if (details?.contentRequirements && Array.isArray(details.contentRequirements)) {
        contentRequirements.push(...(details.contentRequirements as string[]));
      }
      if (details?.hasDJ) contentRequirements.push("DJ");
      if (details?.hasBand) contentRequirements.push("Live Band");
      if (details?.hasLiveMusic) contentRequirements.push("Live Music");
      if (details?.hasSpeeches) contentRequirements.push("Speeches/Presentations");
      if (details?.needsMic) contentRequirements.push("Microphone Required");
      if (details?.playbackFromDevice) contentRequirements.push("Playback from Device");

      // Generate job sheet
      const jobSheetInput: JobSheetInput = {
        eventName: booking.event_name || "Event",
        eventDate: booking.event_date,
        eventTime: booking.event_time,
        eventEndTime: (details?.eventEndTime as string) || null,
        location: booking.location || "TBC",
        quoteNumber: booking.quote_number || "",
        contractorName: contractor.name,
        hourlyRate: hourlyRate || null,
        estimatedHours: hours || null,
        payAmount: totalPay,
        tasksDescription: assignment.tasks_description || null,
        equipment: equipmentWithNotes,
        eventType: (details?.eventType as string) || null,
        attendance: (details?.attendance as string) || null,
        setupTime: (details?.setupTime as string) || null,
        indoorOutdoor: (details?.indoorOutdoor as string) || null,
        contentRequirements,
        additionalNotes: (details?.additionalNotes as string) || (details?.additionalInfo as string) || null,
        venueContact: (details?.venueContact as string) || null,
        hasStage: (details?.hasStage as boolean) || false,
        stageDetails: (details?.stageDetails as string) || null,
        powerAccess: (details?.powerAccess as string) || null,
        wetWeatherPlan: (details?.wetWeatherPlan as string) || null,
        needsGenerator: (details?.needsGenerator as boolean) || false,
        clientName: booking.client_name,
        clientPhone: booking.client_phone || "",
        clientEmail: booking.client_email,
        suggestedGear,
        executionNotes,
        // Group 2 fields
        callTime: booking.call_time || null,
        packOutTime: booking.pack_out_time || null,
        roomAvailableFrom: booking.room_available_from || null,
        callOutNotes: booking.call_out_notes || null,
        bandNames: booking.band_names || (details?.bandNames as string) || null,
      };

      let jobSheetDriveLink: string | null = null;
      let jobSheetDriveFileId: string | null = null;

      const filename = `JobSheet-${booking.quote_number || "Job"}-${contractor.name.split(" ")[0]}.pdf`;
      const folderType = getJobSheetFolderType(booking.booking_type);

      const uploadResult = await generateAndUploadJobSheet(jobSheetInput, filename, folderType);
      if (uploadResult) {
        jobSheetDriveFileId = uploadResult.fileId;
        jobSheetDriveLink = uploadResult.driveLink;

        await supabase
          .from("booking_contractor_assignments")
          .update({ jobsheet_drive_file_id: jobSheetDriveFileId })
          .eq("id", assignment.id);
      }

      // Build email HTML
      let gearListHtml = "";
      if (details?.equipment && Array.isArray(details.equipment)) {
        const gearItems = (details.equipment as { name: string; quantity: number }[])
          .map(item => `<li>${item.quantity}x ${item.name}</li>`)
          .join("");
        gearListHtml = `
          <div style="margin: 15px 0;">
            <strong style="color: #374151;">GEAR:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #4b5563;">${gearItems}</ul>
          </div>
        `;
      }

      const eventDetailItems: string[] = [];
      if (details?.eventType) eventDetailItems.push(`Type: ${details.eventType}`);
      if (details?.package) eventDetailItems.push(`Package: ${details.package}`);
      if (details?.attendance) eventDetailItems.push(`Attendance: ${details.attendance}`);
      if (details?.setupTime) eventDetailItems.push(`Setup: ${details.setupTime}`);
      if (details?.indoorOutdoor) eventDetailItems.push(`Environment: ${details.indoorOutdoor}`);
      if (details?.hasStage || details?.stageDetails) {
        eventDetailItems.push(`Stage: ${details.stageDetails || (details.hasStage ? "Yes" : "No")}`);
      }
      if (contentRequirements.length > 0) {
        eventDetailItems.push(`Content: ${contentRequirements.join(", ")}`);
      }
      if (details?.powerAccess) eventDetailItems.push(`Power: ${details.powerAccess}`);
      if (details?.needsGenerator) eventDetailItems.push(`Generator: Required`);
      if (details?.wetWeatherPlan) eventDetailItems.push(`Wet Weather: ${details.wetWeatherPlan}`);

      const eventDetailsHtml = eventDetailItems.length > 0
        ? `<div style="margin: 15px 0;">
            <strong style="color: #374151;">EVENT DETAILS:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #4b5563;">
              ${eventDetailItems.map(item => `<li>${item}</li>`).join("")}
            </ul>
          </div>`
        : "";

      const venueContactHtml = details?.venueContact
        ? `<div style="background: #f1f5f9; border-radius: 8px; padding: 12px 15px; margin: 15px 0; font-size: 14px;">
            <strong>VENUE CONTACT:</strong> ${details.venueContact}
          </div>`
        : "";

      const tasksHtml = assignment.tasks_description
        ? `<div style="margin: 15px 0;">
            <strong style="color: #374151;">YOUR TASKS:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #4b5563;">
              ${assignment.tasks_description.split("\n").filter((t: string) => t.trim()).map((task: string) => `<li>${task.trim()}</li>`).join("")}
            </ul>
          </div>`
        : "";

      // Call out notes section
      const callOutNotesHtml = jobSheetInput.callOutNotes
        ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 15px; margin: 15px 0; font-size: 14px;">
            <strong>NOTES:</strong> ${jobSheetInput.callOutNotes}
          </div>`
        : "";

      // Build time display with call time prominently featured
      let timeDisplay = formatTime(booking.event_time) ? `Show: ${formatTime(booking.event_time)}` : "";
      if (jobSheetInput.callTime) {
        timeDisplay = `<strong style="color: #dc2626;">Call: ${formatTime(jobSheetInput.callTime)}</strong>` +
          (timeDisplay ? ` | ${timeDisplay}` : "");
      }
      if (jobSheetInput.packOutTime) {
        timeDisplay += timeDisplay ? ` | Pack-out: ${formatTime(jobSheetInput.packOutTime)}` : `Pack-out: ${formatTime(jobSheetInput.packOutTime)}`;
      }

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
          <div style="margin-bottom: 24px;">
            <img src="${SITE_URL}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
          </div>

          <h1 style="color: #16a34a; margin: 0 0 20px 0;">Job Offer</h1>

          <p>Hi ${contractor.name.split(" ")[0]},</p>
          <p>You've been offered a gig! Please review the details below and respond.</p>

          <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 20px 0;">
            <div style="margin-bottom: 15px;">
              <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px;">YOUR OFFER</div>
              <div style="font-size: 32px; font-weight: bold; color: #15803d; margin: 8px 0;">${payBreakdown}</div>
            </div>
            <div style="border-top: 1px solid #bbf7d0; padding-top: 15px; font-size: 15px;">
              <div style="margin-bottom: 8px;">
                <strong>DATE:</strong> ${formatDate(booking.event_date)}
              </div>
              ${timeDisplay ? `<div style="margin-bottom: 8px;">${timeDisplay}</div>` : ""}
              <div><strong>LOCATION:</strong> ${booking.location || "TBC"}</div>
            </div>
          </div>

          ${jobSheetDriveLink ? `
          <div style="margin: 20px 0; text-align: center;">
            <a href="${jobSheetDriveLink}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              VIEW JOB SHEET
            </a>
          </div>
          ` : ""}

          ${tasksHtml}
          ${gearListHtml}
          ${eventDetailsHtml}
          ${callOutNotesHtml}
          ${venueContactHtml}

          <div style="background: #f8fafc; border-radius: 8px; padding: 12px 15px; margin: 20px 0; font-size: 14px;">
            <strong>CLIENT:</strong> ${booking.client_name}${booking.client_phone ? ` | ${booking.client_phone}` : ""}
          </div>

          <div style="margin: 30px 0;">
            <a href="${acceptUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 16px 50px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; margin-right: 12px;">ACCEPT</a>
            <a href="${declineUrl}" style="display: inline-block; background: #dc2626; color: #fff; padding: 16px 50px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">DECLINE</a>
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">Please respond ASAP so we can finalize the booking.</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px 0;">Add to your calendar (if you accept):</p>
            <a href="${SITE_URL}/api/generate-ics?token=${token}" style="display: inline-block; background: #6b7280; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 13px;">
              Download .ics
            </a>
            <span style="font-size: 11px; color: #9ca3af; margin-left: 8px;">Works with Outlook, Apple Calendar, etc.</span>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
          <p style="color: #999; font-size: 12px;">Accent Productions | Professional Sound & Lighting</p>
        </div>
      `;

      // Build attachments array
      const attachments: EmailAttachment[] = [];
      if (techRiderAttachment) {
        attachments.push(techRiderAttachment);
      }

      await sendEmail(
        contractor.email,
        `Job Offer: ${formatDate(booking.event_date)} - ${payBreakdown}`,
        emailHtml,
        attachments.length > 0 ? attachments : undefined
      );
      notifiedCount++;
    }

    // Update booking status
    await supabase
      .from("bookings")
      .update({
        status: "contractors_notified",
        contractors_notified_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    return new Response(
      JSON.stringify({ success: true, notifiedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-email-contractors] Error:", error);
    return new Response(
      JSON.stringify({ message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
