// Everything about a dispute ("case" in the UI): its shape, allowed values, and database calls.
// Access control is not done here. RLS in the database decides which rows each user can touch.

import { supabase } from './supabase'

export const NETWORKS = ['MTN', 'Telecel', 'AT'] as const
export const ISSUE_TYPES = ['wrong_number', 'failed_debit', 'pending_reversal'] as const
export const STATUSES = ['open', 'escalated', 'resolved'] as const

export type Network = (typeof NETWORKS)[number]
export type IssueType = (typeof ISSUE_TYPES)[number]
export type Status = (typeof STATUSES)[number]

export const ISSUE_LABELS: Record<IssueType, string> = {
  wrong_number: 'Wrong number transfer',
  failed_debit: 'Failed debit',
  pending_reversal: 'Pending reversal',
}

export type Dispute = {
  id: string
  user_id: string
  network: Network
  amount_ghs: number
  txn_ref: string | null
  issue_type: IssueType
  status: Status
  notes: string | null
  created_at: string
}

// user_id is not included: the database default (auth.uid()) sets it.
export type NewDispute = Pick<Dispute, 'network' | 'amount_ghs' | 'txn_ref' | 'issue_type' | 'notes'>

export type DisputeChanges = Partial<Pick<Dispute, 'status' | 'notes'>>

// Each function throws an Error with the database message if the call fails.

export async function listDisputes(): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Dispute[]
}

export async function createDispute(dispute: NewDispute): Promise<Dispute> {
  const { data, error } = await supabase.from('disputes').insert(dispute).select().single()
  if (error) throw new Error(error.message)
  return data as Dispute
}

export async function updateDispute(id: string, changes: DisputeChanges): Promise<Dispute> {
  const { data, error } = await supabase.from('disputes').update(changes).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Dispute
}

export async function deleteDispute(id: string): Promise<void> {
  const { error } = await supabase.from('disputes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
