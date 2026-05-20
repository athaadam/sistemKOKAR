export function fmtRp(n: number | string | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('id-ID');
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function bulanIni(): string {
  return today().slice(0, 7);
}
