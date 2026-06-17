<template>
  <div>
    <el-row align="middle" style="margin-bottom: 12px">
      <el-col :span="12">
        <h3 style="margin: 0">裝備選擇</h3>
      </el-col>
      <el-col :span="12" style="text-align: right">
        <el-space>
          <el-switch
            v-model="equipmentCheck"
            @change="handleEquipmentCheck"
            active-text="啟用裝備管理"
            inactive-text="停用"
            inline-prompt
          />
          <el-checkbox v-model="checkWeapon" @change="updateCheckWeapon()">
            武器檢查
          </el-checkbox>
          <el-checkbox v-model="checkArmor" @change="updateCheckArmor()">
            防具檢查
          </el-checkbox>
        </el-space>
      </el-col>
    </el-row>

    <transition name="el-zoom-in-top" mode="out-in">
      <div v-show="equipmentCheck">
        <!-- 篩選區 -->
        <el-row :gutter="12" style="margin-bottom: 12px" align="middle">
          <el-col :span="8">
            <div class="input-label">武器類型篩選</div>
            <el-select
              v-model="selectedType"
              placeholder="全部類型"
              clearable
              style="width: 100%"
            >
              <el-option label="全部" value="" />
              <el-option v-for="t in allTypes" :key="t" :label="t" :value="t" />
            </el-select>
          </el-col>
          <el-col :span="16">
            <div class="input-label">選擇武器（點擊加入佇列）</div>
            <div class="weapon-pool">
              <div
                v-for="weapon in filteredWeapons"
                :key="weapon.id"
                class="weapon-chip"
                :class="{ 'in-queue': isInQueue(weapon.id) }"
                @click="addToQueue(weapon)"
              >
                <span class="weapon-chip-name">{{ weapon.name }}</span>
                <span class="weapon-chip-meta">
                  [{{ weapon.typeName }}] {{ weapon.durability }}/{{
                    weapon.fullDurability
                  }}
                </span>
                <el-icon v-if="isInQueue(weapon.id)" class="chip-check"
                  ><CircleCheckFilled
                /></el-icon>
              </div>
              <div v-if="filteredWeapons.length === 0" class="empty-pool">
                無符合的武器
              </div>
            </div>
          </el-col>
        </el-row>

        <!-- 武器佇列 -->
        <div class="queue-section">
          <div class="queue-header">
            <span class="queue-title">武器替換佇列（依順序自動換裝）</span>
            <el-button
              v-if="weaponQueue.length > 0"
              type="danger"
              size="small"
              plain
              @click="clearQueue"
              >清空佇列</el-button
            >
          </div>

          <div v-if="weaponQueue.length === 0" class="empty-queue">
            尚未加入任何武器，點擊上方武器加入佇列
          </div>

          <div v-else class="queue-list">
            <div
              v-for="(weapon, idx) in weaponQueue"
              :key="weapon.id"
              class="queue-item"
            >
              <span class="queue-order">{{ idx + 1 }}</span>
              <div class="queue-item-info">
                <span class="queue-name">{{ weapon.name }}</span>
                <span class="queue-meta">
                  [{{ weapon.typeName }}] 耐久: {{ weapon.durability }}/{{
                    weapon.fullDurability
                  }}
                </span>
              </div>
              <div class="queue-actions">
                <el-button
                  size="small"
                  :disabled="idx === 0"
                  @click="moveUp(idx)"
                  circle
                  plain
                  :icon="ArrowUp"
                />
                <el-button
                  size="small"
                  :disabled="idx === weaponQueue.length - 1"
                  @click="moveDown(idx)"
                  circle
                  plain
                  :icon="ArrowDown"
                />
                <el-button
                  size="small"
                  type="danger"
                  @click="removeFromQueue(idx)"
                  circle
                  plain
                  :icon="Delete"
                />
              </div>
            </div>
          </div>

          <div
            v-if="weaponQueue.length > 0"
            style="
              margin-top: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            "
          >
            <el-tag v-if="isApplied" type="success" effect="dark" size="small">
              ✓ 已套用至自動戰鬥（{{ weaponQueue.length }} 把武器）
            </el-tag>
            <span v-else style="font-size: 12px; color: #909399">尚未套用</span>
            <el-button type="primary" @click="applyQueue"> 套用佇列 </el-button>
          </div>
          <div
            v-if="!weaponQueue.length && isApplied"
            style="margin-top: 10px; text-align: right"
          >
            <el-tag type="info" size="small">已清空佇列</el-tag>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import { ref, defineProps, defineEmits, computed, watch } from "vue";
import {
  ArrowUp,
  ArrowDown,
  Delete,
  CircleCheckFilled,
} from "@element-plus/icons-vue";
import typeList from "../common/typeList";

const props = defineProps({
  weaponList: Array,
  selectWeaponList: Array,
  weaponCheckTag: Boolean,
  armorCheckTag: Boolean,
  equipmentCheckTag: Boolean,
});

const emits = defineEmits([
  "select-weapon",
  "equipment-check",
  "update-check-weapon",
  "update-check-armor",
]);

// 裝備管理開關
const equipmentCheck = ref(props.equipmentCheckTag ?? true);
const checkWeapon = ref(props.weaponCheckTag ?? true);
const checkArmor = ref(props.armorCheckTag ?? false);

// 同步 props 變化
watch(
  () => props.equipmentCheckTag,
  (v) => {
    equipmentCheck.value = v ?? true;
  }
);
watch(
  () => props.weaponCheckTag,
  (v) => {
    checkWeapon.value = v ?? true;
  }
);
watch(
  () => props.armorCheckTag,
  (v) => {
    checkArmor.value = v ?? false;
  }
);

// 類型篩選
const selectedType = ref("");

// 所有可用的武器類型（從 weaponList 動態抽取 + typeList）
const allTypes = computed(() => {
  const fromList = (props.weaponList || [])
    .map((w: any) => w.typeName)
    .filter(Boolean);
  const merged = new Set([...typeList.weapon, ...typeList.armor, ...fromList]);
  return Array.from(merged);
});

// 篩選後的可選武器（排除已在佇列中的不需要排除，讓使用者看到已加入標記）
const filteredWeapons = computed(() => {
  const list: any[] = props.weaponList || [];
  if (!selectedType.value) return list;
  return list.filter((w: any) => w.typeName === selectedType.value);
});

// 武器佇列（有序）
const weaponQueue = ref<any[]>([]);

// 是否已套用至自動戰鬥
const isApplied = ref(false);

// 判斷武器是否已在佇列中
const isInQueue = (id: any) => weaponQueue.value.some((w) => w.id === id);

// 加入佇列（若已在佇列中則移除，切換效果）
const addToQueue = (weapon: any) => {
  const idx = weaponQueue.value.findIndex((w) => w.id === weapon.id);
  if (idx !== -1) {
    weaponQueue.value.splice(idx, 1);
  } else {
    weaponQueue.value.push({ ...weapon });
  }
};

// 從佇列移除
const removeFromQueue = (idx: number) => {
  weaponQueue.value.splice(idx, 1);
};

// 上移
const moveUp = (idx: number) => {
  if (idx === 0) return;
  const tmp = weaponQueue.value[idx - 1];
  weaponQueue.value[idx - 1] = weaponQueue.value[idx];
  weaponQueue.value[idx] = tmp;
};

// 下移
const moveDown = (idx: number) => {
  if (idx >= weaponQueue.value.length - 1) return;
  const tmp = weaponQueue.value[idx + 1];
  weaponQueue.value[idx + 1] = weaponQueue.value[idx];
  weaponQueue.value[idx] = tmp;
};

// 清空佇列
const clearQueue = () => {
  weaponQueue.value = [];
  isApplied.value = false;
  emits("select-weapon", []);
};

// 套用佇列至自動戰鬥
const applyQueue = () => {
  emits("select-weapon", [...weaponQueue.value]);
  isApplied.value = true;
};

// 事件轉發
const handleEquipmentCheck = () => emits("equipment-check");
const updateCheckWeapon = () => emits("update-check-weapon");
const updateCheckArmor = () => emits("update-check-armor");
</script>

<style scoped>
.input-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
  font-weight: 600;
}

/* 武器池 */
.weapon-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 44px;
  padding: 8px;
  background: #1a1d22;
  border: 1px solid #2d2f31;
  border-radius: 6px;
  max-height: 180px;
  overflow-y: auto;
}

.weapon-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 16px;
  border: 1px solid #3a3d42;
  background: #23262b;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  user-select: none;
}

.weapon-chip:hover {
  border-color: #409eff;
  background: #1a2a3a;
}

.weapon-chip.in-queue {
  border-color: #67c23a;
  background: #1a2e1a;
  color: #67c23a;
}

.weapon-chip-name {
  font-weight: 600;
}

.weapon-chip-meta {
  color: #606266;
  font-size: 11px;
}

.weapon-chip.in-queue .weapon-chip-meta {
  color: #4a9a4a;
}

.chip-check {
  color: #67c23a;
  font-size: 14px;
}

.empty-pool {
  color: #606266;
  font-size: 12px;
  padding: 8px;
}

/* 佇列區 */
.queue-section {
  margin-top: 16px;
  border: 1px solid #2d2f31;
  border-radius: 8px;
  padding: 12px;
  background: #141619;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.queue-title {
  font-size: 13px;
  font-weight: 600;
  color: #c0c4cc;
}

.empty-queue {
  text-align: center;
  color: #606266;
  font-size: 12px;
  padding: 16px 0;
  border: 1px dashed #3a3d42;
  border-radius: 6px;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #1e2127;
  border: 1px solid #3a3d42;
  border-radius: 6px;
  transition: background 0.2s;
}

.queue-item:hover {
  background: #23262b;
}

.queue-order {
  min-width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.queue-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.queue-name {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
}

.queue-meta {
  font-size: 11px;
  color: #606266;
  margin-top: 2px;
}

.queue-actions {
  display: flex;
  gap: 4px;
}
</style>
