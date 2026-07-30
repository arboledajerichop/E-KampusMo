# E-KampusMo Web

E-KampusMo is a private, student-only companion for schedules, assignments,
internship records, expenses, and reminders.

Tagline: **Your academic life, organized.**

## Current milestone

The web app currently includes:

- A responsive public product homepage
- Email/password registration and login
- Google OAuth registration and login
- Email confirmation callback handling
- Forgot-password and new-password flows
- Supabase SSR cookie clients and a Next.js session-refresh proxy
- A protected, responsive Today dashboard with fully linked navigation
- Class details and Monday-to-Sunday class schedules
- Multi-day manual schedule entry, overlap detection, class codes, professor,
  units, room/mode details, and meeting links
- Browser-private registration-form reading with an editable review step
- Downloadable class schedule PDF templates with student and course details
- Device-saved assignments and projects with deadlines, priorities, effort,
  academic weight, filters, and progress states
- Optional read-only Google Classroom connection with a user-defined semester,
  submission-status summaries, date-grouped activity lists, and private manual
  completion overrides
- Internship placement setup, minute-accurate daily logs, reflections,
  absences, configurable daily credit limits, and a Philippine work-calendar
  completion forecast
- Device-saved allowance periods and categorized expense records
- Exact-centavo totals, remaining allowance, daily budget, forecasts, and
  category summaries
- Light, dark, keyboard-focus, and reduced-motion styling
- Terms of Service and Privacy Policy product drafts

Class details, schedules, assignments, internship, allowances, and expenses
synchronize to user-owned Supabase tables. Browser storage remains an offline
cache and existing device records are uploaded automatically after the cloud
schema is available. The dashboard header reports checking, syncing, synced,
offline, and failed states without claiming a local-only write is already in
the cloud.

## Supabase database setup

The application expects all SQL files in `../supabase/migrations` to be applied
in filename order. The current migrations are:

`../supabase/migrations/202607290001_student_cloud_records.sql`

`../supabase/migrations/202607290002_internship_calendar_forecast.sql`

`../supabase/migrations/202607290003_remove_internship_daily_hours_default.sql`

`../supabase/migrations/202607290004_optional_internship_activities.sql`

`../supabase/migrations/202607290005_class_schedule_details.sql`

`../supabase/migrations/202607300001_classroom_assignment_preferences.sql`

`../supabase/migrations/202607300002_api_rate_limits.sql`

The first migration creates the record tables, explicit authenticated-role
grants, Row Level Security policies, the profile trigger, and private
`student-files` and `internship-photos` buckets. The second adds the Internship
daily rendered-hours limit and absence records used by the completion forecast.
The third removes the temporary database default so every new placement must
use the company-specific daily limit entered by the student. The fourth makes
the removed activities field optional so a work log can contain only a
reflection. The fifth adds the optional section identifier used by the Class
Schedule screen and its downloadable template. The sixth stores each student's
current-semester start date and manual Classroom completion choices under Row
Level Security. The seventh adds an authenticated, atomic API rate limiter for
account-deletion and Google Classroom endpoints.

Preferred migration workflow:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

If the project is not linked to the CLI yet, the project owner can instead open
the Supabase SQL Editor, paste the complete migration file, and run it once.
Do not paste a service-role key into the app or expose one in any
`NEXT_PUBLIC_` variable. After the migration succeeds, refresh the dashboard;
existing locally cached records will begin synchronizing automatically.

The Internship forecast skips Saturdays, Sundays, recorded absences, and
nationwide Philippine non-working holidays. The student must enter the daily
rendered-hours limit used by their company; the application does not assume an
8-hour policy. The expected end is calculated automatically from that limit,
the required hours, and the start date, then recalculated when an absence is
added or removed. Local holidays and newly issued or amended proclamations are
not automatically included until the calendar data is updated, so the result is
an estimate rather than an official completion date.

Registration forms are processed locally in the browser. The source document
and extracted text are not uploaded to Supabase. Only schedule details that the
student reviews and explicitly saves are synchronized. Student name, student
number, program, and term used in the downloadable schedule header remain in
that browser's local storage.

## Local setup

Requirements:

- Node.js 20 or later
- npm
- An existing Supabase project

Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create `.env.local` with these variable names:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=
GOOGLE_CLASSROOM_CLIENT_ID=
GOOGLE_CLASSROOM_CLIENT_SECRET=
GOOGLE_CLASSROOM_TOKEN_SECRET=
```

`NEXT_PUBLIC_SITE_URL` is optional locally and is used to create absolute social
preview URLs. `SUPABASE_SECRET_KEY` is server-only and is required by the
verified account-deletion route. A legacy project can use
`SUPABASE_SERVICE_ROLE_KEY` instead. Never prefix either secret with
`NEXT_PUBLIC_`, expose it in client code, or commit `.env.local`. The value
must be the server key beginning with `sb_secret_`; do not copy the
`sb_publishable_` value into this variable.

The three `GOOGLE_CLASSROOM_` values are only needed when the optional
Classroom importer is enabled. They are server-only and must never use the
`NEXT_PUBLIC_` prefix. Generate a separate encryption secret containing at
least 32 characters, for example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Supabase authentication

Local development expects:

- Site URL: `http://localhost:3000`
- Allowed redirect URL: `http://localhost:3000/auth/callback`

Before a Vercel release, add the production equivalents in Supabase Auth:

- `https://your-domain.example`
- `https://your-domain.example/auth/callback`

Then set `NEXT_PUBLIC_SITE_URL` to the production origin in Vercel. Keep the
existing Supabase URL and publishable key aligned across the web and future
mobile apps.

Account deletion verifies ownership by sending an email OTP through Supabase
before the server-only Admin API removes the user. In Supabase Dashboard, open
**Authentication → Email Templates → Magic Link** and use `{{ .Token }}` in the
template body so the email contains the code expected by the app, for example:

```html
<h2>Your E-KampusMo verification code</h2>
<p>Enter this code to continue: <strong>{{ .Token }}</strong></p>
<p>If you did not request account deletion, you can ignore this email.</p>
```

Add the same server-only `SUPABASE_SECRET_KEY` to the production deployment
environment. Supabase email rate limits and OTP expiry settings continue to
apply.

## Google Classroom setup

The Assignments page can connect a student's Google account directly to Google
Classroom. It requests only read-only access to active and archived course
names, published coursework, and the student's submission state and late flag.
It does not request submission contents or grades and cannot submit, edit,
grade, or delete Classroom content.

In Google Cloud:

1. Create or select a project and enable the **Google Classroom API**.
2. Open **Google Auth Platform**, configure the app audience and consent
   information, then add these Data Access scopes:
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
3. Create an OAuth client with application type **Web application**.
4. Add this local authorized redirect URI:
   - `http://localhost:3000/api/google-classroom/callback`
5. Before deployment, also add:
   - `https://YOUR_DOMAIN/api/google-classroom/callback`
6. Copy the OAuth client ID and client secret into `.env.local`, set
   `GOOGLE_CLASSROOM_TOKEN_SECRET`, and restart the development server.

The callback normally derives its origin from the request. If a proxy or
deployment requires a fixed value, set this optional server-only variable:

```dotenv
GOOGLE_CLASSROOM_REDIRECT_URI=http://localhost:3000/api/google-classroom/callback
```

For an External app that is still in Testing, add each student account as a
test user. A Google Workspace organization can instead use an Internal app when
only users in that organization should connect. Classroom scopes may require
Google verification before a public production release.

Google access and refresh tokens are encrypted in an HttpOnly cookie and bound
to the signed-in E-KampusMo user. They are not exposed to browser JavaScript or
saved in Supabase. Coursework is fetched only when the student connects or
selects **Refresh Classroom**. A successful response is cached privately for
that signed-in student for two minutes, and the browser may reuse it for 30
seconds. Manual refresh bypasses both caches. These responses are never
eligible for a shared CDN cache. The semester start date and manual completion
overrides synchronize through `classroom_assignment_preferences`; Google
Classroom itself is never modified. Disconnecting Classroom removes the token
while retaining those private preferences.

## Rate limiting

Authenticated account-deletion and Google Classroom API routes use the
`consume_api_rate_limit` database function from
`202607300002_api_rate_limits.sql`. Limits are enforced per user and action.
Rejected requests return HTTP `429`, a `Retry-After` header, and rate-limit
headers. Apply that migration to Supabase before production so the limit is
shared across every deployed server instance. During local setup, or until the
migration is applied, the server uses a temporary per-process fallback that
resets whenever the process restarts.

## Quality checks

```bash
npm run lint
npm run build
```

The production build performs TypeScript validation. Authentication flows that
send email or open Google OAuth also require the connected Supabase project and
its configured redirect URLs.

## Security notes

- Private application tables must use `user_id`, explicit grants, and Row Level
  Security policies based on `auth.uid() = user_id`.
- Internship entries are personal records, not official employer records.
- Production Terms and Privacy text should receive qualified legal review.
- Do not commit `.env.local` or any secret keys.

## Deployment

The Next.js app is structured for Vercel, but this repository has not been
deployed by Codex. Run the quality checks, configure production redirect URLs
and environment variables, then deploy through the project’s approved Vercel
workflow.

The Expo mobile application and EAS setup have not been created yet.
