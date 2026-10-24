import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '../domain/dates'
import { useStore } from '../state'
import { EmployeeLink, StatusBadge, ToneBadge } from '../ui/components'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}

export function EmployeeDetail() {
  const { id } = useParams()
  const { dataset, compliance, plan, report, resolutions } = useStore()
  const employee = dataset.employees.find((e) => e.id === id)
  if (!employee) {
    return (
      <p>
        Zaměstnanec {id} není v datech (mohl být vyřazen nebo sloučen).{' '}
        <Link to="/employees" className="text-primary underline">
          Zpět na seznam
        </Link>
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
        <Link to="/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Zaměstnanci
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {employee.lastName} {employee.firstName} <span className="text-base font-normal text-muted-foreground">{employee.id}</span>
        </h2>
      </div>

      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm min-[420px]:grid-cols-2 md:grid-cols-4">
            <Field label="E-mail">{employee.email}</Field>
            <Field label="Útvar">{employee.department ?? '—'}</Field>
            <Field label="Pozice">{employee.position ?? '—'}</Field>
            <Field label="Vedoucí">{manager ? <EmployeeLink employee={manager} /> : '—'}</Field>
            <Field label="Pracovní poměr">{employee.status ?? 'neznámý'}</Field>
            <Field label="Nástup">{formatDate(employee.startDate)}</Field>
            <Field label="Ukončení">{formatDate(employee.endDate)}</Field>
            <Field label="Poznámka">
              <span className="whitespace-pre-wrap">{employee.note || '—'}</span>
            </Field>
          </dl>
        </CardContent>
      </Card>

      {issues.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle />
          <AlertTitle>Nesrovnalosti v datech tohoto zaměstnance</AlertTitle>
          <AlertDescription className="text-amber-800">
            <ul className="list-inside list-disc">
              {issues.map((i) => (
                <li key={i.id}>
                  {i.message} ({i.value}) –{' '}
                  {resolutions[i.id] ? (
                    'vyřešeno'
                  ) : (
                    <Link className="underline" to={`/data-quality#${encodeURIComponent(i.id)}`}>
                      nevyřešeno
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Povinná školení</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Školení</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Absolvováno</TableHead>
                <TableHead>Platnost do</TableHead>
                <TableHead>Termín</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c?.requirements.map((r) => {
                const b = bookings.find((x) => x.employeeId === employee.id && x.code === r.code)
                const s = b && sessions.get(b.sessionId)
                return (
                  <TableRow key={r.code}>
                    <TableCell>
                      {r.code} – {trainings.get(r.code)?.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDate(r.completion?.date)}</TableCell>
                    <TableCell className="tabular-nums">{r.completion && !r.validUntil ? 'neomezeně' : formatDate(r.validUntil)}</TableCell>
                    <TableCell>
                      {b && s ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="tabular-nums">{formatDate(s.date)}</span>
                          <span className="text-muted-foreground">{s.place}</span>
                          {b.confirmed ? <ToneBadge tone="green">potvrzeno</ToneBadge> : <ToneBadge tone="blue">návrh</ToneBadge>}
                          {b.late && <ToneBadge tone="amber">po konci platnosti</ToneBadge>}
                        </span>
                      ) : r.status !== 'valid' && employee.status === 'rodičovská' ? (
                        <span className="text-muted-foreground">na rodičovské – nepřihlašuje se</span>
                      ) : r.status !== 'valid' && plan.unplaceable.includes(r) ? (
                        <ToneBadge tone="red">nelze umístit</ToneBadge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {c && c.extra.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Nad rámec povinností</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {c.extra.map((x) => (
                <li key={x.id}>
                  {x.code} – {trainings.get(x.code)?.name} <span className="text-muted-foreground">({formatDate(x.date)})</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historie absolvovaných školení</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Záznam</TableHead>
                <TableHead>Školení</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Platnost do</TableHead>
                <TableHead>Poskytovatel</TableHead>
                <TableHead>Poznámka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((x) => (
                <TableRow key={x.id} className="align-top">
                  <TableCell className="text-muted-foreground">{x.id}</TableCell>
                  <TableCell className="font-medium">{x.code}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(x.date)}</TableCell>
                  <TableCell className="tabular-nums">{x.validUntil ? formatDate(x.validUntil) : 'neomezeně'}</TableCell>
                  <TableCell>{x.provider}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{x.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
