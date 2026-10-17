import { useState, type FormEvent } from 'react'
import { createDispute, ISSUE_LABELS, ISSUE_TYPES, NETWORKS, type Dispute, type IssueType, type Network } from '../disputes'

export default function AddCaseForm({ onAdded }: { onAdded: (newCase: Dispute) => void }) {
  const [network, setNetwork] = useState<Network>('MTN')
  const [amount, setAmount] = useState('')
  const [txnRef, setTxnRef] = useState('')
  const [issueType, setIssueType] = useState<IssueType>('wrong_number')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Client-side checks are for convenience only; the database constraints are the real validation.
    const amountGhs = Number(amount)
    if (!amount.trim() || !Number.isFinite(amountGhs) || amountGhs <= 0) {
      setError('Amount must be a number greater than 0.')
      return
    }

    setSaving(true)
    try {
      const newCase = await createDispute({
        network,
        amount_ghs: amountGhs,
        txn_ref: txnRef.trim() || null,
        issue_type: issueType,
        notes: notes.trim() || null,
      })
      onAdded(newCase)
      setAmount('')
      setTxnRef('')
      setNotes('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card add-form">
      <h2>Add a case</h2>
      <div className="form-grid">
        <label>
          Network
          <select value={network} onChange={(e) => setNetwork(e.target.value as Network)}>
            {NETWORKS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Amount (GHS)
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Transaction reference (optional)
          <input value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
        </label>
        <label>
          Issue
          <select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)}>
            {ISSUE_TYPES.map((t) => (
              <option key={t} value={t}>{ISSUE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label className="full">
          Notes (optional)
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add case'}</button>
    </form>
  )
}
