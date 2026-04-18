# My Pet Hero / 我的寵物勇者

一個 query-time 的寵物勇者模擬器。

它不是背景常駐的電子雞，而是只有在你查詢或互動時，才根據經過時間推進生活、村莊整補、迷宮探索、戰鬥、掉寶與成長。

## 目前已完成的核心內容

- 不需要背景 daemon
- 以單一存檔保存角色狀態，且預設寫到 repo 外的使用者狀態目錄
- 種族、職業、屬性、技能、戰鬥
- 程序化迷宮 instance、branching route、hazards 與 room flow
- 村莊 → 地下城 → 回村的 expedition loop
- 裝備、掉寶、背包、自動換裝、手動 equip / sell
- 狀態 PNG 輸出
- `status --report` 人類可讀近況摘要
- run-level 敘事弧線、關鍵 story beats 與 state-grounded dungeon report
- 單一角色時可省略 `--id`
- `chat --input "/pet ..."` 聊天指令路由，方便 OpenClaw / bot 使用
- `/pet` 專用的可重現圖文輸出 contract，讓 wrapper 可用 raw data 包裝出短篇奇幻敘事並附圖
- `skills/pet/` 與 workspace `skills/pet/` 都可作為 OpenClaw `/pet` skill 入口
- `openclaw-plugin/` OpenClaw plugin，提供 deterministic `my_pet_hero_pet` tool，讓 `/pet` 可用 `command-dispatch: tool` 直接執行，不經 LLM
- `saves` / `doctor` 管理與 migration 診斷指令

## 安裝

```bash
npm install
npm run build
```

> 這個 repo 採 source-first 管理，`dist/` build artifacts 不再進版控。
> 每次 fresh clone 或 `git pull` 之後，若要執行 `node dist/cli.js ...`、驗證腳本、或 OpenClaw plugin，請先跑一次 `npm run build`。

## 存檔位置

預設會把角色存檔寫到使用者自己的狀態目錄，不會寫回 Git repo：

- Linux / Raspberry Pi: `~/.local/state/my-pet-hero/pets`
- 若設定 `XDG_STATE_HOME`，會改用 `$XDG_STATE_HOME/my-pet-hero/pets`
- 若設定 `MY_PET_HERO_DATA_DIR`，則以該路徑為準

第一次使用新版時，若 repo 舊位置 `data/pets/` 還有本機存檔，系統會自動搬到新的 runtime 存檔目錄，避免把私人進度放進版本控制。

## 基本使用

### 建立角色

```bash
npm run create -- --name Asaki --species elf --class mage
```

### 查看狀態

```bash
npm run dev -- status --id asaki
```

如果目前只有一個角色，也可以直接：

```bash
npm run dev -- status
```

### 查看狀態 + 近期冒險報告

```bash
npm run dev -- status --id asaki --report
```

### 查看背包與目前裝備

```bash
npm run dev -- inventory --id asaki
```

### 手動換裝 / 賣裝

```bash
npm run dev -- equip --id asaki --item gear-123456789
npm run dev -- sell --id asaki --item gear-123456789
```

### 預覽戰鬥

```bash
npm run dev -- combat-preview --id asaki --floor 3
```

### 預覽迷宮推進

```bash
npm run dev -- dungeon-preview --id asaki --repeat 3 --force-ready
```

現在 preview / status 也會帶出：

- `currentDungeon.minimap` ASCII 迷你地圖
- `currentDungeon.modifiers` 目前這層的 modifier
- `logs[].trap` / `logs[].routeChoice` / `logs[].runState.minimap`

### 日常互動

```bash
npm run dev -- feed --id asaki
npm run dev -- play --id asaki
npm run dev -- clean --id asaki
```

### OpenClaw / 聊天指令模式

如果你想讓 OpenClaw 或其他 chat interface 用短指令操作，而不是每次都拼完整 CLI，可改走 `chat` 入口：

```bash
npm run dev -- chat --input "/pet status"
npm run dev -- chat --input "/pet report asaki"
npm run dev -- chat --input "/pet inventory"
npm run dev -- chat --input "/pet heroes"
npm run dev -- chat --input "/pet use asaki"
```

如果你只是要把 `/pet` 註冊成真正的原生 bot command，最簡單的做法是安裝 repo 內的 `openclaw-plugin/`。它會提供 `my_pet_hero_pet` tool，而 repo 內的 `skills/pet/` 與 workspace `skills/pet/` 都能用 `command-dispatch: tool` 把 `/pet` 直接 deterministic 執行，不經 LLM。

```bash
npm run build
openclaw plugins install ./openclaw-plugin
```

重啟 gateway 後，保持 `commands.nativeSkills` 啟用，OpenClaw 就會把 `pet` skill 註冊成 `/pet`，其餘輸入則直接交給 `my_pet_hero_pet` tool，再由它呼叫 `chat --input "/pet ..."`。

現在建議不要再走舊的 skill-only prompt routing。若要從 workspace 暴露 `/pet`，請保留 workspace `skills/pet/`，並確保 `my_pet_hero_pet` tool 已由 plugin 提供。

更完整的整合說明見 `docs/openclaw-chat.md`。

如果你是第一次在另一台 OpenClaw 主機安裝，請直接看 `docs/INSTALL_OPENCLAW.md`，裡面有最短 SOP、config 提示與故障排查順序。

支援的聊天指令：

- `/pet status [heroId]`
- `/pet report [heroId]`
- `/pet inventory [heroId]`
- `/pet feed [heroId]`
- `/pet play [heroId]`
- `/pet clean [heroId]`
- `/pet_image [heroId]`
- `/pet_image status [heroId]`
- `/pet_image card [heroId]`
- `/pet heroes`
- `/pet use HERO_ID`
- `/pet help`

設計重點：

- 聊天指令仍然輸出 JSON，方便 OpenClaw agent 直接取 `message`、`headline`、`report`、`inventoryLines`
- `/pet status` / `/pet report` 也會輸出 `narrationSeed`、`storyBeats`、`riskSummary`、`keyStats`，讓另一個 OpenClaw clone 後也能用同樣規格重現圖文說書體驗
- plugin tool 會在可用時一併回傳狀態圖，避免把圖片流程藏在本機 prompt 細節裡
- `/pet use HERO_ID` 會把預設角色存在 runtime state directory 的 `chat-preferences.json`，不寫進 repo，也不需要硬編本機路徑
- 若已設定預設角色，之後 `status` / `inventory` / `feed` 這些一般 CLI 入口也可直接沿用，不必每次補 `--id`

### 查資料表 / 管理資訊

```bash
npm run dev -- classes
npm run dev -- skills
npm run dev -- enemies
npm run dev -- saves
npm run dev -- doctor --id asaki
```

## 指令列表

- `create --name NAME --species SPECIES [--class CLASS]`
- `status [--id PET_ID] [--report]`
- `inventory [--id PET_ID]`
- `equip [--id PET_ID] --item ITEM_ID`
- `sell [--id PET_ID] --item ITEM_ID`
- `saves`
- `doctor [--id PET_ID]`
- `combat-preview [--id PET_ID] [--floor N]`
- `dungeon-preview [--id PET_ID] [--floor N] [--at ISO] [--repeat N] [--force-ready]`
- `feed [--id PET_ID]`
- `play [--id PET_ID]`
- `clean [--id PET_ID]`
- `chat --input "/pet ..."`
- `classes`
- `skills`
- `enemies`

### Cadence 設定

可參考 repo 內的 `my-pet-hero.config.example.json`，在專案工作目錄放 `my-pet-hero.config.json`：

```json
{
  "cadence": {
    "simulationBucketMinutes": 5,
    "villageActivityBucketMinutes": 5
  }
}
```

也可用環境變數覆蓋：

- `MY_PET_HERO_CONFIG` 指定設定檔路徑
- `MY_PET_HERO_SIM_BUCKET_MINUTES` 覆蓋 query-time simulation bucket
- `MY_PET_HERO_VILLAGE_BUCKET_MINUTES` 覆蓋 village activity bucket

`doctor` 會把目前實際生效的 cadence 印出來，方便確認。

## 目前行為重點

### 1. status 會先模擬經過時間

每次執行 `status`、`inventory`、`equip`、`sell`、互動指令時，都會先載入存檔並推進 query-time simulation，再輸出結果。

`status --report` 會比一般 `status` 多做一段固定的 simulation 推進，然後把更新後的寵物狀態寫回存檔。也就是說，連續呼叫 `status --report` 時，角色的時間、needs、村莊活動與冒險紀錄都會真的往前走，而不是只讀出同一份快照。

簡單區分：

- `status`：讀取目前狀態並輸出
- `status --report`：讀取、推進、寫回，再輸出更完整的 report

### 2. 探險不是背景常駐，而是查詢時觸發推進

系統會依 needs、個性與時間 bucket 決定是否自動出發探險。角色位置會在 `village` 與 `dungeon` 之間切換。

現在 query-time bucket 已做成可設定 cadence，預設是 `5` 分鐘一格，讓推進節奏比早期的 2 小時 / 1 小時版本快很多。預設會同步套用到「自動照護 / 事件 / 探險判定」與 village activity；如果想拆開，也可以分別設定。

當角色沒有出門時，也不會只是空白待機。村莊會記錄目前 / 最近做過的 village activity，像是旅店補眠、整理裝備、跑腿、或職業風格行程。這些活動會對 needs 與「出發準備度」產生溫和但有感的影響。

### 3. 有完整 expedition 狀態

每趟 expedition 現在不只記錄進度，也會有一條 deterministic 任務主線。
系統會在開局指定明確目標與動機，例如尋人、取回物件、調查異常、或與 rival 競速，並把這條 mission spine 存進 `currentExpedition.goal`。
同一趟 run 裡，前段房間還會埋下 callback 狀態，後段在符合條件時回收，讓「先看到線索，後面再對上答案」變成 state-driven 流程，而不是單靠文案包裝。

`status` payload 目前會包含：

- `location`
- `village`
- `currentDungeon`
- `currentExpedition`
- `expeditionHistory`
- `expeditionNarrative`
- `equipmentSummary`
- `report`（加 `--report` 時）
- `readiness`
- `village.currentActivity` / `village.recentActivities`

### 4. 掉寶與裝備有實際效果

- 掉寶來源包含一般房、elite、boss、treasure
- 裝備分成 `weapon` / `armor` / `accessory`
- 掉落後會先進背包
- 如果新裝備分數更高，會自動換裝
- 手動 `equip` 可覆蓋自動裝備結果
- `sell` 會把裝備自背包移除並換成 gold
- 裝備加成會直接影響戰鬥屬性

### 5. report 現在比較像對玩家說話

`status --report` 會整理：

- 角色近況 headline
- 目前狀態重點（例如疲勞、飢渴、低血量）
- 村裡現在在做什麼 / 最近村莊行程
- 目前裝備摘要
- 正在進行中的探險，或上一趟探險結算
- 最近幾筆 adventure log
- 房型、收益、戰鬥摘要、技能使用

另外 `headline` / `quickStatus` 也會直接放進 `status` JSON，方便 bot 或自然語言介面直接取用。

現在 `status` / `report` 也會多帶：

- `expeditionNarrative` 當前或上一趟探險的敘事狀態
- `currentExpedition.goal` / `expeditionHistory[].goal` 任務主線與 callback 狀態
- `narrativeDigest` 已整理好的故事線摘要
- `adventureLog[].narrative` 每個房間對應的 story beat

## 驗證狀態

目前已確認：

- `npm run build` 可通過
- `create` / `status` / `inventory` / `combat-preview` / `dungeon-preview` / `equip` / `sell` / `chat` CLI 入口存在
- `npm run validate:chat` 可驗證 `/pet status`、`/pet report`、`/pet inventory`、`/pet use`、`/pet heroes`、`/pet feed`
- `npm run validate:openclaw` 可用 mock OpenClaw plugin registration 驗證 `my_pet_hero_pet` 工具會走到 `chat --input "/pet ..."`，並回傳敘事文字與圖片
- 新版存檔可正確輸出 expedition / equipment 相關欄位
- cadence 設定可由 `my-pet-hero.config.json` 或環境變數控制，`doctor` 可看到生效值

## 資料與輸出位置

- 角色存檔：使用者狀態目錄（預設 `~/.local/state/my-pet-hero/pets`）
- 狀態圖輸出：使用者狀態目錄（預設 `~/.local/state/my-pet-hero/renders`）

## 目前限制

- v2~v10 舊存檔會在載入時自動 migration 到 v11，並先備份原始 JSON
- `doctor` 目前提供的是 migration 策略與存檔概況，不是完整 repair tool
- `dungeon-preview` 是預覽工具，不一定每次都會觸發探險
- bitmap minimap / status card integration 還沒做，刻意先不硬塞進這輪
- secret / rare rooms 還沒做
- callback system 目前先支援單條 deterministic callback chain，還沒做多條並行伏筆
- 還沒有 status effects、進階職業、技能成長、商店互動

## 文件

- 技術架構：`docs/architecture.md`
- OpenClaw / chat routing：`docs/openclaw-chat.md`
- `/pet` 圖文輸出 contract：`docs/chat-output-contract.md`
- `/pet` 說書風格規格：`docs/narration-style.md`
- 遊戲設計：`docs/game-design.md`
- milestone 狀態：`plan.md`
