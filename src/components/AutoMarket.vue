<template>
  <div class="auto-market-module">
    <el-card shadow="never" class="inner-card">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="8" style="margin-bottom: 12px">
          <div
            class="input-label"
            style="display: flex; align-items: center; gap: 8px"
          >
            <el-checkbox v-model="marketSetting.onlyBuyFromSeller"
              >指定購買賣家</el-checkbox
            >
            <el-tooltip
              content="勾選後，系統只會購買該賣家的商品。若未勾選則視為不限制賣家。啟用了此選項但沒填寫賣家名稱時會觸發啟動防呆攔截。"
              placement="top"
            >
              <el-icon style="cursor: pointer; color: #909399"
                ><InfoFilled
              /></el-icon>
            </el-tooltip>
          </div>
          <el-input
            v-model="marketSetting.sellerName"
            placeholder="例如：玩家名稱 (請先勾選指定)"
            :disabled="!marketSetting.onlyBuyFromSeller"
            clearable
          />
        </el-col>
        <el-col :xs="24" :sm="8" style="margin-bottom: 12px">
          <div class="input-label">設定最高購買單價</div>
          <el-input-number
            v-model="marketSetting.priceLimit"
            :min="0"
            :step="100"
            placeholder="設定 0 代表無金額限制"
            style="width: 100%"
          />
        </el-col>
        <el-col :xs="24" :sm="8" style="margin-bottom: 12px">
          <div class="input-label">單次最大購買數量限制</div>
          <el-input-number
            v-model="marketSetting.maxPurchaseQty"
            :min="0"
            placeholder="設定 0 代表購買全數"
            style="width: 100%"
          />
        </el-col>
      </el-row>
      <el-row :gutter="20" align="middle" style="margin-top: 10px">
        <el-col :xs="24" :sm="8" style="margin-bottom: 12px">
          <div class="input-label">掃描頻率間隔 (秒)</div>
          <el-input-number
            v-model="marketSetting.interval"
            :min="5"
            placeholder="預設 5 秒"
            style="width: 100%"
          />
        </el-col>
        <el-col :xs="24" :sm="8" style="margin-bottom: 12px">
          <div class="input-label" style="display: flex; align-items: center">
            啟用防攔截拆單購買
            <el-tooltip
              content="啟用後，購買數量大於 3 時會自動拆成多筆小訂單隨機發送，並在每筆請求間加入隨機延遲，模擬人類行為以避開防 Bot 攔截。"
              placement="top"
            >
              <el-icon style="margin-left: 4px; cursor: pointer; color: #909399"
                ><InfoFilled
              /></el-icon>
            </el-tooltip>
          </div>
          <el-switch
            v-model="marketSetting.enableSplitPurchase"
            active-text="啟用"
            inactive-text="關閉"
          />
        </el-col>
        <el-col :xs="24" :sm="8" class="button-group" style="margin-top: 12px">
          <el-button
            type="success"
            size="large"
            @click="handleStartMarket"
            :disabled="running"
            style="width: 48%"
            >啟動</el-button
          >
          <el-button
            type="danger"
            size="large"
            @click="handleStopMarket"
            :disabled="!running"
            style="width: 48%"
            >停止</el-button
          >
        </el-col>
      </el-row>
    </el-card>

    <!-- 狀態與日誌 -->
    <el-card shadow="never" class="inner-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header-flex">
          <span>監控日誌</span>
          <el-space>
            <el-tag :type="running ? 'success' : 'info'">{{
              running ? "自動市場搶購中" : "搶購已停止"
            }}</el-tag>
            <el-tag type="warning" v-if="account?.profile?.gold !== undefined"
              >當前金幣: {{ account.profile.gold }}</el-tag
            >
          </el-space>
        </div>
      </template>

      <!-- 日誌文字框 -->
      <div ref="logContainer" class="log-content">
        <div v-if="logs.length === 0" class="log-item" style="color: #666">
          暫無執行日誌，請啟動後觀察...
        </div>
        <div v-for="(log, idx) in logs" :key="idx" class="log-item">
          <span class="log-time">[{{ log.time }}]</span>
          <span
            class="log-msg"
            :style="{
              color: (log.m || '').includes('成功')
                ? '#67C23A'
                : (log.m || '').includes('失敗') ||
                  (log.m || '').includes('出錯')
                ? '#F56C6C'
                : (log.m || '').includes('搶購') ||
                  (log.m || '').includes('購買:')
                ? '#E6A23C'
                : '#00cdf0',
            }"
          >
            {{ log.m }}
          </span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, defineProps } from "vue";
import { useAccountStore } from "../store/accountStore";
import { InfoFilled } from "@element-plus/icons-vue";

defineProps({
  userObj: {
    type: Object,
    required: true,
  },
});

const store = useAccountStore();
const logContainer = ref<HTMLElement | null>(null);

const account = computed(() => {
  if (store.selectedAccountIndex.value === -1) return null;
  return store.accounts[store.selectedAccountIndex.value];
});

const marketSetting = computed(() => {
  return (
    account.value?.automation.market.setting || {
      sellerName: "",
      onlyBuyFromSeller: true,
      priceLimit: 0,
      interval: 5,
      maxPurchaseQty: 0,
      enableSplitPurchase: true,
    }
  );
});

const running = computed(() => {
  return account.value?.automation.market.running || false;
});

const logs = computed(() => {
  return account.value?.automation.market.logs || [];
});

const handleStartMarket = () => {
  if (!account.value) return;
  store.startMarket(account.value.token);
};

const handleStopMarket = () => {
  if (!account.value) return;
  store.stopMarket(account.value.token);
};

// 自動滾動日誌到最底端
watch(
  () => logs.value.length,
  () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  }
);
</script>

<style scoped>
.auto-market-module {
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
.log-content {
  background-color: #000;
  border-radius: 8px;
  padding: 15px;
  height: 250px;
  overflow-y: auto;
  font-family: "Fira Code", monospace;
  font-size: 12px;
  border: 1px solid #2d2f31;
}
.log-item {
  margin-bottom: 6px;
  line-height: 1.4;
}
.log-time {
  color: #555;
  margin-right: 8px;
}
.log-msg {
  color: #00cdf0;
}
</style>
