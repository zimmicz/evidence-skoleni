import { Link, useParams } from 'react-router'
import { formatDate } from '../domain/dates'
import { useStore } from '../state'
import { Badge, EmployeeLink, StatusBadge } from '../ui/components'

export function EmployeeDetail() {
  const { id } = useParams()
  const { dataset, compliance, plan, report, resolutions } = useStore()
  const employee = dataset.employees.find((e) => e.id === id)
  if (!employee) {
    return (
      <p>
        Zaměstnanec {id} není v datech (mohl být vyřazen nebo sloučen). <Link to="/employees">Zpět na seznam</Link>
      </p>
    )
  }
  const c = compliance.get(employee.id)
  const manager = dataset.employees.find((e) => e.email === employee.managerEmail)
  const trainings = new Map(dataset.trainings.map((t) => [t.code, t]))
  const sessions = new Map(dataset.sessions.map((s) => [s.id, s]))
  const bookings = [...plan.confirmed.map((b) => ({ ...b, confirmed: true })), ...plan.suggested.map((b) => ({ ...b, confirmed: false }))]
  const history = dataset.completions.filter((x) => x.employeeId === employee.id).sort((a, b) => b.date.localeCompare(a.date))
  const issues = report.inconsistencies.filter((i) => i.rows.includes(employee.id))

  return (
    <div className="space-y-6">
      <div>
        <Link to="/employees" className="text-sm text-sky-700 hover:underline">
          ← Zaměstnanci
        </Link>
        <h2 className="mt-1 text-xl font-semibold">
          {employee.lastName} {employee.firstName} <span className="text-base font-normal text-slate-500">{employee.id}</span>
        </h2>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-slate-500">E-mail</dt>
          <dd>{employee.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Útvar</dt>
          <dd>{employee.department ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Pozice</dt>
          <dd>{employee.position ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Vedoucí</dt>
          <dd>{manager ? <EmployeeLink employee={manager} /> : '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Pracovní poměr</dt>
          <dd>{employee.status ?? 'neznámý'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Nástup</dt>
          <dd>{formatDate(employee.startDate)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ukončení</dt>
          <dd>{formatDate(employee.endDate)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Poznámka</dt>
          <dd className="break-words whitespace-pre-wrap">{employee.note || '—'}</dd>
        </div>
      </dl>

      {issues.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="mb-1 font-medium">Nesrovnalosti v datech tohoto zaměstnance</p>
          <ul className="list-inside list-disc">
            {issues.map((i) => (
              <li key={i.id}>
                {i.message} ({i.value}) –{' '}
                {resolutions[i.id] ? 'vyřešeno' : <Link to={`/data-quality#${encodeURIComponent(i.id)}`}>nevyřešeno</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Povinná školení</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1">Školení</th>
              <th>Stav</th>
              <th>Absolvováno</th>
              <th>Platnost do</th>
              <th>Termín</th>
            </tr>
          </thead>
          <tbody>
            {c?.requirements.map((r) => {
              const b = bookings.find((x) => x.employeeId === employee.id && x.code === r.code)
              const s = b && sessions.get(b.sessionId)
              return (
                <tr key={r.code} className="border-t border-slate-100">
                  <td className="py-1">
                    {r.code} – {trainings.get(r.code)?.name}
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{formatDate(r.completion?.date)}</td>
                  <td>{r.completion && !r.validUntil ? 'neomezeně' : formatDate(r.validUntil)}</td>
                  <td>
                    {b && s ? (
                      <span>
                        {formatDate(s.date)} {s.place}{' '}
                        {b.confirmed ? <Badge tone="green">potvrzeno</Badge> : <Badge tone="blue">návrh</Badge>}
                        {b.late && (
                          <>
                            {' '}
                            <Badge tone="amber">po konci platnosti</Badge>
                          </>
                        )}
                      </span>
                    ) : r.status !== 'valid' && employee.status === 'rodičovská' ? (
                      <span className="text-slate-500">na rodičovské – nepřihlašuje se</span>
                    ) : r.status !== 'valid' && plan.unplaceable.includes(r) ? (
                      <Badge tone="red">nelze umístit</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {c && c.extra.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 font-semibold">Nad rámec povinností</h3>
          <ul className="text-sm">
            {c.extra.map((x) => (
              <li key={x.id}>
                {x.code} – {trainings.get(x.code)?.name} ({formatDate(x.date)})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Historie absolvovaných školení</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1">Záznam</th>
              <th>Školení</th>
              <th>Datum</th>
              <th>Platnost do</th>
              <th>Poskytovatel</th>
              <th>Poznámka</th>
            </tr>
          </thead>
          <tbody>
            {history.map((x) => (
              <tr key={x.id} className="border-t border-slate-100 align-top">
                <td className="py-1">{x.id}</td>
                <td>{x.code}</td>
                <td>{formatDate(x.date)}</td>
                <td>{x.validUntil ? formatDate(x.validUntil) : 'neomezeně'}</td>
                <td>{x.provider}</td>
                <td className="whitespace-pre-wrap">{x.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
