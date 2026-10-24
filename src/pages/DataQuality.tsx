import { useState } from 'react'
import { FILE_LABELS, type FileKind, type Inconsistency, type Normalization } from '../domain/types'
import { useStore } from '../state'
import { Badge, buttonClass } from '../ui/components'
import { ResolutionForm } from '../ui/forms'
import { resolutionLabel } from '../ui/labels'

const FILES = Object.keys(FILE_LABELS) as FileKind[]

function IssueCard({ issue }: { issue: Inconsistency }) {
  const { resolutions, resolve } = useStore()
  const r = resolutions[issue.id]
  return (
    <li id={issue.id} className="rounded border border-slate-200 bg-white p-3 text-sm" data-testid={`issue-${issue.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{issue.message}</span>
        <span className="text-slate-500">sloupec {issue.field}</span>
        <code className="rounded bg-slate-100 px-1 break-all whitespace-pre-wrap">{issue.value || '(prázdné)'}</code>
        {issue.suggestion && <span className="text-slate-500">návrh: {issue.suggestion}</span>}
      </div>
      <details className="mt-1 text-slate-600">
        <summary className="cursor-pointer">
          {issue.rows.length} {issue.rows.length === 1 ? 'záznam' : 'záznamů'}
        </summary>
        <p className="mt-1 break-words">{issue.rows.join(', ')}</p>
      </details>
      <div className="mt-2">
        {r ? (
          <div className="flex items-center gap-2">
            <Badge tone="green">{resolutionLabel(issue, r)}</Badge>
            <button type="button" className={buttonClass} onClick={() => resolve(issue.id, null)}>
              Změnit
            </button>
          </div>
        ) : (
          <ResolutionForm issue={issue} onSubmit={(res) => resolve(issue.id, res)} />
        )}
      </div>
    </li>
  )
}

function NormalizationGroup({ items }: { items: Normalization[] }) {
  return (
    <details className="rounded border border-slate-200 bg-white p-3 text-sm">
      <summary className="cursor-pointer">
        {FILE_LABELS[items[0].file]} · {items[0].rule} <span className="text-slate-500">({items.length}×)</span>
      </summary>
      <table className="mt-2 w-full">
        <tbody>
          {items.slice(0, 200).map((n, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="py-0.5 pr-3">{n.row}</td>
              <td className="pr-3 text-slate-500">{n.field}</td>
              <td className="pr-3">
                <code className="whitespace-pre">{JSON.stringify(n.from)}</code>
              </td>
              <td>
                → <code>{n.to}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > 200 && <p className="mt-1 text-slate-500">… a dalších {items.length - 200}</p>}
    </details>
  )
}

export function DataQuality() {
  const { report, resolutions } = useStore()
  const [onlyOpen, setOnlyOpen] = useState(true)
  const unresolved = report.inconsistencies.filter((i) => !resolutions[i.id])
  const shown = onlyOpen ? unresolved : report.inconsistencies
  const groups = new Map<string, Normalization[]>()
  for (const n of report.normalizations) {
    const key = `${n.file}|${n.rule}`
    groups.set(key, [...(groups.get(key) ?? []), n])
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-semibold">
            Nesrovnalosti{' '}
            <span className="text-slate-500">
              ({unresolved.length} nevyřešených z {report.inconsistencies.length})
            </span>
          </h2>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> jen nevyřešené
          </label>
        </div>
        <p className="mb-3 text-sm text-slate-600">
          Hodnoty, které porušují pravidla a nelze je jednoznačně opravit. Opravit na = hodnota se nahradí ve všech uvedených záznamech.
          Vyřadit = záznamy se nepoužijí. Ponechat jak je = záznamy se použijí s původní hodnotou.
        </p>
        {FILES.map((file) => {
          const items = shown.filter((i) => i.file === file)
          if (!items.length) return null
          return (
            <div key={file} className="mb-4">
              <h3 className="mb-2 font-medium">{FILE_LABELS[file]}</h3>
              <ul className="space-y-2">
                {items.map((i) => (
                  <IssueCard key={i.id} issue={i} />
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Automaticky očištěno <span className="text-slate-500">({report.normalizations.length})</span>
        </h2>
        <p className="mb-3 text-sm text-slate-600">Jednoznačné úpravy formátu, které nemění význam hodnoty.</p>
        <div className="space-y-2">
          {[...groups.values()].map((items) => (
            <NormalizationGroup key={`${items[0].file}|${items[0].rule}`} items={items} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Odmítnuté řádky <span className="text-slate-500">({report.rejected.length})</span>
        </h2>
        <p className="mb-3 text-sm text-slate-600">Strukturálně poškozené řádky, které nelze použít.</p>
        <table className="w-full rounded border border-slate-200 bg-white text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">Soubor</th>
              <th className="p-2">Řádek</th>
              <th className="p-2">Důvod</th>
              <th className="p-2">Obsah</th>
            </tr>
          </thead>
          <tbody>
            {report.rejected.map((r, i) => (
              <tr key={i} className="border-t border-slate-100 align-top">
                <td className="p-2">{FILE_LABELS[r.file]}</td>
                <td className="p-2">{r.row}</td>
                <td className="p-2">{r.reason}</td>
                <td className="p-2 break-all">
                  <code>{r.raw}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
