import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { STATUS_LABELS, type RequirementStatus } from '../domain/compliance'
import type { Employee } from '../domain/types'

const STATUS_STYLES: Record<RequirementStatus, string> = {
  missing: 'bg-red-100 text-red-800 ring-red-200',
  expired: 'bg-red-100 text-red-800 ring-red-200',
  expiring: 'bg-amber-100 text-amber-800 ring-amber-200',
  valid: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'red' | 'amber' | 'green' | 'blue' }) {
  const tones = {
    gray: 'bg-slate-100 text-slate-700 ring-slate-200',
    red: 'bg-red-100 text-red-800 ring-red-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
    green: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    blue: 'bg-sky-100 text-sky-800 ring-sky-200',
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: RequirementStatus }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function EmployeeLink({ employee }: { employee: Employee | undefined }) {
  if (!employee) return <span>—</span>
  return (
    <Link className="text-sky-700 hover:underline" to={`/employees/${employee.id}`}>
      {employee.lastName} {employee.firstName}
    </Link>
  )
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-full max-w-2xl rounded-lg p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800" aria-label="Zavřít dialog">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'red' | 'amber' | 'green' }) {
  const color =
    tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  )
}

export const buttonClass =
  'inline-flex items-center rounded border border-slate-300 bg-white px-2.5 py-1 text-sm hover:bg-slate-50 disabled:opacity-50'
export const primaryButtonClass =
  'inline-flex items-center rounded bg-sky-700 px-2.5 py-1 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50'
export const inputClass = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm'
