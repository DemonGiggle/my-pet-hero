import { PetEvent, PetState, SimulationResult } from './types.js';
import { SPECIES } from './species.js';
import { bucketHours, clamp, hashToUnit, pickOne } from './utils.js';
import { autoDungeonRun, autoRecoverNeeds } from './systems.js';

function moodLabel(mood: number): string {
  if (mood >= 85) return '雀躍';
  if (mood >= 65) return '穩定';
  if (mood >= 45) return '有點悶';
  if (mood >= 25) return '煩躁';
  return '低潮';
}

function stageLabel(ageHours: number): string {
  if (ageHours < 24) return '新生期';
  if (ageHours < 24 * 7) return '幼年期';
  if (ageHours < 24 * 30) return '成長期';
  return '成熟期';
}

const EVENT_COPY = {
  bored: ['閒到發呆，開始有點無聊。', '沒人理的時候，情緒慢慢掉下來。'],
  messy: ['玩過頭，身上沾了點灰。', '滾來滾去之後變得不太整潔。'],
  proud: ['自己照顧得不錯，神情有點得意。', '狀態穩穩的，整個氣場都變好了。']
} as const;

export function simulatePet(pet: PetState, nowIso = new Date().toISOString()): SimulationResult {
  const species = SPECIES[pet.species];
  const last = new Date(pet.lastSimulatedAt).getTime();
  const now = new Date(nowIso).getTime();
  if (now <= last) {
    return {
      pet,
      events: [],
      summary: `${pet.name}現在看起來${moodLabel(pet.needs.mood)}。`,
      moodLabel: moodLabel(pet.needs.mood),
      stageLabel: stageLabel(pet.ageHours)
    };
  }

  const hours = (now - last) / 3600_000;
  pet.ageHours += hours;
  pet.needs.hunger = clamp(pet.needs.hunger + species.decay.hungerPerHour * hours);
  pet.needs.thirst = clamp(pet.needs.thirst + species.decay.thirstPerHour * hours);
  pet.needs.energy = clamp(pet.needs.energy - species.decay.energyPerHour * hours);
  pet.needs.hygiene = clamp(pet.needs.hygiene - species.decay.hygienePerHour * hours);
  pet.needs.mood = clamp(
    pet.needs.mood
      - species.decay.moodDriftPerHour * hours
      - Math.max(0, pet.needs.hunger - 70) * 0.06
      - Math.max(0, pet.needs.thirst - 70) * 0.07
      - Math.max(0, 35 - pet.needs.energy) * 0.08
      - Math.max(0, 35 - pet.needs.hygiene) * 0.05
  );
  pet.needs.health = clamp(
    pet.needs.health
      - Math.max(0, pet.needs.hunger - 88) * 0.05
      - Math.max(0, pet.needs.thirst - 88) * 0.07
      - Math.max(0, 20 - pet.needs.energy) * 0.08
      + (pet.needs.hygiene > 75 ? 0.5 : 0)
  );

  const events: PetEvent[] = [];
  for (const bucket of bucketHours(pet.lastSimulatedAt, nowIso, 2)) {
    const selfCare = autoRecoverNeeds(pet, bucket);
    if (selfCare.length > 0) {
      events.push({ at: bucket, type: 'self-care', delta: {}, text: selfCare.join('') });
    }

    const adventure = autoDungeonRun(pet, bucket);
    if (adventure) {
      events.push({ at: bucket, type: 'adventure', delta: {}, text: adventure.text });
    }

    const unit = hashToUnit(`${pet.seed}:${bucket}`);
    if (unit < 0.15) {
      const event: PetEvent = { at: bucket, type: 'bored', delta: { mood: -6 }, text: pickOne([...EVENT_COPY.bored], unit / 0.15) };
      pet.needs.mood = clamp(pet.needs.mood - 6);
      events.push(event);
    } else if (unit < 0.27) {
      const event: PetEvent = { at: bucket, type: 'messy', delta: { hygiene: -8 }, text: pickOne([...EVENT_COPY.messy], (unit - 0.15) / 0.12) };
      pet.needs.hygiene = clamp(pet.needs.hygiene - 8);
      events.push(event);
    } else if (unit > 0.92) {
      const event: PetEvent = { at: bucket, type: 'proud', delta: { mood: 5 }, text: pickOne([...EVENT_COPY.proud], (unit - 0.92) / 0.08) };
      pet.needs.mood = clamp(pet.needs.mood + 5);
      events.push(event);
    }
  }

  pet.lastSimulatedAt = nowIso;
  pet.history = [...pet.history, ...events].slice(-30);

  const mood = moodLabel(pet.needs.mood);
  const summary = events.length > 0 ? events[events.length - 1].text : `${pet.name}這段時間一邊生活、一邊穩穩成長。`;
  return {
    pet,
    events,
    summary,
    moodLabel: mood,
    stageLabel: stageLabel(pet.ageHours)
  };
}
