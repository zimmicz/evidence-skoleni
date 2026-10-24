import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Booking } from '../domain/booking'
import { STATUS_LABELS } from '../domain/compliance'
import { formatDate } from '../domain/dates'
import { toCsv } from '../domain/export'
import type { Session } from '../domain/types'
import { useStore } from '../state'
import { Badge, buttonClass, EmployeeLink, primaryButtonClass, StatusBadge } from '../ui/components'
import { MoveForm } from '../ui/forms'

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function SessionCard({ session, initiallyOpen }: { session: Session; initiallyOpen: boolean }) {
  const { dataset, compliance, plan, referenceDate, confirm, unconfirm, dismiss } = useStore()
  const [copied, setCopied] = useState(false)
  const employees = new Map(dataset.employees.map((e) => [e.id, e]))
  const confirmed = plan.confirmed.filter((b) => b.sessionId === session.id)
  const suggested = plan.suggested.filter((b) => b.sessionId === session.id)
  const offered = plan.offered.some((s) => s.id === session.id)
  const free = plan.free.get(session.id) ?? 0
  const alternatives = plan.offered.filter((s) => s.code === session.code && ((plan.free.get(s.id) ?? 0) > 0 || s.id === session.id))
  const requirement = (b: Booking) => compliance.get(b.employeeId)?.requirements.find((r) => r.code === b.code)
  const attendees = [...confirmed.map((b) => ({ b, confirmed: true })), ...suggested.map((b) => ({ b, confirmed: false }))]

  const state =
    session.status === 'zrušeno' ? (
      <Badge>zrušeno</Badge>
    ) : session.date < referenceDate ? (
      <Badge>proběhlo</Badge>
    ) : session.blocked ? (
      <Badge tone="red">{session.blocked}</Badge>
    ) : (
      <Badge tone={free > 0 ? 'green' : 'amber'}>volno po návrzích {free}</Badge>
    )

  const exportCsv = () => {
    const rows = attendees.map(({ b, confirmed }) => {
      const e = employees.get(b.employeeId)
      return [b.employeeId, e?.lastName ?? '', e?.firstName ?? '', e?.email ?? '', e?.department ?? '', confirmed ? 'potvrzeno' : 'návrh']
    })
    download(`${session.id}-${session.code}-${session.date}.csv`, toCsv([['id', 'prijmeni', 'jmeno', 'email', 'utvar', 'stav'], ...rows]))
  }

  const copyEmails = async () => {
    const emails = attendees.map(({ b }) => employees.get(b.employeeId)?.email).filter(Boolean)
    await navigator.clipboard.writeText(emails.join('; '))
    setCopied(true)
  }

  return (
    <details
      className="rounded-lg border border-slate-200 bg-white"
      data-testid={`session-${session.id}`}
      open={initiallyOpen || undefined}
      ref={(el) => {
        if (el && initiallyOpen) el.scrollIntoView({ block: 'center' })
      }}
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
        <span className="font-medium">{session.id}</span>
        <span>{formatDate(session.date)}</span>
        <span>{session.time}</span>
        <span>{session.place}</span>
        <span className="text-slate-500">
          kapacita {session.capacity}, obsazeno z exportu {session.taken}
        </span>
        {offered && (
          <span className="text-slate-500">
            potvrzeno {confirmed.length}, návrhů {suggested.length}
          </span>
        )}
        {state}
      </summary>
      {offered && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!suggested.length}
              onClick={() => suggested.forEach((b) => confirm(b.employeeId, b.code, b.sessionId))}
            >
              Potvrdit všechny návrhy
            </button>
            <button type="button" className={buttonClass} disabled={!attendees.length} onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className={buttonClass} disabled={!attendees.length} onClick={copyEmails}>
              {copied ? 'Zkopírováno' : 'Kopírovat e-maily'}
            </button>
          </div>
          {attendees.length === 0 ? (
            <p className="text-sm text-slate-500">Nikdo k přihlášení.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">Zaměstnanec</th>
                  <th>Útvar</th>
                  <th>Stav povinnosti</th>
                  <th>Platnost do</th>
                  <th>Přihláška</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {attendees.map(({ b, confirmed }) => {
                  const r = requirement(b)
                  const e = employees.get(b.employeeId)
                  return (
                    <tr key={b.employeeId} className="border-t border-slate-100" data-testid={`attendee-${b.employeeId}`}>
                      <td className="py-1">
                        <EmployeeLink employee={e} />
                      </td>
                      <td>{e?.department ?? '—'}</td>
                      <td>{r && <StatusBadge status={r.status} />}</td>
                      <td>
                        {formatDate(r?.validUntil)} {b.late && <Badge tone="amber">termín až po konci platnosti</Badge>}
                      </td>
                      <td>{confirmed ? <Badge tone="green">potvrzeno</Badge> : <Badge tone="blue">návrh</Badge>}</td>
                      <td className="flex flex-wrap justify-end gap-1 py-1">
                        {confirmed ? (
                          <button type="button" className={buttonClass} onClick={() => unconfirm(b.employeeId, b.code)}>
                            Zrušit potvrzení
                          </button>
                        ) : (
                          <>
                            <button type="button" className={primaryButtonClass} onClick={() => confirm(b.employeeId, b.code, b.sessionId)}>
                              Potvrdit
                            </button>
                            <MoveForm
                              sessions={alternatives}
                              current={session.id}
                              onSubmit={(sessionId) => confirm(b.employeeId, b.code, sessionId)}
                            />
                            <button type="button" className={buttonClass} onClick={() => dismiss(b.employeeId, b.code, b.sessionId)}>
                              Odebrat
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </details>
  )
}

export function Sessions() {
  const { dataset, plan } = useStore()
  const focused = useSearchParams()[0].get('session')
  const employees = new Map(dataset.employees.map((e) => [e.id, e]))
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Návrhy přihlášek: nejdřív ti, kdo školení nemají vůbec, pak ti s prošlou platností (od nejstarší), pak ti, komu platnost brzy končí.
        Každý dostane nejbližší termín s volným místem. Potvrzené přihlášky zabírají místo a při přepočtu se nemění.
      </p>
      {plan.unplaceable.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 font-semibold text-red-900">Nelze umístit ({plan.unplaceable.length})</h2>
          <p className="mb-2 text-sm text-red-900">Pro tyto povinnosti není žádný vypsaný termín s volným místem.</p>
          <ul className="grid gap-1 text-sm md:grid-cols-2">
            {plan.unplaceable.map((r) => (
              <li key={`${r.employeeId}|${r.code}`}>
                <EmployeeLink employee={employees.get(r.employeeId)} /> – {r.code} ({STATUS_LABELS[r.status]})
              </li>
            ))}
          </ul>
        </section>
      )}
      {dataset.trainings
        .filter((t) => dataset.sessions.some((s) => s.code === t.code))
        .map((t) => (
          <section key={t.code} className="space-y-2">
            <h2 className="font-semibold">
              {t.code} – {t.name}
            </h2>
            {dataset.sessions
              .filter((s) => s.code === t.code)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((s) => (
                <SessionCard key={s.id} session={s} initiallyOpen={s.id === focused} />
              ))}
          </section>
        ))}
    </div>
  )
}
