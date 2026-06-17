<script lang="ts" setup>
import { ref } from "vue";
import { RouterView } from "vue-router";
import { useAccountStore } from "./store/accountStore";
import { ElMessageBox, ElMessage } from "element-plus";
import { Plus, User, Delete } from "@element-plus/icons-vue";

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
</script>

<template>
  <el-container class="app-container">
    <el-aside width="260px" class="sidebar">
      <div class="sidebar-header">
        <h2 class="title">GAO Dashboard</h2>
        <el-button :icon="Plus" circle @click="handleAddAccount" />
      </div>

      <el-scrollbar>
        <div class="account-list">
          <div
            v-for="(acc, index) in accounts"
            :key="acc.token"
            :class="[
              'account-item',
              { active: selectedAccountIndex === index },
            ]"
            @click="selectAccount(index)"
          >
            <div class="account-avatar">
              <el-avatar
                :icon="User"
                :size="40"
                :style="{
                  backgroundColor: acc.profile.avatarColor || '#409EFF',
                }"
              />
            </div>
            <div class="account-info">
              <div class="account-name">
                {{ acc.profile.nickname || "未載入" }}
              </div>
              <div class="account-stats">
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

      <div class="sidebar-footer">
        <span class="version-text">v1.0.0-Modern</span>
      </div>
    </el-aside>

    <el-main class="main-content">
      <RouterView />
    </el-main>
  </el-container>
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
}

.sidebar-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #2d2f31;
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
  margin-left: 12px;
  flex: 1;
  overflow: hidden;
}

.account-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
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
}

.version-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.main-content {
  padding: 0;
  background-color: #0d0f11;
}
</style>
