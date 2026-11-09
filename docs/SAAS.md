# Selling the Quiz Portal to many customers (SaaS)

## How customers are kept apart

Each customer (tenant) gets **their own copy of the app and their own database**:

- one Amplify app, connected to this same GitHub repository and branch,
- one RDS PostgreSQL database,
- one private S3 bucket for their question media.

Why this way, rather than one shared database for everyone:

1. **Data and security first.** One customer's users, answers and media can never show up for another customer, even if there is a bug in a screen or report, because they are in different databases and buckets. Each customer can also be in their own country's AWS region (for example Mumbai for India, Canada Central for Canada) to meet data-residency rules.
2. **Simple to run.** There is no tenant code to get wrong, and one customer's busy exam day cannot slow down another.
3. **Easy to price.** Each customer's AWS bill is separate (tag their resources with `customer=<name>`), roughly USD 20–30 a month each at about 500 people taking a quiz at once.
4. **One code base.** A fix merged into `main` deploys to every customer's app automatically.

If you later have many small customers and the per-customer cost matters, the database can move to one shared database with a `tenantId` on every table. Every query already goes through a few helpers (`userScope`, `quizScope` in `src/lib/auth.ts`), so that change is contained, but it should only be done with careful testing.

## Setting up a new customer (about 45 minutes)

Follow [DEPLOY-AWS.md](DEPLOY-AWS.md) from step 1, with the customer's names:

| What | Example |
| --- | --- |
| Database identifier | `acme-quiz-db` |
| Media bucket | `acme-quiz-media` |
| Media role | `acme-quiz-media` |
| Amplify app | `acme-quiz` |

Then set the customer's own settings in Amplify > **Environment variables**:

| Setting | What it changes | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_PORTAL_NAME` | Name in the header and browser tab | `Acme Training Portal` |
| `NEXT_PUBLIC_TIME_ZONE` | Time zone for every date shown, entered and in reports | `America/Toronto`, `Asia/Kolkata` |
| `NEXT_PUBLIC_GROUP_LABEL` | What a user's group is called on screens and downloads | `Department`, `Branch`, `Class` |
| `DEFAULT_COUNTRY_CODE` | Country code users may leave off their phone at sign-in | `1`, `91` |
| `CERTIFICATE_ORGANIZATION` | Organization on certificates | `Acme Corp` |
| `CERTIFICATE_PLACE` | Place on certificates | `Toronto, Canada` |

Settings starting with `NEXT_PUBLIC_` are built into the pages, so after changing one, click **Redeploy this version**.

The certificate signatories and signature images are still set in `src/lib/certificate.ts` and `public/signatures/`, shared by all customers. Ask before printing certificates for a customer with these sample names.

Finally, create the customer's first Super Admin (DEPLOY-AWS step 4) and give them the address, their admin sign-in and the quiz-takers' starting password, separately.

## What each customer controls themselves

From their own admin screens: their admins, users (with email, phone, role and group), question banks, media, quizzes, quiz-site open dates, results, certificates and security log.

## Removing a customer

1. Download anything they are owed (Results CSV, certificates, security log).
2. Delete their Amplify app, then their S3 bucket, then their RDS database (RDS offers a final snapshot; keep it only as long as your contract says).
3. Delete their IAM media role.
