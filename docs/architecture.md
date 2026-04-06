# My Pet Hero Architecture

這份文件講的是 **程式架構**，不是遊戲企劃。

## Core philosophy

My Pet Hero 採用 **query-time simulation**：

1. 載入上次儲存狀態
2. 計算距離上次模擬經過多久
3. 根據 needs decay、個性、種族與職業特性推進角色狀態
4. 視情況觸發生活事件、冒險事件、戰鬥
5. 即時計算並寫回狀態
6. 需要時輸出 PNG 狀態圖與 JSON / report

## Why this architecture

- 不需要背景 daemon
- 不需要常駐 game loop
- 狀態易保存、易搬移、易除錯
- 適合 CLI / bot / chat integration
- 很適合接 OpenClaw 這種查詢式互動

## Main modules

### `src/state.ts`
- 載入 / 驗證 / 儲存 pet state
- 建立新角色
- 處理 schema 相容性

### `src/simulate.ts`
- 推進時間
- 更新需求值
- 觸發生活 / 冒險事件
- 回傳狀態摘要

### `src/systems.ts`
- 放核心系統邏輯
- 例如自動恢復、經驗成長、迷宮推進等

### `src/classes.ts`
- 職業定義
- 種族相容性
- aptitude / recommendClass

### `src/skills.ts`
- 技能資料表
- 技能效果定義
- 冷卻與技能屬性

### `src/combat.ts`
- 敵人資料
- 戰鬥快照
- 命中 / 閃避 / 暴擊 / 護盾 / 技能解析
- 戰鬥結果輸出

### `src/render.ts`
- 產生像素風狀態圖 PNG

### `src/cli.ts`
- CLI 入口
- 對外暴露 create / status / report / action / preview 等指令

## Persisted state

目前主要資料存在：

- `data/pets/*.json`
- `data/default-hero.json`

State 內容大致包含：

- identity
- species
- timestamps
- needs
- personality
- hero progression
- class progress
- adventure logs
- optional combat snapshots

## Rendering strategy

狀態圖只負責：

- 角色基本資訊
- needs bars
- attributes
- summary

較長的 adventure log / report 不硬塞進圖裡，改走文字輸出，這樣比較不醜，也比較實際。

## Output modes

目前 CLI 主要有兩種輸出層：

1. **PNG status card**
2. **JSON payload**

其中 `status --report` 會額外在 JSON 中附上一段文字 report，方便直接貼到聊天介面。

## Next technical directions

- status effects system
- equipment system
- loot tables
- dungeon room generation
- skill unlock progression
- richer event authoring
- chat command mapping / bot integration
