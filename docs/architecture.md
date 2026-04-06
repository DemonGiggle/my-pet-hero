# My Pet Hero Architecture

## Philosophy

My Pet Hero 不是 Tamagotchi 式常駐 loop，而是 **query-time simulation**：

1. 載入上次儲存狀態
2. 算出距離上次模擬經過多久
3. 根據種族配置做 needs decay
4. 根據職業特性、敵人池與固定 seed + 時間 bucket 生成可重現事件
5. 若發生冒險，則進入簡化戰鬥解析
6. 戰鬥中依職業技能自動觸發技能
7. 更新狀態
8. 即時輸出狀態圖

## State Model

`PetState` 保存：
- identity
- species
- createdAt / lastSimulatedAt
- ageHours
- needs
- personality
- seed
- hero progression
- current class / unlocked classes / aptitude
- recent history
- adventure logs
- optional combat result snapshot

## Why this is lightweight

- 沒有 scheduler / daemon 必要性
- 沒有 background game loop
- state 為單一 JSON
- render 只在需要時發生
- 戰鬥只在事件觸發時解析，不持續常駐
- 技能只在戰鬥解析當下套用，不需要額外背景狀態機

## Class + Skill design

職業與技能都採資料驅動：

- `src/classes.ts`：職業設定
- `src/skills.ts`：技能設定
- `src/combat.ts`：戰鬥與技能解析

目前技能支援類型：
- `damage`
- `heal`
- `shield`
- `buff`（類型先保留，下一步可接）

每個技能可定義：
- target
- effect kind
- damage type
- power / heal / shield multiplier
- hit / crit bonus
- cooldown turns
- minimum level

## Combat module

目前戰鬥系統位於 `src/combat.ts`，負責：

- 敵人樣板定義
- 依樓層挑選敵人
- 由 hero state 建立戰鬥快照
- 計算：
  - attack / magicAttack
  - defense / magicDefense
  - accuracy / evasion
  - crit
  - shield
- 跑簡化回合制戰鬥
- 在合適情境下觸發技能
- 產出可存檔的 combat result

## Current class skills

### Berserker
- 粉碎重擊：高倍率物理輸出
- 鋼鐵姿態：護盾

### Rogue
- 影襲：高命中高爆擊輸出
- 閃步：護盾

### Mage
- 奧術爆裂：高倍率魔法輸出
- 祕術饗宴：補血

## Suggested next modules

- `status-effects/`：暈眩、緩速、中毒、燃燒、魅惑
- `dungeons/`：樓層、房間、陷阱、事件生成
- `loot/`：寶箱、裝備、消耗品
- `equipment/`：裝備欄位、職業限制、稀有度
- `town/`：商店、休息、補給、傳送
- `conversation/`：把自然語言查詢映射到 status / action
- `integrations/openclaw/`：回圖給聊天介面
