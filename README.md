# MoMo Trail

Mobile money users in Ghana run into wrong number transfers, failed debits and pending reversals all the time. The evidence ends up scattered across screenshots and SMS, the transaction reference gets lost, the escalation window passes, and the user has nothing organised to show the network's support team. MoMo Trail gives each user one private place to log a case and follow it until it is resolved. Access control is enforced by Postgres Row Level Security (RLS) in Supabase, not by frontend code.

**Live link:** _TODO: add the Vercel URL after deploy_

## How to use MoMo Trail

### Sign in

Open the app and click **Continue with Google**. Google shows its account chooser every time, so you can pick an account or add a different one. You only ever see your own cases.

### Log a case

Fill in the **Add a case** form and click **Add case**:

| Field | What to enter |
| --- | --- |
| Network | MTN, Telecel or AT |
| Amount (GHS) | How much money is involved. Must be more than 0. |
| Transaction reference | Optional, but worth adding. It is the ID in your MoMo SMS, and support teams ask for it first. |
| Issue | **Wrong number transfer** (you sent money to the wrong person), **Failed debit** (money left your wallet but the payment did not go through) or **Pending reversal** (a reversal was promised but has not arrived) |
| Notes | Optional. Anything useful: who you spoke to, ticket numbers, what they promised. |

Your new case appears at the top of **Your cases**. Cases are listed newest first.

### Track a case

Each case has a status. Change it from the **Status** dropdown on the case card; it saves straight away.

- **Open** (yellow): you have logged the problem.
- **Escalated** (red): you have reported it to the network's support team.
- **Resolved** (plain): the problem is sorted.

### Edit notes or delete a case

- To update notes, edit the **Notes** box on the card and click **Save notes**.
- To remove a case, click **Delete** and confirm. This cannot be undone.

### Sign out

Click **Sign out** at the top right. This signs you out of MoMo Trail, not out of your Google account.

### Your privacy

Your cases are visible only to you. The database itself blocks every other user, and anyone who is not signed in, from reading or changing them (see [the RLS policies](#the-rls-policies-in-plain-words) and the [isolation test](#isolation-test) below). MoMo Trail does not connect to your mobile money account, and it never asks for your PIN.

## Stack

- Supabase: Postgres, Auth (Google provider), RLS
- Frontend: Vite, React, TypeScript, `@supabase/supabase-js`
- Deploy: Vercel
- No custom backend server. The database enforces the rules.

## Repo layout

```
supabase/migrations/0001_disputes.sql   table, index, RLS policies
src/
  App.tsx                               signed-in / signed-out switch, sign out
  supabase.ts                           Supabase client (anon key only)
  disputes.ts                           case types, allowed values, all database calls
  components/SignInPage.tsx             landing page with Google sign-in
  components/CaseList.tsx               loads cases, handles update and delete
  components/AddCaseForm.tsx            add-case form
  components/CaseCard.tsx               one case: status, notes, delete
  index.css                             styles
scripts/rls-test.mjs                    two-user isolation test
.env.example                            placeholder env vars
```

## Setup

You need Node.js 20.6 or newer, a Supabase account, a Google Cloud account and a Vercel account.

### 1. Create the Supabase project

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In **Project Settings → API**, copy the **Project URL** and the **anon / publishable** key. Do not copy the service role key; this project never uses it.

### 2. Run the migration

Open **SQL Editor** in the Supabase dashboard, paste the contents of `supabase/migrations/0001_disputes.sql` and run it.
(If you use the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push`.)

### 3. Enable Google login

1. In [Google Cloud Console](https://console.cloud.google.com/), go to **APIs & Services → Credentials** and create an **OAuth client ID** of type **Web application**. (Configure the OAuth consent screen first if asked.)
2. Under **Authorised redirect URIs**, add the Supabase callback URL:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (Supabase shows this exact URL on the Google provider page.)
3. In Supabase, go to **Authentication → Sign In / Providers → Google**, enable it, and paste the Google **client ID** and **client secret**. The secret lives only in the Supabase dashboard, never in this repo.
4. In Supabase **Authentication → URL Configuration**, add both of these to **Redirect URLs**:
   - `http://localhost:5173`
   - your Vercel domain, e.g. `https://momo-trail.vercel.app`

   A missing Vercel domain here is the most common reason login breaks after deploy.

### 4. Set env vars and run locally

```bash
cp .env.example .env      # then fill in the two values from step 1
npm install
npm run dev               # http://localhost:5173
```

`.env` is git-ignored. It holds only:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 5. Deploy to Vercel

1. Import the repo into Vercel (framework preset: Vite).
2. In **Project Settings → Environment Variables**, set the same two variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy, then make sure the Vercel domain is in the Supabase redirect URLs (step 3.4).

## The RLS policies in plain words

The `public.disputes` table has RLS turned on. With RLS on, Postgres denies every row by default, and only the policies below open anything up. All four policies apply only to the `authenticated` role (signed-in users).

- **select own:** you can only see rows where `user_id` is your own user id.
- **insert own:** you can only insert a row if its `user_id` is your own id. The frontend never sends `user_id`; the column default `auth.uid()` fills it in. If someone sends another user's id anyway, the insert is rejected.
- **update own:** you can only update your own rows (`using`), and the row must still belong to you after the update (`with check`). Without `with check`, a user could change `user_id` on their own row and hand it to someone else.
- **delete own:** you can only delete your own rows.
- **No policy for `anon`:** a request without a signed-in session matches no policy, so it gets nothing back.

`auth.uid()` is wrapped as `(select auth.uid())` so Postgres evaluates it once per query instead of once per row. `user_id` is indexed so these checks stay fast.

The frontend only ever has the anon (publishable) key. That key is safe to expose because it grants nothing on its own; every row is guarded by the policies above. The service role key, which bypasses RLS, is not used anywhere in this project.

## Isolation test

The test uses two real Google accounts, **user A** and **user B**.

1. User A signs in to the app and creates a case.
2. User B selects from `disputes`. Expected: empty result (none of A's rows).
3. User B updates A's row by its id. Expected: 0 rows affected.
4. User B deletes A's row by its id. Expected: 0 rows affected.
5. User B inserts a row with A's `user_id`. Expected: rejected by RLS.
6. User B updates their own row and sets `user_id` to A's id. Expected: rejected by RLS.
7. A request with no session selects from `disputes`. Expected: empty result or denied.

Step 1 is done by hand in the app. Steps 2 to 7 are automated in `scripts/rls-test.mjs`, which prints PASS or FAIL per check. For steps 3 and 4 the script also re-reads A's row as A to confirm it was not changed or deleted. For step 6 the script creates a temporary row as B and deletes it afterwards.

### Getting the two access tokens

1. Run the app (`npm run dev`) and sign in as user A in a normal browser window. Create at least one case.
2. Sign in as user B in a separate browser profile or a private window (so the two sessions do not overwrite each other).
3. In each window, open DevTools → Console and run:

   ```js
   JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token')))).access_token
   ```

   (Or find the `sb-<project-ref>-auth-token` key under DevTools → Application → Local Storage and copy its `access_token` field.)

Access tokens expire after about an hour. Do not commit them or paste them anywhere public.

### Running the test

The script reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`, and the two tokens from your shell.

Bash:

```bash
USER_A_TOKEN="<token A>" USER_B_TOKEN="<token B>" npm run test:rls
```

PowerShell:

```powershell
$env:USER_A_TOKEN="<token A>"; $env:USER_B_TOKEN="<token B>"; npm run test:rls
```

### Results

Run on 2026-10-17 against the Supabase project, with two real Google accounts. Step 1 was done by hand: user A signed in to the app and created a case. Steps 2 to 7 were run with `npm run test:rls`.

| Step | Check | Expected | Result |
| --- | --- | --- | --- |
| 2 | B selects from `disputes` | No rows of A | PASS: 1 row returned, owned by B; 0 rows of A |
| 3 | B updates A's row by id | 0 rows affected | PASS: 0 rows affected, A's row unchanged |
| 4 | B deletes A's row by id | 0 rows affected | PASS: 0 rows affected, A's row still exists |
| 5 | B inserts a row with A's `user_id` | Rejected by RLS | PASS: `42501` new row violates row-level security policy |
| 6 | B sets own row's `user_id` to A | Rejected by RLS | PASS: `42501` new row violates row-level security policy |
| 7 | No session selects from `disputes` | Empty or denied | PASS: 0 rows returned |

In step 2, user B already had one case of their own, so B's select returned that row and nothing else. None of A's rows were visible.

Script output:

```
User A: 4baa3364-1a26-4930-be46-ed28c40e0f8c
User B: 822a369e-fbd8-48fc-832e-ed9de818eb8b
Target row (owned by A): f1fbc4ca-5a3c-4017-aaa3-e1f17014087b

PASS  2. B selects from disputes: sees no rows of A  (1 row(s) returned, 0 not owned by B)
PASS  3. B updates A's row by id: 0 rows affected  (0 row(s) affected, A's row unchanged)
PASS  4. B deletes A's row by id: 0 rows affected  (0 row(s) affected, A's row still exists)
PASS  5. B inserts a row with A's user_id: rejected  (42501: new row violates row-level security policy for table "disputes")
PASS  6. B reassigns own row to A: rejected  (42501: new row violates row-level security policy for table "disputes")
PASS  7. No session selects from disputes: empty or denied  (0 row(s) returned)
```

## Secrets check

- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used, both safe to expose.
- `.env` is git-ignored; `.env.example` holds placeholders only.
- The Google client secret lives only in the Supabase dashboard.
- To confirm nothing leaked, search the working tree and the full git history:

  ```bash
  git grep -n -E "eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_[A-Za-z0-9_-]{10,}"
  git grep -n -E "eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_[A-Za-z0-9_-]{10,}" $(git rev-list --all)
  ```

  The first pattern matches any JWT (legacy anon and service role keys, access tokens); the second matches Supabase's newer secret keys. Neither command should print anything.

## What I would add next (not built)

These are ideas for later. None of them exist in this version.

- Reminders before a network's escalation window closes.
- Uploads for screenshots and SMS evidence.
