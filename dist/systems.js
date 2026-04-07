import { CLASSES, getClassAffinity } from './classes.js';
import { clamp, expToNextLevel, hashToUnit } from './utils.js';
import { runCombat } from './combat.js';
import { advanceDungeonRoom, generateDungeonInstance, getCurrentRoom } from './dungeons.js';
import { autoEquipLoot, maybeGenerateLoot } from './gear.js';
export function autoRecoverNeeds(pet, at) {
    const notes = [];
    if (pet.needs.hunger >= 72) {
        pet.needs.hunger = clamp(pet.needs.hunger - 18);
        pet.needs.energy = clamp(pet.needs.energy - 4);
        pet.needs.mood = clamp(pet.needs.mood + 2);
        notes.push('自己去找了點食物吃。');
    }
    if (pet.needs.thirst >= 70) {
        pet.needs.thirst = clamp(pet.needs.thirst - 22);
        pet.needs.mood = clamp(pet.needs.mood + 1);
        notes.push('自己找到水喝，沒有渴太久。');
    }
    if (notes.length > 0) {
        pet.history.push({ at, type: 'self-care', delta: { hunger: -18, thirst: -22, mood: 3, energy: -4 }, text: notes.join('') });
        pet.history = pet.history.slice(-30);
    }
    return notes;
}
export function gainExp(pet, amount) {
    const notes = [];
    pet.hero.exp += amount;
    while (pet.hero.exp >= pet.hero.expToNext) {
        pet.hero.exp -= pet.hero.expToNext;
        pet.hero.level += 1;
        pet.hero.statPoints += 3;
        pet.hero.expToNext = expToNextLevel(pet.hero.level);
        pet.hero.attributes = applyAutoStatGrowth(pet.hero.attributes, pet.hero.level);
        notes.push(`升到 Lv.${pet.hero.level}`);
    }
    return notes;
}
export function applyAutoStatGrowth(attributes, level) {
    return {
        strength: attributes.strength + (level % 2 === 0 ? 1 : 0),
        agility: attributes.agility + 1,
        intelligence: attributes.intelligence + (level % 3 === 0 ? 1 : 0),
        vitality: attributes.vitality + 1,
        luck: attributes.luck + (level % 4 === 0 ? 1 : 0)
    };
}
function ensureDungeonInstance(pet, floor, at) {
    const current = pet.hero.dungeon.currentDungeon;
    if (!current || current.floor !== floor) {
        const created = generateDungeonInstance({ pet, floor, at });
        pet.hero.dungeon.currentDungeon = created;
        pet.hero.dungeon.location = 'dungeon';
        const prepNotes = runVillageRecovery(pet, at);
        pet.hero.dungeon.currentExpedition = {
            id: `exp-${floor}-${Date.parse(at)}`,
            startedAt: at,
            dungeonName: created.name,
            floor,
            status: 'exploring',
            roomsCleared: 0,
            totalRooms: created.rooms.length,
            bossDefeated: false,
            totalExpGained: 0,
            totalGoldGained: 0,
            villagePreparation: prepNotes,
            completed: false,
            logs: []
        };
        return created;
    }
    return current;
}
function runVillageRecovery(pet, at) {
    const notes = [];
    pet.hero.dungeon.location = 'village';
    pet.hero.dungeon.village.lastVisitedAt = at;
    if (pet.needs.energy < 82) {
        pet.needs.energy = clamp(pet.needs.energy + 26);
        notes.push('在村莊旅店休息，恢復了不少精神。');
    }
    if (pet.needs.health < 78) {
        pet.needs.health = clamp(pet.needs.health + 12);
        notes.push('在村裡整理傷勢，氣色好了一些。');
    }
    if (pet.needs.hunger > 40 && pet.hero.dungeon.village.supplies.food > 0) {
        pet.needs.hunger = clamp(pet.needs.hunger - 22);
        pet.hero.dungeon.village.supplies.food -= 1;
        notes.push('在村裡吃了一頓熱食。');
    }
    if (pet.needs.thirst > 38 && pet.hero.dungeon.village.supplies.water > 0) {
        pet.needs.thirst = clamp(pet.needs.thirst - 24);
        pet.hero.dungeon.village.supplies.water -= 1;
        notes.push('補滿了水袋，也順便解了渴。');
    }
    pet.needs.mood = clamp(pet.needs.mood + (notes.length > 0 ? 6 : 2));
    return notes;
}
export function autoDungeonRun(pet, at) {
    if (pet.hero.dungeon.location === 'village' && pet.needs.energy < 35)
        runVillageRecovery(pet, at);
    if (pet.needs.energy < 35 || pet.needs.health < 35)
        return null;
    const heroClass = CLASSES[pet.hero.classProgress.current];
    const affinity = getClassAffinity(pet.hero.classProgress.current, pet.species);
    const urge = pet.personality.curiosity * 0.5 + pet.personality.playfulness * 0.2 + pet.hero.level * 0.03;
    const roll = hashToUnit(`${pet.seed}:dungeon:${at}`);
    if (roll > Math.min(0.28 + urge, 0.72))
        return null;
    const floor = Math.max(1, pet.hero.dungeon.floor + 1);
    const dungeon = ensureDungeonInstance(pet, floor, at);
    const room = getCurrentRoom(dungeon) ?? dungeon.rooms[0];
    const treasureBias = heroClass.abilities.includes('lockpicking') ? 0.12 : 0;
    const roomIndex = Math.max(1, dungeon.rooms.findIndex(candidate => candidate.id === room.id) + 1);
    const rewards = [];
    const roomEffect = {};
    let outcome;
    let exp = 0;
    let gold = 0;
    let text = '';
    let roomSummary = '';
    let combat;
    if (room.type === 'rest') {
        outcome = 'rest';
        exp = 4;
        roomEffect.energy = 18;
        roomEffect.health = 6;
        roomEffect.mood = 4;
        pet.needs.energy = clamp(pet.needs.energy + roomEffect.energy);
        pet.needs.health = clamp(pet.needs.health + roomEffect.health);
        pet.needs.mood = clamp(pet.needs.mood + roomEffect.mood);
        roomSummary = '休息點，主打回復。';
        rewards.push(`回復 HP +${roomEffect.health}`, `回復 ENERGY +${roomEffect.energy}`);
        text = `${pet.name} 在 ${dungeon.name} 的${room.name}稍作休息，恢復了一點精神。`;
    }
    else if (room.type === 'treasure' || (room.type === 'event' && hashToUnit(`${pet.seed}:event-treasure:${at}`) > 0.5 - treasureBias)) {
        outcome = 'treasure';
        exp = Math.round((8 + floor * 3) * affinity);
        gold = 14 + floor * 5 + (room.type === 'treasure' ? 6 : 0);
        roomEffect.energy = -(8 + floor);
        roomEffect.hunger = 6 + floor;
        roomEffect.thirst = 7 + floor;
        roomEffect.mood = 8;
        roomEffect.health = -1;
        pet.needs.energy = clamp(pet.needs.energy + roomEffect.energy);
        pet.needs.hunger = clamp(pet.needs.hunger + roomEffect.hunger);
        pet.needs.thirst = clamp(pet.needs.thirst + roomEffect.thirst);
        pet.needs.mood = clamp(pet.needs.mood + roomEffect.mood);
        pet.needs.health = clamp(pet.needs.health + roomEffect.health);
        roomSummary = room.type === 'treasure' ? '寶物房，收益高但會消耗體力。' : '事件房觸發寶箱支線。';
        rewards.push(`EXP +${exp}`, `Gold +${gold}`);
        text = `${pet.name} 在 ${dungeon.name} 的${room.name}找到寶箱，帶回一批戰利品。`;
    }
    else if (room.type === 'event') {
        outcome = 'rest';
        exp = 6;
        gold = 3 + floor;
        roomEffect.mood = 5;
        roomEffect.energy = -4;
        pet.needs.mood = clamp(pet.needs.mood + roomEffect.mood);
        pet.needs.energy = clamp(pet.needs.energy + roomEffect.energy);
        roomSummary = '事件房，沒有正面戰鬥，但會給小獎勵或狀態波動。';
        rewards.push(`EXP +${exp}`, `Gold +${gold}`, `MOOD +${roomEffect.mood}`);
        text = `${pet.name} 在 ${dungeon.name} 的${room.name}遇到奇異事件，雖然沒開打，但也不是白跑一趟。`;
    }
    else {
        combat = runCombat(pet, floor + (room.type === 'boss' ? 2 : room.type === 'elite' ? 1 : 0), at);
        outcome = combat.outcome;
        const rewardScale = room.type === 'boss' ? 2.2 : room.type === 'elite' ? 1.45 : 1;
        exp = Math.round(combat.expGained * affinity * rewardScale);
        gold = Math.round(combat.goldGained * rewardScale + (room.type === 'boss' ? floor * 6 : 0));
        const healthPercentLoss = (combat.healthLoss / Math.max(1, combat.hero.maxHealth)) * 100;
        roomEffect.health = -Number(healthPercentLoss.toFixed(1));
        roomEffect.energy = -(10 + floor * 1.6 + (room.type === 'boss' ? 8 : room.type === 'elite' ? 4 : 0));
        roomEffect.hunger = 8 + floor + (room.type === 'boss' ? 2 : 0);
        roomEffect.thirst = 10 + floor + (room.type === 'boss' ? 2 : 0);
        roomEffect.mood = combat.moodDelta + (room.type === 'boss' ? 4 : room.type === 'elite' ? 2 : 0);
        pet.needs.health = clamp(pet.needs.health + roomEffect.health);
        pet.needs.energy = clamp(pet.needs.energy + roomEffect.energy);
        pet.needs.hunger = clamp(pet.needs.hunger + roomEffect.hunger);
        pet.needs.thirst = clamp(pet.needs.thirst + roomEffect.thirst);
        pet.needs.mood = clamp(pet.needs.mood + roomEffect.mood);
        roomSummary = room.type === 'boss' ? 'Boss 房，戰鬥壓力最高，獎勵也最大。'
            : room.type === 'elite' ? 'Elite 房，強敵與加成獎勵。'
                : '一般戰鬥房。';
        rewards.push(`EXP +${exp}`, `Gold +${gold}`);
        text = `${pet.name} 在 ${dungeon.name} 的${room.name}${combat.text.replace(`${pet.name} `, '')}`;
    }
    pet.hero.gold += gold;
    const levelNotes = gainExp(pet, exp);
    rewards.push(...levelNotes);
    const loot = maybeGenerateLoot(pet, floor, at, room.type);
    if (loot) {
        const lootNote = autoEquipLoot(pet, loot);
        rewards.push(`掉落：${loot.name}`);
        rewards.push(lootNote);
    }
    const nextRoom = advanceDungeonRoom(dungeon);
    const completedDungeon = (outcome === 'win' || outcome === 'treasure' || outcome === 'rest') && !nextRoom;
    if (completedDungeon) {
        pet.hero.dungeon.floor = floor;
        pet.hero.dungeon.currentDungeon = undefined;
        pet.hero.dungeon.location = 'village';
        if (pet.hero.dungeon.currentExpedition) {
            pet.hero.dungeon.currentExpedition.status = 'returned';
            pet.hero.dungeon.currentExpedition.returnMode = 'portal';
            pet.hero.dungeon.currentExpedition.endedAt = at;
            pet.hero.dungeon.currentExpedition.bossDefeated = room.type === 'boss';
            pet.hero.dungeon.currentExpedition.completed = true;
        }
        text += ' 最深處出現了傳送門，隨後返回村莊。';
        const returnNotes = runVillageRecovery(pet, at);
        if (pet.hero.dungeon.currentExpedition) {
            pet.hero.dungeon.currentExpedition.returnSummary = returnNotes.join(' ');
        }
    }
    else if (outcome === 'defeat') {
        pet.hero.dungeon.floor = Math.max(1, floor - 1);
        pet.hero.dungeon.currentDungeon = undefined;
        pet.hero.dungeon.location = 'village';
        if (pet.hero.dungeon.currentExpedition) {
            pet.hero.dungeon.currentExpedition.status = 'failed';
            pet.hero.dungeon.currentExpedition.returnMode = 'defeat';
            pet.hero.dungeon.currentExpedition.endedAt = at;
            pet.hero.dungeon.currentExpedition.completed = true;
        }
    }
    else if (outcome === 'escape') {
        pet.hero.dungeon.floor = Math.max(1, floor - 1);
        pet.hero.dungeon.location = 'village';
        if (pet.hero.dungeon.currentExpedition) {
            pet.hero.dungeon.currentExpedition.status = 'returned';
            pet.hero.dungeon.currentExpedition.returnMode = 'retreat';
            pet.hero.dungeon.currentExpedition.endedAt = at;
            pet.hero.dungeon.currentExpedition.completed = true;
        }
    }
    pet.hero.dungeon.deepestFloor = Math.max(pet.hero.dungeon.deepestFloor, floor);
    pet.hero.dungeon.runs += 1;
    const log = {
        at,
        floor,
        outcome,
        text,
        expGained: exp,
        goldGained: gold,
        combat,
        dungeonName: dungeon.name,
        roomName: room.name,
        roomType: room.type,
        rewards,
        roomSummary,
        roomEffect,
        runState: {
            roomIndex,
            roomCount: dungeon.rooms.length,
            clearedRoomIds: [...dungeon.clearedRoomIds],
            discoveredRoomIds: [...dungeon.discoveredRoomIds],
            completedDungeon
        }
    };
    pet.hero.adventureLog = [...pet.hero.adventureLog, log].slice(-30);
    if (pet.hero.dungeon.currentExpedition) {
        pet.hero.dungeon.currentExpedition.logs = [...pet.hero.dungeon.currentExpedition.logs, log];
        pet.hero.dungeon.currentExpedition.roomsCleared = log.runState?.roomIndex ?? pet.hero.dungeon.currentExpedition.roomsCleared;
        pet.hero.dungeon.currentExpedition.totalRooms = log.runState?.roomCount ?? pet.hero.dungeon.currentExpedition.totalRooms;
        pet.hero.dungeon.currentExpedition.totalExpGained += exp;
        pet.hero.dungeon.currentExpedition.totalGoldGained += gold;
        if (room.type === 'boss' && outcome === 'win')
            pet.hero.dungeon.currentExpedition.bossDefeated = true;
        if ((pet.hero.dungeon.currentExpedition.status === 'returned' || pet.hero.dungeon.currentExpedition.status === 'failed') && !pet.hero.dungeon.currentExpedition.returnSummary) {
            pet.hero.dungeon.currentExpedition.returnSummary = pet.hero.dungeon.currentExpedition.status === 'failed'
                ? '這趟探險失利，狼狽地被帶回村莊。'
                : '這趟探險結束，已經順利回到村莊。';
        }
        if (pet.hero.dungeon.currentExpedition.completed) {
            pet.hero.dungeon.expeditionHistory = [...pet.hero.dungeon.expeditionHistory, pet.hero.dungeon.currentExpedition].slice(-12);
            pet.hero.dungeon.currentExpedition = undefined;
        }
    }
    return log;
}
