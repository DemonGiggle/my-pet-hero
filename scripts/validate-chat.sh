#!/usr/bin/env bash
set -euo pipefail

tmpdir=$(mktemp -d)
export MY_PET_HERO_DATA_DIR="$tmpdir/pets"
export MY_PET_HERO_RENDER_DIR="$tmpdir/renders"

node dist/cli.js create --name Asaki --species elf --class mage > /tmp/mph-chat-create.json
node dist/cli.js chat --input "/pet status" > /tmp/mph-chat-status.json
node dist/cli.js chat --input "/pet report" > /tmp/mph-chat-report.json
node dist/cli.js chat --input "/pet inventory" > /tmp/mph-chat-inventory.json
node dist/cli.js chat --input "/pet use asaki" > /tmp/mph-chat-use.json
node dist/cli.js chat --input "/pet heroes" > /tmp/mph-chat-heroes.json
node dist/cli.js chat --input "/pet feed" > /tmp/mph-chat-feed.json
node dist/cli.js chat --input "/pet checkpoint" > /tmp/mph-chat-checkpoint.json

node --input-type=module <<'NODE'
import fs from 'node:fs/promises';

const read = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const status = await read('/tmp/mph-chat-status.json');
const report = await read('/tmp/mph-chat-report.json');
const inventory = await read('/tmp/mph-chat-inventory.json');
const use = await read('/tmp/mph-chat-use.json');
const heroes = await read('/tmp/mph-chat-heroes.json');
const feed = await read('/tmp/mph-chat-feed.json');
const checkpoint = await read('/tmp/mph-chat-checkpoint.json');

const checks = [
  [status.mode === 'chat' && status.command === 'status' && status.headline && status.message, 'status'],
  [report.mode === 'chat' && report.command === 'report' && report.report, 'report'],
  [inventory.mode === 'chat' && inventory.command === 'inventory' && Array.isArray(inventory.inventoryLines), 'inventory'],
  [use.defaultHeroId === 'asaki', 'use'],
  [heroes.defaultHeroId === 'asaki' && heroes.count === 1, 'heroes'],
  [feed.command === 'feed' && feed.summary && feed.id === 'asaki', 'feed'],
  [checkpoint.command === 'checkpoint' && checkpoint.historyCountAfter === 1 && checkpoint.keptHistoryEntry, 'checkpoint']
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`validation failed: ${label}`);
}

console.log('CHAT_STATUS:');
console.log(status.message);
console.log('---');
console.log('CHAT_REPORT_SNIPPET:');
console.log((report.report ?? '').split('\n').slice(0, 8).join('\n'));
console.log('---');
console.log('CHAT_CHECKPOINT:');
console.log(checkpoint.message);
NODE
