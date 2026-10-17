import { useState } from 'react'
import { ISSUE_LABELS, STATUSES, type Dispute, type DisputeChanges, type Status } from '../disputes'

type Props = {
  dispute: Dispute
  onUpdate: (id: string, changes: DisputeChanges) => Promise<boolean>
  onDelete: (id: string) => void
}

export default function CaseCard({ dispute, onUpdate, onDelete }: Props) {
  const savedNotes = dispute.notes ?? ''
  const [notes, setNotes] = useState(savedNotes)
  const [busy, setBusy] = useState(false)

  async function handleStatusChange(status: Status) {
    setBusy(true)
    await onUpdate(dispute.id, { status })
    setBusy(false)
  }

  async function handleSaveNotes() {
    setBusy(true)
    const trimmed = notes.trim()
    const saved = await onUpdate(dispute.id, { notes: trimmed || null })
    if (saved) setNotes(trimmed)
    setBusy(false)
  }

  return (
    <li className={`card case status-${dispute.status}`}>
      <div className="case-head">
        <div>
          <div className="amount">GHS {Number(dispute.amount_ghs).toFixed(2)}</div>
          <div className="case-meta">
            <span className="chip">{dispute.network}</span>
            <span>{ISSUE_LABELS[dispute.issue_type]}</span>
          </div>
        </div>
        <span className="badge">{dispute.status}</span>
      </div>
      {dispute.txn_ref && <div className="muted">Ref: {dispute.txn_ref}</div>}
      <div className="muted">Logged {new Date(dispute.created_at).toLocaleString()}</div>
      <label>
        Status
        <select value={dispute.status} disabled={busy} onChange={(e) => handleStatusChange(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Notes
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="actions">
        <button className="btn btn-secondary" onClick={handleSaveNotes} disabled={busy || notes === savedNotes}>
          Save notes
        </button>
        <button className="btn btn-danger" onClick={() => onDelete(dispute.id)} disabled={busy}>
          Delete
        </button>
      </div>
    </li>
  )
}
