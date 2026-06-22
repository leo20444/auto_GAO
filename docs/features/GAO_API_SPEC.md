# GAO API 規格文件

> **版本**：1.0.0  
> **最後更新**：2026-06-22  
> **語言**：繁體中文  
> **狀態**：已確認（基於實測回傳結構）

---

## 目錄

1. [基本資訊](#1-基本資訊)
2. [認證](#2-認證)
3. [端點清單](#3-端點清單)
   - [3.1 角色與狀態](#31-角色與狀態)
   - [3.2 行動](#32-行動)
   - [3.3 裝備](#33-裝備)
   - [3.4 補品與道具](#34-補品與道具)
   - [3.5 鍛造](#35-鍛造)
   - [3.6 採礦](#36-採礦)
   - [3.7 其他](#37-其他)
4. [資料結構](#4-資料結構)
   - [4.1 道具（Item）](#41-道具item)
   - [4.2 effect.type 分類表](#42-effecttype-分類表)
5. [地圖 ID 對照表](#5-地圖-id-對照表)
6. [補品使用邏輯說明](#6-補品使用邏輯說明)

---

## 1. 基本資訊

| 項目 | 值 |
|------|----|
| **API Base URL** | `https://gunart-backend.onrender.com/api` |
| **通訊協定** | HTTPS |
| **資料格式** | JSON（`Content-Type: application/json`） |
| **時區** | UTC+8（Asia/Taipei） |

所有請求路徑均以 `/api` 為前綴，例如：

```
GET https://gunart-backend.onrender.com/api/profile
POST https://gunart-backend.onrender.com/api/action/rest
```

---

## 2. 認證

所有 API 端點均需要在 HTTP Header 中帶入 Bearer Token 進行身份驗證。

### Request Header

```http
Authorization: Bearer <token>
```

| 參數 | 說明 |
|------|------|
| `<token>` | 登入後取得的 JWT 存取權杖 |

> **注意**：Token 過期後需重新登入取得新 Token，否則所有 API 將回傳 `401 Unauthorized`。

---

## 3. 端點清單

### 3.1 角色與狀態

#### `GET /profile`

取得角色目前狀態，包含 HP、MP、等級、位置等基本資訊。

- **Request Body**：無
- **Response**：角色狀態物件

---

#### `GET /inventory`

取得背包內所有道具清單。

- **Request Body**：無
- **Response**：

```json
{
  "items": [ /* Item[] 陣列，詳見 4.1 */ ]
}
```

---

#### `GET /forge/equipment`

取得角色持有的所有裝備清單（包含未穿戴的裝備）。

- **Request Body**：無
- **Response**：裝備陣列

---

#### `GET /equip`

取得角色目前穿戴中的裝備資訊。

- **Request Body**：無
- **Response**：各部位穿戴裝備物件

---

### 3.2 行動

#### `POST /action/rest`

開始休息行動。角色進入休息狀態，HP/MP 將隨時間回復。

- **Request Body**：無
- **Response**：行動開始確認

---

#### `POST /action/complete`

完成當前行動（通用行動結束點）。

- **Request Body**：無
- **Response**：行動結束結果

---

#### `POST /zone/move/{zoneId}`

移動至指定地圖。

- **Path Parameter**：

| 參數 | 型態 | 說明 |
|------|------|------|
| `zoneId` | `number` | 目標地圖 ID（詳見第 5 節） |

- **Request Body**：無
- **Response**：移動開始確認

**範例：**
```http
POST /api/zone/move/1
```

---

#### `POST /zone/move/complete`

完成地圖移動行動（移動倒數結束後呼叫）。

- **Request Body**：無
- **Response**：移動完成結果，包含抵達地圖資訊

---

#### `POST /path`

進入秘徑（特殊隱藏地圖）。

- **Request Body**：

```json
{
  "target_map_id": 4001
}
```

| 欄位 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `target_map_id` | `number` | ✅ | 秘徑目標地圖 ID（見地圖對照表） |

- **Response**：進入秘徑結果

---

#### `POST /hunt`

執行戰鬥行動。

- **Request Body**：

```json
{
  "type": 1
}
```

| 欄位 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `type` | `number` | ✅ | `1` = 戰鬥，`2` = 逃跑 |

- **Response**：戰鬥結果（傷害、掉落物、勝敗等）

---

#### `POST /action/revive`

角色死亡後執行復活。

- **Request Body**：無
- **Response**：復活結果，角色回到安全點

---

### 3.3 裝備

#### `POST /equip/{id}`

穿上指定裝備。

- **Path Parameter**：

| 參數 | 型態 | 說明 |
|------|------|------|
| `id` | `number` | 裝備的背包紀錄 ID（`inventory.id`） |

- **Request Body**：無
- **Response**：穿戴結果

---

#### `POST /unequip/{id}`

卸除指定部位或指定裝備。

- **Path Parameter**：

| 參數 | 型態 | 說明 |
|------|------|------|
| `id` | `number` | 裝備的背包紀錄 ID |

- **Request Body**：無
- **Response**：卸除結果

---

#### `POST /unequip`

卸除所有已穿戴裝備。

- **Request Body**：無
- **Response**：全部卸除確認

---

#### `POST /forge/recycle/{id}`

回收指定裝備，換取素材或鑄造點數。

- **Path Parameter**：

| 參數 | 型態 | 說明 |
|------|------|------|
| `id` | `number` | 裝備的背包紀錄 ID |

- **Request Body**：無
- **Response**：回收結果，包含取得素材清單

---

### 3.4 補品與道具

#### `POST /inventory/use/{id}`

使用背包中的指定道具（補品、技能書、傳送水晶等）。

- **Path Parameter**：

| 參數 | 型態 | 說明 |
|------|------|------|
| `id` | `number` | 道具的 `item_id`（道具定義 ID，非背包紀錄 ID） |

> ⚠️ **注意**：此處使用的是 `item_id`（道具定義 ID），**不是** `id`（背包紀錄 ID）。

- **Request Body**：無
- **Response**：使用結果（效果觸發、數量減少等）

---

### 3.5 鍛造

#### `GET /forge/recipes`

取得角色可用的鍛造配方清單。

- **Request Body**：無
- **Response**：配方陣列，每筆包含所需素材與產出裝備資訊

---

#### `POST /forge`

開始鍛造指定配方。

- **Request Body**：（依配方 ID 傳入，具體欄位待確認）
- **Response**：鍛造開始確認，包含預計完成時間

---

#### `POST /forge/complete`

完成鍛造行動（鍛造倒數結束後呼叫）。

- **Request Body**：無
- **Response**：鍛造完成結果，包含產出裝備資訊

---

### 3.6 採礦

#### `GET /town/mine/status`

查詢目前採礦狀態，包含是否正在採礦、進度、剩餘時間等。

- **Request Body**：無
- **Response**：採礦狀態物件

---

#### `POST /town/mine/start`

開始採礦行動。

- **Request Body**：

```json
{
  "zone": 1
}
```

| 欄位 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `zone` | `number` | ✅ | 採礦地區編號 |

- **Response**：採礦開始確認，包含預計完成時間

---

#### `POST /town/mine/complete`

完成採礦行動，取得礦石資源。

- **Request Body**：無
- **Response**：採礦完成結果，包含取得礦石清單

---

### 3.7 其他

#### `GET /hunt/info`

取得當前所在地圖的戰鬥環境資訊，包含敵人種類、掉落率、地圖難度等。

- **Request Body**：無
- **Response**：戰鬥環境資訊物件

---

## 4. 資料結構

### 4.1 道具（Item）

`GET /inventory` 回傳的 `items` 陣列中每個元素的完整結構：

```json
{
  "id": 19695031,
  "item_id": 529,
  "quantity": 31,
  "name": "鴻喜菇",
  "type": "consumable",
  "tags": ["Food", "Mushroom"],
  "description": "鮮嫩的鴻喜菇，食用後可以恢復體力與精力。",
  "effect": {
    "type": "restore",
    "hp": 30,
    "mp": 40
  },
  "element_bonus": {},
  "durability": null,
  "color_tag": null
}
```

#### 欄位說明

| 欄位 | 型態 | 說明 |
|------|------|------|
| `id` | `number` | 背包紀錄 ID（唯一，每筆不同） |
| `item_id` | `number` | 道具定義 ID（同一種道具共用，用於 `/inventory/use/{id}`） |
| `quantity` | `number` | 目前持有數量 |
| `name` | `string` | 道具名稱 |
| `type` | `string` | 道具大分類（見下表） |
| `tags` | `string[]` | 標籤陣列（可複數，用於分類過濾） |
| `description` | `string` | 道具說明文字 |
| `effect` | `object` | 效果物件（結構依 `effect.type` 而異） |
| `effect.type` | `string` | 效果類型（詳見 4.2） |
| `effect.hp` | `number?` | HP 回復量（僅 `hp`、`restore` 類有此欄位） |
| `effect.mp` | `number?` | MP 回復量（僅 `mp`、`restore` 類有此欄位） |
| `element_bonus` | `object` | 元素加成（大多數道具為空物件 `{}`） |
| `durability` | `number?` | 耐久度（裝備類才有值，道具類為 `null`） |
| `color_tag` | `string?` | 顏色標籤（稀有度視覺識別，可為 `null`） |

#### type 大分類

| `type` 值 | 說明 |
|-----------|------|
| `consumable` | 消耗品（藥水、食物、技能書等） |
| `material` | 素材（鍛造原料） |
| `ammo` | 彈藥（遠程武器用） |

---

### 4.2 effect.type 分類表

補品自動使用的過濾依據，依 `effect.type` 判斷是否補 HP 或 SP（MP）：

| `effect.type` | tags 範例 | 說明 | 補 HP | 補 SP(MP) |
|---------------|-----------|------|:-----:|:---------:|
| `hp` | `["Potion"]` | HP 藥水，直接回復 HP | ✅ | ❌ |
| `mp` | `["Potion"]` | MP 藥水，直接回復 MP | ❌ | ✅ |
| `restore` | `["Food"]`、`["Food","Mushroom"]` | 食物類，同時回復 HP 與 MP | ✅（`hp > 0`） | ✅（`mp > 0`） |
| `learn_skill` | `["SkillBook"]` | 技能書，學習技能用 | ❌ | ❌ |
| `teleport` | `["Teleport"]` | 傳送水晶，地圖傳送用 | ❌ | ❌ |
| `enhance` | `["Scroll","ATK"]` | 強化卷軸，單一屬性強化 | ❌ | ❌ |
| `enhance_multi` | `["Scroll","Combat"]` | 多屬性卷軸，多屬性強化 | ❌ | ❌ |
| `reset_ability_points` | `["Voucher"]` | 能力點重置券 | ❌ | ❌ |
| `reset_talent_points` | `["Voucher"]` | 天賦點重置券 | ❌ | ❌ |
| `ammo` | `["Ammo"]` | 彈藥，遠程武器使用 | ❌ | ❌ |

#### restore 類型的 HP/MP 判斷邏輯

`restore` 類食物可能同時具有 `hp` 與 `mp` 效果，判斷是否適用需檢查值是否大於 0：

```typescript
// 判斷是否為 HP 補品
function isHpItem(item: Item): boolean {
  return (
    item.effect.type === 'hp' ||
    (item.effect.type === 'restore' && (item.effect.hp ?? 0) > 0)
  );
}

// 判斷是否為 SP(MP) 補品
function isSpItem(item: Item): boolean {
  return (
    item.effect.type === 'mp' ||
    (item.effect.type === 'restore' && (item.effect.mp ?? 0) > 0)
  );
}
```

---

## 5. 地圖 ID 對照表

| `zoneId` | 地圖名稱 | 類型 | 說明 |
|----------|----------|------|------|
| `0` | 起始之鎮 | 安全區域 | 回城點、採礦、鍛造、商店等設施所在地 |
| `1` | 普通森林 | 戰鬥區 | 低階戰鬥區，適合初期練功 |
| `2` | 深森林 | 戰鬥區 | 中階戰鬥區，敵人較強 |
| `3` | 地下城 | 戰鬥區 | 進階戰鬥區，含秘徑入口 |
| `4` | 蘑菇園 | 戰鬥區 | 菇菇仙境前哨站，12F 可進入秘徑 |
| `4001` | 菇菇仙境 | 秘徑地圖 | 透過 `POST /path` 進入，需在蘑菇園 12F |

### 移動至一般地圖

```http
POST /api/zone/move/1
```

### 移動至秘徑地圖

秘徑地圖（如菇菇仙境）需透過 `POST /path` 進入，**不可直接使用** `zone/move`：

```http
POST /api/path
Content-Type: application/json

{
  "target_map_id": 4001
}
```

---

## 6. 補品使用邏輯說明

自動補品系統依據以下條件從背包中篩選並使用適合的補品：

### HP 補品篩選條件

```
effect.type === 'hp'
OR
(effect.type === 'restore' AND effect.hp > 0)
```

### SP（MP）補品篩選條件

```
effect.type === 'mp'
OR
(effect.type === 'restore' AND effect.mp > 0)
```

### 使用 API

```http
POST /api/inventory/use/{item_id}
```

> ⚠️ 使用道具時帶入的是 `item_id`（道具定義 ID），**非** `id`（背包紀錄 ID）。

### 補品優先順序建議

1. 優先使用 `restore` 類食物（同時補 HP 與 MP，效益較高）
2. 其次使用 `hp` 類藥水補 HP
3. 其次使用 `mp` 類藥水補 MP

---

*本文件依據實測 API 回傳結構整理，如有欄位異動請同步更新。*
