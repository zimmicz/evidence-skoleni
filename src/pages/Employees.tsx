import { useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { RequirementStatus } from '../domain/compliance'
import { formatDate } from '../domain/dates'
import { fold } from '../domain/import'
import { EMPLOYMENT_STATUSES, type Employee } from '../domain/types'
import { useStore } from '../state'
import { EmployeeLink, PageHeader, StatusBadge, ToneBadge, controlClass } from '../ui/components'

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

  const statusBadge = (e: Employee) =>
    e.status === 'aktivní' ? (
      <ToneBadge tone="green">aktivní</ToneBadge>
    ) : e.status === 'rodičovská' ? (
      <ToneBadge tone="blue">rodičovská</ToneBadge>
    ) : e.status === 'ukončen' ? (
      <ToneBadge>ukončen</ToneBadge>
    ) : (
      <ToneBadge tone="red">neznámý</ToneBadge>
    )

  return (
    <div className="space-y-6">
      <PageHeader title="Zaměstnanci" description={`${rows.length} zaměstnanců odpovídá filtrům`} />
      <Card size="sm">
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-muted-foreground">
            Hledat
            <span className="relative">
              <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <input
                className={cn(controlClass, 'w-full pl-8 text-foreground')}
                value={q}
                onChange={(e) => set('q', e.target.value)}
                placeholder="jméno nebo ID"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1 text-muted-foreground">
            Útvar
            <select className={cn(controlClass, 'text-foreground')} value={department} onChange={(e) => set('department', e.target.value)}>
              <option value="">všechny</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-muted-foreground">
            Tým vedoucího
            <select className={cn(controlClass, 'text-foreground')} value={manager} onChange={(e) => set('manager', e.target.value)}>
              <option value="">všichni</option>
              {managers.map((m) => (
                <option key={m.id} value={m.email}>
                  {m.lastName} {m.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-muted-foreground">
            Školení
            <select className={cn(controlClass, 'text-foreground')} value={training} onChange={(e) => set('training', e.target.value)}>
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
          <label className="flex flex-col gap-1 text-muted-foreground">
            Stav povinnosti
            <select className={cn(controlClass, 'text-foreground')} value={status} onChange={(e) => set('status', e.target.value)}>
              <option value="">jakýkoli</option>
              <option value="problem">vyžaduje akci</option>
              <option value="missing">chybí</option>
              <option value="expired">prošlé</option>
              <option value="expiring">končí</option>
              <option value="valid">platné</option>
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-muted-foreground">
            <legend className="mb-1">Pracovní poměr</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-foreground">
              {EMPLOYMENT_STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
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
        </CardContent>
      </Card>

      <Card className="py-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">Jméno</TableHead>
              <TableHead>Útvar</TableHead>
              <TableHead>Pozice</TableHead>
              <TableHead>Poměr</TableHead>
              <TableHead>{training ? training : 'Povinnosti'}</TableHead>
              <TableHead className="pr-4">Nejbližší konec platnosti</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ e, reqs, relevant }) => {
              const n = (s: RequirementStatus) => relevant.filter((r) => r.status === s).length
              const nearest = reqs.filter((r) => r.validUntil).sort((a, b) => (a.validUntil ?? '').localeCompare(b.validUntil ?? ''))[0]
              return (
                <TableRow key={e.id}>
                  <TableCell className="pl-4">
                    <EmployeeLink employee={e} />
                  </TableCell>
                  <TableCell>{e.department ?? '—'}</TableCell>
                  <TableCell>{e.position ?? '—'}</TableCell>
                  <TableCell>{statusBadge(e)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {training ? (
                        relevant.map((r) => <StatusBadge key={r.code} status={r.status} />)
                      ) : (
                        <>
                          {n('missing') > 0 && <ToneBadge tone="red">chybí {n('missing')}</ToneBadge>}
                          {n('expired') > 0 && <ToneBadge tone="red">prošlé {n('expired')}</ToneBadge>}
                          {n('expiring') > 0 && <ToneBadge tone="amber">končí {n('expiring')}</ToneBadge>}
                          {n('missing') + n('expired') + n('expiring') === 0 && <ToneBadge tone="green">vše platné</ToneBadge>}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 tabular-nums">
                    {training ? formatDate(relevant[0]?.validUntil) : nearest ? `${formatDate(nearest.validUntil)} (${nearest.code})` : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
