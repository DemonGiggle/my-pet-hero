import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function main() {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'my-pet-hero-app-services-'));
  process.env.MY_PET_HERO_DATA_DIR = path.join(tmpRoot, 'pets');
  process.env.MY_PET_HERO_RENDER_DIR = path.join(tmpRoot, 'renders');

  const { createPet, savePet } = await import('../src/state.js');
  const {
    executeChatCommand,
    getInventoryPayload,
    getMutationPayload,
    getSavesPayload,
    getStatusPayload
  } = await import('../src/app.js');

  try {
    const pet = createPet({ id: 'asaki', name: 'Asaki', species: 'elf', heroClass: 'mage' });
    await savePet(pet);

    const status = await getStatusPayload('asaki', true);
    assert.equal(status.id, 'asaki');
    assert.equal(typeof status.headline, 'string');
    assert.equal(typeof status.report, 'string');
    assert.equal(typeof status.imagePath, 'string');
    assert.equal(status.reportJournalCount, 1);

    const statusAgain = await getStatusPayload('asaki', true);
    assert.equal(statusAgain.reportJournalCount, 2);
    assert.ok(Array.isArray(statusAgain.reportJournal));
    assert.equal(statusAgain.reportJournal?.length, 2);

    const inventory = await getInventoryPayload('asaki');
    assert.equal(inventory.id, 'asaki');
    assert.ok(Array.isArray(inventory.inventoryLines));

    const feed = await getMutationPayload('asaki', 'feed');
    assert.equal(feed.id, 'asaki');
    assert.equal(feed.action, 'feed');
    assert.equal(typeof feed.summary, 'string');

    const saves = await getSavesPayload();
    assert.equal(saves.count, 1);
    assert.equal(saves.defaultHeroId, 'asaki');

    const chatStatus = await executeChatCommand('/pet status asaki');
    assert.equal(chatStatus.mode, 'chat');
    assert.equal(chatStatus.command, 'status');
    assert.equal(chatStatus.id, 'asaki');
    assert.equal(typeof chatStatus.message, 'string');

    const chatInventory = await executeChatCommand('/pet inventory asaki');
    assert.equal(chatInventory.command, 'inventory');
    assert.ok(Array.isArray(chatInventory.inventoryLines));

    const chatUse = await executeChatCommand('/pet use asaki');
    assert.equal(chatUse.command, 'use');
    assert.equal(chatUse.defaultHeroId, 'asaki');

    const chatHeroes = await executeChatCommand('/pet heroes');
    assert.equal(chatHeroes.command, 'heroes');
    assert.equal(chatHeroes.count, 1);
    assert.equal(chatHeroes.defaultHeroId, 'asaki');

    const chatCheckpoint = await executeChatCommand('/pet checkpoint asaki');
    assert.equal(chatCheckpoint.command, 'checkpoint');
    assert.equal(chatCheckpoint.historyCountAfter, 1);
    assert.ok(chatCheckpoint.keptHistoryEntry);

    console.log('App service checks passed.');
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
