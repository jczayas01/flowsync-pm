# FlowSync PM — Deployment Guide

Complete step-by-step guide to take FlowSync PM from code to live at flowsyncpm.com.

---

## Prerequisites

- Node.js 20+ installed locally
- Git installed
- GitHub account
- Vercel account (vercel.com — free to sign up)
- GoDaddy account with flowsyncpm.com registered

---

## Step 1 — Gather credentials (30–60 min)

You need accounts and keys for 6 services. Open each in a tab and collect the values.

### 1a. Supabase (database) — Required
1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to Puerto Rico: **US East (N. Virginia)**
3. Set a strong database password — save it
4. Once created: **Settings → Database → Connection string**
5. Copy both the **Transaction** URL (port 6543) and **Session** URL (port 5432)
6. Paste into `.env.local` as `DATABASE_URL` and `DIRECT_URL`

### 1b. NextAuth Secret — Required
Run this in your terminal:
```bash
openssl rand -base64 32
```
Copy the output → paste as `NEXTAUTH_SECRET`

### 1c. Google OAuth — Optional (enables Google sign-in)
1. [console.cloud.google.com](https://console.cloud.google.com) → Create project
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized redirect URIs: `https://flowsyncpm.com/api/auth/callback/google`
5. Copy Client ID and Client Secret

### 1d. Microsoft OAuth — Optional (enables Microsoft sign-in + M365)
1. [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New
2. Name: "FlowSync PM"
3. Supported account types: **Accounts in any organizational directory and personal accounts**
4. Redirect URI: `https://flowsyncpm.com/api/auth/callback/azure-ad`
5. After creation: Certificates & secrets → New client secret
6. API permissions → Add: `Mail.Read`, `Calendars.Read`, `Tasks.ReadWrite`, `User.Read`
7. Grant admin consent
8. Copy Application (client) ID and client secret value

### 1e. Azure OpenAI — Optional (enables AI co-pilot)
1. [portal.azure.com](https://portal.azure.com) → Create resource → Azure OpenAI
2. Once deployed: Go to Azure OpenAI Studio → Deployments → Deploy model
3. Deploy **GPT-4o** with deployment name `gpt-4o`
4. Deploy **GPT-4o-mini** with deployment name `gpt-4o-mini`
5. Back in portal: Keys and Endpoint → copy Endpoint URL and Key 1

### 1f. Stripe — Optional (enables paid plans)
1. [dashboard.stripe.com](https://dashboard.stripe.com) → Sign up
2. Developers → API keys → copy Publishable key and Secret key
3. Create webhook: Developers → Webhooks → Add endpoint
   - URL: `https://flowsyncpm.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. Copy the webhook signing secret
5. Products → Create your 3 pricing plans and copy the Price IDs

### 1g. Resend — Optional (enables transactional email)
1. [resend.com](https://resend.com) → Sign up
2. Domains → Add domain → `flowsyncpm.com`
3. Add the DNS records shown in Resend to GoDaddy DNS
4. API Keys → Create API Key with full access
5. Copy the API key

---

## Step 2 — Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value you collected above.
Minimum required to start: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`

---

## Step 3 — Set up the database (15 min)

```bash
# Install dependencies
npm install

# Push the main Prisma schema (creates 28 tables)
npx prisma db push

# Run the SQL migration files in order
psql $DATABASE_URL < prisma/security-additions.sql
psql $DATABASE_URL < prisma/automation-schema.sql
psql $DATABASE_URL < prisma/portfolio-schema.sql
psql $DATABASE_URL < prisma/phase3-schema.sql

# Seed demo data (Sistema de Salud Menonita workspace)
npx tsx prisma/seed.ts
```

Or run everything in one command:
```bash
npm run setup
```

Verify it worked:
```bash
npx prisma studio
# Opens a browser at localhost:5555
# You should see all tables populated
```

---

## Step 4 — Test locally (5 min)

```bash
npm run dev
# Open http://localhost:3000
```

Verify:
- [ ] Landing page loads
- [ ] Sign up creates an account
- [ ] Onboarding wizard completes
- [ ] Dashboard loads with onboarding checklist
- [ ] Can create a project from a template

---

## Step 5 — Push to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "FlowSync PM v1.0 — initial release"

# Create a new repo at github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/flowsync-pm.git
git branch -M main
git push -u origin main
```

---

## Step 6 — Deploy to Vercel (20 min)

### 6a. Import project
1. Go to [vercel.com](https://vercel.com) → Add New → Project
2. Import from GitHub → select `flowsync-pm`
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: leave as `/`

### 6b. Add environment variables
In Vercel → Project Settings → Environment Variables, add **every variable** from your `.env.local`.

Key ones to not miss:
- `NEXTAUTH_URL` = `https://flowsyncpm.com` (NOT localhost)
- `NEXT_PUBLIC_APP_URL` = `https://flowsyncpm.com`
- All the service keys from Step 1

### 6c. Deploy
Click **Deploy**. First build takes 3–5 minutes.

Vercel will give you a URL like `flowsync-pm-juan.vercel.app` — test it before switching DNS.

---

## Step 7 — Connect flowsyncpm.com to Vercel (10 min)

### 7a. Remove GoDaddy Website Builder first
**You must do this step or DNS will not work.**

1. GoDaddy → My Products → Website Builder
2. Find the connection to flowsyncpm.com → Delete / Remove site
3. This removes the locked A records that block Vercel

### 7b. Add domain in Vercel
1. Vercel → Project → Settings → Domains
2. Add `flowsyncpm.com` → Add
3. Also add `www.flowsyncpm.com` → redirect to `flowsyncpm.com`
4. Vercel shows you the DNS records to add:

| Type  | Name  | Value                                    |
|-------|-------|------------------------------------------|
| A     | @     | `216.150.1.1`                            |
| CNAME | www   | `your-project-id.vercel-dns-017.com`     |

### 7c. Add those records in GoDaddy
1. GoDaddy → My Products → flowsyncpm.com → three-dot menu → **Edit DNS**
2. Add the A record and CNAME from Vercel exactly as shown
3. Delete any old A records pointing elsewhere

### 7d. Wait for propagation
Usually 5–30 min. Check: `nslookup flowsyncpm.com` should return `216.150.1.1`

Vercel dashboard shows **Valid Configuration** when done. SSL provisions automatically.

---

## Step 8 — Add GitHub Secrets for CI/CD

In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

Add every variable from `.env.local` as a secret, plus these three Vercel-specific ones:

| Secret | Where to find it |
|--------|-----------------|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | vercel.com → Account Settings → General → Your ID |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General → Project ID |

After this, every push to `main` automatically deploys to production.

---

## Step 9 — Pre-launch verification checklist

Run through these manually before sharing the URL:

### Auth flows
- [ ] Sign up with email + password → receive welcome email
- [ ] Sign in with Google → lands on dashboard
- [ ] Sign in with Microsoft → lands on dashboard
- [ ] Forgot password → receive reset email
- [ ] Enable 2FA → verify it works on next login

### Core product
- [ ] Create project from EHR Implementation template → phases and tasks appear
- [ ] Add a task → assign to team member → they receive email notification
- [ ] Log 4 hours on a task → check time entry appears in budget tab
- [ ] Log a risk with score 15 → verify it appears on dashboard
- [ ] Create a milestone due in 7 days → verify it appears on dashboard countdown

### Team & billing
- [ ] Invite a team member → they receive email → accept → can access workspace
- [ ] Go to Settings → Billing → upgrade to Pro plan → Stripe checkout works
- [ ] Downgrade back to Free → confirm access restricted correctly

### Integrations
- [ ] Connect Microsoft 365 → verify Outlook emails appear on project
- [ ] Create an automation rule → trigger it → check execution log
- [ ] Install a template from the marketplace → project created correctly
- [ ] Generate an AI status report → review output quality

### Infrastructure
- [ ] HTTPS works on flowsyncpm.com
- [ ] www.flowsyncpm.com redirects to flowsyncpm.com
- [ ] Stripe webhook receives events (check Stripe dashboard → Webhooks → Recent deliveries)
- [ ] Resend sends emails (check Resend dashboard → Logs)
- [ ] Error page shows correctly at flowsyncpm.com/nonexistent-page

---

## Troubleshooting

### "Prisma client not found" on Vercel
The `postinstall` script in package.json runs `prisma generate` automatically.
If still failing: Vercel → Project → Settings → Build & Output Settings → Install Command: `npm install && npx prisma generate`

### "Invalid Configuration" warning on Vercel domain
GoDaddy Website Builder is still connected. Go to GoDaddy → My Products → Website Builder → delete the flowsyncpm.com site. The locked A records disappear automatically.

### Stripe webhooks failing
Make sure `STRIPE_WEBHOOK_SECRET` is the signing secret from the webhook endpoint in Stripe dashboard, NOT your API secret key. They are different.

### NextAuth NEXTAUTH_URL mismatch
In production, `NEXTAUTH_URL` must be exactly `https://flowsyncpm.com` — no trailing slash, no www. This is the most common NextAuth misconfiguration.

### Database connection timeout on Vercel
Use the **Transaction** mode pooled URL (port 6543) for `DATABASE_URL`. Vercel's serverless functions need connection pooling. The session URL (port 5432) is only for `DIRECT_URL` used by Prisma migrations.

---

## Post-launch

### Monitoring
- Vercel dashboard → Functions tab shows errors and performance
- Supabase dashboard → Database → Query performance
- Stripe dashboard → Payments and webhook health

### Backups
Supabase automatically backs up your database daily on the Pro plan ($25/mo).
Enable it: Supabase → Project → Settings → Backups.

### Scaling
You are on Vercel Pro ($20/mo) and Supabase Free.
Upgrade Supabase to Pro when your database exceeds 500MB or you need daily backups.
