# Convenience Store Command Center

A full-stack Next.js dashboard for convenience store owners to track daily sales, expenses, fuel, lottery, deli / hot food, payroll, and profit.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Recharts
- Electron + Electron Builder for the Windows desktop launcher

## Features

- Supabase login, signup, password reset, email verification handling, and server-side protected routes
- Row-level security so each user only sees their own store data
- Role-ready profile/store structure for owner, manager, employee, and accountant access
- Multi-store switcher with create/edit store settings
- Dashboard with sales, gross profit, net profit estimate, fuel profit, lottery profit, deli sales, expenses, payroll, best/worst categories, and charts
- Add, edit, delete, and date-filter entries for:
  - Daily sales
  - Bulk monthly entry
  - Expenses
  - Fuel tracking
  - Lottery tracking
  - Deli / hot food tracking
  - Payroll
- Inventory CRUD with SKU/barcode search, category filters, margin, quantity, reorder levels, and low-stock alerts
- Vendor CRUD with contacts, products supplied, average weekly spend, and recorded spend
- Employee roster with roles, standard hourly rates, contact details, and active status
- Weekly and monthly payroll summaries with a $2,500 weekly planning benchmark
- Monthly P&L report with CSV export
- Bulk Entry page for 30-31 day spreadsheet-style monthly entry, CSV import, CSV template download, validation preview, duplicate-date detection, and optional overwrite
- Mobile-friendly sidebar navigation
- Loading states and error handling
- Live Supabase-backed data on every dashboard, report, import, and settings page
- Profit Leak Finder alerts for high expenses, low fuel margin, deli waste, payroll drag, vendor increases, and low-margin days
- Smart Import for PDF, Excel, and CSV files with editable review before saving
- POS Integrations for flexible CSV imports from Gilbarco Passport, Verifone Commander, NCR Counterpoint, Square, Clover, Lightspeed, Shopify POS, Toast, Shift4, Heartland, CStoreOffice / Petrosoft, PDI, and NCR / Radiant
- POS column mapping templates, duplicate handling, import history, payment breakdowns, department sales, fuel gallons/sales, tax/fees, discounts, refunds, voids, and unmapped/error reports
- Cash Reconciliation for drawer cash, drops, paid-outs, lottery payouts, POS/card batch matching, bank deposits, over/short alerts, and unreconciled-day reporting
- Fuel Reconciliation for grade setup, deliveries, tank readings, sold gallons from POS/manual data, book-vs-actual inventory, variance alerts, rack cost, target margin, and suggested pricing
- Product-level sales tracking with SKU/UPC, quantity, cost, retail, gross profit, margin, category, vendor, and date
- Product Sales Breakdown, Vendor Spend, and Category Profit reports
- Docker, Vercel, VS Code launch/tasks, Windows startup scripts, and Electron desktop packaging

## Installation

```bash
npm install
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
# Preferred for new Supabase projects. NEXT_PUBLIC_SUPABASE_ANON_KEY is still supported.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is only needed for server-side maintenance scripts such as `npm run seed`. Never expose it in client-side code or public hosting logs.

Supabase values are required. If they are missing, the app shows a configuration error and does not load fallback data.

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

On Windows, you can also double-click:

```text
start.bat
```

Or run PowerShell:

```bash
./start.ps1
```

Both startup scripts check for Node.js, install dependencies if `node_modules` is missing, open the browser, and start the dev server.

## VS Code

This repo includes:

- `.vscode/launch.json`
  - Launch Next.js development server
  - Debug Next.js server
  - Debug Chrome browser
  - Full-stack debugging compound
- `.vscode/tasks.json`
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
  - `npm run test`

> Note: Next.js 16 removed the old `next lint` command. The project uses ESLint directly through `npm run lint`.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. In Authentication settings, enable email/password auth.
4. Copy your project URL and anon key into `.env.local`.
5. Start the app and sign up.

The app automatically creates a profile in `public.users` and a default store for each authenticated user.

Re-run `supabase/schema.sql` after pulling schema changes. The schema uses repeatable `if not exists` statements and replaces policies/triggers safely so an existing project can be upgraded in place.

### Auth, roles, and multi-store setup

The app uses Supabase SSR middleware to protect `/dashboard`, `/daily-sales`, `/bulk-entry`, `/inventory`, `/vendors`, `/expenses`, `/cash-reconciliation`, `/smart-import`, `/pos-integrations`, `/fuel`, `/lottery`, `/deli`, `/payroll`, `/employees`, `/reports`, and `/settings`. Unauthenticated users are redirected to `/login` before protected pages render.

`supabase/schema.sql` adds `users.role`, `users.selected_store_id`, and `store_members`.

Roles are stored as `owner`, `manager`, `employee`, or `accountant` so stricter permissions can be layered in without changing the profile model. Store owners can create additional stores from Settings and switch the active store from the sidebar.

### Cash reconciliation

Open `Cash Reconciliation` from the sidebar to save one reconciliation per store/date. The page tracks starting drawer cash, ending cash, expected cash sales, drops, paid-outs, lottery payouts, POS/card batch totals, EBT, gift card, other tender, bank deposit amount, status, and notes.

Use `Pull expected totals` to pull cash/card/tender values from saved Daily Sales and POS imports for the selected date. The page calculates expected ending cash, cash variance, card batch mismatch, and balanced/needs-review status. Dashboard and Reports show unreconciled days, cash over/short, and card mismatch totals.

### Fuel reconciliation

Open `Fuel Reconciliation` from the sidebar.

The page supports:

- Regular, Midgrade, Premium, Diesel, and custom fuel grades
- daily beginning and ending tank readings by grade
- delivery gallons and rack cost by grade
- sold gallons pulled from POS imports first, then manual Fuel Tracking entries
- book inventory, actual inventory, variance, and variance alerts
- retail price, target margin, actual margin, and suggested price

Saving a reconciliation also stores matching delivery and tank reading records. Dashboard and Reports show fuel variance alerts, total gallon variance, and low-margin grade counts.

### Bulk Entry schema notes

`supabase/schema.sql` adds these monthly-entry columns to `daily_sales`:

- `hot_food_sales`
- `cash_total`
- `card_total`
- `expenses`
- `payroll`
- generated `fuel_margin`
- generated `fuel_profit`
- generated `total_sales`
- generated `gross_profit`
- generated `net_profit_estimate`

It also adds a unique index on `(user_id, store_id, date)` so `/bulk-entry` can prevent duplicate dates by default and safely overwrite existing daily sales when requested.

`monthly_totals` is a separate month-level table with one row per `(user_id, store_id, year, month)`. It includes generated columns for total sales, total expenses, fuel margin, fuel profit, gross profit, estimated net profit, expense percentage, gross margin, and net margin. The schema enables RLS and grants authenticated CRUD for the table so it is available through Supabase's Data API on newer projects.

### Optional SQL seed data

After signing up once, copy your user ID from Supabase Authentication > Users.

Edit `supabase/seed.sql` and replace:

```sql
00000000-0000-0000-0000-000000000000
```

with your auth user ID, then run the seed script in the Supabase SQL editor.

### TypeScript seed script

You can also seed from the command line:

```bash
SEED_USER_ID=your-auth-user-id npm run seed
```

The script creates seeded:

- Sales
- Expenses
- Fuel data
- Payroll data
- Inventory items, including low-stock examples
- Vendors, including Capital Candy
- Employees with owner, manager, and cashier roles

It also intentionally includes a few anomalies so the Profit Leak Finder has alerts to display.

## Database tables

The schema creates:

- `users`
- `stores`
- `store_members`
- `daily_sales`
- `monthly_totals`
- `cash_reconciliations`
- `expenses`
- `fuel_entries`
- `fuel_grades`
- `fuel_deliveries`
- `fuel_tank_readings`
- `fuel_reconciliations`
- `lottery_entries`
- `deli_entries`
- `payroll_entries`
- `employees`
- `pos_systems`
- `pos_imports`
- `pos_column_mappings`
- `pos_import_rows`
- `imports`
- `import_rows`
- `products`
- `product_sales`
- `vendors`
- `product_categories`
- `category_rules`
- `vendor_rules`
- `product_rules`

`products` stores quantity on hand, reorder level, cost, retail price, and notes. `vendors` stores supplier contacts and weekly spend estimates. `employees` stores the staff roster and standard rates; payroll history remains in `payroll_entries`.

All store-owned tables include `user_id` and `store_id`, plus row-level security policies using `auth.uid() = user_id`.

## Smart Import

Open `Smart Import` from the sidebar.

Supported uploads:

- PDF files
- Excel files (`.xlsx`, with best-effort fallback for legacy `.xls`)
- CSV files

Common use cases:

- Bank statements
- Vendor invoices
- Capital Candy invoices
- POS sales reports
- Payroll exports
- Fuel reports
- Lottery reports

Upload flow:

1. Upload a PDF, Excel, or CSV file.
2. The server parses the file and extracts dates, vendors, descriptions, products, SKU/UPC, quantities, unit cost, unit retail price, totals, and raw row data.
3. The rule-based categorization engine suggests a category, confidence score, and import destination.
4. Review every row before saving.
5. Edit category, vendor, product, date, amount, and destination as needed.
6. Toggle rows off if they should be ignored.
7. Click `Confirm Import`.

Rows are not saved automatically. File hashes prevent duplicate file imports, and row hashes prevent duplicate row imports.

## Entry Modes

Open `Daily Sales` or `Bulk Entry` from the sidebar. The entry toggle supports:

- `Daily Entry`: one day at a time at `/daily-sales`
- `Bulk Daily Entry`: 30-31 daily rows at `/bulk-entry`
- `Monthly Totals Entry`: one total record for a whole month at `/bulk-entry`

### Bulk Daily Entry

Supported workflow:

1. Pick a month to generate 30 or 31 editable daily rows.
2. Enter daily values in the spreadsheet-style grid, or upload a CSV.
3. Download a CSV template for the selected month when starting from a spreadsheet.
4. Click `Preview month` to validate:
   - missing dates for the selected month
   - invalid or negative numbers
   - duplicate dates inside the upload/grid
   - dates already saved in Supabase
5. Enable overwrite when saved dates should be replaced.
6. Click `Save all days`.

CSV headers:

```csv
date,grocery_sales,deli_sales,hot_food_sales,fuel_gallons_sold,fuel_price_per_gallon,fuel_cost_per_gallon,lottery_sales,beer_sales,cigarette_sales,other_sales,cash_total,card_total,expenses,payroll,notes
```

Bulk Entry saves daily sales rows and also writes bulk-marked expense/payroll records so the dashboard and P&L reports update through the existing reporting calculations.

### Monthly Totals Entry

Monthly Totals Entry saves to the separate `monthly_totals` table and does not overwrite daily sales rows.

Fields include month, year, grocery, deli, hot food, fuel gallons, fuel revenue, fuel cost, lottery, beer, cigarettes, vape/nicotine, other sales, cash/card sales, payroll, inventory purchases, vendor expenses, utilities, rent/mortgage, insurance, repairs/maintenance, miscellaneous expenses, and notes.

The form calculates total sales, total expenses, fuel margin, fuel profit, gross profit, estimated net profit, expense percentage, gross margin, and net margin. It supports save, edit, delete, browser print/PDF, and Excel-compatible export.

Reports and the dashboard use monthly totals for months where a `monthly_totals` row exists. Daily records remain available and are still used for months without a monthly total.

## POS Integrations

Open `POS Integrations` from the sidebar.

Supported POS presets:

- Gilbarco Passport
- Verifone Commander
- NCR Counterpoint
- Square
- Clover
- Lightspeed
- Shopify POS
- Toast
- Shift4
- Heartland
- CStoreOffice / Petrosoft
- PDI
- NCR / Radiant
- Generic POS CSV

Workflow:

1. Select the POS system.
2. Upload a CSV export from the POS or back-office system.
3. Map each POS column to the app's internal fields. Missing fields can stay skipped.
4. Save the mapping template for that POS.
5. Preview rows before saving.
6. Fix missing dates or bad numbers.
7. Choose whether duplicate rows should be skipped or overwritten.
8. Save the import.

Duplicate prevention uses the POS source, date, and transaction/import ID when available. If a transaction ID is missing, the importer falls back to date, row number, department, and item. Imported POS rows are stored separately from manual Daily Entry, Bulk Entry, and Monthly Totals records.

Internal POS fields:

```csv
date,transaction_id,department_category,item_name,sku_barcode,quantity_sold,gross_sales,discounts,refunds,voids,net_sales,tax,fees,cash_total,card_total,ebt_total,gift_card_total,other_payment_total,fuel_gallons,fuel_sales,fuel_cost,lottery_sales,vendor_category_notes
```

Sample files:

- `samples/uploads/generic-pos-import-template.csv`
- `samples/uploads/gilbarco-passport-sample.csv`
- `samples/uploads/square-pos-sample.csv`
- `samples/uploads/clover-pos-sample.csv`
- `samples/uploads/shopify-pos-sample.csv`

Dashboard and reports include POS rows along with manual daily entries. If a Monthly Totals record exists for a month, that monthly total remains the source of truth for that month to avoid double counting detailed daily/POS rows.

POS reports include:

- POS import history
- Sales by POS source
- Department/category sales from POS
- Payment breakdown
- Fuel sales and gallons
- Unmapped rows and validation errors

### Authenticated POS browser test

For local POS import testing, create the demo browser-test account in your development Supabase project:

```sql
-- Run in the Supabase SQL editor after supabase/schema.sql.
\i supabase/test-account.sql
```

If your SQL editor does not support `\i`, open `supabase/test-account.sql`, paste the file contents, and run it.

Default test login:

```text
Email: codex.pos.tester@gmail.com
Password: TestPass123!
```

Install Playwright's Chromium browser once:

```bash
npx playwright install chromium
```

Start the app, then run the authenticated POS flow:

```bash
npm run dev
npm run test:pos-browser
```

The browser test signs in through `/login`, opens `/pos-integrations`, uploads the generic, Gilbarco Passport, Square, Clover, and Shopify POS sample CSV files, verifies mapping/preview/validation, saves imports, verifies duplicate skip and overwrite, then checks dashboard and reports for POS source, department, payment, and fuel data.

Optional overrides:

```bash
POS_TEST_BASE_URL=http://localhost:3000 POS_TEST_EMAIL=you@example.com POS_TEST_PASSWORD=secret npm run test:pos-browser
POS_TEST_HEADED=1 npm run test:pos-browser
```

### Learning system

When a user corrects a row category before confirming an import, Smart Import saves that correction as a future rule:

- `vendor_rules` remember vendor-level corrections, such as `Eversource -> Utilities`
- `product_rules` remember product or SKU/UPC corrections, such as `Marlboro Gold Pack -> Cigarettes / Tobacco`
- `category_rules` remember reusable description keywords from corrected rows

Future imports check learned rules before built-in guesses.

Confidence scoring:

- `95%` = exact saved rule match
- `85%` = strong keyword match
- `70%` = vendor match
- `50%` = weak guess
- Below `50%` = Needs Review

### Categorization rules

Smart Import uses vendor names, description keywords, amounts, file type, column names, and product keywords.

Examples:

- `Capital Candy` -> `Capital Candy` / product or inventory import
- `fuel`, `gas`, `rack`, `gallon` -> `Fuel purchase`
- `payroll`, `ADP`, `employee` -> `Payroll`
- `Marlboro`, `Newport`, `Camel` -> `Cigarettes / Tobacco`
- `Coke`, `Pepsi`, `Red Bull`, `Monster` -> `Drinks`
- `coffee` -> `Coffee`
- `chicken`, `pizza`, `sandwich` -> `Deli / Hot Food`
- `beer`, `Modelo`, `Coors` -> `Beer / Alcohol`
- `Eversource` -> `Utilities`

PDF parsing uses server-side `pdf-parse`. CSV parsing uses PapaParse. Excel parsing uses `read-excel-file` because the commonly requested `xlsx` package currently has high-severity advisories with no fixed release.

### Sample upload files

Use the upload fixtures in `samples/uploads/` to test Smart Import:

- `capital-candy-invoice.csv`
- `pos-sales-report.csv`
- `fuel-report.xlsx`
- `messy-vendor-invoice.pdf`

## Profit calculations

- Fuel profit: `gallons sold * (retail price per gallon - cost per gallon)`
- Bulk Entry fuel margin: `fuel_price_per_gallon - fuel_cost_per_gallon`
- Bulk Entry total sales: `grocery + deli + hot_food + lottery + beer + cigarettes + other`
- Lottery profit: `(lottery sales * commission percentage) - lottery payouts`
- Deli gross profit: `deli sales - food cost - waste amount`
- Payroll cost: `hours worked * hourly rate`
- Net profit estimate: gross profit estimate minus expenses and payroll

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run start
npm run seed
npm run desktop:dev
npm run desktop:pack
npm run desktop:dist
```

## Docker Deployment

Build and run with Docker Compose:

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

For plain Docker:

```bash
docker build -t convenience-store-command-center .
docker run --env-file .env.local -p 3000:3000 convenience-store-command-center
```

The Docker image uses Next.js standalone output and runs as a non-root user in production mode.

## Vercel Deployment

1. Push the repository to GitHub.
2. Import it in Vercel.
3. Set environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

`vercel.json` includes the Next.js framework, install command, build command, dev command, and `.next` output directory.

## Electron Desktop Launcher

The Electron app bundles the Next.js standalone server and opens it in a desktop window.

Development desktop mode:

```bash
npm run desktop:dev
```

Create an unpacked desktop build:

```bash
npm run desktop:pack
```

Create a Windows NSIS installer and `StoreCommandCenter.exe` executable:

```bash
npm run desktop:dist
```

Electron details:

- App entry: `electron/main.cjs`
- Preload bridge: `electron/preload.cjs`
- Windows icon: `build/icon.ico`
- Installer output: `dist-desktop/`
- Product name: `StoreCommandCenter`
- Executable name: `StoreCommandCenter.exe`
- One-click installer: enabled
- Desktop and Start Menu shortcuts: enabled
- Local backend auto-launch: enabled from `.next/standalone/server.js`
- Offline mode: the desktop shell can launch locally, but authentication and persisted business data require the configured Supabase project

## Production Checks

Before deploying:

```bash
npm audit --omit=dev
npm run lint
npm run build
```

## Troubleshooting

### `npm run dev` does not open

- Confirm Node.js 22+ is installed: `node --version`
- Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`
- Check that port `3000` is available.

### Supabase login works but no data appears

- Confirm `supabase/schema.sql` was run.
- Confirm RLS policies exist.
- Confirm the user signed in with the same Supabase project configured in `.env.local`.

### Seed script fails with a foreign key error

`SEED_USER_ID` must be an existing Supabase Auth user ID from Authentication > Users.

### Docker build fails copying public assets

Run from the repository root. The repo includes a `public/` directory and Next.js standalone output is generated during the Docker build.

### Electron packaged app cannot start

Run:

```bash
npm run build
npm run desktop:prepare
```

Then verify `.next/standalone/server.js` exists before running `npm run desktop:pack` or `npm run desktop:dist`.
