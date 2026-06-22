import map, { secretRealmConfig } from "../common/mapping";
const ElMessage = (msg) => console.log("[自動化訊息]", msg);
ElMessage.success = (msg) => console.log("[自動化成功]", msg);
ElMessage.warning = (msg) => console.warn("[自動化警告]", msg);
ElMessage.error = (msg) => console.error("[自動化錯誤]", msg);
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
    medicineSetting,
    allAccounts
  ) {
    this.profile = profile;
    this.user = user;
    this.setProfileInfo = setProfileInfo;
    this.setting = setting;
    this.weaponCheckTag = weaponCheckTag;
    this.myWeaponChecker = myWeaponChecker;
    this.medicineCheckTag = medicineCheckTag;
    this.medicineSetting = medicineSetting;
    this.allAccounts = allAccounts;
  }

  safeMove = async (mapId) => {
    const pMode = this.setting?.partyMode;
    const isMember = pMode && pMode.enabled && !pMode.isLeader;

    // 如果是組隊中的隊員，且目前本機顯示在起始之鎮，而目標不是起始之鎮
    // 隊長可能已帶隊移動，將隊員拉過去了，所以此時先嘗試確認落地一次
    if (
      isMember &&
      getMapIdByName(this.profile.zoneName) === 0 &&
      mapId !== 0
    ) {
      console.log("[隊員落地檢查] 隊長可能已帶隊移動，嘗試直接確認落地...");
      const arriveRes = await this.user.moveComplete();
      if (
        arriveRes &&
        !arriveRes.error &&
        getMapIdByName(arriveRes.zoneName) !== 0
      ) {
        ElMessage("隊員跟隨：確認落地成功，抵達 " + arriveRes.zoneName);
        this.setProfileInfo(arriveRes);
        this.profile = arriveRes;
        return arriveRes;
      }
    }

    // 統一以設定表 ID 進行回城與水晶判定
    if (mapId === 0 && this.setting.useTeleportCrystal) {
      const currentAcc = this.allAccounts?.find(
        (a) => a.token === this.user.token
      );
      const crystal = currentAcc?.items?.items?.find(
        (item) => item.item_id === 173 || item.id === 173
      );
      const quantity = crystal ? crystal.quantity : 0;
      if (quantity > 0) {
        ElMessage("偵測到啟用轉移水晶且庫存 > 0，發送傳送水晶請求...");
        const useRes = await this.user.useTeleportCrystal();
        if (useRes && !useRes.error) {
          ElMessage("使用轉移水晶回城成功！");
          const profile = await this.user.getProfile();
          if (profile) {
            this.setProfileInfo(profile);
            this.profile = profile;
          }
          return profile;
        } else {
          ElMessage.error(
            "使用轉移水晶失敗: " + (useRes?.message || "未知錯誤")
          );
        }
      } else {
        ElMessage("轉移水晶庫存不足，退化為普通回城。");
      }
    }

    let moveRes = await this.user.move(mapId);

    const isConflict =
      moveRes?.error &&
      (moveRes.status === 409 ||
        (moveRes.message && moveRes.message.includes("409")));

    if (isConflict) {
      ElMessage("移動衝突 (409)，嘗試確認落地...");

      const arriveRes = await this.user.moveComplete();

      if (arriveRes && !arriveRes.error) {
        this.setProfileInfo(arriveRes);
        this.profile = arriveRes;

        const targetMap = map.find((item) => item.id === mapId);
        const alreadyThere =
          mapId === 0
            ? getMapIdByName(arriveRes.zoneName) === 0
            : targetMap && arriveRes.zoneName === targetMap.name;

        if (alreadyThere) {
          moveRes = arriveRes;
        } else {
          await sleep(500);
          moveRes = await this.user.move(mapId);
          if (moveRes && !moveRes.error) {
            this.setProfileInfo(moveRes);
            this.profile = moveRes;
          }
        }
      }
    } else {
      if (moveRes && !moveRes.error) {
        this.setProfileInfo(moveRes);
        this.profile = moveRes;
      }
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

    console.log(
      `[HP/SP 檢查] ${this.profile.name} - 當前 HP: ${this.profile.hp}/${this.profile.fullHp} (設定門檻: ${this.setting.hp}), SP: ${this.profile.sp}/${this.profile.fullSp} (設定門檻: ${this.setting.sp})`
    );

    // 1. 檢查 HP
    if (
      this.profile.hp < this.profile.fullHp &&
      this.profile.hp <= this.setting.hp
    ) {
      if (hpMode === "medicine" && this.medicineCheckTag) {
        ElMessage("HP 低於設定，嘗試吃藥...");
        const eatSuccess = await this.eatMedicine(
          this.medicineSetting.medicineHpId,
          this.medicineSetting.medicineHpQuantity
        );
        if (eatSuccess) {
          ElMessage("HP 吃藥成功，繼續下個步驟。");
        } else {
          ElMessage("HP 補品不足或使用失敗，自動降級為休息！");
          await this.rest();
          return false;
        }
      } else {
        ElMessage("HP 低於門檻 (或吃藥未啟動)，自動休息！");
        await this.rest();
        return false;
      }
    }

    // 2. 檢查 SP
    if (
      this.profile.sp < this.profile.fullSp &&
      this.profile.sp <= this.setting.sp
    ) {
      if (spMode === "medicine" && this.medicineCheckTag) {
        ElMessage("SP 低於設定，嘗試吃藥...");
        const eatSuccess = await this.eatMedicine(
          this.medicineSetting.medicineSpId,
          this.medicineSetting.medicineSpQuantity
        );
        if (eatSuccess) {
          ElMessage("SP 吃藥成功，繼續下個步驟。");
        } else {
          ElMessage("SP 補品不足或使用失敗，自動降級為休息！");
          await this.rest();
          return false;
        }
      } else {
        ElMessage("SP 低於門檻 (或吃藥未啟動)，自動休息！");
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

    const currentMapId = getMapIdByName(this.profile.zoneName);

    // 1. 如果角色當前在「起始之鎮」
    if (currentMapId === 0) {
      const hpLimit = this.setting.hp || 0;
      const spLimit = this.setting.sp || 0;
      const hpMode = this.setting.hpRecoveryMode || "rest";
      const spMode = this.setting.spRecoveryMode || "rest";

      const needHpRest =
        this.profile.hp < this.profile.fullHp &&
        this.profile.hp <= hpLimit &&
        hpMode === "rest";
      const needSpRest =
        this.profile.sp < this.profile.fullSp &&
        this.profile.sp <= spLimit &&
        spMode === "rest";

      // 合併自動休息：直接以極限保護絕對值判定是否需要留在城內休息
      if (needHpRest || needSpRest) {
        ElMessage("低於極限保護設定且模式為休息，自動留在起始之鎮補狀態...");
        await this.rest();
        return false;
      }

      // 起始之鎮商店自動補貨傳送水晶
      if (this.setting.useTeleportCrystal) {
        const currentAcc = this.allAccounts?.find(
          (a) => a.token === this.user.token
        );
        const crystal = currentAcc?.items?.items?.find(
          (item) => item.item_id === 173 || item.id === 173
        );
        const count = crystal ? crystal.quantity : 0;
        if (count < 2) {
          const buyQty = 10 - count;
          ElMessage(
            `偵測到轉移水晶庫存不足 (現有 ${count} 個)，啟動自動補貨至 10 個...`
          );
          for (let i = 0; i < buyQty; i++) {
            ElMessage(`正在購買轉移水晶 (${i + 1}/${buyQty})...`);
            const buyRes = await this.user.buyShopItem(22, 1); // 22 是轉移水晶的 shopItemId
            if (buyRes && !buyRes.error) {
              if (crystal) crystal.quantity += 1;
            } else {
              ElMessage.error(
                "購買轉移水晶失敗: " + (buyRes?.message || "未知錯誤")
              );
              break;
            }
            await sleep(800);
          }
          const itemsRes = await this.user.item();
          if (itemsRes && currentAcc) {
            currentAcc.items.equipments = itemsRes.equipments || [];
            currentAcc.items.items = itemsRes.items || [];
          }
        }
      }
    }

    const targetMapId = getMapIdByName(this.setting.map);

    // 2. 判斷是否為秘徑地圖 (1001 草原秘徑, 2001 被詛咒的寺院, 4001 菇菇仙境)
    const isSpecialMap =
      targetMapId === 1001 || targetMapId === 2001 || targetMapId === 4001;
    if (isSpecialMap && currentMapId !== targetMapId) {
      if (await this.checkSpecialMap()) {
        return true;
      } else {
        return false;
      }
    }

    // 3. 移動到目標地圖
    if (currentMapId !== targetMapId) {
      const pMode = this.setting.partyMode;
      if (
        currentMapId === 0 &&
        pMode &&
        pMode.enabled &&
        !pMode.ignoreMemberStatus
      ) {
        if (this.allAccounts) {
          if (!pMode.isLeader) {
            // 隊員端：等待隊長出發
            const leaderAcc = this.allAccounts.find((a) => {
              const aParty = a.automation?.battle?.setting?.partyMode;
              return (
                aParty &&
                aParty.enabled &&
                aParty.isLeader &&
                getMapIdByName(a.automation.battle.setting.map) === targetMapId
              );
            });
            if (leaderAcc) {
              const isLeaderInTown =
                getMapIdByName(leaderAcc.profile.zoneName) === 0;
              const isLeaderMoving = leaderAcc.profile.actionStatus === "移動";
              if (isLeaderInTown && !isLeaderMoving) {
                ElMessage("組隊同步：等待隊長出發...");
                return false;
              }
            }
          } else {
            // 隊長端：等待所有我方託管成員在起始之鎮就緒
            const partyStatus = await this.user.getPartyStatus();
            if (partyStatus && partyStatus.party && partyStatus.party.members) {
              const members = partyStatus.party.members;
              let allReady = true;

              for (const member of members) {
                if (
                  Number(member.user_id) === Number(this.profile.id) ||
                  Number(member.user_id) === Number(this.profile.userId) ||
                  Number(member.user_id) === Number(this.profile.user_id)
                ) {
                  continue;
                }

                const memberAcc = this.allAccounts.find(
                  (a) =>
                    (a.profile.id &&
                      Number(a.profile.id) === Number(member.user_id)) ||
                    (a.profile.userId &&
                      Number(a.profile.userId) === Number(member.user_id)) ||
                    (a.profile.user_id &&
                      Number(a.profile.user_id) === Number(member.user_id))
                );

                if (memberAcc) {
                  if (getMapIdByName(memberAcc.profile.zoneName) !== 0) {
                    allReady = false;
                    break;
                  }

                  const isBusy =
                    memberAcc.profile.actionStatus !== "空閒" &&
                    memberAcc.profile.actionStatus !== "休息" &&
                    memberAcc.profile.actionStatus !== "戰鬥";
                  if (isBusy) {
                    allReady = false;
                    break;
                  }

                  const mSetting = memberAcc.automation.battle.setting;
                  const hpLimit = mSetting.hp || 100;
                  const spLimit = mSetting.sp || 150;
                  const isHpOk =
                    member.hp >= member.max_hp || member.hp > hpLimit;
                  const isSpOk =
                    member.mp >= member.max_mp || member.mp > spLimit;
                  if (!isHpOk || !isSpOk) {
                    allReady = false;
                    break;
                  }

                  const minDur = pMode.minDurability || 10;
                  const memberEquips = memberAcc.items.equipments || [];
                  const equippedWeapons = memberEquips.filter(
                    (w) => w.status === "已裝備"
                  );
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
                  const equippedWeapon = equippedWeapons.find((w) =>
                    weaponTypes.includes(w.typeName)
                  );
                  if (equippedWeapon) {
                    if (equippedWeapon.durability < minDur) {
                      allReady = false;
                      break;
                    }
                  } else {
                    if (!pMode.allowEmptyHanded) {
                      allReady = false;
                      break;
                    }
                  }
                }
              }

              if (!allReady) {
                ElMessage("組隊同步：等待隊友回村重整...");
                return false;
              }
            }
          }
        }
      }

      ElMessage("地圖不對，前往目標地圖！");
      await this.safeMove(targetMapId);
      ElMessage("移動！");
      return false;
    }

    // 4. 層數上限檢查
    const pMode = this.setting.partyMode;
    const isInParty = pMode && pMode.enabled;
    if (
      !isInParty &&
      this.setting.mapLevel > 0 &&
      this.profile.huntStage >= this.setting.mapLevel
    ) {
      ElMessage(
        `已達到目標層數 (${this.profile.huntStage}F >= ${this.setting.mapLevel}F)，正在回城休息...`
      );
      await this.safeMove(0);
      ElMessage("回城！");
      return false;
    }

    return true;
  };

  checkSpecialMap = async () => {
    const targetMapId = getMapIdByName(this.setting.map);
    const currentMapId = getMapIdByName(this.profile.zoneName);
    const floor = Number(this.profile.huntStage || 0);

    const config = secretRealmConfig[targetMapId];
    if (!config) return false;

    // 1. 如果角色目前不在母地圖上
    if (currentMapId !== config.parentId) {
      ElMessage(`地圖不對，前往${config.parentName}爬樓！`);
      await this.safeMove(config.parentId);
      return false;
    }

    // 2. 🌟 秘徑狀態鎖：若已身處秘徑，直接視為已抵達，解鎖戰鬥！
    if (this.profile.inSecretRealm) {
      return true;
    }

    // 3. 樓層入口檢查
    if (floor === config.enterFloor) {
      ElMessage(
        `[秘徑] 抵達${config.parentName} ${config.enterFloor}F，等待主控流程進入秘徑...`
      );
      return false;
    } else if (floor > config.enterFloor) {
      ElMessage("層數超過！安全回城重試...");
      await this.safeMove(0);
      return false;
    }

    // 4. 1F 到 (enterFloor - 1)F 之間，正常趕路爬樓中
    return true;
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
    const qty = Math.max(1, Number(medicineQuantity) || 1);
    ElMessage(`開始吃補品 (預計吃 ${qty} 個)...`);

    let latestProfile = null;

    for (let i = 0; i < qty; i++) {
      if (qty > 1) {
        ElMessage(`使用補品中 (${i + 1}/${qty})...`);
      } else {
        ElMessage("使用補品中...");
      }

      let res = await this.user.eatMedicine(medicineId);
      if (res && res.profile) {
        latestProfile = res.profile;
        this.setProfileInfo(res.profile);
        this.profile = res.profile;
      } else {
        ElMessage("補品不足或使用失敗！");
        break;
      }

      // 吃完一個後，延遲 800 毫秒以防太頻繁發起 API 導致 429 限制
      if (i < qty - 1) {
        await sleep(800);
      }
    }

    return latestProfile ? true : false;
  };
}

function getMapIdByName(name) {
  const found = map.find((item) => item.name === name);
  return found ? found.id : null;
}

export default autoBattleChecker;
