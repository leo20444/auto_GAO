import axios from "axios";

const baseurl = "https://gunart-backend.onrender.com/api";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function user(inputToken) {
  this.token = inputToken;

  const getHeaders = () => {
    // 確保 token 不會重複加上 Bearer 字樣
    const cleanToken = this.token.replace("Bearer ", "");
    return {
      Authorization: `Bearer ${cleanToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  };

  // 區域對照表：舊版 ID -> 新版 Key
  const zoneMapping = {
    0: "starting_town",
    1: "great_plains",
    2: "bull_garden",
    3: "childrens_park",
    4: "mushroom_garden",
    5: "yuanmingyuan",
  };

  // 輔助函式：標準化資料結構，讓舊的元件能繼續運作
  const normalizeProfile = (character, towerStatus, activeJob, mineStatus) => {
    if (!character) return null;

    // --- 並行狀態陣列（可同時存在多個）---
    // 情境一：戰鬥 + 鍛造（不能採礦）
    // 情境二：採礦 + 鍛造（不能戰鬥）
    // → 後端本身就保證互斥，前端直接反映 API 資料即可
    const activeStatuses = [];
    let actionStart = null;
    let forgingCompletionTime = null;

    // 塔狀態：
    //   restStartedAt → 休息（塔內休息）
    //   moveEndsAt    → 移動（前往某層）
    //   floor > 0     → 戰鬥中（在塔裡打怪）
    //   floor == 0    → 不在塔裡 / 城鎮狀態，不算戰鬥
    if (towerStatus) {
      if (towerStatus.restStartedAt) {
        activeStatuses.push("休息");
        actionStart = towerStatus.restStartedAt;
      } else if (towerStatus.moveEndsAt) {
        activeStatuses.push("移動");
        actionStart = towerStatus.moveEndsAt;
      } else if (towerStatus.floor > 0) {
        // 在塔裡、非休息/移動 → 戰鬥中
        activeStatuses.push("戰鬥");
      }
      // floor === 0 或 null：角色在城鎮，不推入任何塔狀態
    }

    // 鍛造：可與戰鬥並行（情境一），也可與採礦並行（情境二）
    if (activeJob) {
      activeStatuses.push("鍛造");
      if (!actionStart)
        actionStart = activeJob.createdAt || new Date().toISOString();
      forgingCompletionTime =
        activeJob.ready_at || activeJob.completionTime || activeJob.completeAt;
    }

    // 採礦：可與鍛造並行（情境二），後端保證不會與戰鬥同時發生（情境一互斥）
    if (mineStatus && mineStatus.active) {
      activeStatuses.push("採礦");
      if (!actionStart)
        actionStart = mineStatus.startedAt || new Date().toISOString();
    }

    if (activeStatuses.length === 0) {
      activeStatuses.push("空閒");
    }

    // actionStatus 保留向後相容（取優先序第一個）
    const legacyPriority = ["休息", "移動", "採礦", "鍛造", "戰鬥", "空閒"];
    const actionStatus =
      legacyPriority.find((s) => activeStatuses.includes(s)) ||
      activeStatuses[0] ||
      "空閒";

    const currentZoneName =
      towerStatus?.zones?.[towerStatus?.zone]?.name || "未知區域";

    return {
      ...character,
      nickname: character.name,
      fullHp: character.maxHp,
      sp: character.mp,
      fullSp: character.maxMp,
      lv: character.level,
      nextExp: 1000,
      activeStatuses: activeStatuses, // ← 新欄位：並行狀態陣列
      actionStatus: actionStatus, // ← 保留相容
      actionStart: actionStart || new Date().toISOString(),
      forgingCompletionTime,
      zoneName: currentZoneName,
      huntStage: towerStatus?.floor || 0,
      towerStatus: towerStatus,
    };
  };

  this.getAuthMe = async function () {
    try {
      const res = await axios.get(`${baseurl}/auth/me`, {
        headers: getHeaders(),
      });
      return res.data;
    } catch (error) {
      console.error("getAuthMe error:", error);
      return false;
    }
  };

  this.getPartyStatus = async function () {
    try {
      const res = await axios.get(`${baseurl}/party/status`, {
        headers: getHeaders(),
      });
      return res.data;
    } catch (error) {
      console.error("getPartyStatus error:", error);
      return false;
    }
  };

  this.getTowerStatus = async function () {
    try {
      const res = await axios.get(`${baseurl}/tower/status`, {
        headers: getHeaders(),
      });
      return res.data;
    } catch (error) {
      console.error("getTowerStatus error:", error);
      return false;
    }
  };

  this.getProfile = async function () {
    try {
      const authMeRes = await axios.get(`${baseurl}/auth/me`, {
        headers: getHeaders(),
      });
      const charData = authMeRes.data?.character;
      const serverTimeStr = authMeRes.headers?.date;
      const serverOffsetMs = serverTimeStr
        ? new Date(serverTimeStr).getTime() - Date.now()
        : 0;

      const towerRes = await axios.get(`${baseurl}/tower/status`, {
        headers: getHeaders(),
      });

      let activeJob = null;
      try {
        const jobsRes = await axios.get(`${baseurl}/forge/jobs`, {
          headers: getHeaders(),
        });
        activeJob = jobsRes.data?.jobs?.[0];
      } catch (e) {
        console.error("fetch jobs error:", e);
      }

      let mineStatus = null;
      try {
        const mineRes = await axios.get(`${baseurl}/town/mine/status`, {
          headers: getHeaders(),
        });
        mineStatus = mineRes.data;
      } catch (e) {
        console.error("fetch mine status error:", e);
      }

      const profile = normalizeProfile(
        charData,
        towerRes.data,
        activeJob,
        mineStatus
      );
      if (profile) {
        profile.serverOffsetMs = serverOffsetMs;
      }
      return profile;
    } catch (error) {
      console.error("getProfile error:", error);
      return false;
    }
  };

  this.rest = async function () {
    try {
      await axios.post(
        `${baseurl}/tower/rest/start`,
        {},
        { headers: getHeaders() }
      );
      return this.getProfile();
    } catch (error) {
      console.log(error);
      return {
        error: true,
        status: error.response?.status,
        message: error.message,
      };
    }
  };

  this.restComplete = async function () {
    try {
      await axios.post(
        `${baseurl}/tower/rest/stop`,
        {},
        { headers: getHeaders() }
      );
      return this.getProfile();
    } catch (error) {
      console.log(error);
      return {
        error: true,
        status: error.response?.status,
        message: error.message,
      };
    }
  };

  this.moveComplete = async function () {
    try {
      await axios.post(
        `${baseurl}/tower/arrive`,
        {},
        { headers: getHeaders() }
      );
      return this.getProfile();
    } catch (error) {
      console.log(error);
      return {
        error: true,
        status: error.response?.status,
        message: error.message,
      };
    }
  };

  this.run = async function () {
    try {
      await axios.get(`${baseurl}/party/status`, { headers: getHeaders() });
      let chooseRes;
      try {
        chooseRes = await axios.post(
          `${baseurl}/tower/choose`,
          { option: "run" },
          { headers: getHeaders() }
        );
      } catch (error) {
        if (error.response?.status === 409) {
          const errMsg =
            error.response?.data?.message || error.response?.data || "";
          console.warn(
            `[趕路衝突 409] 偵測到衝突: ${JSON.stringify(
              errMsg
            )}。嘗試清除移動與休息狀態...`
          );
          await this.moveComplete();
          await this.restComplete();
          await sleep(500);
          chooseRes = await axios.post(
            `${baseurl}/tower/choose`,
            { option: "run" },
            { headers: getHeaders() }
          );
        } else {
          throw error;
        }
      }
      const timelineRes = await axios.get(`${baseurl}/tower/timeline`, {
        headers: getHeaders(),
      });
      const advanceRes = await axios.post(
        `${baseurl}/tower/advance`,
        { option: "run" },
        { headers: getHeaders() }
      );
      const profile = await this.getProfile();
      return {
        ...chooseRes.data,
        ...timelineRes.data,
        advance: advanceRes.data,
        exp: advanceRes.data?.expGained || timelineRes.data?.rewards?.exp || 0,
        gold:
          advanceRes.data?.goldGained || timelineRes.data?.rewards?.gold || 0,
        profile,
      };
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  this.getTimeline = async function () {
    try {
      const res = await axios.get(`${baseurl}/tower/timeline`, {
        headers: getHeaders(),
      });
      return res.data;
    } catch (error) {
      console.error("getTimeline error:", error);
      return false;
    }
  };

  this.battle = async function () {
    try {
      await axios.get(`${baseurl}/party/status`, { headers: getHeaders() });
      let chooseRes;
      try {
        chooseRes = await axios.post(
          `${baseurl}/tower/choose`,
          { option: "fight" },
          { headers: getHeaders() }
        );
      } catch (error) {
        if (error.response?.status === 409) {
          const errMsg =
            error.response?.data?.message || error.response?.data || "";
          console.warn(
            `[戰鬥衝突 409] 偵測到衝突: ${JSON.stringify(
              errMsg
            )}。嘗試清除移動與休息狀態...`
          );
          await this.moveComplete();
          await this.restComplete();
          await sleep(500);
          chooseRes = await axios.post(
            `${baseurl}/tower/choose`,
            { option: "fight" },
            { headers: getHeaders() }
          );
        } else {
          throw error;
        }
      }
      const timelineRes = await axios.get(`${baseurl}/tower/timeline`, {
        headers: getHeaders(),
      });
      const advanceRes = await axios.post(
        `${baseurl}/tower/advance`,
        { option: "fight" },
        { headers: getHeaders() }
      );
      const profile = await this.getProfile();
      return {
        ...chooseRes.data,
        ...timelineRes.data,
        advance: advanceRes.data,
        exp: advanceRes.data?.expGained || timelineRes.data?.rewards?.exp || 0,
        gold:
          advanceRes.data?.goldGained || timelineRes.data?.rewards?.gold || 0,
        profile,
      };
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  this.move = async function (id) {
    try {
      const zoneKey = zoneMapping[id] || id;
      await axios.post(
        `${baseurl}/tower/move`,
        { destination: zoneKey },
        { headers: getHeaders() }
      );
      return this.getProfile();
    } catch (error) {
      console.log(error);
      return {
        error: true,
        status: error.response?.status,
        message: error.message,
      };
    }
  };

  this.path = async function (id) {
    try {
      await axios.post(
        `${baseurl}/tower/path`,
        { pathId: id },
        { headers: getHeaders() }
      );
      return this.getProfile();
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  this.equip = async function (id) {
    try {
      await axios.post(
        `${baseurl}/equip`,
        { crafted_eq_id: id },
        { headers: getHeaders() }
      );
      const itemsData = await this.item();
      return itemsData.equipments;
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  this.unEquip = async function (id) {
    try {
      const currentlyEquippedRes = await axios.get(`${baseurl}/equip`, {
        headers: getHeaders(),
      });
      const equipment = currentlyEquippedRes.data.equipment || {};
      let targetSlot = null;
      for (const [slot, item] of Object.entries(equipment)) {
        if (item && item.id === id) {
          targetSlot = slot;
          break;
        }
      }

      if (targetSlot) {
        await axios.delete(`${baseurl}/equip/${targetSlot}`, {
          headers: getHeaders(),
        });
      }

      const itemsData = await this.item();
      return itemsData.equipments;
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  this.unEquipAll = async function () {
    try {
      const currentlyEquippedRes = await axios.get(`${baseurl}/equip`, {
        headers: getHeaders(),
      });
      const equipment = currentlyEquippedRes.data.equipment || {};
      for (const [slot, item] of Object.entries(equipment)) {
        if (item && item.id) {
          await axios.delete(`${baseurl}/equip/${slot}`, {
            headers: getHeaders(),
          });
        }
      }
      const itemsData = await this.item();
      return itemsData.equipments;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  this.item = async function () {
    try {
      const invRes = await axios.get(`${baseurl}/inventory`, {
        headers: getHeaders(),
      });
      const equipRes = await axios.get(`${baseurl}/forge/equipment`, {
        headers: getHeaders(),
      });
      const currentlyEquippedRes = await axios.get(`${baseurl}/equip`, {
        headers: getHeaders(),
      });

      const equippedIds = Object.values(
        currentlyEquippedRes.data.equipment || {}
      )
        .filter((item) => item && item.id)
        .map((item) => item.id);

      // 根據 tags / hand_type 映射舊版 typeName，供 weaponChecker 分類武器/防具使用
      const tagToTypeName = {
        Dagger: "短刀",
        Sword: "單手劍",
        Rapier: "細劍",
        Mace: "單手錘",
        Shield: "盾牌",
        GreatAxe: "雙手斧",
        GreatSword: "雙手劍",
        Katana: "太刀",
        Spear: "長槍",
        Coat: "大衣",
        Armor: "盔甲",
      };

      const resolveTypeName = (e) => {
        // 優先用 tags 第一個 tag 映射
        if (e.tags && e.tags.length > 0) {
          for (const tag of e.tags) {
            if (tagToTypeName[tag]) return tagToTypeName[tag];
          }
        }
        // 次之用 hand_type 判斷
        if (e.hand_type === "two_hand") return "雙手劍";
        if (e.hand_type === "one_hand") return "單手劍";
        // 預設視為武器
        return "單手劍";
      };

      const normalizedEquipments = (equipRes.data.equipment || []).map((e) => ({
        ...e,
        name: e.weapon_name || e.name,
        fullDurability: e.max_durability,
        typeName: e.typeName || resolveTypeName(e),
        status: equippedIds.includes(e.id) ? "已裝備" : "未裝備",
      }));

      const normalizedItems = (invRes.data.items || []).map((item) => ({
        ...item,
        id: item.id || item.item_id,
        item_id: item.item_id || item.id,
        name: item.name || item.item_name || `道具(${item.item_id || item.id})`,
      }));

      return {
        items: normalizedItems,
        mines: normalizedItems,
        equipments: normalizedEquipments,
      };
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  this.huntInfo = async function () {
    try {
      const res = await axios.get(`${baseurl}/battles/info`, {
        headers: getHeaders(),
      });
      return res.data;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  this.forge = async function (payload) {
    try {
      const res = await axios.post(`${baseurl}/forge/craft`, payload, {
        headers: getHeaders(),
      });
      if (res.status == 200) {
        return this.getProfile();
      } else {
        return false;
      }
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  this.getForgeRecipes = async function () {
    try {
      const res = await axios.get(`${baseurl}/forge/recipes`, {
        headers: getHeaders(),
      });
      return res.data;
    } catch (error) {
      console.error("getForgeRecipes error:", error);
      return false;
    }
  };

  this.forgeComplete = async function (id) {
    try {
      let jobId = id;
      if (!jobId) {
        const jobsRes = await axios.get(`${baseurl}/forge/jobs`, {
          headers: getHeaders(),
        });
        const activeJob = jobsRes.data?.jobs?.[0];
        if (activeJob) {
          jobId = activeJob.id;
        }
      }

      if (!jobId) {
        throw new Error("找不到可領取的鍛造任務");
      }

      await axios.post(
        `${baseurl}/forge/collect/${jobId}`,
        {},
        { headers: getHeaders() }
      );
      return this.getProfile();
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  this.recycle = async function (id) {
    try {
      await axios.post(
        `${baseurl}/forge/recycle/${id}`,
        {},
        { headers: getHeaders() }
      );
      const itemsData = await this.item();
      return itemsData.equipments;
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  this.eatMedicine = async function (id) {
    try {
      await axios.post(
        `${baseurl}/inventory/use/${id}`,
        {},
        { headers: getHeaders() }
      );
      const profile = await this.getProfile();
      const itemsData = await this.item();
      return { profile, items: itemsData.items };
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  this.getMineStatus = async function () {
    try {
      const res = await axios.get(`${baseurl}/town/mine/status`, {
        headers: getHeaders(),
      });
      return res.data;
    } catch (error) {
      console.error("getMineStatus error:", error);
      return false;
    }
  };

  this.startMining = async function (zoneKey) {
    try {
      const res = await axios.post(
        `${baseurl}/town/mine/start`,
        { zone: zoneKey },
        { headers: getHeaders() }
      );
      return res.data;
    } catch (error) {
      console.error("startMining error:", error);
      return false;
    }
  };

  this.collectMine = async function () {
    try {
      const res = await axios.post(
        `${baseurl}/town/mine/collect`,
        {},
        { headers: getHeaders() }
      );
      return res.data;
    } catch (error) {
      console.error("collectMine error:", error);
      return false;
    }
  };
}

export default user;
