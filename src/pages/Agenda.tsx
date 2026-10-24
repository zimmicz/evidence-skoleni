import { Link } from 'react-router'
import { buildAgenda, type Priority } from '../domain/agenda'
import { formatDate } from '../domain/dates'
import { useStore } from '../state'
import { Badge } from '../ui/components'

const PRIORITY: Record<Priority, { label: string; tone: 'red' | 'amber' | 'gray'; border: string }> = {
  high: { label: 'hned', tone: 'red', border: 'border-l-red-500' },
  medium: { label: 'brzy', tone: 'amber', border: 'border-l-amber-500' },
  low: { label: 'nezapomenout', tone: 'gray', border: 'border-l-slate-300' },
}

export function Agenda() {
  const { dataset, plan, report, resolutions, referenceDate } = useStore()
  const unresolved = report.inconsistencies.filter((i) => !resolutions[i.id]).length
  const tasks = buildAgenda(dataset, plan, unresolved, referenceDate)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Agenda k {formatDate(referenceDate)}</h2>
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">Vše vyřízeno, nic nečeká.</p>
      ) : (
        <ol className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} data-testid={`task-${t.id}`}>
              <Link
                to={t.link}
                className={`block rounded-lg border border-l-4 border-slate-200 bg-white p-3 hover:bg-slate-50 ${PRIORITY[t.priority].border}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
                  <span className="font-medium">{t.title}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{t.detail}</p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
