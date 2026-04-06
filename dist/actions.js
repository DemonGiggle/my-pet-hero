import { clamp } from './utils.js';
import { gainExp } from './systems.js';
export function feedPet(pet) {
    pet.needs.hunger = clamp(pet.needs.hunger - 22);
    pet.needs.thirst = clamp(pet.needs.thirst - 8);
    pet.needs.mood = clamp(pet.needs.mood + 6);
    pet.needs.health = clamp(pet.needs.health + 2);
    pet.history.push({ at: new Date().toISOString(), type: 'feed', delta: { hunger: -22, thirst: -8, mood: 6, health: 2 }, text: '補了一餐，精神和心情都回來一些。' });
    pet.history = pet.history.slice(-30);
    return '補了一餐，精神和心情都回來一些。';
}
export function playWithPet(pet) {
    pet.needs.mood = clamp(pet.needs.mood + 12);
    pet.needs.energy = clamp(pet.needs.energy - 10);
    pet.needs.hunger = clamp(pet.needs.hunger + 8);
    pet.needs.thirst = clamp(pet.needs.thirst + 6);
    gainExp(pet, 6);
    pet.history.push({ at: new Date().toISOString(), type: 'play', delta: { mood: 12, energy: -10, hunger: 8, thirst: 6 }, text: '訓練兼玩耍了一輪，雖然累但也變強了一點。' });
    pet.history = pet.history.slice(-30);
    return '訓練兼玩耍了一輪，雖然累但也變強了一點。';
}
export function cleanPet(pet) {
    pet.needs.hygiene = clamp(pet.needs.hygiene + 26);
    pet.needs.mood = clamp(pet.needs.mood + 4);
    pet.history.push({ at: new Date().toISOString(), type: 'clean', delta: { hygiene: 26, mood: 4 }, text: '整理裝備與身上髒污後，整體狀態清爽不少。' });
    pet.history = pet.history.slice(-30);
    return '整理裝備與身上髒污後，整體狀態清爽不少。';
}
