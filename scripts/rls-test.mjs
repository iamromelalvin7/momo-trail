// Two-user RLS isolation test for public.disputes (PRD section 11, steps 2 to 7).
//
// Required environment variables:
//   VITE_SUPABASE_URL       project URL (read from .env by `npm run test:rls`)
//   VITE_SUPABASE_ANON_KEY  anon / publishable key (read from .env by `npm run test:rls`)
//   USER_A_TOKEN            access token of user A (who already created at least one case in the app)
//   USER_B_TOKEN            access token of user B
//
// Run: npm run test:rls

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const tokenA = process.env.USER_A_TOKEN
const tokenB = process.env.USER_B_TOKEN

if (!url || !anonKey || !tokenA || !tokenB) {
  console.error('Missing env vars. Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, USER_A_TOKEN, USER_B_TOKEN.')
  process.exit(1)
}

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

function clientFor(token) {
  return createClient(url, anonKey, {
    auth: authOptions,
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

const a = clientFor(tokenA)
const b = clientFor(tokenB)
const anon = createClient(url, anonKey, { auth: authOptions })

let failures = 0
function report(step, name, pass, detail) {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${step}. ${name}${detail ? `  (${detail})` : ''}`)
}

async function userId(client, token, label) {
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) {
    console.error(`Could not read user ${label} from token: ${error?.message ?? 'no user'}. Tokens expire after about an hour.`)
    process.exit(1)
  }
  return data.user.id
}

const idA = await userId(a, tokenA, 'A')
const idB = await userId(b, tokenB, 'B')
if (idA === idB) {
  console.error('USER_A_TOKEN and USER_B_TOKEN belong to the same user. Use two different Google accounts.')
  process.exit(1)
}

// Step 1 is done in the app: user A signs in and creates a case. Use A's newest case as the target.
const { data: aRows, error: aErr } = await a
  .from('disputes')
  .select('id, user_id, notes')
  .order('created_at', { ascending: false })
  .limit(1)
if (aErr || !aRows?.length) {
  console.error(`User A has no case to test against (${aErr?.message ?? 'no rows'}). Sign in as A and create a case first.`)
  process.exit(1)
}
const rowA = aRows[0]
console.log(`User A: ${idA}\nUser B: ${idB}\nTarget row (owned by A): ${rowA.id}\n`)

// Re-reads A's row as A, to confirm B's attempts changed nothing.
async function rowAAsA() {
  const { data, error } = await a.from('disputes').select('id, user_id, notes').eq('id', rowA.id).maybeSingle()
  if (error) throw new Error(`Re-reading A's row as A failed: ${error.message}`)
  return data
}

// Step 2: B selects from disputes. Expected: none of A's rows.
{
  const { data, error } = await b.from('disputes').select('id, user_id')
  const foreign = (data ?? []).filter((r) => r.user_id !== idB)
  report(2, 'B selects from disputes: sees no rows of A', !error && foreign.length === 0,
    error ? error.message : `${data.length} row(s) returned, ${foreign.length} not owned by B`)
}

// Step 3: B updates A's row by id. Expected: 0 rows affected.
{
  const { data, error } = await b.from('disputes').update({ notes: 'changed by B' }).eq('id', rowA.id).select('id')
  const after = await rowAAsA()
  const unchanged = after !== null && after.notes === rowA.notes
  report(3, "B updates A's row by id: 0 rows affected", !error && data.length === 0 && unchanged,
    error ? error.message : `${data.length} row(s) affected, A's row ${unchanged ? 'unchanged' : 'CHANGED'}`)
}

// Step 4: B deletes A's row by id. Expected: 0 rows affected.
{
  const { data, error } = await b.from('disputes').delete().eq('id', rowA.id).select('id')
  const after = await rowAAsA()
  report(4, "B deletes A's row by id: 0 rows affected", !error && data.length === 0 && after !== null,
    error ? error.message : `${data.length} row(s) affected, A's row ${after ? 'still exists' : 'DELETED'}`)
}

// Step 5: B inserts a row with A's user_id. Expected: rejected by RLS.
{
  const { error } = await b.from('disputes').insert({
    user_id: idA,
    network: 'MTN',
    amount_ghs: 1,
    issue_type: 'wrong_number',
    notes: 'inserted by B as A',
  })
  report(5, "B inserts a row with A's user_id: rejected", error?.code === '42501',
    error ? `${error.code}: ${error.message}` : 'insert succeeded')
}

// Step 6: B updates their own row and sets user_id to A. Expected: rejected by RLS.
{
  const { data: own, error: insErr } = await b
    .from('disputes')
    .insert({ network: 'MTN', amount_ghs: 1, issue_type: 'wrong_number', notes: 'rls-test temp row' })
    .select('id')
    .single()
  if (insErr) {
    report(6, "B reassigns own row to A: rejected", false, `could not create B's own row: ${insErr.message}`)
  } else {
    const { error } = await b.from('disputes').update({ user_id: idA }).eq('id', own.id)
    report(6, "B reassigns own row to A: rejected", error?.code === '42501',
      error ? `${error.code}: ${error.message}` : 'update succeeded')
    const { error: delErr } = await b.from('disputes').delete().eq('id', own.id)
    if (delErr) console.log(`      note: could not clean up B's temp row ${own.id}: ${delErr.message}`)
  }
}

// Step 7: request with no session. Expected: empty result or denied.
{
  const { data, error } = await anon.from('disputes').select('id')
  report(7, 'No session selects from disputes: empty or denied', Boolean(error) || data.length === 0,
    error ? `denied: ${error.message}` : `${data.length} row(s) returned`)
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`)
process.exit(failures === 0 ? 0 : 1)
