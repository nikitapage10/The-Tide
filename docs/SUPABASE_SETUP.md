# Supabase setup (connected mode)

Nothing here has been done for you: no Supabase project exists yet. These steps have **not** been run against a hosted project. The SQL itself has been run and tested against a local Postgres 16 with a stub of Supabase's `auth`/`storage` schemas (see [TEST_REPORT.md](TEST_REPORT.md)).

## 1. Create the project

Create a Supabase project. Note the **Project URL** and the **publishable key** (Settings → API keys; older projects call it the *anon* key). The secret / service-role key is needed **only** if you enable the machine publisher.

## 2. Apply the migrations

**Automatic (recommended):** add the repository secret `SUPABASE_DB_URL` (Supabase → Connect → *Session pooler* connection string with your password) under GitHub → Settings → Secrets and variables → Actions. The **Supabase migrations** workflow (`.github/workflows/supabase-migrations.yml`) then applies new migrations and the idempotent `seed.sql` on every push to the default branch that changes `supabase/`, and can be run by hand from the Actions tab. Optionally add `TIDE_GM_EMAIL` and the same workflow makes you GM after your first sign-in.

**By hand:**

Option A, with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push            # applies supabase/migrations/*.sql in order
```

Option B, by hand: paste `supabase/migrations/20261007000001_tide_core.sql` and then `…000002_tide_storage.sql` into the SQL editor and run them.

Then run `supabase/seed.sql`, which creates the single project row with ID `333ea628-f6a1-4f3a-8b83-ce98d12f2565` (the fixture project ID, so the seed bundle imports unchanged). You may choose another UUID, but then change `projectId` in any bundle you import and in the asset paths.

The migrations create:
- tables, constraints and triggers for identities, releases and live records (no cascading deletes)
- Row Level Security on every table: only members with `role = 'gm'` can read or write a project's rows; anonymous users get nothing
- no write grants on published tables; releases go through `tide_commit_release`
- a private `tide-private` storage bucket with GM-only policies based on the first path segment (`<project_id>/…`)
- no Realtime publication (the UI refetches)

## 3. Configure Auth

- **Providers:** Email (magic link). New sign-ups are not needed. The login form uses `shouldCreateUser: false`, so you can disable "Allow new users to sign up" and **invite** yourself under Authentication → Users.
- **URL configuration:**
  - Site URL: `http://localhost:3000` for local work; later your Vercel production URL.
  - Redirect URLs: `http://localhost:3000/auth/callback`, plus `https://<your-domain>/auth/callback` (and a preview-domain pattern if you use Vercel previews).
- Customise the email templates if you want; the default magic link works with `/auth/callback`.

## 4. Make yourself the GM

Sign in once (or invite yourself) so your user exists, then run in the SQL editor:

```sql
insert into public.project_members (project_id, user_id, role)
select '333ea628-f6a1-4f3a-8b83-ce98d12f2565', id, 'gm' from auth.users where email = 'you@example.com';
```

Membership is deliberately not editable from the app.

## 5. Environment

`.env.local` (local) or Vercel project settings:

```
TIDE_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
TIDE_PROJECT_ID=333ea628-f6a1-4f3a-8b83-ce98d12f2565
# optional, machine publisher only (server-side secrets):
# SUPABASE_SECRET_KEY=<secret key>
# TIDE_PUBLISHER_TOKEN_SHA256=<sha256 hex of your random token>
```

If `TIDE_DATA_MODE` is unset but `NEXT_PUBLIC_SUPABASE_URL` and a publishable/anon key are present (as the Vercel ↔ Supabase integration provides), the app uses Supabase automatically, and `TIDE_PROJECT_ID` defaults to the `seed.sql` project ID. If any required value is missing the app shows **Setup required**. It never falls back to demo data.

## 6. Publish the seed lore

Start the app (`npm run dev`), sign in, open **The Workshop → Publishing**, load `fixtures/publication/seed-release.json`, preview and publish. The seed has `baseReleaseId: null`, so it only applies to an empty project. It includes clearly labelled demo records; archive them later with a bundle if you don't want them.

Live demo fixtures (`fixtures/live/demo-live.json`) are **not** loaded into Supabase.

## 7. Private assets (optional)

Upload files to bucket `tide-private` under `<project_id>/…` (Supabase dashboard → Storage). Reference them from a media record: `"asset": { "bucket": "tide-private", "path": "<project_id>/art/file.png" }`. The app issues a 60-second signed URL per click, after checking access.

## 8. Generating a publisher token hash (only if you enable it)

```bash
node -e "const t=require('crypto').randomBytes(32).toString('base64url');console.log('token:',t);console.log('sha256:',require('crypto').createHash('sha256').update(t).digest('hex'))"
```

Give the token to the publisher's secret store and put only the sha256 value in `TIDE_PUBLISHER_TOKEN_SHA256`.

## Local Supabase (optional)

With Docker available you can run `npx supabase init` (keep the existing `supabase/migrations`) and `npx supabase start`, then use the local URL and keys it prints. `npx supabase db reset` reapplies the migrations and `seed.sql`. This environment had no Docker daemon, so it was not tried here.
