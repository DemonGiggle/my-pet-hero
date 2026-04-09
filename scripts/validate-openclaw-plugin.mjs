#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import plugin from '../openclaw-plugin/index.js';

const projectDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpdir = mkdtempSync(path.join(os.tmpdir(), 'mph-openclaw-plugin-'));

process.env.MY_PET_HERO_DATA_DIR = path.join(tmpdir, 'pets');
process.env.MY_PET_HERO_RENDER_DIR = path.join(tmpdir, 'renders');

const cliPath = path.join(projectDir, 'dist', 'cli.js');
execFileSync(process.execPath, [cliPath, 'create', '--name', 'Asaki', '--species', 'elf', '--class', 'mage'], {
  cwd: projectDir,
  env: process.env,
  stdio: 'ignore'
});

let registeredTool;
plugin.register({
  runtime: {
    pluginConfig: {
      projectDir,
      nodeBin: process.execPath
    }
  },
  registerTool(definition) {
    registeredTool = definition;
  }
});

if (!registeredTool?.execute) {
  throw new Error('Plugin did not register my_pet_hero_pet tool.');
}

const statusResult = await registeredTool.execute('toolcall-status', { command: 'status' });
const reportResult = await registeredTool.execute('toolcall-report', { command: 'report' });
const inventoryResult = await registeredTool.execute('toolcall-inventory', { command: 'inventory' });
const petImageResult = await registeredTool.execute('toolcall-pet-image', { commandName: 'pet_image', command: 'card asaki' });

const statusText = statusResult?.content?.find((item) => item.type === 'text')?.text ?? '';
const statusImage = statusResult?.content?.find((item) => item.type === 'image')?.image ?? '';
const statusImagePath = statusResult?.imagePath ?? statusResult?.details?.imagePath ?? '';
const reportText = reportResult?.content?.find((item) => item.type === 'text')?.text ?? '';
const inventoryText = inventoryResult?.content?.find((item) => item.type === 'text')?.text ?? '';
const petImageText = petImageResult?.content?.find((item) => item.type === 'text')?.text ?? '';
const petImage = petImageResult?.content?.find((item) => item.type === 'image')?.image ?? '';
const timeline = statusResult?.details?.recentTimeline ?? [];

if (!statusText.includes('✦')) throw new Error('Status reply did not include compact stats.');
if (!statusText.includes('最近動向:')) throw new Error('Status reply did not include recent timeline narration.');
if (!statusImage) throw new Error('Status reply did not include an image.');
if (!statusImagePath) throw new Error('Status reply did not expose imagePath.');
if (!Array.isArray(timeline) || timeline.length === 0) throw new Error('Status details did not include recentTimeline.');
if (!reportText.includes('【近況】')) throw new Error('Report reply did not include report text.');
if (!inventoryText.includes('裝備：')) throw new Error('Inventory reply did not include equipment summary.');
if (!petImage) throw new Error('pet_image reply did not include an image.');
if (petImageResult?.details?.commandAlias !== 'pet_image') throw new Error('pet_image reply did not record command alias.');
if (petImageResult?.details?.requestedVariant !== 'card') throw new Error('pet_image reply did not preserve requested variant.');
if (!petImageText.includes('準備度')) throw new Error('pet_image caption did not include quick status.');

console.log('OPENCLAW_PLUGIN_STATUS:');
console.log(statusText);
console.log('---');
console.log('OPENCLAW_PLUGIN_REPORT_SNIPPET:');
console.log(reportText.split('\n').slice(0, 10).join('\n'));
console.log('---');
console.log('OPENCLAW_PLUGIN_INVENTORY:');
console.log(inventoryText);
