<template>
  <div class="auto-recycle-module">
    <el-card shadow="never" class="inner-card">
      <!-- 篩選主控制區 -->
      <el-row :gutter="20" align="middle" style="margin-bottom: 15px">
        <el-col
          :xs="24"
          :sm="6"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">當前耐久低於</div>
          <el-input-number
            v-model="durability"
            :min="0"
            placeholder="當前耐久度"
            style="width: 100%"
            @change="filteredWeapons"
          />
        </el-col>
        <el-col
          :xs="24"
          :sm="6"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div class="input-label">最大耐久低於</div>
          <el-input-number
            v-model="maxDurability"
            :min="0"
            placeholder="最大耐久度"
            style="width: 100%"
            @change="filteredWeapons"
          />
        </el-col>
        <el-col
          :xs="24"
          :sm="7"
          style="margin-bottom: 10px; sm-margin-bottom: 0"
        >
          <div
            style="display: flex; align-items: center; justify-content: center"
          >
            <el-radio-group
              v-model="filterType"
              size="default"
              @change="filteredWeapons"
              style="width: 100%"
            >
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="weapon">武器</el-radio-button>
              <el-radio-button label="armor">防具</el-radio-button>
            </el-radio-group>
          </div>
        </el-col>
        <el-col :xs="24" :sm="5">
          <el-button
            type="warning"
            size="large"
            @click="confirmRecycle"
            style="width: 100%"
            >批量回收</el-button
          >
        </el-col>
      </el-row>

      <!-- 快速操作與防呆設定區 -->
      <el-row :gutter="20" align="middle" class="action-helper-row">
        <el-col
          :xs="24"
          :sm="12"
          style="
            margin-bottom: 10px;
            sm-margin-bottom: 0;
            display: flex;
            align-items: center;
          "
        >
          <el-switch
            v-model="autoSelectAll"
            active-text="自動勾選篩選結果"
            @change="filteredWeapons"
          />
          <el-tooltip
            content="開啟時，調整條件或切換分類會自動勾選所有符合且未裝備的裝備；關閉時則需要手動勾選或點擊一鍵選取。"
            placement="top"
          >
            <el-icon style="margin-left: 6px; color: #909399; cursor: pointer"
              ><QuestionFilled
            /></el-icon>
          </el-tooltip>
        </el-col>
        <el-col
          :xs="24"
          :sm="12"
          style="display: flex; justify-content: flex-end; gap: 10px"
        >
          <el-button
            size="small"
            type="primary"
            plain
            @click="selectAllUnequipped"
          >
            一鍵選取 (未裝備)
          </el-button>
          <el-button size="small" type="info" plain @click="clearAllSelection">
            清除選取
          </el-button>
        </el-col>
      </el-row>

      <el-divider border-style="dashed" style="margin: 15px 0" />

      <div class="table-container">
        <el-table
          :data="selectedWeapon"
          ref="multipleTableRef"
          border
          style="width: 100%"
          size="small"
          class="dark-table"
          @selection-change="handleSelectionChange"
        >
          <el-table-column
            type="selection"
            :selectable="isSelectable"
            width="55"
            align="center"
          />
          <el-table-column prop="name" label="名稱" min-width="150" />
          <el-table-column label="類別" width="120" align="center">
            <template #default="{ row }">
              <el-tag
                :type="typeList.weapon.includes(row.typeName) ? '' : 'warning'"
                size="small"
                effect="dark"
              >
                {{ typeList.weapon.includes(row.typeName) ? "武器" : "防具" }}
              </el-tag>
              <span style="margin-left: 8px">{{ row.typeName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="手持" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.hand_type === 'two_hand'">雙手</span>
              <span v-else-if="row.hand_type === 'one_hand'">單手</span>
              <span v-else style="color: #606266">-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="durability"
            label="耐久"
            width="80"
            align="center"
          >
            <template #default="{ row }">
              <span
                :style="{ color: row.durability <= 5 ? '#f56c6c' : '#e1e2e4' }"
              >
                {{ row.durability }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="atk" label="ATK" width="70" align="center" />
          <el-table-column prop="def" label="DEF" width="70" align="center" />
          <el-table-column label="狀態" width="90" align="center">
            <template #default="{ row }">
              <el-tag
                :type="row.status === '已裝備' ? 'danger' : 'info'"
                size="small"
                effect="plain"
              >
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="id" label="ID" width="90" align="center" />
        </el-table>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      title="確認批量回收"
      width="400px"
      class="dark-dialog"
    >
      <div style="text-align: center; padding: 20px 0">
        <span class="recycle-confirm-text"
          >確定要回收這
          <b style="color: #f56c6c">{{ checkedWeapons.length }}</b>
          個裝備嗎？</span
        >
        <div style="margin-top: 10px; font-size: 12px; color: #909399">
          此操作不可逆，將會獲得材料。
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="danger" @click="handleRecycle">確定回收</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 執行進度彈窗 -->
    <el-dialog
      v-model="recyclingActive"
      title="回收進度"
      :close-on-click-modal="false"
      :show-close="false"
      width="300px"
    >
      <div style="text-align: center">
        <el-progress type="circle" :percentage="recycleProgress" />
        <div style="margin-top: 20px">
          <el-button type="danger" @click="emergencyButton = true"
            >緊急停止</el-button
          >
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { ref, defineProps, onMounted, nextTick } from "vue";
import { QuestionFilled } from "@element-plus/icons-vue";
import sleep from "../common/sleep";
import typeList from "../common/typeList";

const props = defineProps({
  userObj: Object,
});

const durability = ref(100);
const maxDurability = ref(10000);
const weapon = ref<any[]>([]);
const selectedWeapon = ref<any[]>([]);
const checkedWeapons = ref<any[]>([]);
const multipleTableRef = ref<any>(null);
const dialogVisible = ref(false);
const recyclingActive = ref(false);
const recycleProgress = ref(0);
const emergencyButton = ref(false);

const filterType = ref("all");
const autoSelectAll = ref(false);

const handleSelectionChange = (val: any[]) => {
  checkedWeapons.value = val;
};

const isSelectable = (row: any) => {
  return row.status !== "已裝備" && row.locked !== true;
};

const selectAllUnequipped = () => {
  if (multipleTableRef.value) {
    selectedWeapon.value.forEach((row) => {
      if (isSelectable(row)) {
        multipleTableRef.value.toggleRowSelection(row, true);
      }
    });
  }
};

const clearAllSelection = () => {
  if (multipleTableRef.value) {
    multipleTableRef.value.clearSelection();
  }
};

const confirmRecycle = () => {
  if (checkedWeapons.value.length === 0) {
    ElMessage.warning("請先勾選欲回收的裝備");
    return;
  }
  dialogVisible.value = true;
};

const handleRecycle = async () => {
  dialogVisible.value = false;
  recyclingActive.value = true;
  emergencyButton.value = false;

  const total = checkedWeapons.value.length;
  const recycleAry = [...checkedWeapons.value];

  for (let i = 0; i < recycleAry.length; i++) {
    if (emergencyButton.value) break;

    try {
      await props.userObj.recycle(recycleAry[i].id);
    } catch (e) {
      console.error(`回收 ID: ${recycleAry[i].id} 失敗`, e);
    }

    recycleProgress.value = total
      ? Math.min(100, Math.max(0, Math.round(((i + 1) / total) * 100)))
      : 0;
    await sleep(1500); // 使用較安全的頻率
  }

  recyclingActive.value = false;
  recycleProgress.value = 0;
  ElMessage.success("批量回收完成！");

  if (multipleTableRef.value) {
    multipleTableRef.value.clearSelection();
  }
  checkedWeapons.value = [];

  await getItem();
};

const getItem = async () => {
  try {
    const res = await props.userObj.item();
    if (res) {
      weapon.value = res.equipments || [];
      filteredWeapons();
    }
  } catch (e) {
    console.error("讀取裝備清單失敗", e);
  }
};

const filteredWeapons = () => {
  selectedWeapon.value = weapon.value.filter((item) => {
    // 檢查當前耐久度
    const durMatch = item.durability <= durability.value;
    if (!durMatch) return false;

    // 檢查最大耐久度
    const maxDurVal = item.max_durability || item.fullDurability || 0;
    const maxDurMatch = maxDurVal <= maxDurability.value;
    if (!maxDurMatch) return false;

    // 檢查分類
    const isWeapon = typeList.weapon.includes(item.typeName);
    if (filterType.value === "weapon") return isWeapon;
    if (filterType.value === "armor") return !isWeapon;
    return true;
  });

  nextTick(() => {
    if (multipleTableRef.value) {
      multipleTableRef.value.clearSelection();
      if (autoSelectAll.value) {
        selectedWeapon.value.forEach((row) => {
          if (isSelectable(row)) {
            multipleTableRef.value.toggleRowSelection(row, true);
          }
        });
      }
    }
  });
};

onMounted(async () => {
  await getItem();
});
</script>

<style scoped>
.input-label {
  font-size: 12px;
  color: var(--text-secondary, #909399);
  margin-bottom: 8px;
  font-weight: 600;
}

.inner-card {
  background-color: #141619 !important;
  border: 1px solid #2d2f31 !important;
}

.action-helper-row {
  background-color: #0d0f11;
  padding: 10px 15px;
  border-radius: 6px;
  border: 1px dashed #2d2f31;
}

.table-container {
  margin-top: 15px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #2d2f31;
}

.dark-table {
  --el-table-bg-color: #0d0f11;
  --el-table-tr-bg-color: #0d0f11;
  --el-table-header-bg-color: #1a1c1e;
  --el-table-border-color: #2d2f31;
  --el-table-text-color: #e1e2e4;
  --el-table-header-text-color: #9ea0a4;
}

.recycle-confirm-text {
  font-size: 16px;
  color: #e1e2e4;
}
</style>
