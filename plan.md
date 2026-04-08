# My Pet Hero Plan

這份檔案是 milestone 工作清單。

原則：
- 每個 milestone 都要可驗證，不接受只有概念沒落地
- 做完就更新狀態，避免嘴上說有、repo 裡沒有
- 先把核心 loop 做紮實，再擴花樣

---

## Status Legend

- [ ] 未開始
- [~] 進行中
- [x] 已完成
- [-] 延後 / 暫不做

---

## M0 - Core project foundation

目標：把專案從空資料夾拉成可執行、可持續開發的 Node.js/TypeScript 專案。

### Scope
- [x] TypeScript 專案初始化
- [x] 基本 CLI 指令
- [x] JSON state persistence
- [x] query-time simulation 基礎架構
- [x] 狀態圖輸出
- [x] README / docs 初版
- [x] Git repo 建立與 push

### Exit Criteria
- [x] `npm run build` 可通過
- [x] 可以 create / status / render
- [x] repo 已 push 到 GitHub

---

## M1 - Hero core systems

目標：先把寵物勇者的基本 RPG 骨架立起來。

### Scope
- [x] 種族系統（elf / dwarf / human / orc / dragon）
- [x] 基礎 needs（health / hunger / thirst / mood / energy / hygiene）
- [x] 英雄屬性（STR / AGI / INT / VIT / LUCK）
- [x] 等級 / EXP / gold
- [x] 職業系統基礎架構
- [x] berserker / rogue / mage 初版
- [x] 技能系統初版
- [x] 戰鬥系統初版

### Exit Criteria
- [x] create 時可指定職業
- [x] status 可看到 class / attributes / exp / skills
- [x] combat-preview 可用
- [x] build / push 完成

---

## M2 - Dungeon Phase 1: procedural dungeon skeleton

目標：把冒險從單純 floor 數字，升級成真正的迷宮 instance。

### Scope
- [x] DungeonTemplate
- [x] DungeonInstance
- [x] DungeonRoom / room graph
- [x] 隨機迷宮名稱
- [x] 主題迷宮模板（bone-crypt / mist-tower / ember-rift）
- [x] 主題怪物池
- [x] 驗證指令 `dungeon-preview`

### Exit Criteria
- [x] 能生成迷宮 instance
- [x] 能看到 current dungeon / room
- [x] 能用 CLI 驗證 preview
- [x] 已 commit / push

---

## M3 - Dungeon Phase 2: room outcomes and exploration records

目標：讓不同房間真正有功能差異，不只是名字不同。

### Scope
- [x] battle room 明確化
- [x] elite room 明確化
- [x] boss room 明確化
- [x] treasure room reward flow
- [x] rest room recovery flow
- [x] event room event flow
- [x] exploration record / run log 整理
- [x] 在 status/report 裡清楚顯示最近探索內容
- [x] 檢查 room outcome 與 combat/reward 的一致性
- [x] build 驗證
- [x] commit / push

### Exit Criteria
- [x] 不同 room type 有可見、可驗證的差異
- [x] recent report 看得出探索內容
- [x] CLI 可輸出 room / rewards / combat / runState
- [x] build / push 完成

---

## M3.5 - Village and expedition loop

目標：建立村莊 → 地下城 → boss 房傳送門 → 回村的完整探險週期。

### Scope
- [x] village state / location state
- [x] expedition run model
- [x] 村莊自動整補流程
- [x] 地下城出發與回村邏輯
- [x] boss 房傳送門回村
- [x] expedition summary / history
- [x] status/report 顯示村莊與探險狀態

### Exit Criteria
- [x] 角色有明確 location: village / dungeon
- [x] 每次探險都有完整開始與結束
- [x] 打完 boss 後可透過 portal 回村
- [x] 能查看完整 expedition summary

---

## M4 - Dungeon Phase 3: map UX and hazards

目標：把迷宮從能跑升級成更像在探險。

### Scope
- [ ] ASCII minimap
- [ ] bitmap minimap / status card integration（若值得做）
- [ ] traps
- [ ] branching routes 強化
- [ ] dungeon modifiers
- [ ] exclusive monsters / drops
- [ ] secret / rare rooms（可選）

### Notes
- 目前 room graph 已有 exits 與少量 branch metadata
- 實際推進仍是依房間順序前進，還不是正式分歧導航

### Exit Criteria
- status / report 可看到更明確的迷宮結構資訊
- 不同迷宮不只換皮，玩法差異開始出現

---

## M5 - Combat depth upgrade

目標：讓戰鬥從能打，進化到有策略感。

### Scope
- [ ] 狀態效果（burn / poison / freeze / stun / bleed...）
- [ ] enemy special abilities
- [ ] skill trigger / cooldown / synergy 補強
- [ ] class identity 更鮮明
- [ ] 敵人 AI 決策補強
- [ ] damage formula tuning

### Exit Criteria
- 戰鬥 log 不再只是平 A + 偶爾技能
- 職業差異在實戰中明顯可見

---

## M6 - Equipment and loot

目標：建立長期成長的主要外部系統。

### Scope
- [x] weapon / armor / accessory slots
- [x] item rarity
- [x] dungeon drops
- [x] class-themed item generation
- [x] equipment stats impact
- [x] inventory / stash 基礎
- [x] auto-equip better loot
- [x] manual equip CLI
- [x] sell CLI

### Notes
- 掉落會進背包，背包上限目前保留最近 40 件
- 自動換裝以 `gearScore` 比較同槽裝備
- sell 會直接移除背包中的裝備並轉成 gold
- 若賣掉的是已裝備物品，該槽會被清空

### Exit Criteria
- [x] 角色成長不再只靠 level
- [x] loot 有實際價值
- [x] CLI 可查看 inventory / equip / sell
- [x] 裝備加成會進入戰鬥屬性計算

---

## M7 - Long-term hero progression

目標：讓角色有真正的養成軸，而不是只看數字浮動。

### Scope
- [ ] skill growth / unlocks
- [ ] class branching / advanced classes
- [ ] species-specific traits
- [ ] hero traits / quirks / personality drift
- [ ] long-term achievements / adventure history

### Exit Criteria
- 不同角色之間的成長路線開始分化

---

## M8 - Usability and assistant integration

目標：讓這專案更適合自然語言操作與日常使用。

### Scope
- [ ] default hero UX 補強
- [~] 更好的 report 文本格式
- [ ] 更好的 image summary
- [ ] natural-language workflow mapping
- [ ] debug / admin commands
- [ ] migration strategy for old save versions

### Notes
- 目前 `status --report` 已可讀，但仍偏 debug / JSON-friendly
- 舊存檔缺少 migration，這件事已經開始變重要

### Exit Criteria
- 使用者用自然語言問「我的寵物怎樣了」時，流程穩、結果清楚

---

## Current Focus

### Active Milestone
- [~] M8 - Usability and assistant integration

### Immediate Next Tasks
- [ ] 決定舊存檔 migration 策略
- [ ] 把 report 再整理得更像對人講話，不只像 debug 輸出
- [ ] 決定 minimap / map UX 是否值得提前到 M4

---

## Parking Lot

先記著，但現在別分心：

- [ ] town / settlement 系統深化
- [ ] crafting / alchemy 深化
- [ ] summon / companion system
- [ ] portal / fast travel 擴充
- [ ] seasonal / daily world events
- [ ] multiplayer / hero roster view

---

## Working Rule

每完成一個 milestone，至少同步更新：
- `plan.md`
- `README.md`（如果使用方式有變）
- `docs/architecture.md`（如果技術結構有變）
- `docs/game-design.md`（如果設計方向有變）
