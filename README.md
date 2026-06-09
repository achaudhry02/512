# Convenience Store Command Center

A full-stack Next.js dashboard for convenience store owners to track daily sales, expenses, fuel, lottery, deli / hot food, payroll, and profit.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Recharts

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

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

If these variables are missing, the app runs in demo mode with editable sample data that does not persist after refresh.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. In Authentication settings, enable email/password auth.
4. Copy your project URL and anon key into `.env.local`.
5. Start the app and sign up.

The app automatically creates a profile in `public.users` and a default store for each authenticated user.

### Optional seed data

After signing up once, copy your user ID from Supabase Authentication > Users.

Edit `supabase/seed.sql` and replace:

```sql
00000000-0000-0000-0000-000000000000
```

with your auth user ID, then run the seed script in the Supabase SQL editor.

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

All store-owned tables include `user_id` and `store_id`, plus row-level security policies using `auth.uid() = user_id`.

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
npm run build
npm run start
```
