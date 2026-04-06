# My Pet Hero / 我的寵物勇者

這不再只是普通電子寵物，而是會自己生活、自己找資源、自己闖迷宮成長的 **寵物勇者模擬器**。

## 核心方向

- **不需要背景常駐**
- 只保存上次狀態與少量歷史
- 每次查詢時才根據經過時間推演生活與冒險
- 飢餓或口渴時，角色會自己去找食物或水
- 角色會視狀態與個性，自主去隨機生成的迷宮闖蕩
- 有 **等級、經驗值、金幣、屬性、迷宮進度**
- 產生一張像素風勇者狀態卡 PNG

## 目前支援種族

- 精靈 `elf`
- 矮人 `dwarf`
- 人類 `human`
- 獸人 `orc`
- 龍族 `dragon`

## 目前已有系統

- Query-time simulation
- 種族配置系統
- needs 狀態（健康 / 飢餓 / 口渴 / 心情 / 體力 / 整潔）
- hero progression（等級 / 經驗 / 金幣 / 屬性）
- 自動 self-care（自己找食物 / 找水）
- 自動 dungeon run（隨機迷宮探索）
- feed / play / clean 基本互動
- PNG 狀態卡輸出

## 指令

```bash
npm run create -- --name Mochi --species dragon
npm run render -- --id mochi
npm run dev -- feed --id mochi
npm run dev -- play --id mochi
npm run dev -- clean --id mochi
```

## 資料位置

- 狀態：`data/pets/*.json`
- 輸出圖：`renders/*.png`

## 下一步很適合做

- 真正的隨機迷宮 floor 生成
- 戰鬥細節 / 敵人池 / 掉寶
- 職業 / 裝備 / 技能
- 城鎮補給 / 休息 / 商店
- 聊天介面直接操控
- OpenClaw / Telegram 圖文整合
