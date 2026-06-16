import map from "../common/mapping";
import specialMap from "../common/specialMap";
import { ElMessage } from "element-plus";
import sleep from "./sleep";

class autoBattleChecker {
  constructor(
    profile,
    user,
    setProfileInfo,
    setting,
    weaponCheckTag,
    myWeaponChecker,
    medicineCheckTag,
    medicineSetting
  ) {
    this.profile = profile;
    this.user = user;
    this.setProfileInfo = setProfileInfo;
    this.setting = setting;
    this.weaponCheckTag = weaponCheckTag;
    this.myWeaponChecker = myWeaponChecker;
    this.medicineCheckTag = medicineCheckTag;
    this.medicineSetting = medicineSetting;
  }

  safeMove = async (mapId) => {
    const moveRes = await this.user.move(mapId);

    const isConflict =
      moveRes?.error &&
      (moveRes.status === 409 ||
        (moveRes.message && moveRes.message.includes("409")));

    if (isConflict) {
      ElMessage("移動衝突 (409)，嘗試確認落地...");
      const arriveRes = await this.user.moveComplete();
      if (arriveRes && !arriveRes.error && arriveRes.zoneName) {
        this.setProfileInfo(arriveRes);
        this.profile = arriveRes;
        ElMessage("已自動確認落地！");
        return arriveRes;
      }
    }

    if (moveRes && !moveRes.error) {
      this.setProfileInfo(moveRes);
      this.profile = moveRes;
    }
    return moveRes;
  };

  checkSetting = async () => {
    try {
      console.log("checkSetting");
      if (this.profile.hp <= 0) {
        if (this.profile.zoneName === "起始之鎮") {
          ElMessage("偵測到死亡回城，等待 3 秒後直接出發前往目標地圖...");
          await sleep(3000);
          await this.safeMove(getMapIdByName(this.setting.map));
          return false;
        }
        // 死亡不用休息，繞過 HP/SP 檢查，但仍需確保在地圖上
        if (!(await this.checkMap())) return false;
        if (!this.weaponCheckTag) return true;
        if (!(await this.myWeaponChecker.checkEquipment())) return false;
        return true;
      }
      if (!(await this.checkHpSp())) return false;
      if (!(await this.checkMap())) return false;
      if (!this.weaponCheckTag) return true;
      if (!(await this.myWeaponChecker.checkEquipment())) return false;

      return true;
    } catch (error) {
      console.log(error);
      if (error === "CRITICAL_STOP_NO_WEAPON") {
        throw error;
      }
      return false;
    }
  };

  checkHpSp = async () => {
    const hpMode = this.setting.hpRecoveryMode || "rest";
    const spMode = this.setting.spRecoveryMode || "rest";

    // 1. 檢查 HP
    if (this.profile.hp <= this.setting.hp) {
      if (hpMode === "medicine") {
        ElMessage("HP 低於設定，嘗試吃藥...");
        const eatSuccess = await this.eatMedicine(
          this.medicineSetting.medicineHpId,
          this.medicineSetting.medicineHpQuantity
        );
        if (eatSuccess && this.profile.hp > this.setting.hp) {
          ElMessage("HP 吃藥成功補滿至門檻以上。");
        } else {
          ElMessage("HP 補品不足或補不滿，自動降級為休息！");
          await this.rest();
          return false;
        }
      } else {
        ElMessage("HP 低於門檻，自動休息！");
        await this.rest();
        return false;
      }
    }

    // 2. 檢查 SP
    if (this.profile.sp <= this.setting.sp) {
      if (spMode === "medicine") {
        ElMessage("SP 低於設定，嘗試吃藥...");
        const eatSuccess = await this.eatMedicine(
          this.medicineSetting.medicineSpId,
          this.medicineSetting.medicineSpQuantity
        );
        if (eatSuccess && this.profile.sp > this.setting.sp) {
          ElMessage("SP 吃藥成功補滿至門檻以上。");
        } else {
          ElMessage("SP 補品不足或補不滿，自動降級為休息！");
          await this.rest();
          return false;
        }
      } else {
        ElMessage("SP 低於門檻，自動休息！");
        await this.rest();
        return false;
      }
    }

    return true;
  };

  checkMap = async () => {
    if (this.setting.map === "") {
      ElMessage("請選地圖！");
      return false;
    }

    // 1. 如果角色當前在「起始之鎮」
    if (this.profile.zoneName === "起始之鎮") {
      // 檢查是否需要休息（血量或魔量沒滿）
      if (
        this.profile.hp < this.profile.fullHp ||
        this.profile.sp < this.profile.fullSp
      ) {
        ElMessage("回城休息中，補滿狀態...");
        await this.rest(); // 發起休息
        return false; // 等待休息完成
      }
    }

    // 2. 判斷是否到秘境
    if (
      specialMap.includes(this.setting.map) &&
      this.profile.zoneName != this.setting.map
    ) {
      if (await this.checkSpecialMap()) {
        return true;
      } else {
        return false;
      }
    }

    // 3. 移動到目標地圖
    if (this.profile.zoneName !== this.setting.map) {
      ElMessage("地圖不對，前往目標地圖！");
      await this.safeMove(getMapIdByName(this.setting.map));
      ElMessage("移動！");
      return false;
    }

    // 4. 層數上限檢查
    // 只有在 setting.mapLevel 大於 0 的時候才進行層數上限檢查，若為 0 則代表無上限
    if (
      this.setting.mapLevel > 0 &&
      this.profile.huntStage >= this.setting.mapLevel
    ) {
      ElMessage(
        `已達到目標層數 (${this.profile.huntStage}F >= ${this.setting.mapLevel}F)，正在回城休息...`
      );
      await this.safeMove(0); // 移回起始之鎮 (0)
      ElMessage("回城！");
      return false;
    }

    return true;
  };

  checkSpecialMap = async () => {
    switch (this.setting.map) {
      case "草原秘徑":
        //還沒到秘境
        if (this.profile.zoneName == "大草原") {
          if (Number(this.profile.huntStage) == 16) {
            let profile = await this.user.path(
              getMapIdByName(this.setting.map)
            );
            this.setProfileInfo(profile);
            ElMessage("進入秘境！");
            return true;
          } else if (Number(this.profile.huntStage) > 16) {
            ElMessage("層數超過！");
            await this.safeMove(0);
            ElMessage("回城！");
          }
          return true;
        } else {
          ElMessage("地圖不對！");
          await this.safeMove(getMapIdByName("大草原"));
          ElMessage("移動！");

          return false;
        }

      case "被詛咒的寺院":
        //還沒到秘境
        if (this.profile.zoneName == "猛牛原") {
          if (Number(this.profile.huntStage) == 18) {
            let profile = await this.user.path(
              getMapIdByName(this.setting.map)
            );
            this.setProfileInfo(profile);
            ElMessage("進入秘境！");
            return true;
          } else if (Number(this.profile.huntStage) > 18) {
            ElMessage("層數超過！");
            await this.safeMove(0);
            ElMessage("回城！");
          }
          return true;
        } else {
          ElMessage("地圖不對！");
          await this.safeMove(getMapIdByName("猛牛原"));
          ElMessage("移動！");

          return false;
        }

      default:
        return false;
    }
  };

  rest = async () => {
    ElMessage("開始休息！");
    this.setProfileInfo(await this.user.rest());
  };

  eatMedicine = async (medicineId, medicineQuantity) => {
    if (!medicineId) {
      ElMessage("沒補品！");
      return false;
    }
    ElMessage("開始吃補品！");
    let { profile } = await this.user.eatMedicine(medicineId, medicineQuantity);
    if (!profile) return false;
    this.setProfileInfo(profile);
    this.profile = profile;

    return true;
  };
}

function getMapIdByName(name) {
  const found = map.find((item) => item.name === name);
  return found ? found.id : null;
}

export default autoBattleChecker;
