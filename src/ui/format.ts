export function money(n: number): string {
  const abs = Math.abs(n);
  const body = abs >= 100 ? Math.round(abs).toLocaleString('en-US') : abs.toFixed(2);
  return `${n < 0 ? '−' : ''}$${body}`;
}

export function compact(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function clock(hour: number): string {
  const day = Math.floor(hour / 24) + 1;
  return `Day ${day} · ${String(hour % 24).padStart(2, '0')}:00`;
}
