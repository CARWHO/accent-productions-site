# Accent Productions - User Guide

This guide documents the Accent Productions booking and event management system.

---

## System Overview

The Accent Productions system manages the complete lifecycle of audio/visual events:

1. **Client Inquiry** - Clients submit requests through the website
2. **Quote Generation** - Admin reviews and creates quotes
3. **Client Approval** - Clients review and approve quotes
4. **Contractor Assignment** - Admin notifies and assigns contractors
5. **Job Sheet Management** - Detailed event planning and coordination
6. **Event Execution** - Calendar integration and day-of logistics

---

## Workflow Guide

### 1. Client Inquiry

Clients can submit inquiries through three channels:
- **Sound Gear Hire** (`/inquiry/soundgear`) - Equipment rental requests
- **Backline Hire** (`/inquiry/backline`) - Musical instrument/amp rentals
- **Contractor Booking** (`/inquiry/contractor`) - Staff/technician requests

Each inquiry captures:
- Event details (date, time, location)
- Client information (name, email, phone)
- Specific requirements and equipment needs

### 2. Review Quote (`/review-quote`)

Access via: Email link or direct URL with token

**Admin Actions:**
- Review client requirements
- Adjust line items and pricing
- Add/remove equipment or services
- Set quote expiry date
- **Send to Client** - Emails quote PDF to client

### 3. Client Approval (`/client-approval`)

Access via: Email link sent to client

**Client Actions:**
- Review quote details and pricing
- Accept or request changes
- Provide digital approval

### 4. Select Contractors (`/select-contractors`)

Access via: Token-based URL after client approval

**Features:**
- View all available contractors
- Filter by role/specialty
- Search by name
- Select multiple contractors for notification
- **Notify Selected** - Sends job offers to contractors

### 5. Contractor Response (`/contractor-response`)

Access via: Email link sent to contractors

**Contractor Actions:**
- View job details (date, time, location, pay rate)
- Accept or decline the job
- Add to calendar (Google Calendar or download .ics file)

### 6. Job Sheet Management (`/review-jobsheet`)

Access via: Token-based URL for admin

**Key Fields:**
- **Call Time** - When contractors should arrive
- **Pack Out Time** - Expected end time
- **Room Available From** - Venue access time
- **Crew Count** - Number of staff needed
- **Vehicle Type** - Transport requirements (Van, Car, Truck, etc.)
- **Band Names** - Performing artists
- **Call Out Notes** - Special instructions for crew

**Contractor Status:**
- View which contractors have been notified
- See who has accepted/declined
- Identify pending responses

### 7. Accept Job (`/accept-job`)

When contractors accept a job:
- Confirmation email is sent
- Google Calendar link provided
- .ics file download available
- Tech rider attached (if applicable)

---

## Admin Features

### Event Archive (`/admin/events`)

Central dashboard for all bookings:

**Filters:**
- Search by event name, client, or quote number
- Filter by status (Pending, Quote Sent, Approved, etc.)
- Filter by client
- Toggle past/upcoming events

**Status Summary:**
- Quick view of booking counts by status
- Click status cards to filter

**Actions:**
- View job sheets for approved events
- Duplicate events for recurring bookings

### Quote Management

**Quote Numbers:** Auto-generated in format `YYYY-XXXX`

**Quote Documents:**
- PDF quotes generated for clients
- Excel spreadsheets for detailed pricing
- Job sheets for contractors

---

## Email Notifications

The system sends automated emails at key points:

| Event | Recipient | Contents |
|-------|-----------|----------|
| Quote Ready | Client | Quote PDF, approval link |
| Quote Approved | Admin | Notification, next steps link |
| Job Offer | Contractor | Job details, accept/decline links |
| Job Accepted | Contractor | Confirmation, calendar links, tech rider |
| Job Declined | Admin | Notification |

---

## Calendar Integration

**Google Calendar:**
- Direct "Add to Google Calendar" links in emails
- Pre-filled event details

**Universal Calendar (.ics):**
- Download .ics file for any calendar app
- Works with Outlook, Apple Calendar, etc.
- Available via `/api/generate-ics?token=XXX`

---

## Database Tables

Key tables in the system:

| Table | Purpose |
|-------|---------|
| `bookings` | Main event/booking records |
| `booking_line_items` | Quote line items and pricing |
| `contractors` | Contractor profiles and contact info |
| `booking_contractors` | Contractor assignments and status |
| `audio_equipment` | Equipment inventory |

---

## API Endpoints

### Public Endpoints
- `POST /api/inquiry/*` - Submit inquiries
- `GET /api/client-approve` - Client approval page data
- `POST /api/client-approve` - Submit client approval

### Admin Endpoints
- `GET /api/admin/events` - Fetch all events with filters
- `GET /api/review-quote` - Get quote details
- `POST /api/send-to-client` - Send quote to client
- `GET /api/review-jobsheet` - Get job sheet details
- `POST /api/review-jobsheet` - Update job sheet
- `POST /api/notify-contractors` - Send job offers

### Contractor Endpoints
- `GET /api/contractor-response` - Get job offer details
- `POST /api/accept-job` - Accept a job
- `POST /api/decline-job` - Decline a job

### Utility Endpoints
- `GET /api/generate-ics` - Download calendar file

---

## Troubleshooting

### Common Issues

**"Token not found" errors:**
- Tokens expire or may be invalid
- Check the booking still exists in the database

**Emails not sending:**
- Verify Resend API key is configured
- Check Supabase edge functions are deployed
- Review function logs for errors

**Quote PDF not generating:**
- Ensure all required fields are filled
- Check for special characters in text fields

### Checking Logs

1. Vercel Dashboard → Project → Functions tab
2. Supabase Dashboard → Edge Functions → Logs
3. Browser console for client-side errors

---

## Deployment Notes

### Supabase Edge Functions

After making changes to edge functions, deploy with:

```bash
npx supabase functions deploy send-email-contractors
npx supabase functions deploy generate-sheets
# ... other functions as needed
```

### Migrations

Database migrations are in `supabase/migrations/`. Apply new migrations through the Supabase dashboard or CLI.

### Environment Variables

Required in `.env`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

---

## Quick Reference

| Task | URL Pattern |
|------|-------------|
| Review Quote | `/review-quote?token=XXX` |
| Client Approval | `/client-approval?token=XXX` |
| Select Contractors | `/select-contractors?token=XXX` |
| Contractor Response | `/contractor-response?token=XXX` |
| Job Sheet | `/review-jobsheet?token=XXX` |
| Event Archive | `/admin/events` |

---

*Last updated: January 2026*
