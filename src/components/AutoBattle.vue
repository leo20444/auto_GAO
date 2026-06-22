<template>
  <div class="auto-battle-module">
    <el-card shadow="never" class="inner-card">
      <el-row :gutter="20" align="middle">
        <el-col
          :xs="24"
          :sm="8"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
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
        <el-col :xs="24" :sm="16" class="button-group">
          <el-button
            type="success"
            size="large"
            :icon="VideoPlay"
            @click="handleAutoBattle"
            :disabled="scriptStatus"
            style="flex: 1"
            >啟動自動戰鬥</el-button
          >
          <el-button
            type="danger"
            size="large"
            :icon="VideoPause"
            @click="handleStop"
            :disabled="!scriptStatus"
            style="flex: 1"
            >停止</el-button
          >
        </el-col>
      </el-row>

      <!-- 執行與日誌設定 -->
      <el-row
        v-if="setting.partyMode.enabled && !setting.partyMode.isLeader"
        style="margin-top: 15px"
      >
        <el-col :span="24">
          <el-alert
            title="您目前是組隊成員（隊員），執行模式與樓層關卡上限由隊長端統一主導，您的帳號將自動配合與跟隨。"
            type="info"
            show-icon
            :closable="false"
          />
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 15px" align="middle">
        <el-col :xs="16" :sm="10">
          <div class="input-label">日誌更新</div>
          <el-radio-group
            v-model="setting.refreshMode"
            size="default"
            class="full-width-radio-group"
          >
            <el-radio-button label="auto">自動</el-radio-button>
            <el-radio-button label="manual">手動</el-radio-button>
          </el-radio-group>
        </el-col>
        <el-col :xs="8" :sm="6">
          <div class="input-label" style="opacity: 0; pointer-events: none">
            刷新
          </div>
          <el-button
            type="primary"
            plain
            size="default"
            @click="handleManualRefresh"
            :loading="manualRefreshing"
            style="width: 100%"
          >
            刷新
          </el-button>
        </el-col>
        <el-col
          :xs="24"
          :sm="8"
          style="
            display: flex;
            flex-direction: column;
            gap: 8px;
            justify-content: flex-end;
            padding-top: 15px;
          "
          class="battle-log-checkboxes"
        >
          <el-checkbox
            v-model="setting.enableLogs"
            style="margin: 0; height: 18px; line-height: 18px"
          >
            啟用戰鬥日誌
          </el-checkbox>
          <el-checkbox
            v-model="setting.enableTimeline"
            style="margin: 0; height: 18px; line-height: 18px"
          >
            啟用戰報詳細過程 (Timeline)
          </el-checkbox>
        </el-col>
      </el-row>

      <el-divider border-style="dashed" />

      <el-row :gutter="20">
        <el-col :xs="24" :sm="12">
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
              <span style="display: flex; flex-wrap: wrap; gap: 4px">
                <el-tag
                  v-for="status in props.profile?.activeStatuses || [
                    props.profile?.actionStatus || '空閒',
                  ]"
                  :key="status"
                  :type="statusTagType(status)"
                  size="small"
                >
                  {{ status }}
                </el-tag>
              </span>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="(props.profile?.activeStatuses || []).includes('採礦')"
              label="採礦詳情"
            >
              <span style="font-size: 12px; color: #e6a23c">
                正在採礦中，自動戰鬥暫停等待
              </span>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="(props.profile?.activeStatuses || []).includes('移動')"
              label="移動詳情"
            >
              <span style="font-size: 12px; color: #409eff">
                移動至 {{ props.profile?.zoneName || "..." }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="(props.profile?.activeStatuses || []).includes('休息')"
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
        <el-col :xs="24" :sm="12" class="protection-settings-col">
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
            <el-descriptions-item label="單人自動刷王">
              <el-radio-group v-model="setting.bossSoloMode" size="small">
                <el-radio-button label="none">不打王</el-radio-button>
                <el-radio-button label="pass">路過打王</el-radio-button>
                <el-radio-button label="wait">原地打王</el-radio-button>
              </el-radio-group>
            </el-descriptions-item>
            <el-descriptions-item label="啟用轉移水晶">
              <el-switch v-model="setting.useTeleportCrystal" />
            </el-descriptions-item>
          </el-descriptions>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px">
        <el-col
          :xs="24"
          :sm="8"
          v-if="!setting.partyMode.enabled"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">層數上限 (0為無上限)</div>
          <el-input-number
            v-model="setting.mapLevel"
            :min="0"
            style="width: 100%"
            placeholder="0為無上限"
          />
        </el-col>
        <el-col
          :xs="24"
          :sm="8"
          v-if="!setting.partyMode.enabled"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">趕路層數</div>
          <el-input-number
            v-model="setting.runLevel"
            :min="0"
            style="width: 100%"
          />
        </el-col>
        <el-col :xs="24" :sm="!setting.partyMode.enabled ? 8 : 24">
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
          <span>組隊模式設定</span>
          <el-switch
            v-model="setting.partyMode.enabled"
            active-text="啟用組隊模式"
          />
        </div>
      </template>
      <el-row :gutter="20" v-if="setting.partyMode.enabled">
        <el-col
          :xs="12"
          :sm="6"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">我的身分</div>
          <el-switch
            v-model="setting.partyMode.isLeader"
            active-text="我是隊長"
            inactive-text="我是隊員"
            inline-prompt
          />
        </el-col>
        <template v-if="setting.partyMode.isLeader">
          <el-col
            :xs="12"
            :sm="6"
            style="margin-bottom: 10px; sm-margin-bottom: 0"
          >
            <div class="input-label">隊伍層數上限 (0為無上限)</div>
            <el-input-number
              v-model="setting.partyMode.maxFloor"
              :min="0"
              style="width: 100%"
              placeholder="0為無上限"
            />
            <div
              style="
                font-size: 11px;
                color: #909399;
                margin-top: 4px;
                line-height: 1.3;
              "
            >
              ※ 抵達該層直接回村。
            </div>
          </el-col>
          <el-col
            :xs="12"
            :sm="6"
            style="margin-bottom: 10px; sm-margin-bottom: 0"
          >
            <div class="input-label">隊伍趕路層數</div>
            <el-input-number
              v-model="setting.partyMode.runLevel"
              :min="0"
              style="width: 100%"
            />
            <div
              style="
                font-size: 11px;
                color: #909399;
                margin-top: 4px;
                line-height: 1.3;
              "
            >
              ※ 低於該層趕路，否則戰鬥。
            </div>
          </el-col>
          <el-col
            :xs="12"
            :sm="6"
            style="margin-bottom: 10px; sm-margin-bottom: 0"
          >
            <div class="input-label">組員最低耐久</div>
            <el-input-number
              v-model="setting.partyMode.minDurability"
              :min="0"
              style="width: 100%"
            />
          </el-col>
        </template>
      </el-row>
      <el-row
        :gutter="20"
        v-if="setting.partyMode.enabled && setting.partyMode.isLeader"
        style="margin-top: 12px"
      >
        <el-col :span="24">
          <el-checkbox v-model="setting.partyMode.allowEmptyHanded">
            允許組員空手 (當無可用武器時)
          </el-checkbox>
          <el-tooltip
            content="啟用後，隊長會額外檢查並等待非我方託管的隊友就緒；未啟用時，將只巡檢我方託管的組員，避免因路人狀態不佳導致隊伍卡死。"
            placement="top"
          >
            <el-checkbox
              v-model="setting.partyMode.hasExternalMembers"
              style="margin-left: 20px"
            >
              包含非託管組員 (隊外玩家)
            </el-checkbox>
          </el-tooltip>
          <el-tooltip
            content="啟用後，隊長挑戰不等待隊員。若有隊友死亡，隊員復活後在 1 樓待命，直到隊長下次重新從 1 樓爬塔時自動歸隊。"
            placement="top"
          >
            <el-checkbox
              v-model="setting.partyMode.ignoreMemberStatus"
              style="margin-left: 20px"
            >
              無視隊友狀態 (孤狼帶隊)
            </el-checkbox>
          </el-tooltip>
          <el-tooltip
            content="抵達地圖王關時自動在該層暫停自動戰鬥以便手動挑戰。大草原30F、猛牛園25F、兒童樂園18F、蘑菇園24F、圓明園20F。"
            placement="top"
          >
            <el-checkbox
              v-model="setting.partyMode.stopAtBoss"
              style="margin-left: 20px"
            >
              王關停留
            </el-checkbox>
          </el-tooltip>
        </el-col>
      </el-row>
      <el-row
        :gutter="20"
        v-if="
          setting.partyMode.enabled &&
          setting.partyMode.isLeader &&
          !setting.partyMode.ignoreMemberStatus
        "
        style="margin-top: 12px"
      >
        <el-col :span="24">
          <div
            class="input-label"
            style="display: inline-block; margin-right: 15px; font-weight: bold"
          >
            隊友死亡回城後續行為
          </div>
          <el-radio-group v-model="setting.partyMode.deathPolicy">
            <el-radio label="idle">隊伍原地暫停等待</el-radio>
            <el-radio label="rerun">全員同步回城重跑</el-radio>
          </el-radio-group>
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
        <el-col
          :xs="24"
          :sm="12"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">HP 補品</div>
          <el-select
            v-model="medicineSetting.medicineHpId"
            placeholder="選擇補品"
            style="width: 100%"
          >
            <el-option
              v-for="(item, index) in hpMedicines"
              :key="index"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12">
          <div class="input-label">每次使用數量</div>
          <el-input-number
            v-model="medicineSetting.medicineHpQuantity"
            :min="1"
            style="width: 100%"
          />
        </el-col>
      </el-row>
      <el-row :gutter="20" style="margin-top: 15px">
        <el-col
          :xs="24"
          :sm="12"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">SP 補品</div>
          <el-select
            v-model="medicineSetting.medicineSpId"
            placeholder="選擇補品"
            style="width: 100%"
          >
            <el-option
              v-for="(item, index) in spMedicines"
              :key="index"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12">
          <div class="input-label">每次使用數量</div>
          <el-input-number
            v-model="medicineSetting.medicineSpQuantity"
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
          <div>
            <el-button
              v-if="battleTimeline && showTimeline"
              size="small"
              type="danger"
              plain
              style="margin-right: 8px"
              @click="handleClearTimeline"
            >
              清除詳細過程
            </el-button>
            <el-button
              size="small"
              type="primary"
              plain
              @click="showTimeline = !showTimeline"
            >
              {{ showTimeline ? "隱藏過程" : "展開過程" }}
            </el-button>
          </div>
        </div>
      </template>
      <div v-if="showTimeline" class="timeline-content">
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
        :weapon-list="weaponList"
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

// 直接從 store 讀取裝備清單，確保「立即重新整理」後自動更新
const weaponList = computed(() => {
  const list = account.value?.items?.equipments || [];
  return list;
});
const items = computed(() => ({
  items: account.value?.items?.items || [],
  equipments: account.value?.items?.equipments || [],
}));
const selectWeaponList = ref([]);

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
  bossSoloMode: "none",
  useTeleportCrystal: false,
  enableLogs: true,
  enableTimeline: true,
  refreshMode: "auto",
  partyMode: {
    enabled: false,
    isLeader: false,
    maxFloor: 0,
    runLevel: 0,
    minDurability: 10,
    allowEmptyHanded: false,
    ignoreMemberStatus: false,
    stopAtBoss: false,
    deathPolicy: "idle",
  },
});

// 各狀態對應 tag 顏色
const statusTagType = (status: string) => {
  switch (status) {
    case "採礦":
      return "warning";
    case "移動":
      return "";
    case "休息":
      return "success";
    case "鍛造":
      return "info";
    case "戰鬥":
      return "danger";
    default:
      return "";
  }
};

const medicineSetting = ref({
  medicineHpId: "",
  medicineSpId: "",
  medicineHpQuantity: 0,
  medicineSpQuantity: 0,
});

const medicineCheckTag = ref(false);
const weaponCheckTag = ref(true);
const armorCheckTag = ref(false);
const equipmentCheckTag = ref(true);

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
      setting.value.bossSoloMode = newVal.setting.bossSoloMode ?? "none";
      setting.value.useTeleportCrystal =
        newVal.setting.useTeleportCrystal ?? false;
      selectWeaponList.value = newVal.selectedWeaponQueue || [];
      setting.value.partyMode = {
        enabled: newVal.setting.partyMode?.enabled ?? false,
        isLeader: newVal.setting.partyMode?.isLeader ?? false,
        maxFloor: newVal.setting.partyMode?.maxFloor ?? 0,
        runLevel: newVal.setting.partyMode?.runLevel ?? 0,
        minDurability: newVal.setting.partyMode?.minDurability ?? 10,
        allowEmptyHanded: newVal.setting.partyMode?.allowEmptyHanded ?? false,
        ignoreMemberStatus:
          newVal.setting.partyMode?.ignoreMemberStatus ?? false,
        stopAtBoss: newVal.setting.partyMode?.stopAtBoss ?? false,
        deathPolicy: newVal.setting.partyMode?.deathPolicy || "idle",
      };

      setting.value.enableLogs = newVal.setting.enableLogs ?? true;
      setting.value.enableTimeline = newVal.setting.enableTimeline ?? true;
      setting.value.refreshMode = newVal.setting.refreshMode || "auto";

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
      battleAuto.setting.bossSoloMode = setting.value.bossSoloMode;
      battleAuto.setting.useTeleportCrystal = setting.value.useTeleportCrystal;
      battleAuto.setting.enableLogs = setting.value.enableLogs;
      battleAuto.setting.enableTimeline = setting.value.enableTimeline;
      battleAuto.setting.refreshMode = setting.value.refreshMode;
      battleAuto.setting.partyMode = {
        enabled: setting.value.partyMode.enabled,
        isLeader: setting.value.partyMode.isLeader,
        maxFloor: setting.value.partyMode.maxFloor,
        runLevel: setting.value.partyMode.runLevel,
        minDurability: setting.value.partyMode.minDurability,
        allowEmptyHanded: setting.value.partyMode.allowEmptyHanded,
        ignoreMemberStatus: setting.value.partyMode.ignoreMemberStatus,
        stopAtBoss: setting.value.partyMode.stopAtBoss,
        deathPolicy: setting.value.partyMode.deathPolicy,
      };

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

const hpMedicines = computed(() => {
  return items.value.items
    .filter((item: any) => {
      const effect = item.effect;
      if (!effect) return false;
      const effectType = effect.type;
      // 只允許 HP 恢復類道具
      if (effectType === "hp") return true;
      if (effectType === "restore" && (effect.hp ?? 0) > 0) return true;
      return false;
    })
    .map((item: any) => ({
      name: `${item.name} (${item.quantity})`,
      id: item.item_id,
    }));
});

const spMedicines = computed(() => {
  return items.value.items
    .filter((item: any) => {
      const effect = item.effect;
      if (!effect) return false;
      const effectType = effect.type;
      // 只允許 MP/SP 恢復類道具
      if (effectType === "mp") return true;
      if (effectType === "restore" && (effect.mp ?? 0) > 0) return true;
      return false;
    })
    .map((item: any) => ({
      name: `${item.name} (${item.quantity})`,
      id: item.item_id,
    }));
});

const setWeapon = async () => {
  // 主動呼叫一次 API 取得最新裝備，並更新至 store
  try {
    const res = await props.userObj.item();
    if (res && account.value) {
      account.value.items.equipments = res.equipments || [];
      account.value.items.items = res.items || [];
    }
  } catch (e) {
    console.error("載入裝備與道具清單失敗", e);
  }
};

const equippedWeapon = computed(() => {
  return weaponList.value
    .filter((weapon: any) => weapon.status == "已裝備")
    .map((weapon: any) => {
      const { id, name, durability, fullDurability } = weapon;
      return { id, name, durability, fullDurability };
    });
});

const selectWeapons = (weapons) => {
  selectWeaponList.value = weapons;
  // 同步存入 store，讓自動戰鬥後台循環能讀取使用者選好的武器佇列
  if (account.value) {
    account.value.automation.battle.selectedWeaponQueue = [...weapons];
  }
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

const handleClearTimeline = () => {
  if (account.value) {
    account.value.automation.battle.timeline = null;
    account.value.automation.battle.lastTimelineCheckKey = "";
  }
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

const manualRefreshing = ref(false);
const handleManualRefresh = async () => {
  if (!props.userObj || !account.value) return;
  manualRefreshing.value = true;
  try {
    await store.refreshAccountState(account.value, true);
    if (setting.value.enableTimeline && account.value.profile?.huntStage > 0) {
      const timelineRes = await props.userObj.getTimeline();
      if (timelineRes && account.value) {
        account.value.automation.battle.timeline = timelineRes;
      }
    } else if (account.value) {
      account.value.automation.battle.timeline = null;
    }
    ElMessage.success("日誌與戰況資料重新整理完成");
  } catch (error) {
    console.error("手動刷新失敗:", error);
    ElMessage.error("重新整理失敗");
  } finally {
    manualRefreshing.value = false;
  }
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

.full-width-radio-group {
  display: inline-flex;
  width: 100%;
}
.full-width-radio-group :deep(.el-radio-button) {
  flex: 1;
}
.full-width-radio-group :deep(.el-radio-button__inner) {
  width: 100%;
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
