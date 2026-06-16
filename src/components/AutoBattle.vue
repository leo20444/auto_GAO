<template>
  <div class="auto-battle-module">
    <el-card shadow="never" class="inner-card">
      <el-row :gutter="20" align="middle">
        <el-col :span="8">
          <el-select
            v-model="setting.map"
            placeholder="選擇目標地圖"
            size="large"
            style="width: 100%"
          >
            <el-option
              v-for="(item, index) in map"
              :key="index"
              :label="item.name"
              :value="item.name"
            />
          </el-select>
        </el-col>
        <el-col :span="16" class="button-group">
          <el-button
            type="success"
            size="large"
            :icon="VideoPlay"
            @click="handleAutoBattle"
            :disabled="scriptStatus"
            >啟動自動戰鬥</el-button
          >
          <el-button
            type="danger"
            size="large"
            :icon="VideoPause"
            @click="handleStop"
            :disabled="!scriptStatus"
            >停止</el-button
          >
        </el-col>
      </el-row>

      <el-divider border-style="dashed" />

      <el-row :gutter="20">
        <el-col :span="12">
          <el-descriptions title="執行資訊" :column="1" border>
            <el-descriptions-item label="狀態">
              <el-tag :type="scriptStatus ? 'success' : 'info'">{{
                scriptStatus ? "運行中" : "已停止"
              }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="累計次數"
              >{{ count }} 次</el-descriptions-item
            >
            <el-descriptions-item label="角色動作">
              <el-tag :type="miningStatusTag" size="small">
                {{ props.profile?.actionStatus || "空閒" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="props.profile?.actionStatus === '採礦'"
              label="採礦詳情"
            >
              <span style="font-size: 12px; color: #e6a23c">
                正在採礦中，自動戰鬥暫停等待
              </span>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="props.profile?.actionStatus === '移動'"
              label="移動詳情"
            >
              <span style="font-size: 12px; color: #409eff">
                移動至 {{ props.profile?.zoneName || "..." }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="props.profile?.actionStatus === '休息'"
              label="休息詳情"
            >
              <span style="font-size: 12px; color: #67c23a">
                休息中 (HP: {{ props.profile?.hp }} /
                {{ props.profile?.fullHp }}, SP: {{ props.profile?.sp }} /
                {{ props.profile?.fullSp }})
              </span>
            </el-descriptions-item>
          </el-descriptions>
        </el-col>
        <el-col :span="12">
          <el-descriptions title="自動保護設定" :column="1" border>
            <el-descriptions-item label="HP 極限 (保護)">
              <div style="display: flex; gap: 8px; align-items: center">
                <el-input-number
                  v-model="setting.hp"
                  :min="0"
                  size="small"
                  style="width: 100px"
                />
                <el-radio-group v-model="setting.hpRecoveryMode" size="small">
                  <el-radio-button label="rest">休息</el-radio-button>
                  <el-radio-button label="medicine">吃藥</el-radio-button>
                </el-radio-group>
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="SP 極限 (保護)">
              <div style="display: flex; gap: 8px; align-items: center">
                <el-input-number
                  v-model="setting.sp"
                  :min="0"
                  size="small"
                  style="width: 100px"
                />
                <el-radio-group v-model="setting.spRecoveryMode" size="small">
                  <el-radio-button label="rest">休息</el-radio-button>
                  <el-radio-button label="medicine">吃藥</el-radio-button>
                </el-radio-group>
              </div>
            </el-descriptions-item>

            <el-descriptions-item label="允許空手">
              <el-switch v-model="setting.allowEmptyHanded" />
            </el-descriptions-item>
            <el-descriptions-item label="自動休息模式">
              <div style="display: flex; flex-direction: column; gap: 8px">
                <el-switch
                  v-model="setting.autoRest"
                  active-text="啟用"
                  inactive-text="停用"
                  inline-prompt
                />
                <div
                  v-if="setting.autoRest"
                  style="
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    margin-top: 4px;
                  "
                >
                  <span style="font-size: 12px; color: #909399">目標比例:</span>
                  <el-input-number
                    v-model="setting.autoRestPercent"
                    :min="1"
                    :max="100"
                    size="small"
                    style="width: 80px"
                  />
                  <span style="font-size: 12px; color: #909399">%</span>

                  <span
                    style="font-size: 12px; color: #909399; margin-left: 8px"
                    >休息秒數:</span
                  >
                  <el-input-number
                    v-model="setting.autoRestSeconds"
                    :min="0"
                    size="small"
                    style="width: 80px"
                    placeholder="隨機"
                  />
                </div>
              </div>
            </el-descriptions-item>
          </el-descriptions>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px">
        <el-col :span="8">
          <div class="input-label">層數上限 (0為無上限)</div>
          <el-input-number
            v-model="setting.mapLevel"
            :min="0"
            style="width: 100%"
            placeholder="0為無上限"
          />
        </el-col>
        <el-col :span="8">
          <div class="input-label">趕路層數</div>
          <el-input-number
            v-model="setting.runLevel"
            :min="0"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="8">
          <div class="input-label">最低耐久</div>
          <el-input-number
            v-model="setting.weaponDuration"
            :min="0"
            style="width: 100%"
          />
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" class="inner-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header-flex">
          <span>補品設定</span>
          <el-switch v-model="medicineCheckTag" active-text="啟動自動吃藥" />
        </div>
      </template>
      <el-row :gutter="20">
        <el-col :span="12">
          <div class="input-label">HP 補品</div>
          <el-select
            v-model="medicineSetting.medicineHpId"
            placeholder="選擇補品"
            style="width: 100%"
          >
            <el-option
              v-for="(item, index) in medicine"
              :key="index"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-col>
        <el-col :span="12">
          <div class="input-label">每次使用數量</div>
          <el-input-number
            v-model="medicineSetting.medicineHpQuantity"
            :min="1"
            style="width: 100%"
          />
        </el-col>
      </el-row>
    </el-card>

    <div class="log-section" style="margin-top: 20px">
      <el-button
        type="info"
        plain
        @click="toggleBattleInfo"
        style="width: 100%"
      >
        {{ showContent ? "隱藏戰鬥日誌" : "展開戰鬥日誌" }}
      </el-button>
      <div v-show="showContent" class="log-content">
        <div
          v-for="(info, index) in battleInfoList"
          :key="index"
          class="log-item"
        >
          <span class="log-time">[{{ info.time }}]</span>
          <span class="log-msg">{{ info.m }}</span>
        </div>
      </div>
    </div>

    <!-- 最新戰役詳細過程 -->
    <el-card shadow="never" class="inner-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header-flex">
          <span>最新戰役詳細過程</span>
          <el-button
            size="small"
            type="primary"
            plain
            @click="showTimeline = !showTimeline"
          >
            {{ showTimeline ? "隱藏過程" : "展開過程" }}
          </el-button>
        </div>
      </template>
      <div v-show="showTimeline" class="timeline-content">
        <div
          v-if="
            battleTimeline &&
            battleTimeline.lines &&
            battleTimeline.lines.length > 0
          "
        >
          <div class="timeline-summary">
            <el-tag
              :type="battleTimeline.winner === '平局' ? 'warning' : 'success'"
              size="small"
            >
              結果: {{ battleTimeline.winner }}
            </el-tag>
            <el-tag type="info" size="small" style="margin-left: 8px">
              Exp: +{{ battleTimeline.rewards?.exp || 0 }} | Gold: +{{
                battleTimeline.rewards?.gold || 0
              }}
            </el-tag>
          </div>
          <el-scrollbar max-height="300px" class="timeline-lines">
            <div
              v-for="(line, idx) in battleTimeline.lines"
              :key="idx"
              class="timeline-line"
            >
              {{ line }}
            </div>
          </el-scrollbar>
        </div>
        <div v-else class="empty-timeline">暫無最新戰役詳細過程</div>
      </div>
    </el-card>

    <div style="margin-top: 20px">
      <WeaponSelect
        :weapon-list="equippedWeapon"
        :select-weapon-list="selectWeaponList"
        :weapon-check-tag="weaponCheckTag"
        :armor-check-tag="armorCheckTag"
        :equipment-check-tag="equipmentCheckTag"
        @equipment-check="equipmentCheck"
        @update-check-weapon="checkWeapon"
        @update-check-armor="checkArmor"
        @select-weapon="selectWeapons"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, defineProps, defineEmits, computed, watch } from "vue";
import map from "../common/mapping";
import { ElMessage } from "element-plus";
import { VideoPlay, VideoPause } from "@element-plus/icons-vue";
import WeaponSelect from "./WeaponSelect.vue";
import { useAccountStore } from "../store/accountStore";

const props = defineProps({
  userObj: Object,
  profile: Object,
});

const emits = defineEmits(["set-profile"]);

const store = useAccountStore();
const account = computed(() => {
  return store.accounts.find((a) => a.token === props.userObj.token);
});

// 計算屬性直接對齊後台任務狀態與日誌
const scriptStatus = computed(
  () => account.value?.automation.battle.running || false
);
const battleInfoList = computed(
  () => account.value?.automation.battle.logs || []
);
const currentBattleAutomation = computed(
  () => account.value?.automation.battle
);

const showTimeline = ref(false);
const battleTimeline = computed(
  () => account.value?.automation.battle.timeline || null
);

const count = ref(0);
const weaponList = ref([]);
const selectWeaponList = ref([]);

// 本地可變響應式變數，與 UI 輸入進行雙向綁定
const setting = ref({
  hp: 100,
  sp: 150,
  map: "",
  weaponDuration: 20,
  mapLevel: 2,
  runLevel: 0,
  hpRecoveryMode: "rest",
  spRecoveryMode: "rest",
  allowEmptyHanded: false,
  autoRest: false,
  autoRestPercent: 90,
  autoRestSeconds: 0,
});

// 採礦狀態對應 tag 顏色
const miningStatusTag = computed(() => {
  switch (props.profile?.actionStatus) {
    case "採礦":
      return "warning";
    case "移動":
      return "";
    case "休息":
      return "success";
    case "鍛造":
      return "info";
    default:
      return "";
  }
});

const medicineSetting = ref({
  medicineHpId: "",
  medicineSpId: "",
  medicineHpQuantity: 0,
  medicineSpQuantity: 0,
});

const medicineCheckTag = ref(true);
const weaponCheckTag = ref(true);
const armorCheckTag = ref(false);
const equipmentCheckTag = ref(true);

const items = ref({ items: [], equipments: [] });

// 防止 store→local 和 local→store 互相觸發的防護 flag
const isUpdatingFromStore = ref(false);

// 當更換帳號或後台狀態更新時，同步寫入本地綁定變數
watch(
  currentBattleAutomation,
  (newVal) => {
    if (newVal) {
      isUpdatingFromStore.value = true;
      setting.value.hp = newVal.setting.hp;
      setting.value.sp = newVal.setting.sp;
      setting.value.map = newVal.setting.map;
      setting.value.weaponDuration = newVal.setting.weaponDuration;
      setting.value.mapLevel = newVal.setting.mapLevel;
      setting.value.runLevel = newVal.setting.runLevel;
      setting.value.hpRecoveryMode = newVal.setting.hpRecoveryMode || "rest";
      setting.value.spRecoveryMode = newVal.setting.spRecoveryMode || "rest";
      setting.value.allowEmptyHanded = newVal.setting.allowEmptyHanded ?? false;
      setting.value.autoRest = newVal.setting.autoRest ?? false;
      setting.value.autoRestPercent = newVal.setting.autoRestPercent ?? 90;
      setting.value.autoRestSeconds = newVal.setting.autoRestSeconds ?? 0;

      medicineSetting.value.medicineHpId = newVal.medicineSetting.medicineHpId;
      medicineSetting.value.medicineSpId = newVal.medicineSetting.medicineSpId;
      medicineSetting.value.medicineHpQuantity =
        newVal.medicineSetting.medicineHpQuantity;
      medicineSetting.value.medicineSpQuantity =
        newVal.medicineSetting.medicineSpQuantity;

      medicineCheckTag.value = newVal.medicineCheckTag;
      weaponCheckTag.value = newVal.weaponCheckTag;
      armorCheckTag.value = newVal.armorCheckTag;
      equipmentCheckTag.value = newVal.equipmentCheckTag;
      // 用 nextTick 延遲釋放 flag，確保本次寫入完成後才允許反向同步
      setTimeout(() => {
        isUpdatingFromStore.value = false;
      }, 0);
    }
  },
  { immediate: true, deep: true }
);

// 當 UI 修改設定時，自動同步回 Store 的帳號物件（也會自動寫入 LocalStorage）
watch(
  [
    setting,
    medicineSetting,
    medicineCheckTag,
    weaponCheckTag,
    armorCheckTag,
    equipmentCheckTag,
  ],
  () => {
    // 如果是 store 主動寫入本地則跳過，避免觸發鬼角更新
    if (isUpdatingFromStore.value) return;
    if (account.value) {
      const battleAuto = account.value.automation.battle;
      battleAuto.setting.hp = setting.value.hp;
      battleAuto.setting.sp = setting.value.sp;
      battleAuto.setting.map = setting.value.map;
      battleAuto.setting.weaponDuration = setting.value.weaponDuration;
      battleAuto.setting.mapLevel = setting.value.mapLevel;
      battleAuto.setting.runLevel = setting.value.runLevel;
      battleAuto.setting.hpRecoveryMode = setting.value.hpRecoveryMode;
      battleAuto.setting.spRecoveryMode = setting.value.spRecoveryMode;
      battleAuto.setting.allowEmptyHanded = setting.value.allowEmptyHanded;
      battleAuto.setting.autoRest = setting.value.autoRest;
      battleAuto.setting.autoRestPercent = setting.value.autoRestPercent;
      battleAuto.setting.autoRestSeconds = setting.value.autoRestSeconds;

      battleAuto.medicineSetting.medicineHpId =
        medicineSetting.value.medicineHpId;
      battleAuto.medicineSetting.medicineSpId =
        medicineSetting.value.medicineSpId;
      battleAuto.medicineSetting.medicineHpQuantity =
        medicineSetting.value.medicineHpQuantity;
      battleAuto.medicineSetting.medicineSpQuantity =
        medicineSetting.value.medicineSpQuantity;

      battleAuto.medicineCheckTag = medicineCheckTag.value;
      battleAuto.weaponCheckTag = weaponCheckTag.value;
      battleAuto.armorCheckTag = armorCheckTag.value;
      battleAuto.equipmentCheckTag = equipmentCheckTag.value;
    }
  },
  { deep: true }
);

const medicine = computed(() => {
  return items.value.items
    .filter((item: any) => item.type === "consumable")
    .map((item: any) => ({
      name: `${item.name} (${item.quantity})`,
      id: item.item_id,
    }));
});

const setWeapon = async () => {
  try {
    const res = await props.userObj.item();
    if (res) {
      items.value = res;
      weaponList.value = res.equipments;
    }
  } catch (e) {
    console.error("載入裝備與道具清單失敗", e);
  }
};

const equippedWeapon = computed(() => {
  return weaponList.value
    .filter((weapon) => weapon.status == "已裝備")
    .map((weapon) => {
      const { id, name, durability, fullDurability } = weapon;
      return { id, name, durability, fullDurability };
    });
});

const selectWeapons = (weapons) => {
  selectWeaponList.value = weapons;
};

const equipmentCheck = () => {
  equipmentCheckTag.value = !equipmentCheckTag.value;
};
const checkWeapon = () => {
  weaponCheckTag.value = !weaponCheckTag.value;
};
const checkArmor = () => {
  armorCheckTag.value = !armorCheckTag.value;
};

const showContent = ref(false);
const toggleBattleInfo = () => {
  showContent.value = !showContent.value;
};

const handleAutoBattle = async () => {
  if (!setting.value.map) {
    ElMessage.warning("請先選擇目標地圖");
    return;
  }
  store.startBattle(props.userObj.token);
  ElMessage.success("自動戰鬥背景任務已啟動");
};

const handleStop = () => {
  store.stopBattle(props.userObj.token);
  ElMessage.info("自動戰鬥背景任務已停止");
};

onMounted(async () => {
  await setWeapon();
});
</script>

<style scoped>
.auto-battle-module {
  display: flex;
  flex-direction: column;
}

.inner-card {
  background-color: #141619 !important;
  border: 1px solid #2d2f31 !important;
}

.button-group {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.input-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 600;
}

.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  color: #00cdf0;
}

.timeline-content {
  padding: 8px 0;
}

.timeline-summary {
  margin-bottom: 12px;
}

.timeline-lines {
  background-color: #000;
  border-radius: 6px;
  padding: 12px;
  font-family: "Fira Code", monospace;
  font-size: 12px;
  border: 1px solid #2d2f31;
}

.timeline-line {
  line-height: 1.6;
  color: #fff;
  white-space: pre-wrap;
  margin-bottom: 4px;
}

.empty-timeline {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px 0;
  font-size: 13px;
}
</style>
