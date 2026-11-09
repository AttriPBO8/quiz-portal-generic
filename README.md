# Quiz Portal

A responsive web app for timed multiple-choice quizzes, built to be sold to many organizations (SaaS). Quiz-takers sign in with their email address or phone number and a password, take a timed quiz that can include pictures, sound clips and short videos, and see their score straight away. Super Admins and Local Admins manage users, questions, media and quizzes, and track results.

Each customer gets their own copy of the app and their own database, with their own name, time zone and wording. See [docs/SAAS.md](docs/SAAS.md).

© Attrilium Technology Inc.

## What it does

**For quiz-takers**
- Sign in with an email address or phone number, and a password. Nothing else to pick. A phone number works with or without the country code. Everyone starts with a shared starting password and must set their own at first sign-in (and again after an admin resets it).
- My quizzes: Assigned, In progress, Blocked and Completed.
- Honor code, then a rules pop-up (questions, minutes, pass mark).
- 30 questions (10 Easy, 10 Medium, 10 Hard by default), picked at random. A retake avoids questions already seen.
- Questions can show a picture, a sound clip or a short video above the question text.
- Question panel on the left (computer) or across the top (phone). Grey = not answered, light green = answered, blue = current. Flags sit top right, ticks middle right.
- Flag questions and filter to flagged ones; the last flagged question shows Return.
- Timer: yellow reminder at 15 minutes left, red blinking box for the last 5, automatic submit at 0.
- Answers save as they are chosen, so a dropped connection or closed tab loses nothing.
- Submit checks for unanswered questions first. Results show score out of 100 and pass or fail.
- Two failed attempts lock the quiz for 24 hours.
- Three color schemes, dark mode, works on phones.

**For admins** (sign in at `/admin/login`)
- Results: one row per person per quiz, with filters, sortable columns, summary counts and CSV download. Click a name for the question-by-question detail of an attempt.
- Quiz site dates (Super Admin): open the quiz site only for the quiz cycle. Outside the dates quiz-takers see a closed page; the admin site stays available.
- Certificates: print a Certificate of Completion for one person (Results > View, or from their attempt) or for everyone who passed in the current filters, one A4 page each. Save as PDF from the print window.
- Users: add one at a time or upload a CSV, with an email, a phone number or both. Set each user's role (any wording, such as Employee or Manager) and group; both show in reports and filters but are never asked at sign-in. Mark test accounts so they stay out of reports. Edit details, reset a user to the starting password (they must choose a new one at sign-in), deactivate accounts. Nobody, admins included, can see a user's password.
- Quizzes: create, set question counts, time limit, pass mark and dates, assign by group and role.
- Question banks (Super Admin): upload JSON, see how often each question is answered correctly, hide a question, pick a picture, sound or video for any question.
- Media library (Super Admin): upload pictures (up to 1 MB), sound clips (3 MB) and short videos (5 MB). Files are private and checked by their content.
- Admins (Super Admin): add Local Admins and reset their passwords.
- Local Admins only ever see their own users and the quizzes given to them.

## Running it on a Windows laptop

You need to do steps 1 to 4 once. After that, only step 7 is needed each day.

1. **Install Node.js 22 LTS** from [nodejs.org](https://nodejs.org). Accept the default options.
2. **Install PostgreSQL 17** from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) (the EDB installer).
   - Choose a password for the `postgres` user and write it down.
   - Keep port 5432. Untick Stack Builder at the end.
3. **Install Git** from [git-scm.com](https://git-scm.com/download/win) and **VS Code** if you don't have them.
4. **Create the database.** From the Start menu open **SQL Shell (psql)**, press Enter four times to accept the defaults, type your PostgreSQL password, then run:
   ```
   CREATE DATABASE quizportal;
   \q
   ```
5. **Get the code.** In VS Code open a terminal (Terminal > New Terminal) and run:
   ```
   git clone https://github.com/AttriPBO8/quiz-portal-generic.git
   cd quiz-portal-generic
   npm install
   ```
6. **Set up settings and sample data** (replace `YOUR_DB_PASSWORD`):
   ```
   npm run setup -- YOUR_DB_PASSWORD
   npm run db:deploy
   npm run db:seed
   ```
   `setup` prints two test passwords and saves them in the `.env` file.
7. **Start the app:**
   ```
   npm run dev
   ```
   Open http://localhost:3000. Stop it with Ctrl+C.

### Test accounts (after `npm run db:seed`)

| Who | How to sign in |
| --- | --- |
| Quiz-taker | `user01@example.com` or phone `4165550101`, password = `DEFAULT_USER_PASSWORD` in `.env` |
| Quiz-taker (email only) | `user02@example.com` |
| Quiz-taker (phone only) | `4165550103` |
| Super Admin | `/admin/login`, username `superadmin`, password = `SEED_ADMIN_PASSWORD` in `.env` |
| Local Admin | `localadmin1` to `localadmin3`, same password as the Super Admin |

All 32 sample users (2 of them test accounts) are in `data/sample-users.csv`. The sample questions are in `data/sample-questions.json` (100 general knowledge), `data/sample-questions-math.json` (45 maths) and `data/sample-questions-media.json` (10 questions with pictures, sound and video from `data/sample-media/`). Every user is assigned four sample quizzes: "Topic A - Sample Text" (30 questions), "Mathematics Basics" (15), "Quick Practice (6 questions)" and "Pictures, Sound and Video (sample)" (6).

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app for development at http://localhost:3000 |
| `npm test` | Run the automated tests |
| `npm run build` then `npm start` | Run the production version locally |
| `npm run db:studio` | Open a browser view of the database tables |
| `npm run db:migrate` | After editing `prisma/schema.prisma`, create and apply a database change |
| `npm run create-admin -- name "Full Name"` | Add a Super Admin (add `--local` for a Local Admin) |
| `npm run load-test -- 500` | Simulate 500 people answering at once (local only; needs `npm start` running) |

## File formats for uploads

**Users CSV** (Admin > Users). Columns: `name, email, phone, role, group, test_account, local_admin, password`.
- Each row needs an `email`, a `phone`, or both. Either one can be used to sign in, so each must belong to only one user.
- `phone`: 7 to 15 digits, with or without the country code. Spaces, dashes, brackets and `+` are removed.
- `role` (optional, default "Learner") and `group` (optional) are any words you like. They show in reports and filters.
- `test_account`: `yes` for accounts used for testing; they are left out of reports unless you filter for them.
- `local_admin` (optional) is the Local Admin's username. `password` (optional) sets a specific starting password; otherwise the starting password is used.
- A row whose email or phone already belongs to a user updates that user. The password only changes if one is given.

**Media** (Admin > Media library). Upload the pictures, sound clips and videos first. Supported: PNG, JPG, WebP, GIF (up to 1 MB); MP3, M4A, OGG, WAV (up to 3 MB); MP4, WebM (up to 5 MB). Keep videos short (under about 30 seconds) and 720p or smaller. Pictures need a short description for screen readers.

**Questions JSON** (Admin > Question banks):
```json
[
  { "id": "q_001", "text": "What is the capital of Canada?", "options": ["Toronto", "Ottawa", "Montreal", "Vancouver"],
    "correctOption": 2, "difficulty": "easy", "category": "General Knowledge" },
  { "id": "q_002", "text": "Which month had the highest sales?", "options": ["January", "February", "March", "April"],
    "correctOption": 4, "difficulty": "medium", "category": "Charts", "media": "bar-chart.png" }
]
```
`correctOption` counts from 1 (2 = Ottawa). Older files with a 0-based `correctAnswer` are also accepted. `media` (optional) is the file name of something already in the Media library. Uploading a question with an existing `id` updates it.

## Changing the certificate

The organization name and place can be set per customer with the `CERTIFICATE_ORGANIZATION` and `CERTIFICATE_PLACE` settings. The two signatories and whether the score is shown are set at the top of `src/lib/certificate.ts`. The signatures are the two files in `public/signatures/`; replace them with scans of the real signatures (a PNG with a transparent background works best) and update the file names in `src/lib/certificate.ts` if they change. The date printed is the day the person first passed the quiz.

## How the code is organised

```
prisma/schema.prisma     Database tables
prisma/migrations/       Database changes, applied in order
prisma/seed.ts           Sample data
src/app/                 Pages (folders match web addresses)
  page.tsx               Quiz-taker sign-in
  quizzes/               My quizzes, honor code
  attempt/               Quiz screen and results
  admin/                 Admin screens and CSV downloads
  actions/               Server code that buttons and forms call
src/components/          Shared screen pieces (header, tables, filters)
src/lib/                 Rules and helpers: quiz-engine (picking, scoring, blocking),
                         auth, sessions, passwords, contact (email/phone), media-storage,
                         imports, reports
data/sample-media/       Sample pictures, sounds and videos
tests/                   Automated tests
docs/DEPLOY-AWS.md       Going live on AWS
docs/SAAS.md             Setting up a new customer
```

## Security notes

- Correct answers never leave the server; the browser only gets question text and options. Scoring happens on the server.
- Passwords are stored only as bcrypt hashes, which cannot be turned back into the password. No admin screen or export shows them.
- Five wrong passwords lock an account for 15 minutes. Sessions last 8 hours and end on password change or deactivation.
- Every admin page and download checks the admin's role and limits data to their own users.
- During a quiz, copying, right-click and print shortcuts are blocked. Browsers cannot fully block screenshots, so treat this as a deterrent.
- Everyone starts with the same password, so quiz-takers must set their own before they can see or take a quiz. Until a person does, anyone who knows their email or phone and the starting password could sign in first, so share the starting password only with the people taking quizzes, and ask them to sign in soon.
- The sign-in error never says whether an email or phone number exists, and takes the same time either way.
- Question media is private: files are served only to signed-in admins and to quiz-takers who were given a question using them. Uploads are checked by their content; SVG, HTML and other types that could carry scripts are refused. On AWS the files sit in a private, encrypted S3 bucket.
- Requests that are too large, use unusual methods, or come too fast from one address are refused (HTTP 413, 405 or 429). Limits: 1200 requests a minute per address (change with `RATE_LIMIT_PER_MINUTE`), 100 quiz sign-in attempts and 30 admin sign-in attempts per 10 minutes per address. On AWS, also turn on the firewall (docs/DEPLOY-AWS.md, step 7).
- Logs: separate access logs for the quiz and admin sites, a security log and a log of every database change. See docs/DEPLOY-AWS.md, step 8. On a laptop they are in the `logs` folder; the Super Admin also has **Security log** in the admin menu.
- Logs never contain passwords, password hashes or session tokens, and show only the last 4 digits of phone numbers and the first 2 letters of email addresses. Every data download is recorded in the security log.
- Never commit `.env`. It is already listed in `.gitignore`.
