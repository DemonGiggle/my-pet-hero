# My Pet Hero Architecture

這份文件講的是程式架構，不是遊戲企劃。

## Core philosophy

My Pet Hero 採用 query-time simulation：

1. 載入上次儲存狀態
2. 計算距離上次模擬經過多久
3. 根據種族 decay、needs、個性與事件規則推進角色狀態
4. 以 2 小時 bucket 觸發 self-care、生活事件與自動探險判定
5. 視情況建立 / 推進迷宮 instance、戰鬥、掉寶、回村整補
6. 寫回 state
7. 需要時輸出 PNG 狀態圖與 JSON / report

## Why this architecture

- 不需要背景 daemon
- 不需要常駐 game loop
- 狀態易保存、易搬移、易除錯
- 適合 CLI / bot / chat integration
- 很適合接 OpenClaw 這種查詢式互動

## Main modules

### `src/cli.ts`
- CLI 入口
- 對外暴露 create / status / inventory / equip / sell / preview / action 等指令
- `status --report` 會整理 expedition 與 recent adventure log

### `src/state.ts`
- 載入 / 驗證 / 儲存 pet state
- 建立新角色
- 定義 zod schema
- 目前 schema version 為 7
- 目前沒有舊版存檔 migration，欄位不完整的舊檔會直接驗證失敗

### `src/simulate.ts`
- 推進經過時間
- 更新 needs
- 將經過時間切成 2 小時 buckets
- 每個 bucket 依序觸發 self-care、autoDungeonRun、生活事件
- 組合 summary / mood / stage

### `src/systems.ts`
- 核心系統邏輯
- 自動補給與自我照護
- 經驗與自動能力成長
- 村莊整補
- 迷宮 expedition 建立與推進
- room outcome、reward、return flow

### `src/dungeons.ts`
- 迷宮模板資料
- procedural dungeon instance 生成
- room type、room label、enemy pool 決定
- `currentRoomId` / `discoveredRoomIds` / `clearedRoomIds`
- 目前保留 exits 與少量 branching metadata

### `src/combat.ts`
- 敵人資料
- 戰鬥快照
- 命中 / 閃避 / 暴擊 / 護盾 / 技能解析
- 戰鬥結果輸出

### `src/gear.ts`
- 掉寶生成
- 稀有度與裝備分數
- 裝備加成計算
- 背包排序與顯示
- 自動換裝 / 手動 equip / sell

### `src/render.ts`
- 產生像素風狀態圖 PNG
- 圖上顯示角色名稱、等級、needs、attributes、deepest floor、summary
- 輸出到使用者狀態目錄下的 `my-pet-hero/renders`

## Persisted state

主要資料存在：

- 使用者狀態目錄下的 `my-pet-hero/pets/*.json`
  - 預設為 `~/.local/state/my-pet-hero/pets`
  - 若有 `XDG_STATE_HOME`，則改用 `$XDG_STATE_HOME/my-pet-hero/pets`
  - 若有 `MY_PET_HERO_DATA_DIR`，則以該路徑為準

另外 `src/state.ts` 會在首次讀寫時檢查 repo 內舊路徑 `data/pets/`，若發現 legacy 本機存檔，會複製到新的 runtime 存檔目錄，避免之後再把玩家資料放進 Git。

State 內容目前包含：

- identity / species / timestamps
- needs / personality
- hero progression（level / exp / attributes / gold）
- `hero.classProgress`
- `hero.equipment`（equipped / inventory / lastEquippedAt）
- `hero.dungeon`（location / currentDungeon / currentExpedition / expeditionHistory / village）
- `hero.adventureLog`
- `history`

## Expedition architecture

目前探險流程已經不是只有 floor 數字，而是完整的 run state：

1. 在村莊，若狀態過低可先自動整補
2. 通過探險判定後，建立 `currentDungeon` 與 `currentExpedition`
3. 依當前 room type 結算 battle / elite / boss / treasure / event / rest
4. 更新 rewards、needs、gold、exp、loot、runState
5. 房間推進後，視結果決定：
   - 繼續探索
   - boss 後 portal 回村
   - defeat 回村
   - escape 回村
6. 完成的 expedition 會被搬到 `expeditionHistory`

## Equipment and loot architecture

### Slots
- `weapon`
- `armor`
- `accessory`

### Loot behavior
- 掉落機率依 room type 而變
- boss / elite / treasure 掉寶率較高
- 掉落物會綁定目前職業風格
- 掉落後先進 `inventory`
- 若同槽新裝備 `gearScore` 更高，會自動換裝
- inventory 目前保留最後 40 件裝備

### Sell / equip behavior
- `equip --item ITEM_ID` 會把背包中的指定物品裝上去
- `sell --item ITEM_ID` 會移除背包物品並換成 gold
- 如果賣掉的是已裝備物品，該裝備槽會被清空

## Output modes

CLI 目前主要輸出是 JSON payload，視需要附帶 PNG 路徑。

### `status`
包含：
- location / village / currentExpedition / expeditionHistory
- currentDungeon / currentRoom
- level / exp / gold / attributes / needs
- equipment / equipmentSummary
- recent events / adventures
- `--report` 時額外附加文字摘要

### `inventory`
包含：
- gold
- equipped summary
- raw inventory
- `inventoryLines` 文字版列表

### `combat-preview`
包含：
- enemy
- outcome
- rounds
- exp / gold
- skillsUsed
- turns

### `dungeon-preview`
包含：
- before / after state
- generated logs
- currentDungeon
- currentExpedition
- expeditionHistory

## Validation status

目前已驗證：

- `npm run build` 可通過
- 新建角色可正常 `status`
- `inventory` / `combat-preview` / `dungeon-preview` CLI 存在且可輸出當前 schema 資料

另外要注意：非常舊、缺少新版欄位的存檔，因為尚未做 schema migration，仍可能會在 `loadPet` 驗證時失敗。

## Next technical directions

- 存檔 migration
- map UX / minimap
- status effects system
- enemy abilities 深化
- skill unlock progression
- 更自然語言化的 report 格式
