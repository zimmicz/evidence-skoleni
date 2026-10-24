import { formatDate } from '../domain/dates'
import type { Inconsistency, Resolution, ResolutionAction } from '../domain/types'

export const ACTION_LABELS: Record<ResolutionAction, string> = {
  map: 'Opravit na',
  exclude: 'Vyřadit',
  ignore: 'Ponechat jak je',
}

export function resolutionLabel(issue: Inconsistency, r: Resolution): string {
  if (r.action !== 'map') return ACTION_LABELS[r.action]
  const option = issue.target?.type === 'select' ? issue.target.options.find((o) => o.value === r.value) : undefined
  const value = issue.target?.type === 'date' ? formatDate(r.value) : (option?.label ?? r.value)
  return `${ACTION_LABELS.map} „${value}“`
}
