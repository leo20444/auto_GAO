<template>
  <div class="home-container">
    <div v-if="selectedAccount" class="dashboard-container">
      <div class="dashboard-header">
        <div class="header-left">
          <h1 class="nickname">{{ selectedAccount.profile.nickname }}</h1>
          <el-tag type="info" size="small"
            >LV. {{ selectedAccount.profile.lv }}</el-tag
          >
          <el-tag :type="statusType" size="small" class="status-tag">{{
            selectedAccount.profile.actionStatus
          }}</el-tag>
          <!-- 樂透標籤 -->
          <el-tag
            v-if="getLotteryStatus(selectedAccount)"
            :type="getLotteryStatus(selectedAccount).type"
            :effect="getLotteryStatus(selectedAccount).effect"
            size="small"
            class="status-tag"
            style="margin-left: 6px"
          >
            {{ getLotteryStatus(selectedAccount).text }}
          </el-tag>
          <!-- 等待 BOSS 標籤 -->
          <el-tag
            v-if="getWaitingBossStatus(selectedAccount)"
            :type="getWaitingBossStatus(selectedAccount).type"
            size="small"
            class="status-tag"
            style="margin-left: 6px"
          >
            {{ getWaitingBossStatus(selectedAccount).text }}
          </el-tag>
        </div>
        <div
          class="header-right"
          style="display: flex; gap: 12px; align-items: center"
        >
          <el-button
            type="warning"
            :loading="isLotteryRunning"
            @click="handleOneClickLottery"
            >一鍵樂透</el-button
          >
          <el-button type="primary" plain @click="refreshProfile"
            >立即重新整理</el-button
          >
        </div>
      </div>

      <el-scrollbar class="dashboard-scroll">
        <div class="dashboard-grid">
          <!-- 狀態卡片 3欄式佈局 -->
          <el-row :gutter="20">
            <!-- 角色狀態 -->
            <el-col :xs="24" :sm="24" :md="8">
              <el-card class="module-card header-status-card">
                <template #header>
                  <div class="card-header">
                    <span>角色狀態</span>
                  </div>
                </template>
                <div class="vitals-section">
                  <div class="stat-item">
                    <div class="stat-label">HP</div>
                    <el-progress
                      :percentage="
                        selectedAccount.profile.fullHp
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                (selectedAccount.profile.hp /
                                  selectedAccount.profile.fullHp) *
                                  100
                              )
                            )
                          : 0
                      "
                      status="exception"
                      :stroke-width="14"
                      striped
                      striped-flow
                    >
                      <span
                        >{{ selectedAccount.profile.hp }} /
                        {{ selectedAccount.profile.fullHp }}</span
                      >
                    </el-progress>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">SP</div>
                    <el-progress
                      :percentage="
                        selectedAccount.profile.fullSp
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                (selectedAccount.profile.sp /
                                  selectedAccount.profile.fullSp) *
                                  100
                              )
                            )
                          : 0
                      "
                      :stroke-width="14"
                      striped
                      striped-flow
                    >
                      <span
                        >{{ selectedAccount.profile.sp }} /
                        {{ selectedAccount.profile.fullSp }}</span
                      >
                    </el-progress>
                  </div>
                  <div class="location-info">
                    <el-icon><Location /></el-icon>
                    <span
                      >{{ selectedAccount.profile.zoneName }} ({{
                        selectedAccount.profile.huntStage
                      }}F)</span
                    >
                  </div>
                </div>
              </el-card>
            </el-col>

            <!-- 組隊狀態 -->
            <el-col :xs="24" :sm="24" :md="8">
              <el-card class="module-card header-status-card">
                <template #header>
                  <div class="card-header">
                    <span>組隊狀態</span>
                    <el-tag
                      v-if="
                        selectedAccount.party && selectedAccount.party.party
                      "
                      type="success"
                      size="small"
                      effect="dark"
                    >
                      {{ selectedAccount.party.party.name }}
                    </el-tag>
                    <el-tag v-else type="info" size="small" effect="plain"
                      >無隊伍</el-tag
                    >
                  </div>
                </template>
                <div class="party-section">
                  <div
                    v-if="selectedAccount.party && selectedAccount.party.party"
                  >
                    <div class="party-id">
                      隊伍 ID: {{ selectedAccount.party.party.id }}
                    </div>
                    <div class="party-members-scroll">
                      <div
                        v-for="member in selectedAccount.party.party.members"
                        :key="member.user_id"
                        class="party-member-item"
                      >
                        <div class="member-name-row">
                          <span class="member-name">
                            {{ member.character_name }}
                            <el-badge
                              v-if="
                                member.user_id ===
                                selectedAccount.party.party.leaderId
                              "
                              value="Leader"
                              type="warning"
                              class="leader-badge"
                            />
                          </span>
                          <span class="member-loc">
                            {{ member.current_zone }} ({{ member.floor }}F)
                          </span>
                        </div>
                        <div class="member-bars">
                          <el-progress
                            :percentage="
                              member.max_hp
                                ? Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      (member.hp / member.max_hp) * 100
                                    )
                                  )
                                : 0
                            "
                            status="exception"
                            :stroke-width="5"
                            :show-text="false"
                            class="member-mini-progress"
                          />
                          <el-progress
                            :percentage="
                              member.max_mp
                                ? Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      (member.mp / member.max_mp) * 100
                                    )
                                  )
                                : 0
                            "
                            :stroke-width="5"
                            :show-text="false"
                            class="member-mini-progress"
                          />
                        </div>
                        <div class="member-status-row">
                          <el-tag
                            size="small"
                            :type="
                              member.rest_started_at
                                ? 'success'
                                : member.tower_move_ends_at
                                ? 'warning'
                                : 'info'
                            "
                          >
                            {{
                              member.rest_started_at
                                ? "休息中"
                                : member.tower_move_ends_at
                                ? "移動中"
                                : "空閒"
                            }}
                          </el-tag>
                          <span class="member-hp-text"
                            >{{ member.hp }} / {{ member.max_hp }} HP</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="no-party-info">
                    <span class="empty-text">未加入任何隊伍</span>
                    <div
                      v-if="
                        selectedAccount.party &&
                        selectedAccount.party.invites &&
                        selectedAccount.party.invites.length > 0
                      "
                      class="invites-container"
                    >
                      <div class="invites-title">受邀清單：</div>
                      <div
                        v-for="invite in selectedAccount.party.invites"
                        :key="invite.id"
                        class="invite-item"
                      >
                        <span>隊伍: {{ invite.partyName }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </el-card>
            </el-col>

            <!-- 地圖與探索資訊 -->
            <el-col :xs="24" :sm="24" :md="8">
              <el-card class="module-card header-status-card">
                <template #header>
                  <div class="card-header">
                    <span>地圖與探索資訊</span>
                  </div>
                </template>
                <div class="tower-section">
                  <div v-if="selectedAccount.tower">
                    <div class="tower-detail-item">
                      <span class="detail-label">當前地圖</span>
                      <span class="detail-val">
                        {{
                          selectedAccount.tower.zones?.[
                            selectedAccount.tower.zone
                          ]?.name || selectedAccount.tower.zone
                        }}
                        ({{ selectedAccount.tower.floor }}F)
                      </span>
                    </div>

                    <div
                      v-if="selectedAccount.tower.destinationZone"
                      class="tower-detail-item"
                    >
                      <span class="detail-label">目的地</span>
                      <span class="detail-val warning-text">
                        前往
                        {{
                          selectedAccount.tower.zones?.[
                            selectedAccount.tower.destinationZone
                          ]?.name || selectedAccount.tower.destinationZone
                        }}
                      </span>
                    </div>

                    <div class="tower-tags">
                      <el-tag
                        v-if="selectedAccount.tower.inSecretRealm"
                        type="danger"
                        effect="dark"
                        size="small"
                        >秘徑中</el-tag
                      >
                      <el-tag v-else type="info" size="small">普通地圖</el-tag>
                      <el-tag
                        v-if="
                          selectedAccount.tower.floor ===
                          selectedAccount.tower.bossFloor
                        "
                        type="warning"
                        effect="dark"
                        size="small"
                        >BOSS層</el-tag
                      >
                      <el-tag
                        v-if="selectedAccount.tower.hasBranch"
                        type="success"
                        size="small"
                        >有分支</el-tag
                      >
                      <el-tag
                        v-if="selectedAccount.tower.hasExit"
                        type="info"
                        size="small"
                        >有出口</el-tag
                      >
                    </div>

                    <div class="tower-detail-item">
                      <span class="detail-label">BOSS 樓層</span>
                      <span class="detail-val"
                        >{{ selectedAccount.tower.bossFloor }}F</span
                      >
                    </div>

                    <div
                      v-if="selectedAccount.tower.bossCooldownEndsAt"
                      class="tower-detail-item"
                    >
                      <span class="detail-label">BOSS 冷卻</span>
                      <span class="detail-val warning-text">{{
                        formatTime(selectedAccount.tower.bossCooldownEndsAt)
                      }}</span>
                    </div>
                  </div>
                  <div v-else class="no-tower-info">
                    <span class="empty-text">無地圖資訊</span>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <!-- 自動化模組 -->
          <div class="automation-section">
            <el-tabs v-model="activeTab" type="border-card">
              <el-tab-pane name="battle" label="自動戰鬥">
                <AutoBattle
                  :userObj="selectedAccount.userObj"
                  :profile="selectedAccount.profile"
                  @set-profile="updateProfile"
                />
              </el-tab-pane>
              <el-tab-pane name="forge" label="自動鍛造">
                <AutoForge
                  :userObj="selectedAccount.userObj"
                  :profile="selectedAccount.profile"
                  @set-profile="updateProfile"
                />
              </el-tab-pane>
              <el-tab-pane name="recycle" label="裝備回收">
                <AutoRecycle :userObj="selectedAccount.userObj" />
              </el-tab-pane>
              <el-tab-pane name="mine" label="自動採礦">
                <AutoMine :userObj="selectedAccount.userObj" />
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </el-scrollbar>
    </div>
    <div v-else class="welcome-container">
      <el-empty description="請從左側選擇或新增一個帳號以開始">
        <el-button type="primary" @click="triggerAdd">新增第一個帳號</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import { ElMessage } from "element-plus";
import { useAccountStore } from "../store/accountStore";
import { Location } from "@element-plus/icons-vue";
import AutoBattle from "../components/AutoBattle.vue";
import AutoForge from "../components/AutoForge.vue";
import AutoRecycle from "../components/AutoRecycle.vue";
import AutoMine from "../components/AutoMine.vue";
import moment from "moment";

const store = useAccountStore();
const { selectedAccount, refreshAccount } = store;
const activeTab = ref("battle");

const statusType = computed(() => {
  const status = selectedAccount.value?.profile?.actionStatus;
  if (status === "戰鬥") return "danger";
  if (status === "休息") return "success";
  if (status === "移動") return "warning";
  return "info";
});

const updateProfile = (newProfile) => {
  if (selectedAccount.value) {
    Object.assign(selectedAccount.value.profile, newProfile);
  }
};

const refreshProfile = async () => {
  if (selectedAccount.value) {
    await refreshAccount(selectedAccount.value.token);
  }
};

const triggerAdd = () => {
  alert("請點擊左側邊欄上方的 '+' 按鈕來新增帳號");
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return "";
  return moment(timeStr).format("MM-DD HH:mm:ss");
};

const isLotteryRunning = ref(false);

const handleOneClickLottery = async () => {
  isLotteryRunning.value = true;
  try {
    const res = await store.oneClickLotteryAll();
    ElMessage.success(
      `一鍵樂透執行完畢！成功: ${res.successCount}，失敗: ${res.failCount}`
    );
  } catch (err: any) {
    ElMessage.error(`樂透執行失敗: ${err.message || err}`);
  } finally {
    isLotteryRunning.value = false;
  }
};

const isLotteryReset = (lastTimeStr: string) => {
  if (!lastTimeStr) return true;
  const lastTime = new Date(lastTimeStr);
  const now = new Date();

  const lastOffset = new Date(lastTime.getTime() - 8 * 60 * 60 * 1000);
  const nowOffset = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  const lastDate = `${lastOffset.getFullYear()}-${
    lastOffset.getMonth() + 1
  }-${lastOffset.getDate()}`;
  const nowDate = `${nowOffset.getFullYear()}-${
    nowOffset.getMonth() + 1
  }-${nowOffset.getDate()}`;

  return lastDate !== nowDate;
};

const getLotteryStatus = (acc: any) => {
  if (!acc || !acc.profile) return null;

  if (acc.lotteryProgressState === "處理中") {
    return { text: "樂透: 購買中...", type: "primary", effect: "dark" };
  }
  if (acc.lotteryProgressState?.startsWith("失敗")) {
    return { text: acc.lotteryProgressState, type: "danger", effect: "light" };
  }

  const lotteryConfig = acc.automation?.lottery || {};
  const isCollectReset = isLotteryReset(lotteryConfig.lastCollectedAt);
  const isBuyReset = isLotteryReset(lotteryConfig.lastBoughtAt);

  if (!isCollectReset && !isBuyReset) {
    return { text: "樂透: 已買", type: "success", effect: "plain" };
  }

  return { text: "樂透: 未買", type: "danger", effect: "light" };
};

const getWaitingBossStatus = (acc: any) => {
  if (!acc || !acc.profile || !acc.tower) return null;

  const isBattleRunning = acc.automation?.battle?.running === true;
  const autoChallenge =
    acc.automation?.battle?.setting?.bossSoloMode === "wait";

  if (!isBattleRunning || !autoChallenge) return null;

  const mapMapping: Record<string, number> = {
    起始之鎮: 0,
    starting_town: 0,
    大草原: 1,
    great_plains: 1,
    猛牛園: 2,
    bull_garden: 2,
    bull_pen: 2,
    兒童樂園: 3,
    childrens_park: 3,
    蘑菇園: 4,
    mushroom_garden: 4,
    圓明園: 5,
    yuanmingyuan: 5,
  };

  const zoneName = acc.profile.zoneName;
  const currentMapId = mapMapping[zoneName] || 0;
  const floor = acc.profile.huntStage || 0;

  const bossFloorConfig: Record<number, number> = {
    1: 30,
    2: 25,
    3: 18,
    4: 24,
    5: 20,
  };

  const isBossFloor = bossFloorConfig[currentMapId] === floor && floor > 0;
  if (!isBossFloor) return null;

  const cooldownEnds = acc.tower.bossCooldownEndsAt;
  if (cooldownEnds) {
    const isCd = new Date(cooldownEnds).getTime() > Date.now();
    if (isCd) {
      return { text: "等待BOSS", type: "warning" };
    }
  }
  return null;
};
</script>

<style scoped>
.dashboard-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  padding: 24px 32px;
  background-color: #141619;
  border-bottom: 1px solid #2d2f31;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nickname {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #fff;
}

.status-tag {
  font-weight: 700;
}

.dashboard-scroll {
  flex: 1;
  padding: 32px;
}

.dashboard-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.module-card {
  background-color: #1a1c1e !important;
  border: 1px solid #2d2f31 !important;
  border-radius: 12px !important;
}

.header-status-card {
  height: 250px;
  display: flex;
  flex-direction: column;
}

.header-status-card :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.header-status-card :deep(.el-card__header) {
  padding: 12px 16px;
  border-bottom: 1px solid #2d2f31;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: bold;
  color: #fff;
}

.vitals-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  justify-content: center;
}

.stat-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.location-info {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #00cdf0;
  font-size: 14px;
  font-weight: 600;
}

.party-section,
.tower-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.party-section > div {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.party-id {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.party-members-scroll {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.party-member-item {
  padding: 8px 0;
  border-bottom: 1px solid #2d2f31;
}

.party-member-item:last-child {
  border-bottom: none;
}

.member-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.member-name {
  font-size: 13px;
  font-weight: bold;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.member-loc {
  font-size: 11px;
  color: #00cdf0;
}

.member-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 4px;
}

.member-mini-progress {
  width: 100%;
}

.member-mini-progress :deep(.el-progress-bar__outer) {
  height: 4px !important;
  background-color: #333 !important;
}

.member-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.member-hp-text {
  font-size: 11px;
  color: var(--text-secondary);
}

.leader-badge {
  transform: scale(0.8);
}

.no-party-info,
.no-tower-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}

.empty-text {
  font-size: 13px;
}

.invites-container {
  margin-top: 12px;
  width: 100%;
}

.invites-title {
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 4px;
}

.invite-item {
  font-size: 11px;
  background-color: #242629;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.tower-detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.detail-label {
  color: var(--text-secondary);
}

.detail-val {
  font-weight: bold;
  color: #fff;
}

.warning-text {
  color: #e6a23c;
}

.tower-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}

.automation-section :deep(.el-tabs--border-card) {
  background-color: #1a1c1e;
  border: 1px solid #2d2f31;
  border-radius: 12px;
  overflow: hidden;
}

.automation-section :deep(.el-tabs__header) {
  background-color: #141619;
  border-bottom: 1px solid #2d2f31;
}

.automation-section :deep(.el-tabs__item.is-active) {
  background-color: #1a1c1e;
  border-right-color: #2d2f31;
  border-left-color: #2d2f31;
  color: #00cdf0;
}

.welcome-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.home-container {
  height: 100%;
}
</style>
