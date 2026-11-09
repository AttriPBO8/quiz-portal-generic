# Going live on AWS

The app runs on **AWS Amplify Hosting** (connected to GitHub, rebuilds on every change to `main`) with an **Amazon RDS for PostgreSQL** database. No servers or Docker to look after.

Expected cost at this size, after the AWS free tier: roughly USD 20–30 a month (smallest RDS database plus Amplify usage). This is an estimate; check it with the [AWS Pricing Calculator](https://calculator.aws/) for your region.

The AWS console changes its wording from time to time. If a button below has moved, the setting will be nearby with a similar name.

## 1. Create the database (about 15 minutes, mostly waiting)

1. Sign in to the AWS console and pick the region closest to your users (for India, **Asia Pacific (Mumbai) ap-south-1**). Use the same region throughout.
2. Open **RDS** > **Create database**.
3. Choose **Standard create**, engine **PostgreSQL**, version **17**.
4. Template: **Free tier** (or **Production** later for automatic standby).
5. Settings:
   - DB instance identifier: `quiz-portal-db`
   - Master username: `postgres`
   - Choose **Self managed** and enter a long password with letters and numbers only (avoid `@ : / ? #`). Save it in a password manager.
6. Instance: **db.t4g.micro**. Storage: **20 GB gp3**, untick storage autoscaling if you want a fixed bill.
7. Connectivity:
   - Public access: **Yes**. (Amplify runs outside your private network, so it needs to reach the database over the internet. The connection is encrypted and protected by the password.)
   - VPC security group: **Create new**, name `quiz-portal-db`.
8. Expand **Additional configuration**: Initial database name `quizportal`. Backup retention: **7 days**.
9. Click **Create database** and wait until the status is **Available**.
10. Open the database, go to **Connectivity & security**, copy the **Endpoint**.
11. Click the security group `quiz-portal-db` > **Edit inbound rules** > **Add rule**: Type **PostgreSQL**, Source **Anywhere-IPv4**. Save.

Your database address (keep it private) is:
```
postgresql://postgres:YOUR_DB_PASSWORD@YOUR_ENDPOINT:5432/quizportal?sslmode=require&connection_limit=3
```

## 2. Make the secrets

On your laptop, in the project folder, run:
```
npm run setup -- --print
```
It prints `SESSION_SECRET` and `DEFAULT_USER_PASSWORD`. Use these new values for AWS, not the ones in your local `.env`. Keep `DEFAULT_USER_PASSWORD` somewhere safe, because it is the password you give quiz-takers for their first sign-in.

## 3. Connect Amplify to GitHub

1. Open **AWS Amplify** > **Create new app** > **GitHub** > **Next**, and allow access to the `quiz-platform` repository.
2. Choose the repository and the branch **main**.
3. Amplify finds `amplify.yml` in the project; keep its build settings.
4. Open **Advanced settings** > **Environment variables** and add:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the database address from step 1 |
| `SESSION_SECRET` | from step 2 |
| `DEFAULT_USER_PASSWORD` | from step 2 |

5. **Save and deploy**. The first build takes about 5 minutes. It also creates the database tables.
6. When it finishes, Amplify shows the app's address (ending in `amplifyapp.com`).

## 4. Create the first Super Admin

On your laptop, in VS Code's terminal (PowerShell), run with your real database address:
```
$env:DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@YOUR_ENDPOINT:5432/quizportal?sslmode=require"
npm run create-admin -- yourname "Your Name"
Remove-Item Env:DATABASE_URL
```
It prints a password. Sign in at `https://YOUR-APP-ADDRESS/admin/login` and change it from the account menu (top right).

## 5. Load real data

In the admin screens:
1. **Admins**: add your Local Admins.
2. **Question banks**: upload your questions JSON.
3. **Users**: upload your users CSV (with each user's Local Admin in the `local_admin` column).
4. **Quizzes**: create a quiz, set its dates, tick its Local Admins and assign it.

Then share the app address and the starting password with quiz-takers.

## 6. Your own web address (optional)

Amplify > your app > **Hosting** > **Custom domains** > **Add domain**. Amplify sets up the HTTPS certificate for you.

## 7. Firewall against attacks and floods of traffic (recommended)

The app already turns away oversized requests and slows down any single address that sends too many requests or sign-in attempts. One running copy of the app cannot stop a large attack from many addresses, though; AWS WAF does that before traffic reaches the app. AWS Shield Standard (basic network-level protection) is already on for every Amplify app at no cost.

1. Amplify > your app > **Hosting** > **Firewall** (AWS's guide: [Enabling AWS WAF for an Amplify application](https://docs.aws.amazon.com/amplify/latest/userguide/getting-started-using-waf.html)).
2. Turn on the **Amplify-recommended firewall protection**. It adds AWS's managed rules for common attacks (SQL injection, cross-site scripting, known bad inputs) and blocks addresses on Amazon's bad-reputation list.
3. If you add your own domain (step 6), also turn on **Restrict access to amplifyapp.com**, so the firewall cannot be bypassed through the default address.
4. Add a **country** rule that allows only India (IN) **plus every country your admins sign in from** (for example Canada, CA), and blocks the rest. Leaving out an admin's country locks that admin out. People using a VPN can get around a country rule, so it reduces attacks rather than stopping them all.

Between quiz cycles you can also close the quiz site to quiz-takers from the app itself: **Admin > Quiz site** (Super Admin), set the opening and closing dates. The admin site stays available for results and certificates.
5. Add a **rate-based rule** in the AWS WAF console (the web ACL Amplify created > **Add rules** > **Add my own rules** > **Rate-based rule**): limit **2000 requests per 5 minutes per IP address**, action **Block**. Keep it this high because a whole training centre can share one address.

**Cost:** Amplify charges $15 a month per app with a firewall ([pricing](https://docs.aws.amazon.com/amplify/latest/userguide/waf-pricing.html)), plus AWS WAF's own charges: $5 a month for the web ACL, $1 a month per rule, and $0.60 per million requests ([WAF pricing](https://aws.amazon.com/waf/pricing/)). For this app that is roughly $25 to $30 a month in total.

## 8. Logs

The app writes four kinds of log. Each line is one JSON record with a `channel` field:

| Channel | What it holds |
| --- | --- |
| `quiz-access` | Every request to the quiz site: time, address, page, signed-in user |
| `admin-access` | The same for the admin site |
| `security` | Sign-ins (successful and failed), lockouts, password changes and resets, account changes, downloads, refused access and blocked requests |
| `db-changes` | Every insert, update and delete: which table and record, what changed, and who did it. Passwords and hashes are always hidden, and phone numbers show only their last 4 digits |

On a laptop each channel goes to its own file in the `logs` folder, one per day (for example `logs/security-2026-10-29.log`). On AWS, Amplify sends them all to **CloudWatch Logs**. The security events are also saved in the database, so a Super Admin can read and download them under **Admin > Security log** without opening AWS.

**Reading a channel on AWS:** CloudWatch > **Logs Insights**, choose the log group whose name contains your Amplify app id, and run (change the channel name as needed):

```
fields @timestamp, @message
| filter channel = "security"
| sort @timestamp desc
| limit 200
```

Failed sign-ins in the last day: `filter channel = "security" and success = 0 | stats count() by label, ip`.

**Keeping costs down:** CloudWatch keeps logs forever by default. Open the app's log group > **Actions** > **Edit retention setting** and choose **6 months** (or what your organization requires). At this app's size, logs should cost a few dollars a month at most.

**Alerts (optional):** in the log group, **Metric filters** > **Create metric filter** with the pattern `{ $.channel = "security" && $.success IS FALSE }`, then add a CloudWatch alarm that emails you when, say, more than 50 failures happen in 5 minutes.

## Updating the app

Changes merged into `main` on GitHub deploy automatically. Watch progress in Amplify; if a build fails, the previous version stays live.

## Looking after it

- **Database safety:** keep the database's **Encryption** on (the default), keep automated backups on, and never share `DATABASE_URL`. Add `?sslmode=require` to the end of `DATABASE_URL` (or `&sslmode=require` if it already has a `?`) so the connection is always encrypted.
- **Backups:** RDS keeps daily backups for 7 days. To restore, RDS > your database > **Actions** > **Restore to point in time**.
- **Costs:** set a monthly budget alert in **Billing** > **Budgets**.
- **More traffic:** if many more than 500 people will take a quiz at the same moment, move the database to `db.t4g.small` (RDS > Modify) and consider **RDS Proxy**.
