# My Pet Hero / 我的寵物勇者

一個 **query-time** 的寵物勇者模擬器。

它不是背景常駐的電子雞，而是只有在你查詢或互動時，才根據經過時間推進生活、冒險、戰鬥與成長。

## 特色

- 不需要背景 daemon
- 以單一 JSON 保存寵物狀態
- 支援種族、職業、屬性、迷宮、戰鬥、技能
- 可輸出像素風狀態圖
- 可額外輸出近期冒險報告

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

### 預覽戰鬥

```bash
npm run dev -- combat-preview --id asaki --floor 3
```

### 裝備與背包

```bash
npm run dev -- inventory --id asaki
npm run dev -- equip --id asaki --item gear-123456789
npm run dev -- sell --id asaki --item gear-123456789
```

### 互動指令

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
- `feed --id PET_ID`
- `play --id PET_ID`
- `clean --id PET_ID`
- `classes`
- `skills`
- `enemies`

## 資料位置

- 角色資料：`data/pets/*.json`
- 預設角色：`data/default-hero.json`
- 狀態圖：`renders/*.png`

## 文件

- 技術架構：`docs/architecture.md`
- 遊戲企劃 / 世界觀 / 屬性與職業說明：`docs/game-design.md`
