# My Pet Hero Architecture

## Philosophy

My Pet Hero 不是 Tamagotchi 式常駐 loop，而是 **query-time simulation**：

1. 載入上次儲存狀態
2. 算出距離上次模擬經過多久
3. 根據種族配置做 needs decay
4. 根據職業特性、敵人池與固定 seed + 時間 bucket 生成可重現事件
5. 若發生冒險，則進入簡化戰鬥解析
6. 更新狀態
7. 即時輸出狀態圖

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

## Species-first + Class-first design

種族與職業都不是單純貼標籤，而是驅動：
- 初始值
- 屬性傾向
- 相容加成
- 事件傾向
- 視覺與系統方向

目前職業使用獨立 config table（`src/classes.ts`），未來擴充新職業時，應優先延續資料驅動結構，而不是把技能與規則散落到多個 if/else。

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
- 跑簡化回合制戰鬥
- 產出可存檔的 combat result

### Combat rules (current)

- 每場最多 6 回合
- 依職業決定主傷害傾向（法師偏魔法，其餘偏物理）
- 命中、閃避、暴擊都有獨立計算
- 戰鬥結果分為：
  - `win`
  - `escape`
  - `defeat`
- 結果會回寫到：
  - health
  - mood
  - exp
  - gold
  - adventure log

## Current class set

### Berserker
- 雙手武器 / 多近戰武器
- 厚血
- 物理抗性高
- 怕魔法
- 抗控制與限制行動
- 矮人 / 人類加成

### Rogue
- 短刃 / 雙持
- 高攻速高敏捷
- 陷阱偵測 / 開鎖 / 潛行
- 偏皮甲
- 人類 / 精靈 / 龍族加成

### Mage
- 法杖
- 元素 / 召喚 / 心控法術
- 魔法食物 / 藥水 / 城鎮傳送門
- 龍族 / 精靈加成

## Suggested next modules

- `skills/`：主動 / 被動技能樹
- `dungeons/`：樓層、房間、陷阱、事件生成
- `loot/`：寶箱、裝備、消耗品
- `equipment/`：裝備欄位、職業限制、稀有度
- `town/`：商店、休息、補給、傳送
- `conversation/`：把自然語言查詢映射到 status / action
- `integrations/openclaw/`：回圖給聊天介面
