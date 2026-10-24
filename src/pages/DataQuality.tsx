import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { plural } from '../domain/plural'
import { FILE_LABELS, type FileKind, type Inconsistency, type Normalization } from '../domain/types'
import { useStore } from '../state'
import { PageHeader, ToneBadge } from '../ui/components'
import { ResolutionForm } from '../ui/forms'
import { resolutionLabel } from '../ui/labels'

const FILES = Object.keys(FILE_LABELS) as FileKind[]

function IssueCard({ issue }: { issue: Inconsistency }) {
  const { resolutions, resolve } = useStore()
  const r = resolutions[issue.id]
  return (
    <li id={issue.id} data-testid={`issue-${issue.id}`} className="space-y-2 rounded-xl bg-card p-3 text-sm ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{issue.message}</span>
        <span className="text-muted-foreground">sloupec {issue.field}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all whitespace-pre-wrap">{issue.value || '(prázdné)'}</code>
        {issue.suggestion && <span className="text-muted-foreground">návrh: {issue.suggestion}</span>}
      </div>
      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ChevronDown className="size-3.5 transition group-data-[state=open]:rotate-180" />
          {plural(issue.rows.length, { one: 'záznam', few: 'záznamy', other: 'záznamů' })}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="mt-1 break-words text-muted-foreground">{issue.rows.join(', ')}</p>
        </CollapsibleContent>
      </Collapsible>
      {r ? (
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone="green">{resolutionLabel(issue, r)}</ToneBadge>
          <Button size="sm" variant="outline" onClick={() => resolve(issue.id, null)}>
            Změnit
          </Button>
        </div>
      ) : (
        <ResolutionForm issue={issue} onSubmit={(res) => resolve(issue.id, res)} />
      )}
    </li>
  )
}

function NormalizationGroup({ items }: { items: Normalization[] }) {
  return (
    <Collapsible className="rounded-xl bg-card text-sm ring-1 ring-foreground/10">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50">
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" />
        <span className="flex-1">
          <span className="text-muted-foreground">{FILE_LABELS[items[0].file]} · </span>
          {items[0].rule}
        </span>
        <ToneBadge>{items.length}×</ToneBadge>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 pb-3">
        <Table>
          <TableBody>
            {items.slice(0, 200).map((n, i) => (
              <TableRow key={i}>
                <TableCell>{n.row}</TableCell>
                <TableCell className="text-muted-foreground">{n.field}</TableCell>
                <TableCell>
                  <code className="font-mono text-xs whitespace-pre">{JSON.stringify(n.from)}</code>
                </TableCell>
                <TableCell>
                  → <code className="font-mono text-xs">{n.to}</code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {items.length > 200 && <p className="mt-1 text-muted-foreground">… a dalších {items.length - 200}</p>}
      </CollapsibleContent>
    </Collapsible>
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
    <div className="space-y-6">
      <PageHeader title="Kvalita dat" description="Co se při načtení opravilo, co čeká na rozhodnutí a co se nedalo použít." />
      <Tabs defaultValue="issues" className="gap-4">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="issues" className="flex-none">
            Nesrovnalosti <ToneBadge tone={unresolved.length ? 'amber' : 'green'}>{unresolved.length}</ToneBadge>
          </TabsTrigger>
          <TabsTrigger value="normalized" className="flex-none">
            Očištěno <ToneBadge>{report.normalizations.length}</ToneBadge>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex-none">
            Odmítnuté <ToneBadge tone={report.rejected.length ? 'red' : 'gray'}>{report.rejected.length}</ToneBadge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-sm text-muted-foreground">
              {plural(unresolved.length, { one: 'nevyřešená', few: 'nevyřešené', other: 'nevyřešených' })} z {report.inconsistencies.length}
              . Opravit na = hodnota se nahradí ve všech uvedených záznamech. Vyřadit = záznamy se nepoužijí. Ponechat jak je = záznamy se
              použijí s původní hodnotou.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              jen nevyřešené
            </label>
          </div>
          {FILES.map((file) => {
            const items = shown.filter((i) => i.file === file)
            if (!items.length) return null
            return (
              <div key={file} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{FILE_LABELS[file]}</h3>
                <ul className="space-y-2">
                  {items.map((i) => (
                    <IssueCard key={i.id} issue={i} />
                  ))}
                </ul>
              </div>
            )
          })}
        </TabsContent>

        <TabsContent value="normalized" className="space-y-2">
          <p className="text-sm text-muted-foreground">Jednoznačné úpravy formátu, které nemění význam hodnoty.</p>
          {[...groups.values()].map((items) => (
            <NormalizationGroup key={`${items[0].file}|${items[0].rule}`} items={items} />
          ))}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-2">
          <p className="text-sm text-muted-foreground">Strukturálně poškozené řádky, které nelze použít.</p>
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-4">Soubor</TableHead>
                    <TableHead>Řádek</TableHead>
                    <TableHead>Důvod</TableHead>
                    <TableHead className="pr-4">Obsah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rejected.map((r, i) => (
                    <TableRow key={i} className="align-top">
                      <TableCell className="pl-4">{FILE_LABELS[r.file]}</TableCell>
                      <TableCell className="tabular-nums">{r.row}</TableCell>
                      <TableCell className="whitespace-normal">{r.reason}</TableCell>
                      <TableCell className="min-w-64 pr-4 whitespace-normal">
                        <code className="font-mono text-xs break-all">{r.raw}</code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
