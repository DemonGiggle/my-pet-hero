import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CURRENT_SAVE_VERSION, loadPet } from '../src/state.js';

const execFileAsync = promisify(execFile);
const NOW = '2026-04-08T00:00:00.000Z';

function baseSave(version: number, id: string) {
  return {
    version,
    id,
    name: `Pet ${id}`,
    species: 'elf',
    createdAt: NOW,
    updatedAt: NOW,
    lastSimulatedAt: NOW,
    ageHours: 12,
    seed: 12345,
    needs: {
      health: 80,
      hunger: 20,
      thirst: 18,
      mood: 74,
      energy: 70,
      hygiene: 76
    },
    personality: {
      sociability: 0.6,
      curiosity: 0.7,
      discipline: 0.5,
      playfulness: 0.65,
      appetite: 0.55
    },
    hero: {
      level: 2,
      exp: 15,
      expToNext: 35,
      statPoints: 1,
      gold: 12,
      attributes: {
        strength: 8,
        agility: 10,
        intelligence: 11,
        vitality: 8,
        luck: 9
      },
      dungeon: {
        seed: 67890,
        floor: 2,
        deepestFloor: 3,
        runs: 2
      },
      adventureLog: []
    },
    history: []
  };
}

function makeV2(id: string) {
  return baseSave(2, id);
}

function makeV4(id: string) {
  const save = {
    ...baseSave(4, id),
    hero: {
      ...baseSave(4, id).hero,
      classProgress: {
        current: 'rogue',
        unlocked: ['rogue'],
        aptitude: { berserker: 1, rogue: 1.15, mage: 1 }
      },
      adventureLog: [
        {
          at: NOW,
          floor: 2,
          outcome: 'win',
          text: 'Won a fight.',
          expGained: 5,
          goldGained: 3,
          combat: {
            outcome: 'win',
            enemy: {
              key: 'slime',
              label: 'Slime',
              floorRange: [1, 3],
              damageTypeBias: 'physical',
              baseHealth: 12,
              baseAttack: 4,
              baseDefense: 2,
              baseAccuracy: 0.85,
              baseEvasion: 0.04,
              baseCrit: 0.05,
              aggression: 0.4,
              expReward: 5,
              goldReward: 3
            },
            hero: {
              name: 'Pet',
              maxHealth: 30,
              health: 25,
              attack: 8,
              magicAttack: 6,
              defense: 4,
              magicDefense: 4,
              accuracy: 0.9,
              evasion: 0.1,
              crit: 0.08,
              damageTypeBias: 'physical'
            },
            enemyState: {
              name: 'Slime',
              maxHealth: 12,
              health: 0,
              attack: 4,
              magicAttack: 1,
              defense: 2,
              magicDefense: 1,
              accuracy: 0.85,
              evasion: 0.04,
              crit: 0.05,
              damageTypeBias: 'physical'
            },
            rounds: 2,
            turns: [
              {
                round: 1,
                actor: 'hero',
                result: 'crit',
                damageType: 'physical',
                damage: 12,
                text: 'Critical hit.'
              }
            ],
            expGained: 5,
            goldGained: 3,
            healthLoss: 2,
            moodDelta: 4,
            text: 'Combat summary.'
          }
        }
      ]
    }
  };
  return save;
}

function makeV6Early(id: string) {
  const save = {
    ...baseSave(6, id),
    hero: {
      ...baseSave(6, id).hero,
      classProgress: {
        current: 'mage',
        unlocked: ['mage'],
        aptitude: { berserker: 1, rogue: 1, mage: 1.15 }
      },
      dungeon: {
        ...baseSave(6, id).hero.dungeon,
        floor: 4,
        deepestFloor: 4,
        currentDungeon: {
          id: 'd-early',
          name: 'Old Dungeon',
          theme: 'ruins',
          templateKey: 'old-ruins',
          floor: 4,
          rooms: [
            { id: 'r1', type: 'entrance', name: 'Gate', depth: 0, enemies: [], cleared: true, exits: ['r2'] },
            { id: 'r2', type: 'battle', name: 'Hall', depth: 1, enemies: ['slime'], cleared: false, exits: [] }
          ],
          currentRoomId: 'r2',
          discoveredRoomIds: ['r1', 'r2'],
          clearedRoomIds: ['r1'],
          seed: 'legacy-seed'
        }
      },
      adventureLog: [
        {
          at: NOW,
          floor: 4,
          outcome: 'win',
          text: 'Cleared a room.',
          expGained: 8,
          goldGained: 6,
          dungeonName: 'Old Dungeon',
          roomName: 'Hall',
          roomType: 'battle'
        }
      ]
    }
  };
  return save;
}

function makeV6Late(id: string) {
  const save = makeV6Early(id);
  save.hero.dungeon = {
    ...save.hero.dungeon,
    location: 'village',
    currentDungeon: undefined,
    currentExpedition: {
      id: 'exp-1',
      startedAt: NOW,
      dungeonName: 'Crystal Cave',
      floor: 5,
      status: 'returned',
      returnMode: 'portal',
      roomsCleared: 4,
      totalRooms: 4,
      bossDefeated: true,
      totalExpGained: 22,
      totalGoldGained: 18,
      villagePreparation: ['restocked'],
      returnSummary: 'Back safely.',
      logs: [],
      goal: {
        key: 'investigate',
        goalLabel: '調查異常',
        motive: '要查清楚地城失衡的來源。',
        target: '異常源頭',
        setupText: 'legacy setup',
        clueText: 'legacy clue',
        resolutionText: 'legacy resolution',
        successSummary: 'legacy success',
        failureSummary: 'legacy failure',
        progress: 'active',
        callbacks: []
      }
    },
    expeditionHistory: [
      {
        id: 'exp-0',
        startedAt: NOW,
        endedAt: NOW,
        dungeonName: 'Crystal Cave',
        floor: 4,
        status: 'returned',
        returnMode: 'portal',
        roomsCleared: 3,
        totalRooms: 3,
        bossDefeated: false,
        totalExpGained: 10,
        totalGoldGained: 7,
        villagePreparation: [],
        logs: [],
        goal: {
          key: 'retrieve',
          goalLabel: '取回遺物',
          motive: '要把村裡急需的物件帶回來。',
          target: '封印鑰匙',
          setupText: 'legacy setup',
          clueText: 'legacy clue',
          resolutionText: 'legacy resolution',
          successSummary: 'legacy success',
          failureSummary: 'legacy failure',
          progress: 'resolved',
          callbacks: []
        }
      }
    ]
  } as typeof save.hero.dungeon;
  return save;
}

async function writeSave(dir: string, id: string, save: unknown) {
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify(save, null, 2) + '\n', 'utf8');
}

async function main() {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'my-pet-hero-migrations-'));
  try {
    const ids = ['v2-pet', 'v4-pet', 'v6-early-pet', 'v6-late-pet'] as const;
    await writeSave(tmpRoot, ids[0], makeV2(ids[0]));
    await writeSave(tmpRoot, ids[1], makeV4(ids[1]));
    await writeSave(tmpRoot, ids[2], makeV6Early(ids[2]));
    await writeSave(tmpRoot, ids[3], makeV6Late(ids[3]));

    const v2 = await loadPet(ids[0], tmpRoot);
    assert.equal(v2.version, CURRENT_SAVE_VERSION);
    assert.equal(v2.hero.classProgress.current, 'rogue');
    assert.deepEqual(v2.hero.equipment.inventory, []);
    assert.equal(v2.hero.dungeon.location, 'village');
    assert.equal(v2.hero.dungeon.village.name, '晨霧村');

    const v4 = await loadPet(ids[1], tmpRoot);
    assert.equal(v4.version, CURRENT_SAVE_VERSION);
    assert.equal(v4.hero.adventureLog[0]?.combat?.hero.shield, 0);
    assert.deepEqual(v4.hero.adventureLog[0]?.combat?.skillsUsed, []);

    const v6Early = await loadPet(ids[2], tmpRoot);
    assert.equal(v6Early.version, CURRENT_SAVE_VERSION);
    assert.equal(v6Early.hero.dungeon.location, 'dungeon');
    assert.equal(v6Early.hero.equipment.inventory.length, 0);
    assert.equal(v6Early.hero.dungeon.village.lastVisitedAt, NOW);

    const v6Late = await loadPet(ids[3], tmpRoot);
    assert.equal(v6Late.version, CURRENT_SAVE_VERSION);
    assert.equal(v6Late.hero.dungeon.currentExpedition?.completed, false);
    assert.equal(v6Late.hero.dungeon.expeditionHistory[0]?.completed, false);
    assert.ok(v6Late.hero.dungeon.currentExpedition?.goal);
    assert.equal(v6Late.hero.dungeon.currentExpedition?.goal?.callbacks.length ?? 0, 0);

    const backupDir = path.join(tmpRoot, 'backups');
    const backups = await readdir(backupDir);
    assert.ok(backups.some(name => name.startsWith('v2-pet.v2.')));
    assert.ok(backups.some(name => name.startsWith('v4-pet.v4.')));
    assert.ok(backups.some(name => name.startsWith('v6-early-pet.v6.')));
    assert.ok(backups.some(name => name.startsWith('v6-late-pet.v6.')));

    const migratedRaw = JSON.parse(await readFile(path.join(tmpRoot, 'v2-pet.json'), 'utf8'));
    assert.equal(migratedRaw.version, CURRENT_SAVE_VERSION);

    const cli = await execFileAsync('npx', ['tsx', 'src/cli.ts', 'status', '--id', 'v6-early-pet'], {
      cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'),
      env: { ...process.env, MY_PET_HERO_DATA_DIR: tmpRoot }
    });
    const cliPayload = JSON.parse(cli.stdout);
    assert.equal(cliPayload.id, 'v6-early-pet');
    assert.ok(['dungeon', 'village'].includes(cliPayload.location));
    assert.ok(cliPayload.currentDungeon || cliPayload.expeditionHistory?.length >= 0);

    console.log('Migration checks passed.');
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
