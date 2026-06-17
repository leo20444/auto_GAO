<template>
  <div class="auto-mine-module">
    <el-card shadow="never" class="inner-card">
      <el-row :gutter="20" align="middle">
        <el-col :span="8">
          <div class="input-label">選擇採礦區域</div>
          <el-select
            v-model="miningSetting.zone"
            placeholder="請選擇礦區"
            style="width: 100%"
          >
            <el-option label="森林區 (木材)" value="forest" />
            <el-option label="鐵礦山 (鐵礦)" value="iron_mine" />
            <el-option label="阿嬤寶山 (稀有)" value="grandma" />
          </el-select>
        </el-col>
        <el-col :span="8">
          <div class="input-label">設定採礦時間 (分鐘)</div>
          <el-input-number
            v-model="miningSetting.duration"
            :min="15"
            placeholder="最小 15 分鐘"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="8" class="button-group">
          <el-button
            type="success"
            size="large"
            @click="handleStartMining"
            :disabled="running"
            style="width: 48%"
            >啟動</el-button
          >
          <el-button
            type="danger"
            size="large"
            @click="handleStopMining"
            :disabled="!running"
            style="width: 48%"
            >停止</el-button
          >
        </el-col>
      </el-row>
    </el-card>

    <!-- 狀態與進度 -->
    <el-card shadow="never" class="inner-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header-flex">
          <span>採礦進度</span>
          <el-space>
            <el-tag :type="running ? 'success' : 'info'">{{
              running ? "自動採礦運行中" : "自動採礦已停止"
            }}</el-tag>
            <el-tag :type="activeMining ? 'warning' : 'info'">{{
              activeMining ? `採礦中 (${activeZoneName})` : "採礦閒置"
            }}</el-tag>
            <el-button
              v-if="activeMining"
              type="warning"
              size="small"
              :loading="forceStopLoading"
              @click="handleCollectAndStop"
            >
              收割結算
            </el-button>
          </el-space>
        </div>
      </template>

      <el-row :gutter="20" align="middle" justify="center">
        <el-col :span="10" style="text-align: center">
          <el-progress
            type="circle"
            :percentage="progressPercent"
            :status="progressPercent >= 100 ? 'success' : ''"
            :width="150"
          >
            <template #default="{ percentage }">
              <div class="progress-inner">
                <span class="percentage-value">{{ percentage }}%</span>
                <span class="percentage-label">{{ countdownText }}</span>
              </div>
            </template>
          </el-progress>
        </el-col>
        <el-col :span="14">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="採礦狀態">
              <el-tag :type="activeMining ? 'warning' : 'info'">{{
                activeMining ? `採礦中 (${activeZoneName})` : "閒置中"
              }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="已採時間">
              {{ formattedElapsed }}
            </el-descriptions-item>
            <el-descriptions-item label="目標時間">
              {{ Math.floor(limitSeconds / 60) }} 分鐘
            </el-descriptions-item>
            <el-descriptions-item label="離收割還差">
              <span
                :style="{
                  color: progressPercent >= 100 ? '#67c23a' : '#e6a23c',
                  fontWeight: 'bold',
                }"
              >
                {{ countdownText }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="!activeMining && !running"
              label="操作提示"
            >
              <span style="font-size: 12px; color: #909399"
                >目前閒置，點擊「啟動」開始自動採礦循環</span
              >
            </el-descriptions-item>
          </el-descriptions>
        </el-col>
      </el-row>
    </el-card>

    <!-- 採礦日誌 -->
    <div class="log-section" style="margin-top: 20px">
      <el-button
        type="info"
        plain
        @click="showLogs = !showLogs"
        style="width: 100%"
      >
        {{ showLogs ? "隱藏採礦日誌" : "展開採礦日誌" }}
      </el-button>
      <div v-show="showLogs" class="log-content">
        <div v-for="(info, index) in logs" :key="index" class="log-item">
          <span class="log-time">[{{ info.time }}]</span>
          <span class="log-msg">{{ info.m }}</span>
        </div>
        <div v-if="logs.length === 0" style="color: #666; text-align: center">
          暫無採礦日誌
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineProps } from "vue";
import { ElMessage } from "element-plus";
import { useAccountStore } from "../store/accountStore";

const props = defineProps({
  userObj: {
    type: Object,
    required: true,
  },
});

const store = useAccountStore();
const account = computed(() => {
  return store.accounts.find((a) => a.token === props.userObj.token);
});

const running = computed(
  () => account.value?.automation.mining.running || false
);
const logs = computed(() => account.value?.automation.mining.logs || []);

const miningSetting = ref({
  zone: "forest",
  duration: 15,
});

// 當更換帳號時，同步設定
watch(
  account,
  (newVal) => {
    if (newVal?.automation.mining.setting) {
      miningSetting.value.zone = newVal.automation.mining.setting.zone;
      miningSetting.value.duration = newVal.automation.mining.setting.duration;
    }
  },
  { immediate: true, deep: true }
);

// 當 UI 修改時，同步回 store
watch(
  miningSetting,
  (newVal) => {
    if (account.value) {
      account.value.automation.mining.setting.zone = newVal.zone;
      account.value.automation.mining.setting.duration = newVal.duration;
    }
  },
  { deep: true }
);

const showLogs = ref(true);
const activeMining = ref(false);
const activeZone = ref("");
const elapsed = ref(0);
const required = ref(900);

const activeZoneName = computed(() => {
  if (activeZone.value === "forest") return "森林區";
  if (activeZone.value === "iron_mine") return "鐵礦山";
  if (activeZone.value === "grandma") return "阿嬤寶山";
  return activeZone.value || "未知";
});

const formattedElapsed = computed(() => {
  const m = Math.floor(elapsed.value / 60);
  const s = elapsed.value % 60;
  return `${m} 分 ${s} 秒`;
});

const limitSeconds = computed(() => {
  const target = miningSetting.value.duration * 60;
  return Math.max(target, required.value);
});

const countdownText = computed(() => {
  if (!activeMining.value) return "--:--";
  const rem = Math.max(0, limitSeconds.value - elapsed.value);
  if (rem === 0) return "可收割";
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
});

const progressPercent = computed(() => {
  if (!activeMining.value || !limitSeconds.value) return 0;
  const pct = Math.round((elapsed.value / limitSeconds.value) * 100);
  return Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct));
});

let statusTimer: ReturnType<typeof setInterval> | null = null;

const updateStatus = async () => {
  try {
    const status = await props.userObj.getMineStatus();
    if (status) {
      activeMining.value = status.active || false;
      activeZone.value = status.zone || "";
      elapsed.value = status.elapsedSeconds || 0;
      required.value = status.requiredSeconds || 900;
    }
  } catch (e) {
    console.error("更新採礦狀態失敗", e);
  }
};

const forceStopLoading = ref(false);

const handleStartMining = () => {
  store.startMining(props.userObj.token);
};

const handleStopMining = () => {
  store.stopMining(props.userObj.token);
};

// 收割結算：收割礦物並停止自動採礦迴圈
const handleCollectAndStop = async () => {
  forceStopLoading.value = true;
  try {
    const res = await props.userObj.collectMine();
    if (res) {
      const rewardsStr =
        res.rewards?.map((r: any) => `${r.name} x${r.quantity}`).join("、") ||
        "無";
      ElMessage.success(`收割成功！獲得：${rewardsStr}`);
    } else {
      ElMessage.warning("收割失敗，可能尚未達到最低採礦時間");
    }
    store.stopMining(props.userObj.token);
    await updateStatus();
  } catch (e) {
    ElMessage.error("收割時發生錯誤");
  } finally {
    forceStopLoading.value = false;
  }
};

onMounted(async () => {
  await updateStatus();
  statusTimer = setInterval(updateStatus, 8000); // UI 每 8 秒更新一次狀態
});

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer);
});
</script>

<style scoped>
.auto-mine-module {
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
  gap: 10px;
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
.progress-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.percentage-value {
  font-size: 20px;
  font-weight: bold;
  color: #00cdf0;
}
.percentage-label {
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
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
</style>
