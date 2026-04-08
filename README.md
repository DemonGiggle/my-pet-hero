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
- 單一角色時可省略 `--id`
- `saves` / `doctor` 管理與 migration 診斷指令

## 安裝

```bash
npm install
npm run build
```

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
- `classes`
- `skills`
- `enemies`

## 目前行為重點

### 1. status 會先模擬經過時間

每次執行 `status`、`inventory`、`equip`、`sell`、互動指令時，都會先載入存檔並推進 query-time simulation，再輸出結果。

### 2. 探險不是背景常駐，而是查詢時觸發推進

系統會依 needs、個性與時間 bucket 決定是否自動出發探險。角色位置會在 `village` 與 `dungeon` 之間切換。

當角色沒有出門時，也不會只是空白待機。村莊會記錄目前 / 最近做過的 village activity，像是旅店補眠、整理裝備、跑腿、或職業風格行程。這些活動會對 needs 與「出發準備度」產生溫和但有感的影響。

### 3. 有完整 expedition 狀態

`status` payload 目前會包含：

- `location`
- `village`
- `currentDungeon`
- `currentExpedition`
- `expeditionHistory`
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

## 驗證狀態

目前已確認：

- `npm run build` 可通過
- `create` / `status` / `inventory` / `combat-preview` / `dungeon-preview` / `equip` / `sell` CLI 入口存在
- 新版存檔可正確輸出 expedition / equipment 相關欄位

## 資料與輸出位置

- 角色存檔：使用者狀態目錄（預設 `~/.local/state/my-pet-hero/pets`）
- 狀態圖輸出：使用者狀態目錄（預設 `~/.local/state/my-pet-hero/renders`）

## 目前限制

- v2~v6 舊存檔會在載入時自動 migration 到 v7，並先備份原始 JSON
- `doctor` 目前提供的是 migration 策略與存檔概況，不是完整 repair tool
- `dungeon-preview` 是預覽工具，不一定每次都會觸發探險
- bitmap minimap / status card integration 還沒做，刻意先不硬塞進這輪
- secret / rare rooms 還沒做
- 還沒有 status effects、進階職業、技能成長、商店互動

## 文件

- 技術架構：`docs/architecture.md`
- 遊戲設計：`docs/game-design.md`
- milestone 狀態：`plan.md`
