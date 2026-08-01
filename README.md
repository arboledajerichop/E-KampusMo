# E-KampusMo

**Your academic life, organized.**

E-KampusMo is a private student companion for managing class schedules, assignments, Google Classroom workloads, internship records, expenses, reminders, and personal notes in one responsive dashboard.

## Features

- Email/password authentication and Google sign-in
- Protected student dashboard with responsive mobile navigation
- Class schedule management with overlap detection, class details, meeting links, and downloadable PDF schedules
- Browser-based registration-form reading with an editable review step
- Assignment and project tracking with deadlines, priorities, filters, and progress states
- Optional read-only Google Classroom integration with semester filtering and manual completion overrides
- Internship placement setup, daily logs, absences, reflections, and completion-date forecasting
- Expense and allowance tracking with daily, weekly, monthly, yearly, category, and history views
- Reminders and personal notepad
- Offline browser cache with Supabase cloud synchronization
- Account deletion with email verification
- Per-user rate limiting for sensitive account and Google Classroom routes

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend and Database

- Supabase
- PostgreSQL
- Next.js Route Handlers

### APIs and Services

- Google OAuth 2.0
- Google Classroom API
- Google Cloud Console
- Vercel

### Development Tools

- Node.js
- Git and GitHub
- VS Code

## Data, Privacy, and Offline Support

Supported records such as schedules, assignments, internship entries, allowances, and expenses synchronize to user-owned Supabase tables.

Browser storage acts as an offline cache so the dashboard can continue showing saved records while the device is offline or cloud synchronization is pending. The interface reports checking, syncing, synced, offline, and failed states separately.

Registration forms are processed locally in the browser. The source file and extracted text are not uploaded to Supabase. Only reviewed schedule details that the student explicitly saves are synchronized.

Google Classroom uses read-only permissions. E-KampusMo cannot submit, edit, grade, or delete Classroom content.

## Caching

Google Classroom coursework is cached privately for the signed-in user to reduce repeated API requests:

- Server-side cache: 2 minutes
- Browser reuse: 30 seconds
- Manual **Refresh Classroom** bypasses both caches
- Responses are private and are not intended for a shared CDN cache

Google access and refresh tokens are encrypted in an HttpOnly cookie. They are not exposed to browser JavaScript or stored in Supabase.

## Rate Limiting

Sensitive authenticated routes use a Supabase-backed rate limiter to reduce abuse, accidental request loops, repeated account-deletion attempts, and excessive Google Classroom API usage.

Rate limits are enforced per user and action through the `consume_api_rate_limit` database function. Rejected requests return:

```text
429 Too Many Requests
```

Responses also include `Retry-After` and rate-limit headers. If the database limiter is temporarily unavailable during local development, the server uses a per-process fallback that resets when the process restarts.


## Environment Variables

Create `web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SUPABASE_SECRET_KEY=

GOOGLE_CLASSROOM_CLIENT_ID=
GOOGLE_CLASSROOM_CLIENT_SECRET=
GOOGLE_CLASSROOM_TOKEN_SECRET=
```

The Google Classroom variables are required only when the Classroom importer is enabled.

Never commit `.env.local`. Server-only secrets must never use the `NEXT_PUBLIC_` prefix.

## Supabase Setup

Apply the SQL migrations in `supabase/migrations` in filename order.

Using the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migrations configure:

- Student-owned record tables
- Row Level Security policies
- Profile creation
- Private storage buckets
- Internship forecasting
- Class schedule details
- Google Classroom preferences
- API rate limiting

## Authentication URLs

For local development, configure these in Supabase Authentication:

```text
Site URL:
http://localhost:3000

Redirect URL:
http://localhost:3000/auth/callback
```

For production, add the equivalent Vercel domain and callback URL.

## Google Classroom Setup

1. Create or select a Google Cloud project.
2. Enable the Google Classroom API.
3. Configure the OAuth consent screen.
4. Add these read-only scopes:

```text
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.coursework.me.readonly
```

5. Create a Web application OAuth client.
6. Add this local redirect URI:

```text
http://localhost:3000/api/google-classroom/callback
```

7. Add the production equivalent before deployment.
8. Save the client ID and client secret in `web/.env.local`.

## Internship Forecast

The forecast considers:

- Required internship hours
- Logged rendered hours
- The company-specific daily credited-hour limit
- Saturdays and Sundays
- Recorded absences
- Nationwide Philippine non-working holidays

The calculated date is an estimate and should still be verified with the school or employer.

## Deployment

Recommended Vercel settings:

```text
Production branch: main
Root Directory: web
Framework: Next.js
```

Add production environment variables in Vercel, then configure the production redirect URLs in Supabase and Google Cloud.

## Security Notes

- Private tables use Row Level Security and authenticated user ownership.
- Secret keys remain server-only.
- Environment files are excluded from Git.
- Account deletion requires email verification.
- Google Classroom access is read-only.
- Registration-form files remain in the browser.
- Internship records are personal tracking records, not official employer records.

## Disclaimer

E-KampusMo is a student productivity tool. Academic records, internship forecasts, reminders, and expense calculations should still be verified against official school, employer, or financial information.
