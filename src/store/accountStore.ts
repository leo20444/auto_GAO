import { reactive, ref, watch, computed } from "vue";
import user from "../api/user.js";
import { ElMessage } from "element-plus";
import moment from "moment";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import map, { secretRealmConfig } from "../common/mapping";

function getMapIdByName(name: string): number | null {
  if (!name) return null;
  const found = map.find((item: any) => item.name === name);
  return found ? found.id : null;
}

function isRateLimitError(error: any): boolean {
  if (!error) return false;
  return (
    error.response?.status === 429 ||
    error.status === 429 ||
    String(error.message || "").includes("429")
  );
}

export interface LogItem {
  time: string;
  m: string;
}

export interface Account {
  token: string;
  userObj: any;
  username?: string;
  password?: string;
  profile: any;
  isActive: boolean;
  automation: {
    battle: {
      running: boolean;
      loopId?: number;
      logs: LogItem[];
      timeline: any;
      lastTimelineCheckKey?: string;
      setting: {
        hp: number;
        sp: number;
        map: string;
        weaponDuration: number;
        mapLevel: number;
        runLevel: number;
        hpRecoveryMode: string;
        spRecoveryMode: string;
        restDuration: number;
        allowEmptyHanded: boolean;
        autoRest: boolean;
        autoRestPercent: number;
        autoRestSeconds: number;
        battleMode?: string;
        bossSoloMode?: "none" | "pass" | "wait";
        useTeleportCrystal?: boolean;
        enableDualWield?: boolean;
        refreshMode?: string;
        enableLogs?: boolean;
        enableTimeline?: boolean;
        enterSecretRealmEnabled?: boolean;
        partyMode?: {
          enabled: boolean;
          isLeader: boolean;
          maxFloor: number;
          runLevel?: number;
          minDurability: number;
          allowEmptyHanded: boolean;
          hasExternalMembers?: boolean;
          ignoreMemberStatus?: boolean;
          stopAtBoss?: boolean;
          deathPolicy?: "rerun" | "idle";
        };
      };
      equipmentCheckTag: boolean;
      weaponCheckTag: boolean;
      armorCheckTag: boolean;
      medicineCheckTag: boolean;
      selectedWeaponQueueMain: any[];
      selectedWeaponQueueOff: any[];
      selectedArmorQueue: any[];
      medicineSetting: {
        medicineHpId: string;
        medicineSpId: string;
        medicineHpQuantity: number;
        medicineSpQuantity: number;
      };
    };
    forge: {
      running: boolean;
      loopId?: number;
      logs: LogItem[];
      weaponPayload: {
        weapon_name: string;
        result_item_id: number;
        materials: Array<{ item_id: number; quantity: number; name?: string }>;
      };
      setting: {
        loopCraft: boolean;
        maxCraftCount: number;
        currentCraftCount: number;
      };
    };
    lumbering: {
      running: boolean;
      logs: LogItem[];
    };
    mining: {
      running: boolean;
      loopId?: number;
      logs: LogItem[];
      setting: {
        zone: string;
        duration: number;
      };
    };
    lottery?: {
      lastCollectedAt: string;
      lastBoughtAt: string;
      lastBoughtSessionId: number;
    };
    market: {
      running: boolean;
      loopId?: number;
      logs: LogItem[];
      setting: {
        sellerName: string;
        onlyBuyFromSeller: boolean;
        priceLimit: number;
        interval: number;
        maxPurchaseQty: number;
        enableSplitPurchase: boolean;
      };
    };
  };
  lotteryProgressState?: string;
  party: any;
  tower: any;
  items: {
    equipments: any[];
    items: any[];
  };
}

const accounts = reactive<Account[]>([]);
const selectedAccountIndex = ref<number>(-1);
const knownItemNames = reactive<Record<number, string>>({
  119: "鑽石",
  123: "綠寶石",
  124: "藍寶石",
  125: "紅寶石",
  126: "紫水晶",
});

// 從 localStorage 載入，支援舊版 Token 字串陣列與新版包含帳密的物件陣列
const savedAccounts = JSON.parse(localStorage.getItem("strList") || "[]");
savedAccounts.forEach((item: any) => {
  if (typeof item === "string") {
    addAccount(item);
  } else if (item && item.token) {
    addAccount(item.token, item.username || "", item.password || "");
  }
});

// 當帳號列表或任何設定變更時儲存到 localStorage
watch(
  accounts,
  () => {
    // 儲存帳號基本資訊清單，保留帳密以供下次啟動時順利還原對應關係
    const accountInfos = accounts.map((acc) => ({
      token: acc.token,
      username: acc.username || "",
      password: acc.password || "",
    }));
    localStorage.setItem("strList", JSON.stringify(accountInfos));

    // 儲存個別帳號的自動化設定
    accounts.forEach((acc) => {
      const accountId = acc.username || acc.token;
      const userSetting = {
        setting: {
          ...acc.automation.battle.setting,
          equipmentCheckTag: acc.automation.battle.equipmentCheckTag,
          weaponCheckTag: acc.automation.battle.weaponCheckTag,
          armorCheckTag: acc.automation.battle.armorCheckTag,
          medicineCheckTag: acc.automation.battle.medicineCheckTag,
        },
        medicineSetting: acc.automation.battle.medicineSetting,
        selectedWeaponQueueMain:
          acc.automation.battle.selectedWeaponQueueMain || [],
        selectedWeaponQueueOff:
          acc.automation.battle.selectedWeaponQueueOff || [],
        selectedArmorQueue: acc.automation.battle.selectedArmorQueue || [],
        forgeWeaponPayload: acc.automation.forge.weaponPayload,
        forgeSetting: acc.automation.forge.setting,
        miningSetting: {
          zone: acc.automation.mining.setting?.zone ?? "forest",
          duration: acc.automation.mining.setting?.duration ?? 15,
        },
        lottery: acc.automation.lottery,
        marketSetting: {
          sellerName: acc.automation.market.setting?.sellerName ?? "",
          onlyBuyFromSeller:
            acc.automation.market.setting?.onlyBuyFromSeller ?? false,
          priceLimit: acc.automation.market.setting?.priceLimit ?? 0,
          interval: acc.automation.market.setting?.interval ?? 5,
          maxPurchaseQty: acc.automation.market.setting?.maxPurchaseQty ?? 0,
          enableSplitPurchase:
            acc.automation.market.setting?.enableSplitPurchase ?? true,
        },
        username: acc.username || "",
        password: acc.password || "",
      };
      localStorage.setItem(`setting_${accountId}`, JSON.stringify(userSetting));
    });
  },
  { deep: true }
);

async function refreshAccountState(acc: Account, forceAll = false) {
  try {
    const profile = await acc.userObj.getProfile();
    if (profile) {
      safeUpdateProfile(acc, profile);
      if (profile.towerStatus) {
        acc.tower = profile.towerStatus;
        // 同步伺服器端秘徑狀態至本地 profile 內
        acc.profile.inSecretRealm = !!profile.towerStatus.inSecretRealm;
      }
    }

    // 同步抓取背包與裝備清單
    const itemsRes = await acc.userObj.item();
    if (itemsRes) {
      acc.items.equipments = itemsRes.equipments || [];
      acc.items.items = itemsRes.items || [];
      acc.items.items.forEach((item: any) => {
        const itemId = item.item_id || item.id;
        if (itemId && item.name) {
          knownItemNames[itemId] = item.name;
        }
      });
    }
    if (forceAll || !acc.party) {
      const pStatus = await acc.userObj.getPartyStatus();
      if (pStatus) {
        acc.party = pStatus;
      }
    }
    // timeline 只在戰鬥/趕路後由 battle()/run() 回傳並更新，不在閒置輪詢中抓取
  } catch (error) {
    console.error("refreshAccountState error:", error);
  }
}

function addAccount(token: string, username = "", password = "") {
  // 將 username (優先) 或 token 作為此帳號在系統中的唯一識別 accountId
  const accountId = username || token;
  if (accounts.some((acc) => (acc.username || acc.token) === accountId)) {
    return;
  }

  // 載入 localStorage 設定，優先使用 accountId 尋找，無則 fallback 嘗試以 token 尋找 (相容舊資料)
  let savedSettingRaw = localStorage.getItem(`setting_${accountId}`);
  if (!savedSettingRaw && username) {
    savedSettingRaw = localStorage.getItem(`setting_${token}`);
  }
  let savedSetting: any = {};
  try {
    if (savedSettingRaw) {
      savedSetting = JSON.parse(savedSettingRaw);
      if (savedSetting.forgeWeaponPayload?.materials) {
        savedSetting.forgeWeaponPayload.materials.forEach((m: any) => {
          if (m.item_id && m.name) {
            knownItemNames[m.item_id] = m.name;
          }
        });
      }
    }
  } catch (e) {
    console.error("載入帳號設定失敗", e);
  }

  const finalUsername = username || savedSetting.username || "";
  const finalPassword = password || savedSetting.password || "";

  const userObj = new user(token, finalUsername, finalPassword);

  userObj.onTokenRefresh = (oldToken: string, newToken: string) => {
    const acc = accounts.find((a) => a.token === oldToken);
    if (acc) {
      const oldAccountId = acc.username || oldToken;
      const newAccountId = acc.username || newToken;

      if (oldAccountId !== newAccountId) {
        // 1. 遷移 localStorage setting
        const oldSettings = localStorage.getItem(`setting_${oldAccountId}`);
        if (oldSettings) {
          localStorage.setItem(`setting_${newAccountId}`, oldSettings);
          localStorage.removeItem(`setting_${oldAccountId}`);
        }

        // 2. 遷移 localStorage forge favorites
        const oldFavorites = localStorage.getItem(
          `forge_favorites_${oldAccountId}`
        );
        if (oldFavorites) {
          localStorage.setItem(`forge_favorites_${newAccountId}`, oldFavorites);
          localStorage.removeItem(`forge_favorites_${oldAccountId}`);
        }
      }

      // 3. 更新 userObj 內部的 token
      acc.userObj.token = newToken;
      // 4. 更新 memory 中的 token 欄位。這會觸發 watch(accounts) 自動將新設定寫入 setting_${newAccountId} 且更新 strList 列表
      acc.token = newToken;

      // 5. 立即重新整理帳號狀態以刷新 UI 暱稱等資料
      refreshAccountState(acc, true);

      ElMessage.success(
        `帳號 ${
          acc.profile?.nickname || acc.username || "Unknown"
        } Token 已過期，已自動重新登入並更新！`
      );
    } else {
      console.error(
        "[onTokenRefresh] 錯誤：在 accounts 陣列中找不到帶有舊 Token 的帳號！無法執行移轉"
      );
    }
  };

  const account = reactive<Account>({
    token,
    userObj,
    username: finalUsername,
    password: finalPassword,
    profile: {
      nickname: "載入中...",
      hp: 0,
      fullHp: 1,
      sp: 0,
      fullSp: 1,
      lv: 0,
    },
    party: null,
    tower: null,
    items: {
      equipments: [],
      items: [],
    },
    isActive: true,
    automation: {
      battle: {
        running: false,
        logs: [],
        timeline: null,
        setting: {
          hp: savedSetting.setting?.hp ?? 1,
          sp: savedSetting.setting?.sp ?? 1,
          map: savedSetting.setting?.map ?? "",
          weaponDuration: savedSetting.setting?.weaponDuration ?? 20,
          mapLevel: savedSetting.setting?.mapLevel ?? 0,
          runLevel: savedSetting.setting?.runLevel ?? 3000,
          hpRecoveryMode: savedSetting.setting?.hpRecoveryMode ?? "rest",
          spRecoveryMode: savedSetting.setting?.spRecoveryMode ?? "rest",
          restDuration: savedSetting.setting?.restDuration ?? 10,
          allowEmptyHanded: savedSetting.setting?.allowEmptyHanded ?? false,
          autoRest: savedSetting.setting?.autoRest ?? false,
          autoRestPercent: savedSetting.setting?.autoRestPercent ?? 90,
          autoRestSeconds: savedSetting.setting?.autoRestSeconds ?? 0,
          battleMode: savedSetting.setting?.battleMode ?? "battle",
          bossSoloMode:
            savedSetting.setting?.bossSoloMode ??
            (savedSetting.setting?.autoChallengeBossSolo === true
              ? "wait"
              : "none"),
          useTeleportCrystal: savedSetting.setting?.useTeleportCrystal ?? true,
          enableDualWield: savedSetting.setting?.enableDualWield ?? false,
          refreshMode: savedSetting.setting?.refreshMode ?? "auto",
          enableLogs: savedSetting.setting?.enableLogs ?? true,
          enableTimeline: savedSetting.setting?.enableTimeline ?? true,
          enterSecretRealmEnabled:
            savedSetting.setting?.enterSecretRealmEnabled ?? false,
          partyMode: {
            enabled: savedSetting.setting?.partyMode?.enabled ?? false,
            isLeader: savedSetting.setting?.partyMode?.isLeader ?? false,
            maxFloor: savedSetting.setting?.partyMode?.maxFloor ?? 0,
            runLevel: savedSetting.setting?.partyMode?.runLevel ?? 0,
            minDurability: savedSetting.setting?.partyMode?.minDurability ?? 10,
            allowEmptyHanded:
              savedSetting.setting?.partyMode?.allowEmptyHanded ?? false,
            hasExternalMembers:
              savedSetting.setting?.partyMode?.hasExternalMembers ?? false,
            ignoreMemberStatus:
              savedSetting.setting?.partyMode?.ignoreMemberStatus ?? false,
            stopAtBoss: savedSetting.setting?.partyMode?.stopAtBoss ?? false,
            deathPolicy: savedSetting.setting?.partyMode?.deathPolicy ?? "idle",
          },
        },
        equipmentCheckTag: savedSetting.setting?.equipmentCheckTag ?? false,
        weaponCheckTag: savedSetting.setting?.weaponCheckTag ?? false,
        armorCheckTag: savedSetting.setting?.armorCheckTag ?? false,
        medicineCheckTag: savedSetting.setting?.medicineCheckTag ?? false,
        selectedWeaponQueueMain: savedSetting.selectedWeaponQueueMain ?? [],
        selectedWeaponQueueOff: savedSetting.selectedWeaponQueueOff ?? [],
        selectedArmorQueue: savedSetting.selectedArmorQueue ?? [],
        medicineSetting: {
          medicineHpId: savedSetting.medicineSetting?.medicineHpId ?? "",
          medicineSpId: savedSetting.medicineSetting?.medicineSpId ?? "",
          medicineHpQuantity:
            savedSetting.medicineSetting?.medicineHpQuantity ?? 0,
          medicineSpQuantity:
            savedSetting.medicineSetting?.medicineSpQuantity ?? 0,
        },
      },
      forge: {
        running: false,
        logs: [],
        weaponPayload: {
          weapon_name: savedSetting.forgeWeaponPayload?.weapon_name ?? "",
          result_item_id: savedSetting.forgeWeaponPayload?.result_item_id ?? 0,
          materials: savedSetting.forgeWeaponPayload?.materials ?? [],
        },
        setting: {
          loopCraft: savedSetting.forgeSetting?.loopCraft ?? false,
          maxCraftCount: savedSetting.forgeSetting?.maxCraftCount ?? 0,
          currentCraftCount: savedSetting.forgeSetting?.currentCraftCount ?? 0,
        },
      },
      lumbering: {
        running: false,
        logs: [],
      },
      mining: {
        running: false,
        logs: [],
        setting: {
          zone: savedSetting.miningSetting?.zone ?? "forest",
          duration: savedSetting.miningSetting?.duration ?? 15,
        },
      },
      lottery: {
        lastCollectedAt: savedSetting.lottery?.lastCollectedAt ?? "",
        lastBoughtAt: savedSetting.lottery?.lastBoughtAt ?? "",
        lastBoughtSessionId: savedSetting.lottery?.lastBoughtSessionId ?? 0,
      },
      market: {
        running: false,
        logs: [],
        setting: {
          sellerName: savedSetting.marketSetting?.sellerName ?? "",
          onlyBuyFromSeller:
            savedSetting.marketSetting?.onlyBuyFromSeller ?? false,
          priceLimit: savedSetting.marketSetting?.priceLimit ?? 0,
          interval: savedSetting.marketSetting?.interval ?? 5,
          maxPurchaseQty: savedSetting.marketSetting?.maxPurchaseQty ?? 0,
          enableSplitPurchase:
            savedSetting.marketSetting?.enableSplitPurchase ?? true,
        },
      },
    },
  });

  accounts.push(account);
  if (selectedAccountIndex.value === -1) {
    selectedAccountIndex.value = 0;
  }

  // 初始化讀取個人資料與 Token 身份驗證
  userObj.getAuthMe().then((authData: any) => {
    if (authData) {
      if (authData.character) {
        const char = authData.character;
        account.profile.nickname = char.name;
        account.profile.lv = char.level;
        account.profile.hp = char.hp;
        account.profile.fullHp = char.maxHp;
        account.profile.sp = char.mp;
        account.profile.fullSp = char.maxMp;
        account.profile.avatarColor = char.avatarColor || "#409EFF";
      }
    }
  });

  refreshAccountState(account);
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import autoBattleChecker from "../common/autoBattleChecker";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import weaponChecker from "../common/weaponChecker";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import forgeChecker from "../common/forgeChecker";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import statusCheck from "../common/statusChecker";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import sleep from "../common/sleep";

function addLog(
  acc: Account,
  type: "battle" | "forge" | "lumbering" | "mining" | "market",
  message: string
) {
  const time = new Date().toLocaleTimeString();
  if (type === "battle") {
    if (acc.automation.battle.setting?.enableLogs === false) {
      return;
    }
    acc.automation.battle.logs.push({ time, m: message });
    while (acc.automation.battle.logs.length > 10) {
      acc.automation.battle.logs.shift();
    }
  } else {
    acc.automation[type].logs.push({ time, m: message });
    if (acc.automation[type].logs.length > 200) {
      acc.automation[type].logs.shift();
    }
  }
}

function safeUpdateProfile(acc: Account, newProfile: any) {
  if (!newProfile) return;
  if (
    newProfile instanceof Error ||
    newProfile.error ||
    newProfile.isAxiosError ||
    ("message" in newProfile && "config" in newProfile)
  ) {
    console.warn("拒絕將錯誤對象更新至角色 Profile:", newProfile);
    return;
  }
  if (
    typeof newProfile === "object" &&
    ("nickname" in newProfile || "name" in newProfile || "hp" in newProfile)
  ) {
    Object.assign(acc.profile, newProfile);
  }
}

async function startBattle(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (!acc || acc.automation.battle.running) return;

  if (acc.automation.mining.running) {
    addLog(
      acc,
      "battle",
      "警告：自動採礦運行中，無法啟動自動戰鬥！請先停止採礦。"
    );
    ElMessage.error("自動採礦運行中，無法啟動自動戰鬥！");
    return;
  }

  acc.automation.battle.running = true;
  const currentLoopId = Date.now();
  acc.automation.battle.loopId = currentLoopId;
  addLog(acc, "battle", "自動戰鬥已啟動");

  (async () => {
    while (
      acc.automation.battle.running &&
      acc.automation.battle.loopId === currentLoopId
    ) {
      try {
        if (acc.automation.battle.loopId !== currentLoopId) break;
        addLog(acc, "battle", "開始戰鬥回合檢查...");

        // 1. 取得最新個人資料與背包裝備、組隊資訊、地圖資訊
        await refreshAccountState(acc);
        if (acc.automation.battle.loopId !== currentLoopId) break;

        // 1.5 檢查忙碌狀態 (休息/移動/重生/鍛造中)
        const statusCheckObj = new statusCheck(
          acc.profile,
          (newProfile: any) => {
            safeUpdateProfile(acc, newProfile);
          },
          acc.userObj,
          acc.automation.battle.setting
        );
        const isFree = await statusCheckObj.checkStatus();
        if (!isFree) {
          addLog(
            acc,
            "battle",
            `角色目前忙碌中 (${acc.profile.actionStatus})，等待中...`
          );
          let waitTime = 11000;
          if (acc.profile.actionStatus === "移動") {
            const offset = acc.profile.serverOffsetMs || 0;
            const adjustedNow = moment().add(offset, "ms");
            const remainingMs = moment(acc.profile.actionStart).diff(
              adjustedNow
            );
            // sleep for remaining travel time plus 2 seconds buffer, max 5 minutes (300000ms)
            waitTime = Math.min(300000, Math.max(11000, remainingMs + 2000));
          }
          await sleep(waitTime);
          if (acc.automation.battle.loopId !== currentLoopId) break;
          continue;
        }

        // 1.8 隊員跟隨撤退檢測 (非孤狼、回城重跑模式，且有託管隊友死亡或隊長已回村)
        const pMode = acc.automation.battle.setting.partyMode;
        if (
          pMode &&
          pMode.enabled &&
          !pMode.isLeader &&
          !pMode.ignoreMemberStatus &&
          pMode.deathPolicy === "rerun"
        ) {
          const hasDeadMember = accounts.some((a) => {
            const aParty = a.automation?.battle?.setting?.partyMode;
            return (
              aParty &&
              aParty.enabled &&
              a.automation.battle.setting.map ===
                acc.automation.battle.setting.map &&
              (a.profile.actionStatus === "重生" || a.profile.hp <= 0)
            );
          });
          const leaderAcc = accounts.find((a) => {
            const aParty = a.automation?.battle?.setting?.partyMode;
            return (
              aParty &&
              aParty.enabled &&
              aParty.isLeader &&
              a.automation.battle.setting.map ===
                acc.automation.battle.setting.map
            );
          });
          const isLeaderInTown =
            leaderAcc && leaderAcc.profile.zoneName === "起始之鎮";

          if (
            acc.profile.zoneName !== "起始之鎮" &&
            (hasDeadMember || isLeaderInTown)
          ) {
            addLog(
              acc,
              "battle",
              `[組隊撤退] 偵測到隊友死亡或隊長已回村，隊員跟隨撤退回村！`
            );
            const moveRes = await acc.userObj.move(0);
            if (moveRes && !moveRes.error) {
              safeUpdateProfile(acc, moveRes);
            }
            await sleep(11000); // 移動冷卻
            continue;
          }
        }

        const itemsRes = await acc.userObj.item();
        if (itemsRes) {
          acc.items.equipments = itemsRes.equipments || [];
          acc.items.items = itemsRes.items || [];
        }
        const weaponList = acc.items.equipments;
        // 僅使用使用者在 UI 設定的佇列，若為空則不自動填入裝備（移除自動回填邏輯）
        const selectWeaponListMain =
          acc.automation.battle.selectedWeaponQueueMain || [];
        const selectWeaponListOff =
          acc.automation.battle.selectedWeaponQueueOff || [];
        const selectArmorList = acc.automation.battle.selectedArmorQueue || [];

        // 2. 初始化 weaponChecker
        // 方案D：callback 為空函式，Store 佇列永遠保留使用者原始設定，
        // weaponChecker 僅操作自身的工作副本（每輪 new 時從 Store 重新讀取）
        const myWeaponChecker = new weaponChecker(
          acc.automation.battle.setting,
          weaponList,
          selectWeaponListMain,
          selectWeaponListOff,
          selectArmorList,
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          () => {},
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          () => {},
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          () => {},
          acc.automation.battle.weaponCheckTag,
          acc.automation.battle.armorCheckTag,
          acc.userObj
        );

        // 3. 初始化 autoBattleChecker
        const checker = new autoBattleChecker(
          acc.profile,
          acc.userObj,
          (newProfile: any) => {
            safeUpdateProfile(acc, newProfile);
          },
          acc.automation.battle.setting,
          acc.automation.battle.equipmentCheckTag,
          myWeaponChecker,
          acc.automation.battle.medicineCheckTag,
          acc.automation.battle.medicineSetting,
          accounts
        );

        // ========================================================
        // 3.5 秘徑自動進入偵測與傳送 (放在 checkSetting 之前以防止死鎖)
        // ========================================================
        const targetMapIdForSecret = getMapIdByName(
          acc.automation.battle.setting.map
        );
        const isTargetingSecretRealm =
          targetMapIdForSecret === 1001 ||
          targetMapIdForSecret === 2001 ||
          targetMapIdForSecret === 4001 ||
          targetMapIdForSecret === 6001;

        const currentMapForSecret = acc.profile.zoneName;
        const currentMapIdForSecret = getMapIdByName(currentMapForSecret);
        const targetFloorForSecret =
          currentMapIdForSecret === 1
            ? secretRealmConfig[1001].enterFloor
            : currentMapIdForSecret === 2
            ? secretRealmConfig[2001].enterFloor
            : currentMapIdForSecret === 4
            ? secretRealmConfig[4001].enterFloor
            : currentMapIdForSecret === 6
            ? secretRealmConfig[6001].enterFloor
            : undefined;

        let hasAttemptedSecretRealm = false;

        if (
          targetFloorForSecret &&
          acc.profile.huntStage === targetFloorForSecret &&
          isTargetingSecretRealm
        ) {
          const pMode = acc.automation.battle.setting.partyMode;
          const isParty = pMode && pMode.enabled;

          if (isParty && !pMode.isLeader) {
            // A. 隊員端：自動發送進入秘徑請求
            if (acc.profile.inSecretRealm !== true) {
              addLog(
                acc,
                "battle",
                `[秘徑] 隊員抵達 ${targetFloorForSecret}F，自動發送進入秘徑請求...`
              );
              try {
                const enterRes = await acc.userObj.enterSecretRealm();
                if (enterRes && !enterRes.error) {
                  acc.profile.inSecretRealm = true;
                  addLog(acc, "battle", `[秘徑] 隊員進入秘徑成功！`);
                } else {
                  addLog(
                    acc,
                    "battle",
                    `[秘徑] 隊員進入秘徑失敗: ${
                      enterRes?.message || "未知錯誤"
                    }`
                  );
                }
              } catch (e) {
                console.error(`[隊員進入秘徑] 失敗:`, e);
              }
              hasAttemptedSecretRealm = true;
            }
          } else {
            // B. 個人模式 或 隊長模式
            if (!isParty) {
              // B1. 個人模式：直接自動進入秘徑
              if (acc.profile.inSecretRealm !== true) {
                addLog(
                  acc,
                  "battle",
                  `[秘徑] 抵達 ${targetFloorForSecret}F 秘徑層，自動發送進入秘徑請求...`
                );
                const enterRes = await acc.userObj.enterSecretRealm();
                if (enterRes && !enterRes.error) {
                  acc.profile.inSecretRealm = true;
                  addLog(acc, "battle", `[秘徑] 成功進入秘徑！`);
                } else {
                  addLog(
                    acc,
                    "battle",
                    `[秘徑] 進入秘徑失敗: ${
                      enterRes?.message || "未知錯誤"
                    }，將於下輪重試...`
                  );
                }
                hasAttemptedSecretRealm = true;
              }
            } else if (pMode.isLeader) {
              // B2. 隊長模式：等託管隊友都到齊並進入秘境後，隊長再殿後進入秘境
              const partyStatus = await acc.userObj.getPartyStatus();
              if (
                partyStatus &&
                partyStatus.party &&
                partyStatus.party.members
              ) {
                const members = partyStatus.party.members;
                let allManagedMembersInSecretRealm = true;
                const waitingMemberNames: string[] = [];

                for (const member of members) {
                  const memberAcc = accounts.find(
                    (a) =>
                      (a.profile.id &&
                        Number(a.profile.id) === Number(member.user_id)) ||
                      (a.profile.userId &&
                        Number(a.profile.userId) === Number(member.user_id)) ||
                      (a.profile.user_id &&
                        Number(a.profile.user_id) === Number(member.user_id))
                  );

                  if (memberAcc) {
                    if (memberAcc.profile.huntStage === targetFloorForSecret) {
                      if (memberAcc.profile.inSecretRealm !== true) {
                        allManagedMembersInSecretRealm = false;
                        waitingMemberNames.push(member.character_name);
                      }
                    }
                  }
                }

                if (!allManagedMembersInSecretRealm) {
                  addLog(
                    acc,
                    "battle",
                    `[秘徑等待] 隊長在 ${targetFloorForSecret}F 等待同在該層的我方隊友進入秘徑: ${waitingMemberNames.join(
                      ", "
                    )}...`
                  );
                } else {
                  if (acc.profile.inSecretRealm !== true) {
                    addLog(
                      acc,
                      "battle",
                      `[秘徑] 託管隊友已全數進入，隊長殿後進入秘徑！`
                    );
                    const enterRes = await acc.userObj.enterSecretRealm();
                    if (enterRes && !enterRes.error) {
                      acc.profile.inSecretRealm = true;
                      addLog(acc, "battle", `[秘徑] 隊長成功進入秘徑！`);
                    } else {
                      addLog(
                        acc,
                        "battle",
                        `[秘徑] 隊長進入秘徑失敗: ${
                          enterRes?.message || "未知錯誤"
                        }，下輪重試...`
                      );
                    }
                  }
                }
                hasAttemptedSecretRealm = true;
              }
            }
          }
        }

        if (hasAttemptedSecretRealm) {
          await sleep(11000); // 傳送冷聚
          if (acc.automation.battle.loopId !== currentLoopId) break;
          continue;
        }

        // 4. 執行檢查 (HP, SP, 地圖, 補品, 裝備)
        const checkResult = await checker.checkSetting();
        if (checkResult) {
          const pMode = acc.automation.battle.setting.partyMode;
          if (pMode && pMode.enabled && !pMode.isLeader) {
            addLog(
              acc,
              "battle",
              "組隊模式中：狀態已就緒，等待隊長發起戰鬥..."
            );
            const enableTimeline =
              acc.automation.battle.setting.enableTimeline !== false;
            const refreshMode =
              acc.automation.battle.setting.refreshMode ?? "auto";
            if (enableTimeline && refreshMode === "auto") {
              // eslint-disable-next-line prettier/prettier
              const currentCheckKey = `${acc.profile.exp || 0}_${acc.profile.hp}_${acc.profile.sp}_${acc.profile.huntStage || 0}_${acc.profile.zoneName || ''}`;
              // eslint-disable-next-line prettier/prettier
              if (acc.automation.battle.lastTimelineCheckKey !== currentCheckKey) {
                try {
                  const timelineRes = await acc.userObj.getTimeline();
                  if (timelineRes) {
                    acc.automation.battle.timeline = timelineRes;
                  }
                  acc.automation.battle.lastTimelineCheckKey = currentCheckKey;
                } catch (e) {
                  console.error(`[隊員 Timeline 刷新] 失敗:`, e);
                }
              }
            }
          } else {
            let proceedWithBattle = true;
            if (proceedWithBattle) {
              if (pMode && pMode.enabled) {
                if (pMode.isLeader) {
                  // 0.5 王關停留判定
                  if (pMode.stopAtBoss) {
                    const bossFloors: { [key: string]: number } = {
                      大草原: 30,
                      猛牛園: 25,
                      兒童樂園: 18,
                      蘑菇園: 24,
                      圓明園: 20,
                    };
                    const currentMap = acc.profile.zoneName;
                    const bossFloor = bossFloors[currentMap];
                    if (bossFloor && acc.profile.huntStage === bossFloor) {
                      addLog(
                        acc,
                        "battle",
                        `[王關停留] 已抵達王關樓層 (${bossFloor}F)，原地暫停自動戰鬥以便手動挑戰！`
                      );

                      // 取得託管的組員，全部關閉自動戰鬥
                      const partyStatus = await acc.userObj.getPartyStatus();
                      const partyMemberIds = new Set<number>();
                      if (
                        partyStatus &&
                        partyStatus.party &&
                        partyStatus.party.members
                      ) {
                        partyStatus.party.members.forEach((m: any) => {
                          partyMemberIds.add(Number(m.user_id));
                        });
                      }
                      if (acc.profile.id)
                        partyMemberIds.add(Number(acc.profile.id));
                      if (acc.profile.userId)
                        partyMemberIds.add(Number(acc.profile.userId));
                      if (acc.profile.user_id)
                        partyMemberIds.add(Number(acc.profile.user_id));

                      const managedPartyAccs = accounts.filter(
                        (a) =>
                          (a.profile.id &&
                            partyMemberIds.has(Number(a.profile.id))) ||
                          (a.profile.userId &&
                            partyMemberIds.has(Number(a.profile.userId))) ||
                          (a.profile.user_id &&
                            partyMemberIds.has(Number(a.profile.user_id)))
                      );

                      for (const memberAcc of managedPartyAccs) {
                        memberAcc.automation.battle.running = false;
                        addLog(
                          memberAcc,
                          "battle",
                          `[王關停留] 隊長已在王關暫停自動戰鬥，組員原地暫停。`
                        );
                      }
                      break;
                    }
                  }

                  // 1. 層數上限判定與帶隊回城落地確認
                  const maxFloor = pMode.maxFloor || 0;
                  if (maxFloor > 0 && acc.profile.huntStage >= maxFloor) {
                    addLog(
                      acc,
                      "battle",
                      `[組隊模式] 已達隊伍層數上限 (${acc.profile.huntStage}F >= ${maxFloor}F)，帶隊回城並停止自動戰鬥！`
                    );

                    // 找到所有屬於該隊伍的我方託管帳號 (包含隊長自己)
                    const partyStatus = await acc.userObj.getPartyStatus();
                    const partyMemberIds = new Set<number>();
                    if (
                      partyStatus &&
                      partyStatus.party &&
                      partyStatus.party.members
                    ) {
                      partyStatus.party.members.forEach((m: any) => {
                        partyMemberIds.add(Number(m.user_id));
                      });
                    }
                    if (acc.profile.id)
                      partyMemberIds.add(Number(acc.profile.id));
                    if (acc.profile.userId)
                      partyMemberIds.add(Number(acc.profile.userId));
                    if (acc.profile.user_id)
                      partyMemberIds.add(Number(acc.profile.user_id));

                    const managedPartyAccs = accounts.filter(
                      (a) =>
                        (a.profile.id &&
                          partyMemberIds.has(Number(a.profile.id))) ||
                        (a.profile.userId &&
                          partyMemberIds.has(Number(a.profile.userId))) ||
                        (a.profile.user_id &&
                          partyMemberIds.has(Number(a.profile.user_id)))
                    );

                    // 隊長帶頭 move(0)
                    let leaderNewProfile: any = null;
                    try {
                      leaderNewProfile = await acc.userObj.move(0);
                      if (leaderNewProfile && !leaderNewProfile.error) {
                        safeUpdateProfile(acc, leaderNewProfile);
                      }
                    } catch (e) {
                      console.error("[組隊回城] 隊長發起移動失敗:", e);
                    }

                    // 更新所有隊友 profile 狀態
                    for (const memberAcc of managedPartyAccs) {
                      if (
                        Number(memberAcc.profile.id) !== Number(acc.profile.id)
                      ) {
                        try {
                          await refreshAccountState(memberAcc);
                        } catch (e) {
                          console.error(
                            `[組隊回城] 更新隊員 ${memberAcc.profile.name} 狀態失敗:`,
                            e
                          );
                        }
                      }
                    }

                    // 計算移動剩餘時間
                    let waitTime = 11000;
                    if (acc.profile.actionStatus === "移動") {
                      const offset = acc.profile.serverOffsetMs || 0;
                      const adjustedNow = moment().add(offset, "ms");
                      const remainingMs = moment(acc.profile.actionStart).diff(
                        adjustedNow
                      );
                      waitTime = Math.min(
                        300000,
                        Math.max(11000, remainingMs + 2000)
                      );
                    }

                    // 等待落地時間
                    await sleep(waitTime);

                    // 全員落地確認 (帶重試機制)
                    await Promise.all(
                      managedPartyAccs.map(async (memberAcc) => {
                        let success = false;
                        let retries = 5;
                        while (retries > 0 && !success) {
                          try {
                            addLog(
                              memberAcc,
                              "battle",
                              `[組隊回城] 發送抵達確認 (moveComplete)，剩餘重試次數: ${retries}...`
                            );
                            const completedProfile =
                              await memberAcc.userObj.moveComplete();
                            if (completedProfile && !completedProfile.error) {
                              safeUpdateProfile(memberAcc, completedProfile);
                              addLog(
                                memberAcc,
                                "battle",
                                `[組隊回城] 已成功抵達起始之鎮！`
                              );
                              success = true;
                            } else {
                              addLog(
                                memberAcc,
                                "battle",
                                `[組隊回城] 抵達確認失敗：${
                                  completedProfile?.message || "未知錯誤"
                                }，將於 5 秒後重試...`
                              );
                              retries--;
                              if (retries > 0) await sleep(5000);
                            }
                          } catch (e) {
                            console.error(
                              `[組隊回城] 隊員 ${memberAcc.profile.name} 落地確認出錯:`,
                              e
                            );
                            retries--;
                            if (retries > 0) await sleep(5000);
                          }
                        }
                        if (!success) {
                          addLog(
                            memberAcc,
                            "battle",
                            `[警告] 隊員 ${memberAcc.profile.name} 最終未能成功落地，請手動確認！`
                          );
                        }
                        memberAcc.automation.battle.running = false;
                      })
                    );

                    break;
                  }

                  // 2. 獲取並巡查隊伍狀態
                  let allMembersReady = true;
                  const partyStatus = await acc.userObj.getPartyStatus();
                  if (
                    partyStatus &&
                    partyStatus.party &&
                    partyStatus.party.members
                  ) {
                    const members = partyStatus.party.members;

                    for (const member of members) {
                      // 排除隊長自己
                      if (
                        (acc.profile.id &&
                          Number(member.user_id) === Number(acc.profile.id)) ||
                        (acc.profile.userId &&
                          Number(member.user_id) ===
                            Number(acc.profile.userId)) ||
                        (acc.profile.user_id &&
                          Number(member.user_id) ===
                            Number(acc.profile.user_id))
                      ) {
                        continue;
                      }

                      // 尋找我方託管帳號
                      const memberAcc = accounts.find(
                        (a) =>
                          (a.profile.id &&
                            Number(a.profile.id) === Number(member.user_id)) ||
                          (a.profile.userId &&
                            Number(a.profile.userId) ===
                              Number(member.user_id)) ||
                          (a.profile.user_id &&
                            Number(a.profile.user_id) ===
                              Number(member.user_id))
                      );
                      if (memberAcc) {
                        // A. 我方託管組員
                        // 孤狼帶隊模式：完全無視所有我方組員狀態，直接跳過
                        if (pMode.ignoreMemberStatus) {
                          continue;
                        }

                        // 先檢測是否死亡
                        const isMemberDead =
                          memberAcc.profile.actionStatus === "重生" ||
                          memberAcc.profile.hp <= 0;
                        if (isMemberDead) {
                          if (pMode.deathPolicy === "rerun") {
                            addLog(
                              acc,
                              "battle",
                              `[組隊撤退] 偵測到隊友 ${member.character_name} 死亡，全員退回起始之鎮重整！`
                            );
                            const leaderNewProfile = await acc.userObj.move(0);
                            if (leaderNewProfile && !leaderNewProfile.error) {
                              safeUpdateProfile(acc, leaderNewProfile);
                            }
                            allMembersReady = false;
                            break;
                          } else {
                            addLog(
                              acc,
                              "battle",
                              `[組隊等待] 隊員 ${member.character_name} 死亡，隊伍在原地暫停等待其歸隊...`
                            );
                            allMembersReady = false;
                          }
                        }

                        // 檢查忙碌狀態 (如果組員正在移動、休息、重生，隊長必須等待)
                        const isMemberBusy =
                          memberAcc.profile.actionStatus !== "空閒" &&
                          memberAcc.profile.actionStatus !== "戰鬥";
                        if (isMemberBusy) {
                          addLog(
                            acc,
                            "battle",
                            `[組隊等待] 組員 ${member.character_name} 目前忙碌中 (${memberAcc.profile.actionStatus})，等待其完成...`
                          );
                          allMembersReady = false;
                        }

                        // 檢查所在區域是否與隊長一致
                        const isSameZone =
                          memberAcc.profile.zoneName === acc.profile.zoneName;
                        if (!isSameZone) {
                          addLog(
                            acc,
                            "battle",
                            `[組隊等待] 組員 ${member.character_name} 目前在 ${memberAcc.profile.zoneName}，與隊長所在區域 (${acc.profile.zoneName}) 不一致，等待其抵達...`
                          );
                          allMembersReady = false;
                        }

                        const memberHpLimit =
                          memberAcc.automation.battle.setting.hp || 100;
                        const memberSpLimit =
                          memberAcc.automation.battle.setting.sp || 150;

                        const isMemberHpReady =
                          member.hp >= member.max_hp ||
                          member.hp > memberHpLimit;

                        const isMemberSpReady =
                          member.mp >= member.max_mp ||
                          member.mp > memberSpLimit;

                        if (!isMemberHpReady || !isMemberSpReady) {
                          addLog(
                            acc,
                            "battle",
                            `[組隊等待] 組員 ${member.character_name} HP/SP 不足 (HP: ${member.hp}/${member.max_hp}, SP: ${member.mp}/${member.max_mp})，等待其恢復...`
                          );
                          allMembersReady = false;
                        }

                        // 最低耐久度與空手檢查
                        const minDur = pMode.minDurability || 10;
                        const memberEquips = memberAcc.items.equipments || [];
                        const equippedWeapons = memberEquips.filter(
                          (w: any) => w.status === "已裝備"
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
                        const equippedWeapon = equippedWeapons.find((w: any) =>
                          weaponTypes.includes(w.typeName)
                        );

                        if (equippedWeapon) {
                          const weaponReady =
                            equippedWeapon.durability >= minDur;
                          if (!weaponReady) {
                            addLog(
                              acc,
                              "battle",
                              `[組隊等待] 組員 ${member.character_name} 武器 ${equippedWeapon.name} 耐久低於統一門檻 (${equippedWeapon.durability} < ${minDur})，等待更換...`
                            );
                            allMembersReady = false;
                          }
                        } else {
                          const emptyHandedAllowed = pMode.allowEmptyHanded;
                          if (!emptyHandedAllowed) {
                            addLog(
                              acc,
                              "battle",
                              `[組隊等待] 組員 ${member.character_name} 目前空手（不允許空手），等待其裝備武器...`
                            );
                            allMembersReady = false;
                          }
                        }
                      } else {
                        // B. 隊外玩家 (非我方託管)
                        if (pMode.hasExternalMembers) {
                          // 檢查忙碌狀態 (如果組員正在移動、休息，隊長必須等待)
                          const isExternalBusy =
                            member.tower_move_ends_at !== null ||
                            member.rest_started_at !== null;
                          if (isExternalBusy) {
                            addLog(
                              acc,
                              "battle",
                              `[組隊等待] 隊外組員 ${
                                member.character_name
                              } 目前忙碌中 (${
                                member.tower_move_ends_at ? "移動中" : "休息中"
                              })，等待其完成...`
                            );
                            allMembersReady = false;
                          }

                          const hpPercent = member.max_hp
                            ? member.hp / member.max_hp
                            : 1;
                          const mpPercent = member.max_mp
                            ? member.mp / member.max_mp
                            : 1;
                          const externalReady =
                            hpPercent >= 0.5 && mpPercent >= 0.3;
                          if (!externalReady) {
                            addLog(
                              acc,
                              "battle",
                              `[組隊等待] 隊外組員 ${
                                member.character_name
                              } 狀態不足 (HP: ${Math.round(
                                hpPercent * 100
                              )}%, SP: ${Math.round(
                                mpPercent * 100
                              )}%)，等待恢復...`
                            );
                            allMembersReady = false;
                          }
                        }
                      }
                    }
                  }

                  if (!allMembersReady) {
                    proceedWithBattle = false;
                    await sleep(5000);
                    continue; // 跳出當前 logic 迴圈，等 5 秒後重新檢測
                  }
                } else {
                  // 隊員不主動發起戰鬥/趕路
                  proceedWithBattle = false;
                }
              }

              if (proceedWithBattle) {
                acc.automation.battle.timeline = null; // 每次發起戰鬥前先清空 Timeline
                const isParty =
                  acc.automation.battle.setting.partyMode?.enabled;
                const currentMapId = getMapIdByName(acc.profile.zoneName);
                const currentStage = acc.profile.huntStage || 0;

                const bossFloors: Record<number, number> = {
                  1: 30, // 大草原 30F
                  2: 25, // 猛牛園 25F
                  3: 18, // 兒童樂園 18F
                  4: 24, // 蘑菇園 24F
                  5: 20, // 圓明園 20F
                };

                const isSoloBossFloor =
                  !isParty &&
                  !acc.profile.inSecretRealm &&
                  currentMapId !== null &&
                  bossFloors[currentMapId] === currentStage;

                if (isSoloBossFloor) {
                  const bossMode =
                    acc.automation.battle.setting.bossSoloMode || "none";
                  if (bossMode === "none") {
                    addLog(
                      acc,
                      "battle",
                      `[王關掛網] 已設定不打王，直接進行普通狩獵/爬樓。`
                    );
                  } else {
                    const cooldownEnds = acc.tower?.bossCooldownEndsAt;
                    const nowMs = Date.now();
                    const isCd =
                      cooldownEnds && new Date(cooldownEnds).getTime() > nowMs;

                    if (isCd) {
                      if (bossMode === "wait") {
                        const cdTime = new Date(cooldownEnds).getTime();
                        const secondsLeft = Math.ceil((cdTime - nowMs) / 1000);
                        addLog(
                          acc,
                          "battle",
                          `[刷王等待] 已抵達王關 (${currentStage}F)，BOSS 冷卻中，剩餘等待時間: ${secondsLeft} 秒...`
                        );
                        await sleep(11000);
                        continue;
                      } else {
                        addLog(
                          acc,
                          "battle",
                          `[王關路過] BOSS 冷卻中，且設定為路過打王，不停留直接狩獵。`
                        );
                      }
                    } else {
                      addLog(
                        acc,
                        "battle",
                        `[挑戰BOSS] BOSS 冷卻完畢，發起挑戰王 API...`
                      );
                      const bossRes = await acc.userObj.fightBoss();
                      if (bossRes) {
                        if (bossRes.error) {
                          addLog(
                            acc,
                            "battle",
                            `[挑戰BOSS失敗] 原因: ${
                              bossRes.message || "未知錯誤"
                            }`
                          );
                        } else {
                          const fightData = bossRes.data || {};
                          safeUpdateProfile(
                            acc,
                            bossRes.profile || fightData.profile
                          );
                          if (bossRes.profile?.towerStatus) {
                            acc.tower = bossRes.profile.towerStatus;
                          }
                          const resultStr = fightData.bossWon
                            ? "勝利"
                            : fightData.bossDraw
                            ? "平手"
                            : "失敗";
                          let logMsg = `[挑戰BOSS成功] 結果: ${resultStr}, 獲得經驗: ${
                            fightData.expGained || 0
                          }, 金幣: ${fightData.goldGained || 0}`;
                          if (fightData.hp !== undefined && fightData.hp <= 0) {
                            logMsg += ` [玩家死亡]`;
                          }
                          addLog(acc, "battle", logMsg);
                        }
                      }
                      await sleep(11000);
                      continue;
                    }
                  }
                }

                const runLevel = isParty
                  ? acc.automation.battle.setting.partyMode?.runLevel || 0
                  : acc.automation.battle.setting.runLevel || 0;
                const enableTimeline =
                  acc.automation.battle.setting.enableTimeline !== false;

                if (currentStage < runLevel) {
                  addLog(
                    acc,
                    "battle",
                    `當前層數 (${currentStage}F) 低於${
                      isParty ? "隊伍" : ""
                    }趕路層數 (${runLevel}F)，發送趕路請求...`
                  );
                  const runRes = await acc.userObj.run(enableTimeline);
                  if (runRes) {
                    safeUpdateProfile(acc, runRes.profile || runRes);
                    acc.automation.battle.timeline = enableTimeline
                      ? runRes
                      : null;

                    let logMsg = `趕路成功！結果: ${
                      runRes.winner || "未知"
                    }, 經驗值: ${runRes.exp || 0}, 獲得金幣: ${
                      runRes.gold || 0
                    }`;
                    if (runRes.advance) {
                      if (runRes.advance.died) {
                        logMsg += ` [玩家死亡]`;
                      }
                    }
                    addLog(acc, "battle", logMsg);
                  }
                } else {
                  addLog(acc, "battle", "狀態檢查通過，發送狩獵請求...");
                  const huntRes = await acc.userObj.battle(enableTimeline);
                  if (huntRes) {
                    safeUpdateProfile(acc, huntRes.profile || huntRes);
                    acc.automation.battle.timeline = enableTimeline
                      ? huntRes
                      : null;

                    let logMsg = `狩獵成功！結果: ${
                      huntRes.winner || "未知"
                    }, 經驗值: ${huntRes.exp || 0}, 獲得金幣: ${
                      huntRes.gold || 0
                    }`;
                    if (huntRes.advance) {
                      if (huntRes.advance.died) {
                        logMsg += ` [玩家死亡]`;
                      }
                    }
                    addLog(acc, "battle", logMsg);
                  }
                }
              }
            }
          }
        } else {
          addLog(
            acc,
            "battle",
            "狀態不滿足，已執行相應準備操作（休息/移動/補品/更換裝備中）"
          );
        }

        // 5. 等待回合間隔時間 (11秒)
        await sleep(11000);
        if (acc.automation.battle.loopId !== currentLoopId) break;

        // 安全防頻率鎖定隨機抖動
        const jitter = Math.floor(Math.random() * 1500) + 500;
        await sleep(jitter);
        if (acc.automation.battle.loopId !== currentLoopId) break;
      } catch (error: any) {
        if (error === "CRITICAL_STOP_NO_WEAPON") {
          addLog(acc, "battle", "武器已損壞且不允許空手戰鬥，自動戰鬥已停止。");
          acc.automation.battle.running = false;
          break;
        }
        if (isRateLimitError(error)) {
          addLog(
            acc,
            "battle",
            "伺服器限制 (429 Too Many Requests)，自動戰鬥暫停 30 秒以防封鎖..."
          );
          await sleep(30000);
        } else {
          addLog(acc, "battle", `發生異常: ${error.message || error}`);
          await sleep(5000);
        }
      }
    }
  })();
}

function stopBattle(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (acc) {
    acc.automation.battle.running = false;
    addLog(acc, "battle", "自動戰鬥已停止");
  }
}

async function startForge(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (!acc || acc.automation.forge.running) return;

  acc.automation.forge.setting.currentCraftCount = 0;
  acc.automation.forge.running = true;
  const currentLoopId = Date.now();
  acc.automation.forge.loopId = currentLoopId;
  addLog(acc, "forge", "自動鍛造已啟動");

  (async () => {
    let isCrafting = acc.profile.actionStatus === "鍛造";
    while (
      acc.automation.forge.running &&
      acc.automation.forge.loopId === currentLoopId
    ) {
      try {
        if (acc.automation.forge.loopId !== currentLoopId) break;
        addLog(acc, "forge", "開始鍛造狀態檢查...");

        // 1. 取得最新個人資料與背包素材、組隊資訊、地圖資訊
        await refreshAccountState(acc);
        if (acc.automation.forge.loopId !== currentLoopId) break;

        // 2. 初始化 forgeChecker
        const checker = new forgeChecker(
          acc.profile,
          (newProfile: any) => {
            safeUpdateProfile(acc, newProfile);
          },
          acc.userObj
        );

        // 3. 檢查目前狀態 (若在鍛造中且時間到則完成)
        const isFree = await checker.checkStatus();

        // 檢查狀態轉換 (由鍛造 -> 非鍛造)
        if (acc.profile.actionStatus === "鍛造") {
          isCrafting = true;
        } else if (isCrafting) {
          isCrafting = false;
          acc.automation.forge.setting.currentCraftCount++;
          addLog(
            acc,
            "forge",
            `鍛造完成！當前累計次數：${acc.automation.forge.setting.currentCraftCount}`
          );

          // 判斷是否停止
          if (!acc.automation.forge.setting.loopCraft) {
            addLog(acc, "forge", "單次製作已完成，自動停止鍛造。");
            acc.automation.forge.running = false;
            break;
          } else if (
            acc.automation.forge.setting.maxCraftCount > 0 &&
            acc.automation.forge.setting.currentCraftCount >=
              acc.automation.forge.setting.maxCraftCount
          ) {
            addLog(
              acc,
              "forge",
              `已達到設定的次數上限 (${acc.automation.forge.setting.maxCraftCount})，自動停止鍛造。`
            );
            acc.automation.forge.running = false;
            break;
          }
        }

        if (isFree) {
          const payload = acc.automation.forge.weaponPayload;
          if (!payload.result_item_id) {
            addLog(acc, "forge", "未選擇鍛造武器類型，等待設定...");
          } else if (!payload.materials || payload.materials.length === 0) {
            addLog(acc, "forge", "材料清單為空，等待設定...");
          } else {
            // 檢查材料是否足夠
            const itemsRes = await acc.userObj.item();
            if (itemsRes) {
              acc.items.equipments = itemsRes.equipments || [];
              acc.items.items = itemsRes.items || [];
            }
            const backpackItems = acc.items.items;
            let hasEnough = true;

            for (const req of payload.materials) {
              const hold = backpackItems.find(
                (m: any) => m.item_id === req.item_id || m.id === req.item_id
              );
              if (hold && hold.name) {
                knownItemNames[req.item_id] = hold.name;
              }
              if (req.name) {
                knownItemNames[req.item_id] = req.name;
              }
              if (!hold || hold.quantity < req.quantity) {
                const materialName =
                  hold?.name ||
                  req.name ||
                  knownItemNames[req.item_id] ||
                  `物品ID(${req.item_id})`;
                addLog(
                  acc,
                  "forge",
                  `材料不足：需要 ${materialName} x${req.quantity}，持有 x${
                    hold?.quantity || 0
                  }`
                );
                hasEnough = false;
                break;
              }
            }

            if (!hasEnough) {
              addLog(acc, "forge", "材料不足，自動停止鍛造。");
              acc.automation.forge.running = false;
              break;
            }

            // 發起鍛造
            addLog(
              acc,
              "forge",
              `材料充足，發起鍛造請求：${
                payload.weapon_name || `配方ID(${payload.result_item_id})`
              }...`
            );
            const forgeResult = await acc.userObj.forge({
              result_item_id: payload.result_item_id,
              materials: payload.materials,
              weapon_name: payload.weapon_name,
            });
            if (forgeResult && !forgeResult.error) {
              safeUpdateProfile(acc, forgeResult);
              isCrafting = true;
              addLog(acc, "forge", `鍛造請求已送出，目前進入「鍛造」狀態。`);
            } else {
              const reason = forgeResult?.message || "未知錯誤";
              addLog(
                acc,
                "forge",
                `發起鍛造失敗！原因: ${reason}。將於下個週期重試。`
              );
            }
          }
        } else {
          addLog(
            acc,
            "forge",
            `角色目前處於「${acc.profile.actionStatus}」狀態，等待中...`
          );
        }

        // 等待冷卻：自動鍛造每 15 秒檢查一次
        await sleep(15000);
        if (acc.automation.forge.loopId !== currentLoopId) break;

        // 安全抖動延遲
        const jitter = Math.floor(Math.random() * 1500) + 500;
        await sleep(jitter);
        if (acc.automation.forge.loopId !== currentLoopId) break;
      } catch (error: any) {
        if (isRateLimitError(error)) {
          addLog(
            acc,
            "forge",
            "伺服器限制 (429 Too Many Requests)，自動鍛造暫停 30 秒..."
          );
          await sleep(30000);
        } else {
          addLog(acc, "forge", `發生異常: ${error.message || error}`);
          await sleep(5000);
        }
      }
    }
  })();
}

function stopForge(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (acc) {
    acc.automation.forge.running = false;
    addLog(acc, "forge", "自動鍛造已停止");
  }
}

async function startMining(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (!acc || acc.automation.mining.running) return;

  if (acc.automation.battle.running) {
    addLog(
      acc,
      "mining",
      "警告：自動戰鬥運行中，無法啟動自動採礦！請先停止戰鬥。"
    );
    ElMessage.error("自動戰鬥運行中，無法啟動自動採礦！");
    return;
  }

  acc.automation.mining.running = true;
  const currentLoopId = Date.now();
  acc.automation.mining.loopId = currentLoopId;
  addLog(acc, "mining", "自動採礦已啟動");

  (async () => {
    while (
      acc.automation.mining.running &&
      acc.automation.mining.loopId === currentLoopId
    ) {
      try {
        if (acc.automation.mining.loopId !== currentLoopId) break;
        if (acc.automation.battle.running) {
          addLog(acc, "mining", "自動戰鬥運行中，自動採礦暫停發送開始請求。");
          await sleep(30000);
          continue;
        }

        addLog(acc, "mining", "檢查採礦狀態...");
        const status = await acc.userObj.getMineStatus();
        if (status) {
          const { active, zone, elapsedSeconds, requiredSeconds } = status;
          if (!active) {
            const targetZone = acc.automation.mining.setting?.zone || "forest";
            addLog(
              acc,
              "mining",
              `目前閒置中，開始發送採礦請求，目標區域: ${targetZone}...`
            );
            const startRes = await acc.userObj.startMining(targetZone);
            if (startRes) {
              addLog(acc, "mining", `採礦已成功啟動。`);
            } else {
              addLog(acc, "mining", `採礦啟動失敗，將於下個週期重試。`);
            }
          } else {
            const targetDuration =
              (acc.automation.mining.setting?.duration || 15) * 60;
            const limitSeconds = Math.max(
              targetDuration,
              requiredSeconds || 900
            );

            addLog(
              acc,
              "mining",
              `正在採礦中 (${zone})，已進行 ${Math.floor(
                elapsedSeconds / 60
              )} 分鐘。目標時間: ${Math.floor(limitSeconds / 60)} 分鐘。`
            );

            if (elapsedSeconds >= limitSeconds) {
              addLog(
                acc,
                "mining",
                `已達到設定採礦時間 (${Math.floor(
                  elapsedSeconds / 60
                )} 分鐘)，開始收集資源...`
              );
              const collectRes = await acc.userObj.collectMine();
              if (collectRes) {
                const rewardsStr =
                  collectRes.rewards
                    ?.map((r: any) => `${r.name} x${r.quantity}`)
                    .join(", ") || "無";
                addLog(
                  acc,
                  "mining",
                  `收集成功！消耗 MP: ${
                    collectRes.mpSpent || 0
                  }，獲得資源: ${rewardsStr}`
                );
                await refreshAccountState(acc);
              } else {
                addLog(acc, "mining", `資源收集失敗，將於下個週期重試。`);
              }
            }
          }
        } else {
          addLog(acc, "mining", `獲取採礦狀態失敗，將於下個週期重試。`);
        }

        await sleep(30000);
        if (acc.automation.mining.loopId !== currentLoopId) break;
        const jitter = Math.floor(Math.random() * 2000) + 1000;
        await sleep(jitter);
        if (acc.automation.mining.loopId !== currentLoopId) break;
      } catch (error: any) {
        if (isRateLimitError(error)) {
          addLog(
            acc,
            "mining",
            "伺服器限制 (429 Too Many Requests)，自動採礦暫停 30 秒..."
          );
          await sleep(30000);
        } else {
          addLog(acc, "mining", `發生異常: ${error.message || error}`);
          await sleep(10000);
        }
      }
    }
  })();
}

function stopMining(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (acc) {
    acc.automation.mining.running = false;
    addLog(acc, "mining", "自動採礦已停止");
  }
}

async function refreshAccount(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (acc) {
    await refreshAccountState(acc, true);
  }
}

// 每 20 秒自動重新整理一次所有帳號狀態 (當沒在自動戰鬥/鍛造/採礦時)
setInterval(async () => {
  for (const acc of accounts) {
    if (
      acc.isActive &&
      !acc.automation.battle.running &&
      !acc.automation.forge.running &&
      !acc.automation.mining.running
    ) {
      await refreshAccountState(acc);
    }
  }
}, 20000);

function removeAccount(index: number) {
  const acc = accounts[index];
  if (acc) {
    const accountId = acc.username || acc.token;
    localStorage.removeItem(`setting_${accountId}`);
    localStorage.removeItem(`forge_favorites_${accountId}`);
    // 同時嘗試清除以舊 token 為名的資料
    localStorage.removeItem(`setting_${acc.token}`);
    localStorage.removeItem(`forge_favorites_${acc.token}`);
  }
  accounts.splice(index, 1);
  if (selectedAccountIndex.value >= accounts.length) {
    selectedAccountIndex.value = accounts.length - 1;
  }
}

function selectAccount(index: number) {
  selectedAccountIndex.value = index;
}

const selectedAccount = computed(() => {
  if (selectedAccountIndex.value === -1) return null;
  return accounts[selectedAccountIndex.value];
});

function isLotteryReset(lastTimeStr: string) {
  if (!lastTimeStr) return true;
  const lastTime = new Date(lastTimeStr);
  const now = new Date();

  const lastOffset = new Date(lastTime.getTime() - 8 * 60 * 60 * 1000);
  const nowOffset = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  const lastDate = `${lastOffset.getFullYear()}-${
    lastOffset.getMonth() + 1
  }-${lastOffset.getDate()}`;
  const nowDate = `${nowOffset.getFullYear()}-${
    nowOffset.getMonth() + 1
  }-${nowOffset.getDate()}`;

  return lastDate !== nowDate;
}

function collectConfigUpdate(acc: Account, type: "collect" | "buy") {
  if (!acc.automation.lottery) {
    acc.automation.lottery = {
      lastCollectedAt: "",
      lastBoughtAt: "",
      lastBoughtSessionId: 0,
    };
  }
  if (type === "collect") {
    acc.automation.lottery.lastCollectedAt = new Date().toISOString();
  } else {
    acc.automation.lottery.lastBoughtAt = new Date().toISOString();
  }
}

async function oneClickLotteryAll() {
  const activeAccs = accounts.filter((acc) => acc.isActive);
  let successCount = 0;
  let failCount = 0;

  for (const acc of activeAccs) {
    if (!acc.automation.lottery) {
      acc.automation.lottery = {
        lastCollectedAt: "",
        lastBoughtAt: "",
        lastBoughtSessionId: 0,
      };
    }
    const lotteryConfig = acc.automation.lottery;
    const isCollectReset = isLotteryReset(lotteryConfig.lastCollectedAt);
    const isBuyReset = isLotteryReset(lotteryConfig.lastBoughtAt);

    // 如果今日都已處理，則直接算成功並跳過
    if (!isCollectReset && !isBuyReset) {
      acc.lotteryProgressState = undefined;
      successCount++;
      continue;
    }

    acc.lotteryProgressState = "處理中";
    addLog(acc, "battle", "[一鍵樂透] 開始處理今日樂透...");

    let collectSuccess = !isCollectReset;
    let buySuccess = !isBuyReset;

    try {
      if (isCollectReset) {
        addLog(acc, "battle", "[一鍵樂透] 正在領取樂透每日獎金...");
        const collectRes = await acc.userObj.collectLottery();
        if (collectRes && !collectRes.error) {
          collectConfigUpdate(acc, "collect");
          collectSuccess = true;
          addLog(acc, "battle", `[一鍵樂透] 領取成功！`);
        } else {
          // 失敗代表已領取過，直接更新時間戳記並視為成功
          collectConfigUpdate(acc, "collect");
          collectSuccess = true;
          addLog(
            acc,
            "battle",
            `[一鍵樂透] 領取回傳失敗，視為已領取過。錯誤訊息: ${
              collectRes?.message || "未知錯誤"
            }`
          );
        }
        await sleep(600);
      }

      if (isBuyReset) {
        addLog(acc, "battle", "[一鍵樂透] 正在購買本期樂透...");
        const buyRes = await acc.userObj.buyLottery();
        if (buyRes && !buyRes.error) {
          collectConfigUpdate(acc, "buy");
          buySuccess = true;
          addLog(acc, "battle", `[一鍵樂透] 購買成功！`);
        } else {
          // 失敗代表已購買過，直接更新時間戳記並視為成功
          collectConfigUpdate(acc, "buy");
          buySuccess = true;
          addLog(
            acc,
            "battle",
            `[一鍵樂透] 購買回傳失敗，視為已購買過。錯誤訊息: ${
              buyRes?.message || "未知錯誤"
            }`
          );
        }
        await sleep(600);
      }

      if (collectSuccess && buySuccess) {
        acc.lotteryProgressState = undefined;
        successCount++;
      } else {
        acc.lotteryProgressState = "失敗";
        failCount++;
      }

      // 刷新帳號金幣等狀態
      await refreshAccountState(acc, true);
    } catch (e: any) {
      console.error("[一鍵樂透] 異常:", e);
      addLog(acc, "battle", `[一鍵樂透] 異常: ${e.message || e}`);
      acc.lotteryProgressState = "失敗";
      failCount++;
    }
  }

  return { successCount, failCount };
}

function splitQuantity(total: number): number[] {
  if (total <= 3) return [total];
  const chunks: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    if (remaining <= 3) {
      chunks.push(remaining);
      break;
    }
    const maxChunk = Math.min(8, remaining - 1);
    const chunk = Math.floor(Math.random() * (maxChunk - 2 + 1)) + 2;
    chunks.push(chunk);
    remaining -= chunk;
  }
  return chunks;
}

async function startMarket(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (!acc || acc.automation.market.running) return;

  acc.automation.market.running = true;
  const currentLoopId = Date.now();
  acc.automation.market.loopId = currentLoopId;
  console.log(`[市場搶購] [${acc.username || acc.token}] 啟動自動搶購任務`);
  addLog(acc, "market", "自動市場購買已啟動");

  (async () => {
    while (
      acc.automation.market.running &&
      acc.automation.market.loopId === currentLoopId
    ) {
      try {
        if (acc.automation.market.loopId !== currentLoopId) break;

        const onlyBuyFromSeller =
          acc.automation.market.setting.onlyBuyFromSeller === true;
        const sellerName =
          acc.automation.market.setting.sellerName?.trim() || "";
        const priceLimit =
          Number(acc.automation.market.setting.priceLimit) || 0;
        const maxPurchaseQty =
          Number(acc.automation.market.setting.maxPurchaseQty) || 0;
        const enableSplit =
          acc.automation.market.setting.enableSplitPurchase === true;

        if (onlyBuyFromSeller && !sellerName) {
          console.error(
            `[市場搶購] [${
              acc.username || acc.token
            }] 啟用了指定購買賣家，但未填寫賣家名稱！已自動停止。`
          );
          addLog(
            acc,
            "market",
            "錯誤：啟用了指定購買賣家，但未填寫賣家名稱！自動搶購已停止。"
          );
          stopMarket(token);
          break;
        }

        console.log(
          `[市場搶購] [${
            acc.username || acc.token
          }] 開始拉取最新市場清單，條件: { 指定賣家: ${onlyBuyFromSeller} ("${sellerName}"), 價格上限: ${priceLimit}, 單次數量限制: ${maxPurchaseQty}, 拆單模式: ${enableSplit} }`
        );
        addLog(acc, "market", "正在獲取市場交易列表...");
        const res = await acc.userObj.getMarketListings();

        if (res && !res.error && Array.isArray(res.listings)) {
          const myNickname = acc.profile.nickname || "";

          const matchedListings = res.listings.filter((item: any) => {
            if (item.status !== "active") return false;

            // 避開自己上架的
            if (myNickname && item.seller_name === myNickname) return false;

            // 賣家過濾 (精確匹配，去空白)
            if (
              onlyBuyFromSeller &&
              sellerName &&
              item.seller_name !== sellerName
            )
              return false;

            // 價格過濾
            if (priceLimit > 0 && item.price > priceLimit) return false;

            return true;
          });

          console.log(
            `[市場搶購] [${acc.username || acc.token}] 總商品數: ${
              res.listings.length
            }, 篩選後符合搶購條件: ${matchedListings.length}`
          );

          if (matchedListings.length > 0) {
            addLog(
              acc,
              "market",
              `找到符合條件的商品共 ${matchedListings.length} 項，開始搶購...`
            );

            for (const item of matchedListings) {
              if (
                acc.automation.market.loopId !== currentLoopId ||
                !acc.automation.market.running
              )
                break;

              // 計算本次預計購買的總數
              let buyQty = item.quantity;
              if (maxPurchaseQty > 0) {
                buyQty = Math.min(item.quantity, maxPurchaseQty);
              }

              if (buyQty <= 0) continue;

              console.log(
                `[市場搶購] 準備購買商品: ${item.item_name} x${buyQty} (總量: ${item.quantity}, 單價: ${item.price}, 賣家: ${item.seller_name}, 上架ID: ${item.id})`
              );
              addLog(
                acc,
                "market",
                `準備購買: ${item.item_name} (數量: ${buyQty}/${item.quantity}, 單價: ${item.price}, 賣家: ${item.seller_name})`
              );

              // 判斷是否拆單
              const buyBatches =
                enableSplit && buyQty > 3 ? splitQuantity(buyQty) : [buyQty];

              for (let i = 0; i < buyBatches.length; i++) {
                if (
                  acc.automation.market.loopId !== currentLoopId ||
                  !acc.automation.market.running
                )
                  break;

                const currentBatchQty = buyBatches[i];
                if (buyBatches.length > 1) {
                  console.log(
                    `[市場搶購] [拆單發送] 進度: ${i + 1}/${
                      buyBatches.length
                    }, 數量: ${currentBatchQty}`
                  );
                  addLog(
                    acc,
                    "market",
                    `[拆單購置] 正在發送子訂單 ${i + 1}/${
                      buyBatches.length
                    }，數量: ${currentBatchQty}...`
                  );
                }

                const buyRes = await acc.userObj.buyMarketItem(
                  item.id,
                  currentBatchQty
                );
                if (buyRes && !buyRes.error) {
                  console.log(
                    `[市場搶購] 購買成功! 支付金幣: ${buyRes.total}, 剩餘金幣: ${buyRes.newGold}`
                  );
                  addLog(
                    acc,
                    "market",
                    `成功購買 ${item.item_name} x${currentBatchQty}，共支付 ${buyRes.total} 金幣，剩餘金幣: ${buyRes.newGold}`
                  );
                  if (buyRes.newGold !== undefined) {
                    acc.profile.gold = buyRes.newGold;
                  }
                } else {
                  console.error(`[市場搶購] 購買失敗:`, buyRes);
                  addLog(
                    acc,
                    "market",
                    `購買失敗: ${buyRes?.message || "未知錯誤"}`
                  );
                  // 如果失敗（比如商品已售罄或金幣不足），直接中斷這品項的其餘拆單
                  break;
                }

                // 子訂單之間的隨機延遲 (800ms ~ 1500ms)
                if (i < buyBatches.length - 1) {
                  const subDelay =
                    Math.floor(Math.random() * (1500 - 800 + 1)) + 800;
                  await sleep(subDelay);
                }
              }

              // 兩個大品項之間的延遲
              await sleep(1500);
            }
          } else {
            addLog(acc, "market", "未找到符合篩選條件的商品。");
          }
        } else {
          console.error(`[市場搶購] 獲取清單失敗:`, res);
          addLog(
            acc,
            "market",
            `獲取市場列表失敗: ${res?.message || "未知錯誤"}`
          );
        }
      } catch (err: any) {
        console.error(`[市場搶購] 循環發生錯誤:`, err);
        addLog(acc, "market", `運行出錯: ${err.message || err}`);
      }

      // 頻率控制 (最少 5 秒)
      const intervalSec = Math.max(
        5,
        Number(acc.automation.market.setting.interval) || 5
      );
      await sleep(intervalSec * 1000);
    }
  })();
}

function stopMarket(token: string) {
  const acc = accounts.find((a) => a.token === token);
  if (!acc) return;
  acc.automation.market.running = false;
  acc.automation.market.loopId = undefined;
  addLog(acc, "market", "自動市場購買已停止");
}

export const useAccountStore = () => ({
  accounts,
  selectedAccountIndex,
  selectedAccount,
  knownItemNames,
  addAccount,
  removeAccount,
  selectAccount,
  startBattle,
  stopBattle,
  startForge,
  stopForge,
  startMining,
  stopMining,
  startMarket,
  stopMarket,
  refreshAccount,
  refreshAccountState,
  oneClickLotteryAll,
});
