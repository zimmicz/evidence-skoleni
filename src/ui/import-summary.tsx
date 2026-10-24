import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStore } from '../state'
import { pluralWord } from '../domain/plural'
import { UNRESOLVED } from './labels'

export function ImportSummary({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { report, resolutions, ready } = useStore()
  const unresolved = report.inconsistencies.filter((i) => !resolutions[i.id])
  const byMessage = new Map<string, number>()
  for (const i of unresolved) byMessage.set(i.message, (byMessage.get(i.message) ?? 0) + i.rows.length)
  return (
    <Dialog open={ready && open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Data načtena – kontrola</DialogTitle>
          <DialogDescription>Výsledek kontroly načtených exportů.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-semibold tabular-nums">{report.normalizations.length}</div>
            <div className="text-xs text-muted-foreground">
              {pluralWord(report.normalizations.length, {
                one: 'automaticky očištěná hodnota',
                few: 'automaticky očištěné hodnoty',
                other: 'automaticky očištěných hodnot',
              })}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-2xl font-semibold text-amber-700 tabular-nums">{unresolved.length}</div>
            <div className="text-xs text-muted-foreground">{pluralWord(unresolved.length, UNRESOLVED)}</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-2xl font-semibold text-red-700 tabular-nums">{report.rejected.length}</div>
            <div className="text-xs text-muted-foreground">
              {pluralWord(report.rejected.length, { one: 'odmítnutý řádek', few: 'odmítnuté řádky', other: 'odmítnutých řádků' })}
            </div>
          </div>
        </div>
        {unresolved.length > 0 && (
          <ul className="max-h-56 divide-y overflow-auto rounded-lg border text-sm">
            {[...byMessage.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([message, count]) => (
                <li key={message} className="flex justify-between gap-4 px-3 py-1.5">
                  <span>{message}</span>
                  <span className="text-muted-foreground tabular-nums">{count}×</span>
                </li>
              ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Řádky s nevyřešenou nesrovnalostí se do výpočtů nezapočítávají (nebo se použijí bez opravené hodnoty), dokud o nich nerozhodnete.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zavřít
          </Button>
          <Button asChild>
            <Link to="/data-quality" onClick={() => onOpenChange(false)}>
              Zobrazit kvalitu dat
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
