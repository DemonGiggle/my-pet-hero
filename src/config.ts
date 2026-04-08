import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface GameConfig {
  cadence: {
    simulationBucketMinutes: number;
    villageActivityBucketMinutes: number;
  };
}

type RawConfig = {
  cadence?: {
    simulationBucketMinutes?: unknown;
    villageActivityBucketMinutes?: unknown;
  };
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  cadence: {
    simulationBucketMinutes: 5,
    villageActivityBucketMinutes: 5
  }
};

function coercePositiveMinutes(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return fallback;
}

function resolveConfigPath(): string | undefined {
  const explicit = process.env.MY_PET_HERO_CONFIG?.trim();
  if (explicit) return path.resolve(explicit);

  const local = path.resolve(process.cwd(), 'my-pet-hero.config.json');
  return existsSync(local) ? local : undefined;
}

function loadFileConfig(): { config: RawConfig; path?: string } {
  const configPath = resolveConfigPath();
  if (!configPath) return { config: {} };

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as RawConfig;
    return { config: raw, path: configPath };
  } catch (error) {
    throw new Error(`無法讀取設定檔 ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadGameConfig(): { config: GameConfig; configPath?: string } {
  const { config: fileConfig, path: configPath } = loadFileConfig();
  const simulationBucketMinutes = coercePositiveMinutes(
    process.env.MY_PET_HERO_SIM_BUCKET_MINUTES ?? fileConfig.cadence?.simulationBucketMinutes,
    DEFAULT_GAME_CONFIG.cadence.simulationBucketMinutes
  );
  const villageActivityBucketMinutes = coercePositiveMinutes(
    process.env.MY_PET_HERO_VILLAGE_BUCKET_MINUTES ?? fileConfig.cadence?.villageActivityBucketMinutes,
    DEFAULT_GAME_CONFIG.cadence.villageActivityBucketMinutes
  );

  return {
    config: {
      cadence: {
        simulationBucketMinutes,
        villageActivityBucketMinutes
      }
    },
    configPath
  };
}
