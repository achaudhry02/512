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

- Supabase login and signup
- Row-level security so each user only sees their own store data
- Dashboard with sales, gross profit, net profit estimate, fuel profit, lottery profit, deli sales, expenses, payroll, best/worst categories, and charts
- Add, edit, delete, and date-filter entries for:
  - Daily sales
  - Expenses
  - Fuel tracking
  - Lottery tracking
  - Deli / hot food tracking
  - Payroll
- Monthly P&L report with CSV export
- Mobile-friendly sidebar navigation
- Loading states and error handling
- Editable demo/sample mode when Supabase environment variables are not set
- Profit Leak Finder alerts for high expenses, low fuel margin, deli waste, payroll drag, vendor increases, and low-margin days
- Smart Import for PDF, Excel, and CSV files with editable review before saving
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
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is only needed for server-side maintenance scripts such as `npm run seed`. Never expose it in client-side code or public hosting logs.

If Supabase values are missing, the app runs in editable demo mode. Demo mode is useful for offline previews and the Electron desktop app when no cloud database is configured.

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

The script creates sample:

- Sales
- Expenses
- Fuel data
- Payroll data

It also intentionally includes a few anomalies so the Profit Leak Finder has alerts to display.

## Database tables

The schema creates:

- `users`
- `stores`
- `daily_sales`
- `expenses`
- `fuel_entries`
- `lottery_entries`
- `deli_entries`
- `payroll_entries`
- `imports`
- `import_rows`
- `products`
- `product_sales`
- `vendors`
- `product_categories`

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

Use the files in `samples/uploads/` to test Smart Import:

- `capital-candy-invoice.csv`
- `pos-sales-report.csv`
- `fuel-report.xlsx`
- `messy-vendor-invoice.pdf`

## Profit calculations

- Fuel profit: `gallons sold * (retail price per gallon - cost per gallon)`
- Lottery profit: `(lottery sales * commission percentage) - lottery payouts`
- Deli gross profit: `deli sales - food cost - waste amount`
- Payroll cost: `hours worked * hourly rate`
- Net profit estimate: gross profit estimate minus expenses and payroll

## Scripts

```bash
npm run dev
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
- Offline mode: supported via app demo mode when Supabase env vars are not configured

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
