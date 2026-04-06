# My Pet Hero / 我的寵物勇者

這不再只是普通電子寵物，而是會自己生活、自己找資源、自己闖迷宮成長的 **寵物勇者模擬器**。

## 核心方向

- **不需要背景常駐**
- 只保存上次狀態與少量歷史
- 每次查詢時才根據經過時間推演生活、冒險、戰鬥與技能觸發
- 飢餓或口渴時，角色會自己去找食物或水
- 角色會視狀態、個性與職業，自主去隨機生成的迷宮闖蕩
- 有 **等級、經驗值、金幣、屬性、職業、迷宮進度、戰鬥紀錄、技能**
- 產生一張像素風勇者狀態卡 PNG

## 目前支援種族

- 精靈 `elf`
- 矮人 `dwarf`
- 人類 `human`
- 獸人 `orc`
- 龍族 `dragon`

## 目前支援職業與技能

### 狂戰士 `berserker`
- **粉碎重擊**：高倍率物理輸出
- **鋼鐵姿態**：獲得護盾，扛線更穩

### 盜賊 `rogue`
- **影襲**：高命中、高爆擊的快攻
- **閃步**：獲得護盾，增加生存空間

### 法師 `mage`
- **奧術爆裂**：高倍率魔法爆發
- **祕術饗宴**：回復生命

## 新增：技能系統

現在三個職業都不只是平A：

- 技能採 **資料驅動定義**
- 支援：
  - 傷害技能
  - 補血技能
  - 護盾技能
- 技能有：
  - target
  - effect kind
  - damage type
  - 倍率
  - hit / crit bonus
  - cooldown turns
- 戰鬥中會依情境自動判斷是否施放

## 現有戰鬥系統

- 敵人池依樓層挑選
- 有物理 / 魔法傷害型別
- 有命中、閃避、暴擊、攻防與魔防
- 技能可直接影響輸出 / 生存
- 戰鬥結果會影響：
  - 健康
  - 心情
  - 經驗值
  - 金幣
  - 冒險紀錄
- 戰鬥紀錄會保存在 adventure log 中

目前內建敵人：
- 史萊姆
- 哥布林斥候
- 骷髏守衛
- 虛空學徒
- 洞窟幼龍

## 設計原則：可擴充職業架構

職業與技能都不是寫死在 if/else 裡，而是獨立資料定義，未來可以繼續擴充：
- 新職業配置
- 種族相容加成
- 武器標籤
- 能力標籤
- 技能表
- 推薦職業 / 天賦傾向
- 後續戰鬥與裝備系統掛接

## 指令

```bash
npm run create -- --name Mochi --species dragon --class mage
npm run render -- --id mochi
npm run dev -- classes
npm run dev -- skills
npm run dev -- enemies
npm run dev -- combat-preview --id mochi --floor 2
npm run dev -- feed --id mochi
npm run dev -- play --id mochi
npm run dev -- clean --id mochi
```

## 資料位置

- 狀態：`data/pets/*.json`
- 輸出圖：`renders/*.png`

## 下一步很適合做

- 狀態效果（暈眩 / 緩速 / 中毒 / 燃燒）
- 真正的隨機迷宮 floor / room 生成
- 裝備系統（武器 / 防具 / 飾品）
- 掉寶與消耗品
- 城鎮補給 / 休息 / 商店
- 聊天介面直接操控
- OpenClaw / Telegram 圖文整合
