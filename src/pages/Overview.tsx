import { Link } from 'react-router'
import { CalendarX, CheckCircle2, Clock, Hourglass, UserX, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '../domain/dates'
import { useStore } from '../state'
import { EmployeeLink, PageHeader, Stat, StatusBadge, ToneBadge } from '../ui/components'

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
      <PageHeader title="Přehled" description={`Stav proškolení k ${formatDate(referenceDate)}`} />
      <section className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Zaměstnanci (bez ukončených)" value={inScope.length} icon={<Users />} />
        <Stat label="Splněné povinnosti" value={`${pct(ok, requirements.length)} %`} tone="green" icon={<CheckCircle2 />} />
        <Stat label="Chybí školení" value={count('missing')} tone="red" icon={<UserX />} />
        <Stat label="Prošlá platnost" value={count('expired')} tone="red" icon={<Hourglass />} />
        <Stat label={`Končí do ${windowDays} dní`} value={count('expiring')} tone="amber" icon={<Clock />} />
        <Stat
          label="Nelze umístit na termín"
          value={plan.unplaceable.length}
          tone={plan.unplaceable.length ? 'red' : undefined}
          icon={<CalendarX />}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Proškolenost podle útvarů</CardTitle>
          <CardDescription>Platné nebo končící povinnosti / všechny povinnosti. Klikněte na buňku pro seznam lidí.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Útvar</TableHead>
                {mandatory.map((t) => (
                  <TableHead key={t.code} className="text-center" title={t.name}>
                    {t.code}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d}>
                  <TableCell className="font-medium">{d}</TableCell>
                  {mandatory.map((t) => {
                    const reqs = inScope
                      .filter((e) => e.department === d)
                      .flatMap((e) => compliance.get(e.id)?.requirements.filter((r) => r.code === t.code) ?? [])
                    if (!reqs.length) return <TableCell key={t.code} />
                    const good = reqs.filter((r) => r.status === 'valid' || r.status === 'expiring').length
                    const p = pct(good, reqs.length)
                    const color =
                      p === 100
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : p >= 80
                          ? 'bg-amber-50 text-amber-800 ring-amber-200'
                          : 'bg-red-50 text-red-700 ring-red-200'
                    return (
                      <TableCell key={t.code} className="p-1 text-center">
                        <Link
                          to={`/employees?department=${encodeURIComponent(d)}&training=${t.code}&status=problem`}
                          className={cn(
                            'inline-block min-w-14 rounded-md px-2 py-1 text-xs font-medium tabular-nums ring-1 ring-inset transition hover:ring-2 hover:ring-primary',
                            color,
                          )}
                        >
                          {good}/{reqs.length}
                        </Link>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nejbližší konce platnosti</CardTitle>
          <CardDescription>Povinnosti, kterým platnost skončí do {windowDays} dní, a navržený termín.</CardDescription>
        </CardHeader>
        <CardContent>
          {expiringSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">V nastaveném okně nic nekončí.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaměstnanec</TableHead>
                  <TableHead>Školení</TableHead>
                  <TableHead>Platnost do</TableHead>
                  <TableHead>Termín</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringSoon.map((r) => {
                  const b = sessionOf.get(`${r.employeeId}|${r.code}`)
                  const s = b && dataset.sessions.find((x) => x.id === b.sessionId)
                  return (
                    <TableRow key={`${r.employeeId}|${r.code}`}>
                      <TableCell>
                        <EmployeeLink employee={employees.get(r.employeeId)} />
                      </TableCell>
                      <TableCell>
                        <span className="mr-2 font-medium">{r.code}</span>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDate(r.validUntil)}</TableCell>
                      <TableCell>
                        {b && s ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="tabular-nums">{formatDate(s.date)}</span>
                            <span className="text-muted-foreground">{s.id}</span>
                            {plan.confirmed.includes(b) ? (
                              <ToneBadge tone="green">potvrzeno</ToneBadge>
                            ) : (
                              <ToneBadge tone="blue">návrh</ToneBadge>
                            )}
                            {b.late && <ToneBadge tone="amber">až po konci platnosti</ToneBadge>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
