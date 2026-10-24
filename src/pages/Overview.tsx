import { Link } from 'react-router'
import { formatDate } from '../domain/dates'
import { useStore } from '../state'
import { EmployeeLink, Stat, StatusBadge } from '../ui/components'

const pct = (ok: number, total: number) => (total ? Math.round((ok / total) * 100) : 100)

export function Overview() {
  const { dataset, compliance, plan, referenceDate, windowDays } = useStore()
  const employees = new Map(dataset.employees.map((e) => [e.id, e]))
  const inScope = dataset.employees.filter((e) => e.status !== 'ukončen')
  const requirements = inScope.flatMap((e) => compliance.get(e.id)?.requirements ?? [])
  const count = (s: string) => requirements.filter((r) => r.status === s).length
  const ok = count('valid') + count('expiring')
  const mandatory = dataset.trainings.filter((t) => t.rule.kind !== 'optional')
  const departments = [...new Set(inScope.map((e) => e.department).filter((d): d is string => !!d))].sort((a, b) =>
    a.localeCompare(b, 'cs'),
  )
  const sessionOf = new Map([...plan.confirmed, ...plan.suggested].map((b) => [`${b.employeeId}|${b.code}`, b]))
  const expiringSoon = requirements
    .filter((r) => r.status === 'expiring')
    .sort((a, b) => (a.validUntil ?? '').localeCompare(b.validUntil ?? ''))
    .slice(0, 15)

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Zaměstnanci (bez ukončených)" value={inScope.length} />
        <Stat label="Splněné povinnosti" value={`${pct(ok, requirements.length)} %`} tone="green" />
        <Stat label="Chybí školení" value={count('missing')} tone="red" />
        <Stat label="Prošlá platnost" value={count('expired')} tone="red" />
        <Stat label={`Končí do ${windowDays} dní`} value={count('expiring')} tone="amber" />
        <Stat label="Nelze umístit na termín" value={plan.unplaceable.length} tone={plan.unplaceable.length ? 'red' : undefined} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 font-semibold">Proškolenost podle útvarů</h2>
        <p className="mb-3 text-sm text-slate-500">
          Platné nebo končící povinnosti / všechny povinnosti k {formatDate(referenceDate)}. Klikněte na buňku pro seznam lidí.
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Útvar</th>
                {mandatory.map((t) => (
                  <th key={t.code} className="p-2 text-center font-medium" title={t.name}>
                    {t.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d} className="border-t border-slate-100">
                  <td className="p-2 whitespace-nowrap">{d}</td>
                  {mandatory.map((t) => {
                    const reqs = inScope
                      .filter((e) => e.department === d)
                      .flatMap((e) => compliance.get(e.id)?.requirements.filter((r) => r.code === t.code) ?? [])
                    if (!reqs.length) return <td key={t.code} className="p-2" />
                    const good = reqs.filter((r) => r.status === 'valid' || r.status === 'expiring').length
                    const p = pct(good, reqs.length)
                    const color = p === 100 ? 'bg-emerald-100' : p >= 80 ? 'bg-amber-100' : 'bg-red-200'
                    return (
                      <td key={t.code} className="p-1 text-center">
                        <Link
                          to={`/employees?department=${encodeURIComponent(d)}&training=${t.code}&status=problem`}
                          className={`block rounded px-2 py-1 ${color} hover:ring-2 hover:ring-sky-400`}
                        >
                          {good}/{reqs.length}
                        </Link>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Nejbližší konce platnosti</h2>
        {expiringSoon.length === 0 ? (
          <p className="text-sm text-slate-500">V nastaveném okně nic nekončí.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1">Zaměstnanec</th>
                <th>Školení</th>
                <th>Platnost do</th>
                <th>Termín</th>
              </tr>
            </thead>
            <tbody>
              {expiringSoon.map((r) => {
                const b = sessionOf.get(`${r.employeeId}|${r.code}`)
                const s = b && dataset.sessions.find((x) => x.id === b.sessionId)
                return (
                  <tr key={`${r.employeeId}|${r.code}`} className="border-t border-slate-100">
                    <td className="py-1">
                      <EmployeeLink employee={employees.get(r.employeeId)} />
                    </td>
                    <td>
                      {r.code} <StatusBadge status={r.status} />
                    </td>
                    <td>{formatDate(r.validUntil)}</td>
                    <td>
                      {b && s ? (
                        <span className={b.late ? 'text-amber-700' : ''}>
                          {formatDate(s.date)} ({s.id}){plan.confirmed.includes(b) ? ' ✓ potvrzeno' : ' – návrh'}
                          {b.late && ' – až po konci platnosti'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
