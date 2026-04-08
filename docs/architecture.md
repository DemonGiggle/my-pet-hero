# My Pet Hero Architecture

這份文件講的是程式架構，不是遊戲企劃。

## Core philosophy

My Pet Hero 採用 query-time simulation：

1. 載入上次儲存狀態
2. 計算距離上次模擬經過多久
3. 根據種族 decay、needs、個性與事件規則推進角色狀態
4. 以可設定的時間 bucket 觸發 self-care、生活事件與自動探險判定（目前預設 5 分鐘）
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
- 對外暴露 create / status / inventory / equip / sell / preview / action / saves / doctor 等指令
- 單一存檔時可自動把它當 default hero，減少每次都要帶 `--id`
- `status --report` 會整理 expedition 與 recent adventure log，並輸出 `headline` / `quickStatus`

### `src/state.ts`
- 載入 / 驗證 / 儲存 pet state
- 建立新角色
- 定義 zod schema
- 目前 schema version 為 7
- `loadPet` 會自動將 v2~v6 存檔升級到 v7，成功後覆寫現檔並把原始 JSON 備份到 `backups/`

### `src/simulate.ts`
- 推進經過時間
- 更新 needs
- 將經過時間切成可設定的 simulation buckets（預設 5 分鐘）
- 每個 bucket 依序觸發 self-care、autoDungeonRun、生活事件
- 組合 summary / mood / stage

### `src/config.ts`
- 讀取 runtime 設定
- 預設 cadence 為 `simulationBucketMinutes=5`、`villageActivityBucketMinutes=5`
- 支援 `my-pet-hero.config.json`
- 支援 env override（`MY_PET_HERO_CONFIG`、`MY_PET_HERO_SIM_BUCKET_MINUTES`、`MY_PET_HERO_VILLAGE_BUCKET_MINUTES`）

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
- `currentRoomId` / `discoveredRoomIds` / `clearedRoomIds` / `pathTakenRoomIds`
- branching route 選路、trap metadata、modifier 與 ASCII minimap

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
- summary 現在由 CLI 先整理成較短的人類可讀摘要，再交給 renderer 壓成 ASCII-safe 文案
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
- village.currentActivity / village.recentActivities / readiness
- currentDungeon / currentRoom
- level / exp / gold / attributes / needs
- equipment / equipmentSummary
- `headline` / `quickStatus`
- recent events / adventures
- `--report` 時額外附加文字摘要（含村莊活動敘述）

### `saves`
包含：
- data dir
- 存檔數量
- 若只有一個角色時的 defaultHeroId
- 每個存檔的 id / 名稱 / species / version / updatedAt

### `doctor`
包含：
- 目前 schema version
- migration policy 摘要
- data dir 與存檔數量
- 指定角色時，額外列出該存檔基本健康資訊

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
- `doctor` 可輸出實際生效的 cadence config，方便驗證 runtime bucket 設定

另外要注意：目前 migration 支援 v2~v7。比 v2 更舊，或未來比 v8 更新的存檔，會明確拒絕載入。

## Save migration policy

- 目前支援從 v2、v3、v4、v5、v6 自動升級到 v7
- migration 在 `loadPet` 發生，先做 step-by-step upgrade，再用現行 zod schema 驗證
- 若有升級，會先把原始 JSON 備份到同資料夾下的 `backups/`，再覆寫主存檔
- v6 因為歷史上有多次 schema 擴充但版本號沒同步增加，所以 `6 -> 7` 會補齊 expedition、village、equipment 與戰鬥缺省欄位
- 小於 v2 或高於目前版本的存檔會直接拒絕載入，避免猜錯資料語意

## Next technical directions

- bitmap map/status-card integration
- status effects system
- enemy abilities 深化
- skill unlock progression
- 更自然語言化的 report 格式
