import crypto from 'node:crypto';

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function randomSeed(): number {
  return crypto.randomInt(1, 2 ** 31 - 1);
}

export function hashToUnit(input: string): number {
  const hex = crypto.createHash('sha256').update(input).digest('hex').slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

export function bucketMinutes(startIso: string, endIso: string, bucketSizeMinutes = 60): string[] {
  const out: string[] = [];
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const step = bucketSizeMinutes * 60_000;
  for (let t = start + step; t <= end; t += step) out.push(new Date(t).toISOString());
  return out;
}

export async function ensureDir(path: string): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.mkdir(path, { recursive: true });
}

export function pickOne<T>(items: T[], unit: number): T {
  return items[Math.min(items.length - 1, Math.floor(unit * items.length))];
}

export function formatPercentDelta(current: number, baseline: number): string {
  if (baseline === 0) return '0%';
  const delta = ((current - baseline) / baseline) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

export function expToNextLevel(level: number): number {
  return 20 + Math.floor(level * level * 8);
}
