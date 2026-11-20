// Money helpers. Arithmetic is done in integer paise to avoid floating point drift.
export const toPaise = (rupees: number | string | { toString(): string } | null | undefined): number =>
  Math.round(Number(rupees ?? 0) * 100);
export const fromPaise = (paise: number): number => paise / 100;

export function sumMoney(values: Array<number | string | { toString(): string } | null | undefined>): number {
  return fromPaise(values.reduce<number>((acc, v) => acc + toPaise(v), 0));
}

export function mulMoney(...factors: number[]): number {
  // multiply then round once to paise
  const raw = factors.reduce((a, b) => a * b, 1);
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}
