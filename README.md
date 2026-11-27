# Borderless Africa

**Work without borders.**

Borderless Africa is a cross-border freelance marketplace concept built to help clients and independent professionals find each other, agree on work, and manage delivery in one place. The product is rooted in the African market, with support for NGN, KES, and GHS contract payments through Paystack.

> **Project status:** Actively developed. This repository contains a working marketplace application and is still evolving.

## Product preview

### Landing page

| Light theme | Dark theme |
| --- | --- |
| ![Borderless Africa landing page in light theme](public/Screenshot%201.png) | ![Borderless Africa landing page in dark theme](public/Screenshot%202.png) |

### Marketplace workspace

| Workspace | Proposals and negotiation history |
| --- | --- |
| ![Freelancer workspace](public/Screenshot%203.png) | ![Proposal list and negotiation history](public/Screenshot%204.png) |

### Sign-in and administration

| Sign-in | Admin overview |
| --- | --- |
| ![Sign-in page](public/Screenshot%207.png) | ![Marketplace admin overview](public/Screenshot%2012.png) |

<details>
  <summary>More administration screens</summary>

  | Dispute management | Proposal review |
  | --- | --- |
  | ![Admin dispute management](public/Screenshot%208.png) | ![Admin proposal review](public/Screenshot%2013.png) |

  | Job moderation | User management |
  | --- | --- |
  | ![Admin job moderation](public/Screenshot%2014.png) | ![Admin user management](public/Screenshot%2015.png) |
</details>

## What it does

Borderless Africa supports the core lifecycle of a fixed-price freelance engagement:

1. A client publishes a job with a budget, currency, and delivery expectations.
2. Freelancers discover opportunities and submit proposals with a cover letter, price, and delivery timeframe.
3. The client and freelancer negotiate proposal terms through counteroffers.
4. The client accepts a proposal, creating a contract with the agreed terms.
5. The client pays for the contract through Paystack-hosted checkout.
6. The freelancer submits work for the client to review, approve, or request a revision for.
7. Participants can raise contract disputes; administrators can review and resolve them.

Accounts can be enabled for client and freelancer capabilities, so a person can use the marketplace in either role. The administration workspace includes marketplace overview metrics and tools for managing users, jobs, proposals, contracts, payments, and disputes.

### Highlights

- Email-and-password authentication, email verification, and password reset flows.
- Job discovery and job management.
- Proposal submission, review, and counteroffer history.
- Fixed-price contracts that retain the accepted terms.
- Contract delivery, review, revisions, cancellation requests, and disputes.
- Paystack checkout initialization and server-side payment verification.
- Signed Paystack webhook handling and payment monitoring for administrators.
- Light and dark themes with a saved user preference.
- Responsive application layouts styled with SCSS Modules.

## Payments and trust boundaries

Paystack is used for contract checkout. The application initializes transactions on the server, sends clients to Paystack-hosted checkout, and verifies transaction details with Paystack before activating a contract. The webhook endpoint verifies Paystack signatures and reconciles provider transactions with local payment records.

**A payment record in this application is not escrow or custody of funds.** Funds handling, refunds, and payouts remain subject to Paystack's supported capabilities and applicable legal and operational arrangements. Do not treat a browser redirect alone as proof that a payment succeeded.

## Technology

- **Application:** Next.js App Router, React, TypeScript
- **Database:** PostgreSQL
- **Data access and migrations:** Drizzle ORM and Drizzle Kit
- **Authentication:** Better Auth with its Drizzle adapter
- **Payments:** Paystack API and signed webhooks
- **Styling:** SCSS and CSS Modules
- **Deployment configuration:** Vercel, including a scheduled cancellation-escalation job

## Run locally

### Prerequisites

- Node.js and npm
- A PostgreSQL database
- Paystack test credentials to exercise contract payments

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment variables

Create `.env.local` in the project root. Keep real credentials out of source control.

```dotenv
# PostgreSQL runtime connection
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE

# Direct PostgreSQL connection used by Drizzle Kit migrations
DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@HOST:5432/DATABASE

# Application and authentication
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-long-random-secret

# Paystack: use test keys for local development
PAYSTACK_SECRET_KEY=sk_test_replace_me
PAYSTACK_WEBHOOK_SECRET=replace-with-your-paystack-webhook-secret

# Protects the scheduled cancellation-escalation endpoint
CRON_SECRET=replace-with-a-long-random-secret
```

Use your database provider's pooled connection for `DATABASE_URL` if applicable, and its direct connection for `DATABASE_URL_UNPOOLED`. Generate unique, private values for both application secrets. The Paystack secret key must remain server-side; never expose it through a `NEXT_PUBLIC_` variable.

### 3. Apply database migrations

```bash
npx drizzle-kit migrate
```

The Drizzle configuration loads `.env.local` and uses `DATABASE_URL_UNPOOLED` for migration operations.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Paystack webhook setup

For local development, expose the local application to Paystack using a secure webhook tunnel, then configure the Paystack webhook URL as:

```text
https://YOUR_PUBLIC_HOST/api/webhooks/paystack
```

Set the corresponding webhook signing secret as `PAYSTACK_WEBHOOK_SECRET`. Use Paystack test mode and test credentials while developing. In production, configure the production credentials and webhook secret in the hosting provider's secret manager.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npx drizzle-kit migrate` | Apply pending PostgreSQL migrations |
| `npx drizzle-kit generate` | Generate a migration from schema changes |

## Project structure

```text
src/
  app/                 App Router pages, layouts, and API route handlers
    (auth)/            Sign-in, sign-up, verification, and password reset
    admin/             Marketplace administration workspace
    api/               Authentication, Paystack webhook, and cron endpoints
    dashboard/         Signed-in marketplace workspace
    jobs/              Public job browsing and proposal entry points
  components/          Shared interface and workflow components
  lib/
    db/                PostgreSQL connection and Drizzle schema
    marketplace/       Job, proposal, contract, and dispute operations
    notifications/     Notification-related data and actions
drizzle/               PostgreSQL migration history
public/                Static assets and project screenshots
```

Marketplace operations are organized around server-side actions and database-backed domain records. PostgreSQL transactions and constraints are used for sensitive lifecycle transitions, including payment reconciliation. The `admin` area provides separate operational views for platform management.

## Current product scope

- Contracts are fixed-price; milestone payments are not currently part of the workflow.
- Payment initiation currently supports NGN, KES, and GHS.
- Email verification and password-reset links are logged by the development email handlers; a production email delivery provider is not configured here.
- The Vercel cron configuration schedules cancellation escalation daily. A production deployment must provide `CRON_SECRET`.
- Do not use real funds or production credentials for local testing.

## Contributing

This is an actively evolving project. Before opening a change, run the checks relevant to it:

```bash
npm run lint
npm run build
```

For schema changes, generate and review a Drizzle migration, then apply it to a development database before shipping.
