import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABELS, type RequirementStatus } from '../domain/compliance'
import type { Employee } from '../domain/types'

export type Tone = 'gray' | 'red' | 'amber' | 'green' | 'blue'

const TONES: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  blue: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
}

const STATUS_TONES: Record<RequirementStatus, Tone> = { missing: 'red', expired: 'red', expiring: 'amber', valid: 'green' }

export function ToneBadge({ children, tone = 'gray', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <Badge className={cn('rounded-md font-medium', TONES[tone], className)}>{children}</Badge>
}

export function StatusBadge({ status }: { status: RequirementStatus }) {
  return <ToneBadge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</ToneBadge>
}

export function EmployeeLink({ employee }: { employee: Employee | undefined }) {
  if (!employee) return <span>—</span>
  return (
    <Link className="font-medium text-primary hover:underline" to={`/employees/${employee.id}`}>
      {employee.lastName} {employee.firstName}
    </Link>
  )
}

export function Stat({ label, value, tone, icon }: { label: string; value: ReactNode; tone?: 'red' | 'amber' | 'green'; icon: ReactNode }) {
  const color =
    tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-emerald-600' : 'text-foreground'
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={cn('mt-1 text-2xl font-semibold tabular-nums', color)}>{value}</div>
        </div>
        <div className="rounded-lg bg-muted p-2 text-muted-foreground [&_svg]:size-4">{icon}</div>
      </CardContent>
    </Card>
  )
}

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export const controlClass =
  'h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
