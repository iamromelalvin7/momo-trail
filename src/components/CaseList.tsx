import { useEffect, useState } from 'react'
import { deleteDispute, listDisputes, updateDispute, type Dispute, type DisputeChanges } from '../disputes'
import AddCaseForm from './AddCaseForm'
import CaseCard from './CaseCard'

export default function CaseList() {
  const [cases, setCases] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listDisputes()
      .then(setCases)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleAdded(newCase: Dispute) {
    setCases((prev) => [newCase, ...prev])
  }

  // Returns true if the update worked, so the card knows whether to keep its edits.
  async function handleUpdate(id: string, changes: DisputeChanges): Promise<boolean> {
    setError(null)
    try {
      const updated = await updateDispute(id, changes)
      setCases((prev) => prev.map((c) => (c.id === id ? updated : c)))
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this case? This cannot be undone.')) return
    setError(null)
    try {
      await deleteDispute(id)
      setCases((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <>
      <AddCaseForm onAdded={handleAdded} />
      <h2 className="section-title">Your cases</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? (
        <p className="muted" role="status">Loading cases…</p>
      ) : cases.length === 0 ? (
        <p className="muted">No cases yet. Add one above.</p>
      ) : (
        <ul className="cases">
          {cases.map((c) => (
            <CaseCard key={c.id} dispute={c} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </>
  )
}
