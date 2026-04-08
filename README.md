# My Pet Hero / 我的寵物勇者

一個 query-time 的寵物勇者模擬器。

它不是背景常駐的電子雞，而是只有在你查詢或互動時，才根據經過時間推進生活、村莊整補、迷宮探索、戰鬥、掉寶與成長。

## 目前已完成的核心內容

- 不需要背景 daemon
- 以單一 JSON 保存角色狀態
- 種族、職業、屬性、技能、戰鬥
- 程序化迷宮 instance 與 room flow
- 村莊 → 地下城 → 回村的 expedition loop
- 裝備、掉寶、背包、自動換裝、手動 equip / sell
- 狀態 PNG 輸出
- `status --report` 冒險摘要

## 安裝

```bash
npm install
npm run build
```

## 基本使用

### 建立角色

```bash
npm run create -- --name Asaki --species elf --class mage
```

### 查看狀態

```bash
npm run dev -- status --id asaki
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

### 日常互動

```bash
npm run dev -- feed --id asaki
npm run dev -- play --id asaki
npm run dev -- clean --id asaki
```

### 查資料表

```bash
npm run dev -- classes
npm run dev -- skills
npm run dev -- enemies
```

## 指令列表

- `create --name NAME --species SPECIES [--class CLASS]`
- `status --id PET_ID [--report]`
- `inventory --id PET_ID`
- `equip --id PET_ID --item ITEM_ID`
- `sell --id PET_ID --item ITEM_ID`
- `combat-preview --id PET_ID [--floor N]`
- `dungeon-preview --id PET_ID [--floor N] [--at ISO] [--repeat N] [--force-ready]`
- `feed --id PET_ID`
- `play --id PET_ID`
- `clean --id PET_ID`
- `classes`
- `skills`
- `enemies`

## 目前行為重點

### 1. status 會先模擬經過時間

每次執行 `status`、`inventory`、`equip`、`sell`、互動指令時，都會先載入存檔並推進 query-time simulation，再輸出結果。

### 2. 探險不是背景常駐，而是查詢時觸發推進

系統會依 needs、個性與時間 bucket 決定是否自動出發探險。角色位置會在 `village` 與 `dungeon` 之間切換。

### 3. 有完整 expedition 狀態

`status` payload 目前會包含：

- `location`
- `village`
- `currentDungeon`
- `currentExpedition`
- `expeditionHistory`
- `equipmentSummary`
- `report`（加 `--report` 時）

### 4. 掉寶與裝備有實際效果

- 掉寶來源包含一般房、elite、boss、treasure
- 裝備分成 `weapon` / `armor` / `accessory`
- 掉落後會先進背包
- 如果新裝備分數更高，會自動換裝
- 手動 `equip` 可覆蓋自動裝備結果
- `sell` 會把裝備自背包移除並換成 gold
- 裝備加成會直接影響戰鬥屬性

### 5. report 目前偏向 debug-friendly

`status --report` 會整理：

- 角色等級、職業、情緒與所在位置
- 目前裝備摘要
- 目前進行中的探險，或上一趟探險結算
- 最近幾筆 adventure log
- 房型、收益、戰鬥摘要、技能使用

## 驗證狀態

目前已確認：

- `npm run build` 可通過
- `create` / `status` / `inventory` / `combat-preview` / `dungeon-preview` / `equip` / `sell` CLI 入口存在
- 新版存檔可正確輸出 expedition / equipment 相關欄位

## 存檔與輸出位置

- 角色資料：`data/pets/*.json`
- 預設角色範本：`data/default-hero.json`
- 狀態圖輸出：OpenClaw media 目錄下的 `my-pet-hero/*.png`

## 目前限制

- 舊版存檔沒有 migration；缺少新版欄位時會載入失敗
- `dungeon-preview` 是預覽工具，不一定每次都會觸發探險
- room graph 目前已帶有少量 branching 資訊，但實際推進仍是線性前進到下一房
- 還沒有 status effects、進階職業、技能成長、陷阱、商店互動

## 文件

- 技術架構：`docs/architecture.md`
- 遊戲設計：`docs/game-design.md`
- milestone 狀態：`plan.md`
