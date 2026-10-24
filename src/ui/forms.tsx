import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { readUpload, type LoadedFile } from '../domain/csv'
import { formatDate, parseDate } from '../domain/dates'
import type { Inconsistency, MapTarget, Resolution, ResolutionAction, Session } from '../domain/types'
import { useStore } from '../state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { controlClass } from './components'
import { ACTION_LABELS } from './labels'

const csvFile = z
  .instanceof(File)
  .refine((f) => /\.csv$/i.test(f.name), 'Povolené jsou jen soubory .csv')
  .refine((f) => f.size <= 5_000_000, 'Soubor může mít nejvýše 5 MB')

export function ImportForm({ onDone }: { onDone: () => void }) {
  const { importFiles } = useStore()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ files: FileList }>()

  const onSubmit = async ({ files }: { files: FileList }) => {
    const loaded = await Promise.all([...files].map(readUpload))
    const problems = loaded.filter((l): l is string => typeof l === 'string')
    const ok = loaded.filter((l): l is LoadedFile => typeof l !== 'string')
    const kinds = ok.map((l) => l.kind)
    if (new Set(kinds).size !== kinds.length) problems.push('Stejný typ souboru byl vybrán vícekrát')
    if (problems.length) return setError('files', { message: problems.join('; ') })
    importFiles(ok)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Vyberte 1–4 exporty (CSV). Typ souboru se pozná podle hlavičky, název nehraje roli. Nevybrané soubory zůstanou beze změny.
      </p>
      <input
        type="file"
        multiple
        accept=".csv,text/csv"
        aria-label="Soubory CSV"
        className="block w-full rounded-lg border border-dashed border-input bg-muted/40 p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        {...register('files', {
          validate: (list) => {
            if (!list?.length) return 'Vyberte alespoň jeden soubor'
            if (list.length > 4) return 'Nejvýše 4 soubory'
            for (const f of list) {
              const r = csvFile.safeParse(f)
              if (!r.success) return `${f.name}: ${r.error.issues[0].message}`
            }
            return true
          },
        })}
      />
      {errors.files && <p className="text-sm text-destructive">{errors.files.message}</p>}
      <Button type="submit" disabled={isSubmitting}>
        Načíst
      </Button>
    </form>
  )
}

function valueSchema(target: MapTarget | undefined) {
  switch (target?.type) {
    case 'select':
      return z.string().refine((v) => target.options.some((o) => o.value === v), 'Vyberte hodnotu ze seznamu')
    case 'date':
      return z.string().refine((v) => parseDate(v).ok, 'Zadejte platné datum')
    case 'number':
      return z.string().regex(/^\d+$/, 'Zadejte celé nezáporné číslo')
    case 'email':
      return z.email('Zadejte platný e-mail')
    default:
      return z.string()
  }
}

export function ResolutionForm({ issue, onSubmit }: { issue: Inconsistency; onSubmit: (r: Resolution) => void }) {
  const canMap = issue.actions.includes('map')
  const { register, handleSubmit, control, formState } = useForm<{ action: ResolutionAction; value: string }>({
    defaultValues: { action: canMap && issue.suggestion ? 'map' : issue.actions[0], value: issue.suggestion ?? '' },
  })
  const action = useWatch({ control, name: 'action' })
  const submit = handleSubmit(({ action, value }) => onSubmit(action === 'map' ? { action, value } : { action }))

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2" aria-label={`Rozhodnutí ${issue.id}`}>
      <select className={controlClass} aria-label="Akce" {...register('action')}>
        {issue.actions.map((a) => (
          <option key={a} value={a}>
            {ACTION_LABELS[a]}
          </option>
        ))}
      </select>
      {canMap && action === 'map' && (
        <>
          {issue.target?.type === 'select' ? (
            <select
              className={controlClass}
              aria-label="Nová hodnota"
              {...register('value', { validate: (v) => valueSchema(issue.target).safeParse(v).error?.issues[0].message ?? true })}
            >
              <option value="">— vyberte —</option>
              {issue.target.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={controlClass}
              aria-label="Nová hodnota"
              type={issue.target?.type === 'date' ? 'date' : issue.target?.type === 'number' ? 'number' : 'text'}
              {...register('value', { validate: (v) => valueSchema(issue.target).safeParse(v).error?.issues[0].message ?? true })}
            />
          )}
        </>
      )}
      <Button type="submit" size="sm">
        Uložit
      </Button>
      {formState.errors.value && <span className="text-sm text-destructive">{formState.errors.value.message}</span>}
    </form>
  )
}

export function MoveForm({ sessions, current, onSubmit }: { sessions: Session[]; current: string; onSubmit: (sessionId: string) => void }) {
  const { register, handleSubmit } = useForm<{ sessionId: string }>({ defaultValues: { sessionId: current } })
  return (
    <form onSubmit={handleSubmit(({ sessionId }) => onSubmit(sessionId))} className="flex max-w-full min-w-0 flex-wrap items-center gap-1">
      <select
        className={cn(controlClass, 'w-full max-w-full min-w-0 sm:w-auto')}
        aria-label="Přesunout na termín"
        {...register('sessionId', { required: true })}
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id} · {formatDate(s.date)} · {s.place}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        Potvrdit sem
      </Button>
    </form>
  )
}
