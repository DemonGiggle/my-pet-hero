# My Pet Hero Architecture

## Philosophy

My Pet Hero 不是 Tamagotchi 式常駐 loop，而是 **query-time simulation**：

1. 載入上次儲存狀態
2. 算出距離上次模擬經過多久
3. 根據種族配置做 needs decay
4. 用固定 seed + 時間 bucket 生成可重現事件
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
- recent history

## Why this is lightweight

- 沒有 scheduler / daemon 必要性
- 沒有 background game loop
- state 為單一 JSON
- render 只在需要時發生

## Species-first design

種族不是單純貼標籤，而是驅動：
- 初始值
- 衰減曲線
- 事件傾向
- 視覺配色
- 精靈 / 矮人 / 人類 / 獸人 / 龍族 的差異化表現

## Product direction

My Pet Hero / 我的寵物勇者 的方向不是單純寵物機，而是「可被關心、培養、慢慢成長的勇者型陪伴角色」。

適合逐步加入：
- 冒險 / 任務
- 裝備與職業傾向
- 種族專屬事件池
- 對話式互動
- 聊天平台整合

## Suggested next modules

- `event-pools/`：按種族與情境拆事件
- `sprites/`：外型 layer 化
- `conversation/`：把自然語言查詢映射到 status / action
- `integrations/openclaw/`：回圖給聊天介面
