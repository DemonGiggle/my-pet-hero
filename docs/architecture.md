# My Pet Hero Architecture

## Philosophy

My Pet Hero 不是 Tamagotchi 式常駐 loop，而是 **query-time simulation**：

1. 載入上次儲存狀態
2. 算出距離上次模擬經過多久
3. 根據種族配置做 needs decay
4. 根據職業特性與固定 seed + 時間 bucket 生成可重現事件
5. 更新狀態
6. 即時輸出狀態圖

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

## Why this is lightweight

- 沒有 scheduler / daemon 必要性
- 沒有 background game loop
- state 為單一 JSON
- render 只在需要時發生

## Species-first + Class-first design

種族與職業都不是單純貼標籤，而是驅動：
- 初始值
- 屬性傾向
- 相容加成
- 事件傾向
- 視覺與系統方向

目前職業使用獨立 config table（`src/classes.ts`），未來擴充新職業時，應優先延續資料驅動結構，而不是把技能與規則散落到多個 if/else。

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

- `combat/`：命中、傷害、抗性、控制效果
- `dungeons/`：樓層與房間生成
- `loot/`：寶箱、裝備、消耗品
- `skills/`：主動 / 被動技能樹
- `conversation/`：把自然語言查詢映射到 status / action
- `integrations/openclaw/`：回圖給聊天介面
