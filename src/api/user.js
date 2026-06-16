import axios from "axios";

const baseurl = "https://gunart-backend.onrender.com/api";

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

    let actionStatus = "空閒";
    let actionStart = null;
    let forgingCompletionTime = null;

    if (towerStatus) {
      if (towerStatus.restStartedAt) {
        actionStatus = "休息";
        actionStart = towerStatus.restStartedAt;
      } else if (towerStatus.moveEndsAt) {
        actionStatus = "移動";
        actionStart = towerStatus.moveEndsAt;
      }
    }

    if (actionStatus === "空閒") {
      if (activeJob) {
        actionStatus = "鍛造";
        actionStart = activeJob.createdAt || new Date().toISOString();
        forgingCompletionTime =
          activeJob.completionTime || activeJob.completeAt;
      } else if (mineStatus && mineStatus.active) {
        actionStatus = "採礦";
        actionStart = mineStatus.startedAt || new Date().toISOString();
      }
    }

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
      actionStatus: actionStatus,
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

      return normalizeProfile(charData, towerRes.data, activeJob, mineStatus);
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
      const chooseRes = await axios.post(
        `${baseurl}/tower/choose`,
        { option: "run" },
        { headers: getHeaders() }
      );
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
      const chooseRes = await axios.post(
        `${baseurl}/tower/choose`,
        { option: "fight" },
        { headers: getHeaders() }
      );
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

      const normalizedEquipments = (equipRes.data.equipment || []).map((e) => ({
        ...e,
        name: e.weapon_name || e.name,
        fullDurability: e.max_durability,
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

  this.forgeComplete = async function () {
    try {
      await axios.post(
        `${baseurl}/forge/complete`,
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
