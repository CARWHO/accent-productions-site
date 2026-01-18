# Barrie Feedback Implementation Plan

## Overview
Client feedback organized into implementation groups. Each group can be tackled independently.

---

## Group 1: Quick UI/Payment Changes ✅ COMPLETE
**Complexity: Low | Estimated items: 5**

### 1.1 Remove POLi Payment (add back later) ✅
- ✅ Removed POLi integration from `/approve` page
- ✅ Deleted `/api/initiate-poli`, `/api/poli-callback`, `/api/poli-webhook` routes
- ✅ Bank transfer is now only payment option

### 1.2 Focus on Bank Transfers Only ✅
- ✅ Simplified payment flow to bank transfer only
- ✅ `/approve` page shows bank details directly

### 1.3 Remove Forced Fields ✅
Made the following fields **optional** (not required):
- ✅ Start time
- ✅ End time
- ✅ Venue location
- ✅ Stage size (was already optional)

---

## Group 2: Contractor Experience & Job Sheet ✅ COMPLETE
**Complexity: Medium-High | Estimated items: 8**

### 2.1 Create `/review-jobsheet` Page (NEW) ✅
- ✅ Created `/review-jobsheet` page similar to `/review-quote`
- ✅ Preview what contractors will see
- ✅ Edit job sheet in Google Sheets ("Edit in Sheets" button)
- ✅ Add/edit job-specific details before notifying contractors
- ✅ "Select Contractors" button to proceed

**New workflow:**
```
Quote approved → /review-jobsheet → /select-contractors → Notify
```
- ✅ Updated `/api/client-approve` to send admin to `/review-jobsheet`

### 2.2 Show Time vs Call Time Clarification ✅
- ✅ **Show time** = Client's start/end time (when the actual event/performance runs)
- ✅ **Call time** = When contractor needs to arrive (pack-in time)
- ✅ **Pack-out time** = When contractor finishes tear-down
- ✅ Call time displayed prominently in RED in contractor emails
- ✅ All times editable on `/review-jobsheet` page

### 2.3 Room Availability Field ✅
- ✅ Added `room_available_from` field to database
- ✅ Editable on `/review-jobsheet` page
- ✅ Shows when venue becomes available for setup

### 2.4 Call Out Notes ✅
- ✅ Added `call_out_notes` field to database
- ✅ Editable on `/review-jobsheet` page
- ✅ Displayed in contractor notification email

### 2.5 Include Tech Rider in Contractor Email ✅
- ✅ Tech rider PDF attached to contractor notification email
- ✅ Only included if tech rider was uploaded

### 2.6 Band Information for Contractors ✅
- ✅ Added `band_names` field to database
- ✅ Editable on `/review-jobsheet` page
- ✅ Displayed in contractor notification email with "PERFORMING:" label

### 2.7 Contractor Reminder (2 weeks out) ✅
- ✅ Created `/api/cron/contractor-reminders` endpoint
- ✅ Sends reminder emails 2 weeks before event
- ✅ Includes job details, call time, location, notes

### 2.8 Vehicle Usage (per job) ✅
- ✅ Added `vehicle_type` field to database
- ✅ Options: personal, company_van, hire, admin_vehicle
- ✅ Dropdown selector on `/review-jobsheet` page

**NOTE:** Edge function `send-email-contractors` needs to be deployed:
```
npx supabase functions deploy send-email-contractors
```

---

## Group 3: Admin Features & Data Management ✅ COMPLETE
**Complexity: High | Estimated items: 6**

### 3.1 Contractor Search ✅
- ✅ Search/filter contractors in `/select-contractors` page
- ✅ Filter by name and role

### 3.2 Crew Count Per Event ✅
- ✅ Added `crew_count` field to bookings table
- ✅ Editable on `/review-jobsheet` page

### 3.3 Add to Calendar (Universal) ✅
- ✅ ICS file download for iOS Calendar, Outlook, etc.
- ✅ Created `/api/generate-ics` endpoint
- ✅ Added ICS download link in contractor emails

### 3.4 Historical Data / Event Archive ✅
- ✅ Created `/admin/events` page with filters
- ✅ Search, status filter, client filter, past/upcoming toggle
- ✅ Duplicate event button (placeholder)

### 3.5 Discussion/Review Section on Job Sheets ❌ REMOVED
- Removed at user request

### 3.6 Documentation ✅
- ✅ Created `USER-GUIDE.md` with full system documentation

---

## Deferred Items (Later)

### Add iPayroll Integration
- Payroll system integration
- To be scoped and implemented later

### Re-add POLi Payments
- Add back POLi payment option after bank transfer flow is solid

### Backline Image Updates
- Change backline general/hero image to a **drum kit**
- Add images for individual backline equipment items
- Add images for backline category headers

---

## Questions Still Open

1. **Discussion section** - Admin only, or can contractors comment too?
2. **Contractor reminder** - Email only, or SMS/other?
3. **Historical data** - What specific fields to track for client list?

---

## Suggested Implementation Order

1. **Group 1** first (quick wins, simplifies codebase)
2. **Group 2** second (core workflow improvements)
3. **Group 3** third (advanced features)
