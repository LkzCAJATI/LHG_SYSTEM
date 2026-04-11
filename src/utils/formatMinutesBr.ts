/** Ex.: 10 → "10min", 90 → "1h 30min", 120 → "2h" */
export function formatMinutesBr(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  if (m === 0) return '0min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}min`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}min`;
}

/** Valor proporcional ao tempo usando tarifa/hora (ex.: créditos em minutos). */
export function minutesToReais(totalMinutes: number, pricePerHour: number): number {
  return (Math.max(0, Number(totalMinutes) || 0) / 60) * Math.max(0, Number(pricePerHour) || 0);
}
