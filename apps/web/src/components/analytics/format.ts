/** "1,234.5 RON" — amounts on the analytics dashboard (E14). */
const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })

export const ron = (n: number) => `${number.format(n)} RON`

/** "1.2k" on chart axes, where space is short. */
export const compact = (n: number) =>
  n >= 1000 ? `${number.format(Math.round(n / 100) / 10)}k` : number.format(n)
