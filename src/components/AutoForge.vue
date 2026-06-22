<template>
  <div class="auto-forge-module">
    <el-card shadow="never" class="inner-card">
      <!-- Controls -->
      <el-row :gutter="20" align="middle">
        <el-col
          :xs="24"
          :sm="12"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <el-button
            type="success"
            size="large"
            @click="handleAutoForge"
            :disabled="scriptStatus || !isFormValid"
            style="width: 100%"
          >
            啟動自動鍛造
          </el-button>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-button
            type="danger"
            size="large"
            @click="handleStop"
            :disabled="!scriptStatus"
            style="width: 100%"
          >
            停止自動鍛造
          </el-button>
        </el-col>
      </el-row>

      <el-row :gutter="20" align="middle" style="margin-top: 15px">
        <el-col :span="24">
          <el-button
            type="warning"
            size="large"
            @click="handleManualClaim"
            :disabled="!canClaimForge || scriptStatus"
            style="width: 100%"
          >
            手動領取裝備{{ claimCountdownText }}
          </el-button>
        </el-col>
      </el-row>

      <el-divider border-style="dashed" />

      <!-- Form Settings -->
      <el-row :gutter="20">
        <el-col
          :xs="24"
          :sm="12"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">選擇鍛造配方</div>
          <el-select
            v-model="result_item_id"
            placeholder="請選擇武器/裝備配方"
            style="width: 100%"
            :loading="loadingRecipes"
            filterable
          >
            <el-option
              v-for="recipe in recipes"
              :key="recipe.id"
              :label="`${recipe.name} (需 ${recipe.required_quantity} 個材料)`"
              :value="recipe.id"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12">
          <div class="input-label">自定義名稱 (不可為空)</div>
          <el-input
            v-model="weapon_name"
            placeholder="例如：王者之劍"
            clearable
          />
        </el-col>
      </el-row>

      <!-- Description and Details -->
      <el-row v-if="selectedRecipe" style="margin-top: 15px">
        <el-col :span="24">
          <div class="recipe-desc-panel">
            <span class="desc-title">配方說明：</span>
            <span class="desc-text">{{ selectedRecipe.description }}</span>
            <span
              class="desc-tags"
              v-if="selectedRecipe.tags && selectedRecipe.tags.length"
            >
              分類:
              <el-tag
                size="small"
                v-for="tag in selectedRecipe.tags"
                :key="tag"
                class="tag-item"
                >{{ tag }}</el-tag
              >
            </span>
          </div>
        </el-col>
      </el-row>

      <!-- Forge Favorites Configuration -->
      <el-row :gutter="20" align="middle" style="margin-top: 15px">
        <el-col
          :xs="24"
          :sm="10"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">載入收藏組合</div>
          <el-select
            v-model="activeFavoriteId"
            placeholder="選擇已存組合..."
            style="width: 100%"
            clearable
            @change="handleSelectFavorite"
          >
            <el-option-group
              v-for="group in groupedFavorites"
              :key="group.label"
              :label="group.label"
            >
              <el-option
                v-for="fav in group.options"
                :key="fav.id"
                :label="fav.favoriteName"
                :value="fav.id"
              />
            </el-option-group>
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="14" style="margin-top: 10px; sm-margin-top: 20px">
          <el-button-group style="display: flex; width: 100%">
            <el-button
              type="primary"
              @click="handleSaveFavorite"
              style="flex: 1.5; padding: 0"
              >儲存組合</el-button
            >
            <el-button
              type="success"
              :disabled="!activeFavoriteId"
              @click="handleUpdateFavorite"
              style="flex: 1; padding: 0"
              >更新</el-button
            >
            <el-button
              type="danger"
              :disabled="!activeFavoriteId"
              @click="handleDeleteFavorite"
              style="flex: 1; padding: 0"
              >刪除</el-button
            >
          </el-button-group>
        </el-col>
      </el-row>

      <!-- Loop configuration -->
      <el-divider border-style="dashed" style="margin: 15px 0" />
      <el-row :gutter="20" align="middle">
        <el-col :xs="8" :sm="6">
          <div class="input-label">循環製作</div>
          <el-switch v-model="loopCraft" />
        </el-col>
        <el-col :xs="16" :sm="9">
          <div class="input-label">最大製作次數 (0 為無限制)</div>
          <el-input-number
            v-model="maxCraftCount"
            :min="0"
            size="small"
            style="width: 100%"
            :disabled="!loopCraft"
          />
        </el-col>
        <el-col
          :xs="24"
          :sm="9"
          class="craft-count-col"
          style="text-align: right"
        >
          <div class="count-display">
            當前已累計:
            <span class="count-number">{{ currentCraftCount }}</span> 次
          </div>
        </el-col>
      </el-row>

      <!-- Material Status Alert -->
      <el-row style="margin-top: 20px">
        <el-col :span="24">
          <el-alert
            v-if="result_item_id"
            :title="alertMessage"
            :type="alertType"
            :closable="false"
            show-icon
          />
        </el-col>
      </el-row>

      <!-- Materials List -->
      <el-row style="margin-top: 15px">
        <el-col :span="24">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            "
          >
            <div class="input-label" style="margin-bottom: 0">
              放入材料配置 (背包可用素材)
            </div>
            <el-button
              type="warning"
              plain
              size="small"
              @click="handleResetMaterials"
              >重製材料選定</el-button
            >
          </div>
          <div
            v-if="displayMaterialsList.length > 0"
            style="margin-top: 10px; margin-bottom: 10px"
          >
            <el-input
              v-model="searchMaterialQuery"
              placeholder="搜尋材料名稱進行模糊篩選..."
              clearable
              size="default"
              style="width: 100%"
            />
          </div>
          <div v-if="displayMaterialsList.length === 0" class="empty-materials">
            背包中無可用素材，請先前往採礦或取得材料。
          </div>
          <div
            v-else-if="filteredMaterials.length === 0"
            class="empty-materials"
          >
            找不到符合搜尋條件的材料。
          </div>
          <div v-else class="materials-grid">
            <div
              v-for="item in filteredMaterials"
              :key="item.item_id"
              class="material-card"
              :class="{
                'has-selected':
                  selectedMaterials[item.item_id] > 0 &&
                  selectedMaterials[item.item_id] <= item.quantity,
                'insufficient-selected':
                  selectedMaterials[item.item_id] > item.quantity,
              }"
            >
              <div class="material-header">
                <span class="material-name">{{ item.name }}</span>
                <span class="material-owned">持有: {{ item.quantity }}</span>
              </div>
              <div class="material-stats">
                <span
                  v-if="parseFloat(item.bonus_atk) !== 0"
                  class="stat-tag atk"
                  >物攻 +{{ item.bonus_atk }}</span
                >
                <span
                  v-if="parseFloat(item.bonus_def) !== 0"
                  class="stat-tag def"
                  >物防 +{{ item.bonus_def }}</span
                >
                <span
                  v-if="parseFloat(item.bonus_luck) !== 0"
                  class="stat-tag luck"
                  >幸運 +{{ item.bonus_luck }}</span
                >
                <span
                  v-if="parseFloat(item.bonus_durability) !== 0"
                  class="stat-tag durability"
                  >耐久 +{{ item.bonus_durability }}</span
                >
              </div>
              <div class="material-control">
                <el-input-number
                  v-model="selectedMaterials[item.item_id]"
                  :min="0"
                  :max="item.quantity"
                  size="small"
                  controls-position="right"
                  style="width: 100%"
                />
              </div>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- Logs -->
      <div class="log-section" style="margin-top: 20px">
        <el-button
          type="info"
          plain
          @click="showContent = !showContent"
          style="width: 100%"
        >
          {{ showContent ? "隱藏鍛造日誌" : "展開鍛造日誌" }}
        </el-button>
        <div v-show="showContent" class="log-content">
          <div
            v-for="(info, index) in forgeInfoList"
            :key="index"
            class="log-item"
          >
            <span class="log-time">[{{ info.time }}]</span>
            <span class="log-msg">{{ info.m }}</span>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  defineProps,
  defineEmits,
  onMounted,
  onUnmounted,
  watch,
  computed,
} from "vue";
import { ElMessage } from "element-plus";
import { useAccountStore } from "../store/accountStore";
import moment from "moment";

const props = defineProps({
  userObj: Object,
  profile: Object,
});

const emit = defineEmits(["set-profile"]);

const store = useAccountStore();
const account = computed(() => {
  return store.accounts.find((a) => a.token === props.userObj?.token);
});

// 計算屬性直接對齊後台任務狀態與日誌
const scriptStatus = computed(
  () => account.value?.automation.forge.running || false
);
const forgeInfoList = computed(
  () => account.value?.automation.forge.logs || []
);
const currentForgeAutomation = computed(() => account.value?.automation.forge);
const currentCraftCount = computed(
  () => account.value?.automation.forge.setting?.currentCraftCount || 0
);

const showContent = ref(false);
const recipes = ref<any[]>([]);
const backpackMaterials = ref<any[]>([]);
const loadingRecipes = ref(false);
const searchMaterialQuery = ref("");

const displayMaterialsList = computed(() => {
  const list = [...backpackMaterials.value];

  // 取得目前選中收藏組合的所有材料 ID
  const favoriteItemIds = new Set<number>();
  if (activeFavoriteId.value) {
    const fav = favorites.value.find((f) => f.id === activeFavoriteId.value);
    if (fav && fav.materials) {
      fav.materials.forEach((m) => {
        favoriteItemIds.add(m.item_id);
      });
    }
  }

  // 1. 結合已選取數量 > 0 的項目
  for (const [idStr, qty] of Object.entries(selectedMaterials.value)) {
    const itemId = Number(idStr);
    const qtyVal = Number(qty);
    if (qtyVal > 0) {
      const exists = list.some((m) => m.item_id === itemId);
      if (!exists) {
        list.push({
          item_id: itemId,
          name: store.knownItemNames[itemId] || `物品ID(${itemId})`,
          quantity: 0,
          bonus_atk: 0,
          bonus_def: 0,
          bonus_luck: 0,
          bonus_durability: 0,
        });
      }
    }
  }

  // 2. 結合當前收藏組合中定義的項目，即使它們已選數量為 0
  favoriteItemIds.forEach((itemId) => {
    const exists = list.some((m) => m.item_id === itemId);
    if (!exists) {
      list.push({
        item_id: itemId,
        name: store.knownItemNames[itemId] || `物品ID(${itemId})`,
        quantity: 0,
        bonus_atk: 0,
        bonus_def: 0,
        bonus_luck: 0,
        bonus_durability: 0,
      });
    }
  });

  // 3. 排序：已選用數量 > 0 的項目優先置頂，其次依背包持有量降序排列
  list.sort((a, b) => {
    const qtyA = selectedMaterials.value[a.item_id] || 0;
    const qtyB = selectedMaterials.value[b.item_id] || 0;

    if (qtyA > 0 && qtyB === 0) return -1;
    if (qtyA === 0 && qtyB > 0) return 1;

    return b.quantity - a.quantity;
  });

  return list;
});

const filteredMaterials = computed(() => {
  if (!searchMaterialQuery.value.trim()) {
    return displayMaterialsList.value;
  }
  const query = searchMaterialQuery.value.trim().toLowerCase();
  return displayMaterialsList.value.filter((item) =>
    (item.name || "").toLowerCase().includes(query)
  );
});

// 防止 store→local 和 local→store 互相觸發的防護 flag
const isUpdatingFromStore = ref(false);
const isInitialized = ref(false);

// 本地可變響應式變數，與 UI 輸入進行雙向綁定
const weapon_name = ref("");
const result_item_id = ref<number>(0);
const selectedMaterials = ref<Record<number, number>>({});
const loopCraft = ref(false);
const maxCraftCount = ref(0);

interface ForgeFavorite {
  id: string;
  favoriteName: string;
  weapon_name: string;
  result_item_id: number;
  materials: Array<{ item_id: number; quantity: number; name?: string }>;
}

const activeFavoriteId = ref<string>("");
const favorites = ref<ForgeFavorite[]>([]);

const weaponTypeMap: Record<string, string> = {
  Dagger: "短刀",
  "One-handed Sword": "單手劍",
  Sword: "單手劍",
  Rapier: "細劍",
  Hammer: "單手錘",
  Shield: "盾牌",
  Axe: "雙手斧",
  "Two-handed Sword": "雙手劍",
  Greatsword: "雙手劍",
  Katana: "太刀",
  Spear: "長槍",
  Wand: "法杖",
  Bow: "弓箭",
};

const getWeaponTypeOfFavorite = (fav: ForgeFavorite) => {
  const recipe = recipes.value.find((r) => r.id === fav.result_item_id);
  if (recipe) {
    if (recipe.tags && recipe.tags.length > 0) {
      const rawTag = recipe.tags[0];
      return weaponTypeMap[rawTag] || rawTag;
    }
    const name = recipe.name || "";
    for (const t of [
      "短刀",
      "單手劍",
      "細劍",
      "單手錘",
      "盾牌",
      "雙手斧",
      "雙手劍",
      "太刀",
      "長槍",
      "法杖",
      "弓箭",
    ]) {
      if (name.includes(t)) return t;
    }
  }
  return "其他裝備";
};

const groupedFavorites = computed(() => {
  const groups: { label: string; options: ForgeFavorite[] }[] = [];
  favorites.value.forEach((fav) => {
    const typeName = getWeaponTypeOfFavorite(fav);
    let group = groups.find((g) => g.label === typeName);
    if (!group) {
      group = { label: typeName, options: [] };
      groups.push(group);
    }
    group.options.push(fav);
  });
  return groups.sort((a, b) => a.label.localeCompare(b.label));
});

const loadFavorites = () => {
  if (!props.userObj?.token) return;
  const stored = localStorage.getItem(`forge_favorites_${props.userObj.token}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      favorites.value = parsed;
      // 記錄收藏中的材料名稱
      parsed.forEach((fav: any) => {
        if (fav.materials) {
          fav.materials.forEach((m: any) => {
            if (m.item_id && m.name) {
              store.knownItemNames[m.item_id] = m.name;
            }
          });
        }
      });
    } catch (e) {
      console.error("載入收藏組合失敗:", e);
      favorites.value = [];
    }
  } else {
    favorites.value = [];
  }
};

const saveFavoritesToStorage = () => {
  if (!props.userObj?.token) return;
  localStorage.setItem(
    `forge_favorites_${props.userObj.token}`,
    JSON.stringify(favorites.value)
  );
};

const fetchRecipesAndMaterials = async () => {
  if (!props.userObj) return;
  loadingRecipes.value = true;
  try {
    const data = await props.userObj.getForgeRecipes();
    if (data) {
      recipes.value = data.recipes || [];
      backpackMaterials.value = data.inventory || [];
    }
  } catch (error) {
    console.error("fetchRecipesAndMaterials error:", error);
    ElMessage.error("載入配方與材料清單失敗");
  } finally {
    loadingRecipes.value = false;
  }
};

// 監聽 token 變更時，重載配方與材料
watch(
  () => props.userObj?.token,
  (newToken) => {
    if (newToken) {
      isInitialized.value = false; // 帳號更換，重設初始化標記
      fetchRecipesAndMaterials();
      activeFavoriteId.value = "";
      loadFavorites();
    }
  },
  { immediate: true }
);

// 當更換帳號或後台狀態更新時，同步寫入本地綁定變數
watch(
  currentForgeAutomation,
  (newVal) => {
    if (newVal) {
      isUpdatingFromStore.value = true;
      weapon_name.value = newVal.weaponPayload.weapon_name || "";
      result_item_id.value = newVal.weaponPayload.result_item_id || 0;
      loopCraft.value = newVal.setting?.loopCraft ?? false;
      maxCraftCount.value = newVal.setting?.maxCraftCount ?? 0;

      const newMats: Record<number, number> = {};
      if (newVal.weaponPayload.materials) {
        newVal.weaponPayload.materials.forEach((m: any) => {
          newMats[m.item_id] = m.quantity;
          if (m.name) {
            store.knownItemNames[m.item_id] = m.name;
          }
        });
      }
      // 確保將 backpackMaterials 中的項目也補上預設的 0
      backpackMaterials.value.forEach((item) => {
        if (newMats[item.item_id] === undefined) {
          newMats[item.item_id] = 0;
        }
      });
      selectedMaterials.value = newMats;

      setTimeout(() => {
        isUpdatingFromStore.value = false;
        isInitialized.value = true; // 狀態同步完成，啟動初始化鎖
      }, 0);
    }
  },
  { immediate: true, deep: true }
);

// 當背包材料載入完成時，補齊本地選擇材料的預設 0
watch(
  backpackMaterials,
  (newMaterials) => {
    newMaterials.forEach((item) => {
      if (item.name) {
        store.knownItemNames[item.item_id] = item.name;
      }
      if (selectedMaterials.value[item.item_id] === undefined) {
        selectedMaterials.value[item.item_id] = 0;
      }
    });
  },
  { deep: true }
);

watch(
  [weapon_name, result_item_id, selectedMaterials, loopCraft, maxCraftCount],
  () => {
    if (isUpdatingFromStore.value || !isInitialized.value) return;
    if (account.value) {
      const forge = account.value.automation.forge;
      forge.weaponPayload.weapon_name = weapon_name.value;
      forge.weaponPayload.result_item_id = result_item_id.value;

      const mats: Array<{ item_id: number; quantity: number; name?: string }> =
        [];
      for (const [idStr, qty] of Object.entries(selectedMaterials.value)) {
        const qtyNum = Number(qty);
        if (qtyNum > 0) {
          const itemId = Number(idStr);
          const itemInfo = backpackMaterials.value.find(
            (m) => m.item_id === itemId
          );
          mats.push({
            item_id: itemId,
            quantity: qtyNum,
            name: itemInfo?.name || store.knownItemNames[itemId],
          });
        }
      }
      forge.weaponPayload.materials = mats;

      if (!forge.setting) {
        forge.setting = {
          loopCraft: false,
          maxCraftCount: 0,
          currentCraftCount: 0,
        };
      }
      forge.setting.loopCraft = loopCraft.value;
      forge.setting.maxCraftCount = maxCraftCount.value;
    }
  },
  { deep: true }
);

const selectedRecipe = computed(() => {
  return recipes.value.find((r) => r.id === result_item_id.value);
});

const requiredQuantity = computed(() => {
  return selectedRecipe.value?.required_quantity || 0;
});

const totalSelectedQuantity = computed(() => {
  let sum = 0;
  for (const qty of Object.values(selectedMaterials.value)) {
    sum += Number(qty) || 0;
  }
  return sum;
});

const isFormValid = computed(() => {
  return (
    Number(result_item_id.value) > 0 &&
    weapon_name.value.trim() !== "" &&
    Number(totalSelectedQuantity.value) === Number(requiredQuantity.value)
  );
});

const alertMessage = computed(() => {
  if (!result_item_id.value) return "";
  const req = requiredQuantity.value;
  const cur = totalSelectedQuantity.value;
  if (cur === req) {
    return `材料數量恰好符合！已放入 ${cur} / ${req} 個材料。`;
  } else if (cur < req) {
    return `放入材料不足！目前 ${cur} / ${req} 個，還缺 ${req - cur} 個材料。`;
  } else {
    return `放入材料過多！目前 ${cur} / ${req} 個，請扣除 ${
      cur - req
    } 個材料。`;
  }
});

const alertType = computed(() => {
  const req = requiredQuantity.value;
  const cur = totalSelectedQuantity.value;
  if (cur === req) return "success";
  if (cur < req) return "warning";
  return "error";
});

const handleAutoForge = async () => {
  if (!result_item_id.value) {
    ElMessage.warning("請先選擇要鍛造的配方");
    return;
  }
  if (!weapon_name.value.trim()) {
    ElMessage.warning("請輸入自定義武器名稱");
    return;
  }
  if (totalSelectedQuantity.value !== requiredQuantity.value) {
    ElMessage.warning(
      `放入材料數量 (${totalSelectedQuantity.value}) 與配方需求 (${requiredQuantity.value}) 不符！`
    );
    return;
  }
  store.startForge(props.userObj.token);
  ElMessage.success("自動鍛造背景任務已啟動");
};

const handleStop = () => {
  store.stopForge(props.userObj.token);
  ElMessage.info("自動鍛造背景任務已停止");
};

const isForging = computed(() => {
  return props.profile?.activeStatuses?.includes("鍛造") || false;
});

const nowTick = ref(Date.now());
let countdownInterval: ReturnType<typeof setInterval> | null = null;

const startTimer = () => {
  if (countdownInterval) return;
  nowTick.value = Date.now();
  countdownInterval = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
};

const stopTimer = () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
};

// 只有在真正鍛造中才啟動計時器，避免其他人物或閒置時佔用 CPU
watch(
  isForging,
  (val) => {
    if (val) {
      startTimer();
    } else {
      stopTimer();
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  stopTimer();
});

// 計算鍛造剩餘時間 (秒)
const forgeRemainingSeconds = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _tick = nowTick.value;
  if (!props.profile?.forgingCompletionTime) return 9999;
  const offset = props.profile.serverOffsetMs || 0;
  const clientTime = moment().add(offset, "ms");
  const diff = moment.duration(
    moment(props.profile.forgingCompletionTime).diff(clientTime)
  );
  return diff.asSeconds();
});

// 是否可以手動領取
const canClaimForge = computed(() => {
  return isForging.value && forgeRemainingSeconds.value <= -5;
});

// 按鈕倒數文字
const claimCountdownText = computed(() => {
  if (!isForging.value) return "";
  const secs = forgeRemainingSeconds.value;
  if (secs <= -5) return " (可領取)";
  if (secs <= 0) return " (即將完成)";

  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return ` (剩餘 ${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")})`;
});

const handleManualClaim = async () => {
  try {
    const res = await props.userObj.forgeComplete();
    if (
      res instanceof Error ||
      (res && res.error) ||
      !res ||
      !res.activeStatuses
    ) {
      const err = res || {};
      const errMsg =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "領取失敗，鍛造可能尚未完成";
      ElMessage.error(`領取失敗：${errMsg}`);
    } else {
      emit("set-profile", res);
      ElMessage.success("手動領取裝備成功");
      await fetchRecipesAndMaterials();
    }
  } catch (err: any) {
    console.error("handleManualClaim exception:", err);
    ElMessage.error(`領取失敗：${err.message || err}`);
  }
};

const handleSelectFavorite = (id: string) => {
  if (!id) return;
  const fav = favorites.value.find((f) => f.id === id);
  if (fav) {
    weapon_name.value = fav.weapon_name;
    result_item_id.value = fav.result_item_id;

    const newMats: Record<number, number> = {};
    backpackMaterials.value.forEach((m) => {
      newMats[m.item_id] = 0;
    });
    fav.materials.forEach((m) => {
      newMats[m.item_id] = m.quantity;
    });
    selectedMaterials.value = newMats;
    ElMessage.success(`已載入組合：${fav.favoriteName}`);
  }
};

const handleSaveFavorite = () => {
  if (!result_item_id.value) {
    ElMessage.warning("請先選擇配方");
    return;
  }
  if (!weapon_name.value.trim()) {
    ElMessage.warning("請先輸入自定義名稱");
    return;
  }
  const favName = prompt("請輸入此收藏組合的名稱：");
  if (favName === null) return;
  const trimmedName = favName.trim();
  if (!trimmedName) {
    ElMessage.warning("收藏名稱不可為空！");
    return;
  }

  const mats: Array<{ item_id: number; quantity: number; name?: string }> = [];
  for (const [idStr, qty] of Object.entries(selectedMaterials.value)) {
    const qtyNum = Number(qty);
    if (qtyNum > 0) {
      const itemId = Number(idStr);
      const itemInfo = backpackMaterials.value.find(
        (m) => m.item_id === itemId
      );
      mats.push({
        item_id: itemId,
        quantity: qtyNum,
        name: itemInfo?.name || store.knownItemNames[itemId],
      });
    }
  }

  const newFav: ForgeFavorite = {
    id: Date.now().toString(),
    favoriteName: trimmedName,
    weapon_name: weapon_name.value,
    result_item_id: result_item_id.value,
    materials: mats,
  };

  favorites.value.push(newFav);
  saveFavoritesToStorage();
  activeFavoriteId.value = newFav.id;
  ElMessage.success(`儲存組合「${trimmedName}」成功！`);
};

const handleUpdateFavorite = () => {
  if (!activeFavoriteId.value) return;
  const favIndex = favorites.value.findIndex(
    (f) => f.id === activeFavoriteId.value
  );
  if (favIndex === -1) return;

  const mats: Array<{ item_id: number; quantity: number; name?: string }> = [];
  for (const [idStr, qty] of Object.entries(selectedMaterials.value)) {
    const qtyNum = Number(qty);
    if (qtyNum > 0) {
      const itemId = Number(idStr);
      const itemInfo = backpackMaterials.value.find(
        (m) => m.item_id === itemId
      );
      mats.push({
        item_id: itemId,
        quantity: qtyNum,
        name: itemInfo?.name || store.knownItemNames[itemId],
      });
    }
  }

  favorites.value[favIndex].weapon_name = weapon_name.value;
  favorites.value[favIndex].result_item_id = result_item_id.value;
  favorites.value[favIndex].materials = mats;

  saveFavoritesToStorage();
  ElMessage.success(
    `更新組合「${favorites.value[favIndex].favoriteName}」成功！`
  );
};

const handleDeleteFavorite = () => {
  if (!activeFavoriteId.value) return;
  const favIndex = favorites.value.findIndex(
    (f) => f.id === activeFavoriteId.value
  );
  if (favIndex === -1) return;

  const name = favorites.value[favIndex].favoriteName;
  if (!confirm(`確定要刪除組合「${name}」嗎？`)) return;

  favorites.value.splice(favIndex, 1);
  saveFavoritesToStorage();
  activeFavoriteId.value = "";
  ElMessage.success(`組合「${name}」已刪除。`);
};

const handleResetMaterials = () => {
  const newMats: Record<number, number> = {};
  Object.keys(selectedMaterials.value).forEach((k) => {
    newMats[Number(k)] = 0;
  });
  selectedMaterials.value = newMats;
  ElMessage.info("已重製所有材料選定數量為 0");
};

onMounted(async () => {
  await fetchRecipesAndMaterials();
  loadFavorites();
});
</script>

<style scoped>
.inner-card {
  background-color: #141619 !important;
  border: 1px solid #2d2f31 !important;
}

.input-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 600;
}

.recipe-desc-panel {
  background-color: #1a1d21;
  border: 1px solid #2d3139;
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
}

.desc-title {
  color: #909399;
  font-weight: bold;
}

.desc-text {
  color: #e4e7ed;
  margin-right: 15px;
}

.desc-tags {
  color: #909399;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag-item {
  margin-left: 4px;
}

.count-display {
  font-size: 14px;
  color: #e4e7ed;
  font-weight: 600;
}

.count-number {
  color: #409eff;
  font-size: 18px;
  margin: 0 4px;
}

.empty-materials {
  padding: 20px;
  text-align: center;
  background-color: #1a1d21;
  border: 1px dashed #2d3139;
  border-radius: 6px;
  color: #909399;
  font-size: 13px;
}

.materials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
}

.material-card {
  background-color: #1a1d21;
  border: 1px solid #2d3139;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.2s ease;
}

.material-card.has-selected {
  border-color: #67c23a;
  background-color: #152318;
}

.material-card.insufficient-selected {
  border-color: #f56c6c;
  background-color: #2b1d1d;
}

.material-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: #e4e7ed;
  align-items: center;
}

.material-owned {
  font-size: 11px;
  color: #909399;
}

.material-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
  min-height: 20px;
}

.stat-tag {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: bold;
}

.stat-tag.atk {
  background-color: rgba(245, 108, 108, 0.15);
  color: #f56c6c;
  border: 1px solid rgba(245, 108, 108, 0.3);
}

.stat-tag.def {
  background-color: rgba(64, 158, 255, 0.15);
  color: #409eff;
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.stat-tag.luck {
  background-color: rgba(230, 162, 60, 0.15);
  color: #e6a23c;
  border: 1px solid rgba(230, 162, 60, 0.3);
}

.stat-tag.durability {
  background-color: rgba(103, 194, 58, 0.15);
  color: #67c23a;
  border: 1px solid rgba(103, 194, 58, 0.3);
}

.material-control {
  margin-top: 8px;
}

.log-content {
  margin-top: 12px;
  background-color: #000;
  border-radius: 8px;
  padding: 15px;
  max-height: 200px;
  overflow-y: auto;
  font-family: "Fira Code", monospace;
  font-size: 12px;
  border: 1px solid #2d2f31;
}

.log-item {
  margin-bottom: 4px;
}

.log-time {
  color: #555;
  margin-right: 8px;
}

.log-msg {
  color: #67c23a;
}

@media (max-width: 768px) {
  .craft-count-col {
    text-align: left !important;
    margin-top: 10px;
  }
}
</style>
