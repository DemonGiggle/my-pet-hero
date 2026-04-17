import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function main() {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'my-pet-hero-dungeon-flow-'));
  process.env.MY_PET_HERO_DATA_DIR = path.join(tmpRoot, 'pets');
  process.env.MY_PET_HERO_RENDER_DIR = path.join(tmpRoot, 'renders');

  const { createPet, savePet } = await import('../src/state.js');
  const { autoDungeonRun } = await import('../src/systems.js');

  try {
    const pet = createPet({ id: 'flow-check', name: 'Flow Check', species: 'elf', heroClass: 'rogue' });
    pet.personality.curiosity = 1;
    pet.personality.playfulness = 1;
    pet.needs.health = 92;
    pet.needs.energy = 96;
    pet.needs.hunger = 12;
    pet.needs.thirst = 10;
    pet.needs.hygiene = 88;
    pet.needs.mood = 84;
    pet.hero.dungeon.location = 'village';
    pet.hero.dungeon.village.currentActivity = {
      key: 'pre-run-check',
      label: '待命',
      summary: '整理裝備，準備出發',
      detail: '整理裝備，準備出發。',
      startedAt: '2026-04-18T00:00:00.000Z',
      effects: {},
      tags: ['idle']
    };
    await savePet(pet);

    let firstLog = null;
    for (let i = 0; i < 720; i++) {
      const at = new Date(Date.UTC(2026, 3, 18, 0, i, 0)).toISOString();
      const log = autoDungeonRun(pet, at);
      if (log) {
        firstLog = log;
        break;
      }
    }

    assert.ok(firstLog, 'Expected autoDungeonRun to trigger at least once.');
    assert.notEqual(firstLog.roomType, 'entrance', 'First resolved dungeon room should not be the cleared entrance.');
    assert.equal(pet.hero.dungeon.location, 'dungeon', 'Pet should remain in dungeon while expedition is active.');
    assert.ok(pet.hero.dungeon.currentDungeon, 'Dungeon instance should exist after the first successful run.');
    assert.ok(pet.hero.dungeon.currentExpedition, 'Expedition state should exist after the first successful run.');
    assert.equal(pet.hero.dungeon.currentExpedition?.status, 'exploring');
    assert.equal(pet.hero.dungeon.village.currentActivity, undefined, 'Village activity should clear once expedition starts.');
    assert.equal(
      pet.hero.dungeon.currentExpedition?.logs[0]?.roomType,
      firstLog.roomType,
      'Expedition log should record the same first room that autoDungeonRun resolved.'
    );

    console.log('Dungeon flow checks passed.');
  } finally {
    delete process.env.MY_PET_HERO_DATA_DIR;
    delete process.env.MY_PET_HERO_RENDER_DIR;
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
