const ElMessage = (msg) => console.log("[自動化訊息]", msg);
ElMessage.success = (msg) => console.log("[自動化成功]", msg);
ElMessage.warning = (msg) => console.warn("[自動化警告]", msg);
ElMessage.error = (msg) => console.error("[自動化錯誤]", msg);
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
        const elapsedSec = this.actionTimeSeconds();
        const targetSeconds = 10; // 固定為 10 秒

        console.log(
          `[狀態檢查-休息] ${this.profile.name} 已進行 ${Math.floor(
            elapsedSec
          )} 秒 / 目標 ${targetSeconds} 秒`
        );

        if (elapsedSec >= targetSeconds) {
          let profile = await this.user.restComplete();
          if (profile) {
            this.profile = profile;
            await this.setProfileInfo(profile);
            ElMessage("休息時間到！確認醒來。");
          }

          // 醒來後檢查是否仍低於安全門檻 (極限保護設定) 且模式為休息
          const hpLimit = this.setting?.hp || 0;
          const spLimit = this.setting?.sp || 0;
          const hpMode = this.setting?.hpRecoveryMode || "rest";
          const spMode = this.setting?.spRecoveryMode || "rest";

          const needHpRest =
            this.profile.hp < this.profile.fullHp &&
            this.profile.hp <= hpLimit &&
            hpMode === "rest";
          const needSpRest =
            this.profile.sp < this.profile.fullSp &&
            this.profile.sp <= spLimit &&
            spMode === "rest";

          if (needHpRest || needSpRest) {
            ElMessage(
              "狀態仍低於保護門檻且為休息模式，繼續進行下一輪 10 秒休息..."
            );
            await this.rest();
            return false;
          } else {
            ElMessage("狀態已高於保護門檻，可以出發！");
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
