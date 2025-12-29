# Quote & Jobsheet Template Import Instructions

## Quote Template Files
- `quote-template-data.csv` - Data tab (populated by API)
- `quote-template-lineitems.csv` - LineItems tab (editable costs)
- `quote-template-quote.csv` - Quote tab (formatted view for PDF export)
- `quote-template-price-catalog.csv` - Price Catalog (reference prices)

## Jobsheet Template Files
- `jobsheet-template-event-data.csv` - Event Data tab (populated by API)
- `jobsheet-template-equipment.csv` - Equipment tab (gear list)
- `jobsheet-template-crew.csv` - Crew tab (contractor assignments)
- `jobsheet-template-jobsheet.csv` - Job Sheet tab (formatted view for PDF)

---

## How to Import Quote Template

### Step 1: Create New Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Click **Blank** to create new spreadsheet
3. Name it "Quote Template - Full System" (or Backline/Sound Tech)

### Step 2: Import Each Tab

**Tab 1: Data**
1. Rename "Sheet1" to "Data"
2. File > Import > Upload > select `quote-template-data.csv`
3. Choose "Replace current sheet"

**Tab 2: LineItems**
1. Click + to add new sheet, rename to "LineItems"
2. File > Import > Upload > select `quote-template-lineitems.csv`
3. Choose "Replace current sheet"

**Tab 3: Quote**
1. Click + to add new sheet, rename to "Quote"
2. File > Import > Upload > select `quote-template-quote.csv`
3. Choose "Replace current sheet"
4. **Important:** Column A formulas will import as text - re-enter them as formulas

**Tab 4: Price Catalog**
1. Click + to add new sheet, rename to "Price Catalog"
2. File > Import > Upload > select `quote-template-price-catalog.csv`
3. Choose "Replace current sheet"
4. Right-click tab > Hide sheet (optional)

### Step 3: Format the Quote Tab
1. Select the Quote tab
2. Add your logo image in cell A1-A3 (Insert > Image > Image in cell)
3. Merge cells for header rows
4. Apply formatting:
   - Bold headers
   - Right-align cost column
   - Add borders to line items table
   - Set print area

### Step 4: Get Template ID
1. Copy the URL: `https://docs.google.com/spreadsheets/d/XXXXXX/edit`
2. The ID is the `XXXXXX` part
3. Add to your `.env`:
   ```
   GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID=XXXXXX
   GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID=XXXXXX
   GOOGLE_SOUNDTECH_QUOTE_TEMPLATE_ID=XXXXXX
   ```

---

## How to Import Jobsheet Template

### Step 1: Create New Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Click **Blank** to create new spreadsheet
3. Name it "Jobsheet Template - Full System" (or Backline/Sound Tech)

### Step 2: Import Each Tab

**Tab 1: Event Data**
1. Rename "Sheet1" to "Event Data"
2. File > Import > Upload > select `jobsheet-template-event-data.csv`
3. Choose "Replace current sheet"

**Tab 2: Equipment**
1. Click + to add new sheet, rename to "Equipment"
2. File > Import > Upload > select `jobsheet-template-equipment.csv`
3. Choose "Replace current sheet"

**Tab 3: Crew**
1. Click + to add new sheet, rename to "Crew"
2. File > Import > Upload > select `jobsheet-template-crew.csv`
3. Choose "Replace current sheet"

**Tab 4: Job Sheet**
1. Click + to add new sheet, rename to "Job Sheet"
2. File > Import > Upload > select `jobsheet-template-jobsheet.csv`
3. Choose "Replace current sheet"
4. **Important:** Formulas will import as text - re-enter them as formulas

### Step 3: Format the Job Sheet Tab
1. Select the Job Sheet tab
2. Add your logo if desired
3. Apply formatting:
   - Bold section headers (EVENT DETAILS, SCHEDULE, etc.)
   - Add borders to tables
   - Set print area for single page

### Step 4: Get Template ID
1. Copy the URL: `https://docs.google.com/spreadsheets/d/XXXXXX/edit`
2. The ID is the `XXXXXX` part
3. Add to your `.env`:
   ```
   GOOGLE_FULLSYSTEM_JOBSHEET_TEMPLATE_ID=XXXXXX
   GOOGLE_BACKLINE_JOBSHEET_TEMPLATE_ID=XXXXXX
   GOOGLE_SOUNDTECH_JOBSHEET_TEMPLATE_ID=XXXXXX
   ```

---

## How It Works

### Quote Flow
1. API copies Quote template
2. Populates `Data` tab with client info
3. Populates `LineItems` tab with quote items
4. `Quote` tab auto-updates via formulas
5. Admin can edit `LineItems` directly in Google Sheets
6. Export `Quote` tab as PDF when sending to client

### Jobsheet Flow
1. API copies Jobsheet template
2. Populates `Event Data` tab with event info
3. Populates `Equipment` tab with gear list
4. Admin fills in `Crew` tab with contractor assignments
5. `Job Sheet` tab auto-updates via formulas
6. Export `Job Sheet` tab as PDF for the event

---

## Environment Variables Summary

```env
# Quote Templates (one per folder type)
GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID=
GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID=
GOOGLE_SOUNDTECH_QUOTE_TEMPLATE_ID=

# Jobsheet Templates (one per folder type)
GOOGLE_FULLSYSTEM_JOBSHEET_TEMPLATE_ID=
GOOGLE_BACKLINE_JOBSHEET_TEMPLATE_ID=
GOOGLE_SOUNDTECH_JOBSHEET_TEMPLATE_ID=

# Destination Folders (already configured)
GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID=
GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID=
GOOGLE_DRIVE_SOUND_TECH_QUOTES_FOLDER_ID=
GOOGLE_DRIVE_FULL_SYSTEM_JOBSHEET_FOLDER_ID=
GOOGLE_DRIVE_BACKLINE_JOBSHEET_FOLDER_ID=
GOOGLE_DRIVE_SOUND_TECH_JOBSHEET_FOLDER_ID=
```
