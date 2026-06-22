# auto_GAO 技術端說明文件

> 最後更新：2026-06-22

---

## 目錄

1. [專案概述](#專案概述)
2. [技術棧](#技術棧)
3. [目錄結構](#目錄結構)
4. [核心模組說明](#核心模組說明)
   - [accountStore.ts](#accountstorets)
   - [autoBattleChecker.js](#autobattlecheckerjs)
   - [user.js（API 層）](#userjs-api-層)
5. [元件說明](#元件說明)
   - [App.vue](#appvue)
   - [AutoBattle.vue](#autobattlevue)
   - [AutoForge.vue](#autoforgevue)
   - [AutoMine.vue](#autominavue)
   - [AutoRecycle.vue](#autorecyclevue)
   - [AddToken.vue](#addtokenvue)
   - [ProfileView.vue](#profileviewvue)
   - [WeaponSelect.vue](#weaponselectvue)
6. [localStorage 資料結構](#localstorage-資料結構)
7. [自動化設定結構](#自動化設定結構)
8. [自動化生命週期](#自動化生命週期)
9. [補品過濾邏輯](#補品過濾邏輯)
10. [設定遷移機制](#設定遷移機制)

---

## 專案概述

auto_GAO 是一套針對特定遊戲開發的自動化輔助工具，以瀏覽器前端形式運作。使用者透過 Token 登入帳號後，可設定自動戰鬥、自動鍛造、自動採礦、自動回收等功能，系統將依據設定進行輪詢並自動執行對應的遊戲 API 呼叫。

**核心特性：**
- 多帳號管理（同時管理多組 Token）
- 各帳號獨立的自動化設定
- 支援帳號設定備份與還原（JSON 匯出匯入）
- 設定版本遷移（向前相容舊版設定欄位）

---

## 技術棧

| 類別 | 技術 |
|------|------|
| 前端框架 | Vue 3 + TypeScript |
| UI 元件庫 | Element Plus |
| HTTP 客戶端 | Axios |
| 時間處理 | Moment.js |
| 全局狀態管理 | Pinia (`accountStore`) |
| 建構工具 | Vue CLI / Webpack |

---

## 目錄結構

```
auto_GAO/
├── src/
│   ├── api/
│   │   └── user.js               # 所有 API 呼叫封裝（token-based）
│   ├── common/
│   │   ├── autoBattleChecker.js  # 自動戰鬥主邏輯
│   │   └── sleep.js              # 延遲工具（Promise-based sleep）
│   ├── components/
│   │   ├── AutoBattle.vue        # 自動戰鬥設定 UI
│   │   ├── AutoForge.vue         # 自動鍛造 UI
│   │   ├── AutoMine.vue          # 自動採礦 UI
│   │   ├── AutoRecycle.vue       # 自動回收 UI
│   │   ├── AddToken.vue          # 帳號 Token 管理
│   │   ├── ProfileView.vue       # 角色資訊顯示
│   │   └── WeaponSelect.vue      # 裝備選擇
│   ├── store/
│   │   └── accountStore.ts       # Pinia 全局狀態管理
│   └── App.vue                   # 主容器（側邊欄、帳號切換、備份還原）
├── docs/
│   └── PROJECT_DOC.md            # 本文件
├── public/
│   └── index.html
├── package.json
└── vue.config.js
```

---

## 核心模組說明

### accountStore.ts

**路徑：** `src/store/accountStore.ts`

全局 Pinia Store，為整個應用程式的狀態中樞。

#### 負責範疇

| 責任 | 說明 |
|------|------|
| 帳號清單管理 | 從 `localStorage.strList` 載入 / 儲存所有 Token |
| 帳號資料快取 | 每個帳號的 `profile`、`items`、裝備清單等遊戲資料 |
| 自動化設定 | 讀寫 `setting_${token}` 的所有自動化設定欄位 |
| 自動化生命週期 | 啟動、暫停、停止各帳號的輪詢循環 |
| 設定遷移 | 載入舊版設定時自動映射至新欄位 |

#### localStorage 存取

- **讀取帳號清單：** `JSON.parse(localStorage.getItem('strList') || '[]')`
- **讀取個別設定：** `JSON.parse(localStorage.getItem(`setting_${token}`) || '{}')`
- **寫入設定：** 每次設定變更後序列化回 localStorage

#### 自動化生命週期流程

```
啟動自動化
    │
    ▼
設定 enabled = true
    │
    ▼
進入輪詢迴圈（while enabled）
    │
    ├─► 呼叫 autoBattleChecker（戰鬥模組）
    │
    ├─► 呼叫 AutoMine 輪詢（採礦模組）
    │
    ├─► 呼叫 AutoRecycle 輪詢（回收模組）
    │
    ▼
sleep(interval) → 回到頂端
    │
暫停 / 停止
    │
    ▼
設定 enabled = false，中止迴圈
```

---

### autoBattleChecker.js

**路徑：** `src/common/autoBattleChecker.js`

每一輪戰鬥循環的主邏輯，由 `accountStore` 的輪詢迴圈呼叫。

#### 執行流程（依序）

```
1. 檢查 HP/SP 狀態
        │
        ▼
2. 判斷是否需要補品
   ├─ HP 不足 → 使用 medicineHpId 補品（× medicineHpQuantity）
   └─ SP 不足 → 使用 medicineSpId 補品（× medicineSpQuantity）
        │
        ▼
3. 確認目前所在地圖
   ├─ 正確地圖 → 繼續
   └─ 不在目標地圖 → 執行傳送（可選：使用傳送水晶）
        │
        ▼
4. 秘徑判斷（/path API）
   ├─ 有秘徑入口 → 進入秘徑
   └─ 無秘徑 → 跳過
        │
        ▼
5. 裝備確認
   ├─ 有選定裝備 → 確認已裝備
   └─ allowEmptyHanded = true → 允許空手出戰
        │
        ▼
6. 執行戰鬥
   ├─ 一般戰鬥（zone id）
   └─ bossSoloMode 判斷：
      ├─ none → 不進行 Boss 挑戰
      ├─ pass → 路過 Boss（不打）
      └─ wait → 等待 Boss 重新整備後再挑戰
```

#### 地圖類型

| 類型 | API 方式 |
|------|----------|
| 一般地圖 | 以 `zone id` 參數呼叫戰鬥 API |
| 秘徑 | 呼叫 `/path` API 進入特殊路線 |

---

### user.js（API 層）

**路徑：** `src/api/user.js`

封裝所有遊戲伺服器的 HTTP 呼叫，統一使用 **Token-based 認證**（每次請求帶入帳號 Token 作為識別）。

**設計原則：**
- 每個 API 函式接收 `token` 作為第一個參數
- 使用 Axios 發送請求，統一處理錯誤
- 回傳 Promise，由呼叫端 `await`

---

### sleep.js

**路徑：** `src/common/sleep.js`

簡易的 Promise-based 延遲工具，供各自動化模組在輪詢間隔使用。

```js
// 使用範例
await sleep(3000); // 等待 3 秒
```

---

## 元件說明

### App.vue

**路徑：** `src/App.vue`

應用程式主容器，負責：

- **側邊欄**：帳號清單切換（以 Token 區分），支援收合（狀態存於 `localStorage.sidebar_collapsed`）
- **帳號切換**：點選側邊欄帳號後切換 `accountStore` 的 currentToken
- **備份與還原**：將所有帳號設定序列化為 JSON 匯出，或從 JSON 匯入還原

---

### AutoBattle.vue

**路徑：** `src/components/AutoBattle.vue`

自動戰鬥設定介面，與 `accountStore` 雙向同步。

#### 設定同步機制

使用 `watch` 監聽表單欄位，欄位變更時即時寫回 `accountStore`；切換帳號時從 store 重新載入設定。

#### bossSoloMode（Boss 模式）

三選一互斥設定：

| 值 | 行為 |
|----|------|
| `none` | 不特別處理 Boss，正常戰鬥 |
| `pass` | 遇到 Boss 時略過，不進行挑戰 |
| `wait` | 遇到 Boss 時等待其重置後再挑戰 |

---

### AutoForge.vue

**路徑：** `src/components/AutoForge.vue`

自動鍛造介面。

**特色功能：**
- **收藏組合**：常用的鍛造素材組合可儲存為收藏，key 為 `forge_favorites_${token}`，每個帳號獨立存放
- **可用數量計算**：根據背包中的素材自動計算最多可鍛造次數

---

### AutoMine.vue

**路徑：** `src/components/AutoMine.vue`

自動採礦介面，提供採礦目標設定及輪詢狀態顯示。

---

### AutoRecycle.vue

**路徑：** `src/components/AutoRecycle.vue`

自動回收介面，設定欲回收的物品條件，由輪詢迴圈定期執行。

---

### AddToken.vue

**路徑：** `src/components/AddToken.vue`

帳號 Token 管理介面：
- 新增 Token（驗證後寫入 `localStorage.strList`）
- 刪除帳號
- 顯示所有已登記 Token

---

### ProfileView.vue

**路徑：** `src/components/ProfileView.vue`

顯示當前選定帳號的角色資訊（名稱、等級、HP/SP、金幣等），資料來源為 `accountStore` 快取的 `profile`。

---

### WeaponSelect.vue

**路徑：** `src/components/WeaponSelect.vue`

裝備選擇介面，讓使用者為自動戰鬥指定要裝備的武器或裝備，選取結果存至對應帳號的設定中。

---

## localStorage 資料結構

| Key | 型別 | 說明 |
|-----|------|------|
| `strList` | JSON Array | 所有帳號的 Token 字串清單 |
| `setting_${token}` | JSON Object | 個別帳號的完整自動化設定 |
| `forge_favorites_${token}` | JSON Array | 個別帳號的鍛造收藏組合 |
| `sidebar_collapsed` | String (`"true"` / `"false"`) | 側邊欄收合狀態 |

### strList 範例

```json
["TOKEN_A_XXXXXXXX", "TOKEN_B_YYYYYYYY"]
```

### setting_${token} 結構範例

```json
{
  "battle": {
    "enabled": false,
    "setting": {
      "targetMapId": 101,
      "hpRecoveryMode": "medicine",
      "spRecoveryMode": "rest",
      "bossSoloMode": "none",
      "allowEmptyHanded": false,
      "useTeleportCrystal": true,
      "medicineHpId": 5001,
      "medicineSpId": 5002,
      "medicineHpQuantity": 1,
      "medicineSpQuantity": 1
    }
  },
  "forge": {},
  "mine": {},
  "recycle": {}
}
```

### forge_favorites_${token} 範例

```json
[
  { "name": "組合A", "materials": [{ "itemId": 101, "qty": 3 }, { "itemId": 202, "qty": 1 }] },
  { "name": "組合B", "materials": [{ "itemId": 305, "qty": 5 }] }
]
```

---

## 自動化設定結構

`setting_${token}` 中 `battle.setting` 的完整欄位說明：

| 欄位 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `targetMapId` | `number` | — | 目標戰鬥地圖 ID |
| `hpRecoveryMode` | `"rest" \| "medicine"` | `"rest"` | HP 回復方式：休息或使用補品 |
| `spRecoveryMode` | `"rest" \| "medicine"` | `"rest"` | SP 回復方式：休息或使用補品 |
| `bossSoloMode` | `"none" \| "pass" \| "wait"` | `"none"` | 遭遇 Boss 時的處理模式 |
| `allowEmptyHanded` | `boolean` | `false` | 是否允許空手（無裝備）出戰 |
| `useTeleportCrystal` | `boolean` | `false` | 不在目標地圖時是否自動使用傳送水晶 |
| `medicineHpId` | `number \| null` | `null` | HP 補品的 `item_id` |
| `medicineSpId` | `number \| null` | `null` | SP 補品的 `item_id` |
| `medicineHpQuantity` | `number` | `1` | HP 補品每次使用數量 |
| `medicineSpQuantity` | `number` | `1` | SP 補品每次使用數量 |

---

## 自動化生命週期

```
使用者點擊「開始」
        │
        ▼
accountStore.startAutomation(token)
  ├─ 設定 battle.enabled = true
  └─ 啟動非同步輪詢迴圈
        │
        ▼
輪詢迴圈（async loop）
  ├─ await autoBattleChecker(token, setting)
  ├─ await mineChecker(token, setting)
  ├─ await recycleChecker(token, setting)
  └─ await sleep(pollInterval)  ←─────────┐
        │                                  │
        └──────────────────────────────────┘
（直到 enabled = false）
        │
使用者點擊「停止」
        │
        ▼
accountStore.stopAutomation(token)
  └─ 設定 battle.enabled = false
        │
        ▼
迴圈於下次 sleep 結束後自然退出
```

> **注意：** 每個帳號擁有獨立的輪詢迴圈，多帳號間互不干擾。

---

## 補品過濾邏輯

`AutoBattle.vue` 在渲染補品下拉選單時，對背包物品進行過濾。

### HP 補品白名單

符合以下任一條件的物品會顯示於 HP 補品選項：

```js
item.effect.type === 'hp'
// 或
item.effect.type === 'restore' && item.effect.hp > 0
```

### SP 補品白名單

符合以下任一條件的物品會顯示於 SP 補品選項：

```js
item.effect.type === 'mp'
// 或
item.effect.type === 'restore' && item.effect.mp > 0
```

---

## 設定遷移機制

為維持向前相容性，`accountStore` 在載入舊版 `setting_${token}` 時，會自動將已更名的欄位映射至新欄位。

### 已知遷移規則

| 舊欄位 | 新欄位 | 說明 |
|--------|--------|------|
| `battle.setting.autoChallengeBossSolo` | `battle.setting.bossSoloMode` | Boss 挑戰模式從 boolean 改為三選一字串 |

### 遷移邏輯範例（虛擬碼）

```ts
// accountStore.ts 載入設定時
if (setting.battle?.setting?.autoChallengeBossSolo !== undefined) {
  // 舊版 boolean → 新版字串
  setting.battle.setting.bossSoloMode =
    setting.battle.setting.autoChallengeBossSolo ? 'wait' : 'none';
  delete setting.battle.setting.autoChallengeBossSolo;
}
```

遷移完成後，設定會重新序列化寫回 localStorage，確保下次載入時已使用新格式。

---

*文件由開發人員維護，如有功能新增或欄位變更，請同步更新本文件。*
