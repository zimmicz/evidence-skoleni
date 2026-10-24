import { Link } from 'react-router'
import { AlertTriangle, CalendarCheck, CalendarX, CheckCircle2, ChevronRight, Clock, Mail, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { buildAgenda, type Priority, type Task } from '../domain/agenda'
import { formatDate } from '../domain/dates'
import { useStore } from '../state'
import { PageHeader } from '../ui/components'

const PRIORITY: Record<Priority, { label: string; icon: string; dot: string }> = {
  high: { label: 'Hned', icon: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  medium: { label: 'Brzy', icon: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  low: { label: 'Nezapomenout', icon: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}

const ICONS: Record<string, LucideIcon> = {
  data: AlertTriangle,
  unplaceable: CalendarX,
  confirm: CalendarCheck,
  notify: Mail,
  late: Clock,
}

function TaskCard({ task }: { task: Task }) {
  const Icon = ICONS[task.id.split(':')[0]] ?? AlertTriangle
  return (
    <li data-testid={`task-${task.id}`}>
      <Link
        to={task.link}
        className="group flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:shadow-md hover:ring-primary/30"
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', PRIORITY[task.priority].icon)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{task.title}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{task.detail}</span>
        </span>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </li>
  )
}

export function Agenda() {
  const { dataset, plan, report, resolutions, referenceDate } = useStore()
  const unresolved = report.inconsistencies.filter((i) => !resolutions[i.id]).length
  const tasks = buildAgenda(dataset, plan, unresolved, referenceDate)

  return (
    <div className="space-y-6">
      <PageHeader title="Agenda" description={`Co je potřeba udělat k ${formatDate(referenceDate)}`} />
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="size-5" />
            Vše vyřízeno, nic nečeká.
          </CardContent>
        </Card>
      ) : (
        (['high', 'medium', 'low'] as Priority[]).map((p) => {
          const group = tasks.filter((t) => t.priority === p)
          if (!group.length) return null
          return (
            <section key={p} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <span className={cn('size-2 rounded-full', PRIORITY[p].dot)} />
                {PRIORITY[p].label}
                <span className="font-normal">({group.length})</span>
              </h3>
              <ol className="space-y-2">
                {group.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </ol>
            </section>
          )
        })
      )}
    </div>
  )
}
