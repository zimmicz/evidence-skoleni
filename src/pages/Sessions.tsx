import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CalendarX, Check, ChevronDown, Clock, Copy, Download, MapPin, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Booking } from '../domain/booking'
import { STATUS_LABELS } from '../domain/compliance'
import { formatDate } from '../domain/dates'
import { toCsv } from '../domain/export'
import type { Session } from '../domain/types'
import { useStore } from '../state'
import { EmployeeLink, PageHeader, StatusBadge, ToneBadge } from '../ui/components'
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
      <ToneBadge>zrušeno</ToneBadge>
    ) : session.date < referenceDate ? (
      <ToneBadge>proběhlo</ToneBadge>
    ) : session.blocked ? (
      <ToneBadge tone="red">{session.blocked}</ToneBadge>
    ) : (
      <ToneBadge tone={free > 0 ? 'green' : 'amber'}>volno po návrzích {free}</ToneBadge>
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
    <Collapsible
      defaultOpen={initiallyOpen}
      disabled={!offered}
      data-testid={`session-${session.id}`}
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 data-[state=open]:ring-primary/30"
      ref={(el: HTMLDivElement | null) => {
        if (el && initiallyOpen) el.scrollIntoView({ block: 'center' })
      }}
    >
      <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 p-3 text-left text-sm enabled:hover:bg-muted/50 disabled:cursor-default">
        <span className="flex items-center gap-2">
          <span className="font-semibold">{session.id}</span>
          <span className="font-medium tabular-nums">{formatDate(session.date)}</span>
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3.5" />
          {session.time}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-3.5" />
          {session.place}
        </span>
        <span className="text-muted-foreground tabular-nums">
          kapacita {session.capacity}, obsazeno z exportu {session.taken}
        </span>
        {offered && (
          <span className="text-muted-foreground tabular-nums">
            potvrzeno {confirmed.length}, návrhů {suggested.length}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {state}
          {offered && <ChevronDown className="size-4 text-muted-foreground transition group-data-[state=open]:rotate-180" />}
        </span>
      </CollapsibleTrigger>
      {offered && (
        <CollapsibleContent className="space-y-3 border-t p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!suggested.length}
              onClick={() => suggested.forEach((b) => confirm(b.employeeId, b.code, b.sessionId))}
            >
              <Check />
              Potvrdit všechny návrhy
            </Button>
            <Button size="sm" variant="outline" disabled={!attendees.length} onClick={exportCsv}>
              <Download />
              Export CSV
            </Button>
            <Button size="sm" variant="outline" disabled={!attendees.length} onClick={copyEmails}>
              <Copy />
              {copied ? 'Zkopírováno' : 'Kopírovat e-maily'}
            </Button>
          </div>
          {attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nikdo k přihlášení.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {attendees.map(({ b, confirmed }) => {
                const r = requirement(b)
                const e = employees.get(b.employeeId)
                return (
                  <li
                    key={b.employeeId}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2.5 text-sm"
                    data-testid={`attendee-${b.employeeId}`}
                  >
                    <span className="min-w-40 flex-1">
                      <EmployeeLink employee={e} />
                      <span className="block text-xs text-muted-foreground">{e?.department ?? '—'}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r && <StatusBadge status={r.status} />}
                      {r?.validUntil && <span className="text-muted-foreground tabular-nums">platnost do {formatDate(r.validUntil)}</span>}
                      {r?.status === 'beforeStart' && (
                        <span className="text-muted-foreground tabular-nums">nastupuje {formatDate(e?.startDate)}</span>
                      )}
                      {b.late && <ToneBadge tone="amber">termín až po konci platnosti</ToneBadge>}
                      {confirmed ? <ToneBadge tone="green">potvrzeno</ToneBadge> : <ToneBadge tone="blue">návrh</ToneBadge>}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {confirmed ? (
                        <Button size="sm" variant="outline" onClick={() => unconfirm(b.employeeId, b.code)}>
                          Zrušit potvrzení
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => confirm(b.employeeId, b.code, b.sessionId)}>
                            Potvrdit
                          </Button>
                          <MoveForm
                            sessions={alternatives}
                            current={session.id}
                            onSubmit={(sessionId) => confirm(b.employeeId, b.code, sessionId)}
                          />
                          <Button size="sm" variant="ghost" onClick={() => dismiss(b.employeeId, b.code, b.sessionId)}>
                            <X />
                            Odebrat
                          </Button>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

export function Sessions() {
  const { dataset, plan } = useStore()
  const focused = useSearchParams()[0].get('session')
  const employees = new Map(dataset.employees.map((e) => [e.id, e]))
  return (
    <div className="space-y-6">
      <PageHeader
        title="Termíny"
        description="Nejdřív ti, kdo školení nemají vůbec, pak s prošlou platností (od nejstarší), pak ti, komu brzy končí. Každý dostane nejbližší termín s volným místem; potvrzené přihlášky drží místo."
      />
      {plan.unplaceable.length > 0 && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <CalendarX />
          <AlertTitle>Nelze umístit ({plan.unplaceable.length})</AlertTitle>
          <AlertDescription>
            <p>Pro tyto povinnosti není žádný vypsaný termín s volným místem.</p>
            <ul className="mt-1 grid gap-1 md:grid-cols-2">
              {plan.unplaceable.map((r) => (
                <li key={`${r.employeeId}|${r.code}`}>
                  <EmployeeLink employee={employees.get(r.employeeId)} /> – {r.code} ({STATUS_LABELS[r.status]})
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {dataset.trainings
        .filter((t) => dataset.sessions.some((s) => s.code === t.code))
        .map((t) => (
          <section key={t.code} className="space-y-2">
            <h3 className="font-semibold">
              {t.code} <span className="font-normal text-muted-foreground">– {t.name}</span>
            </h3>
            {dataset.sessions
              .filter((s) => s.code === t.code)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((s) => (
                <SessionCard key={`${s.id}-${focused}`} session={s} initiallyOpen={s.id === focused} />
              ))}
          </section>
        ))}
    </div>
  )
}
