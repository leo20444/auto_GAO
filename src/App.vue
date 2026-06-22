<script lang="ts" setup>
import { ref, reactive, onMounted, onUnmounted, watch } from "vue";
import { RouterView } from "vue-router";
import { useAccountStore } from "./store/accountStore";
import { ElMessageBox, ElMessage } from "element-plus";
import { Plus, Delete, Menu, Fold, Expand } from "@element-plus/icons-vue";

const {
  accounts,
  selectedAccountIndex,
  addAccount,
  removeAccount,
  selectAccount,
} = useAccountStore();

const handleAddAccount = () => {
  ElMessageBox.prompt("請輸入新的 Token", "新增帳號", {
    confirmButtonText: "新增",
    cancelButtonText: "取消",
    inputPlaceholder: "eyJhbGci...",
  })
    .then(({ value }) => {
      if (value) {
        addAccount(value);
        ElMessage.success("帳號已新增");
      }
    })
    .catch(() => {
      // User cancelled or closed the prompt
    });
};

const handleDeleteAccount = (index: number, event: Event) => {
  event.stopPropagation();
  ElMessageBox.confirm("確定要移除此帳號嗎？", "警告", {
    confirmButtonText: "確定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(() => {
      removeAccount(index);
      ElMessage.info("帳號已移除");
    })
    .catch(() => {
      // User cancelled or closed the confirmation
    });
};

const showBackupDialog = ref(false);
const backupActiveTab = ref("export");
const importFileInput = ref<HTMLInputElement | null>(null);
const parsedImportData = ref<any>(null);

const exportOptions = reactive({
  tokens: true,
  settings: true,
  forgeFavorites: true,
});

const importOptions = reactive({
  tokens: true,
  settings: true,
  forgeFavorites: true,
});

const handleExport = () => {
  const exportData: any = {};

  if (exportOptions.tokens) {
    const tokens = JSON.parse(localStorage.getItem("strList") || "[]");
    exportData.tokens = tokens;
  }

  if (exportOptions.settings) {
    const settings: Record<string, any> = {};
    const tokens = JSON.parse(localStorage.getItem("strList") || "[]");
    tokens.forEach((token: string) => {
      const stored = localStorage.getItem(`setting_${token}`);
      if (stored) {
        try {
          settings[token] = JSON.parse(stored);
        } catch (e) {
          settings[token] = stored;
        }
      }
    });
    exportData.settings = settings;
  }

  if (exportOptions.forgeFavorites) {
    const forgeFavorites: Record<string, any> = {};
    const tokens = JSON.parse(localStorage.getItem("strList") || "[]");
    tokens.forEach((token: string) => {
      const stored = localStorage.getItem(`forge_favorites_${token}`);
      if (stored) {
        try {
          forgeFavorites[token] = JSON.parse(stored);
        } catch (e) {
          forgeFavorites[token] = stored;
        }
      }
    });
    exportData.forgeFavorites = forgeFavorites;
  }

  if (Object.keys(exportData).length === 0) {
    ElMessage.warning("請至少選擇一個項目進行匯出");
    return;
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gao_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  ElMessage.success("備份檔案生成成功並已下載");
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target?.result as string);
      parsedImportData.value = parsed;
      importOptions.tokens = !!parsed.tokens;
      importOptions.settings = !!parsed.settings;
      importOptions.forgeFavorites = !!parsed.forgeFavorites;
    } catch (error) {
      ElMessage.error("JSON 格式無效，請選擇正確的備份檔案");
      parsedImportData.value = null;
    }
  };
  reader.readAsText(file);
};

const handleImport = () => {
  if (!parsedImportData.value) return;

  const data = parsedImportData.value;
  let importedCount = 0;

  if (importOptions.tokens && data.tokens) {
    localStorage.setItem("strList", JSON.stringify(data.tokens));
    importedCount++;
  }

  if (importOptions.settings && data.settings) {
    Object.keys(data.settings).forEach((token) => {
      const settingVal = data.settings[token];
      localStorage.setItem(
        `setting_${token}`,
        typeof settingVal === "string" ? settingVal : JSON.stringify(settingVal)
      );
    });
    importedCount++;
  }

  if (importOptions.forgeFavorites && data.forgeFavorites) {
    Object.keys(data.forgeFavorites).forEach((token) => {
      const favVal = data.forgeFavorites[token];
      localStorage.setItem(
        `forge_favorites_${token}`,
        typeof favVal === "string" ? favVal : JSON.stringify(favVal)
      );
    });
    importedCount++;
  }

  if (importedCount === 0) {
    ElMessage.warning("未勾選或無可還原項目");
    return;
  }

  ElMessage.success("還原成功！網頁即將重新整理以套用新設定。");
  setTimeout(() => {
    window.location.reload();
  }, 1500);
};

const getEquippedWeapon = (acc: any) => {
  const equips = acc.items?.equipments || [];
  const equipped = equips.filter((e: any) => e.status === "已裝備");
  const weaponTypes = [
    "短刀",
    "單手劍",
    "細劍",
    "單手錘",
    "盾牌",
    "雙手斧",
    "雙手劍",
    "太刀",
    "長槍",
  ];
  const weapon = equipped.find((e: any) => weaponTypes.includes(e.typeName));
  return weapon ? `${weapon.name} (${weapon.durability})` : "空手";
};

const getEquippedArmors = (acc: any) => {
  const equips = acc.items?.equipments || [];
  return equips.filter(
    (e: any) =>
      e.status === "已裝備" && (e.typeName === "大衣" || e.typeName === "盔甲")
  );
};

const getMinArmorDurability = (armors: any[]) => {
  if (armors.length === 0) return 0;
  return Math.min(...armors.map((a) => a.durability));
};

const isAtSecretRealmFloor = (acc: any) => {
  const secretRealmConfig: Record<string, number> = {
    大草原: 16,
    great_plains: 16,
    猛牛園: 18,
    bull_pen: 18,
    蘑菇園: 12,
    mushroom_garden: 12,
  };
  const zoneName = acc.profile?.zoneName;
  const huntStage = acc.profile?.huntStage;
  return zoneName && huntStage && secretRealmConfig[zoneName] === huntStage;
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
    return {
      text: "樂透: 購買中...",
      type: "info" as const,
      effect: "dark" as const,
    };
  }
  if (acc.lotteryProgressState?.startsWith("失敗")) {
    return {
      text: acc.lotteryProgressState,
      type: "danger" as const,
      effect: "light" as const,
    };
  }

  const lotteryConfig = acc.automation?.lottery || {};
  const isCollectReset = isLotteryReset(lotteryConfig.lastCollectedAt);
  const isBuyReset = isLotteryReset(lotteryConfig.lastBoughtAt);

  if (!isCollectReset && !isBuyReset) {
    return {
      text: "樂透: 已買",
      type: "success" as const,
      effect: "plain" as const,
    };
  }

  return {
    text: "樂透: 未買",
    type: "danger" as const,
    effect: "light" as const,
  };
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
    猛牛原: 2,
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
      return { text: "等待BOSS", type: "warning" as const };
    }
  }
  return null;
};

const getCharacterStatuses = (acc: any) => {
  const list: Array<{
    text: string;
    type: "danger" | "warning" | "success" | "info" | "";
    effect?: "plain" | "light" | "dark";
  }> = [];
  if (acc.profile?.inSecretRealm === true && isAtSecretRealmFloor(acc)) {
    list.push({ text: "秘徑", type: "warning" as const });
  }
  const statuses = acc.profile?.activeStatuses || [];
  const isBattleRunning = acc.automation?.battle?.running === true;
  const isMiningRunning = acc.automation?.mining?.running === true;
  const isForgeRunning = acc.automation?.forge?.running === true;

  if (statuses.length > 0) {
    statuses.forEach((status: string) => {
      switch (status) {
        case "戰鬥":
          if (isBattleRunning) {
            list.push({ text: "戰鬥", type: "danger" as const });
          }
          break;
        case "採礦":
          if (isMiningRunning) {
            list.push({ text: "採集", type: "warning" as const });
          }
          break;
        case "休息":
          if (isBattleRunning || isMiningRunning) {
            list.push({ text: "休息", type: "success" as const });
          }
          break;
        case "鍛造":
          if (isForgeRunning) {
            list.push({ text: "製作", type: "info" as const });
          }
          break;
      }
    });
  } else if (acc.profile?.actionStatus) {
    const actionStatus = acc.profile.actionStatus;
    switch (actionStatus) {
      case "戰鬥":
        if (isBattleRunning) {
          list.push({ text: "戰鬥", type: "danger" as const });
        }
        break;
      case "採礦":
        if (isMiningRunning) {
          list.push({ text: "採集", type: "warning" as const });
        }
        break;
      case "休息":
        if (isBattleRunning || isMiningRunning) {
          list.push({ text: "休息", type: "success" as const });
        }
        break;
      case "鍛造":
        if (isForgeRunning) {
          list.push({ text: "製作", type: "info" as const });
        }
        break;
    }
  }
  if (list.length === 0) {
    list.push({
      text: "空閒",
      type: "info" as const,
      effect: "plain" as const,
    });
  }

  // 加入樂透與等待 BOSS 狀態標籤
  const lotteryStatus = getLotteryStatus(acc);
  if (lotteryStatus) {
    list.push(lotteryStatus);
  }
  const bossStatus = getWaitingBossStatus(acc);
  if (bossStatus) {
    list.push(bossStatus);
  }

  return list;
};

const manualEnterSecretRealm = async (acc: any) => {
  try {
    const res = await acc.userObj.enterSecretRealm();
    if (res && !res.error) {
      acc.profile.inSecretRealm = true;
      ElMessage.success(`${acc.profile.nickname} 已成功進入秘徑！`);
    } else {
      ElMessage.error(
        `${acc.profile.nickname} 進入秘徑失敗: ${res?.message || "未知錯誤"}`
      );
    }
  } catch (e) {
    ElMessage.error(`進入秘徑操作失敗`);
  }
};

const isMobile = ref(false);
const drawerVisible = ref(false);
const isCollapsed = ref(false);

const checkViewport = () => {
  isMobile.value = window.innerWidth <= 768;
};

const toggleSidebarCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

onMounted(() => {
  checkViewport();
  window.addEventListener("resize", checkViewport);
  const savedCollapsed = localStorage.getItem("sidebar_collapsed");
  if (savedCollapsed) {
    isCollapsed.value = savedCollapsed === "true";
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", checkViewport);
});

watch(isCollapsed, (newVal) => {
  localStorage.setItem("sidebar_collapsed", String(newVal));
});

const getNicknameFirstChar = (acc: any) => {
  const name = acc.profile?.nickname || acc.token || "?";
  if (name === "載入中...") return "載";
  return name.charAt(0).toUpperCase();
};

const getAvatarBgColor = (acc: any) => {
  const name = acc.profile?.nickname || acc.token || "?";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 35%)`;
};
</script>

<template>
  <el-container class="app-container">
    <!-- 1. PC 模式下的側邊欄 (可折疊) -->
    <el-aside
      v-if="!isMobile"
      :width="isCollapsed ? '64px' : '260px'"
      class="sidebar"
      :class="{ collapsed: isCollapsed }"
    >
      <!-- Header -->
      <div class="sidebar-header">
        <h2 class="title" v-if="!isCollapsed">auto-gao</h2>
        <div class="header-actions" v-if="!isCollapsed">
          <el-button
            :icon="Plus"
            circle
            size="small"
            @click="handleAddAccount"
          />
          <el-button
            :icon="Fold"
            circle
            size="small"
            @click="toggleSidebarCollapse"
          />
        </div>
        <div class="header-actions-collapsed" v-else>
          <el-button
            :icon="Expand"
            circle
            size="small"
            @click="toggleSidebarCollapse"
          />
        </div>
      </div>

      <!-- Scrollbar Account List -->
      <el-scrollbar>
        <div class="account-list">
          <el-tooltip
            v-for="(acc, index) in accounts"
            :key="acc.token"
            :disabled="!isCollapsed"
            placement="right"
            effect="dark"
            raw-content
          >
            <!-- Tooltip Content for Collapsed Mode -->
            <template #content>
              <div style="font-size: 12px; line-height: 1.6; padding: 5px">
                <div
                  style="
                    font-weight: bold;
                    font-size: 13px;
                    color: #00cdf0;
                    margin-bottom: 4px;
                  "
                >
                  {{ acc.profile?.nickname || "未載入" }} (Lv.{{
                    acc.profile?.lv || 0
                  }})
                </div>
                <div>
                  狀態:
                  <b>{{
                    getCharacterStatuses(acc)
                      .map((s: any) => s.text)
                      .join("+")
                  }}</b>
                </div>
                <div style="margin: 4px 0" v-if="acc.profile">
                  HP: {{ acc.profile.hp }}/{{ acc.profile.fullHp }} | SP:
                  {{ acc.profile.sp }}/{{ acc.profile.fullSp }}
                </div>
                <div>武器: {{ getEquippedWeapon(acc) }}</div>
                <div>防具: x{{ getEquippedArmors(acc).length }} 裝備中</div>
              </div>
            </template>

            <!-- Account Item -->
            <div
              :class="[
                'account-item',
                {
                  active: selectedAccountIndex === index,
                  'collapsed-item': isCollapsed,
                },
              ]"
              @click="selectAccount(index)"
            >
              <!-- 折疊狀態下的簡化 UI -->
              <template v-if="isCollapsed">
                <div class="avatar-circle-wrapper">
                  <div
                    class="avatar-circle"
                    :style="{ backgroundColor: getAvatarBgColor(acc) }"
                  >
                    {{ getNicknameFirstChar(acc) }}
                  </div>
                  <!-- 右下角狀態小點 -->
                  <div
                    :class="[
                      'status-dot',
                      getCharacterStatuses(acc)[0]?.type || 'info',
                    ]"
                  />
                </div>
              </template>

              <!-- 正常狀態下的完整 UI -->
              <template v-else>
                <div class="account-info">
                  <div class="account-name-row">
                    <span class="account-name">{{
                      acc.profile?.nickname || "未載入"
                    }}</span>
                    <el-button
                      v-if="
                        isAtSecretRealmFloor(acc) &&
                        acc.profile?.inSecretRealm !== true
                      "
                      type="warning"
                      size="small"
                      style="
                        margin-left: 6px;
                        padding: 2px 6px;
                        height: 18px;
                        font-size: 10px;
                      "
                      @click.stop="manualEnterSecretRealm(acc)"
                    >
                      進秘徑
                    </el-button>
                  </div>
                  <div
                    v-if="acc.profile"
                    class="status-tags-row"
                    style="
                      display: flex;
                      gap: 4px;
                      flex-wrap: wrap;
                      margin-top: 4px;
                    "
                  >
                    <el-tag
                      v-for="(status, idx) in getCharacterStatuses(acc)"
                      :key="idx"
                      :type="status.type"
                      :effect="status.effect || 'light'"
                      size="small"
                      class="status-tag"
                    >
                      {{ status.text }}
                    </el-tag>
                  </div>

                  <!-- 裝備與防具懸停顯示 -->
                  <div class="account-equip-row" v-if="acc.profile">
                    <span class="equip-weapon"
                      >🗡️ {{ getEquippedWeapon(acc) }}</span
                    >
                    <span class="equip-divider">|</span>

                    <el-tooltip
                      placement="right"
                      effect="dark"
                      :enterable="true"
                    >
                      <template #content>
                        <div
                          style="
                            font-size: 12px;
                            line-height: 1.6;
                            max-height: 250px;
                            overflow-y: auto;
                          "
                        >
                          <div
                            style="
                              font-weight: bold;
                              margin-bottom: 6px;
                              border-bottom: 1px solid #4e5052;
                              padding-bottom: 2px;
                            "
                          >
                            全身防具狀態 (已裝備)
                          </div>
                          <div
                            v-if="getEquippedArmors(acc).length === 0"
                            style="color: #909399"
                          >
                            無裝備任何防具
                          </div>
                          <div
                            v-else
                            v-for="armor in getEquippedArmors(acc)"
                            :key="armor.id"
                          >
                            [{{ armor.typeName }}] {{ armor.name }} (耐久:
                            {{ armor.durability }})
                          </div>
                        </div>
                      </template>
                      <span class="equip-armor">
                        🛡️ 防具 x{{ getEquippedArmors(acc).length }}
                        <span v-if="getEquippedArmors(acc).length > 0">
                          ({{ getMinArmorDurability(getEquippedArmors(acc)) }})
                        </span>
                      </span>
                    </el-tooltip>
                  </div>

                  <div class="account-stats" v-if="acc.profile">
                    <el-progress
                      :percentage="
                        acc.profile.fullHp
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                (acc.profile.hp / acc.profile.fullHp) * 100
                              )
                            )
                          : 0
                      "
                      :show-text="false"
                      status="exception"
                      class="mini-bar"
                    />
                    <el-progress
                      :percentage="
                        acc.profile.fullSp
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                (acc.profile.sp / acc.profile.fullSp) * 100
                              )
                            )
                          : 0
                      "
                      :show-text="false"
                      class="mini-bar"
                    />
                  </div>
                </div>
                <el-button
                  type="danger"
                  :icon="Delete"
                  circle
                  size="small"
                  class="delete-btn"
                  @click="handleDeleteAccount(index, $event)"
                />
              </template>
            </div>
          </el-tooltip>

          <div v-if="accounts.length === 0" class="empty-state">
            {{ isCollapsed ? "無" : "尚未新增帳號" }}
          </div>
        </div>
      </el-scrollbar>

      <!-- Footer -->
      <div class="sidebar-footer">
        <template v-if="isCollapsed">
          <el-tooltip content="配置備份與還原" placement="right">
            <el-button
              type="info"
              size="small"
              circle
              plain
              @click="showBackupDialog = true"
              style="margin: 0 auto"
            >
              <el-icon><Plus /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
        <template v-else>
          <el-button
            type="info"
            size="small"
            plain
            @click="showBackupDialog = true"
            style="width: 100%; margin-bottom: 8px"
          >
            配置備份與還原
          </el-button>
          <span class="version-text">v1.1.0-Modern</span>
        </template>
      </div>
    </el-aside>

    <!-- 2. 手機模式下的選單 (抽屜式) -->
    <el-drawer
      v-else
      v-model="drawerVisible"
      direction="ltr"
      size="280px"
      :with-header="false"
      class="mobile-sidebar-drawer"
    >
      <div class="sidebar" style="height: 100%; width: 100%">
        <!-- Header -->
        <div class="sidebar-header">
          <h2 class="title">auto-gao</h2>
          <el-button
            :icon="Plus"
            circle
            size="small"
            @click="handleAddAccount"
          />
        </div>

        <!-- Scrollbar Account List -->
        <el-scrollbar>
          <div class="account-list">
            <!-- Account Item -->
            <div
              v-for="(acc, index) in accounts"
              :key="acc.token"
              :class="[
                'account-item',
                { active: selectedAccountIndex === index },
              ]"
              @click="
                () => {
                  selectAccount(index);
                  drawerVisible = false;
                }
              "
            >
              <div class="account-info">
                <div class="account-name-row">
                  <span class="account-name">{{
                    acc.profile?.nickname || "未載入"
                  }}</span>
                  <el-button
                    v-if="
                      isAtSecretRealmFloor(acc) &&
                      acc.profile?.inSecretRealm !== true
                    "
                    type="warning"
                    size="small"
                    style="
                      margin-left: 6px;
                      padding: 2px 6px;
                      height: 18px;
                      font-size: 10px;
                    "
                    @click.stop="manualEnterSecretRealm(acc)"
                  >
                    進秘徑
                  </el-button>
                </div>
                <div
                  v-if="acc.profile"
                  class="status-tags-row"
                  style="
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                    margin-top: 4px;
                  "
                >
                  <el-tag
                    v-for="(status, idx) in getCharacterStatuses(acc)"
                    :key="idx"
                    :type="status.type"
                    :effect="status.effect || 'light'"
                    size="small"
                    class="status-tag"
                  >
                    {{ status.text }}
                  </el-tag>
                </div>

                <!-- 裝備與防具懸停顯示 -->
                <div class="account-equip-row" v-if="acc.profile">
                  <span class="equip-weapon"
                    >🗡️ {{ getEquippedWeapon(acc) }}</span
                  >
                  <span class="equip-divider">|</span>
                  <span class="equip-armor"
                    >🛡️ 防具 x{{ getEquippedArmors(acc).length }}</span
                  >
                </div>

                <div class="account-stats" v-if="acc.profile">
                  <el-progress
                    :percentage="
                      acc.profile.fullHp
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              (acc.profile.hp / acc.profile.fullHp) * 100
                            )
                          )
                        : 0
                    "
                    :show-text="false"
                    status="exception"
                    class="mini-bar"
                  />
                  <el-progress
                    :percentage="
                      acc.profile.fullSp
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              (acc.profile.sp / acc.profile.fullSp) * 100
                            )
                          )
                        : 0
                    "
                    :show-text="false"
                    class="mini-bar"
                  />
                </div>
              </div>
              <el-button
                type="danger"
                :icon="Delete"
                circle
                size="small"
                class="delete-btn"
                @click="handleDeleteAccount(index, $event)"
              />
            </div>

            <div v-if="accounts.length === 0" class="empty-state">
              尚未新增帳號
            </div>
          </div>
        </el-scrollbar>

        <!-- Footer -->
        <div class="sidebar-footer">
          <el-button
            type="info"
            size="small"
            plain
            @click="showBackupDialog = true"
            style="width: 100%; margin-bottom: 8px"
          >
            配置備份與還原
          </el-button>
          <span class="version-text">v1.1.0-Modern</span>
        </div>
      </div>
    </el-drawer>

    <!-- 右側主要內容區 -->
    <el-container class="main-container-wrapper">
      <!-- 手機模式下的頂部 Header -->
      <el-header v-if="isMobile" class="mobile-top-header">
        <el-button :icon="Menu" circle @click="drawerVisible = true" />
        <span class="mobile-title">auto-gao</span>
        <el-button
          v-if="selectedAccount"
          type="info"
          size="small"
          circle
          plain
          :icon="Plus"
          @click="showBackupDialog = true"
          style="margin-left: auto"
        />
      </el-header>

      <el-main class="main-content">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>

  <!-- 配置備份與還原對話框 -->
  <el-dialog
    v-model="showBackupDialog"
    title="配置備份與還原"
    width="500px"
    class="backup-dialog"
  >
    <el-tabs v-model="backupActiveTab">
      <!-- 匯出面板 -->
      <el-tab-pane label="匯出配置" name="export">
        <div style="margin-bottom: 15px">
          <p
            style="
              font-size: 13px;
              color: var(--text-secondary);
              margin-bottom: 12px;
            "
          >
            請勾選欲匯出的設定項目：
          </p>
          <el-checkbox v-model="exportOptions.tokens"
            >帳號 Token 清單</el-checkbox
          >
          <br />
          <el-checkbox v-model="exportOptions.settings"
            >帳號自動化設定檔</el-checkbox
          >
          <br />
          <el-checkbox v-model="exportOptions.forgeFavorites"
            >鍛造組合收藏匣</el-checkbox
          >
        </div>
        <el-button type="primary" @click="handleExport" style="width: 100%">
          生成備份並下載
        </el-button>
      </el-tab-pane>

      <!-- 匯入面板 -->
      <el-tab-pane label="匯入配置" name="import">
        <div style="margin-bottom: 15px">
          <p
            style="
              font-size: 13px;
              color: var(--text-secondary);
              margin-bottom: 12px;
            "
          >
            步驟 1：選擇備份 JSON 檔案
          </p>
          <input
            type="file"
            ref="importFileInput"
            accept=".json"
            @change="handleFileChange"
            style="margin-bottom: 12px"
          />

          <div v-if="parsedImportData" style="margin-top: 15px">
            <p
              style="
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 8px;
              "
            >
              步驟 2：請勾選欲還原的項目：
            </p>
            <el-checkbox
              v-model="importOptions.tokens"
              :disabled="!parsedImportData.tokens"
            >
              還原 Token 清單 (共
              {{ parsedImportData.tokens?.length || 0 }} 筆)
            </el-checkbox>
            <br />
            <el-checkbox
              v-model="importOptions.settings"
              :disabled="!parsedImportData.settings"
            >
              還原自動化設定檔
            </el-checkbox>
            <br />
            <el-checkbox
              v-model="importOptions.forgeFavorites"
              :disabled="!parsedImportData.forgeFavorites"
            >
              還原鍛造組合收藏匣
            </el-checkbox>
          </div>
        </div>
        <el-button
          type="success"
          :disabled="!parsedImportData"
          @click="handleImport"
          style="width: 100%"
        >
          確認還原配置
        </el-button>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<style>
:root {
  --sidebar-bg: #1a1c1e;
  --sidebar-item-active: #2c2e31;
  --sidebar-item-hover: #242629;
  --text-primary: #e1e2e4;
  --text-secondary: #9ea0a4;
}

body {
  margin: 0;
  font-family: "Inter", sans-serif;
  background-color: #0d0f11;
  color: var(--text-primary);
}

.app-container {
  height: 100vh;
}

.sidebar {
  background-color: var(--sidebar-bg);
  border-right: 1px solid #2d2f31;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 64px !important;
}

.sidebar.collapsed .sidebar-header {
  padding: 20px 0;
  justify-content: center;
}

.sidebar.collapsed .sidebar-footer {
  padding: 15px 5px;
}

.sidebar-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #2d2f31;
}

.header-actions-collapsed {
  display: flex;
  justify-content: center;
  width: 100%;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #00cdf0;
}

.account-list {
  padding: 10px;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border: 1px solid transparent;
}

.account-item:hover {
  background-color: var(--sidebar-item-hover);
}

.account-item.active {
  background-color: var(--sidebar-item-active);
  border-color: #00cdf033;
  box-shadow: 0 0 10px #00cdf011;
}

.account-info {
  margin-left: 0;
  flex: 1;
  overflow: hidden;
}

.account-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.status-tag {
  font-size: 10px;
  height: 16px;
  padding: 0 4px;
  line-height: 14px;
}

.account-equip-row {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
  margin-bottom: 2px;
  gap: 4px;
  width: 100%;
  overflow: hidden;
}

.equip-weapon,
.equip-armor {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}

.equip-weapon {
  max-width: 90px;
}

.equip-armor {
  max-width: 105px;
}

.equip-divider {
  color: #4e5052;
  font-size: 10px;
}

.account-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.account-stats {
  margin-top: 4px;
}

.mini-bar {
  margin-bottom: 2px;
}

.mini-bar .el-progress-bar__outer {
  height: 4px !important;
  background-color: #333 !important;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s;
  margin-left: 8px;
}

.account-item:hover .delete-btn {
  opacity: 1;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 14px;
}

.sidebar-footer {
  padding: 15px;
  border-top: 1px solid #2d2f31;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.main-content {
  padding: 0;
  background-color: #0d0f11;
}

:deep(.el-dialog.backup-dialog),
:deep(.backup-dialog) {
  background-color: #141619 !important;
  border: 1px solid #2d2f31 !important;
  border-radius: 8px;
}
:deep(.backup-dialog .el-dialog__title) {
  color: #fff !important;
}
:deep(.backup-dialog .el-tabs__item) {
  color: var(--text-secondary) !important;
}
:deep(.backup-dialog .el-tabs__item.is-active) {
  color: #00cdf0 !important;
}
:deep(.backup-dialog .el-checkbox) {
  color: var(--text-primary) !important;
  margin-bottom: 8px;
}

/* 折疊模式下的頭像包裝 */
.avatar-circle-wrapper {
  position: relative;
  width: 40px;
  height: 40px;
  margin: 0 auto;
}

.avatar-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: bold;
  font-size: 16px;
  user-select: none;
}

/* 狀態小圓點 */
.status-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--sidebar-bg);
}

.status-dot.danger {
  background-color: var(--el-color-danger);
}

.status-dot.warning {
  background-color: var(--el-color-warning);
}

.status-dot.success {
  background-color: var(--el-color-success);
}

.status-dot.info {
  background-color: var(--el-color-info);
}

/* 折疊時帳號項目的間距 */
.account-item.collapsed-item {
  padding: 12px 0;
  justify-content: center;
}

/* 頂部導覽列樣式 (手機版) */
.mobile-top-header {
  background-color: var(--sidebar-bg);
  border-bottom: 1px solid #2d2f31;
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 50px !important;
}

.mobile-title {
  font-size: 18px;
  font-weight: 700;
  color: #00cdf0;
  margin-left: 12px;
}

/* 手機版抽屜樣式 */
.mobile-sidebar-drawer :deep(.el-drawer__body) {
  padding: 0 !important;
  background-color: var(--sidebar-bg);
}

/* 響應式微調 */
@media (max-width: 768px) {
  .main-content {
    padding: 10px;
  }
  .app-container {
    flex-direction: column;
  }
  .main-container-wrapper {
    flex-direction: column;
    height: calc(100vh - 50px);
  }
}
</style>
