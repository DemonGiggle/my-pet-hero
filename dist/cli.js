#!/usr/bin/env node
import { CURRENT_SAVE_VERSION, DEFAULT_DATA_DIR, createPet, listPetSaves, loadPet, petFilePath, savePet } from './state.js';
import { simulatePet } from './simulate.js';
import { renderStatusCard } from './render.js';
import { feedPet, playWithPet, cleanPet } from './actions.js';
import { SPECIES_LIST } from './species.js';
import { CLASS_LIST, recommendClass } from './classes.js';
import { runCombat, ENEMIES } from './combat.js';
import { SKILLS } from './skills.js';
import { autoDungeonRun } from './systems.js';
import { describeItem, equipItemById, formatEquipmentSummary, listInventory, sellItemById } from './gear.js';
function getArg(name) {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
}
function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}
function slugify(input) {
    return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'pet';
}
function clonePet(pet) {
    return JSON.parse(JSON.stringify(pet));
}
function formatNeedSummary(pet) {
    const warnings = [];
    if (pet.needs.health < 45)
        warnings.push('血量偏低');
    if (pet.needs.energy < 35)
        warnings.push('有點累');
    if (pet.needs.hunger > 70)
        warnings.push('很餓');
    if (pet.needs.thirst > 70)
        warnings.push('很渴');
    if (pet.needs.hygiene < 35)
        warnings.push('需要整理');
    return warnings.length > 0 ? warnings.join('、') : '狀態大致穩定';
}
function formatHeadline(result) {
    const pet = result.pet;
    const location = pet.hero.dungeon.location === 'village'
        ? `現在在${pet.hero.dungeon.village.name}`
        : `正在 ${pet.hero.dungeon.currentDungeon?.name ?? `第 ${pet.hero.dungeon.floor} 層迷宮`} 探索`;
    const expedition = pet.hero.dungeon.currentExpedition
        ? `，本趟已推進 ${pet.hero.dungeon.currentExpedition.roomsCleared}/${pet.hero.dungeon.currentExpedition.totalRooms} 房`
        : '';
    return `${pet.name}是個 Lv${pet.hero.level} ${pet.species} ${pet.hero.classProgress.current}，心情${result.moodLabel}，${location}${expedition}。`;
}
function formatCardSummary(result) {
    const pet = result.pet;
    const location = pet.hero.dungeon.location === 'village' ? '在村莊待命' : '迷宮探索中';
    const urgency = pet.needs.health < 45 || pet.needs.energy < 35 || pet.needs.hunger > 70 || pet.needs.thirst > 70
        ? '先照顧狀態'
        : pet.hero.dungeon.currentExpedition
            ? '探險順利中'
            : '狀態穩定';
    return `${location} ${urgency}`;
}
function formatExpeditionSummary(expedition) {
    const title = expedition.completed
        ? `【探險結算】${expedition.dungeonName} / 第 ${expedition.floor} 層`
        : `【進行中探險】${expedition.dungeonName} / 第 ${expedition.floor} 層`;
    const lines = [
        title,
        `結果：${expedition.status}${expedition.returnMode ? ` / ${expedition.returnMode}` : ''}`,
        `進度：${expedition.roomsCleared}/${expedition.totalRooms} 房`,
        `收益：EXP +${expedition.totalExpGained} / Gold +${expedition.totalGoldGained}`,
        `Boss：${expedition.bossDefeated ? '已擊破' : '未擊破'}`,
        `完成度：${expedition.completed ? '本次探險已完整結束' : '仍在探索中'}`
    ];
    if (expedition.villagePreparation.length > 0)
        lines.push(`村莊整備：${expedition.villagePreparation.join('、')}`);
    if (expedition.returnSummary)
        lines.push(`回村整理：${expedition.returnSummary}`);
    if (expedition.logs.length > 0) {
        lines.push('本次歷程：');
        for (const item of expedition.logs) {
            const roomLabel = item.roomName ?? item.roomType ?? 'unknown';
            lines.push(`• ${roomLabel}，${item.outcome}，EXP +${item.expGained}，Gold +${item.goldGained}`);
            lines.push(`  ${item.text}`);
        }
    }
    return lines;
}
function formatAdventureReport(result) {
    const pet = result.pet;
    const adventures = pet.hero.adventureLog.slice(-3).reverse();
    const lines = [
        `【近況】${formatHeadline(result)}`,
        `【身體狀態】${formatNeedSummary(pet)}`,
        `【裝備】${formatEquipmentSummary(pet).join(' / ')}`
    ];
    if (pet.hero.dungeon.currentExpedition) {
        lines.push(`【正在做什麼】剛好人在 ${pet.hero.dungeon.currentExpedition.dungeonName}，目前清了 ${pet.hero.dungeon.currentExpedition.roomsCleared}/${pet.hero.dungeon.currentExpedition.totalRooms} 房。`);
        lines.push(...formatExpeditionSummary(pet.hero.dungeon.currentExpedition).map(line => `  ${line}`));
    }
    else if (pet.hero.dungeon.expeditionHistory.length > 0) {
        const latest = pet.hero.dungeon.expeditionHistory[pet.hero.dungeon.expeditionHistory.length - 1];
        lines.push(`【上一趟探險】剛從 ${latest.dungeonName} 回來，結果是 ${latest.status}${latest.returnMode ? ` / ${latest.returnMode}` : ''}。`);
        lines.push(...formatExpeditionSummary(latest).map(line => `  ${line}`));
    }
    else {
        lines.push(`【探險節奏】最近還沒留下正式探險紀錄，目前待在 ${pet.hero.dungeon.village.name}。`);
    }
    if (adventures.length === 0) {
        lines.push('【最近幾件事】還沒有新的冒險紀錄。');
        return lines;
    }
    lines.push('【最近幾件事】');
    for (const item of adventures) {
        const where = item.dungeonName ? `${item.dungeonName} 的 ${item.roomName ?? item.roomType ?? '未知房間'}` : `第 ${item.floor} 層`;
        lines.push(`- 在 ${where}，結果 ${item.outcome}，拿到 EXP +${item.expGained} / Gold +${item.goldGained}。`);
        lines.push(`  ${item.text}`);
        if (item.roomSummary)
            lines.push(`  房間摘要：${item.roomSummary}`);
        if (item.rewards && item.rewards.length > 0)
            lines.push(`  額外收穫：${item.rewards.join('、')}`);
        if (item.combat) {
            lines.push(`  戰鬥摘要：對上 ${item.combat.enemy.label}，打了 ${item.combat.rounds} 回合，結果 ${item.combat.outcome}。`);
            if (item.combat.skillsUsed.length > 0)
                lines.push(`  用到技能：${item.combat.skillsUsed.map(skill => skill.skillLabel).join('、')}`);
        }
    }
    return lines;
}
async function resolvePetId(explicitId) {
    if (explicitId)
        return explicitId;
    const saves = await listPetSaves();
    if (saves.length === 1)
        return saves[0].id;
    if (saves.length === 0)
        throw new Error('找不到任何角色存檔，請先用 create 建立角色。');
    throw new Error(`這裡有 ${saves.length} 個角色，請加 --id 指定。可用角色：${saves.map(save => save.id).join(', ')}`);
}
async function printStatus(idArg) {
    const id = await resolvePetId(idArg);
    const pet = await loadPet(id);
    const result = simulatePet(pet);
    await savePet(result.pet);
    const rendered = await renderStatusCard({ pet: result.pet, summary: formatCardSummary(result) });
    const currentDungeon = result.pet.hero.dungeon.currentDungeon;
    const currentRoom = currentDungeon?.rooms.find(room => room.id === currentDungeon.currentRoomId);
    const payload = {
        location: result.pet.hero.dungeon.location,
        village: result.pet.hero.dungeon.village,
        currentExpedition: result.pet.hero.dungeon.currentExpedition ?? null,
        expeditionHistory: result.pet.hero.dungeon.expeditionHistory.slice(-3),
        id: result.pet.id,
        name: result.pet.name,
        species: result.pet.species,
        heroClass: result.pet.hero.classProgress.current,
        classUnlocked: result.pet.hero.classProgress.unlocked,
        skills: SKILLS[result.pet.hero.classProgress.current],
        level: result.pet.hero.level,
        exp: result.pet.hero.exp,
        expToNext: result.pet.hero.expToNext,
        gold: result.pet.hero.gold,
        dungeonFloor: result.pet.hero.dungeon.floor,
        deepestFloor: result.pet.hero.dungeon.deepestFloor,
        currentDungeon: currentDungeon
            ? {
                id: currentDungeon.id,
                name: currentDungeon.name,
                theme: currentDungeon.theme,
                description: currentDungeon.description,
                currentRoomId: currentDungeon.currentRoomId,
                discoveredRoomIds: currentDungeon.discoveredRoomIds,
                clearedRoomIds: currentDungeon.clearedRoomIds,
                rooms: currentDungeon.rooms,
                currentRoom
            }
            : null,
        summary: result.summary,
        headline: formatHeadline(result),
        quickStatus: formatNeedSummary(result.pet),
        mood: result.moodLabel,
        stage: result.stageLabel,
        imagePath: rendered.outputPath,
        needs: result.pet.needs,
        attributes: result.pet.hero.attributes,
        equipment: result.pet.hero.equipment,
        equipmentSummary: formatEquipmentSummary(result.pet),
        aptitude: result.pet.hero.classProgress.aptitude,
        events: result.events.slice(-5),
        adventures: result.pet.hero.adventureLog.slice(-3)
    };
    if (hasFlag('report'))
        payload.report = formatAdventureReport(result).join('\n');
    console.log(JSON.stringify(payload, null, 2));
}
async function mutate(idArg, action) {
    const id = await resolvePetId(idArg);
    const pet = await loadPet(id);
    const result = simulatePet(pet);
    let actionText = '';
    if (action === 'feed')
        actionText = feedPet(result.pet);
    if (action === 'play')
        actionText = playWithPet(result.pet);
    if (action === 'clean')
        actionText = cleanPet(result.pet);
    await savePet(result.pet);
    const rendered = await renderStatusCard({ pet: result.pet, summary: actionText });
    console.log(JSON.stringify({
        id: result.pet.id,
        action,
        heroClass: result.pet.hero.classProgress.current,
        summary: actionText,
        imagePath: rendered.outputPath,
        needs: result.pet.needs,
        attributes: result.pet.hero.attributes,
        equipment: result.pet.hero.equipment,
        equipmentSummary: formatEquipmentSummary(result.pet),
        level: result.pet.hero.level,
        exp: result.pet.hero.exp,
        expToNext: result.pet.hero.expToNext
    }, null, 2));
}
async function create() {
    const name = getArg('name');
    const species = getArg('species');
    const heroClass = getArg('class');
    if (!name || !species) {
        throw new Error(`create 需要 --name 與 --species，可用種族: ${SPECIES_LIST.map(s => s.key).join(', ')}`);
    }
    const pet = createPet({ id: slugify(name), name, species, heroClass });
    await savePet(pet);
    const rendered = await renderStatusCard({ pet, summary: `${pet.name} 成為新的勇者` });
    console.log(JSON.stringify({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        heroClass: pet.hero.classProgress.current,
        recommendedClass: recommendClass(pet.species),
        skills: SKILLS[pet.hero.classProgress.current],
        level: pet.hero.level,
        attributes: pet.hero.attributes,
        aptitude: pet.hero.classProgress.aptitude,
        equipment: pet.hero.equipment,
        equipmentSummary: formatEquipmentSummary(pet),
        imagePath: rendered.outputPath,
        needs: pet.needs
    }, null, 2));
}
function printClasses() {
    console.log(JSON.stringify(CLASS_LIST, null, 2));
}
function printEnemies() {
    console.log(JSON.stringify(ENEMIES, null, 2));
}
function printSkills() {
    console.log(JSON.stringify(SKILLS, null, 2));
}
async function printSaves() {
    const saves = await listPetSaves();
    console.log(JSON.stringify({
        dataDir: DEFAULT_DATA_DIR,
        count: saves.length,
        defaultHeroId: saves.length === 1 ? saves[0].id : null,
        saves
    }, null, 2));
}
async function printDoctor(idArg) {
    const saves = await listPetSaves();
    const requestedId = idArg ?? (saves.length === 1 ? saves[0].id : undefined);
    const payload = {
        currentSaveVersion: CURRENT_SAVE_VERSION,
        dataDir: DEFAULT_DATA_DIR,
        saveCount: saves.length,
        defaultHeroId: saves.length === 1 ? saves[0].id : null,
        migrationPolicy: {
            supportedFrom: [2, 3, 4, 5, 6],
            target: CURRENT_SAVE_VERSION,
            behavior: 'loadPet 會自動升級舊存檔、備份原始 JSON、再覆寫成最新 schema。',
            rejects: '版本小於 2 或高於目前版本的存檔會拒絕載入。'
        }
    };
    if (requestedId) {
        const pet = await loadPet(requestedId);
        payload.pet = {
            id: pet.id,
            filePath: petFilePath(pet.id),
            version: pet.version,
            name: pet.name,
            species: pet.species,
            heroClass: pet.hero.classProgress.current,
            location: pet.hero.dungeon.location,
            expeditionHistoryCount: pet.hero.dungeon.expeditionHistory.length,
            inventoryCount: pet.hero.equipment.inventory.length
        };
    }
    console.log(JSON.stringify(payload, null, 2));
}
async function dungeonPreview(idArg) {
    const id = await resolvePetId(idArg);
    const pet = await loadPet(id);
    const previewPet = clonePet(pet);
    const at = getArg('at') ?? new Date().toISOString();
    const floorArg = getArg('floor');
    const repeat = Math.max(1, Number(getArg('repeat') ?? '1'));
    if (floorArg) {
        const floor = Number(floorArg);
        previewPet.hero.dungeon.floor = Math.max(1, floor - 1);
    }
    if (hasFlag('force-ready')) {
        previewPet.needs.health = Math.max(previewPet.needs.health, 78);
        previewPet.needs.energy = Math.max(previewPet.needs.energy, 76);
        previewPet.needs.hunger = Math.min(previewPet.needs.hunger, 34);
        previewPet.needs.thirst = Math.min(previewPet.needs.thirst, 30);
    }
    const before = JSON.parse(JSON.stringify({
        floor: previewPet.hero.dungeon.floor,
        runs: previewPet.hero.dungeon.runs,
        needs: previewPet.needs
    }));
    const logs = [];
    for (let i = 0; i < repeat; i++) {
        const runAt = new Date(new Date(at).getTime() + i * 60_000).toISOString();
        const log = autoDungeonRun(previewPet, runAt);
        if (!log)
            break;
        logs.push(log);
    }
    console.log(JSON.stringify({
        id: previewPet.id,
        requestedAt: at,
        forcedReady: hasFlag('force-ready'),
        repeat,
        triggered: logs.length > 0,
        before,
        logs,
        currentDungeon: previewPet.hero.dungeon.currentDungeon ?? null,
        currentExpedition: previewPet.hero.dungeon.currentExpedition ?? null,
        expeditionHistory: previewPet.hero.dungeon.expeditionHistory,
        after: {
            floor: previewPet.hero.dungeon.floor,
            runs: previewPet.hero.dungeon.runs,
            needs: previewPet.needs,
            location: previewPet.hero.dungeon.location
        }
    }, null, 2));
}
async function combatPreview(idArg) {
    const id = await resolvePetId(idArg);
    const pet = await loadPet(id);
    const result = simulatePet(pet);
    const floor = Number(getArg('floor') ?? result.pet.hero.dungeon.floor + 1);
    const combat = runCombat(result.pet, floor, new Date().toISOString());
    console.log(JSON.stringify({
        id: result.pet.id,
        floor,
        heroClass: result.pet.hero.classProgress.current,
        skills: SKILLS[result.pet.hero.classProgress.current],
        enemy: combat.enemy.label,
        outcome: combat.outcome,
        rounds: combat.rounds,
        expGained: combat.expGained,
        goldGained: combat.goldGained,
        healthLoss: combat.healthLoss,
        text: combat.text,
        skillsUsed: combat.skillsUsed,
        turns: combat.turns
    }, null, 2));
}
async function printInventory(idArg) {
    const id = await resolvePetId(idArg);
    const pet = await loadPet(id);
    const result = simulatePet(pet);
    await savePet(result.pet);
    console.log(JSON.stringify({
        id: result.pet.id,
        heroClass: result.pet.hero.classProgress.current,
        gold: result.pet.hero.gold,
        equipmentSummary: formatEquipmentSummary(result.pet),
        inventory: result.pet.hero.equipment.inventory,
        inventoryLines: listInventory(result.pet)
    }, null, 2));
}
async function equipInventoryItem(idArg, itemId) {
    const id = await resolvePetId(idArg);
    const pet = await loadPet(id);
    const result = simulatePet(pet);
    const summary = equipItemById(result.pet, itemId);
    await savePet(result.pet);
    console.log(JSON.stringify({
        id: result.pet.id,
        summary,
        equippedItem: describeItem(result.pet.hero.equipment.inventory.find((item) => item.id === itemId)),
        equipment: result.pet.hero.equipment,
        equipmentSummary: formatEquipmentSummary(result.pet),
        gold: result.pet.hero.gold
    }, null, 2));
}
async function sellInventoryItem(idArg, itemId) {
    const id = await resolvePetId(idArg);
    const pet = await loadPet(id);
    const result = simulatePet(pet);
    const summary = sellItemById(result.pet, itemId);
    await savePet(result.pet);
    console.log(JSON.stringify({
        id: result.pet.id,
        summary,
        gold: result.pet.hero.gold,
        equipment: result.pet.hero.equipment,
        equipmentSummary: formatEquipmentSummary(result.pet),
        inventoryLines: listInventory(result.pet)
    }, null, 2));
}
async function main() {
    const cmd = process.argv[2];
    if (!cmd || cmd === 'help') {
        console.log(`my-pet-hero commands:\n  create --name NAME --species elf|dwarf|human|orc|dragon [--class berserker|rogue|mage]\n  status [--id PET_ID] [--report]\n  inventory [--id PET_ID]\n  equip [--id PET_ID] --item ITEM_ID\n  sell [--id PET_ID] --item ITEM_ID\n  saves\n  doctor [--id PET_ID]\n  classes\n  skills\n  enemies\n  combat-preview [--id PET_ID] [--floor N]\n  dungeon-preview [--id PET_ID] [--floor N] [--at ISO] [--repeat N] [--force-ready]\n  feed [--id PET_ID]\n  play [--id PET_ID]\n  clean [--id PET_ID]`);
        return;
    }
    if (cmd === 'create')
        return create();
    if (cmd === 'classes')
        return printClasses();
    if (cmd === 'skills')
        return printSkills();
    if (cmd === 'enemies')
        return printEnemies();
    if (cmd === 'saves')
        return printSaves();
    if (cmd === 'doctor')
        return printDoctor(getArg('id'));
    if (cmd === 'inventory')
        return printInventory(getArg('id'));
    if (cmd === 'combat-preview')
        return combatPreview(getArg('id'));
    if (cmd === 'dungeon-preview')
        return dungeonPreview(getArg('id'));
    if (cmd === 'equip') {
        const itemId = getArg('item');
        if (!itemId)
            throw new Error('equip 需要 --item');
        return equipInventoryItem(getArg('id'), itemId);
    }
    if (cmd === 'sell') {
        const itemId = getArg('item');
        if (!itemId)
            throw new Error('sell 需要 --item');
        return sellInventoryItem(getArg('id'), itemId);
    }
    if (cmd === 'status')
        return printStatus(getArg('id'));
    if (cmd === 'feed' || cmd === 'play' || cmd === 'clean')
        return mutate(getArg('id'), cmd);
    throw new Error(`未知指令: ${cmd}`);
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
