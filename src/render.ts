import { PNG } from 'pngjs';
import { writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SPECIES } from './species.js';
import { PetState, RenderResult } from './types.js';

const WIDTH = 320;
const HEIGHT = 320;
const SCALE = 8;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number];
}

function setPixel(png: PNG, x: number, y: number, color: string): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const [r, g, b] = hexToRgb(color);
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = 255;
}

function fillRect(png: PNG, x: number, y: number, w: number, h: number, color: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(png, xx, yy, color);
}

function drawPattern(png: PNG, pattern: string[], offsetX: number, offsetY: number, palette: Record<string, string>): void {
  pattern.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char === '.') return;
      const color = palette[char];
      if (!color) return;
      fillRect(png, offsetX + x * SCALE, offsetY + y * SCALE, SCALE, SCALE, color);
    });
  });
}

const FONT: Record<string, string[]> = {
  '0': ['11111','10001','10001','10001','11111'],
  '1': ['00100','01100','00100','00100','01110'],
  '2': ['11110','00001','01110','10000','11111'],
  '3': ['11110','00001','01110','00001','11110'],
  '4': ['10010','10010','11111','00010','00010'],
  '5': ['11111','10000','11110','00001','11110'],
  '6': ['01111','10000','11110','10001','01110'],
  '7': ['11111','00001','00010','00100','00100'],
  '8': ['01110','10001','01110','10001','01110'],
  '9': ['01110','10001','01111','00001','11110'],
  'A': ['01110','10001','11111','10001','10001'],
  'B': ['11110','10001','11110','10001','11110'],
  'C': ['01111','10000','10000','10000','01111'],
  'D': ['11110','10001','10001','10001','11110'],
  'E': ['11111','10000','11110','10000','11111'],
  'F': ['11111','10000','11110','10000','10000'],
  'G': ['01111','10000','10111','10001','01111'],
  'H': ['10001','10001','11111','10001','10001'],
  'I': ['01110','00100','00100','00100','01110'],
  'J': ['00001','00001','00001','10001','01110'],
  'K': ['10001','10010','11100','10010','10001'],
  'L': ['10000','10000','10000','10000','11111'],
  'M': ['10001','11011','10101','10001','10001'],
  'N': ['10001','11001','10101','10011','10001'],
  'O': ['01110','10001','10001','10001','01110'],
  'P': ['11110','10001','11110','10000','10000'],
  'Q': ['01110','10001','10101','10010','01101'],
  'R': ['11110','10001','11110','10010','10001'],
  'S': ['01111','10000','01110','00001','11110'],
  'T': ['11111','00100','00100','00100','00100'],
  'U': ['10001','10001','10001','10001','01110'],
  'V': ['10001','10001','10001','01010','00100'],
  'W': ['10001','10001','10101','11011','10001'],
  'X': ['10001','01010','00100','01010','10001'],
  'Y': ['10001','01010','00100','00100','00100'],
  'Z': ['11111','00010','00100','01000','11111'],
  ':': ['00000','00100','00000','00100','00000'],
  '.': ['00000','00000','00000','00110','00110'],
  ',': ['00000','00000','00000','00110','00100'],
  '!': ['00100','00100','00100','00000','00100'],
  '?': ['01110','00001','00110','00000','00100'],
  '-': ['00000','00000','01110','00000','00000'],
  '+': ['00000','00100','01110','00100','00000'],
  '/': ['00001','00010','00100','01000','10000'],
  "'": ['00100','00100','00000','00000','00000'],
  '(': ['00010','00100','00100','00100','00010'],
  ')': ['01000','00100','00100','00100','01000'],
  ' ': ['00000','00000','00000','00000','00000']
};

function drawText(png: PNG, text: string, x: number, y: number, color: string): void {
  let cursor = x;
  for (const char of text.toUpperCase()) {
    const glyph = FONT[char] ?? FONT['?'];
    glyph.forEach((row, gy) => {
      [...row].forEach((bit, gx) => {
        if (bit === '1') fillRect(png, cursor + gx * 2, y + gy * 2, 2, 2, color);
      });
    });
    cursor += glyph[0].length * 2 + 2;
  }
}

function basePattern(species: PetState['species'], mood: number, energy: number): string[] {
  const eyes = mood >= 65 ? 'e' : mood >= 35 ? 'n' : 'x';
  const mouth = energy >= 40 ? 'm' : 's';
  const patterns: Record<string, string[]> = {
    elf: ['....aa....','...aaaa...','..aaffaa..','..af..fa..','..aeeeea..','..a.m..a..','...abbb...','..bb..bb..','..b....b..','.cc....cc.'],
    dwarf: ['....aa....','...aaaa...','..aaffaa..','..aeeeea..','..a.m..a..','..dddddd..','...dbbd...','..bb..bb..','..b....b..','.cc....cc.'],
    human: ['....aa....','...aaaa...','..aaffaa..','..aeeeea..','..a.m..a..','...abbb...','..bb..bb..','..bb..bb..','..c....c..','.cc....cc.'],
    orc: ['....aa....','...aaaa...','..aaffaa..','..aeeeea..','..a.m..a..','...abbb...','..bbggbb..','..b....b..','..c....c..','.cc....cc.'],
    dragon: ['....aa....','...aaaa...','..haffah..','..aeeeea..','..a.m..a..','...abbbh..','..bb..bb..','.h.b..b...','..c....c..','.cc....cc.']
  };
  return patterns[species].map(row => row.replace(/e/g, eyes).replace(/m/g, mouth));
}

function resolveRenderDir(): string {
  const envDir = process.env.MY_PET_HERO_RENDER_DIR?.trim();
  if (envDir) return path.resolve(envDir);

  const xdgStateHome = process.env.XDG_STATE_HOME?.trim();
  if (xdgStateHome) return path.resolve(xdgStateHome, 'my-pet-hero', 'renders');

  return path.join(os.homedir(), '.local', 'state', 'my-pet-hero', 'renders');
}

export async function renderStatusCard(params: { pet: PetState; summary: string; outputDir?: string }): Promise<RenderResult> {
  const { pet, summary } = params;
  const outputDir = params.outputDir ?? resolveRenderDir();
  await mkdir(outputDir, { recursive: true });
  const species = SPECIES[pet.species];
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  fillRect(png, 0, 0, WIDTH, HEIGHT, species.palette.background);
  fillRect(png, 10, 10, WIDTH - 20, HEIGHT - 20, '#ffffff');
  fillRect(png, 10, 10, WIDTH - 20, 26, species.palette.primary);
  drawText(png, `${pet.name.slice(0, 12)}`, 18, 18, '#ffffff');
  drawText(png, `LV ${pet.hero.level}`, 220, 18, '#ffffff');

  const palette: Record<string, string> = {
    a: species.palette.primary, b: species.palette.secondary, c: species.palette.accent, d: '#7a4f2b', f: '#ffd6a5', g: '#264653', h: '#ffb703', '^': '#111111', n: '#333333', x: '#7f1d1d', s: '#444444'
  };
  drawPattern(png, basePattern(pet.species, pet.needs.mood, pet.needs.energy), 110, 54, palette);

  const bars = [
    ['HP', pet.needs.health],
    ['HUNGER', pet.needs.hunger],
    ['THIRST', pet.needs.thirst],
    ['MOOD', pet.needs.mood],
    ['ENERGY', pet.needs.energy],
    ['CLEAN', pet.needs.hygiene]
  ] as const;

  bars.forEach(([label, value], i) => {
    const y = 150 + i * 18;
    drawText(png, label, 18, y, species.palette.text);
    fillRect(png, 90, y, 120, 8, '#e5e7eb');
    fillRect(png, 90, y, Math.round((value / 100) * 120), 8, species.palette.accent);
    drawText(png, String(Math.round(value)).padStart(3, ' '), 220, y, species.palette.text);
  });

  drawText(png, `STR ${pet.hero.attributes.strength}`, 18, 266, species.palette.text);
  drawText(png, `AGI ${pet.hero.attributes.agility}`, 90, 266, species.palette.text);
  drawText(png, `INT ${pet.hero.attributes.intelligence}`, 162, 266, species.palette.text);
  drawText(png, `VIT ${pet.hero.attributes.vitality}`, 18, 284, species.palette.text);
  drawText(png, `LUK ${pet.hero.attributes.luck}`, 90, 284, species.palette.text);
  drawText(png, `FLOOR ${pet.hero.dungeon.deepestFloor}`, 162, 284, species.palette.text);
  drawText(png, summary.toUpperCase().replace(/[^A-Z0-9 .,:!?+\-/'()]/g, ' ').slice(0, 23), 18, 302, species.palette.text);

  const outputPath = path.join(outputDir, `${pet.id}-status.png`);
  await writeFile(outputPath, PNG.sync.write(png));
  return { outputPath };
}
