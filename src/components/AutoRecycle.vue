<template>
  <div class="auto-recycle-module">
    <el-card shadow="never" class="inner-card">
      <el-row :gutter="20" align="middle">
        <el-col :span="14">
          <el-input-number
            v-model="durability"
            :min="0"
            placeholder="耐久度閾值"
            style="width: 100%"
            @change="filteredWeapons"
          >
            <template #prefix>耐久小於</template>
          </el-input-number>
        </el-col>
        <el-col :span="10">
          <el-button
            type="warning"
            size="large"
            @click="confirmRecycle"
            style="width: 100%"
            >批量回收</el-button
          >
        </el-col>
      </el-row>

      <el-divider border-style="dashed" />

      <div class="table-container">
        <el-table
          :data="selectedWeapon"
          border
          style="width: 100%"
          size="small"
          class="dark-table"
        >
          <el-table-column prop="name" label="名稱" min-width="120" />
          <el-table-column
            prop="durability"
            label="耐久"
            width="80"
            align="center"
          />
          <el-table-column prop="atk" label="ATK" width="70" align="center" />
          <el-table-column prop="def" label="DEF" width="70" align="center" />
          <el-table-column prop="id" label="ID" width="80" align="center" />
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
          <b style="color: #f56c6c">{{ selectedWeapon.length }}</b>
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
import { ref, defineProps, onMounted } from "vue";
import sleep from "../common/sleep";

const props = defineProps({
  userObj: Object,
});

const durability = ref(10);
const weapon = ref([]);
const selectedWeapon = ref([]);
const dialogVisible = ref(false);
const recyclingActive = ref(false);
const recycleProgress = ref(0);
const emergencyButton = ref(false);

const confirmRecycle = () => {
  filteredWeapons();
  if (selectedWeapon.value.length === 0) {
    ElMessage.warning("沒有符合條件的裝備");
    return;
  }
  dialogVisible.value = true;
};

const handleRecycle = async () => {
  dialogVisible.value = false;
  recyclingActive.value = true;
  emergencyButton.value = false;

  let total = selectedWeapon.value.length;
  let recycleAry = [...selectedWeapon.value];

  for (let i = 0; i < recycleAry.length; i++) {
    if (emergencyButton.value) break;

    try {
      await props.userObj.recycle(recycleAry[i].id);
      console.log(`正在回收 ID: ${recycleAry[i].id}`);
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
  await getItem();
};

const getItem = async () => {
  try {
    const res = await props.userObj.item();
    if (res) {
      weapon.value = res.equipments;
      filteredWeapons();
    }
  } catch (e) {
    console.error("讀取裝備清單失敗", e);
  }
};

const filteredWeapons = () => {
  selectedWeapon.value = weapon.value.filter(
    (item) => item.durability <= durability.value
  );
};

onMounted(async () => {
  await getItem();
});
</script>

<style scoped>
.inner-card {
  background-color: #141619 !important;
  border: 1px solid #2d2f31 !important;
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
