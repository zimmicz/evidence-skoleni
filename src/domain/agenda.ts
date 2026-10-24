import type { BookingPlan } from './booking'
import { addDays, formatDate, type IsoDate } from './dates'
import { plural } from './plural'
import type { Dataset } from './types'

const ISSUES = { one: 'nesrovnalost', few: 'nesrovnalosti', other: 'nesrovnalostí' }
const SUGGESTIONS = { one: 'návrh', few: 'návrhy', other: 'návrhů' }

export type Priority = 'high' | 'medium' | 'low'

export type Task = {
  id: string
  priority: Priority
  title: string
  detail: string
  link: string
  date?: IsoDate
}

export const SOON_DAYS = 14

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

const count = <T>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, number>()
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1)
  return map
}

export function buildAgenda(dataset: Dataset, plan: BookingPlan, unresolvedIssues: number, referenceDate: IsoDate): Task[] {
  const soon = addDays(referenceDate, SOON_DAYS)
  const names = new Map(dataset.trainings.map((t) => [t.code, t.name]))
  const tasks: Task[] = []

  if (unresolvedIssues > 0)
    tasks.push({
      id: 'data',
      priority: 'high',
      title: `Rozhodnout ${plural(unresolvedIssues, ISSUES)} v datech`,
      detail: 'Dokud nejsou vyřešené, dotčené záznamy se nezapočítávají a přehledy mohou být neúplné.',
      link: '/data-quality',
    })

  for (const [code, n] of count(plan.unplaceable, (r) => r.code))
    tasks.push({
      id: `unplaceable:${code}`,
      priority: 'high',
      title: `Vypsat další termín ${code}: ${plural(n, { one: 'člověk nemá', few: 'lidé nemají', other: 'lidí nemá' })} kam se přihlásit`,
      detail: `${names.get(code) ?? code} – na vypsaných termínech už není volné místo.`,
      link: '/sessions',
    })

  const suggestedBySession = count(plan.suggested, (b) => b.sessionId)
  const confirmedBySession = count(plan.confirmed, (b) => b.sessionId)
  let laterSuggestions = 0
  let laterSessions = 0
  for (const s of plan.offered) {
    const suggested = suggestedBySession.get(s.id) ?? 0
    const confirmed = confirmedBySession.get(s.id) ?? 0
    if (s.date <= soon) {
      if (suggested)
        tasks.push({
          id: `confirm:${s.id}`,
          priority: 'high',
          title: `Potvrdit přihlášky na ${s.code} ${formatDate(s.date)}: ${plural(suggested, SUGGESTIONS)}`,
          detail: `${s.id}, ${s.time}, ${s.place} – termín je do ${SOON_DAYS} dní.`,
          link: `/sessions?session=${s.id}`,
          date: s.date,
        })
      if (confirmed)
        tasks.push({
          id: `notify:${s.id}`,
          priority: 'low',
          title: `Rozeslat pozvánky na ${s.code} ${formatDate(s.date)}: ${plural(confirmed, { one: 'potvrzená přihláška', few: 'potvrzené přihlášky', other: 'potvrzených přihlášek' })}`,
          detail: `${s.id}, ${s.time}, ${s.place} – e-maily a seznam pro pořadatele najdete u termínu.`,
          link: `/sessions?session=${s.id}`,
          date: s.date,
        })
    } else if (suggested) {
      laterSuggestions += suggested
      laterSessions += 1
    }
  }
  if (laterSuggestions)
    tasks.push({
      id: 'confirm:later',
      priority: 'medium',
      title: `Potvrdit ${plural(laterSuggestions, SUGGESTIONS)} na ${plural(laterSessions, { one: 'pozdějším termínu', few: 'pozdějších termínech', other: 'pozdějších termínech' })}`,
      detail: 'Potvrzená přihláška drží místo a při přepočtu se nemění.',
      link: '/sessions',
    })

  for (const [code, n] of count(
    [...plan.suggested, ...plan.confirmed].filter((b) => b.late),
    (b) => b.code,
  ))
    tasks.push({
      id: `late:${code}`,
      priority: 'medium',
      title: `${code}: ${plural(n, { one: 'člověku skončí platnost dřív, než se dostane', few: 'lidem skončí platnost dřív, než se dostanou', other: 'lidem skončí platnost dřív, než se dostanou' })} na termín`,
      detail: `${names.get(code) ?? code} – zvažte dřívější termín nebo navýšení kapacity.`,
      link: `/employees?training=${code}&status=expiring`,
    })

  return tasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.date ?? '').localeCompare(b.date ?? ''))
}
