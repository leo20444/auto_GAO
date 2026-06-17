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
    switch (this.profile.actionStatus) {
      case "休息": {
        if (this.setting?.autoRest) {
          let targetSeconds = Number(this.setting.autoRestSeconds || 0);
          if (targetSeconds <= 0) {
            // 用 restStartedAt 的時間戳當 Seed，為當前休息階段產生一個固定且隨機的 20~40 秒目標
            const seed = moment(this.profile.actionStart).valueOf();
            targetSeconds = 20 + (seed % 21);
          }

          if (this.actionTimeSeconds() >= targetSeconds) {
            ElMessage(
              `已休息 ${Math.floor(
                this.actionTimeSeconds()
              )} 秒 (目標 ${targetSeconds} 秒)，停止休息並檢查狀態...`
            );
            let profile = await this.user.restComplete();
            if (profile) {
              this.profile = profile;
              await this.setProfileInfo(profile);
            }

            const hpPercent = (this.profile.hp / this.profile.fullHp) * 100;
            const mpPercent = (this.profile.sp / this.profile.fullSp) * 100;
            const targetPercent = Number(this.setting.autoRestPercent ?? 90);

            if (hpPercent >= targetPercent && mpPercent >= targetPercent) {
              ElMessage(
                `HP (${Math.round(hpPercent)}%) 與 SP (${Math.round(
                  mpPercent
                )}%) 已達到 ${targetPercent}%，繼續戰鬥/移動！`
              );
              return true;
            } else {
              ElMessage(
                `狀態未達 ${targetPercent}% (HP: ${Math.round(
                  hpPercent
                )}%, SP: ${Math.round(mpPercent)}%)，重新開始休息...`
              );
              await this.rest();
              return false;
            }
          }
          ElMessage(
            `休息中，已進行 ${Math.floor(
              this.actionTimeSeconds()
            )} 秒 / 目標 ${targetSeconds} 秒`
          );
          return false;
        }

        const reqDuration = this.setting?.restDuration ?? 10;
        if (this.actionTime() >= reqDuration) {
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

      case "移動":
        if (moment().isAfter(moment(this.profile.actionStart))) {
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
          let remaining = moment.duration(
            moment(this.profile.actionStart).diff(moment())
          );
          ElMessage(
            `移動中！剩餘時間：${remaining.minutes()} 分 ${remaining.seconds()} 秒`
          );
          return false;
        }

      case "重生":
        if (this.actionTime() >= 10) {
          this.setProfileInfo(await this.user.restComplete());
          ElMessage("復活！");
          return true;
        }
        ElMessage(`甦醒中！(耗時：${this.actionTime()})分`);
        return false;

      case "鍛造":
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
    let diff = moment.duration(moment().diff(moment(this.profile.actionStart)));
    return diff.minutes();
  };

  actionTimeSeconds = () => {
    let diff = moment.duration(moment().diff(moment(this.profile.actionStart)));
    return diff.asSeconds();
  };

  rest = async () => {
    ElMessage("開始休息！");
    let profile = await this.user.rest();
    this.profile = profile;
    await this.setProfileInfo(profile);
  };

  forgeTime = () => {
    let diff = moment.duration(
      moment(this.profile.forgingCompletionTime).diff(moment())
    );
    return diff.seconds();
  };
}

export default statusCheck;
