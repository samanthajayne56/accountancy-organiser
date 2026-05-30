# Accountancy Organiser

A private internal dashboard for organising accountancy work, client records, staff assignments, recurring service periods, deadlines, and fee information.

The project is built with Next.js, React, TypeScript, Supabase, and Supabase row level security. It is intended for authenticated team use only and should not include live client data, staff personal data, credentials, or private business information in the repository.

## Features

- Secure sign-in with Supabase Authentication.
- Shared dashboard for active work items, deadlines, priorities, and assignment status.
- Client record management with approval workflows.
- Contact and fee tracking for approved clients.
- Service-based work trackers for tax, accounts, bookkeeping, payroll, compliance, and billing workflows.
- Recurring period support for monthly and quarterly work.
- Deadline alerts for overdue, due-today, and upcoming items.
- Staff access management with administrator-only controls.
- Reassignment support when staff members are deactivated.
- Supabase SQL scripts for database setup and staged upgrades.

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- `@supabase/ssr`
- `@supabase/supabase-js`
- Lucide React icons

## Project Structure

```text
app/
  globals.css          Global styles
  layout.tsx           App shell and metadata
  login/page.tsx       Authentication page
  page.tsx             Main dashboard experience

utils/supabase/
  client.ts            Browser Supabase client
  server.ts            Server Supabase client
  middleware.ts        Session refresh helper

supabase/
  *.sql                Database setup and upgrade scripts

public/
  *.png                Public static assets

middleware.ts          Next.js middleware entry point
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
.env.local
```

Add the required Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Do not commit `.env.local` or any real credentials.

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start a production build locally:

```bash
npm run start
```

## Database Setup

The `supabase/` directory contains SQL scripts for setting up and upgrading the database schema.

Use the scripts in a controlled Supabase environment and review them before running. They include tables, policies, helper functions, triggers, realtime publication updates, and access controls for:

- Staff profiles and active staff checks.
- Client records and client approval states.
- Work planner rows.
- Client service selections.
- Client contacts.
- Client fee arrangements.
- Recurring tracker periods.
- Administrator staff management.

Recommended order for a fresh setup is to start with the base multi-user planner script, then apply later upgrade scripts as needed.

## Security And Privacy

This repository should only contain application code and non-sensitive setup scripts.

Do not commit:

- Supabase service role keys.
- Environment files.
- Real client names, contacts, addresses, emails, or notes.
- Real staff personal data.
- Live fee records or billing data.
- Production database exports.
- Screenshots containing private data.

Supabase row level security is part of the application design, but database policies should still be reviewed before production use.

## Deployment

The app can be deployed to any platform that supports Next.js applications.

Required deployment environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Before deploying:

- Confirm the Supabase database scripts have been applied to the target project.
- Confirm authentication is enabled and staff users have been created.
- Confirm row level security policies are active.
- Confirm no demo or private data is included in the deployed repository.

## Development Notes

- The application is marked as private in `package.json`.
- Local build output, installed dependencies, TypeScript build metadata, local environment files, and local agent tooling are ignored by Git.
- The dashboard depends on authenticated Supabase users and matching profile records.
- Administrator actions are enforced through database functions and row level security policies.

## Useful Commands

```bash
npm install
npm run dev
npm run build
npm run start
```

## Repository Hygiene

Keep the repository generic and data-free. Documentation, commits, screenshots, test fixtures, and SQL examples should avoid identifying any business, client, staff member, or real-world financial information.
