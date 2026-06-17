import { ElMessage } from "element-plus";
import moment from "moment";

class statusCheck {
  constructor(profile, setProfileInfo, user, setting) {
    this.profile = profile;
    this.setProfileInfo = setProfileInfo;
    this.user = user;
    this.setting = setting;
    this.forgeStatus = true;
  }

  checkStatus = async () => {
    const offset = this.profile.serverOffsetMs || 0;
    const adjustedNow = () => moment().add(offset, "ms");

    switch (this.profile.actionStatus) {
      case "休息": {
        if (this.setting?.autoRest) {
          const pMode = this.setting?.partyMode;
          if (pMode && pMode.enabled && !pMode.isLeader) {
            // 隊員不主動停止休息，等待隊長統一停止
            console.log(
              `[狀態檢查-自動休息] ${this.profile.name} 是隊員，等待隊長停止休息...`
            );
            return false;
          }

          let targetSeconds = Number(this.setting.autoRestSeconds || 0);
          if (targetSeconds <= 0) {
            const seed = moment(this.profile.actionStart).valueOf();
            targetSeconds = 20 + (seed % 21);
          }

          const elapsedSec = this.actionTimeSeconds();
          console.log(
            `[狀態檢查-自動休息] ${this.profile.name} 已進行 ${Math.floor(
              elapsedSec
            )} 秒 / 目標 ${targetSeconds} 秒`
          );

          if (elapsedSec >= targetSeconds) {
            const hpPercent = (this.profile.hp / this.profile.fullHp) * 100;
            const mpPercent = (this.profile.sp / this.profile.fullSp) * 100;
            const targetPercent = Number(this.setting.autoRestPercent ?? 90);

            // 檢查組隊模式下成員是否就緒
            let partyMembersReady = true;
            if (pMode && pMode.enabled && pMode.isLeader) {
              try {
                const partyStatus = await this.user.getPartyStatus();
                if (
                  partyStatus &&
                  partyStatus.party &&
                  partyStatus.party.members
                ) {
                  const members = partyStatus.party.members;
                  for (const member of members) {
                    const isSelf =
                      (this.profile.id &&
                        Number(member.user_id) === Number(this.profile.id)) ||
                      (this.profile.userId &&
                        Number(member.user_id) ===
                          Number(this.profile.userId)) ||
                      (this.profile.user_id &&
                        Number(member.user_id) ===
                          Number(this.profile.user_id));

                    if (isSelf) continue;

                    const memberHpPercent = member.max_hp
                      ? (member.hp / member.max_hp) * 100
                      : 100;
                    const memberMpPercent = member.max_mp
                      ? (member.mp / member.max_mp) * 100
                      : 100;

                    if (
                      memberHpPercent < targetPercent ||
                      memberMpPercent < targetPercent
                    ) {
                      console.log(
                        `[狀態檢查-自動休息評估] 隊員 ${
                          member.character_name
                        } 尚未就緒 (HP: ${Math.round(
                          memberHpPercent
                        )}%, SP: ${Math.round(
                          memberMpPercent
                        )}%)，隊長繼續休息...`
                      );
                      partyMembersReady = false;
                      break;
                    }
                  }
                }
              } catch (e) {
                console.error("[狀態檢查-自動休息評估] 獲取隊伍狀態失敗:", e);
              }
            }

            if (
              hpPercent >= targetPercent &&
              mpPercent >= targetPercent &&
              partyMembersReady
            ) {
              ElMessage(
                `已休息 ${Math.floor(
                  elapsedSec
                )} 秒 (目標 ${targetSeconds} 秒)，且全員狀態已達標。停止休息！`
              );
              let profile = await this.user.restComplete();
              if (profile) {
                this.profile = profile;
                await this.setProfileInfo(profile);
              }
              return true;
            } else {
              console.log(
                `[狀態檢查-自動休息評估] 狀態未達標，繼續在伺服器休息... (HP: ${Math.round(
                  hpPercent
                )}%, SP: ${Math.round(
                  mpPercent
                )}%, 隊員就緒: ${partyMembersReady})`
              );
              return false;
            }
          }
          ElMessage(
            `休息中，已進行 ${Math.floor(
              elapsedSec
            )} 秒 / 目標 ${targetSeconds} 秒`
          );
          return false;
        }

        const reqDuration = this.setting?.restDuration ?? 10;
        const elapsedMin = this.actionTime();
        console.log(
          `[狀態檢查-普通休息] ${this.profile.name} 已進行 ${elapsedMin} 分 / 目標 ${reqDuration} 分`
        );

        if (elapsedMin >= reqDuration) {
          let profile = await this.user.restComplete();
          if (profile) {
            this.profile = profile;
            await this.setProfileInfo(profile);
            ElMessage("休息完成！");
          }
          if (this.profile.sp < this.profile.fullSp) {
            ElMessage("體力沒滿繼續睡");
            this.rest();
            return false;
          } else {
            return true;
          }
        }
        ElMessage("休息中！");
        return false;
      }

      case "移動": {
        const arrivalTime = moment(this.profile.actionStart);
        const remainingMs = arrivalTime.diff(adjustedNow());
        // 只要剩餘時間小於 15 秒，就判定已抵達並嘗試落地 (容忍 15 秒時鐘偏差)
        const isArrived = remainingMs <= 15000;
        console.log(
          `[狀態檢查-移動] ${
            this.profile.name
          } 目標抵達時間: ${arrivalTime.toISOString()} | 當前伺服器對齊時間: ${adjustedNow().toISOString()} | 剩餘時間: ${Math.ceil(
            remainingMs / 1000
          )} 秒 | 是否嘗試落地: ${isArrived}`
        );

        if (isArrived) {
          let profile = await this.user.moveComplete();
          if (profile && !profile.error) {
            this.profile = profile;
            await this.setProfileInfo(profile);
            ElMessage("移動完成，確認落地！");
            return true;
          } else {
            ElMessage("確認落地失敗，將於下次回合重試...");
            return false;
          }
        }
        {
          let remaining = moment.duration(remainingMs);
          ElMessage(
            `移動中！剩餘時間：${remaining.minutes()} 分 ${remaining.seconds()} 秒`
          );
          return false;
        }
      }

      case "重生":
        console.log(
          `[狀態檢查-重生] ${
            this.profile.name
          } 重生已耗時: ${this.actionTime()} 分`
        );
        if (this.actionTime() >= 10) {
          this.setProfileInfo(await this.user.restComplete());
          ElMessage("復活！");
          return true;
        }
        ElMessage(`甦醒中！(耗時：${this.actionTime()})分`);
        return false;

      case "鍛造":
        console.log(
          `[狀態檢查-鍛造] ${
            this.profile.name
          } 鍛造剩餘時間: ${this.forgeTime()} 秒`
        );
        if (this.forgeTime() < -5) {
          this.setProfileInfo(await this.user.forgeComplete());
          ElMessage("鍛造完成");
          this.forgeStatus = true;
        } else {
          this.forgeStatus = false;
          ElMessage(`鍛造中！(耗時：${this.actionTime()})分，背景共存中`);
        }
        return true;

      case "採礦":
        ElMessage(`角色正在採礦中，自動戰鬥/移動暫停等待`);
        return false;

      default:
        ElMessage(this.profile.actionStatus);
        return true;
    }
  };

  actionTime = () => {
    const offset = this.profile.serverOffsetMs || 0;
    const clientTime = moment().add(offset, "ms");
    let diff = moment.duration(
      clientTime.diff(moment(this.profile.actionStart))
    );
    return diff.minutes();
  };

  actionTimeSeconds = () => {
    const offset = this.profile.serverOffsetMs || 0;
    const clientTime = moment().add(offset, "ms");
    let diff = moment.duration(
      clientTime.diff(moment(this.profile.actionStart))
    );
    return diff.asSeconds();
  };

  rest = async () => {
    ElMessage("開始休息！");
    let profile = await this.user.rest();
    this.profile = profile;
    await this.setProfileInfo(profile);
  };

  forgeTime = () => {
    const offset = this.profile.serverOffsetMs || 0;
    const clientTime = moment().add(offset, "ms");
    let diff = moment.duration(
      moment(this.profile.forgingCompletionTime).diff(clientTime)
    );
    return diff.asSeconds();
  };
}

export default statusCheck;
