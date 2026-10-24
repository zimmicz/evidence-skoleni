import { useSearchParams } from 'react-router'
import type { RequirementStatus } from '../domain/compliance'
import { formatDate } from '../domain/dates'
import { fold } from '../domain/import'
import { EMPLOYMENT_STATUSES, type Employee } from '../domain/types'
import { useStore } from '../state'
import { Badge, EmployeeLink, inputClass, StatusBadge } from '../ui/components'

const PROBLEM: RequirementStatus[] = ['missing', 'expired', 'expiring']
const DEFAULT_EMPLOYMENT = 'aktivní,rodičovská'

function subordinates(employees: Employee[], managerEmail: string): Set<string> {
  const result = new Set<string>()
  const queue = [managerEmail]
  while (queue.length) {
    const email = queue.shift()!
    for (const e of employees) {
      if (e.managerEmail === email && !result.has(e.id)) {
        result.add(e.id)
        queue.push(e.email)
      }
    }
  }
  return result
}

export function Employees() {
  const { dataset, compliance } = useStore()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const department = params.get('department') ?? ''
  const manager = params.get('manager') ?? ''
  const employment = (params.get('employment') ?? DEFAULT_EMPLOYMENT).split(',').filter(Boolean)
  const training = params.get('training') ?? ''
  const status = params.get('status') ?? ''

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const departments = [...new Set(dataset.employees.map((e) => e.department).filter((d): d is string => !!d))].sort((a, b) =>
    a.localeCompare(b, 'cs'),
  )
  const managers = dataset.employees
    .filter((m) => dataset.employees.some((e) => e.managerEmail === m.email))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'cs'))
  const team = manager ? subordinates(dataset.employees, manager) : null
  const matchesStatus = (s: RequirementStatus) => !status || (status === 'problem' ? PROBLEM.includes(s) : s === status)

  const rows = dataset.employees
    .filter((e) => !q || fold(`${e.firstName} ${e.lastName} ${e.lastName} ${e.firstName} ${e.id}`).includes(fold(q)))
    .filter((e) => !department || e.department === department)
    .filter((e) => !team || team.has(e.id))
    .filter((e) => !e.status || employment.includes(e.status))
    .map((e) => {
      const reqs = compliance.get(e.id)?.requirements ?? []
      const relevant = training ? reqs.filter((r) => r.code === training) : reqs
      return { e, reqs, relevant }
    })
    .filter(({ relevant }) => (training || status ? relevant.some((r) => matchesStatus(r.status)) : true))
    .sort((a, b) => a.e.lastName.localeCompare(b.e.lastName, 'cs') || a.e.firstName.localeCompare(b.e.firstName, 'cs'))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <label className="flex flex-col">
          Hledat
          <input className={inputClass} value={q} onChange={(e) => set('q', e.target.value)} placeholder="jméno nebo ID" />
        </label>
        <label className="flex flex-col">
          Útvar
          <select className={inputClass} value={department} onChange={(e) => set('department', e.target.value)}>
            <option value="">všechny</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Tým vedoucího
          <select className={inputClass} value={manager} onChange={(e) => set('manager', e.target.value)}>
            <option value="">všichni</option>
            {managers.map((m) => (
              <option key={m.id} value={m.email}>
                {m.lastName} {m.firstName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Školení
          <select className={inputClass} value={training} onChange={(e) => set('training', e.target.value)}>
            <option value="">všechna povinná</option>
            {dataset.trainings
              .filter((t) => t.rule.kind !== 'optional')
              .map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} – {t.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col">
          Stav povinnosti
          <select className={inputClass} value={status} onChange={(e) => set('status', e.target.value)}>
            <option value="">jakýkoli</option>
            <option value="problem">vyžaduje akci</option>
            <option value="missing">chybí</option>
            <option value="expired">prošlé</option>
            <option value="expiring">končí</option>
            <option value="valid">platné</option>
          </select>
        </label>
        <fieldset className="flex flex-col">
          <legend>Pracovní poměr</legend>
          <div className="flex gap-2 py-1">
            {EMPLOYMENT_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={employment.includes(s)}
                  onChange={(e) =>
                    set('employment', (e.target.checked ? [...employment, s] : employment.filter((x) => x !== s)).join(',') || 'none')
                  }
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="text-sm text-slate-500">{rows.length} zaměstnanců</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="p-2">Jméno</th>
              <th className="p-2">Útvar</th>
              <th className="p-2">Pozice</th>
              <th className="p-2">Poměr</th>
              <th className="p-2">{training ? training : 'Povinnosti'}</th>
              <th className="p-2">Nejbližší konec platnosti</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, reqs, relevant }) => {
              const n = (s: RequirementStatus) => relevant.filter((r) => r.status === s).length
              const nearest = reqs.filter((r) => r.validUntil).sort((a, b) => (a.validUntil ?? '').localeCompare(b.validUntil ?? ''))[0]
              return (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="p-2">
                    <EmployeeLink employee={e} />
                  </td>
                  <td className="p-2">{e.department ?? '—'}</td>
                  <td className="p-2">{e.position ?? '—'}</td>
                  <td className="p-2">
                    {e.status === 'aktivní' ? (
                      <Badge tone="green">aktivní</Badge>
                    ) : e.status === 'rodičovská' ? (
                      <Badge tone="blue">rodičovská</Badge>
                    ) : e.status === 'ukončen' ? (
                      <Badge>ukončen</Badge>
                    ) : (
                      <Badge tone="red">neznámý</Badge>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {training ? (
                        relevant.map((r) => <StatusBadge key={r.code} status={r.status} />)
                      ) : (
                        <>
                          {n('missing') > 0 && <Badge tone="red">chybí {n('missing')}</Badge>}
                          {n('expired') > 0 && <Badge tone="red">prošlé {n('expired')}</Badge>}
                          {n('expiring') > 0 && <Badge tone="amber">končí {n('expiring')}</Badge>}
                          {n('missing') + n('expired') + n('expiring') === 0 && <Badge tone="green">vše platné</Badge>}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    {training ? formatDate(relevant[0]?.validUntil) : nearest ? `${formatDate(nearest.validUntil)} (${nearest.code})` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
