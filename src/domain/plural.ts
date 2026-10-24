const rules = new Intl.PluralRules('cs')

export type Forms = { one: string; few: string; other: string }

export function pluralWord(n: number, forms: Forms): string {
  const category = rules.select(n)
  return category === 'one' ? forms.one : category === 'few' ? forms.few : forms.other
}

export const plural = (n: number, forms: Forms) => `${n} ${pluralWord(n, forms)}`
