import { PNG } from 'pngjs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { SPECIES } from './species.js';
const WIDTH = 320;
const HEIGHT = 320;
const SCALE = 8;
function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16));
}
function setPixel(png, x, y, color) {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height)
        return;
    const [r, g, b] = hexToRgb(color);
    const idx = (png.width * y + x) << 2;
    png.data[idx] = r;
    png.data[idx + 1] = g;
    png.data[idx + 2] = b;
    png.data[idx + 3] = 255;
}
function fillRect(png, x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++)
            setPixel(png, xx, yy, color);
}
function drawPattern(png, pattern, offsetX, offsetY, palette) {
    pattern.forEach((row, y) => {
        [...row].forEach((char, x) => {
            if (char === '.')
                return;
            const color = palette[char];
            if (!color)
                return;
            fillRect(png, offsetX + x * SCALE, offsetY + y * SCALE, SCALE, SCALE, color);
        });
    });
}
const FONT = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
    'A': ['010', '101', '111', '101', '101'], 'C': ['011', '100', '100', '100', '011'], 'D': ['110', '101', '101', '101', '110'], 'E': ['111', '100', '110', '100', '111'], 'F': ['111', '100', '110', '100', '100'], 'G': ['011', '100', '101', '101', '011'], 'H': ['101', '101', '111', '101', '101'], 'I': ['111', '010', '010', '010', '111'], 'L': ['100', '100', '100', '100', '111'], 'M': ['101', '111', '111', '101', '101'], 'N': ['101', '111', '111', '111', '101'], 'O': ['111', '101', '101', '101', '111'], 'P': ['110', '101', '110', '100', '100'], 'R': ['110', '101', '110', '101', '101'], 'S': ['111', '100', '111', '001', '111'], 'T': ['111', '010', '010', '010', '010'], 'U': ['101', '101', '101', '101', '111'], 'V': ['101', '101', '101', '101', '010'], 'W': ['101', '101', '111', '111', '101'], 'X': ['101', '101', '010', '101', '101'], 'Y': ['101', '101', '010', '010', '010'], ':': ['000', '010', '000', '010', '000'], ' ': ['000', '000', '000', '000', '000']
};
function drawText(png, text, x, y, color) {
    let cursor = x;
    for (const char of text.toUpperCase()) {
        const glyph = FONT[char] ?? FONT[' '];
        glyph.forEach((row, gy) => {
            [...row].forEach((bit, gx) => {
                if (bit === '1')
                    fillRect(png, cursor + gx * 2, y + gy * 2, 2, 2, color);
            });
        });
        cursor += 8;
    }
}
function basePattern(species, mood, energy) {
    const eyes = mood >= 65 ? 'e' : mood >= 35 ? 'n' : 'x';
    const mouth = energy >= 40 ? 'm' : 's';
    const patterns = {
        elf: ['....aa....', '...aaaa...', '..aaffaa..', '..af..fa..', '..aeeeea..', '..a.m..a..', '...abbb...', '..bb..bb..', '..b....b..', '.cc....cc.'],
        dwarf: ['....aa....', '...aaaa...', '..aaffaa..', '..aeeeea..', '..a.m..a..', '..dddddd..', '...dbbd...', '..bb..bb..', '..b....b..', '.cc....cc.'],
        human: ['....aa....', '...aaaa...', '..aaffaa..', '..aeeeea..', '..a.m..a..', '...abbb...', '..bb..bb..', '..bb..bb..', '..c....c..', '.cc....cc.'],
        orc: ['....aa....', '...aaaa...', '..aaffaa..', '..aeeeea..', '..a.m..a..', '...abbb...', '..bbggbb..', '..b....b..', '..c....c..', '.cc....cc.'],
        dragon: ['....aa....', '...aaaa...', '..haffah..', '..aeeeea..', '..a.m..a..', '...abbbh..', '..bb..bb..', '.h.b..b...', '..c....c..', '.cc....cc.']
    };
    return patterns[species].map(row => row.replace(/e/g, eyes).replace(/m/g, mouth));
}
export async function renderStatusCard(params) {
    const { pet, summary } = params;
    const outputDir = params.outputDir ?? path.resolve('/home/gigo/.openclaw/media/my-pet-hero');
    await mkdir(outputDir, { recursive: true });
    const species = SPECIES[pet.species];
    const png = new PNG({ width: WIDTH, height: HEIGHT });
    fillRect(png, 0, 0, WIDTH, HEIGHT, species.palette.background);
    fillRect(png, 10, 10, WIDTH - 20, HEIGHT - 20, '#ffffff');
    fillRect(png, 10, 10, WIDTH - 20, 26, species.palette.primary);
    drawText(png, `${pet.name.slice(0, 12)}`, 18, 18, '#ffffff');
    drawText(png, `LV ${pet.hero.level}`, 220, 18, '#ffffff');
    const palette = {
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
    ];
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
    drawText(png, summary.toUpperCase().replace(/[^A-Z0-9 :]/g, ' ').slice(0, 34), 18, 302, species.palette.text);
    const outputPath = path.join(outputDir, `${pet.id}-status.png`);
    await writeFile(outputPath, PNG.sync.write(png));
    return { outputPath };
}
