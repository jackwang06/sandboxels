(function (root) {
    "use strict";

    if (!root || !root.HumanSocietyCore || !root.HumanSocietyPathfinding || typeof elements === "undefined") {
        return;
    }

    const Core = root.HumanSocietyCore;
    const Pathfinding = root.HumanSocietyPathfinding;
    const World = root.HumanSocietyWorld || {};
    const TechData = root.HumanSocietyTechData || {ERAS: [], TECHNOLOGIES: [], FUELS: {}, RECIPES: {}, RANGED_WEAPONS: {}, DEFAULT_VISION: []};
    const C = Object.assign({
        FACTION_JOIN_RADIUS: 24,
        CAMP_GROUP_RADIUS: 12,
        CAMP_STABLE_TICKS: 60,
        BUCKET_SIZE: 8,
        THINK_INTERVAL: 10,
        LOCOMOTION_INTERVAL_TICKS: 2,
        NAVIGATION_STALL_TICKS: 300,
        PATH_SEARCH_MARGIN_MIN: 12,
        PATH_SEARCH_MARGIN_MAX: 32,
        PATH_SEARCH_NODES_PER_TICK: 32,
        PATH_SEARCH_PLAYER_NODES_PER_TICK: 256,
        PATH_SEARCH_MAX_NODES: 4096,
        CIVILIZATION_INTERVAL: 30,
        FULL_REBUILD_INTERVAL: 300,
        INDEX_AUDIT_PIXELS_PER_TICK: 64,
        INDEX_AUDIT_BUDGET_MS: 0.35,
        MAX_RESOURCE_CHECKS: 256,
        RESOURCE_RADIUS: 12,
        EXTENDED_RESOURCE_RADIUS: 20,
        FIRE_RESPONSE_RADIUS: 32,
        FIRE_SCAN_INTERVAL: 10,
        MAX_FIRE_RESPONDERS_PER_SETTLEMENT: 2,
        ADULT_HP: 100,
        CHILD_HP: 50,
        BIRTH_COOLDOWN: 0,
        CHILD_GROW_TICKS: 0,
        BIRTH_FOOD_COST: 2,
        AUTONOMOUS_POPULATION_CAP: 120,
        ATTACK_BLOOD_CHANCE: 0.25,
        CONSTRUCTION_STEP_TICKS: 8,
        CONSTRUCTION_BLOCK_TIMEOUT: 180,
        BUILD_SEARCH_RADIUS: 24,
        BUILDING_CORE_CLEARANCE: 5,
        BUILD_RETRY_TICKS: 180,
        MOVE_STUCK_LIMIT: 30,
        TERRITORY_BASE_RADIUS: 14,
        TERRITORY_MAX_RADIUS: 26,
        TERRITORY_HUT_BONUS: 2,
        TERRITORY_HALF_WIDTH: 11,
        BUILDING_SPRITE_GAP: 2,
        BASE_CARRY_CAPACITY: 4,
        ORGANIZED_CARRY_CAPACITY: 6,
        TUNNEL_UNLOCK_ERA: 1,
        RESOURCE_EXHAUSTION_TICKS: 180,
        WAR_MINIMUM_TICKS: 300,
        WAR_IMBALANCE_TICKS: 180,
        WAR_POWER_RATIO: 3,
        MAX_CHRONICLE_EVENTS: 2000,
        WARTIME_WARRIOR_RATIO: 0.4,
        TICKS_PER_YEAR: 240,
        ADULT_AGE_YEARS: 0,
        LIFESPAN_MIN_YEARS: 50,
        LIFESPAN_MAX_YEARS: 60,
        RESEARCH_ERA_UNLOCK_COUNT: 6,
        RESEARCH_DOMAIN_DISCOUNT_MAX: 0.25,
        RESEARCH_STEP_INTERVAL: 30,
        KNOWLEDGE_PER_ADULT_STEP: 0.65,
        WORKSHOP_PROCESS_INTERVAL: 30,
        TREE_ROOT_HORIZONTAL_CLEARANCE: 2,
        TREE_HARVEST_AGE_TICKS: 600,
        TREE_GROWTH_RECHECK_TICKS: 30,
        TREE_SEED_GUARANTEE: 5,
        WOOD_FOOD_BONUS_CHANCE: 0.5,
        RANGED_PROJECTILE_STEP_TICKS: 2,
        PERSON_ACTIVITY_SCHEMA_VERSION: 1,
        MAX_PERSON_ACTIVITY: 500,
        PEOPLE_UI_REFRESH_MS: 250,
        PEOPLE_HISTORY_PAGE_SIZE: 50
    }, Core.CONFIG || {});
    const FACTION_COLORS = [
        "#d95763", "#4f83d1", "#4da86b", "#d3a43d",
        "#8c63c7", "#d4743c", "#3da7aa", "#c6539b",
        "#7f9f35", "#6f7f91"
    ];
    const SKIN_COLORS = ["#f3e7db", "#f7ead0", "#eadaba", "#d7bd96", "#a07e56", "#825c43", "#604134", "#3a312a"];
    const ACTOR_ELEMENTS = new Set(["civ_body", "civ_child"]);
    const normalizedPersonActivityData = new WeakSet();
    const LEGACY_REMOVED_STRUCTURE_CORES = new Set(["civ_farm_marker", "civ_granary_core"]);
    const STRUCTURE_CORES = new Set([
        "civ_banner", "civ_hut_core", "civ_farm_marker", "civ_workshop_core", "civ_hearth_core",
        "civ_quarry_core", "civ_granary_core", "civ_kiln_core", "civ_foundry_core", "civ_forge_core",
        "civ_keep_core", "civ_siege_workshop_core", "civ_library_core", "civ_market_core", "civ_tower_core", "civ_lumberyard_core", "civ_gate"
    ]);
    const STRUCTURE_PARTS = new Set(["civ_structure_wood", "civ_structure_stone", "civ_palisade"]);
    const SOIL_ELEMENTS = new Set(["dirt", "mud", "clay_soil", "mulch", "grass"]);
    const DEFAULT_RESOURCES = {
        wood: new Set(["wood", "tree_branch", "evergreen", "bamboo", "bamboo_plant"]),
        stone: new Set(["rock", "gravel", "limestone", "basalt"])
    };
    const ERA_ORDER = (TechData.ERAS || []).map((era) => era.id);
    const ERA_INDEX = new Map(ERA_ORDER.map((id, index) => [id, index]));
    const DEFAULT_ERA_ID = ERA_ORDER[0] || "tribal";
    const WOOD_SMELTING_RESERVE_BY_ERA = Object.assign({
        tribal: 8,
        stone: 16,
        agriculture: 32,
        bronze: 48,
        iron: 64,
        castle: 96
    }, TechData.WOOD_SMELTING_RESERVE_BY_ERA || {});
    const MINEABLE_RESOURCE_KINDS = Object.freeze(["stone", "copper", "raw_iron"]);
    const MINING_RESERVES_BY_ERA = Object.freeze({
        tribal: Object.freeze({stone: 8, copper: 0, raw_iron: 0}),
        stone: Object.freeze({stone: 12, copper: 0, raw_iron: 0}),
        agriculture: Object.freeze({stone: 16, copper: 0, raw_iron: 0}),
        bronze: Object.freeze({stone: 20, copper: 6, raw_iron: 0}),
        iron: Object.freeze({stone: 24, copper: 9, raw_iron: 6}),
        castle: Object.freeze({stone: 28, copper: 12, raw_iron: 12})
    });
    const TECH_BY_ID = new Map((TechData.TECHNOLOGIES || []).map((tech) => [tech.id, tech]));
    const TECHS_BY_ERA = new Map();
    (TechData.TECHNOLOGIES || []).forEach((tech) => {
        const eraId = tech.era || tech.eraId;
        if (!TECHS_BY_ERA.has(eraId)) TECHS_BY_ERA.set(eraId, []);
        TECHS_BY_ERA.get(eraId).push(tech);
    });
    const FUEL_VALUES = Object.keys(TechData.FUELS || {}).length ? Object.assign({}, TechData.FUELS) : {wood: 1};
    const MATERIAL_KEYS = ["tree_branch", "bamboo", "wood", "stone", "copper", "bronze", "raw_iron", "iron", "steel"];
    const STOCK_KEYS = ["food", "wood", "stone", "copper", "bronze", "raw_iron", "iron", "steel", "sapling"];
    const NONRENEWABLE_KINDS = new Set(["stone", "copper", "raw_iron"]);
    const RESOURCE_SCHEMA_VERSION = 3;
    const EQUIPMENT_SCHEMA_VERSION = 3;
    const RESEARCH_SCHEMA_VERSION = 3;
    const DIRECT_FIRE_ELEMENTS = new Set(["fire", "plasma", "ember", "fw_ember", "torch"]);
    const EXTINGUISHED_FIRE_ELEMENTS = {fire: "smoke", plasma: "smoke", ember: "ash", fw_ember: "smoke", torch: "wood"};
    const TREE_SEEDS = {
        tree_branch: "sapling",
        wood: "sapling",
        evergreen: "pinecone",
        bamboo: "bamboo_plant"
    };
    const TREE_SAPLING_ELEMENTS = new Set(["sapling", "pinecone", "bamboo_plant"]);
    const TREE_SAPLING_PREFIX = "tree_sapling:";
    const BUILDING_SPRITE_ROOT = "assets/civilization/buildings/";
    const BUILDING_SPRITE_VERSION = "20260726a";
    const buildingSpriteAssets = new Map();
    const NAVIGATION_SCHEMA_VERSION = 4;
    const RESOURCE_FAILURE_COOLDOWN = 300;
    const ROTTEN_MEAT_FAILURE_COOLDOWN = 600;
    const WOOD_BEARING_TREE_ELEMENTS = new Set(["wood", "tree_branch", "evergreen", "bamboo"]);
    const TREE_COMPONENT_ELEMENTS = new Set(["wood", "tree_branch", "evergreen", "bamboo", "plant", "leaves", "pine_needles", "sapling", "pinecone", "bamboo_plant", "dead_plant", "frozen_plant"]);
    const LEGACY_TREE_LEAF_ELEMENTS = new Set(["plant", "leaves", "pine_needles", "dead_plant", "frozen_plant"]);
    const PLANTED_TREE_SEEDS = new Set(["sapling", "pinecone", "bamboo_plant"]);
    const CARRIED_RESOURCE_KINDS = {
        civ_food_resource: "food", civ_stone_resource: "stone", civ_copper_resource: "copper",
        civ_raw_iron_resource: "raw_iron"
    };
    const FALLING_RESOURCE_ELEMENTS = {
        wood: "civ_wood_resource", food: "civ_food_resource", stone: "civ_stone_resource",
        copper: "civ_copper_resource", raw_iron: "civ_raw_iron_resource", sapling: "civ_tree_sapling_resource"
    };
    const LEGACY_WEAPON_IDS = {spear: "stone_spear"};
    const LEGACY_WEAPON_COSTS = {
        club: {wood: 2},
        spear: {wood: 1, stone: 1},
        bow: {wood: 3},
        bronze_spear: {wood: 1, bronze: 2},
        iron_sword: {iron: 2},
        crossbow: {wood: 2, steel: 1}
    };
    const WEAPON_TECH_REQUIREMENTS = {
        stone_spear: "polished_axes",
        bow: "bowmaking",
        bronze_spear: "bronze_weapons",
        bronze_sword: "bronze_weapons",
        iron_spear: "iron_weapons",
        iron_sword: "iron_weapons",
        steel_blade: "carburizing_tempering",
        steel_spear: "carburizing_tempering",
        crossbow: "crossbow"
    };
    const ARMOR_TECH_REQUIREMENTS = {
        rattan: "rattan_armor",
        iron: "iron_armor",
        steel: "steel_armor"
    };
    const ARMOR_ERA_REQUIREMENTS = {rattan: "agriculture", iron: "iron", steel: "castle"};
    const LEGACY_TECH_ID_MIGRATIONS = {
        stone_spearheads: "polished_axes",
        seed_selection: "food_preservation",
        irrigation: "rattan_armor",
        forge: "iron_weapons",
        crop_rotation: "supply_logistics"
    };
    const LEGACY_REMOVED_TECH_IDS = new Set([
        "hunting_cooperation", "artisan_shed", "granary", "barter", "tin_prospecting",
        "charcoal_kiln", "coinage", "codified_law", "siege_workshop", "guild_market"
    ]);
    const OBSCURING_ELEMENTS = new Set(["smoke", "steam", "fog", "cloud", "rain_cloud", "dust", "sandstorm", "ash", "acid_gas"]);
    if (typeof settings !== "undefined") {
        if (settings.humanSocietySpeech === undefined) settings.humanSocietySpeech = true;
        if (settings.humanSocietyBuildingScale === undefined) settings.humanSocietyBuildingScale = 100;
        if (settings.humanSocietyTutorialComplete === undefined) settings.humanSocietyTutorialComplete = false;
        if (!Number.isFinite(Number(settings.humanSocietyTutorialStep))) settings.humanSocietyTutorialStep = 0;
    }

    const manager = {
        actors: new Set(),
        heads: new Set(),
        settlements: new Set(),
        children: new Set(),
        constructionSites: new Set(),
        structures: new Set(),
        structuresById: new Map(),
        actorById: new Map(),
        factionById: new Map(),
        settlementById: new Map(),
        relationRecords: new Map(),
        foundingSince: new Map(),
        buckets: new Map(),
        actorBucketByPixel: new Map(),
        resourceIndex: new Map(),
        resourceNodeByPixel: new Map(),
        minerAssignments: new Map(),
        fireTargets: [],
        lastFireScanTick: -Infinity,
        resourceReservations: World.ResourceReservations ? new World.ResourceReservations() : null,
        territory: null,
        treeById: new Map(),
        treeRootColumns: new Set(),
        treeRootColumnsTick: -Infinity,
        treePixelsByLineage: new Map(),
        dirtyTreeLineages: new Set(),
        archivedChronicles: [],
        pendingResourceDrops: [],
        overlaySettings: {territory: false, resources: true, resourceFilters: {food: true, tree: true, stone: true, metals: true, drops: true}},
        pendingAttacks: [],
        pendingStructureAttacks: [],
        pendingIncidents: [],
        pendingRangedImpacts: [],
        visualProjectiles: new Set(),
        resources: new Map(),
        weapons: new Map(),
        armors: new Map(),
        technologies: new Map(TECH_BY_ID),
        eras: new Map((TechData.ERAS || []).map((era) => [era.id, era])),
        nextHumanId: 1,
        nextFactionId: 1,
        nextSettlementId: 1,
        nextBuildingId: 1,
        nextTreeId: 1,
        nextTerritoryClaimOrder: 1,
        navigationRevision: 1,
        routeSearches: new Map(),
        routeRejectedEdges: new Map(),
        lastFullRebuild: -1,
        lastIndexTick: -1,
        lastDerivedRefreshTick: -1,
        lastAuditStartedTick: -1,
        lastAuditCompletedTick: -1,
        auditCursor: 0,
        auditLimit: 0,
        auditRunning: false,
        derivedIndexesDirty: false,
        lifecycleEvents: 0,
        auditPixels: 0,
        lastDiplomacyTick: -1,
        perfTotal: 0,
        perfSamples: 0,
        perfMax: 0
    };

    function allTechnologies() {
        return Array.from(manager.technologies.values());
    }

    function hasTechnologyData() {
        return manager.technologies.size > 0;
    }

    function nowMs() {
        return root.performance && root.performance.now ? root.performance.now() : Date.now();
    }

    function safeNumber(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }

    function ensureTerritoryIndex() {
        const worldWidth = typeof width === "number" && width >= 0 ? width + 1 : 1;
        if (!World.TerritoryIndex) return null;
        if (!manager.territory) manager.territory = new World.TerritoryIndex(worldWidth, C.TERRITORY_HALF_WIDTH);
        else if (manager.territory.width !== worldWidth) manager.territory.resize(worldWidth);
        return manager.territory;
    }

    let cachedTimestampSecond = -1;
    let cachedTimestampText = "";
    function eventTimestamp() {
        const milliseconds = Date.now();
        const second = Math.floor(milliseconds / 1000);
        if (second === cachedTimestampSecond) return cachedTimestampText;
        cachedTimestampSecond = second;
        if (World.realTimestamp) cachedTimestampText = World.realTimestamp(milliseconds);
        else {
            const d = new Date(milliseconds);
            const pad = (value) => String(value).padStart(2, "0");
            cachedTimestampText = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
        }
        return cachedTimestampText;
    }

    function ensureChronicle(settlement) {
        if (!settlement) return [];
        if (!Array.isArray(settlement.chronicle)) settlement.chronicle = [];
        if (!settlement.firstNaturalResources || typeof settlement.firstNaturalResources !== "object") settlement.firstNaturalResources = {};
        return settlement.chronicle;
    }

    function migrateLegacyDeathArchive(settlement) {
        if (!settlement) return false;
        const legacy = Array.isArray(settlement.deceasedPeople) ? settlement.deceasedPeople : [];
        let highestHumanId = Math.max(0, safeNumber(settlement.humanIdHighWatermark, 0));
        let validDeaths = 0;
        for (let i = 0; i < legacy.length; i++) {
            const entry = legacy[i];
            if (!entry || !Number.isFinite(entry.h)) continue;
            validDeaths++;
            highestHumanId = Math.max(highestHumanId, entry.h);
        }
        settlement.deathCount = Math.max(0, safeNumber(settlement.deathCount, 0), validDeaths);
        settlement.humanIdHighWatermark = highestHumanId;
        if (Object.prototype.hasOwnProperty.call(settlement, "deceasedPeople")) delete settlement.deceasedPeople;
        return validDeaths > 0;
    }

    function logSettlementEvent(settlement, type, message, data) {
        if (!settlement) return null;
        const event = Object.assign({timestamp: eventTimestamp(), tick: pixelTicks, type: type, message: message || type}, data || {});
        const log = ensureChronicle(settlement);
        if (World.appendChronicle) World.appendChronicle(log, event, C.MAX_CHRONICLE_EVENTS);
        else {
            log.push(event);
            if (log.length > C.MAX_CHRONICLE_EVENTS) log.splice(0, log.length - C.MAX_CHRONICLE_EVENTS);
        }
        return event;
    }

    function logFactionEvent(factionId, type, message, data) {
        const faction = manager.factionById.get(Number(factionId));
        if (!faction || !faction.settlements.length) return null;
        return logSettlementEvent(faction.settlements[0], type, message, data);
    }

    function randomLifespanYears() {
        if (Core.randomLifespanYears) return Core.randomLifespanYears(Math.random);
        return C.LIFESPAN_MIN_YEARS + Math.floor(Math.random() * (C.LIFESPAN_MAX_YEARS - C.LIFESPAN_MIN_YEARS + 1));
    }

    function ensureLifeHistory(actor, isAdult) {
        if (!actor) return null;
        if (actor.lifeSchemaVersion !== 2 && Number.isFinite(actor.birthTick) && Number.isFinite(actor.naturalDeathTick) && Number.isFinite(actor.lifespanYears)) {
            const storedTicksPerYear = (actor.naturalDeathTick - actor.birthTick) / Math.max(1, actor.lifespanYears);
            if (storedTicksPerYear > 50 && storedTicksPerYear < C.TICKS_PER_YEAR * 0.75) {
                const age = Math.max(0, (pixelTicks - actor.birthTick) / storedTicksPerYear);
                const remaining = Math.max(0, (actor.naturalDeathTick - pixelTicks) / storedTicksPerYear);
                actor.birthTick = pixelTicks - age * C.TICKS_PER_YEAR;
                actor.naturalDeathTick = pixelTicks + remaining * C.TICKS_PER_YEAR;
            }
        }
        const history = Core.createLifeHistory ? Core.createLifeHistory({
            currentTick: pixelTicks,
            isAdult: !!isAdult,
            birthTick: actor.birthTick,
            lifespanYears: actor.lifespanYears,
            naturalDeathTick: actor.naturalDeathTick,
            ticksPerYear: C.TICKS_PER_YEAR,
            adultAgeYears: C.ADULT_AGE_YEARS,
            minimumYears: C.LIFESPAN_MIN_YEARS,
            maximumYears: C.LIFESPAN_MAX_YEARS
        }) : null;
        const adultOffset = C.ADULT_AGE_YEARS * C.TICKS_PER_YEAR;
        if (history) Object.assign(actor, history);
        if (!Number.isFinite(actor.birthTick)) actor.birthTick = isAdult ? pixelTicks - adultOffset : pixelTicks;
        if (!Number.isFinite(actor.lifespanYears)) actor.lifespanYears = randomLifespanYears();
        if (!Number.isFinite(actor.naturalDeathTick)) actor.naturalDeathTick = actor.birthTick + actor.lifespanYears * C.TICKS_PER_YEAR;
        actor.lifeSchemaVersion = 2;
        actor.ageTicks = Math.max(0, pixelTicks - actor.birthTick);
        return actor;
    }

    function ageYears(actor) {
        if (!actor || !Number.isFinite(actor.birthTick)) return 0;
        if (Core.ageInYears) return Core.ageInYears(actor, pixelTicks, C.TICKS_PER_YEAR);
        return Math.max(0, (pixelTicks - actor.birthTick) / C.TICKS_PER_YEAR);
    }

    function cloneActivityValue(value) {
        if (value === undefined) return undefined;
        if (value === null || typeof value !== "object") return value;
        try { return JSON.parse(JSON.stringify(value)); }
        catch (error) { return null; }
    }

    function normalizedActivityTask(task) {
        const value = String(task || "idle");
        return value === "wander" ? "idle" : value;
    }

    function activityTargetSnapshot(actor, target) {
        const key = taskTargetKey(target) || actor && actor.targetKey || null;
        const targetId = target && (target.humanId || target.buildingId || target.settlementId);
        const targetKind = target && (target.element || target.kind);
        return {
            g: key,
            i: Number.isFinite(targetId) ? targetId : (Number.isFinite(actor && actor.targetId) ? actor.targetId : null),
            e: targetKind || actor && actor.targetKind || null,
            x: Number.isFinite(target && target.x) ? target.x : (Number.isFinite(actor && actor.targetX) ? actor.targetX : null),
            y: Number.isFinite(target && target.y) ? target.y : (Number.isFinite(actor && actor.targetY) ? actor.targetY : null)
        };
    }

    function newPersonActivity() {
        return {v: C.PERSON_ACTIVITY_SCHEMA_VERSION, n: 1, c: null, h: []};
    }

    function activityRecordSequence(record) {
        return record && Number.isFinite(record.n) ? record.n : 0;
    }

    function trimPersonActivity(data) {
        if (!data || !Array.isArray(data.h)) return;
        if (data.h.length > C.MAX_PERSON_ACTIVITY) data.h.splice(0, data.h.length - C.MAX_PERSON_ACTIVITY);
    }

    function makeActivitySession(actor, task, target, kind) {
        const data = actor.personActivity;
        const targetData = activityTargetSnapshot(actor, target);
        const timestamp = eventTimestamp();
        const milliseconds = Date.now();
        return {
            n: data.n++,
            k: kind || "task",
            t: normalizedActivityTask(task),
            g: targetData.g,
            i: targetData.i,
            e: targetData.e,
            x: targetData.x,
            y: targetData.y,
            a: timestamp,
            am: milliseconds,
            at: pixelTicks,
            f: Number.isFinite(actor.factionId) ? actor.factionId : null,
            l: Number.isFinite(actor.settlementId) ? actor.settlementId : null,
            r: actor.role || (actor.element === "civ_child" ? "child" : "worker"),
            ph: actor.pathStage || "planning",
            d: {}
        };
    }

    function ensurePersonActivity(actor, openCurrent) {
        if (!actor) return null;
        let data = actor.personActivity;
        if (!data || typeof data !== "object" || Array.isArray(data)) data = newPersonActivity();
        if (!normalizedPersonActivityData.has(data)) {
            data.v = C.PERSON_ACTIVITY_SCHEMA_VERSION;
            if (!Array.isArray(data.h)) data.h = [];
            data.h = data.h.filter((record) => record && typeof record === "object" && Number.isFinite(record.n));
            trimPersonActivity(data);
            const highestSequence = data.h.reduce((maximum, record) => Math.max(maximum, activityRecordSequence(record)), activityRecordSequence(data.c));
            data.n = Math.max(highestSequence + 1, Number.isFinite(data.n) ? data.n : 1);
            if (!data.c || typeof data.c !== "object" || !Number.isFinite(data.c.n)) data.c = null;
            normalizedPersonActivityData.add(data);
        }
        actor.personActivity = data;
        if (openCurrent !== false && !actor.dead && !data.c) data.c = makeActivitySession(actor, actor.task || "idle", null, "task");
        return data;
    }

    function mergeActivityMetrics(target, patch) {
        if (!patch || typeof patch !== "object") return target;
        Object.keys(patch).forEach((key) => {
            const value = patch[key];
            if (Number.isFinite(value)) target[key] = safeNumber(target[key], 0) + value;
            else if (value && typeof value === "object" && !Array.isArray(value)) {
                if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
                Object.keys(value).forEach((nestedKey) => {
                    const nestedValue = value[nestedKey];
                    if (Number.isFinite(nestedValue)) target[key][nestedKey] = safeNumber(target[key][nestedKey], 0) + nestedValue;
                    else target[key][nestedKey] = cloneActivityValue(nestedValue);
                });
            }
            else target[key] = cloneActivityValue(value);
        });
        return target;
    }

    function addPersonActivityMetrics(actor, patch) {
        const data = ensurePersonActivity(actor, true);
        if (!data || !data.c) return false;
        mergeActivityMetrics(data.c.d, patch);
        return true;
    }

    function setPersonActivityPhase(actor, phase) {
        const data = ensurePersonActivity(actor, true);
        if (data && data.c) data.c.ph = phase || "planning";
    }

    function appendPersonActivity(actor, record) {
        const data = ensurePersonActivity(actor, false);
        if (!data || !record) return null;
        data.h.push(record);
        trimPersonActivity(data);
        return record;
    }

    function finishPersonActivity(actor, outcome, reason, resultPatch) {
        const data = ensurePersonActivity(actor, false);
        if (!data || !data.c) return null;
        const record = data.c;
        mergeActivityMetrics(record.d, resultPatch);
        record.b = eventTimestamp();
        record.bm = Date.now();
        record.bt = pixelTicks;
        record.o = outcome || "interrupted";
        record.z = reason || "replanned";
        record.d.durationTicks = Math.max(0, record.bt - safeNumber(record.at, record.bt));
        delete record.ph;
        data.c = null;
        return appendPersonActivity(actor, record);
    }

    function recordPersonLifeEvent(actor, event, details) {
        if (!actor || !event) return null;
        const data = ensurePersonActivity(actor, false);
        const record = makeActivitySession(actor, event, null, "life");
        record.b = record.a;
        record.bm = record.am;
        record.bt = record.at;
        record.o = "completed";
        record.z = event;
        record.d = cloneActivityValue(details) || {};
        return appendPersonActivity(actor, record);
    }

    function beginPersonActivity(actor, task, target) {
        if (!actor || actor.dead) return null;
        const data = ensurePersonActivity(actor, false);
        const nextTask = normalizedActivityTask(task);
        const nextTarget = activityTargetSnapshot(actor, target);
        if (data.c && data.c.t === nextTask && data.c.g === nextTarget.g) {
            data.c.i = nextTarget.i;
            data.c.e = nextTarget.e;
            data.c.x = nextTarget.x;
            data.c.y = nextTarget.y;
            return data.c;
        }
        if (data.c) finishPersonActivity(actor, "interrupted", "reassigned");
        data.c = makeActivitySession(actor, nextTask, target, "task");
        return data.c;
    }

    function treeSaplingTotal(stock) {
        if (!stock || !stock.treeSaplings) return 0;
        return Array.from(TREE_SAPLING_ELEMENTS).reduce((sum, seed) => sum + Math.max(0, safeNumber(stock.treeSaplings[seed], 0)), 0);
    }

    function migrateLegacyStock(stock) {
        if (!stock || safeNumber(stock.resourceSchemaVersion, 0) >= RESOURCE_SCHEMA_VERSION) return;
        if (!stock.materials || typeof stock.materials !== "object") stock.materials = {};
        if (!stock.seeds || typeof stock.seeds !== "object") stock.seeds = {};
        if (!stock.treeSaplings || typeof stock.treeSaplings !== "object") stock.treeSaplings = {};
        const legacyTreeSaplings = {apling: "sapling", inecone: "pinecone", amboo_plant: "bamboo_plant"};
        Object.keys(legacyTreeSaplings).forEach((legacyKey) => {
            if (!Object.prototype.hasOwnProperty.call(stock.treeSaplings, legacyKey)) return;
            const seed = legacyTreeSaplings[legacyKey];
            stock.treeSaplings[seed] = Math.max(0, safeNumber(stock.treeSaplings[seed], 0)) + Math.max(0, safeNumber(stock.treeSaplings[legacyKey], 0));
            delete stock.treeSaplings[legacyKey];
        });
        TREE_SAPLING_ELEMENTS.forEach((seed) => {
            const amount = Math.max(0, safeNumber(stock.seeds[seed], 0));
            stock.treeSaplings[seed] = Math.max(0, safeNumber(stock.treeSaplings[seed], 0)) + amount;
            delete stock.seeds[seed];
        });
        const cropSeedFood = Object.keys(stock.seeds).reduce((sum, seed) => sum + Math.max(0, safeNumber(stock.seeds[seed], 0)), 0);
        const legacyTin = Math.max(0, safeNumber(stock.tin, 0), safeNumber(stock.materials.tin, 0));
        const legacyCharcoal = Math.max(0, safeNumber(stock.charcoal, 0), safeNumber(stock.materials.charcoal, 0));
        const existingCopper = Math.max(0, safeNumber(stock.copper, 0), safeNumber(stock.materials.copper, 0));
        const detailedWood = Math.max(0, safeNumber(stock.materials.tree_branch, 0)) + Math.max(0, safeNumber(stock.materials.bamboo, 0)) + Math.max(0, safeNumber(stock.materials.wood, 0));
        const existingWood = Math.max(0, safeNumber(stock.wood, 0), detailedWood);
        const missingWoodDetail = Math.max(0, existingWood - detailedWood);
        stock.food = Math.max(0, safeNumber(stock.food, 0)) + cropSeedFood;
        stock.wood = existingWood + legacyCharcoal * 3;
        stock.materials.wood = Math.max(0, safeNumber(stock.materials.wood, 0)) + missingWoodDetail + legacyCharcoal * 3;
        stock.copper = existingCopper + legacyTin;
        stock.materials.copper = stock.copper;
        stock.seeds = {};
        delete stock.tin;
        delete stock.charcoal;
        delete stock.materials.tin;
        delete stock.materials.charcoal;
        stock.resourceSchemaVersion = RESOURCE_SCHEMA_VERSION;
    }

    function ensureStock(banner) {
        if (!banner) return null;
        if (!banner.stock || typeof banner.stock !== "object") banner.stock = {};
        const stock = banner.stock;
        if (!stock.materials || typeof stock.materials !== "object") stock.materials = {};
        if (!stock.seeds || typeof stock.seeds !== "object") stock.seeds = {};
        if (!stock.treeSaplings || typeof stock.treeSaplings !== "object") stock.treeSaplings = {};
        migrateLegacyStock(stock);
        stock.food = Math.max(0, safeNumber(stock.food, 0));
        stock.wood = Math.max(0, safeNumber(stock.wood, 0));
        stock.stone = Math.max(0, safeNumber(stock.stone, 0));
        TREE_SAPLING_ELEMENTS.forEach((seed) => { stock.treeSaplings[seed] = Math.max(0, safeNumber(stock.treeSaplings[seed], 0)); });
        MATERIAL_KEYS.forEach((key) => { stock.materials[key] = Math.max(0, safeNumber(stock.materials[key], 0)); });
        const detailedWood = stock.materials.tree_branch + stock.materials.bamboo + stock.materials.wood;
        if (detailedWood > stock.wood) stock.wood = detailedWood;
        if (stock.materials.stone > stock.stone) stock.stone = stock.materials.stone;
        ["copper", "bronze", "raw_iron", "iron", "steel"].forEach((key) => {
            stock[key] = Math.max(0, safeNumber(stock[key], stock.materials[key]));
            if (stock.materials[key] < stock[key]) stock.materials[key] = stock[key];
        });
        stock.sapling = treeSaplingTotal(stock);
        stock.resourceSchemaVersion = RESOURCE_SCHEMA_VERSION;
        return stock;
    }

    function materialAmount(stock, key) {
        if (!stock) return 0;
        if (key === "food") return Math.max(0, safeNumber(stock.food, 0));
        if (key === "wood") return Math.max(0, safeNumber(stock.wood, 0));
        if (key === "stone") return Math.max(0, safeNumber(stock.stone, 0));
        if (key === "sapling") return treeSaplingTotal(stock);
        return Math.max(0, safeNumber(stock[key], stock.materials && stock.materials[key] || 0));
    }

    function addMaterial(stock, key, amount, sourceElement) {
        if (!stock || !amount) return;
        amount = Math.max(0, Number(amount) || 0);
        if (!stock.materials) stock.materials = {};
        if (key === "food") {
            stock.food = safeNumber(stock.food, 0) + amount;
        }
        else if (key === "wood") {
            const detailKey = sourceElement === "tree_branch" || sourceElement === "bamboo" ? sourceElement : "wood";
            stock.materials[detailKey] = safeNumber(stock.materials[detailKey], 0) + amount;
            stock.wood = safeNumber(stock.wood, 0) + amount;
        }
        else if (key === "stone") {
            stock.materials.stone = safeNumber(stock.materials.stone, 0) + amount;
            stock.stone = safeNumber(stock.stone, 0) + amount;
        }
        else if (key === "sapling") {
            if (!stock.treeSaplings || typeof stock.treeSaplings !== "object") stock.treeSaplings = {};
            stock.treeSaplings.sapling = safeNumber(stock.treeSaplings.sapling, 0) + amount;
            stock.sapling = treeSaplingTotal(stock);
        }
        else {
            stock.materials[key] = safeNumber(stock.materials[key], 0) + amount;
            stock[key] = safeNumber(stock[key], 0) + amount;
        }
    }

    function spendMaterial(stock, key, amount) {
        amount = Math.max(0, Number(amount) || 0);
        if (!stock || materialAmount(stock, key) < amount) return false;
        if (key === "food") {
            stock.food -= amount;
        }
        else if (key === "wood") {
            stock.wood -= amount;
            let remaining = amount;
            ["tree_branch", "bamboo", "wood"].forEach((detailKey) => {
                if (!remaining || !stock.materials) return;
                const used = Math.min(remaining, safeNumber(stock.materials[detailKey], 0));
                stock.materials[detailKey] -= used;
                remaining -= used;
            });
        }
        else if (key === "stone") {
            stock.stone -= amount;
            if (stock.materials) stock.materials.stone = Math.max(0, safeNumber(stock.materials.stone, 0) - amount);
        }
        else if (key === "sapling") {
            let remaining = amount;
            ["sapling", "pinecone", "bamboo_plant"].forEach((seed) => {
                if (!remaining) return;
                const used = Math.min(remaining, safeNumber(stock.treeSaplings && stock.treeSaplings[seed], 0));
                stock.treeSaplings[seed] -= used;
                remaining -= used;
            });
            stock.sapling = treeSaplingTotal(stock);
        }
        else {
            stock[key] = Math.max(0, safeNumber(stock[key], 0) - amount);
            if (stock.materials) stock.materials[key] = Math.max(0, safeNumber(stock.materials[key], 0) - amount);
        }
        return true;
    }

    function migrateLegacyResearchState(research) {
        if (!research || safeNumber(research.schemaVersion, 0) >= RESEARCH_SCHEMA_VERSION) return research;
        let refundedKnowledge = 0;
        const moveTechnologyState = (sourceId, targetId) => {
            const sourceProgress = Math.max(0, safeNumber(research.progress[sourceId], 0));
            const sourceForced = !!research.forcedUnlocked[sourceId];
            const targetAlreadyPresent = !!research.unlocked[targetId] || safeNumber(research.progress[targetId], 0) > 0;
            if (research.unlocked[sourceId]) research.unlocked[targetId] = true;
            if (sourceForced) research.forcedUnlocked[targetId] = true;
            if (sourceProgress > 0) {
                if (targetAlreadyPresent && !sourceForced) refundedKnowledge += sourceProgress;
                else research.progress[targetId] = Math.max(safeNumber(research.progress[targetId], 0), sourceProgress);
            }
            delete research.unlocked[sourceId];
            delete research.progress[sourceId];
            delete research.forcedUnlocked[sourceId];
        };
        Object.keys(LEGACY_TECH_ID_MIGRATIONS).forEach((sourceId) => {
            moveTechnologyState(sourceId, LEGACY_TECH_ID_MIGRATIONS[sourceId]);
        });
        LEGACY_REMOVED_TECH_IDS.forEach((techId) => {
            if (!research.forcedUnlocked[techId]) refundedKnowledge += Math.max(0, safeNumber(research.progress[techId], 0));
            delete research.unlocked[techId];
            delete research.progress[techId];
            delete research.forcedUnlocked[techId];
        });
        const mappedId = (techId) => LEGACY_TECH_ID_MIGRATIONS[techId] || techId;
        ["focusTechId", "activeTechId", "blockedTechId", "lastUnlockedTechId"].forEach((field) => {
            if (!research[field]) return;
            const nextId = mappedId(research[field]);
            if (manager.technologies.has(nextId)) research[field] = nextId;
            else delete research[field];
        });
        if (Array.isArray(research.priorityQueue)) research.priorityQueue = research.priorityQueue.map(mappedId);
        research.knowledge = Math.max(0, safeNumber(research.knowledge, 0)) + refundedKnowledge;
        research.migrationKnowledgeRefund = safeNumber(research.migrationKnowledgeRefund, 0) + refundedKnowledge;
        research.schemaVersion = RESEARCH_SCHEMA_VERSION;
        return research;
    }

    function ensureResearchState(banner) {
        if (!banner) return null;
        if (!banner.eraId || !ERA_INDEX.has(banner.eraId)) banner.eraId = DEFAULT_ERA_ID;
        if (!banner.research || typeof banner.research !== "object") banner.research = {};
        const research = banner.research;
        research.knowledge = Math.max(0, safeNumber(research.knowledge, 0));
        research.lastKnowledgeGain = Math.max(0, safeNumber(research.lastKnowledgeGain, 0));
        research.totalKnowledgeGenerated = Math.max(research.knowledge, safeNumber(research.totalKnowledgeGenerated, research.knowledge));
        if (!research.domainExperience || typeof research.domainExperience !== "object") research.domainExperience = {};
        ["production", "construction", "society", "military"].forEach((domain) => {
            research.domainExperience[domain] = Math.max(0, safeNumber(research.domainExperience[domain], 0));
        });
        if (!research.unlocked || typeof research.unlocked !== "object") research.unlocked = {};
        if (!research.progress || typeof research.progress !== "object") research.progress = {};
        if (!research.forcedUnlocked || typeof research.forcedUnlocked !== "object") research.forcedUnlocked = {};
        migrateLegacyResearchState(research);
        if (!research.discoveries || typeof research.discoveries !== "object") research.discoveries = {};
        if (!research.milestones || typeof research.milestones !== "object") research.milestones = {};
        if (!Array.isArray(research.priorityQueue)) research.priorityQueue = research.focusTechId ? [research.focusTechId] : [];
        research.priorityQueue = research.priorityQueue.filter((techId, index, array) => manager.technologies.has(techId) && array.indexOf(techId) === index && !research.unlocked[techId]);
        research.schemaVersion = RESEARCH_SCHEMA_VERSION;
        if (!Number.isFinite(research.lastStepTick)) research.lastStepTick = pixelTicks;
        return research;
    }

    function hasTech(factionOrBanner, techId) {
        const banner = factionOrBanner && factionOrBanner.element === "civ_banner" ? factionOrBanner : factionOrBanner && factionOrBanner.settlements && factionOrBanner.settlements[0];
        return !!(banner && banner.research && banner.research.unlocked && banner.research.unlocked[techId]);
    }

    function eraIndexFor(factionOrBanner) {
        const banner = factionOrBanner && factionOrBanner.element === "civ_banner" ? factionOrBanner : factionOrBanner && factionOrBanner.settlements && factionOrBanner.settlements[0];
        return ERA_INDEX.has(banner && banner.eraId) ? ERA_INDEX.get(banner.eraId) : 0;
    }

    function fallbackCompileTechnologyEffects(technologies) {
        const unlocks = {building: [], weapon: [], armor: [], role: [], resource: [], recipe: []};
        const modifiers = {};
        const features = [];
        (technologies || []).forEach((tech) => (tech.effects || []).forEach((effect) => {
            if (effect.type === "unlock" && unlocks[effect.target]) unlocks[effect.target].push(effect.id);
            else if ((effect.type === "modifier" || effect.type === "set") && effect.stat) {
                if (!modifiers[effect.stat]) modifiers[effect.stat] = {add: 0, multiply: 1};
                if (effect.type === "set") modifiers[effect.stat].set = effect.value;
                else if (effect.operation === "add") modifiers[effect.stat].add += safeNumber(effect.value, 0);
                else if (effect.operation === "multiply") modifiers[effect.stat].multiply *= safeNumber(effect.value, 1);
            }
            else if (effect.type === "enable" && effect.feature) features.push(effect.feature);
        }));
        return {unlocks, modifiers, features};
    }

    function compiledModifierValue(compiled, name, fallback) {
        const modifier = compiled && compiled.modifiers && compiled.modifiers[name];
        if (!modifier) return fallback;
        if (modifier.operation === "set") return safeNumber(modifier.value, fallback);
        if (modifier.operation === "add") return fallback + safeNumber(modifier.value, 0);
        if (modifier.operation === "multiply") return fallback * safeNumber(modifier.value, 1);
        let value = modifier.set === undefined ? fallback : safeNumber(modifier.set, fallback);
        value += safeNumber(modifier.add, 0);
        value *= safeNumber(modifier.multiply, 1);
        return value;
    }

    function computeTechCapabilities(faction) {
        const unlockedTechnologies = faction && faction.settlements && faction.settlements[0]
            ? allTechnologies().filter((tech) => hasTech(faction, tech.id)) : [];
        let compiled;
        try {
            compiled = Core.compileTechnologyEffects ? Core.compileTechnologyEffects(unlockedTechnologies) : fallbackCompileTechnologyEffects(unlockedTechnologies);
        }
        catch (error) {
            if (root.console && console.error) console.error("Human Society technology effect error", error);
            compiled = fallbackCompileTechnologyEffects(unlockedTechnologies);
        }
        const unlocks = {};
        ["building", "weapon", "armor", "role", "resource", "recipe"].forEach((target) => {
            unlocks[target] = new Set(compiled && compiled.unlocks && compiled.unlocks[target] || []);
        });
        const features = new Set(compiled && compiled.features || []);
        return {
            unlocks,
            features,
            modifiers: {
                carryCapacity: Math.max(C.BASE_CARRY_CAPACITY, compiledModifierValue(compiled, "carryCapacity", C.BASE_CARRY_CAPACITY)),
                harvestDurationMultiplier: Math.max(0.1, compiledModifierValue(compiled, "harvestDurationMultiplier", 1)),
                woodHarvestDurationMultiplier: Math.max(0.1, compiledModifierValue(compiled, "woodHarvestDurationMultiplier", 1)),
                forestryRecheckMultiplier: Math.max(0.1, compiledModifierValue(compiled, "forestryRecheckMultiplier", 1)),
                stoneHarvestDurationMultiplier: Math.max(0.1, compiledModifierValue(compiled, "stoneHarvestDurationMultiplier", 1)),
                foodHarvestDurationMultiplier: Math.max(0.1, compiledModifierValue(compiled, "foodHarvestDurationMultiplier", 1)),
                foodYieldBonus: Math.max(0, compiledModifierValue(compiled, "foodYieldBonus", 0)),
                woodYieldBonus: Math.max(0, compiledModifierValue(compiled, "woodYieldBonus", 0)),
                stoneYieldBonus: Math.max(0, compiledModifierValue(compiled, "stoneYieldBonus", 0)),
                copperYieldBonus: Math.max(0, compiledModifierValue(compiled, "copperYieldBonus", 0)),
                rawIronYieldBonus: Math.max(0, compiledModifierValue(compiled, "rawIronYieldBonus", 0)),
                buildDurationMultiplier: Math.max(0.1, compiledModifierValue(compiled, "buildDurationMultiplier", 1)),
                roleWorkRateMultiplier: Math.max(0.1, compiledModifierValue(compiled, "roleWorkRateMultiplier", 1)),
                knowledgeRateMultiplier: Math.max(0.1, compiledModifierValue(compiled, "knowledgeRateMultiplier", 1)),
                milestoneKnowledgeMultiplier: Math.max(0.1, compiledModifierValue(compiled, "milestoneKnowledgeMultiplier", 1)),
                hutHousingBonus: Math.max(0, compiledModifierValue(compiled, "hutHousingBonus", 0)),
                constructionSlots: Math.max(1, Math.floor(compiledModifierValue(compiled, "constructionSlots", 1))),
                peacetimeWarriors: Math.max(0, Math.floor(compiledModifierValue(compiled, "peacetimeWarriors", 0))),
                wartimeWarriorRatio: Math.max(0, Math.min(1, compiledModifierValue(compiled, "wartimeWarriorRatio", C.WARTIME_WARRIOR_RATIO))),
                incomingDamageMultiplier: Math.max(0.1, Math.min(1, compiledModifierValue(compiled, "incomingDamageMultiplier", 1))),
                oldTechCostMultiplier: Math.max(0.1, Math.min(1, compiledModifierValue(compiled, "oldTechCostMultiplier", 1))),
                structureDamageMultiplier: Math.max(0.1, compiledModifierValue(compiled, "structureDamageMultiplier", 1))
            }
        };
    }

    function computeTechModifiers(faction) {
        const capabilities = computeTechCapabilities(faction);
        if (faction) faction.techCapabilities = capabilities;
        const mods = capabilities.modifiers;
        return {
            carryCapacity: mods.carryCapacity,
            harvestSpeed: mods.harvestDurationMultiplier,
            woodHarvestSpeed: mods.woodHarvestDurationMultiplier,
            forestryRecheckMultiplier: mods.forestryRecheckMultiplier,
            stoneHarvestSpeed: mods.stoneHarvestDurationMultiplier,
            foodHarvestSpeed: mods.foodHarvestDurationMultiplier,
            resourceYieldBonuses: {
                food: mods.foodYieldBonus,
                wood: mods.woodYieldBonus,
                stone: mods.stoneYieldBonus,
                copper: mods.copperYieldBonus,
                raw_iron: mods.rawIronYieldBonus
            },
            buildSpeed: mods.buildDurationMultiplier,
            knowledgeRate: mods.knowledgeRateMultiplier,
            milestoneKnowledge: mods.milestoneKnowledgeMultiplier,
            roleWorkSpeed: mods.roleWorkRateMultiplier,
            hutHousingBonus: mods.hutHousingBonus,
            constructionSlots: mods.constructionSlots,
            wartimeWarriorRatio: mods.wartimeWarriorRatio,
            peacetimeWarriors: mods.peacetimeWarriors,
            incomingDamageMultiplier: mods.incomingDamageMultiplier,
            structureDamageMultiplier: mods.structureDamageMultiplier,
            oldTechDiscount: 1 - mods.oldTechCostMultiplier
        };
    }

    function factionHasUnlock(faction, target, id) {
        if (!faction) return false;
        if (!faction.techCapabilities) faction.techModifiers = computeTechModifiers(faction);
        return !!(faction.techCapabilities && faction.techCapabilities.unlocks[target] && faction.techCapabilities.unlocks[target].has(id));
    }

    function factionHasFeature(faction, feature) {
        if (!faction) return false;
        if (feature === "treePlanting") return true;
        if (!hasTechnologyData()) return true;
        if (!faction.techCapabilities) faction.techModifiers = computeTechModifiers(faction);
        return !!(faction.techCapabilities && faction.techCapabilities.features.has(feature));
    }

    function unlockedBuilding(faction, type) {
        if (type === "lumberyard") return true;
        if (!hasTechnologyData()) return type === "hut" || type === "quarry";
        return factionHasUnlock(faction, "building", type);
    }

    function eraDefinition(eraId) {
        return manager.eras.get(eraId) || (TechData.ERAS || []).find((era) => era.id === eraId) || null;
    }

    function smeltingWoodReserveFor(value) {
        const eraId = typeof value === "string" ? value : value && value.eraId;
        return Math.max(0, Math.floor(safeNumber(WOOD_SMELTING_RESERVE_BY_ERA[ERA_INDEX.has(eraId) ? eraId : DEFAULT_ERA_ID], 0)));
    }

    function techEraId(tech) {
        return tech && (tech.era || tech.eraId) || DEFAULT_ERA_ID;
    }

    function availableFuelStock(stock) {
        ensureStock({stock: stock});
        return {wood: Math.max(0, Math.floor(materialAmount(stock, "wood")))};
    }

    function availableHeat(stock) {
        const available = availableFuelStock(stock);
        return Object.keys(FUEL_VALUES).reduce((total, fuel) => total + safeNumber(available[fuel], 0) * safeNumber(FUEL_VALUES[fuel], 0), 0);
    }

    function techConditionMet(tech, faction, banner, condition) {
        if (!condition) return true;
        const research = ensureResearchState(banner);
        if (condition.type === "population") return faction.population >= safeNumber(condition.minimum, 0);
        if (condition.type === "resource_stock") return faction.settlements.reduce((total, settlement) => total + materialAmount(ensureStock(settlement), condition.resource), 0) >= safeNumber(condition.minimum, 0);
        if (condition.type === "resource_encountered") return safeNumber(research.discoveries[condition.resource], 0) >= safeNumber(condition.minimum, 0);
        if (condition.type === "heat_available") return faction.settlements.reduce((total, settlement) => total + availableHeat(ensureStock(settlement)), 0) >= safeNumber(condition.minimum, 0);
        if (condition.type === "milestone") return safeNumber(research.milestones[condition.id], 0) >= safeNumber(condition.minimum, 0);
        return true;
    }

    function techConditionCurrent(faction, banner, condition) {
        const research = ensureResearchState(banner);
        if (!condition) return 0;
        if (condition.type === "population") return faction.population;
        if (condition.type === "resource_stock") return faction.settlements.reduce((total, settlement) => total + materialAmount(ensureStock(settlement), condition.resource), 0);
        if (condition.type === "resource_encountered") return safeNumber(research.discoveries[condition.resource], 0);
        if (condition.type === "heat_available") return faction.settlements.reduce((total, settlement) => total + availableHeat(ensureStock(settlement)), 0);
        if (condition.type === "milestone") return safeNumber(research.milestones[condition.id], 0);
        return 0;
    }

    function techAvailability(tech, faction, banner) {
        if (!tech || !faction || !banner) return {available: false, prerequisitesMet: false, conditionsMet: false};
        const research = ensureResearchState(banner);
        const prerequisitesMet = (tech.prerequisites || []).every((techId) => !!research.unlocked[techId]);
        const eraAvailable = safeNumber(tech.eraIndex, ERA_INDEX.get(techEraId(tech)) || 0) <= eraIndexFor(banner);
        const conditionStates = (tech.conditions || []).map((condition) => ({
            condition: condition,
            met: techConditionMet(tech, faction, banner, condition),
            current: techConditionCurrent(faction, banner, condition),
            required: safeNumber(condition.minimum, 0)
        }));
        const conditionsMet = conditionStates.every((state) => state.met);
        return {
            available: eraAvailable && prerequisitesMet && conditionsMet && !research.unlocked[tech.id],
            eraAvailable: eraAvailable,
            prerequisitesMet: prerequisitesMet,
            conditionsMet: conditionsMet,
            conditionStates: conditionStates
        };
    }

    function effectiveResearchCost(tech, faction, banner) {
        if (!tech) return 0;
        const research = ensureResearchState(banner);
        let baseCost = Math.max(1, safeNumber(tech.cost, 1));
        if (safeNumber(tech.eraIndex, 0) < eraIndexFor(banner)) {
            baseCost *= 1 - safeNumber(faction.techModifiers && faction.techModifiers.oldTechDiscount, 0);
        }
        const experience = safeNumber(research.domainExperience[tech.domain], 0);
        return Core.researchCost ? Core.researchCost(baseCost, experience) : Math.ceil(baseCost * (1 - Math.min(C.RESEARCH_DOMAIN_DISCOUNT_MAX, experience / 100)));
    }

    function recordDiscovery(banner, resource, amount) {
        if (!banner || !resource) return;
        const research = ensureResearchState(banner);
        research.discoveries[resource] = Math.max(0, safeNumber(research.discoveries[resource], 0) + Math.max(0, safeNumber(amount, 1)));
    }

    function recordFirstHarvest(banner, resource, amount) {
        if (!banner || !resource || !(amount > 0)) return;
        ensureChronicle(banner);
        if (banner.firstNaturalResources[resource]) return;
        banner.firstNaturalResources[resource] = true;
        logSettlementEvent(banner, "first_resource", "首次采集资源：" + resource, {resource: resource, amount: amount});
    }

    function scanFactionDiscoveries(faction) {
        const banner = faction && faction.settlements[0];
        if (!banner) return;
        const research = ensureResearchState(banner);
        // Resource locations are globally known. Discovery conditions therefore
        // use the same full-map index as gathering instead of a local banner
        // scan, which would otherwise deadlock remote ore technologies.
        let seedLocations = 0;
        let treeSeedLocations = 0;
        manager.resourceIndex.forEach((nodes, kind) => {
            if (!nodes || !nodes.length) return;
            research.discoveries[kind] = Math.max(1, safeNumber(research.discoveries[kind], 0));
            seedLocations += nodes.filter((node) => node.descriptor && (node.descriptor.seed || node.descriptor.seedOnly)).length;
            treeSeedLocations += nodes.filter((node) => node.descriptor && node.descriptor.treeSeed).length;
        });
        if (seedLocations) research.discoveries.seed = Math.max(seedLocations, safeNumber(research.discoveries.seed, 0));
        if (treeSeedLocations) research.discoveries.tree_seed = Math.max(treeSeedLocations, safeNumber(research.discoveries.tree_seed, 0));
        for (let i = 0; i < currentPixels.length; i++) {
            const pixel = currentPixels[i];
            if (pixel && !pixel.del && (pixel.element === "water" || pixel.element === "salt_water" || pixel.element === "dirty_water")) {
                research.discoveries.water = Math.max(1, safeNumber(research.discoveries.water, 0));
                break;
            }
        }
    }

    function addDomainExperience(banner, domain, amount) {
        if (!banner || !domain) return;
        const research = ensureResearchState(banner);
        research.domainExperience[domain] = Math.min(100, safeNumber(research.domainExperience[domain], 0) + Math.max(0, safeNumber(amount, 0)));
    }

    function researchCandidates(faction, banner) {
        const research = ensureResearchState(banner);
        return allTechnologies().filter((tech) => !research.unlocked[tech.id] && techAvailability(tech, faction, banner).available).map((tech) => ({
            id: tech.id,
            domain: tech.domain,
            baseCost: effectiveResearchCost(tech, faction, banner),
            priority: (safeNumber(tech.eraIndex, 0) === eraIndexFor(banner) ? 20 : 0) + (tech.peaceful ? 2 : 0),
            available: true,
            tech: tech
        }));
    }

    function selectResearch(faction, banner) {
        const research = ensureResearchState(banner);
        const candidates = researchCandidates(faction, banner);
        if (!candidates.length) return null;
        for (let i = 0; i < research.priorityQueue.length; i++) {
            const queued = candidates.find((candidate) => candidate.id === research.priorityQueue[i]);
            if (queued) return queued.tech;
        }
        if (Core.selectFocusedResearch) {
            const selected = Core.selectFocusedResearch(candidates, {
                researchedTechs: research.unlocked,
                domainExperience: {},
                focusTechId: research.focusTechId,
                focusDomain: research.focusDomain
            });
            return selected && (selected.tech || TECH_BY_ID.get(selected.id));
        }
        candidates.sort((a, b) => b.priority - a.priority || a.baseCost - b.baseCost);
        const exact = candidates.find((candidate) => candidate.id === research.focusTechId);
        const domain = candidates.find((candidate) => candidate.domain === research.focusDomain);
        return (exact || domain || candidates[0]).tech;
    }

    function researchBlockerForTech(tech, faction, banner, visited) {
        if (!tech) return null;
        const research = ensureResearchState(banner);
        const seen = visited || new Set();
        if (seen.has(tech.id)) return null;
        seen.add(tech.id);
        const prerequisites = tech.prerequisites || [];
        for (let i = 0; i < prerequisites.length; i++) {
            const prerequisiteId = prerequisites[i];
            if (research.unlocked[prerequisiteId]) continue;
            const prerequisite = manager.technologies.get(prerequisiteId);
            const nested = researchBlockerForTech(prerequisite, faction, banner, seen);
            return nested || {type:"prerequisite", id:prerequisiteId, techId:tech.id};
        }
        const availability = techAvailability(tech, faction, banner);
        const unmet = (availability.conditionStates || []).find(state => !state.met);
        if (unmet) return {type:unmet.condition.type, resource:unmet.condition.resource || null, milestone:unmet.condition.id || null, current:unmet.current, required:unmet.required, hard:!!unmet.condition.hard, techId:tech.id};
        if (!availability.eraAvailable) return {type:"era", techId:tech.id, required:techEraId(tech)};
        return null;
    }

    function currentResearchBlocker(faction, banner) {
        const currentIndex = eraIndexFor(banner);
        const candidates = allTechnologies().filter(tech => !banner.research.unlocked[tech.id] && safeNumber(tech.eraIndex, 0) <= currentIndex)
            .sort((a, b) => Math.abs(currentIndex-safeNumber(a.eraIndex,0))-Math.abs(currentIndex-safeNumber(b.eraIndex,0)) || safeNumber(a.eraIndex,0)-safeNumber(b.eraIndex,0));
        let fallback = null;
        for (let i = 0; i < candidates.length; i++) {
            const blocker = researchBlockerForTech(candidates[i], faction, banner, new Set());
            if (!blocker) continue;
            if (!fallback) fallback = blocker;
            if (rawBreakthroughResource(blocker.resource)) return blocker;
        }
        return fallback;
    }

    function rawBreakthroughResource(resource) {
        if (resource === "stone" || resource === "copper" || resource === "raw_iron") return resource;
        if (resource === "iron" || resource === "steel") return "raw_iron";
        if (resource === "bronze") return "copper";
        return null;
    }

    function updateResearchBlocker(faction, banner, tech) {
        const research = ensureResearchState(banner);
        if (tech) {
            delete research.blockedTechId;
            delete research.blockedReason;
            delete research.blockedResource;
            delete research.blockedSinceTick;
            return;
        }
        const blocker = currentResearchBlocker(faction, banner);
        if (!blocker) return;
        const key = [blocker.type, blocker.resource || blocker.milestone || blocker.id || "", blocker.techId || ""].join(":");
        if (research.blockedReason !== key) research.blockedSinceTick = pixelTicks;
        research.blockedReason = key;
        research.blockedTechId = blocker.techId || null;
        research.blockedResource = blocker.resource || null;
        research.blockedCurrent = safeNumber(blocker.current, 0);
        research.blockedRequired = safeNumber(blocker.required, 0);
        if (!Number.isFinite(research.blockedSinceTick)) research.blockedSinceTick = pixelTicks;
    }

    function unlockTechnology(faction, banner, tech) {
        const research = ensureResearchState(banner);
        if (!tech || research.unlocked[tech.id]) return false;
        research.unlocked[tech.id] = true;
        research.progress[tech.id] = effectiveResearchCost(tech, faction, banner);
        research.lastUnlockedTechId = tech.id;
        research.lastUnlockedTick = pixelTicks;
        research.milestones.technologies = safeNumber(research.milestones.technologies, 0) + 1;
        addDomainExperience(banner, tech.domain, 2);
        if (research.focusTechId === tech.id) delete research.focusTechId;
        research.priorityQueue = research.priorityQueue.filter((techId) => techId !== tech.id);
        faction.techModifiers = computeTechModifiers(faction);
        faction.settlements.forEach((settlement) => {
            settlement.research = research;
            settlement.eraId = banner.eraId;
        });
        reconcileFactionEquipment(faction);
        logSettlementEvent(banner, "technology", "科技完成：" + (tech.name || tech.id), {technologyId: tech.id, forced: !!research.forcedUnlocked[tech.id]});
        return true;
    }

    function requiredEraArmorTarget(eraId) {
        if (eraId === "agriculture" || eraId === "bronze") return "rattan";
        if (eraId === "iron") return "iron";
        if (eraId === "castle") return "steel";
        return "none";
    }

    function eraAdvancementState(faction, banner) {
        const currentIndex = eraIndexFor(banner);
        const era = eraDefinition(banner && banner.eraId);
        const finalEra = currentIndex >= ERA_ORDER.length - 1;
        const eraTechIds = era && era.techIds || (TECHS_BY_ERA.get(banner && banner.eraId) || []).map((tech) => tech.id);
        const required = Math.max(1, safeNumber(era && era.requiredTechsToAdvance, Math.floor(eraTechIds.length * 0.7) + 1));
        const completed = eraTechIds.filter((techId) => banner && banner.research && banner.research.unlocked[techId]).length;
        const soldiers = (faction && faction.adults || []).filter(actorIsSoldier).sort((a, b) => a.humanId - b.humanId);
        const weaponTargets = eraWeaponTargets(banner && banner.eraId || DEFAULT_ERA_ID, soldiers.length);
        const armorTarget = requiredEraArmorTarget(banner && banner.eraId || DEFAULT_ERA_ID);
        let weaponsReady = 0;
        let armorReady = 0;
        soldiers.forEach((actor, index) => {
            migrateActorEquipment(actor);
            if (actor.weapon === (weaponTargets[index] || "fists")) weaponsReady++;
            if (actor.armor === armorTarget) armorReady++;
        });
        const minimumSoldiers = 1;
        const soldierReady = soldiers.length >= minimumSoldiers;
        const equipmentReady = soldierReady && weaponsReady === soldiers.length && armorReady === soldiers.length;
        const cost = copyResourceCost(era && era.advancementCost || {});
        const current = {};
        const missing = {};
        Object.keys(cost).forEach((resource) => {
            current[resource] = materialAmount(banner.stock, resource);
            missing[resource] = Math.max(0, safeNumber(cost[resource], 0) - current[resource]);
        });
        const stockReady = Object.keys(missing).every((resource) => missing[resource] <= 0);
        return {
            eraId: banner && banner.eraId || DEFAULT_ERA_ID,
            nextEraId: finalEra ? null : ERA_ORDER[currentIndex + 1],
            finalEra,
            completed,
            total: eraTechIds.length,
            required,
            technologyReady: completed >= required,
            soldiers: soldiers.length,
            minimumSoldiers,
            soldierReady,
            weaponsReady,
            armorReady,
            weaponTargets: weaponTargets.slice(),
            armorTarget,
            equipmentReady,
            cost,
            current,
            missing,
            stockReady,
            canAdvance: !finalEra && completed >= required && equipmentReady && stockReady
        };
    }

    function advancementReservation(faction, banner) {
        if (!faction || !banner) return {};
        const state = eraAdvancementState(faction, banner);
        return !state.finalEra && state.technologyReady ? state.cost : {};
    }

    function canSpendAfterAdvancementReserve(faction, banner, cost) {
        const reserve = advancementReservation(faction, banner);
        return Object.keys(cost || {}).every((resource) =>
            materialAmount(banner.stock, resource) - safeNumber(reserve[resource], 0) >= safeNumber(cost[resource], 0)
        );
    }

    function maybeAdvanceEra(faction, banner) {
        const currentIndex = eraIndexFor(banner);
        const progress = eraAdvancementState(faction, banner);
        banner.research.eraCompleted = progress.completed;
        banner.research.advancement = progress;
        if (!progress.canAdvance || !spendStock(banner, progress.cost)) return false;
        banner.eraId = ERA_ORDER[currentIndex + 1];
        banner.research.eraEnteredTick = pixelTicks;
        banner.research.lastEraAdvanceTick = pixelTicks;
        banner.research.milestones.eras = safeNumber(banner.research.milestones.eras, 0) + 1;
        faction.eraId = banner.eraId;
        faction.settlements.forEach((settlement) => { settlement.eraId = banner.eraId; settlement.research = banner.research; });
        reconcileFactionEquipment(faction);
        logSettlementEvent(banner, "era", "进入时代：" + (eraDefinition(banner.eraId) && eraDefinition(banner.eraId).name || banner.eraId), {eraId: banner.eraId, cost: progress.cost});
        return true;
    }

    function stepFactionResearch(faction) {
        const banner = faction && (faction.settlements.find((settlement) => settlement.townCenterActive !== false) || faction.settlements[0]);
        if (!banner || !hasTechnologyData()) return;
        ensureStock(banner);
        const research = ensureResearchState(banner);
        scanFactionDiscoveries(faction);
        const scholars = faction.adults.filter((actor) => actor.role === "scholar" && faction.libraries.some((library) => Core.distance(actor.x, actor.y, library.x, library.y) <= 2.5)).length;
        const merchants = faction.adults.filter((actor) => (actor.role === "merchant" || actor.role === "artisan_trade") && faction.markets.some((market) => Core.distance(actor.x, actor.y, market.x, market.y) <= 2.5)).length;
        const baseGain = 0.4 + faction.adultPopulation * C.KNOWLEDGE_PER_ADULT_STEP + scholars * 0.65 + merchants * 0.25;
        const peaceBonus = factionIsAtWar(faction.id) ? 0.85 : 1;
        const gain = baseGain * safeNumber(faction.techModifiers && faction.techModifiers.knowledgeRate, 1) * peaceBonus;
        research.lastKnowledgeGain = gain;
        research.totalKnowledgeGenerated += gain;
        research.knowledge += gain;
        const tech = selectResearch(faction, banner);
        if (tech) {
            const cost = effectiveResearchCost(tech, faction, banner);
            const current = Math.min(cost, safeNumber(research.progress[tech.id], 0));
            const invested = Math.min(research.knowledge, Math.max(0, cost - current));
            research.progress[tech.id] = current + invested;
            research.knowledge -= invested;
            research.activeTechId = tech.id;
            if (research.progress[tech.id] >= cost) unlockTechnology(faction, banner, tech);
        }
        else delete research.activeTechId;
        updateResearchBlocker(faction, banner, tech);
        maybeAdvanceEra(faction, banner);
        research.lastStepTick = pixelTicks;
    }

    function chooseColor(factionId) {
        const base = FACTION_COLORS[(Math.max(1, factionId) - 1) % FACTION_COLORS.length];
        return base;
    }

    function normalizeFactionColor(color) {
        const value = String(color || "").trim().toLowerCase();
        let match = /^#([0-9a-f]{6})$/i.exec(value);
        if (match) return "#" + match[1].toLowerCase();
        match = /^#([0-9a-f]{3})$/i.exec(value);
        if (match) return "#" + match[1].split("").map((part) => part + part).join("").toLowerCase();
        match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
        if (!match) return null;
        return "#" + match.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("");
    }

    function factionWithColor(color) {
        const normalized = normalizeFactionColor(color);
        if (!normalized) return null;
        for (const faction of manager.factionById.values()) {
            if (normalizeFactionColor(faction.color) === normalized) return faction;
        }
        return null;
    }

    function unusedFactionColor(preferred, factionId) {
        const requested = normalizeFactionColor(preferred) || chooseColor(factionId);
        if (!factionWithColor(requested)) return requested;
        for (let i = 0; i < FACTION_COLORS.length; i++) {
            const candidate = normalizeFactionColor(FACTION_COLORS[(Math.max(1, factionId) - 1 + i) % FACTION_COLORS.length]);
            if (!factionWithColor(candidate)) return candidate;
        }
        return null;
    }

    function factionColor(factionId) {
        const faction = manager.factionById.get(factionId);
        return faction && faction.color ? faction.color : chooseColor(factionId);
    }

    function setPixelColor(pixel, color) {
        if (!pixel || !color) return;
        pixel.color = pixelColorPick(pixel, color);
    }

    function deleteExactPixel(pixel) {
        if (!pixel || pixel.del) return;
        if (typeof deletePixelObject === "function") deletePixelObject(pixel, true);
        else deletePixel(pixel.x, pixel.y);
    }

    function pixelsAt(x, y) {
        if (typeof getPixelsAt === "function") return getPixelsAt(x, y);
        const pixel = getPixel(x, y);
        return pixel ? [pixel] : [];
    }

    function pixelByElementAt(x, y, element) {
        if (typeof getPixelByElement === "function") return getPixelByElement(x, y, element);
        return pixelsAt(x, y).find((pixel) => pixel.element === element) || null;
    }

    function isBuildingCorePixel(pixel) {
        return !!(pixel && !pixel.del && (pixel.element === "civ_banner" || pixel.element === "civ_construction" || STRUCTURE_CORES.has(pixel.element)));
    }

    function getBuildingCoreAt(x, y) {
        return pixelsAt(x, y).find(isBuildingCorePixel) || null;
    }

    function getBuildingById(buildingId) {
        return manager.structuresById.get(Number(buildingId)) || null;
    }

    function buildingSpriteScalePercent() {
        const value = typeof settings !== "undefined" ? safeNumber(settings.humanSocietyBuildingScale, 100) : 100;
        return Math.max(50, Math.min(200, value));
    }

    function buildingDisplayRect(building, spriteBounds) {
        const bounds = spriteBounds || {width: 1, height: 1};
        if (typeof World.buildingSpriteRect === "function") {
            return World.buildingSpriteRect(building.x, building.y, bounds.width, bounds.height, buildingSpriteScalePercent());
        }
        const scale = 3 * buildingSpriteScalePercent() / 100;
        return {left: building.x + 0.5 - scale / 2, right: building.x + 0.5 + scale / 2, top: building.y + 1 - scale, bottom: building.y + 1, width: scale, height: scale, coreX: building.x, coreY: building.y};
    }

    function knownBuildingSpriteBounds(building) {
        const descriptor = buildingSpriteDescriptor(building);
        const asset = descriptor && buildingSpriteAssets.get(descriptor.fileName);
        return asset && asset.bounds || null;
    }

    function buildingVisualAt(x, y) {
        let found = null;
        const inspect = (pixel) => {
            if (!isBuildingCorePixel(pixel) || pixel.buildingState === "destroyed") return;
            const rect = buildingDisplayRect(pixel, knownBuildingSpriteBounds(pixel));
            if (x + 1 > rect.left && x < rect.right && y + 1 > rect.top && y < rect.bottom) found = pixel;
        };
        manager.settlements.forEach(inspect);
        manager.constructionSites.forEach(inspect);
        manager.structures.forEach(inspect);
        return found;
    }

    function ensureBuildingMetadata(pixel, type) {
        if (!pixel) return pixel;
        if (!Number.isFinite(pixel.buildingId)) pixel.buildingId = manager.nextBuildingId++;
        manager.nextBuildingId = Math.max(manager.nextBuildingId, pixel.buildingId + 1);
        const requestedType = type || pixel.buildingType || pixel.blueprintType || pixel.element;
        const requestedDescriptor = typeof World.buildingSpriteDescriptor === "function" ? World.buildingSpriteDescriptor(requestedType, DEFAULT_ERA_ID) : null;
        const elementDescriptor = !requestedDescriptor && typeof World.buildingSpriteDescriptor === "function" ? World.buildingSpriteDescriptor(pixel.element, DEFAULT_ERA_ID) : null;
        pixel.buildingType = requestedDescriptor && requestedDescriptor.type || elementDescriptor && elementDescriptor.type || requestedType.replace(/^civ_|_core$/g, "");
        if (!pixel.buildingState) pixel.buildingState = pixel.element === "civ_construction" ? "construction" : "complete";
        pixel.isBuildingCore = true;
        pixel.alwaysOverlay = true;
        pixel.nonBlocking = true;
        pixel.eraseProtected = true;
        if (!pixel.territoryClaimId) pixel.territoryClaimId = "building:" + pixel.buildingId;
        if (!Number.isFinite(pixel.territoryClaimTick)) pixel.territoryClaimTick = Number.isFinite(pixel.start) ? pixel.start : pixelTicks;
        if (!Number.isFinite(pixel.territoryClaimOrder)) pixel.territoryClaimOrder = manager.nextTerritoryClaimOrder++;
        manager.nextTerritoryClaimOrder = Math.max(manager.nextTerritoryClaimOrder, pixel.territoryClaimOrder + 1);
        manager.structuresById.set(pixel.buildingId, pixel);
        return pixel;
    }

    function buildingSupportPixel(pixel) {
        if (!pixel || pixel.del) return false;
        if (pixel.element === "civ_tunnel" || isBuildingCorePixel(pixel)) return true;
        if (getActorFromPixel(pixel)) return false;
        if (typeof isCreaturePixel === "function" && isCreaturePixel(pixel)) return false;
        if (typeof isPassableVegetationPixel === "function" && isPassableVegetationPixel(pixel)) return false;
        const info = elements[pixel.element] || {};
        const descriptor = resourceDescriptor(pixel);
        if (pixel._civResourceDrop === true || descriptor && (descriptor.resourceDrop || descriptor.kind === "wood" || descriptor.kind === "food")) return false;
        if (info.state === "liquid" || info.state === "gas" || info.isGas === true) return false;
        if (typeof isNonBlockingPixel === "function" && isNonBlockingPixel(pixel)) return false;
        return info.state === "solid";
    }

    function buildingCellHasSupport(building, x, y) {
        if (outOfBounds(x, y)) return true;
        return pixelsAt(x, y).some((pixel) => pixel !== building && buildingSupportPixel(pixel));
    }

    function syncBuildingPosition(building, oldX, oldY) {
        const dx = building.x - oldX;
        const dy = building.y - oldY;
        if (!dx && !dy) return;
        if (Number.isFinite(building.originX)) building.originX += dx;
        if (Number.isFinite(building.originY)) building.originY += dy;
        if (Array.isArray(building.plots)) {
            building.plots.forEach((plot) => {
                if (!plot) return;
                if (Number.isFinite(plot.x)) plot.x += dx;
                if (Number.isFinite(plot.y)) plot.y += dy;
            });
        }
        if (dx && building.territoryClaimId) reserveBuildingTerritory(building);
        manager.derivedIndexesDirty = true;
    }

    function moveBuildingCore(building, x, y, forceExit) {
        if (!building || building.del || outOfBounds(x, y) || getBuildingCoreAt(x, y)) return false;
        if (pixelsAt(x, y).some((pixel) => pixel.element === "civ_tunnel")) return false;
        const oldX = building.x;
        const oldY = building.y;
        let moved = movePixel(building, x, y);
        if (!moved && forceExit && typeof detachPixelFromGrid === "function" && typeof attachPixelToGrid === "function") {
            detachPixelFromGrid(building, true);
            moved = attachPixelToGrid(building, x, y, true);
            if (!moved) attachPixelToGrid(building, oldX, oldY, true, true);
        }
        if (moved) syncBuildingPosition(building, oldX, oldY);
        return moved;
    }

    function settleBuildingCore(building) {
        if (!isBuildingCorePixel(building) || building.buildingState === "destroyed") return false;
        const targetY = building.y + 1;
        if (buildingCellHasSupport(building, building.x, targetY)) return false;
        return moveBuildingCore(building, building.x, targetY, false);
    }

    function applyBuildingGravity() {
        const seen = new Set();
        const settle = (building) => {
            if (seen.has(building)) return;
            seen.add(building);
            settleBuildingCore(building);
        };
        manager.settlements.forEach(settle);
        manager.constructionSites.forEach(settle);
        manager.structures.forEach(settle);
    }

    function relocateBuildingAboveTunnel(core) {
        if (!isBuildingCorePixel(core) || !pixelsAt(core.x, core.y).some((pixel) => pixel !== core && pixel.element === "civ_tunnel")) return false;
        for (let y = core.y - 1; y >= 0; y--) {
            const occupants = pixelsAt(core.x, y);
            if (occupants.some((pixel) => pixel !== core && (pixel.element === "civ_tunnel" || buildingSupportPixel(pixel)))) continue;
            if (!buildingCellHasSupport(core, core.x, y + 1)) continue;
            return moveBuildingCore(core, core.x, y, true);
        }
        return false;
    }

    function rebuildTerritoryIndex() {
        const territory = ensureTerritoryIndex();
        if (!territory) return;
        const buildings = [];
        manager.settlements.forEach((pixel) => { if (isBuildingCorePixel(pixel) && pixel.buildingState !== "destroyed" && pixel.townCenterActive !== false) buildings.push(pixel); });
        manager.constructionSites.forEach((pixel) => { if (isBuildingCorePixel(pixel)) buildings.push(pixel); });
        manager.structures.forEach((pixel) => { if (isBuildingCorePixel(pixel)) buildings.push(pixel); });
        const unique = Array.from(new Set(buildings)).filter((pixel) => Number.isFinite(pixel.factionId));
        unique.forEach((pixel) => ensureBuildingMetadata(pixel));
        territory.rebuild(unique.map((pixel) => ({
            claimId: pixel.territoryClaimId,
            buildingId: pixel.buildingId,
            factionId: pixel.factionId,
            settlementId: pixel.settlementId,
            anchorX: pixel.x,
            claimTick: pixel.territoryClaimTick,
            claimOrder: pixel.territoryClaimOrder
        })));
        unique.forEach((pixel) => {
            const claim = territory.claims.get(pixel.territoryClaimId);
            if (claim) { pixel.claimMinX = claim.minX; pixel.claimMaxX = claim.maxX; }
        });
    }

    function reserveBuildingTerritory(pixel) {
        const territory = ensureTerritoryIndex();
        if (!territory || !pixel) return null;
        ensureBuildingMetadata(pixel);
        const claim = territory.reserve({claimId: pixel.territoryClaimId, buildingId: pixel.buildingId, factionId: pixel.factionId, settlementId: pixel.settlementId, anchorX: pixel.x, claimTick: pixel.territoryClaimTick, claimOrder: pixel.territoryClaimOrder});
        pixel.claimMinX = claim.minX;
        pixel.claimMaxX = claim.maxX;
        return claim;
    }

    function releaseBuildingClaim(pixel) {
        if (pixel && pixel.territoryClaimId && manager.territory) manager.territory.release(pixel.territoryClaimId);
    }

    function bucketKey(x, y) {
        return Math.floor(x / C.BUCKET_SIZE) + "," + Math.floor(y / C.BUCKET_SIZE);
    }

    function removeActorFromBucket(pixel) {
        const previousKey = manager.actorBucketByPixel.get(pixel);
        if (!previousKey) return false;
        const bucket = manager.buckets.get(previousKey);
        if (bucket) {
            const index = bucket.indexOf(pixel);
            if (index !== -1) bucket.splice(index, 1);
            if (bucket.length === 0) manager.buckets.delete(previousKey);
        }
        manager.actorBucketByPixel.delete(pixel);
        return true;
    }

    function updateActorBucket(pixel) {
        if (!pixel || pixel.del || (pixel.element !== "civ_body" && pixel.element !== "civ_child")) return false;
        const nextKey = bucketKey(pixel.x, pixel.y);
        const previousKey = manager.actorBucketByPixel.get(pixel);
        if (previousKey === nextKey) return false;
        removeActorFromBucket(pixel);
        if (!manager.buckets.has(nextKey)) manager.buckets.set(nextKey, []);
        manager.buckets.get(nextKey).push(pixel);
        manager.actorBucketByPixel.set(pixel, nextKey);
        return true;
    }

    function getBodyHead(body) {
        if (!body || body.del) return null;
        const above = pixelByElementAt(body.x, body.y - 1, "civ_head");
        if (above && above.element === "civ_head" && above.humanId === body.humanId) return above;
        if (body._r !== undefined) {
            const relation = getRelation(body._r);
            if (relation && relation.p) {
                for (let i = 0; i < relation.p.length; i++) {
                    const part = relation.p[i];
                    if (!part.del && part.element === "civ_head" && part.humanId === body.humanId) return part;
                }
            }
        }
        return null;
    }

    function getHeadBody(head) {
        if (!head || head.del) return null;
        const below = pixelByElementAt(head.x, head.y + 1, "civ_body");
        if (below && below.element === "civ_body" && below.humanId === head.humanId) return below;
        if (head._r !== undefined) {
            const relation = getRelation(head._r);
            if (relation && relation.p) {
                for (let i = 0; i < relation.p.length; i++) {
                    const part = relation.p[i];
                    if (!part.del && part.element === "civ_body" && part.humanId === head.humanId) return part;
                }
            }
        }
        return null;
    }

    function getActorFromPixel(pixel) {
        if (!pixel || pixel.del) return null;
        if (pixel.element === "civ_body" || pixel.element === "civ_child") return pixel;
        if (pixel.element === "civ_head") return getHeadBody(pixel);
        return null;
    }

    function migrateLegacyAmountMap(map) {
        if (!map || typeof map !== "object") return map;
        const tin = Math.max(0, safeNumber(map.tin, 0));
        const charcoal = Math.max(0, safeNumber(map.charcoal, 0));
        if (tin) map.copper = Math.max(0, safeNumber(map.copper, 0)) + tin;
        if (charcoal) map.wood = Math.max(0, safeNumber(map.wood, 0)) + charcoal * 3;
        Object.keys(map).forEach((key) => {
            if (key.indexOf("seed:") !== 0) return;
            map.food = Math.max(0, safeNumber(map.food, 0)) + Math.max(0, safeNumber(map[key], 0));
            delete map[key];
        });
        delete map.tin;
        delete map.charcoal;
        return map;
    }

    function migratedResourceKind(kind) {
        if (kind === "tin") return "copper";
        if (kind === "charcoal") return "wood";
        if (String(kind || "").indexOf("seed:") === 0) return "food";
        return kind;
    }

    function migrateLegacyResourcePixel(pixel) {
        if (!pixel || pixel.del || safeNumber(pixel.resourceSchemaVersion, 0) >= RESOURCE_SCHEMA_VERSION) return pixel;
        pixel.resourceSchemaVersion = RESOURCE_SCHEMA_VERSION;
        if (pixel.carry && typeof pixel.carry === "object") migrateLegacyAmountMap(pixel.carry);
        if (pixel.costs && typeof pixel.costs === "object") migrateLegacyAmountMap(pixel.costs);
        if (pixel.carryKind) pixel.carryKind = migratedResourceKind(pixel.carryKind);
        if (pixel.workTrip && pixel.workTrip.resourceKind) pixel.workTrip.resourceKind = migratedResourceKind(pixel.workTrip.resourceKind);
        if (pixel.resumeAfterDelivery && pixel.resumeAfterDelivery.resourceKind) pixel.resumeAfterDelivery.resourceKind = migratedResourceKind(pixel.resumeAfterDelivery.resourceKind);
        if (pixel.resourceKind) {
            if (pixel.resourceKind === "charcoal") pixel.resourceAmount = Math.max(1, safeNumber(pixel.resourceAmount, 1)) * 3;
            pixel.resourceKind = migratedResourceKind(pixel.resourceKind);
        }
        if (pixel.resourceMaterial) pixel.resourceMaterial = migratedResourceKind(pixel.resourceMaterial);
        if (pixel.element === "civ_tin_resource" && elements.civ_copper_resource) changePixel(pixel, "civ_copper_resource");
        else if (pixel.element === "civ_charcoal_resource" && elements.civ_wood_resource) {
            changePixel(pixel, "civ_wood_resource");
        }
        else if (pixel.element === "civ_seed_resource" && elements.civ_food_resource) changePixel(pixel, "civ_food_resource");
        return pixel;
    }

    function copyResourceCost(cost) {
        const copied = {};
        Object.keys(cost || {}).forEach((key) => {
            const amount = Math.max(0, Math.floor(safeNumber(Number(cost[key]), 0)));
            if (amount) copied[key] = amount;
        });
        return copied;
    }

    function canonicalWeaponId(weaponId) {
        const id = String(weaponId || "fists");
        if (id === "fist") return "fists";
        return LEGACY_WEAPON_IDS[id] || id;
    }

    function weaponDescriptor(weaponId) {
        const id = canonicalWeaponId(weaponId);
        return manager.weapons.get(id) || Core.WEAPONS && (Core.WEAPONS[id] || Core.WEAPONS.fists) || null;
    }

    function canonicalArmorId(armorId) {
        const id = String(armorId || "none");
        return id === "unarmored" ? "none" : id;
    }

    function armorDescriptor(armorId) {
        const id = canonicalArmorId(armorId);
        return manager.armors.get(id) || Core.ARMORS && (Core.ARMORS[id] || Core.ARMORS.none) || {
            id: "none", bonusHp: 0, cost: {}
        };
    }

    function syncActorHealth(actor, equipmentChange) {
        if (!actor) return actor;
        const child = actor.element === "civ_child";
        const baseFallback = child ? C.CHILD_HP : C.ADULT_HP;
        actor.baseMaxHp = Math.max(1, safeNumber(actor.baseMaxHp, safeNumber(actor.maxHp, baseFallback)));
        const armor = child ? armorDescriptor("none") : armorDescriptor(actor.armor);
        actor.armor = child ? "none" : canonicalArmorId(armor.id);
        actor.armorBonusHp = Math.max(0, safeNumber(armor.bonusHp, 0));
        if (!Number.isFinite(actor.healthDamage)) {
            actor.healthDamage = Math.max(0, safeNumber(actor.maxHp, actor.baseMaxHp) - safeNumber(actor.hp, actor.baseMaxHp));
        }
        actor.healthDamage = Math.max(0, safeNumber(actor.healthDamage, 0));
        actor.maxHp = actor.baseMaxHp + actor.armorBonusHp;
        if (equipmentChange && actor.healthDamage >= actor.maxHp) actor.equipmentSurvivalFloor = true;
        else if (actor.healthDamage < actor.maxHp) delete actor.equipmentSurvivalFloor;
        if (actor.dead) actor.hp = 0;
        else actor.hp = Math.max(actor.equipmentSurvivalFloor ? 1 : 0, actor.maxHp - actor.healthDamage);
        return actor;
    }

    function healActor(actor, amount) {
        if (!actor || actor.del || actor.dead) return false;
        const healing = Math.max(0, safeNumber(amount, 0));
        if (!healing || safeNumber(actor.healthDamage, 0) <= 0) return false;
        actor.healthDamage = Math.max(0, safeNumber(actor.healthDamage, 0) - healing);
        syncActorHealth(actor, false);
        return true;
    }

    function migrateActorEquipment(actor) {
        if (!actor || actor.del) return actor;
        if (actor.element !== "civ_child" && (actor.militaryVeteran === true || actor.role === "guard" || actor.role === "warrior" || actor.warRole === "attacker" || actor.warRole === "defender" || canonicalWeaponId(actor.weapon) !== "fists" || canonicalArmorId(actor.armor) !== "none")) actor.militaryVeteran = true;
        const previousSchema = safeNumber(actor.equipmentSchemaVersion, 0);
        const currentWeaponId = canonicalWeaponId(actor.weapon);
        const currentArmorId = actor.element === "civ_child" ? "none" : canonicalArmorId(actor.armor);
        if (previousSchema >= EQUIPMENT_SCHEMA_VERSION && actor.weapon === currentWeaponId && actor.armor === currentArmorId && Number.isFinite(actor.baseMaxHp) && Number.isFinite(actor.healthDamage)) return actor;
        const oldWeaponId = String(actor.weapon || "fists");
        const weaponId = currentWeaponId;
        actor.weapon = weaponId;
        if (weaponId === "fists" || actor.element === "civ_child") {
            actor.weapon = "fists";
            delete actor.weaponPaidCost;
        }
        else if (!actor.weaponPaidCost || typeof actor.weaponPaidCost !== "object") {
            const legacyCost = LEGACY_WEAPON_COSTS[oldWeaponId];
            const descriptor = weaponDescriptor(weaponId);
            actor.weaponPaidCost = copyResourceCost(legacyCost || descriptor && descriptor.cost || {});
        }
        else actor.weaponPaidCost = copyResourceCost(actor.weaponPaidCost);
        if (previousSchema < 3) {
            actor.armor = "none";
            delete actor.armorPaidCost;
            actor.baseMaxHp = Math.max(1, safeNumber(actor.maxHp, actor.element === "civ_child" ? C.CHILD_HP : C.ADULT_HP));
            actor.healthDamage = Math.max(0, actor.baseMaxHp - safeNumber(actor.hp, actor.baseMaxHp));
        }
        else {
            actor.armor = canonicalArmorId(actor.armor);
            if (actor.armor === "none" || actor.element === "civ_child") delete actor.armorPaidCost;
            else actor.armorPaidCost = copyResourceCost(actor.armorPaidCost || armorDescriptor(actor.armor).cost || {});
        }
        syncActorHealth(actor, previousSchema < EQUIPMENT_SCHEMA_VERSION);
        actor.equipmentSchemaVersion = EQUIPMENT_SCHEMA_VERSION;
        return actor;
    }

    function registerPixel(pixel) {
        if (!pixel || pixel.del) return;
        migrateLegacyResourcePixel(pixel);
        if (ACTOR_ELEMENTS.has(pixel.element)) migrateActorEquipment(pixel);
        let changed = false;
        if (pixel.element === "civ_body") {
            changed = !manager.actors.has(pixel);
            manager.actors.add(pixel);
            updateActorBucket(pixel);
        }
        else if (pixel.element === "civ_head") {
            changed = !manager.heads.has(pixel);
            manager.heads.add(pixel);
        }
        else if (pixel.element === "civ_child") {
            changed = !manager.actors.has(pixel) || !manager.children.has(pixel);
            manager.actors.add(pixel);
            manager.children.add(pixel);
            updateActorBucket(pixel);
        }
        else if (pixel.element === "civ_banner") { changed = !manager.settlements.has(pixel); manager.settlements.add(pixel); }
        else if (pixel.element === "civ_construction") { changed = !manager.constructionSites.has(pixel); manager.constructionSites.add(pixel); }
        else if (STRUCTURE_CORES.has(pixel.element) || STRUCTURE_PARTS.has(pixel.element)) { changed = !manager.structures.has(pixel); manager.structures.add(pixel); }
        if ((pixel.element === "civ_banner" || pixel.element === "civ_construction" || STRUCTURE_CORES.has(pixel.element)) && Number.isFinite(pixel.buildingId)) {
            manager.structuresById.set(pixel.buildingId, pixel);
        }
        if (changed) manager.derivedIndexesDirty = true;
    }

    function unregisterPixel(pixel) {
        let changed = false;
        changed = manager.actors.delete(pixel) || changed;
        changed = manager.heads.delete(pixel) || changed;
        changed = manager.children.delete(pixel) || changed;
        changed = manager.settlements.delete(pixel) || changed;
        changed = manager.constructionSites.delete(pixel) || changed;
        changed = manager.structures.delete(pixel) || changed;
        removeActorFromBucket(pixel);
        if (pixel && Number.isFinite(pixel.buildingId) && manager.structuresById.get(pixel.buildingId) === pixel) manager.structuresById.delete(pixel.buildingId);
        if (pixel && pixel.humanId !== undefined && manager.actorById.get(pixel.humanId) === pixel) {
            manager.actorById.delete(pixel.humanId);
            manager.minerAssignments.delete(pixel.humanId);
        }
        if (changed) manager.derivedIndexesDirty = true;
    }

    function cleanupCivilizedFields(pixel) {
        if (!pixel) return;
        const fields = [
            "humanId", "factionId", "settlementId", "role", "task", "targetX", "targetY", "targetId", "targetKey",
            "targetKind", "hp", "maxHp", "baseMaxHp", "healthDamage", "equipmentSurvivalFloor", "hunger", "weapon", "weaponPaidCost", "armor", "armorPaidCost", "armorBonusHp", "equipmentSchemaVersion", "carryKind", "carryElement", "carryAmount",
            "attackReadyTick", "lastThinkTick", "lastPlanTick", "lastHungerTick", "lastDamageTick", "resourceScanPhase", "harvestProgress", "stuckCount", "noProgressCount", "bestTaskDistance", "progressTargetX", "progressTargetY", "lastX", "lastY", "underAttackUntil",
            "birthTick", "ageTicks", "lifespanYears", "naturalDeathTick", "deathCause", "factionColor", "buildingId", "structureHp", "structureMaxHp", "harvestX", "harvestY", "blockedResourceKey", "blockedResourceUntil", "blockedResourceCategory", "blockedResourceCategoryUntil",
            "stock", "diplomacy", "housing", "birthReadyTick", "lastBirthTick", "lastHostileTick",
            "lastWarTick", "territoryRadius", "stage", "eraId", "research", "cultureMemory", "blueprintType", "originX", "originY", "nextPart",
            "blockedTicks", "lastBuildTick", "lastProcessTick", "costs", "placedParts", "completed", "plots", "lastCraftTick", "carrySeed", "buildRetry", "orphanedSince", "dead", "panic", "dir", "treeHarvestCounter", "ammo", "rangedTargetTick"
            , "carry", "carryCapacity", "territoryClaimId", "territoryClaimTick", "territoryClaimOrder", "claimMinX", "claimMaxX", "buildingType", "buildingState", "destroyedTick", "destroyedCause", "isBuildingCore", "alwaysOverlay", "nonBlocking", "eraseProtected", "workDone", "workRequired", "lifeSchemaVersion", "combatTargetId", "strikeDueTick", "strikeTargetId", "structureStrikeDueTick", "structureStrikeKey", "warRole", "warFrontId", "pathStage", "pathCache", "workTrip", "climbHoldUntil", "patrolX", "patrolY", "searchX", "searchY", "resumeAfterDelivery"
            , "personActivity", "personArchived", "personArchiveSettlementId", "personTransitioning", "deceasedPeople", "deathCount", "humanIdHighWatermark", "treeGrowthReadyTick", "militaryVeteran", "yieldFractions"
        ];
        for (let i = 0; i < fields.length; i++) delete pixel[fields[i]];
    }

    function actorBeforeRemoval(pixel) {
        if (!pixel) return null;
        if (pixel.element === "civ_body" || pixel.element === "civ_child") return pixel;
        if (pixel.element !== "civ_head" || pixel._r === undefined) return null;
        const relation = getRelation(pixel._r);
        return relation && relation.p && relation.p.find((part) => part && part.element === "civ_body" && !part.del) || null;
    }

    function archiveActorRemoval(pixel, nextElement) {
        const actor = actorBeforeRemoval(pixel);
        if (!actor || actor.personTransitioning || actor.dead || !Number.isFinite(actor.humanId)) return;
        actor.deathCause = nextElement ? "environment" : "erased";
        markActorDead(actor, pixelTicks, {removedAs: nextElement || null});
    }

    function onCivilizedChange(pixel, nextElement) {
        archiveActorRemoval(pixel, nextElement);
        if (isBuildingCorePixel(pixel)) releaseBuildingClaim(pixel);
        unregisterPixel(pixel);
        if (pixel && pixel._r !== undefined && typeof removeFromRelation === "function") removeFromRelation(pixel);
        cleanupCivilizedFields(pixel);
    }

    function onCivilizedDelete(pixel) {
        archiveActorRemoval(pixel, null);
        if (isBuildingCorePixel(pixel)) releaseBuildingClaim(pixel);
        unregisterPixel(pixel);
        if (pixel && pixel._r !== undefined && typeof removeFromRelation === "function") removeFromRelation(pixel);
    }

    function createRelation(parts) {
        const existingIds = Object.keys(currentRelations || {}).map(Number).filter(Number.isFinite);
        const nextAvailable = existingIds.length ? Math.max.apply(null, existingIds) + 1 : 1;
        if (!Number.isFinite(currentRelations._id) || currentRelations._id < nextAvailable) currentRelations._id = nextAvailable;
        const id = currentRelations._id++;
        for (let i = 0; i < parts.length; i++) addToRelation(parts[i], id);
        return id;
    }

    function ensureFactionRecord(factionId, color) {
        let faction = manager.factionById.get(factionId);
        if (!faction) {
            faction = {
                id: factionId,
                color: normalizeFactionColor(color) || chooseColor(factionId),
                actors: [],
                adults: [],
                children: [],
                settlements: [],
                huts: [],
                farms: [],
                workshops: [],
                lumberyards: [],
                hearths: [],
                quarries: [],
                granaries: [],
                kilns: [],
                foundries: [],
                forges: [],
                keeps: [],
                siegeWorkshops: [],
                libraries: [],
                markets: [],
                towers: [],
                defenses: [],
                constructionSites: [],
                population: 0,
                adultPopulation: 0,
                housing: 0,
                militaryPower: 0,
                techModifiers: {},
                eraId: DEFAULT_ERA_ID
            };
            manager.factionById.set(factionId, faction);
        }
        else if (color && !faction.color) faction.color = color;
        return faction;
    }

    function nearestFactionCandidate(x, y, radius) {
        const candidates = [];
        manager.settlements.forEach((banner) => {
            if (!banner.del && banner.factionId !== undefined) candidates.push(banner);
        });
        manager.actors.forEach((actor) => {
            if (!actor.del && actor.factionId !== undefined && !actor.dead) candidates.push(actor);
        });
        return Core.chooseFaction(candidates, x, y, radius);
    }

    function allocateFaction(x, y, forcedFactionId, forcedColor) {
        let factionId = forcedFactionId;
        const normalizedColor = normalizeFactionColor(forcedColor);
        const selectableColor = FACTION_COLORS.map(normalizeFactionColor).indexOf(normalizedColor) !== -1 ? normalizedColor : null;
        const forced = factionId !== undefined && factionId !== null;
        if (factionId === undefined || factionId === null) {
            const coloredFaction = normalizedColor && factionWithColor(normalizedColor);
            factionId = coloredFaction ? coloredFaction.id : (normalizedColor ? null : nearestFactionCandidate(x, y, C.FACTION_JOIN_RADIUS));
        }
        if (factionId === undefined || factionId === null) {
            if (!forced && manager.factionById.size >= FACTION_COLORS.length) return null;
            factionId = manager.nextFactionId++;
        }
        manager.nextFactionId = Math.max(manager.nextFactionId, factionId + 1);
        const faction = ensureFactionRecord(factionId, forced ? (normalizedColor || chooseColor(factionId)) : (unusedFactionColor(selectableColor, factionId) || chooseColor(factionId)));
        return faction;
    }

    function selectedPlacementFactionColor(pixel) {
        if (typeof currentElement === "string" && currentElement === "civilized_human" && typeof currentColorMap !== "undefined" && currentColorMap && currentColorMap.civilized_human) {
            return normalizeFactionColor(currentColorMap.civilized_human);
        }
        return null;
    }

    function initializeAdult(body, head, options) {
        const opts = options || {};
        const faction = allocateFaction(body.x, body.y, opts.factionId, opts.factionColor);
        if (!faction) {
            deleteExactPixel(head);
            deleteExactPixel(body);
            if (typeof logMessage === "function") logMessage("最多只能创建十个阵营；请选择已有阵营颜色。", true);
            return null;
        }
        const humanId = opts.humanId || manager.nextHumanId++;
        manager.nextHumanId = Math.max(manager.nextHumanId, humanId + 1);
        const common = {
            humanId: humanId,
            factionId: faction.id,
            settlementId: opts.settlementId || null,
            factionColor: faction.color
        };
        Object.assign(body, common, {
            dead: false,
            dir: opts.dir || (Math.random() < 0.5 ? -1 : 1),
            panic: 0,
            hp: opts.hp === undefined ? safeNumber(opts.maxHp, C.ADULT_HP) : opts.hp,
            maxHp: safeNumber(opts.maxHp, C.ADULT_HP),
            baseMaxHp: safeNumber(opts.baseMaxHp, safeNumber(opts.maxHp, C.ADULT_HP)),
            healthDamage: opts.healthDamage,
            role: opts.role || "worker",
            militaryVeteran: opts.militaryVeteran === true || opts.role === "guard" || opts.role === "warrior",
            task: "planning",
            weapon: canonicalWeaponId(opts.weapon || "fists"),
            weaponPaidCost: opts.weaponPaidCost ? copyResourceCost(opts.weaponPaidCost) : undefined,
            armor: canonicalArmorId(opts.armor || "none"),
            armorPaidCost: opts.armorPaidCost ? copyResourceCost(opts.armorPaidCost) : undefined,
            equipmentSchemaVersion: EQUIPMENT_SCHEMA_VERSION,
            carryKind: null,
            carryElement: null,
            carryAmount: 0,
            carry: {},
            carryCapacity: C.BASE_CARRY_CAPACITY,
            attackReadyTick: 0,
            lastThinkTick: -1,
            stuckCount: 0,
            lastX: body.x,
            lastY: body.y,
            underAttackUntil: 0
        });
        if (body.weapon === "fists") delete body.weaponPaidCost;
        if (body.armor === "none") delete body.armorPaidCost;
        syncActorHealth(body, true);
        if (Number.isFinite(opts.birthTick)) body.birthTick = opts.birthTick;
        if (Number.isFinite(opts.lifespanYears)) body.lifespanYears = opts.lifespanYears;
        if (Number.isFinite(opts.naturalDeathTick)) body.naturalDeathTick = opts.naturalDeathTick;
        ensureLifeHistory(body, false);
        if (opts.personActivity) body.personActivity = cloneActivityValue(opts.personActivity);
        ensurePersonActivity(body, false);
        if (!opts.personActivity && !opts.activityTransition) recordPersonLifeEvent(body, opts.creationEvent === "birth" ? "birth" : "placed", {ageYears: ageYears(body), settlementId: body.settlementId});
        beginPersonActivity(body, "planning", null);
        Object.assign(head, common, {dead: false});
        delete head.personActivity;
        setPixelColor(body, faction.color);
        if (opts.skinColor) setPixelColor(head, opts.skinColor);
        else setPixelColor(head, SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)]);
        createRelation([head, body]);
        registerPixel(body);
        registerPixel(head);
        return body;
    }

    function materializeAdult(pixel, options) {
        if (!pixel || pixel.del) return null;
        if (manager.lastFullRebuild < 0 && typeof currentPixels !== "undefined") rebuildIndexes(true);
        const x = pixel.x;
        const y = pixel.y;
        const canOccupy = (targetX, targetY) => typeof canCreatureOccupy === "function" ? canCreatureOccupy(pixel, targetX, targetY, pixel._r) : isEmpty(targetX, targetY);
        if (canOccupy(x, y + 1)) {
            createPixel("civ_body", x, y + 1);
            const body = pixelByElementAt(x, y + 1, "civ_body");
            if (!body) return null;
            changePixel(pixel, "civ_head");
            return initializeAdult(body, pixel, options);
        }
        if (canOccupy(x, y - 1)) {
            createPixel("civ_head", x, y - 1);
            const head = pixelByElementAt(x, y - 1, "civ_head");
            if (!head) return null;
            changePixel(pixel, "civ_body");
            return initializeAdult(pixel, head, options);
        }
        deleteExactPixel(pixel);
        return null;
    }

    function clearTask(actor, outcome, reason, resultPatch) {
        if (!actor) return;
        if (manager.resourceReservations && actor && actor.reservedResourceKey) manager.resourceReservations.release(actor.reservedResourceKey, actor.humanId);
        if (actor) delete actor.reservedResourceKey;
        finishPersonActivity(actor, outcome || "interrupted", reason || "replanned", resultPatch);
        actor.task = "planning";
        actor.targetX = undefined;
        actor.targetY = undefined;
        actor.targetId = undefined;
        actor.targetKind = undefined;
        actor.targetKey = undefined;
        actor.harvestX = undefined;
        actor.harvestY = undefined;
        actor.harvestProgress = 0;
        actor.harvestFarm = false;
        actor.stuckCount = 0;
        actor.noProgressCount = 0;
        actor.bestTaskDistance = undefined;
        actor.progressTargetX = undefined;
        actor.progressTargetY = undefined;
        actor.patrolX = undefined;
        actor.patrolY = undefined;
        actor.searchX = undefined;
        actor.searchY = undefined;
        delete actor.pathStage;
        delete actor.climbHoldUntil;
        invalidateNavigation(actor);
        if (!actor.preserveWorkTrip) delete actor.workTrip;
        delete actor.preserveWorkTrip;
        if (!actor.dead) beginPersonActivity(actor, "planning", null);
    }

    function taskTargetKey(target) {
        if (!target) return null;
        if (Number.isFinite(target.humanId)) return "human:" + target.humanId;
        if (Number.isFinite(target.buildingId)) return "building:" + target.buildingId;
        if (Number.isFinite(target.settlementId)) return "settlement:" + target.settlementId;
        if (target.element && Number.isFinite(target.x) && Number.isFinite(target.y)) return target.element + "@" + target.x + "," + target.y;
        if (target.kind && Number.isFinite(target.x) && Number.isFinite(target.y)) return target.kind + "@" + target.x + "," + target.y;
        return null;
    }

    const TASK_SPEECH = {
        planning: ["Let me think.", "让我想想。"], move: ["On my way.", "我这就过去。"], harvest: ["I'll gather that.", "我去采集。"],
        deliver: ["Bringing supplies back.", "把资源送回去。"], build: ["Time to build.", "开始建造。"], farm: ["The fields need me.", "该照料农田了。"],
        plant_tree: ["A new tree will grow here.", "这里会长出新树。"], wait_tree_growth: ["The young trees need time.", "幼树还需要时间成长。"], facility: ["Back to work.", "继续干活。"], combat: ["To battle!", "准备战斗！"],
        siege: ["Bring that structure down!", "摧毁那座建筑！"], patrol: ["I'll keep watch.", "我去巡逻。"], return: ["Heading home.", "回家了。"],
        search_resource: ["There must be resources nearby.", "附近一定还有资源。"], explore: ["I'll look farther out.", "我去远处看看。"],
        flee: ["Fall back!", "快撤退！"], tunnel: ["This wall is too high. Dig through!", "墙太高了，挖过去！"],
        extinguish: ["Fire! I'll put it out!", "着火了，我去灭火！"]
    };
    const IDLE_CHAT = [
        ["How is the work going?", "活干得怎么样？"], ["The town is growing.", "聚落越来越大了。"],
        ["Stay safe out there.", "出门注意安全。"], ["We should check the supplies.", "该看看库存了。"]
    ];
    const LEGACY_SPEECH_ZH = Object.create(null);
    Object.keys(TASK_SPEECH).forEach((task) => { LEGACY_SPEECH_ZH[TASK_SPEECH[task][0]] = TASK_SPEECH[task][1]; });
    IDLE_CHAT.forEach((entry) => { LEGACY_SPEECH_ZH[entry[0]] = entry[1]; });
    LEGACY_SPEECH_ZH["Yes, I agree."] = "嗯，说得对。";

    function speechText(entry) {
        return entry ? entry[isChineseUi() ? 1 : 0] : "";
    }

    function localizedSpeechText(text) {
        const value = String(text || "").trim();
        if (!value || !isChineseUi() || /[\u3400-\u9fff]/.test(value)) return value;
        return LEGACY_SPEECH_ZH[value] || "……";
    }

    function speakPerson(actor, text, priority, duration) {
        if (!actor || actor.dead || actor.del || !text || typeof settings !== "undefined" && settings.humanSocietySpeech === false) return false;
        const value = String(text).slice(0, 64);
        if (actor.speech && actor.speech.text === value && pixelTicks-safeNumber(actor.speech.startedTick,0) < 60) return false;
        if (actor.speech && actor.speech.untilTick > pixelTicks && safeNumber(actor.speech.priority,0) > safeNumber(priority,0)) return false;
        actor.speech = {text:value,startedTick:pixelTicks,untilTick:pixelTicks+Math.max(30,safeNumber(duration,90)),priority:safeNumber(priority,1)};
        actor.lastSpeechText = value;
        actor.lastSpeechTick = pixelTicks;
        return true;
    }

    function speakForTask(actor, task, priority) {
        const phrase = TASK_SPEECH[task];
        if (!phrase) return false;
        actor.lastSpeechTaskTick = pixelTicks;
        return speakPerson(actor,speechText(phrase),priority === undefined ? (task === "combat" || task === "siege" ? 4 : 2) : priority,90);
    }

    function updatePersonSpeech(actor) {
        if (!actor || actor.dead) return;
        if (typeof settings !== "undefined" && settings.humanSocietySpeech === false) {
            delete actor.speech;
            return;
        }
        if (actor.speech && actor.speech.untilTick <= pixelTicks) delete actor.speech;
        if (actor.task && actor.task !== "planning" && pixelTicks-safeNumber(actor.lastSpeechTaskTick,pixelTicks) >= 240) speakForTask(actor,actor.pathStage === "tunnel" ? "tunnel" : actor.task,1);
        if (actor.task !== "planning" && actor.task !== "idle" && actor.task !== "wander") return;
        if (!Number.isFinite(actor.nextChatTick)) actor.nextChatTick = pixelTicks+300+Math.floor(Math.random()*301);
        if (pixelTicks < actor.nextChatTick) return;
        actor.nextChatTick = pixelTicks+300+Math.floor(Math.random()*301);
        const neighbor = nearbyActors(actor.x,actor.y,6,other => other.humanId !== actor.humanId && other.factionId === actor.factionId)[0];
        const phrase = IDLE_CHAT[Math.floor(Math.random()*IDLE_CHAT.length)];
        if (speakPerson(actor,speechText(phrase),1,90) && neighbor) speakPerson(neighbor,isChineseUi() ? "嗯，说得对。" : "Yes, I agree.",1,90);
    }

    function setTask(actor, task, target) {
        const nextKey = taskTargetKey(target);
        const sameTarget = actor.task === task && actor.targetKey === nextKey;
        beginPersonActivity(actor, task, target);
        actor.task = task;
        actor.targetX = target && target.x;
        actor.targetY = target && target.y;
        actor.targetId = target && (target.humanId || target.buildingId || target.settlementId);
        actor.targetKind = target && (target.element || target.kind);
        actor.targetKey = nextKey;
        if (!sameTarget) {
            invalidateNavigation(actor);
            actor.harvestProgress = 0;
            actor.stuckCount = 0;
            actor.noProgressCount = 0;
            actor.bestTaskDistance = undefined;
            actor.progressTargetX = undefined;
            actor.progressTargetY = undefined;
            speakForTask(actor, task);
        }
    }

    function resetManager() {
        manager.actors.clear();
        manager.heads.clear();
        manager.settlements.clear();
        manager.children.clear();
        manager.constructionSites.clear();
        manager.structures.clear();
        manager.structuresById.clear();
        manager.actorById.clear();
        manager.factionById.clear();
        manager.settlementById.clear();
        manager.relationRecords.clear();
        manager.foundingSince.clear();
        manager.buckets.clear();
        manager.actorBucketByPixel.clear();
        manager.resourceIndex.clear();
        manager.resourceNodeByPixel.clear();
        manager.minerAssignments.clear();
        manager.fireTargets.length = 0;
        manager.lastFireScanTick = -Infinity;
        manager.treeById.clear();
        manager.treeRootColumns.clear();
        manager.treeRootColumnsTick = -Infinity;
        manager.treePixelsByLineage.clear();
        manager.dirtyTreeLineages.clear();
        manager.pendingResourceDrops.length = 0;
        if (manager.resourceReservations) manager.resourceReservations.clear();
        manager.territory = null;
        manager.pendingAttacks.length = 0;
        manager.pendingStructureAttacks.length = 0;
        manager.pendingIncidents.length = 0;
        manager.pendingRangedImpacts.length = 0;
        manager.visualProjectiles.clear();
        manager.nextHumanId = 1;
        manager.nextFactionId = 1;
        manager.nextSettlementId = 1;
        manager.nextBuildingId = 1;
        manager.nextTreeId = 1;
        manager.nextTerritoryClaimOrder = 1;
        manager.navigationRevision = 1;
        manager.routeSearches.clear();
        manager.routeRejectedEdges.clear();
        manager.lastFullRebuild = -1;
        manager.lastIndexTick = -1;
        manager.lastDerivedRefreshTick = -1;
        manager.lastAuditStartedTick = -1;
        manager.lastAuditCompletedTick = -1;
        manager.auditCursor = 0;
        manager.auditLimit = 0;
        manager.auditRunning = false;
        manager.derivedIndexesDirty = false;
        manager.lifecycleEvents = 0;
        manager.auditPixels = 0;
        manager.lastDiplomacyTick = -1;
        resetPeopleObserverState();
    }

    function rebuildIndexes(force) {
        if (!force && manager.lastFullRebuild >= 0 && pixelTicks - manager.lastFullRebuild < C.FULL_REBUILD_INTERVAL) return;
        manager.treeRootColumnsTick = -Infinity;
        manager.actors.clear();
        manager.heads.clear();
        manager.settlements.clear();
        manager.children.clear();
        manager.constructionSites.clear();
        manager.structures.clear();
        for (let i = 0; i < currentPixels.length; i++) {
            const pixel = currentPixels[i];
            if (!pixel || pixel.del) continue;
            registerPixel(pixel);
        }
        manager.lastFullRebuild = pixelTicks;
        buildWorldIndex();
        manager.derivedIndexesDirty = false;
        manager.lastDerivedRefreshTick = pixelTicks;
        manager.lastAuditStartedTick = pixelTicks;
        manager.lastAuditCompletedTick = pixelTicks;
    }

    function migrateLegacySocietyPixels() {
        const coresByBuilding = new Map();
        const allCores = new Set();
        manager.settlements.forEach((pixel) => { allCores.add(pixel); if (Number.isFinite(pixel.buildingId)) coresByBuilding.set(pixel.buildingId, pixel); });
        manager.constructionSites.forEach((pixel) => { allCores.add(pixel); if (Number.isFinite(pixel.buildingId)) coresByBuilding.set(pixel.buildingId, pixel); });
        manager.structures.forEach((pixel) => { if (STRUCTURE_CORES.has(pixel.element)) { allCores.add(pixel); if (Number.isFinite(pixel.buildingId)) coresByBuilding.set(pixel.buildingId, pixel); } });
        Array.from(manager.structures).forEach((pixel) => {
            if (!pixel || pixel.del || !STRUCTURE_PARTS.has(pixel.element) || !Number.isFinite(pixel.buildingId) || !coresByBuilding.has(pixel.buildingId)) return;
            deleteExactPixel(pixel);
        });
        allCores.forEach((core) => {
            if (!core || core.del) return;
            if (safeNumber(core.societyMigrationVersion, 0) < 2) {
                if (Number.isFinite(core.originX) && Number.isFinite(core.originY) && (core.x !== core.originX || core.y !== core.originY) && !getBuildingCoreAt(core.originX, core.originY)) {
                    moveBuildingCore(core, core.originX, core.originY, false);
                }
                if (core.element === "civ_construction" && !Number.isFinite(core.workDone)) {
                    const blueprint = BLUEPRINTS[core.blueprintType];
                    core.workRequired = blueprint && blueprint.workRequired || 4;
                    const oldTotal = Math.max(1, blueprint && blueprint.parts && blueprint.parts.length + 1 || 1);
                    core.workDone = Math.round(Math.min(1, safeNumber(core.placedParts, 0) / oldTotal) * core.workRequired);
                }
            }
            if (safeNumber(core.societyMigrationVersion, 0) < 3) relocateBuildingAboveTunnel(core);
            core.societyMigrationVersion = 3;
        });
    }

    function migrateRemovedSocietyContent() {
        Array.from(manager.constructionSites).forEach((site) => {
            if (!site || site.del || (site.blueprintType !== "farm" && site.blueprintType !== "granary")) return;
            cancelConstruction(site, false, {fullRefund: true, reason: "content_removed"});
        });
        Array.from(manager.structures).forEach((building) => {
            if (!building || building.del || !LEGACY_REMOVED_STRUCTURE_CORES.has(building.element)) return;
            destroyBuilding(building, "content_removed");
            unregisterPixel(building);
            cleanupCivilizedFields(building);
            building.legacyContentMigrationVersion = 1;
        });
        for (let i = 0; i < currentPixels.length; i++) {
            const pixel = currentPixels[i];
            if (!pixel || pixel.del || pixel.element !== "civ_farm_crop") continue;
            const mature = pixel.mature === true || pixelTicks >= safeNumber(pixel.matureTick, Infinity);
            changePixel(pixel, "civ_food_resource");
            pixel.resourceAmount = mature ? 2 : 1;
            pixel.resourceKind = "food";
            pixel._civCollectible = true;
            pixel._civResourceDrop = true;
            delete pixel.plantedTick;
            delete pixel.matureTick;
            delete pixel.mature;
        }
    }

    function buildWorldIndex(options) {
        const rebuildResourceTrees = !options || options.rebuildResourceTrees !== false;
        manager.navigationRevision = safeNumber(manager.navigationRevision, 0) + 1;
        migrateLegacySocietyPixels();
        manager.actorById.clear();
        manager.factionById.clear();
        manager.settlementById.clear();
        manager.buckets.clear();
        manager.actorBucketByPixel.clear();
        manager.structuresById.clear();
        if (rebuildResourceTrees) {
            manager.resourceIndex.clear();
            manager.resourceNodeByPixel.clear();
            manager.treeById.clear();
            manager.treePixelsByLineage.clear();
            manager.dirtyTreeLineages.clear();
        }
        let maxHumanId = 0;
        let maxFactionId = 0;
        let maxSettlementId = 0;
        let maxBuildingId = 0;

        // Saved pixels are restored independently. Repair the authoritative
        // body/head identity before the strict lookup helpers run.
        manager.heads.forEach((head) => {
            if (!head || head.del || head._r === undefined) return;
            const relation = getRelation(head._r);
            if (!relation || !relation.p) return;
            const body = relation.p.find((part) => part && !part.del && part.element === "civ_body");
            if (!body) return;
            if (!Number.isFinite(body.humanId) && Number.isFinite(head.humanId)) body.humanId = head.humanId;
            if (!Number.isFinite(body.factionId) && Number.isFinite(head.factionId)) body.factionId = head.factionId;
            if (!Number.isFinite(body.humanId)) body.humanId = manager.nextHumanId++;
            if (!Number.isFinite(body.factionId)) body.factionId = manager.nextFactionId++;
            head.humanId = body.humanId;
            head.factionId = body.factionId;
            head.settlementId = body.settlementId || null;
            head.factionColor = body.factionColor || head.factionColor || chooseColor(body.factionId);
            head.dead = body.dead || head.dead || false;
        });

        manager.actors.forEach((actor) => {
            if (!actor || actor.del || actor.dead) return;
            migrateActorEquipment(actor);
            delete actor.hunger;
            delete actor.lastHungerTick;
            if (actor.role === "farmer") actor.role = "food";
            else if (actor.role === "industry") actor.role = "worker";
            else if (actor.role === "artisan_trade") actor.role = "merchant";
            if (actor.task === "farm" || actor.role === "worker" && actor.task === "facility") {
                actor.task = "planning";
                actor.targetId = undefined;
                actor.targetKind = undefined;
                actor.targetX = undefined;
                actor.targetY = undefined;
                invalidateNavigation(actor, "legacy_job_removed");
            }
            if (!actor.task || actor.task === "idle") actor.task = "planning";
            if (!actor.role || actor.role === "child") actor.role = "worker";
            if (!Number.isFinite(actor.humanId)) actor.humanId = manager.nextHumanId++;
            if (!Number.isFinite(actor.factionId)) actor.factionId = manager.nextFactionId++;
            maxHumanId = Math.max(maxHumanId, actor.humanId);
            maxFactionId = Math.max(maxFactionId, actor.factionId);
            manager.actorById.set(actor.humanId, actor);
            const faction = ensureFactionRecord(actor.factionId, actor.factionColor || chooseColor(actor.factionId));
            actor.factionColor = faction.color;
            ensureLifeHistory(actor, actor.element === "civ_body");
            ensurePersonActivity(actor, true);
            faction.actors.push(actor);
            if (actor.element === "civ_child") faction.children.push(actor);
            else faction.adults.push(actor);
            const key = bucketKey(actor.x, actor.y);
            if (!manager.buckets.has(key)) manager.buckets.set(key, []);
            manager.buckets.get(key).push(actor);
            manager.actorBucketByPixel.set(actor, key);
        });

        manager.settlements.forEach((banner) => {
            if (!banner || banner.del) return;
            if (!Number.isFinite(banner.factionId)) banner.factionId = manager.nextFactionId++;
            if (!Number.isFinite(banner.settlementId)) banner.settlementId = manager.nextSettlementId++;
            maxFactionId = Math.max(maxFactionId, banner.factionId);
            maxSettlementId = Math.max(maxSettlementId, banner.settlementId);
            if (!banner.factionColor) banner.factionColor = chooseColor(banner.factionId);
            ensureStock(banner);
            ensureResearchState(banner);
            if (!banner.diplomacy || typeof banner.diplomacy !== "object") banner.diplomacy = {};
            Object.keys(banner.diplomacy).forEach((otherFactionId) => {
                const parsedId = Number(otherFactionId);
                if (Number.isFinite(parsedId)) maxFactionId = Math.max(maxFactionId, parsedId);
            });
            ensureBuildingMetadata(banner, "town_center");
            if (!Number.isFinite(banner.housing)) banner.housing = 4;
            if (!Number.isFinite(banner.birthReadyTick)) banner.birthReadyTick = pixelTicks + C.BIRTH_COOLDOWN;
            if (!Number.isFinite(banner.territoryRadius)) banner.territoryRadius = C.TERRITORY_BASE_RADIUS;
            ensureChronicle(banner);
            migrateLegacyDeathArchive(banner);
            maxHumanId = Math.max(maxHumanId, safeNumber(banner.humanIdHighWatermark, 0));
            if (banner.townCenterActive === undefined) banner.townCenterActive = true;
            manager.settlementById.set(banner.settlementId, banner);
            const faction = ensureFactionRecord(banner.factionId, banner.factionColor);
            banner.factionColor = faction.color;
            setPixelColor(banner, faction.color);
            faction.settlements.push(banner);
            faction.eraId = banner.eraId;
            faction.research = banner.research;
        });

        migrateRemovedSocietyContent();

        manager.structures.forEach((pixel) => {
            if (!pixel || pixel.del || !Number.isFinite(pixel.factionId)) return;
            maxFactionId = Math.max(maxFactionId, pixel.factionId);
            if (Number.isFinite(pixel.buildingId)) maxBuildingId = Math.max(maxBuildingId, pixel.buildingId);
            if (STRUCTURE_CORES.has(pixel.element)) ensureBuildingMetadata(pixel);
            const faction = ensureFactionRecord(pixel.factionId, pixel.factionColor || chooseColor(pixel.factionId));
            pixel.factionColor = faction.color;
            setPixelColor(pixel, faction.color);
            if (pixel.element === "civ_hut_core") faction.huts.push(pixel);
            else if (pixel.element === "civ_farm_marker") faction.farms.push(pixel);
            else if (pixel.element === "civ_workshop_core") faction.workshops.push(pixel);
            else if (pixel.element === "civ_lumberyard_core") faction.lumberyards.push(pixel);
            else if (pixel.element === "civ_hearth_core") faction.hearths.push(pixel);
            else if (pixel.element === "civ_quarry_core") faction.quarries.push(pixel);
            else if (pixel.element === "civ_granary_core") faction.granaries.push(pixel);
            else if (pixel.element === "civ_kiln_core") faction.kilns.push(pixel);
            else if (pixel.element === "civ_foundry_core") faction.foundries.push(pixel);
            else if (pixel.element === "civ_forge_core") faction.forges.push(pixel);
            else if (pixel.element === "civ_keep_core") faction.keeps.push(pixel);
            else if (pixel.element === "civ_siege_workshop_core") faction.siegeWorkshops.push(pixel);
            else if (pixel.element === "civ_library_core") faction.libraries.push(pixel);
            else if (pixel.element === "civ_market_core") faction.markets.push(pixel);
            else if (pixel.element === "civ_tower_core") faction.towers.push(pixel);
            else if (pixel.element === "civ_palisade" || pixel.element === "civ_gate") faction.defenses.push(pixel);
        });

        manager.constructionSites.forEach((site) => {
            if (!site || site.del || !Number.isFinite(site.factionId)) return;
            maxFactionId = Math.max(maxFactionId, site.factionId);
            if (Number.isFinite(site.buildingId)) maxBuildingId = Math.max(maxBuildingId, site.buildingId);
            ensureBuildingMetadata(site, site.blueprintType);
            const faction = ensureFactionRecord(site.factionId, site.factionColor || chooseColor(site.factionId));
            faction.constructionSites.push(site);
        });

        manager.factionById.forEach((faction) => {
            faction.population = faction.actors.length;
            faction.adultPopulation = faction.adults.length;
            faction.techModifiers = computeTechModifiers(faction);
            faction.militaryPower = fallbackMilitaryPower(faction.adults);
            const banner = faction.settlements.slice().sort((a, b) => safeNumber(a.foundedTick, a.start || 0) - safeNumber(b.foundedTick, b.start || 0) || a.settlementId - b.settlementId)[0];
            if (banner) {
                faction.settlements.forEach((settlement) => {
                    const settlementHuts = faction.huts.filter((building) => building.settlementId === settlement.settlementId);
                    const settlementKeeps = faction.keeps.filter((building) => building.settlementId === settlement.settlementId);
                    const settlementPopulation = faction.actors.filter((actor) => actor.settlementId === settlement.settlementId).length;
                    settlement.population = settlementPopulation;
                    settlement.housing = 4 + settlementHuts.length * (4 + safeNumber(faction.techModifiers.hutHousingBonus, 0)) + settlementKeeps.length * 8;
                    settlement.stage = settlementHuts.length >= 2 ? "village" : (settlementHuts.length ? "hamlet" : "camp");
                    settlement.research = banner.research;
                    settlement.eraId = banner.eraId;
                });
                faction.eraId = banner.eraId;
                faction.research = banner.research;
            }
            faction.housing = faction.settlements.reduce((sum, settlement) => sum + Math.max(4, settlement.housing || 4), 0);
        });

        if (rebuildResourceTrees) rebuildResourceAndTreeIndex();
        rebuildTerritoryIndex();

        manager.relationRecords.forEach((record) => {
            if (record && Number.isFinite(Number(record.factionA))) maxFactionId = Math.max(maxFactionId, Number(record.factionA));
            if (record && Number.isFinite(Number(record.factionB))) maxFactionId = Math.max(maxFactionId, Number(record.factionB));
        });

        manager.settlements.forEach((banner) => {
            if (banner && !banner.del) banner.humanIdHighWatermark = Math.max(safeNumber(banner.humanIdHighWatermark, 0), maxHumanId);
        });
        manager.nextHumanId = Math.max(manager.nextHumanId, maxHumanId + 1);
        manager.nextFactionId = Math.max(manager.nextFactionId, maxFactionId + 1);
        manager.nextSettlementId = Math.max(manager.nextSettlementId, maxSettlementId + 1);
        manager.nextBuildingId = Math.max(manager.nextBuildingId, maxBuildingId + 1);
        manager.lastIndexTick = pixelTicks;
    }

    function refreshDerivedIndexes() {
        buildWorldIndex({rebuildResourceTrees: false});
        manager.derivedIndexesDirty = false;
        manager.lastDerivedRefreshTick = pixelTicks;
    }

    function fallbackMilitaryPower(adults) {
        if (Core.computeMilitaryPower) return Core.computeMilitaryPower(adults || []);
        let total = 0;
        for (let i = 0; i < adults.length; i++) {
            const actor = adults[i];
            if (!actor || actor.dead || actor.hp <= 0) continue;
            const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists") || {damage: 5};
            const roleMultiplier = actor.role === "warrior" ? 1.25 : (actor.role === "guard" ? 1.1 : 1);
            total += (actor.hp / Math.max(1, actor.baseMaxHp || C.ADULT_HP)) * Math.max(0, safeNumber(weapon.damage, 5)) * roleMultiplier;
        }
        return total;
    }

    function nearbyActors(x, y, radius, predicate) {
        const results = [];
        const minBX = Math.floor((x - radius) / C.BUCKET_SIZE);
        const maxBX = Math.floor((x + radius) / C.BUCKET_SIZE);
        const minBY = Math.floor((y - radius) / C.BUCKET_SIZE);
        const maxBY = Math.floor((y + radius) / C.BUCKET_SIZE);
        for (let bx = minBX; bx <= maxBX; bx++) {
            for (let by = minBY; by <= maxBY; by++) {
                const bucket = manager.buckets.get(bx + "," + by);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const actor = bucket[i];
                    if (!actor || actor.del || actor.dead) continue;
                    if (Core.distance(actor.x, actor.y, x, y) > radius) continue;
                    if (!predicate || predicate(actor)) results.push(actor);
                }
            }
        }
        results.sort((a, b) => Core.distance(a.x, a.y, x, y) - Core.distance(b.x, b.y, x, y));
        return results;
    }

    function settlementForActor(actor) {
        if (actor && actor.settlementId && manager.settlementById.has(actor.settlementId)) {
            return manager.settlementById.get(actor.settlementId);
        }
        const faction = actor && manager.factionById.get(actor.factionId);
        const banner = faction && faction.settlements[0];
        if (banner && actor) actor.settlementId = banner.settlementId;
        return banner || null;
    }

    function territoryOwnerAt(x, y, excludedFactionId) {
        const territory = ensureTerritoryIndex();
        if (!territory) return null;
        const ownerId = territory.ownerAt(x);
        if (ownerId === null || ownerId === undefined || Number(ownerId) === Number(excludedFactionId)) return null;
        const faction = manager.factionById.get(Number(ownerId));
        return faction && faction.settlements[0] || {factionId: Number(ownerId), x: x, y: y};
    }

    function registerResource(elementName, descriptor) {
        if (!elementName || !descriptor || !descriptor.kind) return false;
        manager.resources.set(elementName, Object.assign({yield: 1, harvestTicks: 10}, descriptor));
        if (elements[elementName]) elements[elementName].humanCollectible = true;
        if (typeof refreshElementPaletteVisibility === "function") refreshElementPaletteVisibility(false);
        return true;
    }

    function markCollectibleResource(pixel, descriptor) {
        if (!pixel || !descriptor) return descriptor;
        pixel._civCollectible = true;
        if (elements[pixel.element]) elements[pixel.element].humanCollectible = true;
        return descriptor;
    }

    function resourceDescriptor(pixel) {
        if (!pixel || pixel.del || !elements[pixel.element]) return null;
        if (pixel.element === "civ_farm_crop") {
            if (pixelTicks < safeNumber(pixel.matureTick, safeNumber(pixel.plantedTick, pixelTicks) + C.FARM_GROW_TICKS)) return null;
            return markCollectibleResource(pixel, {kind: "food", yield: C.FARM_HARVEST_FOOD, harvestTicks: C.THINK_INTERVAL, farmCrop: true});
        }
        if (pixel.element === "civ_wood_resource") {
            return markCollectibleResource(pixel, {kind: "wood", material: "wood", yield: Math.max(1, safeNumber(pixel.resourceAmount, 1)), harvestTicks: 8, resourceDrop: true});
        }
        if (pixel.element === "civ_tree_sapling_resource") {
            const seed = TREE_SAPLING_ELEMENTS.has(pixel.treeSapling) ? pixel.treeSapling : "sapling";
            return markCollectibleResource(pixel, {kind: "wood", yield: 1, harvestTicks: 6, seed: seed, treeSeed: seed, treeSaplingResource: true, resourceDrop: true});
        }
        if (TREE_SAPLING_ELEMENTS.has(pixel.element)) {
            return markCollectibleResource(pixel, {kind: "wood", yield: 1, harvestTicks: 8, treeSeed: pixel.element, treeSaplingResource: true});
        }
        if (pixel.element === "civ_seed_resource") {
            return markCollectibleResource(pixel, {kind: "food", yield: Math.max(1, safeNumber(pixel.resourceAmount, 1)), harvestTicks: 6, resourceDrop: true});
        }
        if (CARRIED_RESOURCE_KINDS[pixel.element]) {
            const kind = CARRIED_RESOURCE_KINDS[pixel.element];
            return markCollectibleResource(pixel, {kind: kind, material: kind, yield: Math.max(1, safeNumber(pixel.resourceAmount, 1)), harvestTicks: 8, resourceDrop: true});
        }
        if (pixel.element === "civ_resource_drop" && pixel.resourceKind) {
            return markCollectibleResource(pixel, {kind: pixel.resourceKind, material: pixel.resourceMaterial || pixel.resourceKind, yield: Math.max(1, safeNumber(pixel.resourceAmount, 1)), harvestTicks: 8, resourceDrop: true});
        }
        if (pixel.element.indexOf("civ_") === 0) return null;
        if (manager.resources.has(pixel.element)) return markCollectibleResource(pixel, manager.resources.get(pixel.element));
        if (elements[pixel.element].seed === true && !TREE_SAPLING_ELEMENTS.has(pixel.element)) {
            return markCollectibleResource(pixel, {kind: "food", yield: 1, harvestTicks: 6});
        }
        if (elements[pixel.element].isFood) {
            return markCollectibleResource(pixel, {kind: "food", yield: 1, harvestTicks: 6});
        }
        if (DEFAULT_RESOURCES.wood.has(pixel.element)) return markCollectibleResource(pixel, {kind: "wood", material: pixel.element, yield: 1, harvestTicks: 18, treeSeed: TREE_SEEDS[pixel.element] || "sapling"});
        if (DEFAULT_RESOURCES.stone.has(pixel.element)) return markCollectibleResource(pixel, {kind: "stone", yield: 1, harvestTicks: 28, harvestInto: "dirt"});
        if (pixel.element === "copper") return markCollectibleResource(pixel, {kind: "copper", material: "copper", yield: 1, harvestTicks: 38});
        if (pixel.element === "iron" || pixel.element === "iron_ore") return markCollectibleResource(pixel, {kind: "raw_iron", material: "raw_iron", yield: 1, harvestTicks: 48});
        return null;
    }

    function removeIndexedResourcePixel(pixel) {
        if (!pixel) return false;
        const indexed = manager.resourceNodeByPixel.get(pixel);
        let removed = false;
        const indexes = indexed ? [[indexed.kind, manager.resourceIndex.get(indexed.kind) || []]] : Array.from(manager.resourceIndex.entries());
        indexes.forEach((entry) => {
            const nodes = entry[1];
            for (let index = nodes.length - 1; index >= 0; index--) {
                if (nodes[index] !== indexed && nodes[index] && nodes[index].pixel !== pixel) continue;
                if (manager.resourceReservations && nodes[index].key) manager.resourceReservations.release(nodes[index].key);
                nodes.splice(index, 1);
                removed = true;
            }
        });
        manager.resourceNodeByPixel.delete(pixel);
        return removed;
    }

    function elementMayBeIndexedResource(element, pixel) {
        if (!element) return false;
        if (TREE_COMPONENT_ELEMENTS.has(element) || manager.resources.has(element) || DEFAULT_RESOURCES.wood.has(element) || DEFAULT_RESOURCES.stone.has(element)) return true;
        if (element === "copper" || element === "iron" || element === "iron_ore" || element === "civ_farm_crop" || element === "civ_resource_drop" || element === "civ_seed_resource" || CARRIED_RESOURCE_KINDS[element]) return true;
        const info = elements[element];
        return !!(pixel && (pixel._civResourceDrop || pixel._civCollectible || pixel.resourceKind) || info && (info.isFood || info.seed === true || info.humanCollectible));
    }

    function pixelHasTreeIdentity(pixel) {
        return !!(pixel && TREE_COMPONENT_ELEMENTS.has(pixel.element) && (pixel.treeLineage || Number.isFinite(pixel.treeId) || Number.isFinite(pixel.civPlantedTreeId) || pixel._civTreeRoot || pixel.naturalVegetation === true));
    }

    function indexStandaloneResourcePixel(pixel) {
        if (!pixel || pixel.del) return false;
        if (manager.resourceNodeByPixel.has(pixel)) removeIndexedResourcePixel(pixel);
        if (pixelHasTreeIdentity(pixel)) return false;
        const descriptor = resourceDescriptor(pixel);
        if (!descriptor) return false;
        const node = {pixel, x: pixel.x, y: pixel.y, element: pixel.element, descriptor, kind: descriptor.kind, key: pixel.element + "@" + pixel.x + "," + pixel.y, tree: null};
        if (!manager.resourceIndex.has(descriptor.kind)) manager.resourceIndex.set(descriptor.kind, []);
        manager.resourceIndex.get(descriptor.kind).push(node);
        manager.resourceNodeByPixel.set(pixel, node);
        return true;
    }

    function trackTreeLineagePixel(pixel, previousLineage) {
        if (previousLineage) {
            const previous = manager.treePixelsByLineage.get(previousLineage);
            if (previous) {
                previous.delete(pixel);
                if (previous.size === 0) manager.treePixelsByLineage.delete(previousLineage);
            }
            manager.dirtyTreeLineages.add(previousLineage);
        }
        const lineage = pixel && !pixel.del && TREE_COMPONENT_ELEMENTS.has(pixel.element) && pixel.treeLineage;
        if (!lineage) return;
        if (!manager.treePixelsByLineage.has(lineage)) manager.treePixelsByLineage.set(lineage, new Set());
        manager.treePixelsByLineage.get(lineage).add(pixel);
        manager.dirtyTreeLineages.add(lineage);
    }

    function findTreeByLineage(lineage) {
        if (!lineage) return null;
        for (const tree of manager.treeById.values()) {
            if (tree && tree.lineage === lineage) return tree;
        }
        return null;
    }

    function treeBirthTick(pixels) {
        const ticks = (pixels || []).map((pixel) => Number(pixel && pixel.treeBornTick)).filter(Number.isFinite);
        return ticks.length ? Math.min.apply(null, ticks) : null;
    }

    function synchronizeTreeBuildingLayer(pixels, basePixel, treeId) {
        const component = (pixels || []).filter((pixel) => pixel && !pixel.del);
        let layer = basePixel && (basePixel.treeBuildingLayer === "above" || basePixel.treeBuildingLayer === "below") ? basePixel.treeBuildingLayer : null;
        if (!layer) layer = component.map((pixel) => pixel.treeBuildingLayer).find((value) => value === "above" || value === "below") || null;
        if (!layer && basePixel && typeof ensureTreeBuildingLayer === "function") layer = ensureTreeBuildingLayer(basePixel);
        if (!layer) layer = Math.abs(safeNumber(treeId, 0)) % 2 === 0 ? "above" : "below";
        component.forEach((pixel) => { pixel.treeBuildingLayer = layer; });
        return layer;
    }

    function treeIsHarvestable(tree) {
        if (!tree || safeNumber(tree.woodYield, 0) < 1) return false;
        return !Number.isFinite(tree.bornTick) || pixelTicks - tree.bornTick >= C.TREE_HARVEST_AGE_TICKS;
    }

    function rebuildDirtyTreeLineage(lineage) {
        const tracked = manager.treePixelsByLineage.get(lineage);
        const pixels = tracked ? Array.from(tracked).filter((pixel) => pixel && !pixel.del && TREE_COMPONENT_ELEMENTS.has(pixel.element) && pixel.treeLineage === lineage) : [];
        if (tracked) {
            tracked.clear();
            pixels.forEach((pixel) => tracked.add(pixel));
            if (tracked.size === 0) manager.treePixelsByLineage.delete(lineage);
        }
        let tree = findTreeByLineage(lineage);
        if (!tree) {
            for (let i = 0; i < pixels.length && !tree; i++) {
                if (Number.isFinite(pixels[i].treeId)) tree = manager.treeById.get(pixels[i].treeId) || null;
                if (tree) break;
                for (let dx = -1; dx <= 1 && !tree; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (!dx && !dy) continue;
                        const adjacent = pixelsAt(pixels[i].x + dx, pixels[i].y + dy).find((candidate) => candidate && Number.isFinite(candidate.treeId) && manager.treeById.has(candidate.treeId));
                        if (adjacent) { tree = manager.treeById.get(adjacent.treeId); break; }
                    }
                }
            }
        }
        const previousPixels = tree && Array.isArray(tree.pixels) ? tree.pixels.filter((pixel) => pixel && !pixel.del && (!pixel.treeLineage || pixel.treeLineage === lineage)) : [];
        const component = Array.from(new Set(previousPixels.concat(pixels)));
        if (!component.length) {
            if (tree) {
                removeIndexedResourcePixel(tree.base);
                manager.treeById.delete(tree.id);
            }
            return false;
        }
        const treeId = tree ? tree.id : (component.map((pixel) => pixel.treeId).find(Number.isFinite) || manager.nextTreeId++);
        manager.nextTreeId = Math.max(manager.nextTreeId, treeId + 1);
        const bottomY = Math.max.apply(null, component.map((pixel) => pixel.y));
        const bottom = component.filter((pixel) => pixel.y === bottomY).sort((a, b) => a.x - b.x);
        const markedRoot = component.find((pixel) => pixel._civTreeRoot && pixel.y === bottomY);
        const basePixel = markedRoot || bottom[Math.floor((bottom.length - 1) / 2)] || component[0];
        const topY = Math.min.apply(null, component.map((pixel) => pixel.y));
        const declaredSpecies = component.map((pixel) => pixel.treeSpecies).find(Boolean);
        const species = declaredSpecies || (component.some((pixel) => pixel.element === "bamboo") ? "bamboo_plant" : (component.some((pixel) => pixel.element === "evergreen") ? "pinecone" : "sapling"));
        const woodPixels = component.filter((pixel) => WOOD_BEARING_TREE_ELEMENTS.has(pixel.element));
        if (tree && tree.base && tree.base !== basePixel) removeIndexedResourcePixel(tree.base);
        component.forEach((pixel) => {
            pixel.treeId = treeId;
            pixel.treeRootX = basePixel.x;
            pixel.treeRootY = basePixel.y;
            if (!pixel.treeLineage) pixel.treeLineage = lineage;
        });
        synchronizeTreeBuildingLayer(component, basePixel, treeId);
        basePixel._civTreeRoot = true;
        tree = {id: treeId, lineage, base: basePixel, root: basePixel, pixels: component, woodPixels, topY, height: Math.max(1, basePixel.y - topY + 1), woodYield: woodPixels.length, bornTick: treeBirthTick(component), seed: species === "bamboo" ? "bamboo_plant" : (species === "evergreen" ? "pinecone" : (TREE_SAPLING_ELEMENTS.has(species) ? species : "sapling")), species};
        manager.treeById.set(treeId, tree);
        removeIndexedResourcePixel(basePixel);
        const descriptor = resourceDescriptor(basePixel);
        if (treeIsHarvestable(tree) && descriptor && descriptor.kind === "wood") {
            const treeDescriptor = Object.assign({}, descriptor, {yield: tree.woodYield, treeSapling: tree.seed, treeId: tree.id, wholeTree: true});
            const node = {pixel: basePixel, x: basePixel.x, y: basePixel.y, element: basePixel.element, descriptor: treeDescriptor, kind: "wood", key: basePixel.element + "@" + basePixel.x + "," + basePixel.y, tree};
            if (!manager.resourceIndex.has("wood")) manager.resourceIndex.set("wood", []);
            manager.resourceIndex.get("wood").push(node);
            manager.resourceNodeByPixel.set(basePixel, node);
        }
        return true;
    }

    function processDirtyTrees(timeBudgetMs) {
        const started = nowMs();
        let processed = 0;
        for (const lineage of Array.from(manager.dirtyTreeLineages)) {
            manager.dirtyTreeLineages.delete(lineage);
            rebuildDirtyTreeLineage(lineage);
            processed++;
            if (processed >= 4 || nowMs() - started >= timeBudgetMs) break;
        }
        return processed;
    }

    function handlePixelLifecycle(event) {
        if (!event || !event.pixel) return;
        const pixel = event.pixel;
        const previous = event.old || {};
        if (TREE_COMPONENT_ELEMENTS.has(previous.element) || TREE_COMPONENT_ELEMENTS.has(pixel.element)) manager.treeRootColumnsTick = -Infinity;
        if (!manager.resourceNodeByPixel.has(pixel) && !elementMayBeIndexedResource(previous.element, pixel) && !elementMayBeIndexedResource(pixel.element, pixel)) return;
        manager.lifecycleEvents++;
        if (manager.resourceNodeByPixel.has(pixel)) removeIndexedResourcePixel(pixel);
        if (previous.treeLineage || pixel.treeLineage) trackTreeLineagePixel(pixel, previous.treeLineage);
        if (event.type !== "delete" && !pixel.del) indexStandaloneResourcePixel(pixel);
    }

    function auditPixelIndex(pixel) {
        if (!pixel || pixel.del) return;
        registerPixel(pixel);
        if (pixel.treeLineage && TREE_COMPONENT_ELEMENTS.has(pixel.element)) {
            const lineage = pixel.treeLineage;
            const tracked = manager.treePixelsByLineage.get(lineage);
            const tree = Number.isFinite(pixel.treeId) ? manager.treeById.get(pixel.treeId) : findTreeByLineage(lineage);
            const indexed = manager.resourceNodeByPixel.get(pixel);
            if (!tracked || !tracked.has(pixel)) {
                trackTreeLineagePixel(pixel);
            }
            else if (!tree || !Array.isArray(tree.pixels) || tree.pixels.indexOf(pixel) === -1) {
                manager.dirtyTreeLineages.add(lineage);
            }
            else if (tree.base === pixel) {
                if (!indexed || indexed.tree !== tree || indexed.x !== pixel.x || indexed.y !== pixel.y || indexed.element !== pixel.element) {
                    manager.dirtyTreeLineages.add(lineage);
                }
            }
            else if (indexed) {
                removeIndexedResourcePixel(pixel);
                manager.dirtyTreeLineages.add(lineage);
            }
            return;
        }
        const descriptor = resourceDescriptor(pixel);
        const indexed = manager.resourceNodeByPixel.get(pixel);
        if (!descriptor || pixelHasTreeIdentity(pixel)) {
            if (indexed) removeIndexedResourcePixel(pixel);
            return;
        }
        if (!indexed) {
            indexStandaloneResourcePixel(pixel);
            return;
        }
        if (indexed.x !== pixel.x || indexed.y !== pixel.y || indexed.element !== pixel.element || indexed.kind !== descriptor.kind) {
            if (manager.resourceReservations && indexed.key) manager.resourceReservations.release(indexed.key);
            removeIndexedResourcePixel(pixel);
            indexStandaloneResourcePixel(pixel);
        }
    }

    function processIncrementalAudit(timeBudgetMs) {
        if (!manager.auditRunning) {
            if (manager.lastAuditStartedTick >= 0 && pixelTicks - manager.lastAuditStartedTick < C.FULL_REBUILD_INTERVAL) return 0;
            manager.auditRunning = true;
            manager.auditCursor = 0;
            manager.auditLimit = currentPixels.length;
            manager.lastAuditStartedTick = pixelTicks;
        }
        const started = nowMs();
        let processed = 0;
        const pixelBudget = Math.max(16, Math.floor(safeNumber(C.INDEX_AUDIT_PIXELS_PER_TICK, 64)));
        while (manager.auditCursor < manager.auditLimit && processed < pixelBudget && nowMs() - started < timeBudgetMs) {
            auditPixelIndex(currentPixels[manager.auditCursor++]);
            processed++;
        }
        manager.auditPixels += processed;
        if (manager.auditCursor >= manager.auditLimit) {
            manager.auditRunning = false;
            manager.lastAuditCompletedTick = pixelTicks;
        }
        return processed;
    }

    function rebuildResourceAndTreeIndex() {
        manager.resourceIndex.clear();
        manager.resourceNodeByPixel.clear();
        manager.treeById.clear();
        manager.treePixelsByLineage.clear();
        manager.dirtyTreeLineages.clear();
        const woodyTreeElements = new Set(["wood", "tree_branch", "evergreen", "bamboo"]);
        // Civilization-planted seeds rise while growing. Preserve their
        // original germination coordinate separately, then transfer the tree
        // identity to the woody cell that replaces that coordinate.
        for (let i = 0; i < currentPixels.length; i++) {
            const planted = currentPixels[i];
            if (!planted || planted.del) continue;
            const woodyBelow = getPixel(planted.x, planted.y + 1);
            if (planted._civTreeRoot && !PLANTED_TREE_SEEDS.has(planted.element) && TREE_COMPONENT_ELEMENTS.has(planted.element) && woodyBelow && TREE_COMPONENT_ELEMENTS.has(woodyBelow.element)) {
                delete planted._civTreeRoot;
                if (Number.isFinite(woodyBelow.treeId) && woodyBelow.treeId !== planted.treeId) delete planted.treeId;
            }
            if (PLANTED_TREE_SEEDS.has(planted.element) && planted._civTreeRoot && Number.isFinite(planted.treeId) && !Number.isFinite(planted.civPlantedTreeId)) {
                planted.civPlantedTreeId = planted.treeId;
                planted.civTreeOriginX = Number.isFinite(planted.treeRootX) ? planted.treeRootX : planted.x;
                planted.civTreeOriginY = Number.isFinite(planted.treeRootY) ? planted.treeRootY : planted.y;
                delete planted.treeId;
                delete planted._civTreeRoot;
            }
            if (!Number.isFinite(planted.civPlantedTreeId)) continue;
            const originX = safeNumber(planted.civTreeOriginX, planted.x);
            const originY = safeNumber(planted.civTreeOriginY, planted.y);
            const rootCandidate = pixelsAt(originX, originY).find((pixel) => pixel && woodyTreeElements.has(pixel.element));
            if (rootCandidate) {
                if (Number.isFinite(rootCandidate.treeId)) planted.civPlantedTreeId = rootCandidate.treeId;
                else rootCandidate.treeId = planted.civPlantedTreeId;
                rootCandidate._civTreeRoot = true;
            }
            if (PLANTED_TREE_SEEDS.has(planted.element)) {
                delete planted.treeId;
                delete planted._civTreeRoot;
            }
        }
        const treePixels = [];
        const byCoordinate = new Map();
        for (let i = 0; i < currentPixels.length; i++) {
            const pixel = currentPixels[i];
            if (!pixel || pixel.del) continue;
            const isTree = TREE_COMPONENT_ELEMENTS.has(pixel.element) && (pixel.naturalVegetation === true || pixel.treeLineage || (woodyTreeElements.has(pixel.element) && pixel.element !== "wood") || pixel._civTreeRoot || pixel.treeId || Number.isFinite(pixel.civPlantedTreeId));
            if (isTree) {
                treePixels.push(pixel);
                byCoordinate.set(pixel.x + "," + pixel.y, pixel);
            }
        }
        const legacyLeaves = new Map();
        for (let i = 0; i < currentPixels.length; i++) {
            const pixel = currentPixels[i];
            const key = pixel && pixel.x + "," + pixel.y;
            if (!pixel || pixel.del || byCoordinate.has(key) || !LEGACY_TREE_LEAF_ELEMENTS.has(pixel.element)) continue;
            legacyLeaves.set(key, pixel);
        }
        const legacyFrontier = treePixels.slice();
        while (legacyFrontier.length) {
            const source = legacyFrontier.pop();
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (!dx && !dy) continue;
                    const key = (source.x + dx) + "," + (source.y + dy);
                    const leaf = legacyLeaves.get(key);
                    if (!leaf) continue;
                    legacyLeaves.delete(key);
                    treePixels.push(leaf);
                    byCoordinate.set(key, leaf);
                    legacyFrontier.push(leaf);
                }
            }
        }
        const visited = new Set();
        for (let i = 0; i < treePixels.length; i++) {
            const start = treePixels[i];
            if (visited.has(start)) continue;
            const queue = [start];
            const component = [];
            let componentTreeId = Number.isFinite(start.treeId) ? start.treeId : null;
            let componentLineage = start.treeLineage || null;
            visited.add(start);
            while (queue.length) {
                const pixel = queue.pop();
                component.push(pixel);
                if (!Number.isFinite(componentTreeId) && Number.isFinite(pixel.treeId)) componentTreeId = pixel.treeId;
                if (!componentLineage && pixel.treeLineage) componentLineage = pixel.treeLineage;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (!dx && !dy) continue;
                        const other = byCoordinate.get((pixel.x + dx) + "," + (pixel.y + dy));
                        if (!other || visited.has(other)) continue;
                        if (componentLineage && other.treeLineage && other.treeLineage !== componentLineage) continue;
                        if (Number.isFinite(componentTreeId) && Number.isFinite(other.treeId) && other.treeId !== componentTreeId) continue;
                        if (!componentLineage && other.treeLineage) componentLineage = other.treeLineage;
                        if (!Number.isFinite(componentTreeId) && Number.isFinite(other.treeId)) componentTreeId = other.treeId;
                        visited.add(other);
                        queue.push(other);
                    }
                }
            }
            const savedId = componentTreeId || component.map((pixel) => pixel.treeId).find(Number.isFinite);
            const treeId = savedId || manager.nextTreeId++;
            manager.nextTreeId = Math.max(manager.nextTreeId, treeId + 1);
            const bottomY = Math.max.apply(null, component.map((pixel) => pixel.y));
            const bottom = component.filter((pixel) => pixel.y === bottomY).sort((a, b) => a.x - b.x);
            const markedRoot = component.find((pixel) => pixel._civTreeRoot && pixel.y === bottomY);
            const basePixel = markedRoot || bottom[Math.floor((bottom.length - 1) / 2)] || start;
            const topY = Math.min.apply(null, component.map((pixel) => pixel.y));
            const declaredSpecies = component.map((pixel) => pixel.treeSpecies).find(Boolean);
            const species = declaredSpecies || (component.some((pixel) => pixel.element === "bamboo") ? "bamboo_plant" : (component.some((pixel) => pixel.element === "evergreen") ? "pinecone" : "sapling"));
            const height = Math.max(1, basePixel.y - topY + 1);
            const woodPixels = component.filter((pixel) => WOOD_BEARING_TREE_ELEMENTS.has(pixel.element));
            const woodYield = woodPixels.length;
            const seed = species === "bamboo" ? "bamboo_plant" : (species === "evergreen" ? "pinecone" : (TREE_SAPLING_ELEMENTS.has(species) ? species : "sapling"));
            const tree = {id: treeId, lineage: componentLineage, base: basePixel, root: basePixel, pixels: component, woodPixels, topY, height, woodYield, bornTick: treeBirthTick(component), seed, species};
            component.forEach((pixel) => { pixel.treeId = treeId; pixel.treeRootX = basePixel.x; pixel.treeRootY = basePixel.y; if (componentLineage && !pixel.treeLineage) pixel.treeLineage = componentLineage; });
            synchronizeTreeBuildingLayer(component, basePixel, treeId);
            if (componentLineage) {
                if (!manager.treePixelsByLineage.has(componentLineage)) manager.treePixelsByLineage.set(componentLineage, new Set());
                component.forEach((pixel) => manager.treePixelsByLineage.get(componentLineage).add(pixel));
            }
            basePixel._civTreeRoot = true;
            manager.treeById.set(treeId, tree);
        }

        manager.treeById.forEach((tree) => {
            const base = tree && tree.base;
            if (!base || base.treeRootMigrationVersion >= 1) return;
            base.treeRootMigrationVersion = 1;
            const firstRoot = getPixel(base.x, base.y + 1);
            if (!firstRoot || firstRoot.element !== "root") return;
            const queue = [firstRoot];
            const seen = new Set(queue);
            while (queue.length) {
                const rootPixel = queue.pop();
                const x = rootPixel.x;
                const y = rootPixel.y;
                if (rootPixel.element !== "root" && rootPixel.element !== "fiber") continue;
                changePixel(rootPixel, "dirt");
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (!dx && !dy) continue;
                        const other = getPixel(x + dx, y + dy);
                        if (!other || seen.has(other) || (other.element !== "root" && other.element !== "fiber")) continue;
                        seen.add(other);
                        queue.push(other);
                    }
                }
            }
        });

        for (let i = 0; i < currentPixels.length; i++) {
            const pixel = currentPixels[i];
            if (!pixel || pixel.del) continue;
            let descriptor = resourceDescriptor(pixel);
            if (!descriptor) continue;
            let tree = null;
            if (descriptor.kind === "wood" && Number.isFinite(pixel.treeId)) {
                tree = manager.treeById.get(pixel.treeId);
                if (!tree || tree.base !== pixel) continue;
                if (!treeIsHarvestable(tree)) continue;
                descriptor = Object.assign({}, descriptor, {yield: tree.woodYield, treeSapling: tree.seed, treeId: tree.id, wholeTree: true});
            }
            const node = {pixel, x: pixel.x, y: pixel.y, element: pixel.element, descriptor, kind: descriptor.kind, key: pixel.element + "@" + pixel.x + "," + pixel.y, tree};
            if (!manager.resourceIndex.has(descriptor.kind)) manager.resourceIndex.set(descriptor.kind, []);
            manager.resourceIndex.get(descriptor.kind).push(node);
            manager.resourceNodeByPixel.set(pixel, node);
        }
    }

    function registerWeapon(id, descriptor) {
        if (!id || !descriptor) return false;
        const normalized = Object.assign({id: id, damage: 5, range: 1, hitChance: 0.5, knockback: 1, cost: {}}, descriptor);
        normalized.cost = copyResourceCost(normalized.cost);
        manager.weapons.set(id, normalized);
        return true;
    }

    Object.keys(Core.WEAPONS || {}).forEach((weaponId) => registerWeapon(weaponId, Core.WEAPONS[weaponId]));

    function registerArmor(id, descriptor) {
        if (!id || !descriptor) return false;
        const normalized = Object.assign({id: id, bonusHp: 0, cost: {}}, descriptor);
        normalized.bonusHp = Math.max(0, safeNumber(descriptor.bonusHp, safeNumber(descriptor.hpBonus, 0)));
        normalized.cost = copyResourceCost(normalized.cost);
        manager.armors.set(id, normalized);
        return true;
    }

    const BUILTIN_ARMORS = Core.ARMORS || {
        none: {id: "none", bonusHp: 0, cost: {}},
        rattan: {id: "rattan", bonusHp: 100, cost: {wood: 4}},
        iron: {id: "iron", bonusHp: 220, cost: {iron: 4}},
        steel: {id: "steel", bonusHp: 420, cost: {steel: 4}}
    };
    Object.keys(BUILTIN_ARMORS).forEach((armorId) => registerArmor(armorId, BUILTIN_ARMORS[armorId]));

    function facilityBlueprint(core, cost, options) {
        const opts = options || {};
        return {
            cost: cost,
            core: core,
            width: 1,
            parts: [],
            hp: opts.hp || 140,
            color: opts.color,
            workRequired: opts.workRequired || Math.max(2, Math.ceil(Object.keys(cost || {}).reduce((sum, key) => sum + safeNumber(cost[key], 0), 0) / 4))
        };
    }

    const BLUEPRINTS = {
        hut: facilityBlueprint("civ_hut_core", {wood: 12}, {hp: 120, workRequired: 4}),
        workshop: facilityBlueprint("civ_workshop_core", {wood: 10, stone: 8}, {hp: 120, workRequired: 6}),
        farm: facilityBlueprint("civ_farm_marker", {wood: 4}, {hp: 60, workRequired: 2}),
        lumberyard: facilityBlueprint("civ_lumberyard_core", {wood: 4}, {hp: 100, workRequired: 2}),
        hearth: facilityBlueprint("civ_hearth_core", {wood: 6, stone: 2}, {width: 3, roof: false, hp: 80, color: "#b45f36"}),
        quarry: facilityBlueprint("civ_quarry_core", {wood: 8, stone: 12}, {width: 5, material: "civ_structure_stone", hp: 160, color: "#77756f"}),
        granary: facilityBlueprint("civ_granary_core", {wood: 14, stone: 6}, {width: 5, hp: 150, color: "#a77b42"}),
        kiln: facilityBlueprint("civ_kiln_core", {wood: 8, stone: 14}, {width: 5, material: "civ_structure_stone", hp: 170, color: "#835b45"}),
        foundry: facilityBlueprint("civ_foundry_core", {wood: 12, stone: 18}, {width: 5, material: "civ_structure_stone", hp: 190, color: "#6e625d"}),
        forge: facilityBlueprint("civ_forge_core", {wood: 10, stone: 22, iron: 2}, {width: 5, material: "civ_structure_stone", hp: 220, color: "#55545a"}),
        palisade: facilityBlueprint("civ_gate", {wood: 18}, {hp: 110, workRequired: 5}),
        watchtower: facilityBlueprint("civ_tower_core", {wood: 12, stone: 24, iron: 2}, {width: 5, material: "civ_structure_stone", hp: 260, color: "#66686b"}),
        keep: facilityBlueprint("civ_keep_core", {wood: 24, stone: 50, steel: 2}, {width: 7, material: "civ_structure_stone", hp: 420, color: "#62646a"}),
        siege_workshop: facilityBlueprint("civ_siege_workshop_core", {wood: 24, stone: 20, steel: 2}, {width: 7, material: "civ_structure_stone", hp: 260, color: "#71624f"}),
        library: facilityBlueprint("civ_library_core", {wood: 20, stone: 24}, {width: 7, material: "civ_structure_stone", hp: 220, color: "#786b58"}),
        market: facilityBlueprint("civ_market_core", {wood: 22, stone: 12}, {width: 7, hp: 190, color: "#9b714a"})
    };

    function hasStock(banner, cost) {
        if (!banner || !ensureStock(banner)) return false;
        return Object.keys(cost || {}).every((resource) => materialAmount(banner.stock, resource) >= (cost[resource] || 0));
    }

    function spendStock(banner, cost) {
        if (!hasStock(banner, cost)) return false;
        Object.keys(cost || {}).forEach((resource) => spendMaterial(banner.stock, resource, cost[resource] || 0));
        return true;
    }

    function refundStock(banner, refund) {
        if (!banner || !banner.stock || !refund) return;
        ensureStock(banner);
        Object.keys(refund).forEach((resource) => addMaterial(banner.stock, resource, refund[resource] || 0));
    }

    function solidGroundAt(x, y) {
        const below = pixelsAt(x, y + 1);
        return below.some((pixel) => pixel && elements[pixel.element] && elements[pixel.element].state === "solid" &&
            !(pixel.nonBlocking === true || elements[pixel.element].nonBlocking === true || (typeof isNonBlockingPixel === "function" && isNonBlockingPixel(pixel))) &&
            !(typeof isCreaturePixel === "function" && isCreaturePixel(pixel)) &&
            !(typeof isPassableVegetationPixel === "function" && isPassableVegetationPixel(pixel)));
    }

    function findSurfaceY(x, hintY) {
        const maxDelta = typeof height === "number" && Number.isFinite(height) ? Math.max(8, height) : 8;
        for (let delta = 0; delta <= maxDelta; delta++) {
            const ys = delta === 0 ? [hintY] : [hintY - delta, hintY + delta];
            for (let i = 0; i < ys.length; i++) {
                const y = ys[i];
                if (outOfBounds(x, y) || outOfBounds(x, y + 1)) continue;
                if (isEmpty(x, y) && solidGroundAt(x, y)) return y;
            }
        }
        return null;
    }

    function findNearbySurfaceTarget(preferredX, hintY, fallbackX, fallbackY) {
        for (let offset = 0; offset <= 6; offset++) {
            const xs = offset === 0 ? [preferredX] : [preferredX - offset, preferredX + offset];
            for (let i = 0; i < xs.length; i++) {
                const x = xs[i];
                if (outOfBounds(x, hintY)) continue;
                const y = findSurfaceY(x, hintY);
                if (y !== null) return {x, y};
            }
        }
        return {x: fallbackX, y: fallbackY};
    }

    function buildTargets(type, originX, originY) {
        const blueprint = BLUEPRINTS[type];
        if (!blueprint) return [];
        return [{x: originX, y: originY, element: blueprint.core, core: true}];
    }

    function buildingSpacingAvailable(originX, originY, ignoredBuildingId) {
        const candidate = {x: originX, y: originY};
        let valid = true;
        const inspect = (pixel) => {
            if (!valid || !isBuildingCorePixel(pixel) || pixel.buildingId === ignoredBuildingId) return;
            if (World.buildingSpacingValid ? !World.buildingSpacingValid(candidate, pixel, C.BUILDING_CORE_CLEARANCE) : Math.abs(pixel.x - originX) <= C.BUILDING_CORE_CLEARANCE && Math.abs(pixel.y - originY) <= C.BUILDING_CORE_CLEARANCE) valid = false;
        };
        manager.settlements.forEach(inspect);
        manager.constructionSites.forEach(inspect);
        manager.structures.forEach(inspect);
        return valid;
    }

    function validateBuildSite(type, originX, originY, factionId, allowUnownedCenter) {
        const blueprint = BLUEPRINTS[type];
        if (!blueprint) return false;
        if (outOfBounds(originX, originY) || outOfBounds(originX, originY + 1) || getBuildingCoreAt(originX, originY)) return false;
        if (!solidGroundAt(originX, originY)) return false;
        if (!buildingSpacingAvailable(originX, originY)) return false;
        const territory = ensureTerritoryIndex();
        const owner = territory && territory.ownerAt(originX);
        if (allowUnownedCenter) {
            if (owner !== null && owner !== undefined && Number(owner) !== Number(factionId)) return false;
        }
        else if (Number(owner) !== Number(factionId)) return false;
        return true;
    }

    function findBuildSite(banner, type) {
        const radius = C.BUILD_SEARCH_RADIUS;
        for (let distance = 1; distance <= radius; distance++) {
            const offsets = distance % 2 ? [distance, -distance] : [-distance, distance];
            for (let i = 0; i < offsets.length; i++) {
                let x = banner.x + offsets[i];
                const y = findSurfaceY(x, banner.y);
                if (y !== null && validateBuildSite(type, x, y, banner.factionId, false)) return {x: x, y: y};
            }
        }
        return null;
    }

    function createConstruction(banner, type) {
        const blueprint = BLUEPRINTS[type];
        const faction = banner && manager.factionById.get(banner.factionId);
        if (!blueprint || !hasStock(banner, blueprint.cost) || !canSpendAfterAdvancementReserve(faction, banner, blueprint.cost)) return null;
        const siteCoords = findBuildSite(banner, type);
        if (!siteCoords || getBuildingCoreAt(siteCoords.x, siteCoords.y)) return null;
        if (!spendStock(banner, blueprint.cost)) return null;
        createPixel("civ_construction", siteCoords.x, siteCoords.y);
        const site = pixelByElementAt(siteCoords.x, siteCoords.y, "civ_construction");
        if (!site || site.element !== "civ_construction") {
            refundStock(banner, blueprint.cost);
            return null;
        }
        site.factionId = banner.factionId;
        site.factionColor = banner.factionColor;
        site.settlementId = banner.settlementId;
        site.buildingId = manager.nextBuildingId++;
        site.blueprintType = type;
        site.originX = siteCoords.x;
        site.originY = siteCoords.y;
        site.nextPart = 0;
        site.blockedTicks = 0;
        site.lastBuildTick = pixelTicks;
        site.costs = Object.assign({}, blueprint.cost);
        site.placedParts = 0;
        site.workDone = 0;
        site.workRequired = blueprint.workRequired || 4;
        ensureBuildingMetadata(site, type);
        reserveBuildingTerritory(site);
        setPixelColor(site, banner.factionColor);
        registerPixel(site);
        logSettlementEvent(banner, "construction", "开始建造：" + type, {buildingId: site.buildingId, buildingType: type, x: site.x, y: site.y});
        return site;
    }

    function constructionRefund(site) {
        const blueprint = BLUEPRINTS[site.blueprintType];
        if (!blueprint) return {wood: 0, stone: 0};
        const total = Math.max(1, site.workRequired || blueprint.workRequired || 1);
        const placedRatio = Math.min(1, Math.max(0, safeNumber(site.workDone, site.placedParts || 0) / total));
        if (Core.constructionRefund) return Core.constructionRefund(site.costs || blueprint.cost, placedRatio);
        return {
            wood: Math.floor(((site.costs && site.costs.wood) || 0) * (1 - placedRatio) * 0.5),
            stone: Math.floor(((site.costs && site.costs.stone) || 0) * (1 - placedRatio) * 0.5)
        };
    }

    function fullConstructionRefund(site) {
        const blueprint = BLUEPRINTS[site.blueprintType];
        const costs = site.costs || blueprint && blueprint.cost || {};
        const refund = {};
        Object.keys(costs).forEach((resource) => {
            refund[resource] = Math.max(0, safeNumber(costs[resource], 0));
        });
        return refund;
    }

    function cancelConstruction(site, skipDelete, options) {
        if (!site || site.cancelled || site.completed) return;
        const opts = options || {};
        site.cancelled = true;
        if (opts.reason) site.cancellationReason = opts.reason;
        const banner = manager.settlementById.get(site.settlementId);
        refundStock(banner, opts.fullRefund ? fullConstructionRefund(site) : constructionRefund(site));
        unregisterPixel(site);
        if (!skipDelete && !site.del) deleteExactPixel(site);
    }

    function finishConstruction(site) {
        const blueprint = BLUEPRINTS[site.blueprintType];
        if (!blueprint || site.del) return null;
        const completedType = site.blueprintType;
        const data = {
            factionId: site.factionId,
            factionColor: site.factionColor,
            settlementId: site.settlementId,
            buildingId: site.buildingId,
            originX: site.originX,
            originY: site.originY
        };
        const claimData = {territoryClaimId: site.territoryClaimId, territoryClaimTick: site.territoryClaimTick, territoryClaimOrder: site.territoryClaimOrder};
        site.completed = true;
        changePixel(site, blueprint.core);
        const corePixel = site;
        Object.assign(corePixel, data);
        Object.assign(corePixel, claimData);
        ensureBuildingMetadata(corePixel, completedType);
        reserveBuildingTerritory(corePixel);
        if (blueprint.core === "civ_hut_core") {
            corePixel.structureHp = 120;
            corePixel.structureMaxHp = 120;
        }
        else if (blueprint.core === "civ_workshop_core") {
            corePixel.structureHp = 120;
            corePixel.structureMaxHp = 120;
            corePixel.lastCraftTick = pixelTicks;
        }
        else if (blueprint.core === "civ_farm_marker") {
            corePixel.structureHp = 60;
            corePixel.structureMaxHp = 60;
            corePixel.plots = [];
            const faction = manager.factionById.get(site.factionId);
            const plotCount = 5 + safeNumber(faction && faction.techModifiers && faction.techModifiers.farmPlots, 0);
            for (let i = 1; i <= plotCount; i++) {
                const plotX = corePixel.originX + i;
                const soil = getPixel(plotX, corePixel.originY + 1);
                if (!outOfBounds(plotX, corePixel.originY) && isEmpty(plotX, corePixel.originY) && soil && SOIL_ELEMENTS.has(soil.element)) {
                    corePixel.plots.push({x: plotX, y: corePixel.originY});
                }
            }
        }
        else {
            corePixel.structureHp = blueprint.hp || 140;
            corePixel.structureMaxHp = corePixel.structureHp;
            corePixel.lastProcessTick = pixelTicks;
        }
        setPixelColor(corePixel, data.factionColor);
        registerPixel(corePixel);
        const completedBanner = manager.settlementById.get(data.settlementId);
        if (completedBanner) {
            const research = ensureResearchState(completedBanner);
            research.milestones.buildingsCompleted = safeNumber(research.milestones.buildingsCompleted, 0) + 1;
            const completedFaction = manager.factionById.get(data.factionId);
            research.knowledge += 0.6 * safeNumber(completedFaction && completedFaction.techModifiers && completedFaction.techModifiers.milestoneKnowledge, 1);
            addDomainExperience(completedBanner, "construction", 0.5);
            logSettlementEvent(completedBanner, "building", "建筑完成：" + completedType, {buildingId: data.buildingId, buildingType: completedType, x: corePixel.x, y: corePixel.y});
        }
        return corePixel;
    }

    function advanceConstruction(site, builder) {
        if (!site || site.del || !builder || builder.del) return;
        const builderFaction = manager.factionById.get(builder.factionId);
        const buildInterval = Math.max(2, C.CONSTRUCTION_STEP_TICKS * safeNumber(builderFaction && builderFaction.techModifiers && builderFaction.techModifiers.buildSpeed, 1) / safeNumber(builderFaction && builderFaction.techModifiers && builderFaction.techModifiers.roleWorkSpeed, 1));
        if (pixelTicks - (site.lastBuildTick || 0) < buildInterval) return;
        const blueprint = BLUEPRINTS[site.blueprintType];
        if (!blueprint) return cancelConstruction(site);
        if (Core.distance(site.x, site.y, builder.x, builder.y) > 2.5) return;
        site.workDone = safeNumber(site.workDone, 0) + 1;
        site.placedParts = site.workDone;
        addPersonActivityMetrics(builder, {buildWork: 1});
        if (site.workDone >= (site.workRequired || blueprint.workRequired || 1)) {
            const completedBuildingId = site.buildingId;
            const completedBuildingType = site.blueprintType;
            if (finishConstruction(site)) clearTask(builder, "completed", "building_completed", {buildingId: completedBuildingId, buildingType: completedBuildingType});
            return;
        }
        site.blockedTicks = 0;
        site.lastBuildTick = pixelTicks;
        const buildBanner = manager.settlementById.get(site.settlementId);
        if (buildBanner) addDomainExperience(buildBanner, "construction", 0.03);
    }

    function createBannerForFaction(faction) {
        if (!faction || faction.adults.length < 2) return null;
        const candidateAdults = faction.settlements.length ? faction.adults.filter((actor) => {
            const nearest = faction.settlements.reduce((best, settlement) => Math.min(best, Core.distance(actor.x, actor.y, settlement.x, settlement.y)), Infinity);
            return nearest > C.FACTION_JOIN_RADIUS * 1.5;
        }) : faction.adults;
        if (candidateAdults.length < 2) return null;
        let pair = null;
        for (let i = 0; i < candidateAdults.length && !pair; i++) {
            const a = candidateAdults[i];
            if (!solidGroundAt(a.x, a.y)) continue;
            for (let j = i + 1; j < candidateAdults.length; j++) {
                const b = candidateAdults[j];
                if (!solidGroundAt(b.x, b.y)) continue;
                if (Core.distance(a.x, a.y, b.x, b.y) <= C.CAMP_GROUP_RADIUS) {
                    pair = [a, b];
                    break;
                }
            }
        }
        if (!pair) {
            manager.foundingSince.delete(faction.id);
            return null;
        }
        const foundingKey = faction.id + ":" + Math.floor((pair[0].x + pair[1].x) / (C.CAMP_GROUP_RADIUS * 2));
        if (!manager.foundingSince.has(foundingKey)) manager.foundingSince.set(foundingKey, pixelTicks);
        if (pixelTicks - manager.foundingSince.get(foundingKey) < C.CAMP_STABLE_TICKS) return null;
        const centerX = Math.round((pair[0].x + pair[1].x) / 2);
        const centerY = Math.round((pair[0].y + pair[1].y) / 2);
        let coords = null;
        for (let r = 0; r <= 4 && !coords; r++) {
            const xs = r === 0 ? [centerX] : [centerX - r, centerX + r];
            for (let i = 0; i < xs.length; i++) {
                const y = findSurfaceY(xs[i], centerY);
                if (y !== null && validateBuildSite("hut", xs[i], y, faction.id, true)) {
                    coords = {x: xs[i], y: y};
                    break;
                }
            }
        }
        if (!coords) return null;
        createPixel("civ_banner", coords.x, coords.y);
        const banner = pixelByElementAt(coords.x, coords.y, "civ_banner");
        if (!banner) return null;
        banner.factionId = faction.id;
        banner.factionColor = faction.color;
        banner.settlementId = manager.nextSettlementId++;
        banner.stock = {food: 0, wood: 0, stone: 0, materials: {}, seeds: {}};
        ensureStock(banner);
        const capital = faction.settlements[0];
        banner.eraId = capital ? capital.eraId : DEFAULT_ERA_ID;
        banner.research = capital ? ensureResearchState(capital) : undefined;
        ensureResearchState(banner);
        banner.diplomacy = {};
        banner.housing = 4;
        // Founding stability already acts as the initial waiting period. Let a
        // new settlement reproduce as soon as it has two healthy adults, room,
        // and the reduced food cost; subsequent births use the normal cooldown.
        banner.birthReadyTick = pixelTicks;
        banner.territoryRadius = C.TERRITORY_BASE_RADIUS;
        banner.stage = "camp";
        banner.lastBirthTick = Math.max(-1000000, pixelTicks - C.BIRTH_COOLDOWN);
        banner.lastHostileTick = Math.max(-1000000, pixelTicks - 1000);
        banner.structureHp = 120;
        banner.structureMaxHp = 120;
        banner.foundedTick = pixelTicks;
        banner.townCenterActive = true;
        ensureBuildingMetadata(banner, "town_center");
        reserveBuildingTerritory(banner);
        ensureChronicle(banner);
        logSettlementEvent(banner, "settlement", "聚落形成并建立城镇中心", {settlementId: banner.settlementId, buildingId: banner.buildingId, x: banner.x, y: banner.y});
        setPixelColor(banner, faction.color);
        registerPixel(banner);
        for (let i = 0; i < faction.actors.length; i++) {
            if (!faction.settlements.length || Core.distance(faction.actors[i].x, faction.actors[i].y, banner.x, banner.y) <= C.FACTION_JOIN_RADIUS) faction.actors[i].settlementId = banner.settlementId;
        }
        manager.foundingSince.delete(foundingKey);
        return banner;
    }

    function addRequirement(requirements, resource, amount) {
        if (!resource || !(amount > 0)) return;
        requirements[resource] = safeNumber(requirements[resource], 0) + safeNumber(amount, 0);
    }

    function requireMinimum(requirements, resource, minimum) {
        if (!resource || !(minimum > 0)) return;
        requirements[resource] = Math.max(safeNumber(requirements[resource], 0), safeNumber(minimum, 0));
    }

    function addCostRequirement(requirements, cost, refundableCost) {
        Object.keys(cost || {}).forEach((resource) => {
            addRequirement(requirements, resource, Math.max(0, safeNumber(cost[resource], 0) - safeNumber(refundableCost && refundableCost[resource], 0)));
        });
    }

    function pendingTechnologyRequirements(faction, banner, requirements) {
        const currentEraIndex = eraIndexFor(banner);
        allTechnologies().forEach((tech) => {
            if (!tech || hasTech(banner, tech.id) || safeNumber(tech.eraIndex, ERA_INDEX.get(techEraId(tech)) || 0) > currentEraIndex) return;
            (tech.conditions || []).forEach((condition) => {
                if (condition.type === "resource_stock") requireMinimum(requirements, condition.resource, condition.minimum);
                else if (condition.type === "heat_available") {
                    const woodHeat = Math.max(1, safeNumber(FUEL_VALUES.wood, 1));
                    requireMinimum(requirements, "wood", Math.ceil(safeNumber(condition.minimum, 0) / woodHeat));
                }
            });
        });
    }

    function pendingConstructionRequirements(faction, banner, requirements) {
        if (!faction || !banner || banner.townCenterActive === false) return;
        const local = (list) => (list || []).filter((building) => building && !building.del && building.settlementId === banner.settlementId);
        const pendingTypes = new Set((faction.constructionSites || []).filter((site) => site && !site.del && site.settlementId === banner.settlementId).map((site) => site.blueprintType));
        const eraTarget = Core.eraPopulationTarget ? Core.eraPopulationTarget(eraIndexFor(faction)) : (World.populationTarget ? World.populationTarget(eraIndexFor(faction)) : 6);
        const desired = [];
        if (banner.housing < Math.min(eraTarget, safeNumber(banner.population, 0) + 2)) desired.push("hut");
        [
            ["lumberyard", faction.lumberyards], ["hearth", faction.hearths], ["workshop", faction.workshops],
            ["quarry", faction.quarries], ["foundry", faction.foundries], ["kiln", faction.kilns], ["forge", faction.forges]
        ].forEach((entry) => {
            if (!local(entry[1]).length) desired.push(entry[0]);
        });
        desired.forEach((type) => {
            if (pendingTypes.has(type) || !unlockedBuilding(faction, type) || !BLUEPRINTS[type]) return;
            addCostRequirement(requirements, BLUEPRINTS[type].cost);
        });
    }

    function settlementSoldierEquipmentTargets(faction, banner) {
        if (!faction || !banner) return {soldiers: [], weaponTargets: [], armorTarget: "none"};
        const soldiers = (faction.adults || []).filter(actorIsSoldier).sort((a, b) => a.humanId - b.humanId);
        return {
            soldiers,
            weaponTargets: resolvedEraWeaponTargets(faction, banner.eraId || faction.eraId || DEFAULT_ERA_ID, soldiers.length),
            armorTarget: resolvedEraArmorTarget(faction, banner.eraId || faction.eraId || DEFAULT_ERA_ID)
        };
    }

    function pendingWeaponRequirements(faction, banner, requirements) {
        const targets = settlementSoldierEquipmentTargets(faction, banner);
        targets.soldiers.forEach((actor, index) => {
            if (actor.settlementId !== banner.settlementId) return;
            migrateActorEquipment(actor);
            const desired = targets.weaponTargets[index] || "fists";
            if (actor.weapon === desired || desired === "fists") return;
            const descriptor = weaponDescriptor(desired);
            addCostRequirement(requirements, descriptor && descriptor.cost, actor.weaponPaidCost);
        });
    }

    function pendingArmorRequirements(faction, banner, requirements) {
        const targets = settlementSoldierEquipmentTargets(faction, banner);
        targets.soldiers.forEach((actor) => {
            if (actor.settlementId !== banner.settlementId) return;
            migrateActorEquipment(actor);
            if (actor.armor === targets.armorTarget || targets.armorTarget === "none") return;
            const descriptor = armorDescriptor(targets.armorTarget);
            addCostRequirement(requirements, descriptor && descriptor.cost, actor.armorPaidCost);
        });
    }

    function pendingEquipmentRequirements(faction, banner, requirements) {
        if (!faction || !banner) return;
        pendingWeaponRequirements(faction, banner, requirements);
        pendingArmorRequirements(faction, banner, requirements);
    }

    function localBuildingExists(faction, banner, listName, blueprintType) {
        if ((faction && faction[listName] || []).some((building) => building && !building.del && building.settlementId === banner.settlementId)) return true;
        return (faction && faction.constructionSites || []).some((site) => site && !site.del && site.settlementId === banner.settlementId && site.blueprintType === blueprintType);
    }

    function addMilitaryIndustryRequirements(faction, banner, equipmentRequirements, requirements, includedFacilities) {
        if (!faction || !banner) return;
        const requiredFacilities = [];
        if (safeNumber(equipmentRequirements.steel, 0) > materialAmount(banner.stock, "steel")) requiredFacilities.push(["forge", "forges"], ["kiln", "kilns"], ["foundry", "foundries"]);
        else if (safeNumber(equipmentRequirements.iron, 0) > materialAmount(banner.stock, "iron")) requiredFacilities.push(["kiln", "kilns"], ["foundry", "foundries"]);
        else if (safeNumber(equipmentRequirements.bronze, 0) > materialAmount(banner.stock, "bronze")) requiredFacilities.push(["foundry", "foundries"]);
        const included = includedFacilities || new Set();
        requiredFacilities.forEach((entry) => {
            const type = entry[0];
            if (included.has(type) || !unlockedBuilding(faction, type) || localBuildingExists(faction, banner, entry[1], type) || !BLUEPRINTS[type]) return;
            included.add(type);
            addCostRequirement(requirements, BLUEPRINTS[type].cost);
        });
    }

    function recipeProducing(resource) {
        const recipeIds = Object.keys(TechData.RECIPES || {});
        for (let i = 0; i < recipeIds.length; i++) {
            const recipe = TechData.RECIPES[recipeIds[i]];
            const output = recipe && (recipe.outputs || []).find((entry) => entry.resource === resource);
            if (output) return {recipe, output};
        }
        return null;
    }

    function expandGatheringRequirements(stock, requirements) {
        const available = {};
        STOCK_KEYS.concat(MATERIAL_KEYS).forEach((resource) => { available[resource] = materialAmount(stock, resource); });
        const raw = {food: 0, wood: 0, stone: 0, copper: 0, raw_iron: 0};
        const resolving = new Set();
        const requireResource = (resource, amount) => {
            let remaining = Math.max(0, safeNumber(amount, 0));
            const used = Math.min(remaining, Math.max(0, safeNumber(available[resource], 0)));
            available[resource] = Math.max(0, safeNumber(available[resource], 0) - used);
            remaining -= used;
            if (!(remaining > 0)) return;
            const producer = recipeProducing(resource);
            if (producer && !resolving.has(resource)) {
                resolving.add(resource);
                const batches = Math.ceil(remaining / Math.max(1, safeNumber(producer.output.amount, 1)));
                (producer.recipe.inputs || []).forEach((input) => requireResource(input.resource, input.amount * batches));
                if (producer.recipe.heat > 0) {
                    const woodHeat = Math.max(1, safeNumber(FUEL_VALUES.wood, 1));
                    requireResource("wood", Math.ceil(producer.recipe.heat * batches / woodHeat));
                }
                resolving.delete(resource);
                return;
            }
            if (Object.prototype.hasOwnProperty.call(raw, resource)) raw[resource] += remaining;
        };
        Object.keys(requirements || {}).forEach((resource) => requireResource(resource, requirements[resource]));
        return raw;
    }

    function settlementGatheringDemand(faction, banner) {
        if (!banner) return {food: 1, wood: 0, stone: 0, copper: 0, raw_iron: 0};
        ensureStock(banner);
        const requirements = {};
        const localPopulation = Math.max(0, safeNumber(banner.population, faction && faction.population));
        const eraTarget = Core.eraPopulationTarget ? Core.eraPopulationTarget(eraIndexFor(faction)) : (World.populationTarget ? World.populationTarget(eraIndexFor(faction)) : 6);
        addRequirement(requirements, "food", Math.max(0, eraTarget - localPopulation) * C.BIRTH_FOOD_COST);
        requireMinimum(requirements, "wood", smeltingWoodReserveFor(banner));
        if (resourceUnlockedForFaction(faction, "stone")) requireMinimum(requirements, "stone", 2);
        pendingTechnologyRequirements(faction, banner, requirements);
        pendingEquipmentRequirements(faction, banner, requirements);
        const advancement = eraAdvancementState(faction, banner);
        if (!advancement.finalEra) addCostRequirement(requirements, advancement.cost);
        pendingConstructionRequirements(faction, banner, requirements);
        const raw = expandGatheringRequirements(banner.stock, requirements);
        banner.resourceDemand = Object.assign({}, raw);
        return raw;
    }

    function preferredResourceKind(faction, banner, allowedKinds) {
        if (!banner) return "food";
        const demand = settlementGatheringDemand(faction, banner);
        const allowed = new Set(allowedKinds && allowedKinds.length ? allowedKinds : ["food", "wood", "stone", "copper", "raw_iron"]);
        const candidates = Object.keys(demand).filter((kind) => allowed.has(kind) && resourceUnlockedForFaction(faction, kind) && (manager.resourceIndex.get(kind) || []).length)
            .sort((a, b) => safeNumber(demand[b], 0) - safeNumber(demand[a], 0));
        if (candidates.length && safeNumber(demand[candidates[0]], 0) > 0) return candidates[0];
        return ["wood", "stone", "food", "copper", "raw_iron"].find((kind) => allowed.has(kind) && resourceUnlockedForFaction(faction, kind) && (manager.resourceIndex.get(kind) || []).length) || "food";
    }

    function mergeRequirements(target, source) {
        Object.keys(source || {}).forEach((resource) => addRequirement(target, resource, source[resource]));
        return target;
    }

    function settlementMiningPriorityTiers(faction, banner) {
        const cumulative = {};
        const previousRaw = {stone: 0, copper: 0, raw_iron: 0};
        const tiers = [];
        const plannedMilitaryFacilities = new Set();
        const addTier = (reason, requirements) => {
            mergeRequirements(cumulative, requirements);
            const raw = expandGatheringRequirements(banner.stock, cumulative);
            const amounts = {};
            MINEABLE_RESOURCE_KINDS.forEach((kind) => {
                amounts[kind] = Math.max(0, safeNumber(raw[kind], 0) - safeNumber(previousRaw[kind], 0));
                previousRaw[kind] = Math.max(safeNumber(previousRaw[kind], 0), safeNumber(raw[kind], 0));
            });
            if (MINEABLE_RESOURCE_KINDS.some((kind) => amounts[kind] > 0)) tiers.push({reason, amounts, original: Object.assign({}, amounts)});
        };

        const weaponRequirements = {};
        pendingWeaponRequirements(faction, banner, weaponRequirements);
        addMilitaryIndustryRequirements(faction, banner, weaponRequirements, weaponRequirements, plannedMilitaryFacilities);
        addTier("military_weapons", weaponRequirements);

        const armorRequirements = {};
        pendingArmorRequirements(faction, banner, armorRequirements);
        addMilitaryIndustryRequirements(faction, banner, armorRequirements, armorRequirements, plannedMilitaryFacilities);
        addTier("military_armor", armorRequirements);

        const advancement = eraAdvancementState(faction, banner);
        const advancementRequirements = {};
        if (!advancement.finalEra) addCostRequirement(advancementRequirements, advancement.cost);
        addTier("era_advancement", advancementRequirements);

        const technologyRequirements = {};
        pendingTechnologyRequirements(faction, banner, technologyRequirements);
        addTier("technology", technologyRequirements);

        const constructionRequirements = {};
        pendingConstructionRequirements(faction, banner, constructionRequirements);
        addTier("construction", constructionRequirements);

        const reserveRequirements = {};
        const reserves = MINING_RESERVES_BY_ERA[banner.eraId] || MINING_RESERVES_BY_ERA[DEFAULT_ERA_ID];
        MINEABLE_RESOURCE_KINDS.forEach((kind) => {
            if (resourceUnlockedForFaction(faction, kind)) requireMinimum(reserveRequirements, kind, safeNumber(reserves && reserves[kind], 0));
        });
        addTier("safety_reserve", reserveRequirements);
        return {tiers, reserves: Object.assign({}, reserves || {}), rawDemand: Object.assign({}, previousRaw)};
    }

    function subtractMiningCommitment(tiers, kind, amount) {
        let remaining = Math.max(0, safeNumber(amount, 0));
        for (let index = 0; index < tiers.length && remaining > 0; index++) {
            const tier = tiers[index];
            const used = Math.min(remaining, Math.max(0, safeNumber(tier.amounts[kind], 0)));
            tier.amounts[kind] -= used;
            remaining -= used;
        }
    }

    function firstMiningReason(tiers, kind) {
        const tier = tiers.find((candidate) => safeNumber(candidate.amounts[kind], 0) > 0);
        return tier ? tier.reason : "safety_reserve";
    }

    function carriedMiningAmounts(actor) {
        const result = {stone: 0, copper: 0, raw_iron: 0};
        const carry = ensureActorCarry(actor);
        MINEABLE_RESOURCE_KINDS.forEach((kind) => { result[kind] = Math.max(0, safeNumber(carry[kind], 0)); });
        return result;
    }

    function activeMinerResourceKind(actor, faction) {
        if (!actor || actor.role !== "miner") return null;
        const carried = carriedMiningAmounts(actor);
        const carryingKind = MINEABLE_RESOURCE_KINDS.find((kind) => carried[kind] > 0);
        if (carryingKind) return carryingKind;
        const tripKind = actor.workTrip && actor.workTrip.resourceKind;
        if (MINEABLE_RESOURCE_KINDS.includes(tripKind) && resourceUnlockedForFaction(faction, tripKind) && ["harvest", "search_resource", "deliver", "planning"].includes(actor.task)) return tripKind;
        if (actor.task === "search_resource" && MINEABLE_RESOURCE_KINDS.includes(actor.targetKind) && resourceUnlockedForFaction(faction, actor.targetKind)) return actor.targetKind;
        return null;
    }

    function miningNodeAvailability(actor, kind) {
        let count = 0;
        let nearestDistance = Infinity;
        const nodes = manager.resourceIndex.get(kind) || [];
        for (let index = 0; index < nodes.length; index++) {
            const node = nodes[index];
            if (!node || !node.pixel || node.pixel.del || pixelsAt(node.x, node.y).indexOf(node.pixel) === -1) continue;
            const owner = manager.territory && manager.territory.ownerAt(node.x);
            if (owner !== null && owner !== undefined && owner !== actor.factionId) continue;
            const reservedBy = manager.resourceReservations && manager.resourceReservations.reservedBy(node);
            if (reservedBy !== undefined && reservedBy !== actor.humanId) continue;
            count++;
            nearestDistance = Math.min(nearestDistance, Core.distance(actor.x, actor.y, node.x, node.y));
        }
        return {count, nearestDistance};
    }

    function planSettlementMiners(faction, banner) {
        if (!faction || !banner) return;
        const miners = (faction.adults || []).filter((actor) => actor && !actor.del && !actor.dead && actor.role === "miner" && actor.settlementId === banner.settlementId).sort((a, b) => a.humanId - b.humanId);
        const priority = settlementMiningPriorityTiers(faction, banner);
        const tiers = priority.tiers;
        const incoming = {stone: 0, copper: 0, raw_iron: 0};
        (faction.adults || []).filter((actor) => actor && !actor.del && !actor.dead && actor.settlementId === banner.settlementId).forEach((actor) => {
            const carried = carriedMiningAmounts(actor);
            MINEABLE_RESOURCE_KINDS.forEach((kind) => { incoming[kind] += carried[kind]; });
        });

        const active = new Set();
        miners.forEach((actor) => {
            const kind = activeMinerResourceKind(actor, faction);
            if (!kind) return;
            active.add(actor);
            const reason = firstMiningReason(tiers, kind);
            const carried = carriedMiningAmounts(actor)[kind];
            const expected = carried > 0 || actor.task === "deliver" || actor.workTrip && actor.workTrip.returning ? 0 : Math.max(1, carryCapacityFor(actor) - carriedAmount(actor));
            incoming[kind] += expected;
            manager.minerAssignments.set(actor.humanId, {kind, reason, source: "active_trip", settlementId: banner.settlementId, plannedTick: pixelTicks});
        });
        MINEABLE_RESOURCE_KINDS.forEach((kind) => subtractMiningCommitment(tiers, kind, incoming[kind]));

        const nodeAllocations = {stone: 0, copper: 0, raw_iron: 0};
        const assignmentCounts = {stone: 0, copper: 0, raw_iron: 0};
        active.forEach((actor) => {
            const assignment = manager.minerAssignments.get(actor.humanId);
            if (assignment) assignmentCounts[assignment.kind]++;
        });
        miners.filter((actor) => !active.has(actor)).forEach((actor) => {
            let selected = null;
            for (let tierIndex = 0; tierIndex < tiers.length && !selected; tierIndex++) {
                const tier = tiers[tierIndex];
                const candidates = MINEABLE_RESOURCE_KINDS.map((kind, kindIndex) => {
                    const availability = resourceUnlockedForFaction(faction, kind) ? miningNodeAvailability(actor, kind) : {count: 0, nearestDistance: Infinity};
                    return {kind, kindIndex, availability, remaining: Math.max(0, safeNumber(tier.amounts[kind], 0)), original: Math.max(1, safeNumber(tier.original[kind], 0))};
                }).filter((candidate) => candidate.remaining > 0 && candidate.availability.count > nodeAllocations[candidate.kind]);
                candidates.sort((a, b) => b.remaining / b.original - a.remaining / a.original || a.availability.nearestDistance - b.availability.nearestDistance || a.kindIndex - b.kindIndex);
                if (candidates.length) selected = {kind: candidates[0].kind, reason: tier.reason, priority: tierIndex};
            }
            if (!selected) {
                const reserves = priority.reserves;
                const candidates = MINEABLE_RESOURCE_KINDS.map((kind, kindIndex) => {
                    const availability = resourceUnlockedForFaction(faction, kind) ? miningNodeAvailability(actor, kind) : {count: 0, nearestDistance: Infinity};
                    const target = Math.max(1, safeNumber(reserves[kind], 0));
                    return {kind, kindIndex, availability, fullness: (materialAmount(banner.stock, kind) + incoming[kind]) / target};
                }).filter((candidate) => candidate.availability.count > nodeAllocations[candidate.kind]);
                candidates.sort((a, b) => a.fullness - b.fullness || a.availability.nearestDistance - b.availability.nearestDistance || a.kindIndex - b.kindIndex);
                if (candidates.length) selected = {kind: candidates[0].kind, reason: "surplus_stock", priority: tiers.length};
            }
            if (!selected) return;
            manager.minerAssignments.set(actor.humanId, {kind: selected.kind, reason: selected.reason, source: "planned", priority: selected.priority, settlementId: banner.settlementId, plannedTick: pixelTicks});
            nodeAllocations[selected.kind]++;
            assignmentCounts[selected.kind]++;
            const capacity = carryCapacityFor(actor);
            incoming[selected.kind] += capacity;
            subtractMiningCommitment(tiers, selected.kind, capacity);
        });
        banner.miningPlan = {tick: pixelTicks, demand: priority.rawDemand, incoming, reserves: priority.reserves, assignments: assignmentCounts};
    }

    function planFactionMiners(faction) {
        if (!faction) return;
        manager.minerAssignments.forEach((assignment, humanId) => {
            const actor = manager.actorById.get(humanId);
            if (!actor || actor.dead || actor.del || actor.factionId === faction.id) manager.minerAssignments.delete(humanId);
        });
        (faction.settlements || []).forEach((banner) => planSettlementMiners(faction, banner));
    }

    function resourceUnlockedForFaction(faction, kind) {
        if (kind === "food" || kind === "wood" || kind === "stone" || kind === "sapling" || String(kind || "").indexOf(TREE_SAPLING_PREFIX) === 0) return true;
        if (!hasTechnologyData()) return true;
        if (kind === "copper" || kind === "raw_iron") return factionHasUnlock(faction, "resource", kind);
        return true;
    }

    function actorCanOccupyAt(actor, x, y) {
        if (!actor || outOfBounds(x, y - 1) || outOfBounds(x, y)) return false;
        if (typeof canCreatureOccupy === "function") {
            if (!canCreatureOccupy(actor, x, y, actor._r)) return false;
            const head = getBodyHead(actor) || {element: "civ_head", factionId: actor.factionId, humanId: actor.humanId};
            if (!canCreatureOccupy(head, x, y - 1, actor._r)) return false;
        }
        else {
            const bodySpot = getPixel(x, y);
            const headSpot = getPixel(x, y - 1);
            if (bodySpot && bodySpot.humanId !== actor.humanId) return false;
            if (headSpot && headSpot.humanId !== actor.humanId) return false;
        }
        return true;
    }

    function actorCanStandAt(actor, x, y) {
        return actorCanOccupyAt(actor, x, y) && solidGroundAt(x, y);
    }

    function excavationPositionPossible(actor, x, y) {
        if (!actor || outOfBounds(x, y) || outOfBounds(x, y - 1)) return false;
        const cells = [pixelsAt(x, y), pixelsAt(x, y - 1)];
        return cells.every((pixels) => pixels.every((pixel) => {
            if (!pixel || pixel.del || pixel._r === actor._r) return true;
            if (typeof pixelsCanOverlap === "function" && pixelsCanOverlap({element: "civ_body", factionId: actor.factionId, humanId: actor.humanId}, pixel)) return true;
            return canTunnelPixel(pixel, actor, false);
        }));
    }

    function highApproachHasSupport(actor, x, y) {
        if (y >= actor.y) return true;
        for (let scanY = actor.y; scanY >= y; scanY--) {
            if (hasInternalClimbSupport(actor, x, scanY) || climbSupportAt(actor, x, scanY, -1) || climbSupportAt(actor, x, scanY, 1)) continue;
            if (scanY === actor.y && actorCanStandAt(actor, x, scanY)) continue;
            return false;
        }
        return true;
    }

    function harvestApproach(actor, resource) {
        const candidates = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = resource.x + dx;
                const y = resource.y + dy;
                if (Core.distance(x, y, resource.x, resource.y) > 1.5) continue;
                const standing = actorCanStandAt(actor, x, y);
                if (!standing && !excavationPositionPossible(actor, x, y)) continue;
                if (y < actor.y && !highApproachHasSupport(actor, x, y)) continue;
                candidates.push({x: x, y: y, distance: Core.distance(actor.x, actor.y, x, y), standing: standing});
            }
        }
        candidates.sort((a, b) => Number(b.standing) - Number(a.standing) || a.distance - b.distance);
        return candidates[0] || null;
    }

    function setHarvestTask(actor, found) {
        if (!found || !found.pixel || !found.approach) {
            clearTask(actor, "failed", "invalid_resource_target");
            return false;
        }
        const previousKey = actor.targetKey;
        const previousApproachX = actor.targetX;
        const previousApproachY = actor.targetY;
        setTask(actor, "harvest", found.pixel);
        actor.harvestX = found.pixel.x;
        actor.harvestY = found.pixel.y;
        actor.targetX = found.approach.x;
        actor.targetY = found.approach.y;
        const descriptor = found.descriptor || resourceDescriptor(found.pixel);
        const resourceKind = descriptor && descriptor.kind || actor.targetKind;
        if (!actor.workTrip || actor.workTrip.resourceKind !== resourceKind || actor.workTrip.returning) {
            actor.workTrip = {
                version: 1,
                resourceKind: resourceKind,
                trail: [[actor.x, actor.y]],
                surfaceAnchorIndex: solidGroundAt(actor.x, actor.y) ? 0 : null,
                phase: "outbound",
                returning: false,
                resuming: false,
                startedTick: pixelTicks
            };
            recordPersonLifeEvent(actor, "route_created", {phase: "outbound", resourceKind: resourceKind, targetX: actor.targetX, targetY: actor.targetY});
        }
        actor.workTrip.excavationFrontier = {x: actor.targetX, y: actor.targetY, harvestX: actor.harvestX, harvestY: actor.harvestY, targetKind: actor.targetKind};
        const reservationKey = found.key || (found.pixel.element + "@" + found.pixel.x + "," + found.pixel.y);
        const reservationTarget = found.key ? found : Object.assign({}, found, {
            key: reservationKey,
            element: found.pixel.element,
            x: found.pixel.x,
            y: found.pixel.y
        });
        if (manager.resourceReservations && !manager.resourceReservations.reserve(reservationTarget, actor.humanId)) {
            clearTask(actor, "interrupted", "resource_reserved_by_other");
            return false;
        }
        actor.reservedResourceKey = reservationKey;
        if (previousKey === actor.targetKey && (previousApproachX !== actor.targetX || previousApproachY !== actor.targetY)) {
            actor.stuckCount = 0;
            actor.noProgressCount = 0;
            actor.bestTaskDistance = undefined;
        }
        return true;
    }

    function resourceFailureKey(x, y, element) {
        return x + "," + y + ":" + (element || "");
    }

    function blockFailedResource(actor, x, y, element) {
        if (!actor || !Number.isFinite(x) || !Number.isFinite(y)) return;
        actor.blockedResourceKey = resourceFailureKey(x, y, element);
        actor.blockedResourceUntil = pixelTicks + RESOURCE_FAILURE_COOLDOWN;
        if (element === "rotten_meat") {
            actor.blockedResourceCategory = "rotten_meat";
            actor.blockedResourceCategoryUntil = pixelTicks + ROTTEN_MEAT_FAILURE_COOLDOWN;
        }
    }

    function findResource(actor, wantedKind) {
        const banner = settlementForActor(actor);
        if (!banner) return null;
        const faction = manager.factionById.get(actor.factionId);
        if (!resourceUnlockedForFaction(faction, wantedKind)) return null;
        if ((wantedKind === "copper" || wantedKind === "raw_iron") && actor.role !== "miner") return null;
        const nodes = (manager.resourceIndex.get(wantedKind) || []).filter((node) => {
            if (!node.pixel || node.pixel.del || pixelsAt(node.x, node.y).indexOf(node.pixel) === -1) return false;
            if (pixelTicks < safeNumber(actor.blockedResourceUntil, 0) && actor.blockedResourceKey === resourceFailureKey(node.x, node.y, node.element)) return false;
            if (node.element === "rotten_meat" && actor.blockedResourceCategory === "rotten_meat" && pixelTicks < safeNumber(actor.blockedResourceCategoryUntil, 0)) return false;
            return true;
        });
        const ordered = nodes.slice().sort((a, b) => {
            const ownerA = manager.territory && manager.territory.ownerAt(a.x);
            const ownerB = manager.territory && manager.territory.ownerAt(b.x);
            const zoneA = ownerA === actor.factionId ? 0 : (ownerA === null || ownerA === undefined ? 1 : 2);
            const zoneB = ownerB === actor.factionId ? 0 : (ownerB === null || ownerB === undefined ? 1 : 2);
            const fallbackA = a.element === "rotten_meat" ? 1 : 0;
            const fallbackB = b.element === "rotten_meat" ? 1 : 0;
            return zoneA - zoneB || fallbackA - fallbackB || Core.distance(actor.x, actor.y, a.x, a.y) - Core.distance(actor.x, actor.y, b.x, b.y);
        });
        for (let i = 0; i < ordered.length; i++) {
            const node = ordered[i];
            const owner = manager.territory && manager.territory.ownerAt(node.x);
            if (owner !== null && owner !== undefined && owner !== actor.factionId) continue;
            if (manager.resourceReservations && manager.resourceReservations.reservedBy(node) !== undefined && manager.resourceReservations.reservedBy(node) !== actor.humanId) continue;
            const approach = harvestApproach(actor, node.pixel);
            if (!approach) continue;
            recordDiscovery(banner, node.descriptor.kind, 0.05);
            if (node.descriptor.seed || node.descriptor.seedOnly) recordDiscovery(banner, "seed", 0.05);
            if (node.descriptor.treeSeed || node.descriptor.treeSapling) recordDiscovery(banner, "tree_seed", 0.05);
            return Object.assign({}, node, {foreignOwner: null, approach});
        }
        return null;
    }

    function carriedAmount(actor) {
        if (World.carriedTotal) return World.carriedTotal(actor);
        return Math.max(0, safeNumber(actor.carryAmount, 0)) + (actor.carrySeed ? 1 : 0);
    }

    function carryCapacityFor(actor) {
        const faction = actor && manager.factionById.get(actor.factionId);
        return Math.max(C.BASE_CARRY_CAPACITY, safeNumber(faction && faction.techModifiers && faction.techModifiers.carryCapacity, C.BASE_CARRY_CAPACITY));
    }

    function ensureActorCarry(actor) {
        if (World.ensureBackpack) World.ensureBackpack(actor, carryCapacityFor(actor));
        else if (!actor.carry || typeof actor.carry !== "object") actor.carry = {};
        if (actor.carryKind && actor.carryAmount > 0) {
            actor.carry[actor.carryKind] = safeNumber(actor.carry[actor.carryKind], 0) + actor.carryAmount;
            actor.carryKind = null;
            actor.carryAmount = 0;
        }
        if (actor.carrySeed) {
            const seedKey = "seed:" + actor.carrySeed;
            actor.carry[seedKey] = safeNumber(actor.carry[seedKey], 0) + 1;
            actor.carrySeed = null;
        }
        return actor.carry;
    }

    function buildingsForSettlement(faction, settlementId, listName) {
        return (faction && faction[listName] || []).filter((building) => !building.del && building.settlementId === settlementId);
    }

    function deliveryDestination(actor, kind) {
        const banner = settlementForActor(actor);
        const faction = actor && manager.factionById.get(actor.factionId);
        if (!banner || !faction) return banner;
        const seed = String(kind || "").indexOf("seed:") === 0;
        const treeSapling = String(kind || "").indexOf(TREE_SAPLING_PREFIX) === 0;
        const key = treeSapling ? kind.slice(TREE_SAPLING_PREFIX.length) : (seed ? kind.slice(5) : kind);
        let lists = [];
        if (treeSapling) lists = ["lumberyards"];
        else if (seed || key === "food") lists = [];
        else if (key === "wood") lists = ["lumberyards"];
        else if (key === "stone") lists = ["quarries"];
        else if (key === "copper") lists = ["foundries", "quarries"];
        else if (key === "raw_iron") lists = ["kilns", "quarries"];
        else if (key === "bronze") lists = ["foundries"];
        else if (key === "iron") lists = ["kilns"];
        else if (key === "steel") lists = ["forges"];
        for (let i = 0; i < lists.length; i++) {
            const facilities = buildingsForSettlement(faction, banner.settlementId, lists[i]);
            if (facilities.length) return facilities.sort((a, b) => Core.distance(actor.x, actor.y, a.x, a.y) - Core.distance(actor.x, actor.y, b.x, b.y))[0];
        }
        return banner;
    }

    function deliverCarry(actor, requestedDestination) {
        const banner = settlementForActor(actor);
        const carry = ensureActorCarry(actor);
        const firstKind = Object.keys(carry).find((kind) => carry[kind] > 0);
        const destination = requestedDestination && isBuildingCorePixel(requestedDestination) ? requestedDestination : deliveryDestination(actor, firstKind);
        if (!banner || !destination || Core.distance(actor.x, actor.y, destination.x, destination.y) > 2.5) return false;
        ensureStock(banner);
        ensureChronicle(banner);
        const delivered = {};
        Object.keys(carry).forEach((kind) => {
            const amount = Math.max(0, safeNumber(carry[kind], 0));
            if (!amount) return;
            delivered[kind] = amount;
            if (kind.indexOf(TREE_SAPLING_PREFIX) === 0) {
                const seed = kind.slice(TREE_SAPLING_PREFIX.length);
                banner.stock.treeSaplings[seed] = safeNumber(banner.stock.treeSaplings[seed], 0) + amount;
                banner.stock.sapling = treeSaplingTotal(banner.stock);
                if (!banner.firstNaturalResources[kind]) {
                    banner.firstNaturalResources[kind] = true;
                    logSettlementEvent(banner, "first_resource", "首次采集树苗资源：" + seed, {resource: kind, amount});
                }
                return;
            }
            if (kind.indexOf("seed:") === 0) {
                addMaterial(banner.stock, "food", amount);
                return;
            }
            addMaterial(banner.stock, kind, amount, actor.carryElement);
            const research = ensureResearchState(banner);
            research.discoveries[kind] = Math.max(1, safeNumber(research.discoveries[kind], 0) + amount);
            research.milestones.resourceDeliveries = safeNumber(research.milestones.resourceDeliveries, 0) + 1;
            const faction = manager.factionById.get(actor.factionId);
            if (factionHasFeature(faction, "deliveryKnowledge")) research.knowledge += 0.5;
            if (!banner.firstNaturalResources[kind]) {
                banner.firstNaturalResources[kind] = true;
                logSettlementEvent(banner, "first_resource", "首次采集资源：" + kind, {resource: kind, amount});
            }
        });
        Object.keys(carry).forEach((kind) => { delete carry[kind]; });
        actor.carryKind = null;
        actor.carryElement = null;
        actor.carryAmount = 0;
        actor.carrySeed = null;
        ensureStock(banner);
        const deliveringFaction = manager.factionById.get(actor.factionId);
        if (deliveringFaction) reconcileFactionEquipment(deliveringFaction);
        addPersonActivityMetrics(actor, {resourcesDelivered: delivered});
        const resume = actor.resumeAfterDelivery;
        const completedTrip = actor.workTrip;
        delete actor.resumeAfterDelivery;
        actor.preserveWorkTrip = !!(resume && resume.resourceKind);
        clearTask(actor, "completed", "resources_delivered", {destinationBuildingId: destination.buildingId || null, destinationType: destination.buildingType || destination.element, destinationX: destination.x, destinationY: destination.y});
        actor.lastDeliveryTick = pixelTicks;
        recordPersonLifeEvent(actor, "resources_unloaded", {destinationBuildingId: destination.buildingId || null, delivered: delivered});
        if (resume && resume.resourceKind) {
            actor.workTrip = completedTrip || {version: 1, resourceKind: resume.resourceKind};
            actor.workTrip.resourceKind = resume.resourceKind;
            actor.workTrip.phase = "resume";
            actor.workTrip.resuming = true;
            actor.workTrip.returning = false;
            actor.workTrip.trail = [[actor.x, actor.y]];
            actor.workTrip.surfaceAnchorIndex = solidGroundAt(actor.x, actor.y) ? 0 : null;
            let found = null;
            if (Number.isFinite(resume.harvestX) && Number.isFinite(resume.harvestY)) {
                const pixel = pixelsAt(resume.harvestX, resume.harvestY).find((candidate) => resourceDescriptor(candidate));
                const descriptor = resourceDescriptor(pixel);
                const approach = pixel && descriptor && descriptor.kind === resume.resourceKind ? harvestApproach(actor, pixel) : null;
                if (pixel && descriptor && approach) found = {pixel: pixel, descriptor: descriptor, x: pixel.x, y: pixel.y, key: pixel.element + "@" + pixel.x + "," + pixel.y, approach: approach};
            }
            if (!found) found = findResource(actor, resume.resourceKind);
            if (found && setHarvestTask(actor, found)) {
                actor.workTrip.phase = "resume";
                actor.workTrip.resuming = true;
                return true;
            }
            delete actor.workTrip;
        }
        if (resume && resume.task && resume.task !== "deliver" && resume.task !== "harvest" && resume.task !== "planning") {
            setTask(actor, resume.task, {x: resume.targetX, y: resume.targetY, kind: resume.targetKind});
            actor.targetId = resume.targetId;
            actor.targetKind = resume.targetKind;
            actor.harvestX = resume.harvestX;
            actor.harvestY = resume.harvestY;
        }
        return true;
    }

    function resourceDropElement(kind, sourceElement) {
        if (sourceElement === "civ_tree_sapling_resource" || String(kind || "").indexOf(TREE_SAPLING_PREFIX) === 0) return "civ_tree_sapling_resource";
        if (String(kind || "").indexOf("seed:") === 0) return "civ_seed_resource";
        if (FALLING_RESOURCE_ELEMENTS[kind] && elements[FALLING_RESOURCE_ELEMENTS[kind]]) return FALLING_RESOURCE_ELEMENTS[kind];
        return elements.civ_resource_drop ? "civ_resource_drop" : (sourceElement && elements[sourceElement] ? sourceElement : null);
    }

    function queueResourceDrops(kind, sourceElement, amount, x, y, metadata) {
        const element = resourceDropElement(kind, sourceElement);
        const dropMetadata = Object.assign({}, metadata || {});
        if (String(kind || "").indexOf("seed:") === 0) dropMetadata.resourceSeed = String(kind).slice(5);
        if (String(kind || "").indexOf(TREE_SAPLING_PREFIX) === 0 && !dropMetadata.treeSapling) dropMetadata.treeSapling = String(kind).slice(TREE_SAPLING_PREFIX.length);
        if (element === "civ_resource_drop") dropMetadata.resourceMaterial = sourceElement || kind;
        let remaining = Math.max(0, Math.floor(amount));
        if (!element || !remaining) return;
        const pixelMetadata = Object.assign({_civResourceDrop: true, _civCollectible: true, resourceKind: kind}, dropMetadata);
        delete pixelMetadata.treeFellingBaseY;
        if (Number.isFinite(dropMetadata.treeFellingBaseY)) {
            const baseY = Number(dropMetadata.treeFellingBaseY);
            const horizontalLimit = typeof width === "number" && Number.isFinite(width) ? Math.max(4, width) : 64;
            for (let radius = 0; radius <= horizontalLimit && remaining; radius++) {
                const offsets = radius === 0 ? [0] : [-radius, radius];
                for (let i = 0; i < offsets.length && remaining; i++) {
                    const px = x + offsets[i];
                    if (outOfBounds(px, baseY) || !isEmpty(px, baseY)) continue;
                    const drop = createPixel(element, px, baseY, pixelMetadata);
                    if (!drop) continue;
                    Object.assign(drop, pixelMetadata);
                    remaining--;
                }
            }
        }
        else {
            for (let radius = 0; radius <= 4 && remaining; radius++) {
                for (let dx = -radius; dx <= radius && remaining; dx++) {
                    for (let dy = -radius; dy <= radius && remaining; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
                        const px = x + dx;
                        const py = y + dy;
                        if (!outOfBounds(px, py) && isEmpty(px, py)) {
                            const drop = createPixel(element, px, py, pixelMetadata);
                            if (!drop) continue;
                            Object.assign(drop, pixelMetadata);
                            remaining--;
                        }
                    }
                }
            }
        }
        if (remaining) manager.pendingResourceDrops.push({kind, element, amount: remaining, x, y, metadata: dropMetadata});
    }

    function getTreeAt(x, y) {
        const candidates = pixelsAt(Number(x), Number(y)).filter((pixel) => pixel && TREE_COMPONENT_ELEMENTS.has(pixel.element));
        for (let i = 0; i < candidates.length; i++) {
            const pixel = candidates[i];
            if (Number.isFinite(pixel.treeId) && manager.treeById.has(pixel.treeId)) return manager.treeById.get(pixel.treeId);
            if (Number.isFinite(pixel.civPlantedTreeId) && manager.treeById.has(pixel.civPlantedTreeId)) return manager.treeById.get(pixel.civPlantedTreeId);
            if (!pixel.treeLineage) continue;
            for (const tree of manager.treeById.values()) {
                if (tree && tree.lineage === pixel.treeLineage) return tree;
            }
        }
        return null;
    }

    function collectLiveTreePixels(tree) {
        if (!tree) return [];
        const knownPixels = new Set((tree.pixels || []).filter((pixel) => pixel && !pixel.del));
        const candidates = new Map();
        const exactMembers = [];
        for (let i = 0; i < currentPixels.length; i++) {
            const pixel = currentPixels[i];
            if (!pixel || pixel.del || !TREE_COMPONENT_ELEMENTS.has(pixel.element)) continue;
            candidates.set(pixel.x + "," + pixel.y, pixel);
            const sameTreeId = Number.isFinite(pixel.treeId) && pixel.treeId === tree.id;
            const samePlantedId = Number.isFinite(pixel.civPlantedTreeId) && pixel.civPlantedTreeId === tree.id;
            const sameLineage = !!(tree.lineage && pixel.treeLineage === tree.lineage);
            if (sameTreeId || samePlantedId || sameLineage || knownPixels.has(pixel)) exactMembers.push(pixel);
        }
        const collected = new Set(exactMembers);
        const frontier = exactMembers.slice();
        while (frontier.length) {
            const source = frontier.pop();
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (!dx && !dy) continue;
                    const candidate = candidates.get((source.x + dx) + "," + (source.y + dy));
                    if (!candidate || collected.has(candidate)) continue;
                    if (Number.isFinite(candidate.treeId) && candidate.treeId !== tree.id) continue;
                    if (Number.isFinite(candidate.civPlantedTreeId) && candidate.civPlantedTreeId !== tree.id) continue;
                    if (tree.lineage && candidate.treeLineage && candidate.treeLineage !== tree.lineage) continue;
                    collected.add(candidate);
                    frontier.push(candidate);
                }
            }
        }
        return Array.from(collected);
    }

    function removeTreeResourceNodes(treeId, removedPixels) {
        const removed = new Set(removedPixels || []);
        manager.resourceIndex.forEach((nodes, kind) => {
            const kept = [];
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const belongs = node && (removed.has(node.pixel) || node.tree && node.tree.id === treeId || node.descriptor && node.descriptor.treeId === treeId);
                if (!belongs) kept.push(node);
                else {
                    if (manager.resourceReservations && node.key) manager.resourceReservations.release(node.key);
                    if (node.pixel) manager.resourceNodeByPixel.delete(node.pixel);
                }
            }
            manager.resourceIndex.set(kind, kept);
        });
    }

    function fellTree(treeOrX, y, actor) {
        const tree = typeof treeOrX === "object" && treeOrX && Array.isArray(treeOrX.pixels) ? treeOrX : getTreeAt(treeOrX, y);
        if (!tree) return null;
        const allPixels = collectLiveTreePixels(tree);
        const woodPixels = allPixels.filter((pixel) => WOOD_BEARING_TREE_ELEMENTS.has(pixel.element));
        const base = tree.base && !tree.base.del ? tree.base : (woodPixels.slice().sort((a, b) => b.y - a.y || a.x - b.x)[0] || allPixels[0]);
        const dropX = base ? base.x : safeNumber(tree.root && tree.root.x, 0);
        const dropY = base ? base.y : safeNumber(tree.root && tree.root.y, 0);
        removeTreeResourceNodes(tree.id, allPixels);
        allPixels.forEach((pixel) => deleteExactPixel(pixel));
        manager.treeRootColumnsTick = -Infinity;
        const baseWoodDropCount = Math.ceil(woodPixels.length / 2);
        const woodDropCount = naturalResourceYieldAmount(actor, {kind: "wood"}, baseWoodDropCount);
        const saplingDropCount = Math.random() < 0.8 ? 1 : 2;
        const woodDropSources = woodPixels.slice().sort((a, b) => a.y - b.y || a.x - b.x);
        for (let index = 0; index < woodDropCount; index++) {
            const sourceIndex = Math.floor(index * woodDropSources.length / Math.max(1, woodDropCount));
            const source = woodDropSources[sourceIndex];
            if (source) queueResourceDrops("wood", "civ_wood_resource", 1, source.x, source.y, {sourceTreeId: tree.id, sourceTreePart: "wood"});
        }
        const saplingPlacement = {sourceTreeId: tree.id, sourceTreePart: "wood", treeFellingBaseY: dropY};
        queueResourceDrops(TREE_SAPLING_PREFIX + (tree.seed || "sapling"), "civ_tree_sapling_resource", saplingDropCount, dropX, dropY, Object.assign({treeSapling: tree.seed || "sapling"}, saplingPlacement));
        manager.treeById.delete(tree.id);
        if (actor) {
            addPersonActivityMetrics(actor, {felledTrees: 1, felledWood: woodDropCount, resourcesDropped: {[TREE_SAPLING_PREFIX + (tree.seed || "sapling")]: saplingDropCount}});
            const settlement = settlementForActor(actor);
            recordDiscovery(settlement, "seed", saplingDropCount);
            recordDiscovery(settlement, "tree_seed", saplingDropCount);
        }
        return {treeId: tree.id, woodDrops: woodDropCount, saplingDrops: saplingDropCount, removedPixels: allPixels.length, treeSapling: tree.seed || "sapling"};
    }

    function fellTreeAt(x, y, actor) {
        return fellTree(Number(x), Number(y), actor);
    }

    function addYieldWithFraction(actor, kind, rawAmount) {
        if (!actor.yieldFractions || typeof actor.yieldFractions !== "object") actor.yieldFractions = {};
        const total = Math.max(0, safeNumber(rawAmount, 0)) + safeNumber(actor.yieldFractions[kind], 0);
        const whole = Math.floor(total + 1e-9);
        actor.yieldFractions[kind] = total - whole;
        return whole;
    }

    const TECHNOLOGY_YIELD_RESOURCE_KINDS = new Set(["food", "wood", "stone", "copper", "raw_iron"]);

    function naturalResourceYieldAmount(actor, descriptor, baseAmount) {
        const base = Math.max(0, safeNumber(baseAmount, 0));
        if (!actor || !descriptor || descriptor.resourceDrop || descriptor.seedOnly || descriptor.treeSaplingResource || !TECHNOLOGY_YIELD_RESOURCE_KINDS.has(descriptor.kind)) {
            return Math.floor(base);
        }
        const faction = manager.factionById.get(actor.factionId);
        const mods = faction && faction.techModifiers || computeTechModifiers(faction);
        const bonus = Math.max(0, safeNumber(mods && mods.resourceYieldBonuses && mods.resourceYieldBonuses[descriptor.kind], 0));
        return addYieldWithFraction(actor, descriptor.kind, base * (1 + bonus));
    }

    function finishHarvestNode(actor, resourceKind, outcome, reason, resultPatch) {
        if (manager.resourceReservations && actor.reservedResourceKey) manager.resourceReservations.release(actor.reservedResourceKey, actor.humanId);
        delete actor.reservedResourceKey;
        finishPersonActivity(actor, outcome || "completed", reason || "resource_harvested", resultPatch);
        actor.harvestProgress = 0;
        actor.harvestX = undefined;
        actor.harvestY = undefined;
        actor.targetX = undefined;
        actor.targetY = undefined;
        actor.targetId = undefined;
        actor.targetKind = undefined;
        actor.targetKey = undefined;
        actor.task = "planning";
        invalidateNavigation(actor);
        if (carriedAmount(actor) >= carryCapacityFor(actor)) {
            beginCarryDelivery(actor, "backpack_full");
            return;
        }
        const next = findResource(actor, resourceKind);
        if (next && setHarvestTask(actor, next)) return;
        if (carriedAmount(actor) > 0) {
            beginCarryDelivery(actor, "resource_batch_exhausted");
            return;
        }
        delete actor.workTrip;
        beginPersonActivity(actor, "planning", null);
    }

    function removeResourcePixelFromIndex(pixel, kind) {
        const nodes = manager.resourceIndex.get(kind);
        if (!nodes || !nodes.length) {
            manager.resourceNodeByPixel.delete(pixel);
            return;
        }
        for (let index = nodes.length - 1; index >= 0; index--) {
            if (nodes[index] && nodes[index].pixel === pixel) nodes.splice(index, 1);
        }
        manager.resourceNodeByPixel.delete(pixel);
    }

    function blocksMiningSky(pixel) {
        if (!pixel || pixel.del) return false;
        const info = elements[pixel.element] || {};
        if (info.state !== "solid" || pixel._civResourceDrop || info.humanCollectible && pixel.element.indexOf("civ_") === 0) return false;
        if (getActorFromPixel(pixel) || isBuildingCorePixel(pixel) || STRUCTURE_PARTS.has(pixel.element)) return false;
        if (typeof isCreaturePixel === "function" && isCreaturePixel(pixel)) return false;
        if (typeof isPassableVegetationPixel === "function" && isPassableVegetationPixel(pixel)) return false;
        if (typeof isNonBlockingPixel === "function" && isNonBlockingPixel(pixel)) return false;
        if (info.passableVegetation || info.naturalVegetation || /(?:plant|leaves|needles|sapling|grass|flower|vine)/.test(pixel.element)) return false;
        const descriptor = resourceDescriptor(pixel);
        if (descriptor && (descriptor.resourceDrop || descriptor.kind === "wood" || descriptor.kind === "food")) return false;
        return true;
    }

    function mineralExposedToSky(x, y) {
        for (let scanY = y - 1; scanY >= 0; scanY--) {
            if (pixelsAt(x, scanY).some(blocksMiningSky)) return false;
        }
        return true;
    }

    function clearHarvestedResourceFields(pixel) {
        delete pixel._civCollectible;
        delete pixel._civResourceDrop;
        delete pixel.resourceKind;
        delete pixel.resourceMaterial;
        delete pixel.resourceSeed;
        delete pixel.treeSapling;
    }

    function replaceHarvestedResourcePixel(pixel, descriptor, actor) {
        if (!pixel || !descriptor) return false;
        removeResourcePixelFromIndex(pixel, descriptor.kind);
        const leavesSoil = !descriptor.resourceDrop && descriptor.kind !== "wood" && descriptor.kind !== "food" && elements.dirt;
        if (!leavesSoil) return deleteExactPixel(pixel);
        const leavesTunnel = NONRENEWABLE_KINDS.has(descriptor.kind) && elements.civ_tunnel && !getBuildingCoreAt(pixel.x, pixel.y) && !mineralExposedToSky(pixel.x, pixel.y);
        changePixel(pixel, leavesTunnel ? "civ_tunnel" : "dirt");
        clearHarvestedResourceFields(pixel);
        if (leavesTunnel) {
            pixel.dugTick = pixelTicks;
            pixel.dugByFactionId = actor && actor.factionId;
            pixel.dugByHumanId = actor && actor.humanId;
        }
        return true;
    }

    function harvestTarget(actor) {
        const harvestX = Number.isFinite(actor.harvestX) ? actor.harvestX : actor.targetX;
        const harvestY = Number.isFinite(actor.harvestY) ? actor.harvestY : actor.targetY;
        if (!Number.isFinite(harvestX) || !Number.isFinite(harvestY)) {
            clearTask(actor, "failed", "invalid_target_coordinates");
            return false;
        }
        const target = pixelsAt(harvestX, harvestY).find((pixel) => resourceDescriptor(pixel)) || null;
        const descriptor = resourceDescriptor(target);
        if (!target || !descriptor || (actor.targetKind && target.element !== actor.targetKind)) {
            blockFailedResource(actor, harvestX, harvestY, actor.targetKind);
            if (carriedAmount(actor) > 0) {
                if (manager.resourceReservations && actor.reservedResourceKey) manager.resourceReservations.release(actor.reservedResourceKey, actor.humanId);
                delete actor.reservedResourceKey;
                beginCarryDelivery(actor, "resource_disappeared");
                return false;
            }
            clearTask(actor, "interrupted", "resource_disappeared");
            return false;
        }
        if (Core.distance(actor.x, actor.y, target.x, target.y) > 1.5) return false;
        actor.harvestProgress = (actor.harvestProgress || 0) + C.THINK_INTERVAL;
        const faction = manager.factionById.get(actor.factionId);
        const mods = faction && faction.techModifiers || computeTechModifiers(faction);
        let harvestTicks = descriptor.harvestTicks;
        harvestTicks *= safeNumber(mods.harvestSpeed, 1);
        if (descriptor.kind === "wood") harvestTicks *= safeNumber(mods.woodHarvestSpeed, 1);
        if (descriptor.kind === "stone") harvestTicks *= safeNumber(mods.stoneHarvestSpeed, 1);
        if (descriptor.kind === "food") harvestTicks *= safeNumber(mods.foodHarvestSpeed, 1);
        const specialist = descriptor.kind === "food" ? (actor.role === "food" || actor.role === "farmer" || actor.role === "hunter") :
            (descriptor.kind === "wood" ? (actor.role === "wood" || actor.role === "forester") :
                (descriptor.kind === "stone" || NONRENEWABLE_KINDS.has(descriptor.kind) ? actor.role === "miner" : true));
        if (!specialist) harvestTicks *= 2;
        harvestTicks /= safeNumber(mods.roleWorkSpeed, 1);
        if (actor.harvestProgress < Math.max(C.THINK_INTERVAL, harvestTicks)) return true;
        const harvestedElement = target.element;
        const tree = Number.isFinite(target.treeId) ? manager.treeById.get(target.treeId) : null;
        if (tree && tree.base === target) {
            const result = fellTree(tree, undefined, actor);
            const settlement = settlementForActor(actor);
            if (settlement) {
                const research = ensureResearchState(settlement);
                research.milestones.harvests = safeNumber(research.milestones.harvests, 0) + 1;
            }
            addPersonActivityMetrics(actor, {harvestedBlocks: result ? result.removedPixels : 0, resourcesDropped: {wood: result ? result.woodDrops : 0}});
            finishHarvestNode(actor, descriptor.kind, "completed", "tree_felled", {sourceElement: harvestedElement, sourceX: harvestX, sourceY: harvestY, treeId: tree.id, woodDrops: result ? result.woodDrops : 0});
            return true;
        }
        replaceHarvestedResourcePixel(target, descriptor, actor);
        const carry = ensureActorCarry(actor);
        const capacity = carryCapacityFor(actor);
        const settlement = settlementForActor(actor);
        const resourcesCollected = {};
        const resourcesDropped = {};
        if (settlement) {
            const research = ensureResearchState(settlement);
            research.milestones.harvests = safeNumber(research.milestones.harvests, 0) + 1;
        }
        if (descriptor.treeSaplingResource) {
            const saplingKind = TREE_SAPLING_PREFIX + descriptor.treeSeed;
            const result = World.addCarry ? World.addCarry(actor, saplingKind, 1, capacity) : {accepted: 0, overflow: 1};
            resourcesCollected[saplingKind] = result.accepted;
            resourcesDropped[saplingKind] = result.overflow;
            recordFirstHarvest(settlement, saplingKind, result.accepted);
            if (result.overflow) queueResourceDrops(saplingKind, "civ_tree_sapling_resource", result.overflow, harvestX, harvestY, {treeSapling: descriptor.treeSeed});
        }
        else if (descriptor.seedOnly) {
            const result = World.addCarry ? World.addCarry(actor, "seed:" + descriptor.seed, 1, capacity) : {accepted: 0, overflow: 1};
            resourcesCollected["seed:" + descriptor.seed] = result.accepted;
            resourcesDropped["seed:" + descriptor.seed] = result.overflow;
            recordFirstHarvest(settlement, "seed:" + descriptor.seed, result.accepted);
            if (result.overflow) queueResourceDrops(descriptor.kind, harvestedElement, result.overflow, harvestX, harvestY);
        }
        else {
            actor.carryElement = harvestedElement;
            const amount = Math.max(1, naturalResourceYieldAmount(actor, descriptor, descriptor.yield));
            const result = World.addCarry ? World.addCarry(actor, descriptor.kind, amount, capacity) : {accepted: 0, overflow: amount};
            resourcesCollected[descriptor.kind] = safeNumber(resourcesCollected[descriptor.kind], 0) + result.accepted;
            resourcesDropped[descriptor.kind] = safeNumber(resourcesDropped[descriptor.kind], 0) + result.overflow;
            recordFirstHarvest(settlement, descriptor.kind, result.accepted);
            if (result.overflow) queueResourceDrops(descriptor.kind, harvestedElement, result.overflow, harvestX, harvestY);
            if (descriptor.kind === "wood" && result.accepted > 0) {
                for (let index = 0; index < result.accepted; index++) {
                    if (Math.random() >= C.WOOD_FOOD_BONUS_CHANCE) continue;
                    const foodResult = World.addCarry ? World.addCarry(actor, "food", 1, capacity) : {accepted: 0, overflow: 1};
                    resourcesCollected.food = safeNumber(resourcesCollected.food, 0) + foodResult.accepted;
                    resourcesDropped.food = safeNumber(resourcesDropped.food, 0) + foodResult.overflow;
                    recordFirstHarvest(settlement, "food", foodResult.accepted);
                    if (foodResult.overflow) queueResourceDrops("food", null, foodResult.overflow, harvestX, harvestY);
                }
            }
        }
        addPersonActivityMetrics(actor, {harvestedBlocks: 1, resourcesCollected: resourcesCollected, resourcesDropped: resourcesDropped});
        finishHarvestNode(actor, descriptor.kind, "completed", "resource_harvested", {sourceElement: harvestedElement, sourceX: harvestX, sourceY: harvestY});
        return true;
    }

    function farmCropAt(plot) {
        return pixelsAt(plot.x, plot.y).find((pixel) => pixel && pixel.element === "civ_farm_crop") || null;
    }

    function chooseTreeSeed(stock) {
        if (!stock || !stock.treeSaplings) return null;
        return ["sapling", "pinecone", "bamboo_plant"].find((seed) => safeNumber(stock.treeSaplings[seed], 0) > 0 && elements[seed]) || null;
    }

    function indexedTreeRootColumns() {
        if (manager.treeRootColumnsTick === pixelTicks) return manager.treeRootColumns;
        const columns = new Set();
        manager.treeById.forEach((tree) => {
            const rootPixel = tree && (tree.root && !tree.root.del ? tree.root : tree.base);
            if (rootPixel && !rootPixel.del && Number.isFinite(rootPixel.x)) columns.add(rootPixel.x);
        });
        if (typeof currentPixels !== "undefined") currentPixels.forEach((pixel) => {
            if (!pixel || pixel.del) return;
            if (Number.isFinite(pixel.treeRootX)) columns.add(pixel.treeRootX);
            else if (pixel._civTreeRoot || PLANTED_TREE_SEEDS.has(pixel.element)) columns.add(pixel.x);
        });
        manager.treeRootColumns = columns;
        manager.treeRootColumnsTick = pixelTicks;
        return columns;
    }

    function treeRootSpacingClear(x, excludedActor) {
        const clearance = Math.max(0, Math.floor(safeNumber(C.TREE_ROOT_HORIZONTAL_CLEARANCE, 2)));
        for (const rootX of indexedTreeRootColumns()) {
            if (Math.abs(rootX - x) <= clearance) return false;
        }
        for (const actor of manager.actors) {
            if (!actor || actor === excludedActor || actor.del || actor.dead || actor.task !== "plant_tree" || !Number.isFinite(actor.targetX)) continue;
            if (Math.abs(actor.targetX - x) <= clearance) return false;
        }
        return true;
    }

    function validTreePlantSpot(actor, banner, x, y) {
        if (!banner || !Number.isFinite(x) || !Number.isFinite(y) || outOfBounds(x, y)) return false;
        const territory = ensureTerritoryIndex();
        if (!territory || territory.ownerAt(x) !== banner.factionId) return false;
        if (!isEmpty(x, y) || !treeRootSpacingClear(x, actor)) return false;
        const soil = getPixel(x, y + 1);
        return !!(soil && SOIL_ELEMENTS.has(soil.element));
    }

    function findTreePlantSpot(banner, actor) {
        if (!banner) return null;
        const territory = ensureTerritoryIndex();
        if (!territory) return null;
        const originX = Math.max(0, Math.min(territory.width - 1, Math.round(safeNumber(actor && actor.x, banner.x))));
        const maximumDistance = Math.max(originX, territory.width - 1 - originX);
        const rightFirst = (safeNumber(actor && actor.humanId, banner.settlementId) % 2) === 0;
        for (let distance = 0; distance <= maximumDistance; distance++) {
            const xs = distance === 0 ? [originX] : (rightFirst ? [originX + distance, originX - distance] : [originX - distance, originX + distance]);
            for (let i = 0; i < xs.length; i++) {
                const x = xs[i];
                if (x < 0 || x >= territory.width || territory.ownerAt(x) !== banner.factionId || !treeRootSpacingClear(x, actor)) continue;
                const y = findSurfaceY(x, banner.y);
                if (y !== null && validTreePlantSpot(actor, banner, x, y)) return {x, y, kind: "tree_seed"};
            }
        }
        return null;
    }

    function handlePlantTreeTask(actor, banner) {
        if (!banner || !Number.isFinite(actor.targetX) || !Number.isFinite(actor.targetY)) return clearTask(actor, "failed", !banner ? "no_settlement" : "invalid_site");
        const seed = chooseTreeSeed(banner.stock);
        if (!seed) return clearTask(actor, "failed", "no_tree_seed");
        if (Core.distance(actor.x, actor.y, actor.targetX, actor.targetY) > 1.5) {
            moveRelationToward(actor, actor.targetX, actor.targetY, false);
            return;
        }
        let plantedTree = false;
        if (validTreePlantSpot(actor, banner, actor.targetX, actor.targetY)) {
            createPixel(seed, actor.targetX, actor.targetY);
            const planted = getPixel(actor.targetX, actor.targetY);
            if (planted && planted.element === seed) {
                planted.civPlantedTreeId = manager.nextTreeId++;
                if (typeof assignNewTreeBuildingLayer === "function") assignNewTreeBuildingLayer(planted);
                planted.civTreeOriginX = actor.targetX;
                planted.civTreeOriginY = actor.targetY;
                // createPixel indexes an ordinary sapling before its planted-tree
                // identity is attached. Remove that stale node immediately so the
                // forester cannot harvest the seed it has just planted.
                removeIndexedResourcePixel(planted);
                banner.stock.treeSaplings[seed]--;
                manager.treeRootColumnsTick = -Infinity;
                addDomainExperience(banner, "production", 0.1);
                ensureResearchState(banner).milestones.treesPlanted = safeNumber(banner.research.milestones.treesPlanted, 0) + 1;
                plantedTree = true;
            }
        }
        clearTask(actor, plantedTree ? "completed" : "failed", plantedTree ? "tree_planted" : "site_blocked", {seed: seed, siteX: actor.targetX, siteY: actor.targetY, treesPlanted: plantedTree ? 1 : 0});
    }

    function immatureTreeAvailable(actor) {
        for (const tree of manager.treeById.values()) {
            if (!tree || !tree.base || tree.base.del || treeIsHarvestable(tree)) continue;
            const owner = manager.territory && manager.territory.ownerAt(tree.base.x);
            if (owner === null || owner === undefined || !actor || owner === actor.factionId) return true;
        }
        return false;
    }

    function waitForTreeGrowth(actor, banner) {
        setTask(actor, "wait_tree_growth", banner || null);
        const faction = actor && manager.factionById.get(actor.factionId);
        const multiplier = Math.max(0.1, safeNumber(faction && faction.techModifiers && faction.techModifiers.forestryRecheckMultiplier, 1));
        actor.treeGrowthReadyTick = pixelTicks + Math.max(1, Math.round(C.TREE_GROWTH_RECHECK_TICKS * multiplier));
        setPersonActivityPhase(actor, "waiting");
    }

    function prioritizeForesterPlanting(actor) {
        if (!actor || actor.dead || actor.del || actor.role !== "forester" || actor.playerOrder || actorIsSoldier(actor) || actor.underAttackUntil > pixelTicks) return false;
        if (actor.task === "plant_tree" || actor.task === "wait_tree_growth" || actor.task === "combat" || actor.task === "siege" || actor.task === "extinguish" || actor.task === "deliver") return false;
        const interruptible = new Set(["planning", "idle", "wander", "harvest", "patrol", "search_resource", "explore", "facility", "return"]);
        if (actor.task && !interruptible.has(actor.task)) return false;
        const banner = settlementForActor(actor);
        const faction = manager.factionById.get(actor.factionId);
        if (!banner || !faction || !factionHasFeature(faction, "treePlanting") || !chooseTreeSeed(banner.stock)) return false;
        const plantingSpot = findTreePlantSpot(banner, actor);
        if (!plantingSpot) return false;
        if (carriedAmount(actor) > 0) {
            const firstKind = Object.keys(ensureActorCarry(actor)).find((kind) => actor.carry[kind] > 0);
            const destination = firstKind && deliveryDestination(actor, firstKind);
            if (!destination) return false;
            clearTask(actor, "interrupted", "forestry_delivery_priority");
            setTask(actor, "deliver", destination);
            return true;
        }
        if (actor.task !== "planning" && actor.task !== "idle" && actor.task !== "wander") clearTask(actor, "interrupted", "tree_planting_priority");
        setTask(actor, "plant_tree", plantingSpot);
        return true;
    }

    function handleFarmTask(actor, farm, banner) {
        if (!farm || farm.del || !farm.plots || !banner) {
            clearTask(actor, "interrupted", "farm_unavailable");
            return;
        }
        let chosen = null;
        let crop = null;
        for (let i = 0; i < farm.plots.length; i++) {
            const plot = farm.plots[i];
            const existingCrop = farmCropAt(plot);
            crop = existingCrop && resourceDescriptor(existingCrop) ? existingCrop : null;
            if (crop) {
                chosen = plot;
                break;
            }
            if (!existingCrop && !chosen && isEmpty(plot.x, plot.y) && materialAmount(banner.stock, "food") >= 1) chosen = plot;
        }
        if (!chosen) {
            clearTask(actor, "completed", "no_farm_work");
            return;
        }
        if (crop) {
            const approach = harvestApproach(actor, crop);
            if (!approach) return clearTask(actor, "failed", "crop_unreachable");
            finishPersonActivity(actor, "completed", "crop_selected", {crop: crop.element, cropX: crop.x, cropY: crop.y});
            setHarvestTask(actor, {pixel: crop, approach: approach});
            actor.harvestFarm = true;
            return;
        }
        const approach = harvestApproach(actor, chosen);
        if (!approach) return clearTask(actor, "failed", "plot_unreachable");
        actor.targetX = approach.x;
        actor.targetY = approach.y;
        if (Core.distance(actor.x, actor.y, approach.x, approach.y) > 0.5) return;
        let plantedCrop = false;
        if (!farmCropAt(chosen) && materialAmount(banner.stock, "food") >= 1 && isEmpty(chosen.x, chosen.y) && spendMaterial(banner.stock, "food", 1)) {
            const created = createPixel("civ_farm_crop", chosen.x, chosen.y);
            const planted = created && created.element === "civ_farm_crop" ? created : farmCropAt(chosen);
            if (planted && planted.element === "civ_farm_crop") {
                planted.plantedTick = pixelTicks;
                planted.matureTick = pixelTicks + C.FARM_GROW_TICKS;
                planted.factionId = actor.factionId;
                planted.settlementId = banner.settlementId;
                plantedCrop = true;
            }
            else addMaterial(banner.stock, "food", 1);
        }
        clearTask(actor, plantedCrop ? "completed" : "failed", plantedCrop ? "crop_planted" : "plot_blocked", {resource: "food", plotX: chosen.x, plotY: chosen.y, matureTick: plantedCrop ? pixelTicks + C.FARM_GROW_TICKS : null, cropsPlanted: plantedCrop ? 1 : 0});
    }

    function enemyDefendersRemain(actor) {
        if (!actor || actor.warRole !== "attacker") return false;
        for (const other of manager.actors) {
            if (!other || other.del || other.dead || other.factionId === actor.factionId || other.warRole !== "defender") continue;
            if (!atWar(actor.factionId, other.factionId)) continue;
            if (Number.isFinite(actor.warFrontId) && other.factionId !== actor.warFrontId) continue;
            return true;
        }
        return false;
    }

    function currentEnemy(actor, radius) {
        const weapon = weaponDescriptor(actor && actor.weapon);
        const visibleRadius = Math.min(radius, Math.max(visionRangeFor(actor), safeNumber(weapon && weapon.range, 1)));
        const defendersOnly = enemyDefendersRemain(actor);
        const enemies = nearbyActors(actor.x, actor.y, visibleRadius, (other) => {
            if (other.humanId === actor.humanId || !atWar(actor.factionId, other.factionId) || !mutualLineOfSight(actor, other)) return false;
            if (actor.warRole === "attacker" && Number.isFinite(actor.warFrontId) && other.factionId !== actor.warFrontId) return false;
            if (defendersOnly && other.warRole !== "defender") return false;
            if (actor.warRole === "defender" && (!manager.territory || manager.territory.ownerAt(other.x) !== actor.factionId)) return false;
            return true;
        });
        enemies.sort((a, b) => {
            const priorityA = a.warRole === "defender" ? 0 : (a.element === "civ_child" ? 2 : 1);
            const priorityB = b.warRole === "defender" ? 0 : (b.element === "civ_child" ? 2 : 1);
            return priorityA - priorityB || Core.distance(actor.x, actor.y, a.x, a.y) - Core.distance(actor.x, actor.y, b.x, b.y);
        });
        return enemies[0] || null;
    }

    function currentEnemyStructure(actor, radius) {
        let best = null;
        let bestDistance = Infinity;
        const inspect = (pixel) => {
            if (!pixel || pixel.del || pixel.buildingState === "destroyed" || pixel.townCenterActive === false || !Number.isFinite(pixel.factionId) || !atWar(actor.factionId, pixel.factionId)) return;
            if (actor.warRole === "attacker" && Number.isFinite(actor.warFrontId) && pixel.factionId !== actor.warFrontId) return;
            const distance = Core.distance(actor.x, actor.y, pixel.x, pixel.y);
            if (distance <= radius && distance < bestDistance) {
                best = pixel;
                bestDistance = distance;
            }
        };
        manager.settlements.forEach(inspect);
        manager.structures.forEach((pixel) => {
            if (STRUCTURE_CORES.has(pixel.element)) inspect(pixel);
        });
        return best;
    }

    function strategicEnemy(actor) {
        const candidates = [];
        const defendersOnly = enemyDefendersRemain(actor);
        manager.actors.forEach((other) => {
            if (!other || other.del || other.dead || other.factionId === actor.factionId || !atWar(actor.factionId, other.factionId)) return;
            if (actor.warRole === "attacker" && Number.isFinite(actor.warFrontId) && other.factionId !== actor.warFrontId) return;
            if (defendersOnly && other.warRole !== "defender") return;
            if (actor.warRole === "defender" && (!manager.territory || manager.territory.ownerAt(other.x) !== actor.factionId)) return;
            candidates.push(other);
        });
        candidates.sort((a, b) => {
            const priorityA = a.warRole === "defender" ? 0 : (a.element === "civ_child" ? 2 : 1);
            const priorityB = b.warRole === "defender" ? 0 : (b.element === "civ_child" ? 2 : 1);
            return priorityA - priorityB || Core.distance(actor.x, actor.y, a.x, a.y) - Core.distance(actor.x, actor.y, b.x, b.y);
        });
        return candidates[0] || null;
    }

    function isFireTarget(pixel) {
        return !!(pixel && !pixel.del && (pixel.burning || DIRECT_FIRE_ELEMENTS.has(pixel.element)));
    }

    function refreshFireTargets(force) {
        if (!force && pixelTicks - manager.lastFireScanTick < C.FIRE_SCAN_INTERVAL) return manager.fireTargets;
        manager.fireTargets = currentPixels.filter(isFireTarget);
        manager.lastFireScanTick = pixelTicks;
        return manager.fireTargets;
    }

    function findFireTarget(actor) {
        if (!actor || actor.del || actor.dead) return null;
        let best = null;
        let bestDistance = Infinity;
        const targets = refreshFireTargets(false);
        for (let index = 0; index < targets.length; index++) {
            const target = targets[index];
            if (!isFireTarget(target)) continue;
            const distance = Core.distance(actor.x, actor.y, target.x, target.y);
            if (distance > C.FIRE_RESPONSE_RADIUS || distance >= bestDistance) continue;
            best = target;
            bestDistance = distance;
        }
        return best;
    }

    function fireResponseSlotAvailable(actor) {
        if (!actor || actor.del || actor.dead) return false;
        if (actor.task === "extinguish") return true;
        let responders = 0;
        manager.actors.forEach((other) => {
            if (!other || other === actor || other.del || other.dead || other.task !== "extinguish") return;
            if (other.factionId !== actor.factionId) return;
            if (Number.isFinite(actor.settlementId) && Number.isFinite(other.settlementId) && other.settlementId !== actor.settlementId) return;
            responders++;
        });
        return responders < Math.max(1, safeNumber(C.MAX_FIRE_RESPONDERS_PER_SETTLEMENT, 2));
    }

    function extinguishPixel(pixel) {
        if (!isFireTarget(pixel)) return null;
        const sourceElement = pixel.element;
        const wasBurning = !!pixel.burning;
        delete pixel.burning;
        delete pixel.burnStart;
        const replacement = EXTINGUISHED_FIRE_ELEMENTS[sourceElement];
        if (replacement) {
            if (elements[replacement]) changePixel(pixel, replacement);
            else deleteExactPixel(pixel);
        }
        return {sourceElement: sourceElement, resultElement: replacement || sourceElement, wasBurning: wasBurning};
    }

    function extinguishTarget(actor) {
        if (!actor || !Number.isFinite(actor.targetX) || !Number.isFinite(actor.targetY)) {
            clearTask(actor, "failed", "invalid_fire_target");
            return false;
        }
        const target = pixelsAt(actor.targetX, actor.targetY).find(isFireTarget) || null;
        if (!target) {
            refreshFireTargets(true);
            clearTask(actor, "completed", "fire_already_out");
            return false;
        }
        if (Core.distance(actor.x, actor.y, target.x, target.y) > 1.5) return false;
        const result = extinguishPixel(target);
        if (!result) return false;
        manager.lastFireScanTick = -Infinity;
        const banner = settlementForActor(actor);
        if (banner) {
            logSettlementEvent(banner, "fire_extinguished", "扑灭火情", {
                humanId: actor.humanId,
                sourceElement: result.sourceElement,
                resultElement: result.resultElement,
                x: target.x,
                y: target.y
            });
        }
        clearTask(actor, "completed", "fire_extinguished", {
            firesExtinguished: 1,
            sourceElement: result.sourceElement,
            resultElement: result.resultElement,
            sourceX: target.x,
            sourceY: target.y
        });
        return true;
    }

    function actorCanStaffFacility(actor, building) {
        if (!actor || !building || actor.dead || actor.del || building.del) return false;
        if (building.element === "civ_workshop_core") return actor.role === "artisan";
        if (building.element === "civ_library_core") return actor.role === "scholar";
        if (building.element === "civ_market_core") return actor.role === "merchant" || actor.role === "artisan_trade";
        return false;
    }

    function recipeStockAvailable(banner, recipeId) {
        const recipe = TechData.RECIPES && TechData.RECIPES[recipeId];
        if (!banner || !recipe) return false;
        ensureStock(banner);
        if (!(recipe.inputs || []).every((input) => materialAmount(banner.stock, input.resource) >= input.amount)) return false;
        if (!(recipe.heat > 0)) return true;
        return !!(Core.selectFuelCombination && Core.selectFuelCombination(availableFuelStock(banner.stock), recipe.heat, FUEL_VALUES));
    }

    function facilityWorkPriority(faction, banner, building) {
        return 0;
    }

    function facilityAssignmentCounts(faction, facilities, excludedActors) {
        const counts = new Map();
        const facilityById = new Map();
        facilities.forEach((building) => {
            counts.set(building.buildingId, 0);
            facilityById.set(building.buildingId, building);
        });
        (faction && faction.adults || []).forEach((actor) => {
            if (!actor || actor.dead || actor.del || actor.task !== "facility" || excludedActors && excludedActors.has(actor)) return;
            const building = facilityById.get(actor.targetId);
            if (!building || !actorCanStaffFacility(actor, building)) return;
            counts.set(building.buildingId, safeNumber(counts.get(building.buildingId), 0) + 1);
        });
        return counts;
    }

    function chooseFacilityForActor(actor, faction, facilities, assignmentCounts) {
        if (!actor || !faction || !facilities || !facilities.length) return null;
        const banner = settlementForActor(actor);
        const localFacilities = facilities.filter((building) => building && !building.del && building.settlementId === actor.settlementId && actorCanStaffFacility(actor, building));
        if (!localFacilities.length) return null;
        const counts = assignmentCounts || facilityAssignmentCounts(faction, localFacilities, new Set([actor]));
        return localFacilities.sort((a, b) => {
            const priorityA = facilityWorkPriority(faction, banner, a);
            const priorityB = facilityWorkPriority(faction, banner, b);
            const hasWorkA = priorityA > 0 ? 1 : 0;
            const hasWorkB = priorityB > 0 ? 1 : 0;
            return hasWorkB - hasWorkA ||
                safeNumber(counts.get(a.buildingId), 0) - safeNumber(counts.get(b.buildingId), 0) ||
                priorityB - priorityA ||
                Core.distance(actor.x, actor.y, a.x, a.y) - Core.distance(actor.x, actor.y, b.x, b.y) ||
                safeNumber(a.buildingId, 0) - safeNumber(b.buildingId, 0);
        })[0];
    }

    function rebalanceFactionIndustry(faction) {
        return 0;
    }

    function assignActorTask(actor) {
        if (!actor || actor.del || actor.dead || actor.element !== "civ_body") return;
        const banner = settlementForActor(actor);
        const faction = manager.factionById.get(actor.factionId);
        const lockedEnemy = Number.isFinite(actor.combatTargetId) ? manager.actorById.get(actor.combatTargetId) : null;
        const lockedAllowed = lockedEnemy && !lockedEnemy.dead && lockedEnemy.factionId !== actor.factionId &&
            (atWar(actor.factionId, lockedEnemy.factionId) || retaliationAllowed(actor, lockedEnemy)) &&
            (actor.warRole !== "defender" || manager.territory && manager.territory.ownerAt(lockedEnemy.x) === actor.factionId);
        const enemy = lockedAllowed ? lockedEnemy : currentEnemy(actor, actor.role === "warrior" || actor.warRole ? 30 : 10);
        if (enemy) {
            actor.combatTargetId = enemy.humanId;
            if (actor.role === "warrior" || actor.warRole || actor.underAttackUntil > pixelTicks) setTask(actor, "combat", enemy);
            else setTask(actor, "flee", enemy);
            return;
        }
        if (carriedAmount(actor) >= carryCapacityFor(actor) && banner) {
            const firstKind = Object.keys(ensureActorCarry(actor)).find((kind) => actor.carry[kind] > 0);
            const destination = deliveryDestination(actor, firstKind);
            setTask(actor, "deliver", destination);
            deliverCarry(actor, destination);
            return;
        }
        if (actor.warRole) {
            const warTarget = strategicEnemy(actor);
            if (warTarget) {
                actor.combatTargetId = warTarget.humanId;
                setTask(actor, "combat", warTarget);
                return;
            }
            if (actor.warRole === "attacker") {
                const structureTarget = currentEnemyStructure(actor, Infinity);
                if (structureTarget) {
                    setTask(actor, "siege", structureTarget);
                    return;
                }
            }
            if (banner) { setTask(actor, "patrol", banner); return; }
        }
        const fireTarget = fireResponseSlotAvailable(actor) ? findFireTarget(actor) : null;
        if (fireTarget) {
            setTask(actor, "extinguish", fireTarget);
            return;
        }
        if (actor.role === "builder" && faction && faction.constructionSites.length) {
            setTask(actor, "build", faction.constructionSites[0]);
            return;
        }
        if (actor.role === "forester" && banner && factionHasFeature(faction, "treePlanting")) {
            const plantingSpot = chooseTreeSeed(banner.stock) && findTreePlantSpot(banner, actor);
            if (plantingSpot) {
                setTask(actor, "plant_tree", plantingSpot);
                return;
            }
        }
        if (banner && (actor.role === "warrior" || actor.role === "guard")) {
            setTask(actor, "patrol", banner);
            return;
        }
        if (faction && (actor.role === "artisan" || actor.role === "scholar" || actor.role === "merchant")) {
            let facilities = [];
            if (actor.role === "artisan") facilities = faction.workshops;
            else if (actor.role === "scholar") facilities = faction.libraries;
            else facilities = faction.markets;
            const localFacility = chooseFacilityForActor(actor, faction, facilities);
            if (localFacility) { setTask(actor, "facility", localFacility); return; }
        }
        const demand = settlementGatheringDemand(faction || {population: 1}, banner);
        let wanted = preferredResourceKind(faction || {population: 1}, banner);
        if (actor.role === "food" || actor.role === "hunter") {
            wanted = safeNumber(demand.food, 0) > 0 ? "food" : preferredResourceKind(faction, banner, ["wood", "stone", "food"]);
        }
        else if (actor.role === "wood" || actor.role === "forester") {
            wanted = safeNumber(demand.wood, 0) > 0 ? "wood" : preferredResourceKind(faction, banner, ["stone", "food", "wood"]);
        }
        else if (actor.role === "miner") {
            const assignment = manager.minerAssignments.get(actor.humanId);
            wanted = assignment && assignment.settlementId === actor.settlementId && resourceUnlockedForFaction(faction, assignment.kind)
                ? assignment.kind
                : preferredResourceKind(faction, banner, MINEABLE_RESOURCE_KINDS);
        }
        let resource = findResource(actor, wanted);
        if (!resource && actor.role === "miner") {
            const fallbackKinds = MINEABLE_RESOURCE_KINDS.filter((kind) => kind !== wanted && resourceUnlockedForFaction(faction, kind))
                .sort((a, b) => safeNumber(demand[b], 0) - safeNumber(demand[a], 0) || MINEABLE_RESOURCE_KINDS.indexOf(a) - MINEABLE_RESOURCE_KINDS.indexOf(b));
            for (let index = 0; index < fallbackKinds.length && !resource; index++) {
                const fallback = findResource(actor, fallbackKinds[index]);
                if (!fallback) continue;
                wanted = fallbackKinds[index];
                resource = fallback;
                manager.minerAssignments.set(actor.humanId, {kind: wanted, reason: "target_unavailable", source: "fallback", settlementId: actor.settlementId, plannedTick: pixelTicks});
            }
        }
        if (resource) setHarvestTask(actor, resource);
        else if (carriedAmount(actor) > 0 && banner) {
            const firstKind = Object.keys(ensureActorCarry(actor)).find((kind) => actor.carry[kind] > 0);
            setTask(actor, "deliver", deliveryDestination(actor, firstKind));
        }
        else if (banner && (actor.role === "wood" || actor.role === "forester") && wanted === "wood" && immatureTreeAvailable(actor)) waitForTreeGrowth(actor, banner);
        else if (banner && actor.role === "builder") setTask(actor, "patrol", banner);
        else if (banner) {
            setTask(actor, "search_resource", banner);
            actor.targetKind = wanted;
        }
        else setTask(actor, "explore", null);
    }

    function tunnelAt(x, y) {
        return pixelByElementAt(x, y, "civ_tunnel");
    }

    function canTunnelPixel(pixel, actor, forceTraversal) {
        if (!pixel || pixel.del || isBuildingCorePixel(pixel) || getActorFromPixel(pixel)) return false;
        const info = elements[pixel.element] || {};
        if (typeof isCreaturePixel === "function" && isCreaturePixel(pixel)) return false;
        if (pixel.eraseProtected === true || info.eraseProtected === true) return false;
        if (STRUCTURE_PARTS.has(pixel.element)) return false;
        const descriptor = resourceDescriptor(pixel);
        if (actor && typeof pixelsCanOverlap === "function") {
            const bodyProbe = {element: "civ_body", factionId: actor.factionId, humanId: actor.humanId};
            const headProbe = {element: "civ_head", factionId: actor.factionId, humanId: actor.humanId};
            if (pixelsCanOverlap(bodyProbe, pixel) || pixelsCanOverlap(headProbe, pixel)) return false;
        }
        if (descriptor && (descriptor.kind === "stone" || NONRENEWABLE_KINDS.has(descriptor.kind))) return true;
        if (forceTraversal) return info.state === "solid";
        return info.state === "solid" && (SOIL_ELEMENTS.has(pixel.element) || /(?:dirt|soil|clay|sand|rock|stone|ore|gravel|basalt|limestone)/.test(pixel.element));
    }

    function collectTunnelResource(actor, pixel) {
        if (!actor || actor.role !== "miner") return;
        const descriptor = resourceDescriptor(pixel);
        if (!descriptor || descriptor.kind === "wood" || descriptor.kind === "food") return;
        const amount = Math.max(1, naturalResourceYieldAmount(actor, descriptor, descriptor.yield));
        ensureActorCarry(actor);
        const result = World.addCarry ? World.addCarry(actor, descriptor.kind, amount, carryCapacityFor(actor)) : {accepted: 0, overflow: amount};
        addPersonActivityMetrics(actor, {resourcesCollected: {[descriptor.kind]: result.accepted}, resourcesDropped: {[descriptor.kind]: result.overflow}});
        recordFirstHarvest(settlementForActor(actor), descriptor.kind, result.accepted);
        if (result.overflow) queueResourceDrops(descriptor.kind, pixel.element, result.overflow, pixel.x, pixel.y);
    }

    function carveTunnelCell(actor, x, y) {
        if (outOfBounds(x, y)) return {satisfied: false, mutated: false};
        const forceTraversal = !!(actor.pathCache && actor.pathCache.forceTunnel);
        const occupants = pixelsAt(x, y).slice();
        if (occupants.some(isBuildingCorePixel)) return {satisfied: false, mutated: false};
        let tunnel = occupants.find((pixel) => pixel.element === "civ_tunnel") || null;
        let mutated = false;
        for (let i = 0; i < occupants.length; i++) {
            const pixel = occupants[i];
            if (!pixel || pixel.del || pixel === tunnel || pixel._r === actor._r) continue;
            const occupyingActor = getActorFromPixel(pixel);
            if (occupyingActor) {
                const probe = {element: "civ_body", factionId: actor.factionId, humanId: actor.humanId};
                if (typeof pixelsCanOverlap === "function" && pixelsCanOverlap(probe, pixel)) continue;
                return {satisfied: false, mutated: mutated};
            }
            if (typeof pixelsCanOverlap === "function") {
                const bodyProbe = {element: "civ_body", factionId: actor.factionId, humanId: actor.humanId};
                const headProbe = {element: "civ_head", factionId: actor.factionId, humanId: actor.humanId};
                if (pixelsCanOverlap(bodyProbe, pixel) || pixelsCanOverlap(headProbe, pixel)) continue;
            }
            if (!canTunnelPixel(pixel, actor, forceTraversal)) return {satisfied: false, mutated: mutated};
            collectTunnelResource(actor, pixel);
            if (!tunnel) {
                changePixel(pixel, "civ_tunnel");
                tunnel = pixel;
                tunnel.dugTick = pixelTicks;
                tunnel.dugByFactionId = actor.factionId;
            }
            else deleteExactPixel(pixel);
            mutated = true;
        }
        if (mutated) addPersonActivityMetrics(actor, {tunnelCells: 1});
        return {satisfied: true, mutated: mutated};
    }

    function digToward(actor, relation, targetX, targetY) {
        if (actor.element !== "civ_body") return false;
        if (actor.role === "miner" && carriedAmount(actor) >= carryCapacityFor(actor)) {
            beginCarryDelivery(actor, "tunnel_backpack_full");
            return false;
        }
        const dxTotal = targetX - actor.x;
        const dyTotal = targetY - actor.y;
        let dx = 0;
        let dy = 0;
        const routeLeg = actor.pathCache && actor.pathCache.legs && actor.pathCache.legs[actor.pathCache.legIndex];
        if (routeLeg && routeLeg.axis === "y" && dyTotal) dy = Math.sign(dyTotal);
        else if (routeLeg && routeLeg.axis === "x" && dxTotal) dx = Math.sign(dxTotal);
        else if (dyTotal) dy = Math.sign(dyTotal);
        else if (dxTotal) dx = Math.sign(dxTotal);
        if (!dx && !dy) dx = actor.dir || 1;
        const bodyX = actor.x + dx;
        const bodyY = actor.y + dy;
        const headX = bodyX;
        const headY = bodyY - 1;
        const targetPixels = pixelsAt(bodyX, bodyY).concat(pixelsAt(headX, headY));
        targetPixels.forEach((pixel) => resourceDescriptor(pixel));
        if (actorCanOccupyAt(actor, bodyX, bodyY)) {
            if (tryMoveRelation(relation, dx, dy, true)) {
                recordWorkTripStep(actor);
                return true;
            }
            return false;
        }
        const forceTraversal = !!(actor.pathCache && actor.pathCache.forceTunnel);
        const bodyNeedsExcavation = pixelsAt(bodyX, bodyY).some((pixel) => canTunnelPixel(pixel, actor, forceTraversal));
        const headNeedsExcavation = pixelsAt(headX, headY).some((pixel) => canTunnelPixel(pixel, actor, forceTraversal));
        if (!bodyNeedsExcavation && !headNeedsExcavation) return false;
        const banner = settlementForActor(actor);
        if (banner && !banner.firstTunnelLogged) {
            banner.firstTunnelLogged = true;
            logSettlementEvent(banner, "tunnel", "首次开挖矿洞", {x: actor.x, y: actor.y, humanId: actor.humanId});
        }
        actor.pathStage = "tunnel";
        setPersonActivityPhase(actor, "tunnel");
        const carvedBody = carveTunnelCell(actor, bodyX, bodyY);
        const carvedHead = carveTunnelCell(actor, headX, headY);
        if (carvedBody.satisfied && carvedHead.satisfied && actorCanOccupyAt(actor, bodyX, bodyY) && tryMoveRelation(relation, dx, dy, true)) {
            recordWorkTripStep(actor);
            return true;
        }
        return carvedBody.mutated || carvedHead.mutated;
    }

    function blockingWallAt(actor, x, y) {
        const relationId = actor && actor._r;
        return pixelsAt(x, y).find((pixel) => {
            if (!pixel || pixel.del || pixel._r === relationId) return false;
            const info = elements[pixel.element] || {};
            if (info.state !== "solid") return false;
            if (typeof isCreaturePixel === "function" && isCreaturePixel(pixel)) return false;
            if (typeof isPassableVegetationPixel === "function" && isPassableVegetationPixel(pixel)) return false;
            if (typeof isNonBlockingPixel === "function" && isNonBlockingPixel(pixel)) return false;
            resourceDescriptor(pixel);
            const probe = {element: "civ_body", factionId: actor.factionId, humanId: actor.humanId};
            return typeof pixelsCanOverlap !== "function" || !pixelsCanOverlap(probe, pixel);
        }) || null;
    }

    function overlapClimbableAt(actor, x, y) {
        const bodyProbe = {element: "civ_body", factionId: actor.factionId, humanId: actor.humanId};
        const headProbe = {element: "civ_head", factionId: actor.factionId, humanId: actor.humanId};
        return pixelsAt(x, y).some((pixel) => {
            if (!pixel || pixel.del || pixel._r === actor._r || getActorFromPixel(pixel)) return false;
            if (typeof pixelsCanOverlap !== "function") return pixel.element === "civ_tunnel";
            return pixelsCanOverlap(bodyProbe, pixel) || pixelsCanOverlap(headProbe, pixel);
        });
    }

    function hasInternalClimbSupport(actor, x, y) {
        return overlapClimbableAt(actor, x, y) || overlapClimbableAt(actor, x, y - 1);
    }

    function climbSupportAt(actor, x, y, side) {
        if (side !== -1 && side !== 1) return false;
        return !!(blockingWallAt(actor, x + side, y) || blockingWallAt(actor, x + side, y - 1) ||
            overlapClimbableAt(actor, x, y) || overlapClimbableAt(actor, x, y - 1) ||
            overlapClimbableAt(actor, x + side, y) || overlapClimbableAt(actor, x + side, y - 1));
    }

    function continuousWallHeight(actor, side) {
        if (side !== -1 && side !== 1) return 0;
        let height = 0;
        for (let y = actor.y; y >= 1; y--) {
            if (!blockingWallAt(actor, actor.x + side, y)) break;
            height++;
        }
        return height;
    }

    function corridorRequiresExcavation(actor, targetX, targetY) {
        if (!actor || outOfBounds(targetX, targetY) || outOfBounds(targetX, targetY - 1)) return false;
        return pixelsAt(targetX, targetY).some((pixel) => canTunnelPixel(pixel, actor, true)) ||
            pixelsAt(targetX, targetY - 1).some((pixel) => canTunnelPixel(pixel, actor, true));
    }

    function corridorBuildingAt(actor, x, y) {
        if (actorCanOccupyAt(actor, x, y)) return null;
        const candidates = [getBuildingCoreAt(x, y), getBuildingCoreAt(x, y - 1)].filter(Boolean);
        const bodyProbe = {element: "civ_body", factionId: actor.factionId, humanId: actor.humanId};
        const headProbe = {element: "civ_head", factionId: actor.factionId, humanId: actor.humanId};
        return candidates.find((building, index) => {
            if (candidates.indexOf(building) !== index || building.del || building.buildingState === "destroyed") return false;
            if (typeof pixelsCanOverlap === "function") return !pixelsCanOverlap(bodyProbe, building) && !pixelsCanOverlap(headProbe, building);
            const info = elements[building.element] || {};
            return building.nonBlocking !== true && info.nonBlocking !== true;
        }) || null;
    }

    function beginHighWallTunnel(actor, side) {
        const nav = ensureNavigationState(actor);
        nav.forceTunnel = true;
        nav.tunnelDirection = side;
        nav.tunnelStartX = actor.x;
        nav.tunnelStartedTick = pixelTicks;
        let exitX = actor.x + side;
        for (let steps = 0; steps < Math.max(1, width); steps++, exitX += side) {
            if (outOfBounds(exitX, actor.y) || outOfBounds(exitX, actor.y - 1)) break;
            const bodyBlocked = pixelsAt(exitX, actor.y).some((pixel) => canTunnelPixel(pixel, actor, true));
            const headBlocked = pixelsAt(exitX, actor.y - 1).some((pixel) => canTunnelPixel(pixel, actor, true));
            if (!bodyBlocked && !headBlocked) break;
        }
        nav.tunnelExitX = exitX;
        speakForTask(actor, "tunnel", 3);
        return nav;
    }

    function activeClimbSide(actor) {
        const side = actor && actor.pathCache && actor.pathCache.climbSide;
        if ((side === -1 || side === 1) && climbSupportAt(actor, actor.x, actor.y, side)) return side;
        if (actor && actor.pathCache) actor.pathCache.climbSide = 0;
        return 0;
    }

    function ensureNavigationState(actor) {
        if (!actor.pathCache || actor.pathCache.version !== NAVIGATION_SCHEMA_VERSION || !Array.isArray(actor.pathCache.path)) {
            actor.pathCache = {version: NAVIGATION_SCHEMA_VERSION, mode: "astar", phase: "outbound", path: [], pathIndex: 0, climbSide: 0, searchStatus: "idle", stallSinceTick: pixelTicks, blockedTicks: 0};
        }
        return actor.pathCache;
    }

    function invalidateNavigation(actor, reason) {
        if (!actor) return;
        const side = actor.pathCache && actor.pathCache.climbSide;
        if (Number.isFinite(actor.humanId)) manager.routeSearches.delete(actor.humanId);
        if (Number.isFinite(actor.humanId) && reason !== "next_edge_invalid") manager.routeRejectedEdges.delete(actor.humanId);
        actor.pathCache = {
            version: NAVIGATION_SCHEMA_VERSION,
            mode: "astar",
            phase: actor.workTrip && actor.workTrip.phase || "outbound",
            path: [],
            pathIndex: 0,
            climbSide: side === -1 || side === 1 ? side : 0,
            searchStatus: "idle",
            replanReason: reason || null,
            stallSinceTick: pixelTicks,
            blockedTicks: 0
        };
    }

    function navigationExcavationAllowed(actor) {
        if (!actor) return false;
        return actor.element === "civ_body" && actor._r !== undefined;
    }

    function executeNavigationEdge(actor, dx, dy, stage, climbSide) {
        const relation = actor && actor._r !== undefined ? getRelation(actor._r) : null;
        if (!relation || !actorCanOccupyAt(actor, actor.x + dx, actor.y + dy)) return false;
        if (!tryMoveRelation(relation, dx, dy, true)) return false;
        actor.pathStage = stage;
        setPersonActivityPhase(actor, stage === "step" || stage === "top" ? "climb" : stage);
        if (dx) actor.dir = Math.sign(dx);
        const nav = ensureNavigationState(actor);
        nav.climbSide = climbSide === -1 || climbSide === 1 ? climbSide : 0;
        if (stage === "climb" && nav.climbSide === 0) actor.climbHoldUntil = pixelTicks + Math.max(2, C.LOCOMOTION_INTERVAL_TICKS);
        else if (stage !== "climb") delete actor.climbHoldUntil;
        nav.lastMoveTick = pixelTicks;
        nav.stallSinceTick = pixelTicks;
        nav.blockedTicks = 0;
        recordWorkTripStep(actor);
        return true;
    }

    let deferAdultLocomotion = false;

    function legacyNavigationStep(actor, targetX, targetY, away) {
        if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
            if (actor.playerOrder) clearPlayerOrder(actor, "failed", "invalid_navigation_target");
            else clearTask(actor, "failed", "invalid_navigation_target");
            return false;
        }
        const nav = ensureNavigationState(actor);
        const horizontal = Math.sign(targetX - actor.x) * (away ? -1 : 1);
        const vertical = Math.sign(targetY - actor.y) * (away ? -1 : 1);
        let side = activeClimbSide(actor);

        if (!away && horizontal && !nav.forceTunnel && continuousWallHeight(actor, horizontal) > 6) beginHighWallTunnel(actor, horizontal);
        if (!away && nav.forceTunnel) {
            const tunnelDirection = nav.tunnelDirection === -1 ? -1 : 1;
            const building = corridorBuildingAt(actor, actor.x + tunnelDirection, actor.y);
            if (building) {
                if (building.factionId !== actor.factionId && atWar(actor.factionId, building.factionId)) {
                    setTask(actor, "siege", building);
                    return false;
                }
                nav.forceTunnel = false;
                nav.tunnelDirection = 0;
            }
            else {
                const passedExit = tunnelDirection > 0 ? actor.x >= safeNumber(nav.tunnelExitX, actor.x + 1) : actor.x <= safeNumber(nav.tunnelExitX, actor.x - 1);
                if (!passedExit && digToward(actor, getRelation(actor._r), actor.x + tunnelDirection, actor.y)) {
                    nav.stallSinceTick = pixelTicks;
                    return true;
                }
                nav.forceTunnel = false;
                nav.tunnelDirection = 0;
            }
        }

        if (side) {
            if (horizontal === side && actorCanStandAt(actor, actor.x + side, actor.y - 1)) {
                nav.descentSupport = -side;
                if (executeNavigationEdge(actor, side, -1, "top", 0)) return true;
            }
            if (horizontal === side && actorCanOccupyAt(actor, actor.x, actor.y - 1) && climbSupportAt(actor, actor.x, actor.y - 1, side) && executeNavigationEdge(actor, 0, -1, "climb", side)) return true;
            if (!horizontal && vertical !== 0 && actorCanOccupyAt(actor, actor.x, actor.y + vertical) && climbSupportAt(actor, actor.x, actor.y + vertical, side) && executeNavigationEdge(actor, 0, vertical, "climb", side)) return true;
            nav.climbSide = 0;
            side = 0;
        }

        if (vertical > 0 && (nav.descentSupport === -1 || nav.descentSupport === 1)) {
            const support = nav.descentSupport;
            if (actorCanOccupyAt(actor, actor.x, actor.y + 1) && climbSupportAt(actor, actor.x, actor.y + 1, support) && executeNavigationEdge(actor, 0, 1, "climb", support)) return true;
            if (!climbSupportAt(actor, actor.x, actor.y, support)) nav.descentSupport = 0;
        }

        if (horizontal && executeNavigationEdge(actor, horizontal, 0, "flat", 0)) return true;
        if (horizontal && actorCanStandAt(actor, actor.x + horizontal, actor.y - 1) && executeNavigationEdge(actor, horizontal, -1, "step", 0)) return true;
        if (horizontal && climbSupportAt(actor, actor.x, actor.y, horizontal)) {
            nav.climbSide = horizontal;
            if (actorCanOccupyAt(actor, actor.x, actor.y - 1) && climbSupportAt(actor, actor.x, actor.y - 1, horizontal) && executeNavigationEdge(actor, 0, -1, "climb", horizontal)) return true;
        }
        if (horizontal && targetY > actor.y && actorCanStandAt(actor, actor.x + horizontal, actor.y + 1) && executeNavigationEdge(actor, horizontal, 1, "down", 0)) return true;
        if (vertical !== 0 && hasInternalClimbSupport(actor, actor.x, actor.y) && actorCanOccupyAt(actor, actor.x, actor.y + vertical) && executeNavigationEdge(actor, 0, vertical, "climb", 0)) return true;
        if (!horizontal && vertical < 0) {
            const preferred = nav.climbSide || actor.dir || 1;
            const selectedSide = climbSupportAt(actor, actor.x, actor.y, preferred) ? preferred : (climbSupportAt(actor, actor.x, actor.y, -preferred) ? -preferred : 0);
            if (selectedSide && actorCanOccupyAt(actor, actor.x, actor.y - 1) && climbSupportAt(actor, actor.x, actor.y - 1, selectedSide) && executeNavigationEdge(actor, 0, -1, "climb", selectedSide)) return true;
        }
        if (!away && navigationExcavationAllowed(actor) && digToward(actor, getRelation(actor._r), targetX, targetY)) {
            nav.stallSinceTick = pixelTicks;
            return true;
        }
        if (!Number.isFinite(nav.stallSinceTick)) nav.stallSinceTick = pixelTicks;
        return false;
    }

    function routeTaskKey(actor, away) {
        return [actor.task || "move", actor.targetKey || "", safeNumber(actor.targetId, ""), away ? 1 : 0].join("|");
    }

    function routeGoalRadius(actor) {
        if (!actor) return 0;
        if (actor.task === "move") return 1;
        if (actor.task === "harvest") return 0;
        if (actor.task === "extinguish") return 1.5;
        if (actor.task === "farm" || actor.task === "plant_tree") return 1.5;
        if (actor.task === "deliver" || actor.task === "build" || actor.task === "facility") return 2.5;
        if (actor.task === "combat") {
            const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
            return Math.max(1, safeNumber(weapon && weapon.range, 1));
        }
        if (actor.task === "siege") {
            const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
            return Math.max(2, safeNumber(weapon && weapon.range, 1));
        }
        return 1;
    }

    function navigationBounds(actor, targetX, targetY) {
        const distance = Math.abs(targetX - actor.x) + Math.abs(targetY - actor.y);
        const margin = Math.max(C.PATH_SEARCH_MARGIN_MIN, Math.min(C.PATH_SEARCH_MARGIN_MAX, Math.ceil(distance / 4)));
        return {
            minX: Math.max(0, Math.min(actor.x, targetX) - margin),
            maxX: Math.min(width - 1, Math.max(actor.x, targetX) + margin),
            minY: Math.max(1, Math.min(actor.y, targetY) - margin),
            maxY: Math.min(height - 1, Math.max(actor.y, targetY) + margin)
        };
    }

    function navigationInBounds(bounds, x, y) {
        return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
    }

    function navigationTunnelAt(actor, x, y) {
        return !!(tunnelAt(x, y) || tunnelAt(x, y - 1));
    }

    function navigationSupportSide(actor, x, y) {
        if (climbSupportAt(actor, x, y, -1)) return -1;
        if (climbSupportAt(actor, x, y, 1)) return 1;
        return 0;
    }

    function navigationPositionSupported(actor, x, y) {
        return actorCanStandAt(actor, x, y) || navigationTunnelAt(actor, x, y) || hasInternalClimbSupport(actor, x, y) || navigationSupportSide(actor, x, y) !== 0;
    }

    function climbSegmentFrom(actor, node, side, bounds) {
        if (!blockingWallAt(actor, node.x + side, node.y) && !blockingWallAt(actor, node.x + side, node.y - 1)) return null;
        if (node.x === actor.x && node.y === actor.y && continuousWallHeight(actor, side) > 6) return null;
        let blockingHeight = 0;
        for (let y = node.y; y >= bounds.minY && (blockingWallAt(actor, node.x + side, y) || blockingWallAt(actor, node.x + side, y - 1)); y--) blockingHeight++;
        if (blockingHeight > 6) return null;
        const segment = [];
        for (let rise = 1; rise <= 6; rise++) {
            const y = node.y - rise;
            if (!navigationInBounds(bounds, node.x, y) || !actorCanOccupyAt(actor, node.x, y) || !climbSupportAt(actor, node.x, y, side)) return null;
            segment.push({x: node.x, y: y, dx: 0, dy: -1, action: "climb", climbSide: side});
            if (navigationInBounds(bounds, node.x + side, y - 1) && actorCanStandAt(actor, node.x + side, y - 1)) {
                segment.push({x: node.x + side, y: y - 1, dx: side, dy: -1, action: "top", climbSide: 0});
                return segment.length <= 6 ? segment : null;
            }
        }
        return null;
    }

    function descentSegmentFrom(actor, node, side, bounds) {
        if (!actorCanStandAt(actor, node.x, node.y) || !actorCanOccupyAt(actor, node.x + side, node.y)) return null;
        if (!blockingWallAt(actor, node.x, node.y + 1)) return null;
        const segment = [{x: node.x + side, y: node.y, dx: side, dy: 0, action: "ledge", climbSide: -side}];
        for (let y = node.y + 1; y <= bounds.maxY; y++) {
            if (!actorCanOccupyAt(actor, node.x + side, y) || !climbSupportAt(actor, node.x + side, y, -side)) return null;
            segment.push({x: node.x + side, y: y, dx: 0, dy: 1, action: "climb", climbSide: -side});
            if (actorCanStandAt(actor, node.x + side, y)) return segment;
        }
        return null;
    }

    function excavationCellCount(actor, x, y) {
        let count = 0;
        const bodyPixels = pixelsAt(x, y);
        for (let i = 0; i < bodyPixels.length; i++) {
            if (canTunnelPixel(bodyPixels[i], actor, true)) count++;
        }
        const headPixels = pixelsAt(x, y - 1);
        for (let i = 0; i < headPixels.length; i++) {
            if (canTunnelPixel(headPixels[i], actor, true)) count++;
        }
        return count;
    }

    function navigationNeighbors(actor, bounds, allowExcavation, node) {
        const edges = [];
        function addEdge(nextNode, action, cost) {
            if (!nextNode || !navigationInBounds(bounds, nextNode.x, nextNode.y)) return;
            const firstAction = action && Array.isArray(action.segment) ? action.segment[0] : action;
            const firstX = firstAction && Number.isFinite(firstAction.x) ? firstAction.x : nextNode.x;
            const firstY = firstAction && Number.isFinite(firstAction.y) ? firstAction.y : nextNode.y;
            const rejectedKey = node.x + "," + node.y + ">" + firstX + "," + firstY + ":" + (firstAction && firstAction.action || "move");
            const rejectedEdges = manager.routeRejectedEdges.get(actor.humanId);
            if (rejectedEdges && rejectedEdges.has(rejectedKey)) return;
            for (let i = 0; i < edges.length; i++) {
                if (edges[i].node.x === nextNode.x && edges[i].node.y === nextNode.y) return;
            }
            edges.push({node: nextNode, action: action, cost: cost});
        }
        for (let side = -1; side <= 1; side += 2) {
            const flatX = node.x + side;
            if (actorCanOccupyAt(actor, flatX, node.y) && navigationPositionSupported(actor, flatX, node.y)) {
                const supportSide = navigationSupportSide(actor, flatX, node.y);
                addEdge({x: flatX, y: node.y}, {dx: side, dy: 0, action: supportSide && !actorCanStandAt(actor, flatX, node.y) ? "climb" : "flat", climbSide: supportSide}, 1);
            }
            if (actorCanStandAt(actor, flatX, node.y - 1)) {
                addEdge({x: flatX, y: node.y - 1}, {dx: side, dy: -1, action: "step", climbSide: 0}, 1.1);
            }
            if (actorCanStandAt(actor, flatX, node.y + 1)) {
                addEdge({x: flatX, y: node.y + 1}, {dx: side, dy: 1, action: "down", climbSide: 0}, 1.1);
            }
            const climbSegment = climbSegmentFrom(actor, node, side, bounds);
            if (climbSegment) {
                const last = climbSegment[climbSegment.length - 1];
                addEdge({x: last.x, y: last.y}, {segment: climbSegment}, climbSegment.length);
            }
            const descentSegment = descentSegmentFrom(actor, node, side, bounds);
            if (descentSegment) {
                const last = descentSegment[descentSegment.length - 1];
                addEdge({x: last.x, y: last.y}, {segment: descentSegment}, descentSegment.length);
            }
        }
        for (let vertical = -1; vertical <= 1; vertical += 2) {
            const y = node.y + vertical;
            if (!actorCanOccupyAt(actor, node.x, y)) continue;
            const internal = hasInternalClimbSupport(actor, node.x, node.y) || hasInternalClimbSupport(actor, node.x, y);
            const side = navigationSupportSide(actor, node.x, y);
            const inTunnel = navigationTunnelAt(actor, node.x, y);
            if (internal || inTunnel || vertical > 0 && side) {
                addEdge({x: node.x, y: y}, {dx: 0, dy: vertical, action: navigationTunnelAt(actor, node.x, y) ? "tunnel_move" : "climb", climbSide: side}, 1);
            }
            else if (vertical > 0) addEdge({x: node.x, y: y}, {dx: 0, dy: 1, action: "fall", climbSide: 0}, 1.25);
        }
        if (allowExcavation) {
            for (let direction = 0; direction < 4; direction++) {
                const dx = direction === 0 ? -1 : (direction === 1 ? 1 : 0);
                const dy = direction === 2 ? -1 : (direction === 3 ? 1 : 0);
                const x = node.x + dx;
                const y = node.y + dy;
                if (!navigationInBounds(bounds, x, y)) continue;
                const cells = excavationCellCount(actor, x, y);
                if (!cells || !excavationPositionPossible(actor, x, y)) continue;
                addEdge({x: x, y: y}, {dx: dx, dy: dy, action: "tunnel", climbSide: 0}, 1 + cells * 12);
            }
        }
        return edges;
    }

    function flattenNavigationPath(path) {
        const flattened = [];
        (path || []).forEach((step) => {
            if (Array.isArray(step.segment)) step.segment.forEach((part) => flattened.push(part));
            else flattened.push(step);
        });
        return flattened;
    }

    function beginNavigationSearch(actor, targetX, targetY, options) {
        const opts = options || {};
        const nav = ensureNavigationState(actor);
        const radius = routeGoalRadius(actor);
        const bounds = navigationBounds(actor, targetX, targetY);
        const allowExcavation = !!opts.allowExcavation;
        const search = Pathfinding.createSearch({
            start: {x: actor.x, y: actor.y},
            maxNodes: C.PATH_SEARCH_MAX_NODES,
            key(node) { return node.x + "," + node.y; },
            isGoal(node) { return Core.distance(node.x, node.y, targetX, targetY) <= radius; },
            heuristic(node) { return Math.max(0, Math.abs(targetX - node.x) + Math.abs(targetY - node.y) - Math.ceil(radius)); },
            neighbors(node) { return navigationNeighbors(actor, bounds, allowExcavation, node); }
        });
        manager.routeSearches.set(actor.humanId, {search: search, targetX: targetX, targetY: targetY, allowExcavation: allowExcavation});
        nav.version = NAVIGATION_SCHEMA_VERSION;
        nav.mode = "astar";
        nav.phase = opts.phase || actor.workTrip && actor.workTrip.phase || (actor.task === "deliver" ? "return" : "outbound");
        nav.taskKey = routeTaskKey(actor, !!opts.away);
        nav.goal = {x: targetX, y: targetY, radius: radius, task: actor.task, targetId: actor.targetId || null, targetKind: actor.targetKind || null};
        nav.path = [];
        nav.pathIndex = 0;
        nav.searchStatus = "searching";
        nav.searchMode = allowExcavation ? "tunnel" : "walk";
        nav.searchExpanded = 0;
        nav.blockedReason = null;
        nav.blockedTicks = 0;
        nav.stallSinceTick = pixelTicks;
        nav.lastProgressTick = safeNumber(nav.lastProgressTick, pixelTicks);
        nav.bounds = bounds;
        if (!allowExcavation) recordPersonLifeEvent(actor, "route_created", {phase: nav.phase, targetX: targetX, targetY: targetY, mode: "astar"});
        return nav;
    }

    function advanceNavigationSearch(actor, targetX, targetY, away) {
        let nav = ensureNavigationState(actor);
        let runtime = manager.routeSearches.get(actor.humanId);
        if (!runtime) {
            nav = beginNavigationSearch(actor, targetX, targetY, {phase: nav.phase, away: away});
            runtime = manager.routeSearches.get(actor.humanId);
        }
        const budget = actor.playerOrder ? C.PATH_SEARCH_PLAYER_NODES_PER_TICK : C.PATH_SEARCH_NODES_PER_TICK;
        Pathfinding.advanceSearch(runtime.search, budget);
        nav.searchExpanded = runtime.search.expanded;
        nav.searchStatus = runtime.search.status;
        if (runtime.search.status === "found") {
            nav.path = flattenNavigationPath(runtime.search.path);
            nav.pathIndex = 0;
            nav.searchStatus = "ready";
            nav.searchMode = runtime.allowExcavation ? "tunnel" : "walk";
            nav.plannedEnd = nav.path.length ? {x: nav.path[nav.path.length - 1].x, y: nav.path[nav.path.length - 1].y} : {x: actor.x, y: actor.y};
            nav.lastProgressTick = pixelTicks;
            manager.routeSearches.delete(actor.humanId);
            return nav;
        }
        if (runtime.search.status === "no_path" || runtime.search.status === "exhausted") {
            const reason = runtime.search.reason;
            manager.routeSearches.delete(actor.humanId);
            if (!runtime.allowExcavation && !away && navigationExcavationAllowed(actor)) {
                nav.replanReason = reason;
                nav = beginNavigationSearch(actor, targetX, targetY, {phase: nav.phase, allowExcavation: true, away: false});
                nav.blockedReason = "walk_route_unavailable";
                return advanceNavigationSearch(actor, targetX, targetY, away);
            }
            nav.searchStatus = "failed";
            nav.blockedReason = reason || "no_path";
        }
        return nav;
    }

    function recordWorkTripStep(actor) {
        const trip = actor && actor.workTrip;
        if (!trip || trip.returning || trip.phase === "return") return;
        if (!Array.isArray(trip.trail)) trip.trail = [];
        const last = trip.trail[trip.trail.length - 1];
        if (!last || last[0] !== actor.x || last[1] !== actor.y) {
            trip.trail.push([actor.x, actor.y]);
            const maximum = Math.max(32, (typeof width === "number" ? width : 96) * 2 + (typeof height === "number" ? height : 64) * 2);
            if (trip.trail.length > maximum) trip.trail.splice(0, trip.trail.length - maximum);
        }
        const head = getBodyHead(actor);
        if (solidGroundAt(actor.x, actor.y) && !tunnelAt(actor.x, actor.y) && !(head && tunnelAt(head.x, head.y))) trip.surfaceAnchorIndex = trip.trail.length - 1;
    }

    function beginCarryDelivery(actor, reason) {
        if (!actor || carriedAmount(actor) <= 0 || actor.task === "deliver") return false;
        const carry = ensureActorCarry(actor);
        const firstKind = Object.keys(carry).find((kind) => carry[kind] > 0);
        const destination = deliveryDestination(actor, firstKind);
        if (!destination) return false;
        actor.resumeAfterDelivery = {
            task: actor.task === "planning" && actor.workTrip && actor.workTrip.resourceKind ? "harvest" : actor.task,
            targetX: actor.targetX === undefined && actor.workTrip && actor.workTrip.excavationFrontier ? actor.workTrip.excavationFrontier.x : actor.targetX,
            targetY: actor.targetY === undefined && actor.workTrip && actor.workTrip.excavationFrontier ? actor.workTrip.excavationFrontier.y : actor.targetY,
            targetId: actor.targetId,
            targetKind: actor.targetKind,
            harvestX: actor.harvestX === undefined && actor.workTrip && actor.workTrip.excavationFrontier ? actor.workTrip.excavationFrontier.harvestX : actor.harvestX,
            harvestY: actor.harvestY === undefined && actor.workTrip && actor.workTrip.excavationFrontier ? actor.workTrip.excavationFrontier.harvestY : actor.harvestY,
            resourceKind: actor.workTrip && actor.workTrip.resourceKind || firstKind,
            excavationFrontier: actor.workTrip && actor.workTrip.excavationFrontier || (Number.isFinite(actor.targetX) ? {x: actor.targetX, y: actor.targetY} : null)
        };
        if (!actor.workTrip) actor.workTrip = {version: 1, resourceKind: firstKind, trail: [[actor.x, actor.y]], surfaceAnchorIndex: solidGroundAt(actor.x, actor.y) ? 0 : null};
        actor.workTrip.phase = "return";
        actor.workTrip.returning = Array.isArray(actor.workTrip.trail) && actor.workTrip.trail.length > 1;
        actor.workTrip.returnCursor = actor.workTrip.returning ? actor.workTrip.trail.length - 2 : -1;
        actor.workTrip.suspendedTask = Object.assign({}, actor.resumeAfterDelivery);
        recordPersonLifeEvent(actor, "return_started", {reason: reason || "backpack_ready", destinationBuildingId: destination.buildingId || null});
        setTask(actor, "deliver", destination);
        const nav = ensureNavigationState(actor);
        nav.phase = "return";
        return true;
    }

    function followReturnTrail(actor) {
        const trip = actor && actor.workTrip;
        if (!trip || !trip.returning || !Array.isArray(trip.trail)) return null;
        while (trip.returnCursor >= 0) {
            const point = trip.trail[trip.returnCursor];
            if (point && point[0] === actor.x && point[1] === actor.y) trip.returnCursor--;
            else break;
        }
        if (trip.returnCursor < 0) {
            trip.returning = false;
            invalidateNavigation(actor);
            return null;
        }
        const point = trip.trail[trip.returnCursor];
        const dx = point[0] - actor.x;
        const dy = point[1] - actor.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1 || !executeNavigationEdge(actor, dx, dy, tunnelAt(point[0], point[1]) ? "tunnel" : "return", 0)) {
            trip.returning = false;
            trip.returnBroken = true;
            invalidateNavigation(actor, "recorded_return_path_blocked");
            const nav = beginNavigationSearch(actor, actor.targetX, actor.targetY, {phase: "return"});
            nav.blockedReason = "recorded_return_path_blocked";
            recordPersonLifeEvent(actor, "return_broken", {atX: actor.x, atY: actor.y, repair: "astar"});
            return false;
        }
        trip.returnCursor--;
        setPersonActivityPhase(actor, "return");
        return true;
    }

    function routeStillTargets(actor, nav, targetX, targetY, away) {
        if (!nav || nav.taskKey !== routeTaskKey(actor, away) || !nav.goal) return false;
        if (nav.searchStatus === "searching") return Core.distance(nav.goal.x, nav.goal.y, targetX, targetY) <= Math.max(1, nav.goal.radius);
        const end = nav.plannedEnd || nav.goal;
        return Core.distance(end.x, end.y, targetX, targetY) <= nav.goal.radius;
    }

    function chooseEscapeDestination(actor, threatX, threatY) {
        let best = null;
        let bestScore = -Infinity;
        for (let x = Math.max(0, actor.x - 8); x <= Math.min(width - 1, actor.x + 8); x++) {
            const y = findSurfaceY(x, actor.y);
            if (y === null || !actorCanStandAt(actor, x, y)) continue;
            const threatDistance = Core.distance(x, y, threatX, threatY);
            const travelDistance = Core.distance(actor.x, actor.y, x, y);
            const score = threatDistance * 100 - travelDistance;
            if (score > bestScore) {
                best = {x: x, y: y};
                bestScore = score;
            }
        }
        return best;
    }

    function plannedStepValid(actor, step) {
        if (!step || Math.abs(step.x - actor.x) + Math.abs(step.y - actor.y) > 2) return false;
        if (step.action === "tunnel") return actorCanOccupyAt(actor, step.x, step.y) || excavationCellCount(actor, step.x, step.y) > 0;
        if (!actorCanOccupyAt(actor, step.x, step.y)) return false;
        if (step.action === "step" || step.action === "down" || step.action === "top") return actorCanStandAt(actor, step.x, step.y);
        if (step.action === "fall") return actorCanOccupyAt(actor, step.x, step.y);
        if (step.action === "ledge") return actorCanOccupyAt(actor, step.x, step.y) && !!blockingWallAt(actor, actor.x, actor.y + 1);
        if (step.action === "climb") return hasInternalClimbSupport(actor, actor.x, actor.y) || hasInternalClimbSupport(actor, step.x, step.y) || navigationSupportSide(actor, step.x, step.y) !== 0;
        return navigationPositionSupported(actor, step.x, step.y);
    }

    function executePlannedNavigationStep(actor, step) {
        const nav = ensureNavigationState(actor);
        const dx = step.x - actor.x;
        const dy = step.y - actor.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy)) return false;
        if (step.action === "tunnel") {
            const beforeX = actor.x;
            const beforeY = actor.y;
            nav.forceTunnel = true;
            const progressed = actorCanOccupyAt(actor, step.x, step.y) ? executeNavigationEdge(actor, dx, dy, "tunnel", 0) : digToward(actor, getRelation(actor._r), step.x, step.y);
            if (actor.x === step.x && actor.y === step.y) {
                nav.pathIndex++;
                nav.forceTunnel = false;
                nav.lastProgressTick = pixelTicks;
                actor.navigationFailureCount = 0;
            }
            else if (actor.x !== beforeX || actor.y !== beforeY) nav.lastProgressTick = pixelTicks;
            if (actor.x !== beforeX || actor.y !== beforeY || progressed) actor.navigationLastProgressTick = pixelTicks;
            return progressed;
        }
        if (!plannedStepValid(actor, step)) return false;
        if (!executeNavigationEdge(actor, dx, dy, step.action || "flat", step.climbSide || 0)) return false;
        nav.pathIndex++;
        nav.lastProgressTick = pixelTicks;
        actor.navigationFailureCount = 0;
        actor.navigationLastProgressTick = pixelTicks;
        return true;
    }

    function failNavigation(actor, reason) {
        const nav = ensureNavigationState(actor);
        nav.searchStatus = "failed";
        nav.blockedReason = reason || nav.blockedReason || "unreachable";
        if (actor.task === "patrol") {
            // A patrol waypoint is disposable. Keep the guard on duty and pick
            // another point at the next action step instead of ending patrol.
            actor.patrolX = undefined;
            actor.patrolY = undefined;
            actor.targetX = undefined;
            actor.targetY = undefined;
            actor.navigationAway = false;
            actor.navigationFailureCount = 0;
            actor.navigationLastProgressTick = pixelTicks;
            invalidateNavigation(actor, reason || nav.blockedReason || "unreachable");
            setPersonActivityPhase(actor, "patrolling");
            return false;
        }
        if (actor.task === "harvest") {
            blockFailedResource(actor, actor.harvestX, actor.harvestY, actor.targetKind);
        }
        if (actor.task !== "deliver" && carriedAmount(actor) > 0 && beginCarryDelivery(actor, "target_unreachable")) return false;
        if (actor.playerOrder) clearPlayerOrder(actor, "failed", "unreachable");
        else clearTask(actor, "failed", "unreachable", {targetX: actor.targetX, targetY: actor.targetY});
        return false;
    }

    function moveRelationToward(actor, targetX, targetY, away) {
        if (deferAdultLocomotion) {
            actor.targetX = targetX;
            actor.targetY = targetY;
            actor.navigationAway = !!away;
            return false;
        }
        if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
            if (actor.playerOrder) clearPlayerOrder(actor, "failed", "invalid_navigation_target");
            else clearTask(actor, "failed", "invalid_navigation_target");
            return false;
        }
        if (away) {
            const escape = chooseEscapeDestination(actor, targetX, targetY);
            if (!escape || Core.distance(escape.x, escape.y, targetX, targetY) <= Core.distance(actor.x, actor.y, targetX, targetY)) return false;
            targetX = escape.x;
            targetY = escape.y;
        }
        const trailResult = actor.task === "deliver" ? followReturnTrail(actor) : null;
        if (trailResult !== null) return trailResult;
        let nav = ensureNavigationState(actor);
        if (!routeStillTargets(actor, nav, targetX, targetY, !!away)) {
            actor.navigationFailureCount = 0;
            actor.navigationLastProgressTick = pixelTicks;
            invalidateNavigation(actor, nav.goal ? "goal_changed" : "new_goal");
            nav = beginNavigationSearch(actor, targetX, targetY, {phase: actor.task === "deliver" ? "return" : actor.workTrip && actor.workTrip.resuming ? "resume" : "outbound", away: away});
        }
        if (pixelTicks - safeNumber(actor.navigationLastProgressTick, pixelTicks) >= C.NAVIGATION_STALL_TICKS) return failNavigation(actor, "navigation_stalled");
        if (nav.searchStatus === "idle" || nav.searchStatus === "searching") nav = advanceNavigationSearch(actor, targetX, targetY, !!away);
        if (nav.searchStatus === "searching") return false;
        if (nav.searchStatus === "failed") return failNavigation(actor, nav.blockedReason);
        if (nav.pathIndex >= nav.path.length) {
            if (Core.distance(actor.x, actor.y, targetX, targetY) <= routeGoalRadius(actor)) return false;
            invalidateNavigation(actor, "path_complete_before_goal");
            beginNavigationSearch(actor, targetX, targetY, {phase: nav.phase, away: away});
            return false;
        }
        const step = nav.path[nav.pathIndex];
        const building = corridorBuildingAt(actor, step.x, step.y);
        if (building && building.factionId !== actor.factionId && atWar(actor.factionId, building.factionId)) {
            setTask(actor, "siege", building);
            return false;
        }
        if (building) {
            invalidateNavigation(actor, "building");
            return false;
        }
        if (executePlannedNavigationStep(actor, step)) return true;
        actor.navigationFailureCount = safeNumber(actor.navigationFailureCount, 0) + 1;
        if (!manager.routeRejectedEdges.has(actor.humanId)) manager.routeRejectedEdges.set(actor.humanId, new Set());
        manager.routeRejectedEdges.get(actor.humanId).add(actor.x + "," + actor.y + ">" + step.x + "," + step.y + ":" + (step.action || "move"));
        if (actor.navigationFailureCount >= 24) return failNavigation(actor, "next_edge_repeatedly_invalid");
        invalidateNavigation(actor, "next_edge_invalid");
        const replacement = beginNavigationSearch(actor, targetX, targetY, {phase: nav.phase, away: away});
        replacement.blockedReason = "next_edge_invalid";
        replacement.lastInvalidStep = cloneActivityValue(step);
        return false;
    }

    function visionRangeFor(actor) {
        const faction = actor && manager.factionById.get(actor.factionId);
        const index = eraIndexFor(faction);
        const era = eraDefinition(ERA_ORDER[index]);
        return safeNumber(era && era.vision, safeNumber((TechData.DEFAULT_VISION || [8])[index], 8));
    }

    function lineCellTransparency(x, y) {
        const pixels = pixelsAt(x, y);
        if (!pixels.length) return 1;
        let transparency = 1;
        for (let i = 0; i < pixels.length; i++) {
            const pixel = pixels[i];
            if (!pixel || pixel.del) continue;
            const info = elements[pixel.element] || {};
            if (pixel.nonBlocking === true || info.nonBlocking === true || (typeof isNonBlockingPixel === "function" && isNonBlockingPixel(pixel))) continue;
            if (typeof isCreaturePixel === "function" && isCreaturePixel(pixel)) continue;
            if (typeof isPassableVegetationPixel === "function" && isPassableVegetationPixel(pixel)) {
                transparency *= 0.72;
                continue;
            }
            if (OBSCURING_ELEMENTS.has(pixel.element)) {
                transparency *= 0.3;
                continue;
            }
            if (info.state === "gas") {
                transparency *= safeNumber(info.alpha, 0.75);
                continue;
            }
            if (info.state === "solid" || info.state === "liquid") return 0;
        }
        return transparency;
    }

    function lineTransparencyBetween(source, target) {
        if (!source || !target) return 0;
        if (Core.lineOfSightTransparency) return Core.lineOfSightTransparency(source.x, source.y - 1, target.x, target.y - 1, lineCellTransparency);
        return 1;
    }

    function mutualLineOfSight(source, target) {
        if (!source || !target) return false;
        const distance = Core.distance(source.x, source.y, target.x, target.y);
        const weapon = weaponDescriptor(source.weapon);
        const combatVision = Math.max(visionRangeFor(source), safeNumber(weapon && weapon.range, 1));
        if (distance > combatVision) return false;
        const transparency = lineTransparencyBetween(source, target);
        if (Core.hasLineOfSight) return Core.hasLineOfSight(source.x, source.y - 1, target.x, target.y - 1, lineCellTransparency, 0.16);
        return transparency >= 0.16;
    }

    function rangedAccuracy(actor, target, weapon, visibility) {
        return 0.5;
    }

    function attackBox(actor, weapon) {
        const radius = Math.max(1, Math.floor(safeNumber(weapon && weapon.range, 1)));
        return {minX: actor.x - radius, maxX: actor.x + radius, minY: actor.y - radius, maxY: actor.y + radius};
    }

    function targetInAttackBox(actor, target, weapon) {
        const box = attackBox(actor, weapon);
        return target.x >= box.minX && target.x <= box.maxX && target.y >= box.minY && target.y <= box.maxY;
    }

    function lockCombatTarget(actor, target) {
        if (!actor || !target || getPeaceMode() === "full-peace") return false;
        const existing = Number.isFinite(actor.combatTargetId) ? manager.actorById.get(actor.combatTargetId) : null;
        if (existing && !existing.dead && !existing.del && existing.factionId !== actor.factionId) return existing.humanId === target.humanId;
        actor.combatTargetId = target.humanId;
        setTask(actor, "combat", target);
        return true;
    }

    function retaliationAllowed(actor, target) {
        return !!(getPeaceMode() !== "full-peace" && actor && target && actor.underAttackUntil > pixelTicks && actor.combatTargetId === target.humanId);
    }

    function queueRangedAttack(actor, target, weapon) {
        if (!actor || !target || !weapon || actor.dead || target.dead || actor.factionId === target.factionId || (!atWar(actor.factionId, target.factionId) && !retaliationAllowed(actor, target))) return false;
        if (!targetInAttackBox(actor, target, weapon) || !mutualLineOfSight(actor, target)) return false;
        if (actor.strikeDueTick === pixelTicks + 1 && actor.strikeTargetId === target.humanId) return false;
        actor.strikeDueTick = pixelTicks + 1;
        actor.strikeTargetId = target.humanId;
        manager.pendingAttacks.push({attackerId: actor.humanId, targetId: target.humanId, dueTick: pixelTicks + 1, ranged: true, scheduledTick: pixelTicks});
        lockCombatTarget(target, actor);
        target.underAttackUntil = pixelTicks + 90;
        manager.visualProjectiles.add({
            x0: actor.x,
            y0: actor.y - 0.5,
            x1: target.x,
            y1: target.y - 0.5,
            startTick: pixelTicks,
            dueTick: pixelTicks + 1,
            color: actor.weapon === "crossbow" ? "#d9d1bd" : "#c5a56b"
        });
        return true;
    }

    function queueAttack(actor, target) {
        if (!actor || !target || actor.dead || target.dead) return false;
        if (actor.factionId === target.factionId || (!atWar(actor.factionId, target.factionId) && !retaliationAllowed(actor, target))) return false;
        const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
        if (weapon && weapon.ranged) return queueRangedAttack(actor, target, weapon);
        if (!targetInAttackBox(actor, target, weapon)) return false;
        if (actor.strikeDueTick === pixelTicks + 1 && actor.strikeTargetId === target.humanId) return false;
        actor.strikeDueTick = pixelTicks + 1;
        actor.strikeTargetId = target.humanId;
        manager.pendingAttacks.push({attackerId: actor.humanId, targetId: target.humanId, dueTick: pixelTicks + 1, ranged: false, scheduledTick: pixelTicks});
        lockCombatTarget(target, actor);
        target.underAttackUntil = pixelTicks + 90;
        return true;
    }

    function queueStructureAttack(actor, target) {
        if (!actor || !target || actor.dead || target.del || !atWar(actor.factionId, target.factionId)) return false;
        const strikeKey = Number.isFinite(target.buildingId) ? "building:" + target.buildingId : target.element + "@" + target.x + "," + target.y;
        if (actor.structureStrikeDueTick === pixelTicks + 1 && actor.structureStrikeKey === strikeKey) return false;
        actor.structureStrikeDueTick = pixelTicks + 1;
        actor.structureStrikeKey = strikeKey;
        manager.pendingStructureAttacks.push({attackerId: actor.humanId, target: target, dueTick: pixelTicks + 1, scheduledTick: pixelTicks});
        return true;
    }

    function adjacentEnemyStructure(actor, range) {
        const radius = Math.max(1, Math.ceil(range));
        let nearest = null;
        let bestDistance = Infinity;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const distance = Math.hypot(dx, dy);
                if (distance === 0 || distance > range) continue;
                const cellPixels = pixelsAt(actor.x + dx, actor.y + dy);
                for (let index = 0; index < cellPixels.length; index++) {
                    const pixel = cellPixels[index];
                    if (!pixel || pixel.del || !Number.isFinite(pixel.factionId) || !atWar(actor.factionId, pixel.factionId)) continue;
                    if (pixel.element !== "civ_banner" && pixel.element !== "civ_construction" && !STRUCTURE_CORES.has(pixel.element) && !STRUCTURE_PARTS.has(pixel.element)) continue;
                    if (distance < bestDistance) {
                        nearest = pixel;
                        bestDistance = distance;
                    }
                }
            }
        }
        return nearest;
    }

    function runAdultAction(actor) {
        if (actor.task !== "deliver" && actor.task !== "combat" && actor.task !== "siege" && actor.task !== "flee" && actor.task !== "extinguish" && carriedAmount(actor) >= carryCapacityFor(actor)) {
            beginCarryDelivery(actor, "backpack_full");
        }
        if (actor.task === "move") {
            if (!Number.isFinite(actor.targetX) || !Number.isFinite(actor.targetY)) return clearPlayerOrder(actor, "failed", "invalid_destination");
            if (Core.distance(actor.x, actor.y, actor.targetX, actor.targetY) <= 1) return clearPlayerOrder(actor, "completed", "destination_reached");
            moveRelationToward(actor, actor.targetX, actor.targetY, false);
            return;
        }
        if (actor.task === "harvest") {
            if (!harvestTarget(actor)) moveRelationToward(actor, actor.targetX, actor.targetY, false);
            else if (actor.task === "harvest") setPersonActivityPhase(actor, "working");
            return;
        }
        if (actor.task === "extinguish") {
            if (!extinguishTarget(actor) && actor.task === "extinguish") moveRelationToward(actor, actor.targetX, actor.targetY, false);
            else if (actor.task === "extinguish") setPersonActivityPhase(actor, "working");
            return;
        }
        const banner = settlementForActor(actor);
        if (actor.task === "deliver") {
            const destination = getBuildingById(actor.targetId) || banner;
            if (!destination) return clearTask(actor, "failed", "delivery_destination_lost");
            if (actor.targetId !== destination.buildingId && destination.buildingId) setTask(actor, "deliver", destination);
            if (!deliverCarry(actor, destination)) moveRelationToward(actor, destination.x, destination.y, false);
            return;
        }
        if (actor.task === "build") {
            const site = Array.from(manager.constructionSites).find((candidate) => candidate.buildingId === actor.targetId);
            if (!site || site.del) {
                const completed = getBuildingById(actor.targetId);
                return clearTask(actor, completed && completed.buildingState === "complete" ? "completed" : "interrupted", completed && completed.buildingState === "complete" ? "building_completed" : "construction_unavailable", {buildingId: actor.targetId});
            }
            if (Core.distance(actor.x, actor.y, site.x, site.y) <= 2.5) advanceConstruction(site, actor);
            else moveRelationToward(actor, site.x, site.y, false);
            return;
        }
        if (actor.task === "farm") {
            const faction = manager.factionById.get(actor.factionId);
            const farm = faction && faction.farms.find((candidate) => candidate.buildingId === actor.targetId) || (faction && faction.farms[0]);
            handleFarmTask(actor, farm, banner);
            if (actor.task === "farm") moveRelationToward(actor, actor.targetX, actor.targetY, false);
            return;
        }
        if (actor.task === "plant_tree") {
            handlePlantTreeTask(actor, banner);
            return;
        }
        if (actor.task === "wait_tree_growth") {
            if (pixelTicks >= safeNumber(actor.treeGrowthReadyTick, 0)) {
                delete actor.treeGrowthReadyTick;
                clearTask(actor, "completed", "tree_growth_recheck");
            }
            else setPersonActivityPhase(actor, "waiting");
            return;
        }
        if (actor.task === "facility") {
            const facility = getBuildingById(actor.targetId);
            if (!facility || facility.del) return clearTask(actor, "interrupted", "facility_destroyed");
            if (facility.factionId !== actor.factionId) return clearTask(actor, "interrupted", "facility_captured");
            if (!actorCanStaffFacility(actor, facility)) return clearTask(actor, "interrupted", "facility_not_usable");
            if (Core.distance(actor.x, actor.y, facility.x, facility.y) > 2.5) moveRelationToward(actor, facility.x, facility.y, false);
            else setPersonActivityPhase(actor, "working");
            return;
        }
        if (actor.task === "combat") {
            const target = manager.actorById.get(actor.targetId);
            if (!target || target.dead || target.factionId === actor.factionId || (!atWar(actor.factionId, target.factionId) && !retaliationAllowed(actor, target))) {
                actor.combatTargetId = undefined;
                const reason = target && target.dead ? "target_defeated" : (!target ? "target_lost" : (target.factionId === actor.factionId ? "allegiance_changed" : "hostility_ended"));
                return clearTask(actor, target && target.dead || reason === "hostility_ended" ? "completed" : "interrupted", reason);
            }
            if (actor.warRole === "defender" && (!manager.territory || manager.territory.ownerAt(target.x) !== actor.factionId)) return clearTask(actor, "completed", "target_left_territory");
            const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
            if (targetInAttackBox(actor, target, weapon) && (!weapon.ranged || mutualLineOfSight(actor, target))) { setPersonActivityPhase(actor, "attacking"); queueAttack(actor, target); }
            else moveRelationToward(actor, target.x, target.y, false);
            return;
        }
        if (actor.task === "siege") {
            const target = getBuildingById(actor.targetId) || (Number.isFinite(actor.targetX) && Number.isFinite(actor.targetY) ? pixelsAt(actor.targetX, actor.targetY).find((pixel) => pixel && pixel.element === actor.targetKind && atWar(actor.factionId, pixel.factionId)) : null);
            if (!target) return clearTask(actor, "completed", "structure_destroyed");
            if (target.element !== actor.targetKind) return clearTask(actor, "completed", "structure_destroyed");
            if (!atWar(actor.factionId, target.factionId)) return clearTask(actor, "interrupted", "war_ended");
            const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
            const structureRange = Math.max(2, weapon.range);
            const obstruction = adjacentEnemyStructure(actor, structureRange);
            if (obstruction) { setPersonActivityPhase(actor, "attacking"); queueStructureAttack(actor, obstruction); }
            else if (Core.distance(actor.x, actor.y, target.x, target.y) <= structureRange) { setPersonActivityPhase(actor, "attacking"); queueStructureAttack(actor, target); }
            else moveRelationToward(actor, target.x, target.y, false);
            return;
        }
        if (actor.task === "flee") {
            const target = manager.actorById.get(actor.targetId);
            if (!target || target.dead) return clearTask(actor, "completed", "threat_ended");
            moveRelationToward(actor, target.x, target.y, true);
            return;
        }
        if (actor.task === "return" || actor.task === "patrol") {
            if (!banner) return clearTask(actor, "interrupted", "settlement_unavailable");
            if (actor.warRole === "defender" && manager.territory && manager.territory.ownerAt(actor.x) !== actor.factionId) {
                moveRelationToward(actor, banner.x, banner.y, false);
                return;
            }
            if (actor.task === "return") {
                if (Core.distance(actor.x, actor.y, banner.x, banner.y) > 2) moveRelationToward(actor, banner.x, banner.y, false);
                else clearTask(actor, "completed", "returned_home");
                return;
            }
            if (!Number.isFinite(actor.patrolX) || !Number.isFinite(actor.patrolY) || Core.distance(actor.x, actor.y, actor.patrolX, actor.patrolY) <= 1.5) {
                const halfWidth = Math.max(2, C.TERRITORY_HALF_WIDTH - 1);
                let patrolX = banner.x + Math.floor(Math.random() * (halfWidth * 2 + 1)) - halfWidth;
                if (manager.territory && manager.territory.ownerAt(patrolX) !== actor.factionId) patrolX = banner.x;
                const patrolTarget = findNearbySurfaceTarget(patrolX, banner.y, actor.x, actor.y);
                actor.patrolX = patrolTarget.x;
                actor.patrolY = patrolTarget.y;
            }
            setPersonActivityPhase(actor, "patrolling");
            moveRelationToward(actor, actor.patrolX, actor.patrolY, false);
            return;
        }
        if (actor.task === "search_resource" || actor.task === "explore" || actor.task === "wander" || actor.task === "idle" || actor.task === "planning") {
            if (!Number.isFinite(actor.searchX) || !Number.isFinite(actor.searchY) || Core.distance(actor.x, actor.y, actor.searchX, actor.searchY) <= 1.5) {
                const originX = banner ? banner.x : actor.x;
                const radius = banner ? Math.max(C.EXTENDED_RESOURCE_RADIUS, C.TERRITORY_HALF_WIDTH) : 8;
                const searchX = originX + Math.floor(Math.random() * (radius * 2 + 1)) - radius;
                const searchTarget = findNearbySurfaceTarget(searchX, banner ? banner.y : actor.y, actor.x, actor.y);
                actor.searchX = searchTarget.x;
                actor.searchY = searchTarget.y;
            }
            setPersonActivityPhase(actor, actor.task === "search_resource" ? "searching" : "exploring");
            moveRelationToward(actor, actor.searchX, actor.searchY, false);
        }
    }

    function pairInfo(factionA, factionB) {
        const a = Number(factionA);
        const b = Number(factionB);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
        return a < b ? {a: a, b: b, key: a + ":" + b} : {a: b, b: a, key: b + ":" + a};
    }

    function firstBanner(factionId) {
        const faction = manager.factionById.get(factionId);
        return faction && faction.settlements.length ? (faction.settlements.find((settlement) => settlement.townCenterActive !== false) || faction.settlements[0]) : null;
    }

    function loadPairRecord(info, create) {
        if (!info) return null;
        let record = manager.relationRecords.get(info.key);
        const bannerA = firstBanner(info.a);
        const bannerB = firstBanner(info.b);
        if (!record && bannerA && bannerA.diplomacy && bannerA.diplomacy[info.b]) record = bannerA.diplomacy[info.b];
        if (!record && bannerB && bannerB.diplomacy && bannerB.diplomacy[info.a]) record = bannerB.diplomacy[info.a];
        if (!record && create) {
            record = {factionA: info.a, factionB: info.b, hostility: 0, atWar: false};
        }
        if (record) {
            record.factionA = info.a;
            record.factionB = info.b;
            manager.relationRecords.set(info.key, record);
        }
        return record || null;
    }

    function savePairRecord(info, record) {
        if (!info || !record) return;
        manager.relationRecords.set(info.key, record);
        const bannerA = firstBanner(info.a);
        const bannerB = firstBanner(info.b);
        if (bannerA) {
            if (!bannerA.diplomacy || typeof bannerA.diplomacy !== "object") bannerA.diplomacy = {};
            bannerA.diplomacy[info.b] = record;
        }
        if (bannerB) {
            if (!bannerB.diplomacy || typeof bannerB.diplomacy !== "object") bannerB.diplomacy = {};
            bannerB.diplomacy[info.a] = record;
        }
    }

    function normalizePeaceMode(value) {
        return value === "no-new-wars" || value === "full-peace" ? value : "normal";
    }

    function getPeaceMode() {
        if (typeof settings === "undefined" || !settings) return "normal";
        return normalizePeaceMode(settings.humanSocietyPeaceMode);
    }

    function recordedWarActive(record) {
        return !!(record && record.atWar && !record.surrendered);
    }

    function effectiveWarActive(record) {
        return recordedWarActive(record) && getPeaceMode() !== "full-peace";
    }

    function cancelPendingAttacksFor(actor) {
        if (!actor) return;
        manager.pendingAttacks = manager.pendingAttacks.filter((intent) => intent.attackerId !== actor.humanId && intent.targetId !== actor.humanId);
        manager.pendingStructureAttacks = manager.pendingStructureAttacks.filter((intent) => intent.attackerId !== actor.humanId);
        manager.pendingRangedImpacts = manager.pendingRangedImpacts.filter((intent) => intent.attackerId !== actor.humanId && intent.targetId !== actor.humanId);
        delete actor.strikeDueTick;
        delete actor.strikeTargetId;
        delete actor.structureStrikeDueTick;
        delete actor.structureStrikeKey;
    }

    function applyFullPeaceState() {
        manager.pendingAttacks.length = 0;
        manager.pendingStructureAttacks.length = 0;
        manager.pendingRangedImpacts.length = 0;
        manager.visualProjectiles.clear();
        manager.actors.forEach((actor) => {
            if (!actor || actor.del || actor.dead) return;
            cancelPendingAttacksFor(actor);
            delete actor.combatTargetId;
            delete actor.underAttackUntil;
            delete actor.warRole;
            delete actor.warFrontId;
            if (actor.task === "combat" || actor.task === "siege" || actor.task === "flee") clearTask(actor, "interrupted", "peace_mode");
        });
    }

    function clearScarcityTimers() {
        manager.settlements.forEach((banner) => {
            if (banner && banner.resourceScarcity) banner.resourceScarcity = {};
        });
    }

    function setPeaceMode(value) {
        const next = normalizePeaceMode(value);
        const previous = getPeaceMode();
        if (typeof settings !== "undefined" && settings) settings.humanSocietyPeaceMode = next;
        if (previous !== "full-peace" && next === "full-peace") {
            manager.relationRecords.forEach((record) => {
                if (recordedWarActive(record) && !Number.isFinite(record.peacePausedTick)) record.peacePausedTick = pixelTicks;
            });
            applyFullPeaceState();
        }
        else if (previous === "full-peace" && next !== "full-peace") {
            manager.relationRecords.forEach((record) => {
                if (!Number.isFinite(record.peacePausedTick)) return;
                const duration = Math.max(0, pixelTicks - record.peacePausedTick);
                if (Number.isFinite(record.declaredTick)) record.declaredTick += duration;
                if (Number.isFinite(record.imbalanceSince)) record.imbalanceSince += duration;
                delete record.peacePausedTick;
            });
        }
        if (next !== "normal") clearScarcityTimers();
        if (typeof saveSettings === "function") saveSettings();
        return next;
    }

    function atWar(factionA, factionB) {
        const info = pairInfo(factionA, factionB);
        const record = loadPairRecord(info, false);
        return effectiveWarActive(record);
    }

    function activeEnemyFactionIds(factionId) {
        const enemies = [];
        manager.relationRecords.forEach((record) => {
            if (!effectiveWarActive(record)) return;
            if (record.factionA === factionId) enemies.push(record.factionB);
            else if (record.factionB === factionId) enemies.push(record.factionA);
        });
        return enemies.filter((id, index, array) => array.indexOf(id) === index).sort((a, b) => a - b);
    }

    function declareWar(attackerFactionId, defenderFactionId, reason) {
        if (getPeaceMode() !== "normal") return false;
        const info = pairInfo(attackerFactionId, defenderFactionId);
        if (!info || !manager.factionById.has(Number(attackerFactionId)) || !manager.factionById.has(Number(defenderFactionId))) return false;
        const record = loadPairRecord(info, true);
        if (record.atWar && !record.surrendered) return true;
        record.atWar = true;
        record.surrendered = false;
        record.permanent = true;
        record.declaredTick = pixelTicks;
        record.lastWarTick = pixelTicks;
        record.aggressorFactionId = Number(attackerFactionId);
        record.defenderFactionId = Number(defenderFactionId);
        record.reason = reason === "manual" ? "manual" : "resource_exhaustion";
        record.startAdultsA = manager.factionById.get(info.a).adultPopulation;
        record.startAdultsB = manager.factionById.get(info.b).adultPopulation;
        delete record.imbalanceSince;
        savePairRecord(info, record);
        [Number(attackerFactionId), Number(defenderFactionId)].forEach((factionId) => {
            const banner = firstBanner(factionId);
            if (banner) {
                banner.lastWarTick = pixelTicks;
                if (!banner.warState || typeof banner.warState !== "object") banner.warState = {wave: 1, initialized: false};
                logSettlementEvent(banner, "war", (record.reason === "manual" ? "被手动卷入战争" : "因不可再生资源枯竭进入战争") + "：对阵阵营 " + (factionId === Number(attackerFactionId) ? defenderFactionId : attackerFactionId), {enemyFactionId: factionId === Number(attackerFactionId) ? Number(defenderFactionId) : Number(attackerFactionId), reason: record.reason});
            }
        });
        return true;
    }

    function recordIncident(factionA, factionB, type, amount) {
        const info = pairInfo(factionA, factionB);
        if (!info) return null;
        const record = loadPairRecord(info, true);
        let incidentAmount = amount;
        if (!Number.isFinite(incidentAmount) && type === "theft") incidentAmount = C.STARVING_TRESPASS_HOSTILITY || 15;
        if (Core.applyHostility) {
            Core.applyHostility(record, {type: type, amount: incidentAmount, tick: pixelTicks});
        }
        else {
            const fallbackAmounts = {theft: 15, hit: 20, kill: 35};
            record.hostility = Math.min(100, Math.max(0, (record.hostility || 0) + (incidentAmount || fallbackAmounts[type] || 0)));
            record.lastIncidentTick = pixelTicks;
            if (type === "hit" || type === "kill") record.lastAttackTick = pixelTicks;
        }
        savePairRecord(info, record);
        return record;
    }

    function territoriesOverlap(bannerA, bannerB) {
        if (!bannerA || !bannerB || bannerA.del || bannerB.del) return false;
        const totalRadius = (bannerA.territoryRadius || C.TERRITORY_BASE_RADIUS) + (bannerB.territoryRadius || C.TERRITORY_BASE_RADIUS);
        return Core.distance(bannerA.x, bannerA.y, bannerB.x, bannerB.y) <= totalRadius;
    }

    function factionLossRatio(record, side, currentAdults) {
        const start = Number(record[side === "A" ? "startAdultsA" : "startAdultsB"]);
        if (!Number.isFinite(start) || start <= 0) return 0;
        return Math.max(0, Math.min(1, (start - currentAdults) / start));
    }

    function nonrenewableDemanded(faction, kind) {
        const stock = faction.settlements.reduce((total, settlement) => total + materialAmount(ensureStock(settlement), kind), 0);
        const activeCost = faction.constructionSites.reduce((total, site) => total + safeNumber(site.costs && site.costs[kind], 0), 0);
        if (activeCost > stock) return true;
        if (kind === "stone") return eraIndexFor(faction) >= 1 && stock < 12;
        if (kind === "copper") return hasTech(faction, "copper_prospecting") && stock < 8;
        if (kind === "raw_iron") return hasTech(faction, "iron_prospecting") && stock < 8;
        return false;
    }

    function stepResourceExhaustionWars(faction) {
        if (getPeaceMode() !== "normal") return;
        const banner = faction && faction.settlements[0];
        if (!banner || factionIsAtWar(faction.id)) return;
        if (!banner.resourceScarcity || typeof banner.resourceScarcity !== "object") banner.resourceScarcity = {};
        for (const kind of NONRENEWABLE_KINDS) {
            if (!nonrenewableDemanded(faction, kind)) { delete banner.resourceScarcity[kind]; continue; }
            const nodes = manager.resourceIndex.get(kind) || [];
            const accessible = nodes.some((node) => {
                const owner = manager.territory && manager.territory.ownerAt(node.x);
                return owner === faction.id || owner === null || owner === undefined;
            });
            if (accessible) { delete banner.resourceScarcity[kind]; continue; }
            if (!Number.isFinite(banner.resourceScarcity[kind])) banner.resourceScarcity[kind] = pixelTicks;
            if (pixelTicks - banner.resourceScarcity[kind] < C.RESOURCE_EXHAUSTION_TICKS) continue;
            const owners = new Map();
            nodes.forEach((node) => {
                const owner = manager.territory && manager.territory.ownerAt(node.x);
                if (owner !== null && owner !== undefined && owner !== faction.id) owners.set(owner, safeNumber(owners.get(owner), 0) + 1);
            });
            let target = Array.from(owners.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
            if (!target) {
                const rivals = Array.from(manager.factionById.values()).filter((other) => other.id !== faction.id && other.settlements.length);
                rivals.sort((a, b) => {
                    const bannerA = a.settlements[0];
                    const bannerB = b.settlements[0];
                    return Core.distance(banner.x, banner.y, bannerA.x, bannerA.y) - Core.distance(banner.x, banner.y, bannerB.x, bannerB.y) || a.id - b.id;
                });
                if (rivals.length) target = [rivals[0].id, 0];
            }
            if (target && declareWar(faction.id, target[0], "resource_exhaustion")) {
                banner.resourceScarcity[kind] = pixelTicks;
                return;
            }
        }
    }

    function ruinPixel(pixel) {
        if (!pixel || pixel.del) return;
        if (isBuildingCorePixel(pixel)) {
            destroyBuilding(pixel, "destroyed");
            return;
        }
        if (pixel.element === "civ_construction") {
            cancelConstruction(pixel);
            return;
        }
        if (pixel.element === "civ_banner" || STRUCTURE_CORES.has(pixel.element)) {
            changePixel(pixel, "civ_ruin");
        }
        else if (STRUCTURE_PARTS.has(pixel.element)) {
            const debris = pixel.element === "civ_structure_wood" ? "sawdust" : "gravel";
            if (elements[debris]) changePixel(pixel, debris);
            else deleteExactPixel(pixel);
        }
        else {
            delete pixel.factionId;
            delete pixel.factionColor;
            delete pixel.settlementId;
            setPixelColor(pixel, pixel.element === "civ_structure_stone" ? "#66645f" : "#705a45");
        }
    }

    function dropTownCenterStock(banner) {
        if (!banner || !banner.stock) return;
        ensureStock(banner);
        STOCK_KEYS.forEach((kind) => {
            if (kind === "sapling") return;
            const amount = Math.floor(materialAmount(banner.stock, kind));
            if (amount > 0) queueResourceDrops(kind, null, amount, banner.x, banner.y);
            if (kind === "food" || kind === "wood" || kind === "stone") banner.stock[kind] = 0;
            else { banner.stock[kind] = 0; banner.stock.materials[kind] = 0; }
        });
        Object.keys(banner.stock.materials || {}).forEach((key) => { banner.stock.materials[key] = 0; });
        Object.keys(banner.stock.treeSaplings || {}).forEach((seed) => {
            const amount = Math.floor(safeNumber(banner.stock.treeSaplings[seed], 0));
            if (amount) queueResourceDrops(TREE_SAPLING_PREFIX + seed, "civ_tree_sapling_resource", amount, banner.x, banner.y, {treeSapling: seed});
            banner.stock.treeSaplings[seed] = 0;
        });
        banner.stock.sapling = 0;
        Object.keys(banner.stock.seeds || {}).forEach((seed) => {
            const amount = Math.floor(safeNumber(banner.stock.seeds[seed], 0));
            if (amount) queueResourceDrops("seed:" + seed, seed, amount, banner.x, banner.y);
            banner.stock.seeds[seed] = 0;
        });
    }

    function destroyBuilding(buildingOrId, cause) {
        const building = typeof buildingOrId === "number" ? getBuildingById(buildingOrId) : buildingOrId;
        if (!isBuildingCorePixel(building)) return false;
        const settlement = manager.settlementById.get(building.settlementId) || (building.element === "civ_banner" ? building : null);
        releaseBuildingClaim(building);
        if (building.element === "civ_banner") {
            dropTownCenterStock(building);
            building.townCenterActive = false;
            building.buildingState = "destroyed";
            building.destroyedTick = pixelTicks;
            building.destroyedCause = cause || "destroyed";
            building.structureHp = 0;
            logSettlementEvent(building, "town_center_destroyed", "城镇中心被摧毁，聚落暂停运作", {cause: cause || "destroyed", buildingId: building.buildingId});
            return true;
        }
        if (building.element === "civ_construction") {
            cancelConstruction(building);
            return true;
        }
        if (settlement) logSettlementEvent(settlement, "building_destroyed", "建筑被摧毁：" + (building.buildingType || building.element), {buildingId: building.buildingId, buildingType: building.buildingType, cause: cause || "destroyed"});
        changePixel(building, "civ_ruin");
        return true;
    }

    function stepTownCenterRebuilds() {
        manager.settlements.forEach((banner) => {
            if (!banner || banner.del || banner.townCenterActive !== false) return;
            if (banner.destroyedCause === "erased") return;
            const faction = manager.factionById.get(banner.factionId);
            const residents = faction && faction.adults.filter((actor) => actor.settlementId === banner.settlementId && !actor.dead).length || 0;
            if (residents < 1 || pixelTicks - safeNumber(banner.destroyedTick, pixelTicks) < 300) return;
            banner.townCenterActive = true;
            banner.buildingState = "complete";
            banner.structureHp = banner.structureMaxHp || 120;
            delete banner.destroyedCause;
            reserveBuildingTerritory(banner);
            logSettlementEvent(banner, "town_center_rebuilt", "居民重建了城镇中心", {buildingId: banner.buildingId});
        });
    }

    function performSurrender(loserId, victorId, record) {
        const loser = manager.factionById.get(loserId);
        const victor = manager.factionById.get(victorId);
        const victorBanner = victor && victor.settlements[0];
        if (!loser || !victor || !victorBanner) return false;
        const victorResearch = ensureResearchState(victorBanner);
        const loserResearchBanner = loser.settlements[0];
        if (loserResearchBanner) {
            const loserResearch = ensureResearchState(loserResearchBanner);
            victorResearch.knowledge += safeNumber(loserResearch.knowledge, 0) * 0.5;
            allTechnologies().forEach((tech) => {
                if (victorResearch.unlocked[tech.id]) return;
                const cost = effectiveResearchCost(tech, victor, victorBanner);
                const loserCost = Math.max(1, safeNumber(tech.cost, 1));
                const loserInvestment = loserResearch.unlocked[tech.id] ? loserCost : Math.min(loserCost, safeNumber(loserResearch.progress[tech.id], 0));
                if (loserInvestment <= 0) return;
                victorResearch.progress[tech.id] = Math.min(cost - 0.001, safeNumber(victorResearch.progress[tech.id], 0) + loserInvestment * 0.5);
            });
            if (!victorResearch.cultureMemory || typeof victorResearch.cultureMemory !== "object") victorResearch.cultureMemory = {};
            victorResearch.cultureMemory[loserId] = {tick: pixelTicks, knowledgeTransferred: safeNumber(loserResearch.knowledge, 0) * 0.5};
            manager.archivedChronicles.push({factionId: loserId, annexedBy: victorId, annexedAt: eventTimestamp(), settlements: loser.settlements.map((settlement) => ({settlementId: settlement.settlementId, chronicle: ensureChronicle(settlement).slice()}))});
        }
        for (let i = 0; i < loser.actors.length; i++) {
            const actor = loser.actors[i];
            if (!actor || actor.del || actor.dead) continue;
            const formerFactionId = actor.factionId;
            clearTask(actor, "interrupted", "faction_annexed", {fromFactionId: formerFactionId, toFactionId: victorId});
            actor.factionId = victorId;
            actor.factionColor = victor.color;
            actor.role = "worker";
            delete actor.warRole;
            delete actor.warFrontId;
            delete actor.combatTargetId;
            const currentActivity = ensurePersonActivity(actor, true);
            if (currentActivity && currentActivity.c) {
                currentActivity.c.f = actor.factionId;
                currentActivity.c.l = Number.isFinite(actor.settlementId) ? actor.settlementId : null;
                currentActivity.c.r = actor.role;
            }
            recordPersonLifeEvent(actor, "faction_changed", {fromFactionId: formerFactionId, toFactionId: victorId});
            setPixelColor(actor, victor.color);
            if (actor.element === "civ_body") {
                const head = getBodyHead(actor);
                if (head) {
                    head.factionId = victorId;
                    head.factionColor = victor.color;
                }
            }
        }
        const captured = [];
        manager.settlements.forEach((pixel) => { if (pixel.factionId === loserId) captured.push(pixel); });
        manager.structures.forEach((pixel) => { if (pixel.factionId === loserId) captured.push(pixel); });
        manager.constructionSites.forEach((pixel) => { if (pixel.factionId === loserId) captured.push(pixel); });
        Array.from(new Set(captured)).forEach((pixel) => {
            pixel.factionId = victorId;
            pixel.factionColor = victor.color;
            setPixelColor(pixel, victor.color);
            if (pixel.element === "civ_banner") { pixel.research = victorResearch; pixel.eraId = victorBanner.eraId; }
        });
        record.atWar = false;
        record.hostility = 0;
        record.surrendered = true;
        record.surrenderTick = pixelTicks;
        record.victorFactionId = victorId;
        record.loserFactionId = loserId;
        victorBanner.lastWarTick = pixelTicks;
        manager.relationRecords.forEach((otherRecord, key) => {
            if (!otherRecord || otherRecord === record) return;
            if (otherRecord.factionA === loserId || otherRecord.factionB === loserId) {
                otherRecord.atWar = false;
                otherRecord.absorbedFactionId = loserId;
                otherRecord.endedTick = pixelTicks;
                manager.relationRecords.set(key, otherRecord);
            }
        });
        logSettlementEvent(victorBanner, "annexation", "吞并阵营 " + loserId, {loserFactionId: loserId, victorFactionId: victorId});
        rebuildTerritoryIndex();
        return true;
    }

    function stepDiplomacyAndWars() {
        if (getPeaceMode() === "full-peace") return;
        const surrenders = [];
        manager.relationRecords.forEach((record, key) => {
            if (!record || !record.atWar || record.surrendered) return;
            const info = pairInfo(record.factionA, record.factionB);
            const factionA = manager.factionById.get(record.factionA);
            const factionB = manager.factionById.get(record.factionB);
            if (!factionA || !factionB) return;
            const bannerA = factionA.settlements[0];
            const bannerB = factionB.settlements[0];
            if (bannerA) bannerA.lastWarTick = pixelTicks;
            if (bannerB) bannerB.lastWarTick = pixelTicks;
            const age = pixelTicks - safeNumber(record.declaredTick, pixelTicks);
            if (age >= C.WAR_MINIMUM_TICKS) {
                const powerA = Math.max(0, factionA.militaryPower);
                const powerB = Math.max(0, factionB.militaryPower);
                const stronger = powerA >= powerB ? record.factionA : record.factionB;
                const weaker = stronger === record.factionA ? record.factionB : record.factionA;
                const strongPower = Math.max(powerA, powerB);
                const weakPower = Math.min(powerA, powerB);
                if (strongPower >= Math.max(0.0001, weakPower) * C.WAR_POWER_RATIO) {
                    if (record.imbalanceVictor !== stronger) { record.imbalanceVictor = stronger; record.imbalanceSince = pixelTicks; }
                    if (pixelTicks - safeNumber(record.imbalanceSince, pixelTicks) >= C.WAR_IMBALANCE_TICKS) {
                        record.surrendered = true;
                        record.victorFactionId = stronger;
                        record.loserFactionId = weaker;
                        surrenders.push({info, record, loser: weaker, victor: stronger});
                    }
                }
                else { delete record.imbalanceVictor; delete record.imbalanceSince; }
            }
            manager.relationRecords.set(key, record);
            savePairRecord(info, record);
        });
        let changedFactions = false;
        for (let i = 0; i < surrenders.length; i++) {
            const surrender = surrenders[i];
            if (performSurrender(surrender.loser, surrender.victor, surrender.record)) {
                savePairRecord(surrender.info, surrender.record);
                changedFactions = true;
            }
        }
        if (changedFactions) buildWorldIndex();
    }

    function factionIsAtWar(factionId) {
        const keys = Array.from(manager.relationRecords.keys());
        for (let i = 0; i < keys.length; i++) {
            const record = manager.relationRecords.get(keys[i]);
            if (effectiveWarActive(record) && (record.factionA === factionId || record.factionB === factionId)) return true;
        }
        return false;
    }

    function permanentActorRole(actor) {
        if (!actor) return "worker";
        return actor.role || "worker";
    }

    function currentHarvestResourceKind(actor) {
        if (!actor) return null;
        if (actor.workTrip && actor.workTrip.resourceKind) return actor.workTrip.resourceKind;
        if (Number.isFinite(actor.harvestX) && Number.isFinite(actor.harvestY)) {
            const target = pixelsAt(actor.harvestX, actor.harvestY).find((pixel) => resourceDescriptor(pixel));
            const descriptor = resourceDescriptor(target);
            if (descriptor) return descriptor.kind;
        }
        return null;
    }

    function combatTaskStillValid(actor) {
        if (!actor) return false;
        if (actor.task === "combat" || actor.task === "flee") {
            const target = manager.actorById.get(actor.targetId);
            return !!(target && !target.del && !target.dead && target.factionId !== actor.factionId &&
                (atWar(actor.factionId, target.factionId) || retaliationAllowed(actor, target)));
        }
        if (actor.task === "siege") {
            const target = getBuildingById(actor.targetId);
            return !!(target && !target.del && target.factionId !== actor.factionId && atWar(actor.factionId, target.factionId));
        }
        return false;
    }

    function roleTaskCompatible(actor, role) {
        if (!actor || !actor.task || actor.task === "planning" || actor.task === "idle" || actor.task === "dead") return true;
        if (actor.playerOrder) return true;
        if (actor.task === "combat" || actor.task === "flee" || actor.task === "siege") return combatTaskStillValid(actor);
        if (actor.task === "deliver" || actor.task === "return" || actor.task === "search_resource" || actor.task === "explore" || actor.task === "wander" || actor.task === "extinguish") return true;
        if (actor.task === "harvest") {
            const kind = currentHarvestResourceKind(actor);
            if (role === "worker") return true;
            if (role === "food" || role === "hunter" || role === "wood" || role === "forester") return kind === "food" || kind === "wood" || kind === "stone";
            if (role === "miner") return kind === "stone" || NONRENEWABLE_KINDS.has(kind);
            return false;
        }
        if (actor.task === "build") return role === "builder";
        if (actor.task === "plant_tree") return role === "forester";
        if (actor.task === "wait_tree_growth") return role === "forester" || role === "wood";
        if (actor.task === "facility") return role === "artisan" || role === "scholar" || role === "merchant" || role === "artisan_trade";
        if (actor.task === "patrol") {
            return role === "guard" || role === "warrior" || role === "builder" || role === "artisan" || role === "scholar" || role === "merchant" || role === "artisan_trade";
        }
        return false;
    }

    function assignPermanentActorRole(actor, role) {
        if (!actor) return false;
        let nextRole = role || "worker";
        if (actor.militaryVeteran && nextRole !== "guard" && nextRole !== "warrior") nextRole = "guard";
        if (nextRole === "guard" || nextRole === "warrior") actor.militaryVeteran = true;
        if (permanentActorRole(actor) === nextRole) return false;
        actor.role = nextRole;
        if (actor.playerOrder || combatTaskStillValid(actor)) return true;

        delete actor.resumeAfterDelivery;
        if (actor.workTrip) {
            delete actor.workTrip.suspendedTask;
            delete actor.workTrip.resuming;
        }
        if (carriedAmount(actor) > 0) {
            if (actor.task !== "deliver") {
                clearTask(actor, "interrupted", "job_reassigned");
                const firstKind = Object.keys(ensureActorCarry(actor)).find((kind) => actor.carry[kind] > 0);
                const destination = deliveryDestination(actor, firstKind);
                if (destination) setTask(actor, "deliver", destination);
            }
            else invalidateNavigation(actor, "job_reassigned");
            return true;
        }
        if (!roleTaskCompatible(actor, nextRole)) clearTask(actor, "interrupted", "job_reassigned");
        return true;
    }

    function recordPermanentRoleChanges(adults, previousRoles) {
        adults.forEach((actor) => {
            if (!actor || actor.del || actor.dead) return;
            const previousRole = previousRoles.get(actor) || "worker";
            const nextRole = permanentActorRole(actor);
            if (previousRole === nextRole) return;
            const event = recordPersonLifeEvent(actor, "role_changed", {
                fromRole: previousRole,
                toRole: nextRole,
                warRole: actor.warRole || null
            });
            if (event) event.r = nextRole;
        });
    }

    function assignFactionRoles(faction) {
        if (!faction || !faction.adults.length) return;
        const previousRoles = new Map(faction.adults.map((actor) => [actor, permanentActorRole(actor)]));
        const roleMap = {food: "food", wood: "wood", miner: "miner", builder: "builder", artisan: "artisan", forester: "forester", scholar: "scholar", military: "guard", artisan_trade: "merchant", flex: "worker"};
        let standingQuota = 0;
        faction.settlements.forEach((settlement) => {
            const adults = faction.adults.filter((actor) => actor.settlementId === settlement.settlementId).sort((a, b) => {
                const militaryOrder = Number(!!a.militaryVeteran) - Number(!!b.militaryVeteran);
                return militaryOrder || a.humanId - b.humanId;
            });
            const target = Core.eraPopulationTarget ? Core.eraPopulationTarget(eraIndexFor(faction)) : (World.populationTarget ? World.populationTarget(eraIndexFor(faction)) : 6);
            const gatheringDemand = settlementGatheringDemand(faction, settlement);
            const localPopulation = adults.length + faction.children.filter((actor) => actor.settlementId === settlement.settlementId).length;
            const birthsNeeded = Math.max(0, target - localPopulation);
            const lowFood = materialAmount(settlement.stock, "food") < birthsNeeded * C.BIRTH_FOOD_COST;
            const housingUrgent = settlement.housing < Math.min(target, safeNumber(settlement.population, adults.length) + 2);
            let quotas;
            if (Core.eraJobAllocation) quotas = Core.eraJobAllocation(eraIndexFor(faction), adults.length, {lowFood, housingUrgent});
            else if (World.scaledRoleQuotas) quotas = World.scaledRoleQuotas(adults.length, eraIndexFor(faction), {lowFood, housingUrgent});
            else quotas = {food: Math.ceil(adults.length / 2), wood: Math.floor(adults.length / 2)};
            if (lowFood) {
                const desiredFood = Math.ceil(adults.length / 2);
                while (safeNumber(quotas.food, 0) < desiredFood) {
                    const donor = Object.keys(quotas).filter((role) => role !== "food" && role !== "military" && quotas[role] > 0).sort((a, b) => quotas[b] - quotas[a])[0];
                    if (!donor) break;
                    quotas[donor]--;
                    quotas.food = safeNumber(quotas.food, 0) + 1;
                }
            }
            else if (safeNumber(quotas.food, 0) > 0 && safeNumber(gatheringDemand.food, 0) <= 0) {
                const surplus = quotas.food;
                quotas.food = 0;
                const mineralDemand = safeNumber(gatheringDemand.stone, 0) + safeNumber(gatheringDemand.copper, 0) + safeNumber(gatheringDemand.raw_iron, 0);
                if (resourceUnlockedForFaction(faction, "stone") && mineralDemand > safeNumber(gatheringDemand.wood, 0)) quotas.miner = safeNumber(quotas.miner, 0) + surplus;
                else quotas.wood = safeNumber(quotas.wood, 0) + surplus;
            }
            if (faction.constructionSites.some((site) => site.settlementId === settlement.settlementId) && adults.length > 1 && safeNumber(quotas.builder, 0) < 1) {
                const donors = Object.keys(quotas).filter((role) => role !== "builder" && safeNumber(quotas[role], 0) > (role === "food" ? 1 : 0)).sort((a, b) => safeNumber(quotas[b], 0) - safeNumber(quotas[a], 0));
                const fallbackDonors = Object.keys(quotas).filter((role) => role !== "builder" && safeNumber(quotas[role], 0) > 0).sort((a, b) => safeNumber(quotas[b], 0) - safeNumber(quotas[a], 0));
                const donor = donors[0] || fallbackDonors[0];
                if (donor) {
                    quotas[donor]--;
                    quotas.builder = 1;
                }
            }
            if (!factionHasFeature(faction, "treePlanting") && safeNumber(quotas.forester, 0) > 0) {
                quotas.wood = safeNumber(quotas.wood, 0) + safeNumber(quotas.forester, 0);
                quotas.forester = 0;
            }
            settlement.roleQuotas = Object.assign({}, quotas);
            standingQuota += safeNumber(quotas.military, 0);
            let cursor = 0;
            Object.keys(quotas).forEach((semanticRole) => {
                for (let i = 0; i < quotas[semanticRole] && cursor < adults.length; i++) assignPermanentActorRole(adults[cursor++], roleMap[semanticRole] || "worker");
            });
            while (cursor < adults.length) assignPermanentActorRole(adults[cursor++], "worker");
            settlement.lastPopulation = safeNumber(settlement.population, adults.length);
        });

        const enemies = activeEnemyFactionIds(faction.id);
        const allAdults = faction.adults.slice().sort((a, b) => a.humanId - b.humanId);
        if (!enemies.length) {
            allAdults.forEach((actor) => { delete actor.warRole; delete actor.warFrontId; });
            allAdults.filter((actor) => actor.militaryVeteran).forEach((actor) => assignPermanentActorRole(actor, "guard"));
            const banner = faction.settlements[0];
            if (banner && banner.warState) banner.warState.initialized = false;
            recordPermanentRoleChanges(allAdults, previousRoles);
            reconcileFactionEquipment(faction);
            return;
        }

        const banner = faction.settlements[0];
        if (!banner.warState || typeof banner.warState !== "object") banner.warState = {wave: 1, initialized: false};
        const targetArmy = Math.min(allAdults.length, Math.max(2, standingQuota * 2));
        let attackers = allAdults.filter((actor) => actor.warRole === "attacker");
        let defenders = allAdults.filter((actor) => actor.warRole === "defender");
        if (!banner.warState.initialized) {
            const existing = allAdults.filter((actor) => permanentActorRole(actor) === "warrior" || permanentActorRole(actor) === "guard");
            const attackCount = existing.length ? Math.min(targetArmy, existing.length) : Math.min(targetArmy, Math.max(1, Math.ceil(targetArmy / 2)));
            attackers = (existing.length ? existing : allAdults).slice(0, attackCount);
            attackers.forEach((actor) => { actor.warRole = "attacker"; });
            defenders = allAdults.filter((actor) => actor.warRole !== "attacker").slice(0, Math.max(0, targetArmy - attackers.length));
            defenders.forEach((actor) => { actor.warRole = "defender"; });
            banner.warState.initialized = true;
            banner.warState.wave = Math.max(1, safeNumber(banner.warState.wave, 1));
        }
        else if (!attackers.length && defenders.length) {
            defenders.forEach((actor) => { actor.warRole = "attacker"; delete actor.warFrontId; });
            attackers = defenders.slice();
            defenders = [];
            banner.warState.wave = safeNumber(banner.warState.wave, 1) + 1;
            logSettlementEvent(banner, "war_wave", "第 " + banner.warState.wave + " 波进攻开始", {wave: banner.warState.wave});
        }
        const soldiers = allAdults.filter((actor) => actor.warRole);
        const recruitsNeeded = Math.max(0, targetArmy - soldiers.length);
        allAdults.filter((actor) => !actor.warRole).slice(0, recruitsNeeded).forEach((actor) => { actor.warRole = "defender"; defenders.push(actor); });
        attackers = allAdults.filter((actor) => actor.warRole === "attacker");
        const fronts = World.splitAttackersAcrossFronts ? World.splitAttackersAcrossFronts(attackers.map((actor) => actor.humanId), enemies) : null;
        attackers.forEach((actor, index) => {
            assignPermanentActorRole(actor, "warrior");
            actor.warFrontId = fronts ? Number(Object.keys(fronts).find((enemyId) => fronts[enemyId].indexOf(actor.humanId) !== -1)) : enemies[index % enemies.length];
        });
        allAdults.filter((actor) => actor.warRole === "defender").forEach((actor) => { assignPermanentActorRole(actor, "guard"); delete actor.warFrontId; });
        recordPermanentRoleChanges(allAdults, previousRoles);
        reconcileFactionEquipment(faction);
    }

    function planFactionConstruction(faction) {
        const constructionSlots = Math.max(1, safeNumber(faction && faction.techModifiers && faction.techModifiers.constructionSlots, 1));
        if (!faction) return;
        const eraTarget = Core.eraPopulationTarget ? Core.eraPopulationTarget(eraIndexFor(faction)) : (World.populationTarget ? World.populationTarget(eraIndexFor(faction)) : 6);
        faction.settlements.forEach((banner) => {
            if (!banner || banner.townCenterActive === false) return;
            const localSites = faction.constructionSites.filter((site) => site.settlementId === banner.settlementId);
            if (localSites.length >= constructionSlots) return;
            if (!banner.buildRetry || typeof banner.buildRetry !== "object") banner.buildRetry = {};
            const local = (list) => list.filter((building) => building.settlementId === banner.settlementId);
            const housingUrgent = banner.housing < Math.min(eraTarget, safeNumber(banner.population, 0) + 2);
            const candidates = [];
            if (housingUrgent) candidates.push("hut");
            else {
                if (!local(faction.lumberyards).length) candidates.push("lumberyard");
                if (!local(faction.hearths).length) candidates.push("hearth");
                if (!local(faction.huts).length) candidates.push("hut");
                if (!local(faction.workshops).length) candidates.push("workshop");
                if (!local(faction.quarries).length) candidates.push("quarry");
                if (!local(faction.foundries).length) candidates.push("foundry");
                if (!local(faction.kilns).length) candidates.push("kiln");
                if (!local(faction.forges).length) candidates.push("forge");
                if (!local(faction.defenses).length) candidates.push("palisade");
                if (!local(faction.towers).length) candidates.push("watchtower");
                if (!local(faction.keeps).length) candidates.push("keep");
                if (!local(faction.siegeWorkshops).length) candidates.push("siege_workshop");
                if (!local(faction.libraries).length) candidates.push("library");
                if (!local(faction.markets).length) candidates.push("market");
            }
            const attempted = new Set();
            for (let i = 0; i < candidates.length; i++) {
                const type = candidates[i];
                if (attempted.has(type) || pixelTicks < safeNumber(banner.buildRetry[type], 0)) continue;
                attempted.add(type);
                if (!unlockedBuilding(faction, type)) continue;
                const blueprint = BLUEPRINTS[type];
                if (!blueprint || !hasStock(banner, blueprint.cost) || !canSpendAfterAdvancementReserve(faction, banner, blueprint.cost)) continue;
                const site = createConstruction(banner, type);
                if (site) { faction.constructionSites.push(site); return; }
                banner.buildRetry[type] = pixelTicks + C.BUILD_RETRY_TICKS;
            }
        });
    }

    function actorIsSoldier(actor) {
        if (!actor || actor.dead || actor.del || actor.element === "civ_child") return false;
        return actor.militaryVeteran === true || actor.role === "guard" || actor.role === "warrior" || actor.warRole === "attacker" || actor.warRole === "defender";
    }

    function eraWeaponTargets(eraId, soldierCount) {
        const count = Math.max(0, Math.floor(safeNumber(soldierCount, 0)));
        if (!count) return [];
        const thirds = function (first, second, ranged) {
            const base = Math.floor(count / 3);
            const remainder = count % 3;
            return Array(base + (remainder >= 1 ? 1 : 0)).fill(first)
                .concat(Array(base + (remainder >= 2 ? 1 : 0)).fill(second))
                .concat(Array(base).fill(ranged));
        };
        if (eraId === "stone") return Array(count).fill("stone_spear");
        if (eraId === "agriculture") return Array(count - Math.floor(count / 2)).fill("stone_spear").concat(Array(Math.floor(count / 2)).fill("bow"));
        if (eraId === "bronze") return thirds("bronze_sword", "bronze_spear", "bow");
        if (eraId === "iron") return thirds("iron_sword", "iron_spear", "bow");
        if (eraId === "castle") return thirds("steel_blade", "steel_spear", "crossbow");
        return Array(count).fill("club");
    }

    function weaponUnlockedForFaction(faction, weaponId) {
        if (weaponId === "fists") return true;
        const requirement = WEAPON_TECH_REQUIREMENTS[weaponId];
        return !hasTechnologyData() || factionHasUnlock(faction, "weapon", weaponId) || !requirement || hasTech(faction, requirement);
    }

    function resolvedEraWeaponTargets(faction, eraId, soldierCount) {
        const count = Math.max(0, Math.floor(safeNumber(soldierCount, 0)));
        const resolved = Array(count).fill("fists");
        const eraLimit = ERA_INDEX.has(eraId) ? ERA_INDEX.get(eraId) : 0;
        for (let eraIndex = 0; eraIndex <= eraLimit; eraIndex++) {
            const targets = eraWeaponTargets(ERA_ORDER[eraIndex] || DEFAULT_ERA_ID, count);
            targets.forEach((weaponId, index) => {
                if (weaponUnlockedForFaction(faction, weaponId)) resolved[index] = weaponId;
            });
        }
        return resolved;
    }

    function armorUnlockedForFaction(faction, armorId) {
        const desired = canonicalArmorId(armorId);
        if (desired === "none") return true;
        const requiredEra = ARMOR_ERA_REQUIREMENTS[desired];
        if (requiredEra && eraIndexFor(faction) < safeNumber(ERA_INDEX.get(requiredEra), 0)) return false;
        const requirement = ARMOR_TECH_REQUIREMENTS[desired];
        return !hasTechnologyData() || factionHasUnlock(faction, "armor", desired) ||
            factionHasUnlock(faction, "armor", requirement) || !requirement || hasTech(faction, requirement);
    }

    function resolvedEraArmorTarget(faction, eraId) {
        const eraLimit = ERA_INDEX.has(eraId) ? ERA_INDEX.get(eraId) : 0;
        let desired = "none";
        [["agriculture", "rattan"], ["iron", "iron"], ["castle", "steel"]].forEach((entry) => {
            const requiredIndex = safeNumber(ERA_INDEX.get(entry[0]), Infinity);
            if (requiredIndex <= eraLimit && armorUnlockedForFaction(faction, entry[1])) desired = entry[1];
        });
        return desired;
    }

    function actorEquipmentBanner(actor, faction) {
        return settlementForActor(actor) || faction && faction.settlements.find((settlement) => settlement.townCenterActive !== false) || faction && faction.settlements[0] || null;
    }

    function canApplyEquipmentExchange(banner, refund, cost) {
        if (!banner) return false;
        ensureStock(banner);
        const resources = new Set(Object.keys(refund || {}).concat(Object.keys(cost || {})));
        for (const resource of resources) {
            const finalAmount = materialAmount(banner.stock, resource) + safeNumber(refund && refund[resource], 0) - safeNumber(cost && cost[resource], 0);
            if (finalAmount < 0) return false;
        }
        return true;
    }

    function applyEquipmentExchange(banner, refund, cost) {
        if (!canApplyEquipmentExchange(banner, refund, cost)) return false;
        const resources = new Set(Object.keys(refund || {}).concat(Object.keys(cost || {})));
        resources.forEach((resource) => {
            const delta = safeNumber(refund && refund[resource], 0) - safeNumber(cost && cost[resource], 0);
            if (delta > 0) addMaterial(banner.stock, resource, delta);
            else if (delta < 0) spendMaterial(banner.stock, resource, -delta);
        });
        return true;
    }

    function refundActorWeapon(actor, faction) {
        if (!actor || actor.dead || actor.del) return false;
        migrateActorEquipment(actor);
        if (actor.weapon === "fists") {
            delete actor.weaponPaidCost;
            return false;
        }
        const banner = actorEquipmentBanner(actor, faction);
        if (banner && actor.weaponPaidCost) refundStock(banner, actor.weaponPaidCost);
        const previousWeapon = actor.weapon;
        actor.weapon = "fists";
        delete actor.weaponPaidCost;
        recordPersonLifeEvent(actor, "weapon_removed", {weapon: previousWeapon, refunded: true});
        return true;
    }

    function refundActorArmor(actor, faction) {
        if (!actor || actor.dead || actor.del) return false;
        migrateActorEquipment(actor);
        if (actor.armor === "none") {
            delete actor.armorPaidCost;
            syncActorHealth(actor, false);
            return false;
        }
        const banner = actorEquipmentBanner(actor, faction);
        if (banner && actor.armorPaidCost) refundStock(banner, actor.armorPaidCost);
        const previousArmor = actor.armor;
        actor.armor = "none";
        delete actor.armorPaidCost;
        syncActorHealth(actor, true);
        recordPersonLifeEvent(actor, "armor_removed", {armor: previousArmor, refunded: true});
        return true;
    }

    function canAffordWeaponSwap(banner, actor, cost) {
        const refund = actor && actor.weapon !== "fists" && actor.weaponPaidCost || {};
        return canApplyEquipmentExchange(banner, refund, cost);
    }

    function canAffordArmorSwap(banner, actor, cost) {
        const refund = actor && actor.armor !== "none" && actor.armorPaidCost || {};
        return canApplyEquipmentExchange(banner, refund, cost);
    }

    function equipActorWeapon(actor, faction, weaponId) {
        if (!actor || !actorIsSoldier(actor)) return false;
        migrateActorEquipment(actor);
        const desired = canonicalWeaponId(weaponId);
        if (actor.weapon === desired) return false;
        if (!weaponUnlockedForFaction(faction, desired)) return false;
        const descriptor = weaponDescriptor(desired);
        const banner = actorEquipmentBanner(actor, faction);
        const cost = copyResourceCost(descriptor && descriptor.cost || {});
        if (!descriptor || !banner || !canAffordWeaponSwap(banner, actor, cost)) return false;
        const previousWeapon = actor.weapon;
        const refundedCost = previousWeapon !== "fists" ? copyResourceCost(actor.weaponPaidCost) : {};
        if (!applyEquipmentExchange(banner, refundedCost, cost)) return false;
        actor.weapon = desired;
        actor.weaponPaidCost = cost;
        actor.equipmentSchemaVersion = EQUIPMENT_SCHEMA_VERSION;
        recordPersonLifeEvent(actor, "weapon_equipped", {weapon: desired, previousWeapon: previousWeapon, refundedCost: refundedCost, cost: copyResourceCost(cost)});
        addPersonActivityMetrics(actor, {equipmentIssued: {[desired]: 1}});
        return true;
    }

    function equipActorArmor(actor, faction, armorId) {
        if (!actor || !actorIsSoldier(actor)) return false;
        migrateActorEquipment(actor);
        const desired = canonicalArmorId(armorId);
        if (actor.armor === desired || desired === "none" || !armorUnlockedForFaction(faction, desired)) return false;
        const descriptor = armorDescriptor(desired);
        const banner = actorEquipmentBanner(actor, faction);
        const cost = copyResourceCost(descriptor && descriptor.cost || {});
        if (!descriptor || !banner || !canAffordArmorSwap(banner, actor, cost)) return false;
        const previousArmor = actor.armor;
        const refundedCost = previousArmor !== "none" ? copyResourceCost(actor.armorPaidCost) : {};
        if (!applyEquipmentExchange(banner, refundedCost, cost)) return false;
        actor.armor = desired;
        actor.armorPaidCost = cost;
        actor.equipmentSchemaVersion = EQUIPMENT_SCHEMA_VERSION;
        syncActorHealth(actor, true);
        recordPersonLifeEvent(actor, "armor_equipped", {armor: desired, previousArmor: previousArmor, refundedCost: refundedCost, cost: copyResourceCost(cost)});
        addPersonActivityMetrics(actor, {equipmentIssued: {[desired + "_armor"]: 1}});
        return true;
    }

    function reconcileFactionEquipment(faction) {
        if (!faction) return 0;
        const livingAdults = (faction.adults || []).filter((actor) => actor && !actor.dead && !actor.del).sort((a, b) => a.humanId - b.humanId);
        livingAdults.forEach(migrateActorEquipment);
        let changes = 0;
        livingAdults.filter((actor) => !actorIsSoldier(actor)).forEach((actor) => {
            if (refundActorWeapon(actor, faction)) changes++;
            if (refundActorArmor(actor, faction)) changes++;
        });
        const soldiers = livingAdults.filter(actorIsSoldier);
        const banner = faction.settlements && faction.settlements[0];
        const eraId = banner && banner.eraId || faction.eraId || DEFAULT_ERA_ID;
        const targets = resolvedEraWeaponTargets(faction, eraId, soldiers.length);
        const armorTarget = resolvedEraArmorTarget(faction, eraId);
        soldiers.forEach((actor, index) => {
            if (equipActorWeapon(actor, faction, targets[index] || "fists")) changes++;
        });
        // Preserve the era's army-wide weapon distribution before spending any
        // shared material on armor for individual soldiers.
        soldiers.forEach((actor) => {
            if (armorTarget === "none") {
                if (refundActorArmor(actor, faction)) changes++;
            }
            else if (equipActorArmor(actor, faction, armorTarget)) changes++;
        });
        return changes;
    }

    function craftForFaction(faction) {
        return reconcileFactionEquipment(faction);
    }

    const WORKSHOP_RECIPE_BY_ELEMENT = Object.freeze({
        civ_foundry_core: "bronze",
        civ_kiln_core: "iron",
        civ_forge_core: "steel"
    });
    const RECIPE_TECH_REQUIREMENTS = Object.freeze({bronze: "bronze_foundry", iron: "iron_smelting", steel: "steelmaking"});

    function recipeUnlockedForFaction(faction, recipeId) {
        if (!hasTechnologyData()) return true;
        return factionHasUnlock(faction, "recipe", recipeId) || hasTech(faction, RECIPE_TECH_REQUIREMENTS[recipeId]);
    }

    function workshopLedger(stock) {
        const keys = new Set(STOCK_KEYS.concat(MATERIAL_KEYS, Object.keys(FUEL_VALUES)));
        Object.keys(TechData.RECIPES || {}).forEach((recipeId) => {
            const recipe = TechData.RECIPES[recipeId] || {};
            (recipe.inputs || []).concat(recipe.outputs || []).forEach((entry) => keys.add(entry.resource));
        });
        const ledger = {};
        keys.forEach((key) => { ledger[key] = materialAmount(stock, key); });
        return ledger;
    }

    function reserveWorkshopRecipe(ledger, recipe, woodReserve) {
        if (!ledger || !recipe) return null;
        if (!(recipe.inputs || []).every((input) => safeNumber(ledger[input.resource], 0) >= safeNumber(input.amount, 0))) return null;
        (recipe.inputs || []).forEach((input) => { ledger[input.resource] = safeNumber(ledger[input.resource], 0) - safeNumber(input.amount, 0); });
        const minimumWood = Math.max(0, Math.floor(safeNumber(woodReserve, 0)));
        const rollbackInputs = () => (recipe.inputs || []).forEach((input) => {
            ledger[input.resource] = safeNumber(ledger[input.resource], 0) + safeNumber(input.amount, 0);
        });
        if (safeNumber(ledger.wood, 0) < minimumWood) {
            rollbackInputs();
            return null;
        }
        const availableFuel = {};
        Object.keys(FUEL_VALUES).forEach((fuel) => {
            const protectedAmount = fuel === "wood" ? minimumWood : 0;
            availableFuel[fuel] = Math.max(0, Math.floor(safeNumber(ledger[fuel], 0) - protectedAmount));
        });
        const fuelPlan = recipe.heat > 0 && Core.selectFuelCombination ? Core.selectFuelCombination(availableFuel, recipe.heat, FUEL_VALUES) : {used: {}};
        if (recipe.heat > 0 && !fuelPlan) {
            rollbackInputs();
            return null;
        }
        Object.keys(fuelPlan.used || {}).forEach((fuel) => { ledger[fuel] = safeNumber(ledger[fuel], 0) - safeNumber(fuelPlan.used[fuel], 0); });
        if (safeNumber(ledger.wood, 0) < minimumWood) {
            Object.keys(fuelPlan.used || {}).forEach((fuel) => { ledger[fuel] = safeNumber(ledger[fuel], 0) + safeNumber(fuelPlan.used[fuel], 0); });
            rollbackInputs();
            return null;
        }
        return {fuelUse: copyResourceCost(fuelPlan.used || {})};
    }

    function processWorkshopBatches(faction, banner, buildings) {
        if (!faction || !banner || banner.townCenterActive === false) return 0;
        ensureStock(banner);
        const ledger = workshopLedger(banner.stock);
        const advancementReserve = advancementReservation(faction, banner);
        Object.keys(advancementReserve).forEach((resource) => {
            ledger[resource] = Math.max(0, safeNumber(ledger[resource], 0) - safeNumber(advancementReserve[resource], 0));
        });
        const woodReserve = smeltingWoodReserveFor(banner);
        const proposals = [];
        (buildings || []).filter((building) => building && !building.del && building.buildingState !== "destroyed" && building.settlementId === banner.settlementId)
            .sort((a, b) => safeNumber(a.buildingId, 0) - safeNumber(b.buildingId, 0))
            .forEach((building) => {
                const recipeId = WORKSHOP_RECIPE_BY_ELEMENT[building.element];
                const recipe = recipeId && TechData.RECIPES && TechData.RECIPES[recipeId];
                if (!recipe || !recipeUnlockedForFaction(faction, recipeId) || pixelTicks - safeNumber(building.lastProcessTick, 0) < C.WORKSHOP_PROCESS_INTERVAL) return;
                const reservation = reserveWorkshopRecipe(ledger, recipe, woodReserve);
                if (!reservation) return;
                proposals.push({building, recipeId, recipe, fuelUse: reservation.fuelUse});
            });
        if (!proposals.length) return 0;

        // Inputs for every workshop are committed before any outputs. This keeps
        // a newly smelted intermediate from being consumed again in the same tick.
        proposals.forEach((proposal) => {
            (proposal.recipe.inputs || []).forEach((input) => spendMaterial(banner.stock, input.resource, input.amount));
            Object.keys(proposal.fuelUse).forEach((fuel) => spendMaterial(banner.stock, fuel, proposal.fuelUse[fuel]));
        });
        proposals.forEach((proposal) => {
            (proposal.recipe.outputs || []).forEach((output) => {
                addMaterial(banner.stock, output.resource, output.amount);
                if (!banner.firstProducedResources || typeof banner.firstProducedResources !== "object") banner.firstProducedResources = {};
                if (!banner.firstProducedResources[output.resource]) {
                    banner.firstProducedResources[output.resource] = true;
                    logSettlementEvent(banner, "first_production", "首次生产资源：" + output.resource, {
                        resource: output.resource,
                        amount: output.amount,
                        recipeId: proposal.recipeId,
                        buildingId: proposal.building.buildingId
                    });
                }
            });
            proposal.building.lastProcessTick = pixelTicks;
        });
        const research = ensureResearchState(banner);
        research.milestones.itemsSmelted = safeNumber(research.milestones.itemsSmelted, 0) + proposals.length;
        addDomainExperience(banner, "production", 0.2 * proposals.length);
        return proposals.length;
    }

    function processFactionIndustry(faction) {
        if (!faction) return 0;
        let processed = 0;
        faction.settlements.forEach((banner) => {
            const buildings = faction.foundries.concat(faction.kilns, faction.forges);
            processed += processWorkshopBatches(faction, banner, buildings);
        });
        return processed;
    }

    function processFactionCommunity(faction) {
        if (!faction || !faction.hearths.length || !factionHasFeature(faction, "hearthHealing")) return;
        for (let i = 0; i < faction.adults.length; i++) {
            const actor = faction.adults[i];
            if (!actor || actor.dead || actor.hp >= actor.maxHp) continue;
            const nearHearth = faction.hearths.some((hearth) => !hearth.del && Core.distance(actor.x, actor.y, hearth.x, hearth.y) <= 6);
            if (nearHearth) healActor(actor, 2);
        }
    }

    function initializeChild(child, faction, banner) {
        if (!child || child.del) return null;
        const humanId = manager.nextHumanId++;
        Object.assign(child, {
            humanId: humanId,
            factionId: faction.id,
            factionColor: faction.color,
            settlementId: banner.settlementId,
            role: "child",
            dead: false,
            hp: C.CHILD_HP,
            maxHp: C.CHILD_HP,
            baseMaxHp: C.CHILD_HP,
            healthDamage: 0,
            birthTick: pixelTicks,
            lifespanYears: randomLifespanYears(),
            ageTicks: 0,
            dir: Math.random() < 0.5 ? -1 : 1,
            task: "idle",
            weapon: "fists",
            armor: "none",
            armorBonusHp: 0,
            equipmentSchemaVersion: EQUIPMENT_SCHEMA_VERSION,
            carry: {},
            carryCapacity: C.BASE_CARRY_CAPACITY,
            attackReadyTick: 0
        });
        if (factionIsAtWar(faction.id)) child.warRole = "defender";
        child.naturalDeathTick = child.birthTick + child.lifespanYears * C.TICKS_PER_YEAR;
        ensureLifeHistory(child, false);
        ensurePersonActivity(child, false);
        recordPersonLifeEvent(child, "birth", {settlementId: banner.settlementId});
        beginPersonActivity(child, "idle", null);
        setPixelColor(child, faction.color);
        registerPixel(child);
        return child;
    }

    function findBirthSpot(banner, faction) {
        const localHuts = faction.huts.filter((hut) => hut.settlementId === banner.settlementId);
        const homes = localHuts.length ? localHuts : [banner];
        const bodyProbe = {element: "civ_body"};
        const headProbe = {element: "civ_head"};
        for (let i = 0; i < homes.length; i++) {
            const home = homes[i];
            for (let radius = 1; radius <= 12; radius++) {
                for (let side = -1; side <= 1; side += 2) {
                    const x = home.x + radius * side;
                    const y = findSurfaceY(x, home.y);
                    if (y === null || outOfBounds(x, y - 1)) continue;
                    const bodyOpen = typeof canCreatureOccupy === "function" ? canCreatureOccupy(bodyProbe, x, y) : isEmpty(x, y);
                    const headOpen = typeof canCreatureOccupy === "function" ? canCreatureOccupy(headProbe, x, y - 1) : isEmpty(x, y - 1);
                    if (bodyOpen && headOpen && solidGroundAt(x, y)) return {x: x, y: y};
                }
            }
        }
        return null;
    }

    function createWorkingPersonAt(spot, faction, banner) {
        if (!spot || !faction || !banner) return null;
        const body = createPixel("civ_body", spot.x, spot.y, {factionId: faction.id, settlementId: banner.settlementId});
        if (!body) return null;
        const head = createPixel("civ_head", spot.x, spot.y - 1, {factionId: faction.id, settlementId: banner.settlementId});
        if (!head) {
            deleteExactPixel(body);
            return null;
        }
        const actor = initializeAdult(body, head, {factionId: faction.id, factionColor: faction.color, settlementId: banner.settlementId, birthTick: pixelTicks, creationEvent: "birth"});
        if (!actor) return null;
        faction.actors.push(actor);
        faction.adults.push(actor);
        faction.population++;
        faction.adultPopulation++;
        banner.population = safeNumber(banner.population, 0) + 1;
        banner.humanIdHighWatermark = Math.max(safeNumber(banner.humanIdHighWatermark, 0), actor.humanId);
        return actor;
    }

    function reproduceFaction(faction) {
        if (!faction) return;
        const targetPopulation = Core.eraPopulationTarget ? Core.eraPopulationTarget(eraIndexFor(faction)) : (World.populationTarget ? World.populationTarget(eraIndexFor(faction)) : 6);
        let created = 0;
        faction.settlements.forEach((banner) => {
            if (!banner || banner.townCenterActive === false) return;
            let localPopulation = faction.actors.filter((actor) => actor.settlementId === banner.settlementId && !actor.dead).length;
            const birthFoodCost = C.BIRTH_FOOD_COST;
            ensureStock(banner);
            const reservedFood = safeNumber(advancementReservation(faction, banner).food, 0);
            while (localPopulation < targetPopulation && materialAmount(banner.stock, "food") - reservedFood >= birthFoodCost) {
                const spot = findBirthSpot(banner, faction);
                if (!spot) break;
                spendMaterial(banner.stock, "food", birthFoodCost);
                const actor = createWorkingPersonAt(spot, faction, banner);
                if (!actor) {
                    addMaterial(banner.stock, "food", birthFoodCost);
                    break;
                }
                created++;
                localPopulation++;
                banner.lastBirthTick = pixelTicks;
                banner.birthReadyTick = pixelTicks;
                const research = ensureResearchState(faction.settlements[0]);
                research.milestones.births = safeNumber(research.milestones.births, 0) + 1;
                research.knowledge += 0.5 * safeNumber(faction.techModifiers && faction.techModifiers.milestoneKnowledge, 1);
                addDomainExperience(faction.settlements[0], "society", 0.25);
                logSettlementEvent(banner, "birth", "成员诞生并立即参加工作", {humanId: actor.humanId, settlementId: banner.settlementId});
            }
        });
        if (created) assignFactionRoles(faction);
        return created;
    }

    function civilizationStep() {
        buildWorldIndex();
        const factions = Array.from(manager.factionById.values());
        let founded = false;
        for (let i = 0; i < factions.length; i++) {
            if (createBannerForFaction(factions[i])) founded = true;
        }
        if (founded) buildWorldIndex();
        stepDiplomacyAndWars();
        const refreshed = Array.from(manager.factionById.values());
        for (let i = 0; i < refreshed.length; i++) {
            const faction = refreshed[i];
            stepResourceExhaustionWars(faction);
            assignFactionRoles(faction);
            planFactionMiners(faction);
            craftForFaction(faction);
            stepFactionResearch(faction);
            planFactionConstruction(faction);
            processFactionIndustry(faction);
            processFactionCommunity(faction);
            reproduceFaction(faction);
        }
        stepTownCenterRebuilds();
        refreshCivilizationUi();
    }

    function spawnBloodNear(pixel) {
        if (!pixel || !elements.blood) return;
        const offsets = [[0, -1], [-1, 0], [1, 0], [0, 1]];
        for (let i = 0; i < offsets.length; i++) {
            const x = pixel.x + offsets[i][0];
            const y = pixel.y + offsets[i][1];
            if (!outOfBounds(x, y) && isEmpty(x, y)) {
                createPixel("blood", x, y);
                return;
            }
        }
    }

    function markActorDead(actor, tick, details) {
        if (!actor) return;
        if (actor.dead) return;
        const deathTick = Math.max(1, Number.isFinite(tick) ? tick : pixelTicks);
        actor.healthDamage = Math.max(safeNumber(actor.healthDamage, 0), safeNumber(actor.maxHp, C.ADULT_HP));
        actor.hp = 0;
        actor.dead = deathTick;
        actor.task = "dead";
        delete actor.playerOrder;
        if (commandPersonId === actor.humanId) cancelPersonCommand();
        const banner = settlementForActor(actor);
        if (banner) {
            banner.deathCount = Math.max(0, safeNumber(banner.deathCount, 0)) + 1;
            banner.humanIdHighWatermark = Math.max(safeNumber(banner.humanIdHighWatermark, 0), safeNumber(actor.humanId, 0));
            logSettlementEvent(banner, "death", "成员死亡", {humanId: actor.humanId, cause: actor.deathCause || "injury", age: ageYears(actor), deathCount: banner.deathCount});
        }
        delete actor.personActivity;
        if (actor.element === "civ_body") {
            const head = getBodyHead(actor);
            if (head) head.dead = deathTick;
        }
    }

    function damageActor(pixelOrId, amount, source) {
        let actor = typeof pixelOrId === "number" ? manager.actorById.get(pixelOrId) : getActorFromPixel(pixelOrId);
        const sourceFaction = source && source.factionId !== undefined ? source.factionId : (Number.isFinite(source) ? source : null);
        if (!actor || actor.del || actor.dead) return false;
        if (sourceFaction !== null && sourceFaction !== actor.factionId && getPeaceMode() === "full-peace") return false;
        migrateActorEquipment(actor);
        const defendingFaction = manager.factionById.get(actor.factionId);
        const incomingDamageMultiplier = Math.max(0.1, Math.min(1, safeNumber(defendingFaction && defendingFaction.techModifiers && defendingFaction.techModifiers.incomingDamageMultiplier, 1)));
        const damage = Math.max(0, Number(amount) || 0) * incomingDamageMultiplier;
        if (!damage) return false;
        delete actor.equipmentSurvivalFloor;
        actor.healthDamage = safeNumber(actor.healthDamage, 0) + damage;
        syncActorHealth(actor, false);
        addPersonActivityMetrics(actor, {damageTaken: damage});
        if (source && Number.isFinite(source.humanId)) addPersonActivityMetrics(source, {hits: 1, damageDealt: damage});
        actor.underAttackUntil = pixelTicks + 90;
        if (source && Number.isFinite(source.humanId) && source.factionId !== actor.factionId) {
            lockCombatTarget(actor, source);
        }
        if (sourceFaction !== null && sourceFaction !== actor.factionId) recordIncident(sourceFaction, actor.factionId, "hit");
        if (actor.hp <= 0) {
            if (source && Number.isFinite(source.humanId)) addPersonActivityMetrics(source, {kills: 1});
            markActorDead(actor, pixelTicks, {killerHumanId: source && source.humanId || null, killerFactionId: sourceFaction});
            if (sourceFaction !== null && sourceFaction !== actor.factionId) recordIncident(sourceFaction, actor.factionId, "kill");
        }
        return true;
    }

    function attackProxy(actor) {
        return {
            id: actor.humanId,
            factionId: actor.factionId,
            isChild: actor.element === "civ_child",
            dead: !!actor.dead,
            x: actor.x,
            y: actor.y,
            hp: safeNumber(actor.hp, 0),
            maxHp: safeNumber(actor.maxHp, C.ADULT_HP),
            role: actor.role,
            weapon: manager.weapons.get(actor.weapon) || manager.weapons.get("fists"),
            attackReadyTick: safeNumber(actor.attackReadyTick, 0)
        };
    }

    function knockbackActor(target, attacker, distance) {
        const steps = Math.max(0, Math.floor(safeNumber(distance, 0)));
        if (!target || !attacker || !steps) return false;
        let moved = false;
        let dx = Math.sign(target.x - attacker.x);
        const dy = Math.sign(target.y - attacker.y);
        if (!dx && !dy) dx = attacker.dir === -1 ? -1 : 1;
        for (let step = 0; step < steps; step++) {
            let stepMoved = false;
            if (target._r !== undefined) {
                const relation = getRelation(target._r);
                if (relation) stepMoved = tryMoveRelation(relation, dx, dy, true);
            }
            else stepMoved = tryMove(target, target.x + dx, target.y + dy);
            if (!stepMoved) break;
            moved = true;
        }
        return moved;
    }

    function resolveActorAttacks() {
        if (!manager.pendingAttacks.length) return;
        const pending = manager.pendingAttacks.splice(0, manager.pendingAttacks.length);
        const remaining = [];
        for (let i = 0; i < pending.length; i++) {
            const intent = pending[i];
            if (safeNumber(intent.dueTick, intent.tick + 1) > pixelTicks) { remaining.push(intent); continue; }
            const attacker = manager.actorById.get(intent.attackerId);
            const target = manager.actorById.get(intent.targetId);
            if (!attacker || attacker.del || attacker.dead || !target || target.del || target.dead || attacker.factionId === target.factionId) continue;
            if (!atWar(attacker.factionId, target.factionId) && !retaliationAllowed(attacker, target)) continue;
            attacker.strikeDueTick = undefined;
            attacker.strikeTargetId = undefined;
            lockCombatTarget(target, attacker);
            target.underAttackUntil = pixelTicks + 90;
            addPersonActivityMetrics(attacker, {attacks: 1});
            const weapon = manager.weapons.get(attacker.weapon) || manager.weapons.get("fists");
            if (Math.random() >= safeNumber(weapon && weapon.hitChance, 0.5)) { addPersonActivityMetrics(attacker, {misses: 1}); continue; }
            const damage = Math.max(0, safeNumber(weapon && weapon.damage, 5));
            damageActor(target, damage, attacker);
            if (Math.random() < C.ATTACK_BLOOD_CHANCE) spawnBloodNear(target);
            knockbackActor(target, attacker, safeNumber(weapon && weapon.knockback, 1));
            const attackingBanner = settlementForActor(attacker);
            if (attackingBanner) addDomainExperience(attackingBanner, "military", 0.08);
        }
        manager.pendingAttacks.push.apply(manager.pendingAttacks, remaining);
    }

    function resolveRangedImpacts() {
        if (!manager.pendingRangedImpacts.length) return;
        const remaining = [];
        for (let i = 0; i < manager.pendingRangedImpacts.length; i++) {
            const impact = manager.pendingRangedImpacts[i];
            if (impact.dueTick > pixelTicks) {
                remaining.push(impact);
                continue;
            }
            const attacker = manager.actorById.get(impact.attackerId);
            const target = manager.actorById.get(impact.targetId);
            if (!attacker || attacker.dead || !target || target.dead || attacker.factionId === target.factionId || !atWar(attacker.factionId, target.factionId)) continue;
            addPersonActivityMetrics(attacker, {attacks: 1});
            if (impact.hit) {
                damageActor(target, impact.damage, attacker);
                const banner = settlementForActor(attacker);
                if (banner) addDomainExperience(banner, "military", 0.12);
                if (Math.random() < C.ATTACK_BLOOD_CHANCE) spawnBloodNear(target);
            }
            else addPersonActivityMetrics(attacker, {misses: 1});
        }
        manager.pendingRangedImpacts = remaining;
    }

    function damageStructure(target, amount, attackerFactionId) {
        if (!target || target.del) return false;
        if (Number.isFinite(attackerFactionId) && Number.isFinite(target.factionId) && attackerFactionId !== target.factionId && getPeaceMode() === "full-peace") return false;
        if (target.element !== "civ_banner" && target.element !== "civ_construction" && !STRUCTURE_CORES.has(target.element) && !STRUCTURE_PARTS.has(target.element)) return false;
        const defaultHp = target.element === "civ_structure_stone" ? 80 : (target.element === "civ_structure_wood" ? 30 : 120);
        if (!Number.isFinite(target.structureHp)) target.structureHp = defaultHp;
        if (!Number.isFinite(target.structureMaxHp)) target.structureMaxHp = defaultHp;
        target.structureHp = Math.max(0, target.structureHp - Math.max(0, Number(amount) || 0));
        if (target.structureHp <= 0) {
            if (Number.isFinite(attackerFactionId) && Number.isFinite(target.factionId)) recordIncident(attackerFactionId, target.factionId, "kill");
            ruinPixel(target);
        }
        return true;
    }

    function resolveStructureAttacks() {
        if (!manager.pendingStructureAttacks.length) return;
        const intents = manager.pendingStructureAttacks.splice(0, manager.pendingStructureAttacks.length);
        const remaining = [];
        const usedAttackers = new Set();
        for (let i = 0; i < intents.length; i++) {
            const intent = intents[i];
            if (safeNumber(intent.dueTick, safeNumber(intent.scheduledTick, pixelTicks) + 1) > pixelTicks) {
                remaining.push(intent);
                continue;
            }
            const attacker = manager.actorById.get(intent.attackerId);
            const target = intent.target;
            if (!attacker || attacker.del || attacker.dead || !target || target.del || usedAttackers.has(attacker.humanId)) continue;
            attacker.structureStrikeDueTick = undefined;
            attacker.structureStrikeKey = undefined;
            if (!atWar(attacker.factionId, target.factionId)) continue;
            const weapon = manager.weapons.get(attacker.weapon) || manager.weapons.get("fists");
            usedAttackers.add(attacker.humanId);
            addPersonActivityMetrics(attacker, {attacks: 1});
            if (Math.random() >= safeNumber(weapon && weapon.hitChance, 0.5)) { addPersonActivityMetrics(attacker, {misses: 1}); continue; }
            const attackerFaction = manager.factionById.get(attacker.factionId);
            const multiplier = safeNumber(attackerFaction && attackerFaction.techModifiers && attackerFaction.techModifiers.structureDamageMultiplier, 1);
            const beforeHp = safeNumber(target.structureHp, target.structureMaxHp || 120);
            damageStructure(target, Math.max(0, safeNumber(weapon.damage, 5)) * multiplier, attacker.factionId);
            const dealt = Math.max(0, beforeHp - safeNumber(target.structureHp, 0));
            addPersonActivityMetrics(attacker, {hits: 1, structureDamage: dealt, structuresDestroyed: target.structureHp <= 0 ? 1 : 0});
        }
        manager.pendingStructureAttacks.push.apply(manager.pendingStructureAttacks, remaining);
    }

    function resolvePendingAttacks() {
        resolveRangedImpacts();
        resolveActorAttacks();
        resolveStructureAttacks();
    }

    function runEnvironment(pixel, expectedElement) {
        doHeat(pixel);
        if (pixel.del || pixel.element !== expectedElement) return false;
        doBurning(pixel);
        if (pixel.del || pixel.element !== expectedElement) return false;
        doElectricity(pixel);
        return !pixel.del && pixel.element === expectedElement;
    }

    function processLife(actor) {
        ensureLifeHistory(actor, actor.element === "civ_body");
        actor.ageTicks = Math.max(0, pixelTicks - actor.birthTick);
        const naturalDeathDue = Core.isNaturalDeathDue ? Core.isNaturalDeathDue(actor, pixelTicks) : pixelTicks >= actor.naturalDeathTick;
        if (!actor.dead && naturalDeathDue) {
            actor.deathCause = "old_age";
            markActorDead(actor, pixelTicks);
            return;
        }
        const healInterval = C.PASSIVE_HEAL_INTERVAL_TICKS || 60;
        if (!actor.dead && pixelTicks % healInterval === 0) {
            healActor(actor, C.PASSIVE_HEAL_AMOUNT || 1);
        }
    }

    function processCombatFrame(actor) {
        if (!actor || actor.dead) return false;
        let target = Number.isFinite(actor.combatTargetId) ? manager.actorById.get(actor.combatTargetId) : null;
        if (!target && actor.task === "combat" && Number.isFinite(actor.targetId)) target = manager.actorById.get(actor.targetId);
        if (!target || target.dead || target.del || target.factionId === actor.factionId || (!atWar(actor.factionId, target.factionId) && !retaliationAllowed(actor, target))) {
            actor.combatTargetId = undefined;
            return false;
        }
        if (actor.warRole === "defender" && (!manager.territory || manager.territory.ownerAt(target.x) !== actor.factionId)) {
            actor.combatTargetId = undefined;
            if (actor.task === "combat") clearTask(actor, "completed", "target_left_territory");
            return false;
        }
        actor.combatTargetId = target.humanId;
        const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
        if (targetInAttackBox(actor, target, weapon) && (!weapon.ranged || mutualLineOfSight(actor, target))) {
            queueAttack(actor, target);
            return true;
        }
        return false;
    }

    function processStructureCombatFrame(actor) {
        if (!actor || actor.dead || actor.task !== "siege") return false;
        const target = getBuildingById(actor.targetId) || (Number.isFinite(actor.targetX) && Number.isFinite(actor.targetY) ? pixelsAt(actor.targetX, actor.targetY).find((pixel) => pixel && pixel.element === actor.targetKind && atWar(actor.factionId, pixel.factionId)) : null);
        if (!target || target.del || !atWar(actor.factionId, target.factionId)) return false;
        const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
        const structureRange = Math.max(2, weapon.range);
        const obstruction = adjacentEnemyStructure(actor, structureRange);
        if (obstruction) return queueStructureAttack(actor, obstruction);
        if (Core.distance(actor.x, actor.y, target.x, target.y) <= structureRange) return queueStructureAttack(actor, target);
        return false;
    }

    function adultNavigationActive(actor) {
        if (!actor || !actor.task) return false;
        return actor.task !== "idle" && actor.task !== "dead";
    }

    function applyAdultGravity(actor) {
        if (!actor || actor.del || actor.dead || actor._r === undefined) return false;
        const head = getBodyHead(actor);
        if (tunnelAt(actor.x, actor.y) || (head && tunnelAt(head.x, head.y))) return false;
        if (solidGroundAt(actor.x, actor.y)) return false;
        if (activeClimbSide(actor)) return false;
        if (safeNumber(actor.climbHoldUntil, -1) >= pixelTicks) return false;
        const relation = getRelation(actor._r);
        if (!relation || !relation.p || relation.p.length < 2) return false;
        if (!tryMoveRelation(relation, 0, 1, true)) return false;
        actor.pathStage = "fall";
        return true;
    }

    function decayAdult(body) {
        if (!body.dead || pixelTicks - Number(body.dead) <= 200 || Math.random() >= 0.1) return;
        const head = getBodyHead(body);
        if (head && !head.del) changePixel(head, "rotten_meat");
        if (!body.del && body.element === "civ_body") changePixel(body, "rotten_meat");
    }

    function taskNeedsMovement(actor) {
        if (!actor || actor.dead || actor.del) return false;
        return actor.task === "move" || actor.task === "harvest" || actor.task === "extinguish" || actor.task === "deliver" || actor.task === "build" || actor.task === "farm" || actor.task === "plant_tree" || actor.task === "wait_tree_growth" || actor.task === "facility" || actor.task === "combat" || actor.task === "siege" || actor.task === "flee" || actor.task === "return" || actor.task === "patrol" || actor.task === "search_resource" || actor.task === "explore";
    }

    function fireTaskCanInterrupt(actor) {
        if (!actor || actor.playerOrder || actor.warRole || actor.underAttackUntil > pixelTicks) return false;
        if (carriedAmount(actor) >= carryCapacityFor(actor)) return false;
        if (!fireResponseSlotAvailable(actor)) return false;
        return actor.task !== "extinguish" && actor.task !== "deliver" && actor.task !== "combat" && actor.task !== "siege" && actor.task !== "flee" && actor.task !== "move";
    }

    function runAdultLocomotion(actor) {
        if (!taskNeedsMovement(actor)) return false;
        if (actor.task === "harvest" && Number.isFinite(actor.harvestX) && Core.distance(actor.x, actor.y, actor.harvestX, actor.harvestY) <= 1.5) return false;
        if (actor.task === "extinguish" && Number.isFinite(actor.targetX) && Number.isFinite(actor.targetY) && Core.distance(actor.x, actor.y, actor.targetX, actor.targetY) <= 1.5) return false;
        if (actor.task === "deliver" || actor.task === "build" || actor.task === "facility") {
            if (Number.isFinite(actor.targetX) && Number.isFinite(actor.targetY) && Core.distance(actor.x, actor.y, actor.targetX, actor.targetY) <= 2.5) return false;
        }
        if (actor.task === "combat") {
            const target = manager.actorById.get(actor.targetId);
            const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
            if (target && targetInAttackBox(actor, target, weapon) && (!weapon.ranged || mutualLineOfSight(actor, target))) return false;
        }
        if (actor.task === "siege") {
            const target = getBuildingById(actor.targetId);
            const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
            if (target && Core.distance(actor.x, actor.y, target.x, target.y) <= Math.max(2, weapon.range)) return false;
        }
        const targetX = Number.isFinite(actor.targetX) ? actor.targetX : (Number.isFinite(actor.searchX) ? actor.searchX : actor.patrolX);
        const targetY = Number.isFinite(actor.targetY) ? actor.targetY : (Number.isFinite(actor.searchY) ? actor.searchY : actor.patrolY);
        if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return false;
        return moveRelationToward(actor, targetX, targetY, actor.task === "flee" || actor.navigationAway === true);
    }

    function tickBody(pixel) {
        registerPixel(pixel);
        if (!runEnvironment(pixel, "civ_body")) return;
        const head = getBodyHead(pixel);
        if (head && head.dead && !pixel.dead) markActorDead(pixel, Number(head.dead));
        if (pixel.dead) {
            decayAdult(pixel);
            return;
        }
        if (!head && pixelTicks % 30 === 0) {
            damageActor(pixel, 5, null);
        }
        processLife(pixel);
        if (pixel.dead) return;
        updatePersonSpeech(pixel);
        processCombatFrame(pixel);
        processStructureCombatFrame(pixel);
        if (pixel.burning) {
            pixel.panic = Math.min(50, (pixel.panic || 0) + 1);
            pixel.dir = -(pixel.dir || 1);
        }
        else if (pixel.panic > 0) pixel.panic = Math.max(0, pixel.panic - 0.1);
        if (!Number.isFinite(pixel.humanId)) return;
        if (applyAdultGravity(pixel)) return;
        if ((pixelTicks + pixel.humanId) % C.THINK_INTERVAL === 0) {
            for (let attempt = 0; attempt < 2; attempt++) {
                const hadPlayerOrder = !!pixel.playerOrder;
                const emergencyFire = fireTaskCanInterrupt(pixel) ? findFireTarget(pixel) : null;
                if (emergencyFire) setTask(pixel, "extinguish", emergencyFire);
                if (!emergencyFire) prioritizeForesterPlanting(pixel);
                const activeTask = pixel.task === "move" || pixel.task === "harvest" || pixel.task === "deliver" || pixel.task === "build" ||
                    pixel.task === "farm" || pixel.task === "plant_tree" || pixel.task === "wait_tree_growth" || pixel.task === "combat" || pixel.task === "siege" || pixel.task === "extinguish";
                const taskIsFacility = pixel.task === "facility";
                const urgentReplan = pixel.underAttackUntil > pixelTicks;
                const periodicReplan = !activeTask && !taskIsFacility && (!Number.isFinite(pixel.lastPlanTick) || pixelTicks - pixel.lastPlanTick >= 60);
                if (pixel.playerOrder && !urgentReplan) applyPlayerOrder(pixel);
                if (hadPlayerOrder && !pixel.playerOrder) {
                    pixel.lastPlanTick = pixelTicks;
                    break;
                }
                if (!pixel.task || pixel.task === "idle" || pixel.task === "planning" || pixel.task === "dead" || urgentReplan || periodicReplan) {
                    if (pixel.playerOrder && !urgentReplan) applyPlayerOrder(pixel);
                    else assignActorTask(pixel);
                    pixel.lastPlanTick = pixelTicks;
                }
                deferAdultLocomotion = true;
                try { runAdultAction(pixel); }
                finally { deferAdultLocomotion = false; }
                if (pixel.lastDeliveryTick === pixelTicks) break;
                if (pixel.task !== "planning") break;
            }
        }
        const relation = pixel._r !== undefined ? getRelation(pixel._r) : null;
        if ((pixelTicks + pixel.humanId) % C.LOCOMOTION_INTERVAL_TICKS === 0 && (!relation || relation.lastMove !== pixelTicks)) runAdultLocomotion(pixel);
    }

    function tickHead(pixel) {
        registerPixel(pixel);
        if (!runEnvironment(pixel, "civ_head")) return;
        const body = getHeadBody(pixel);
        if (body) {
            pixel.orphanedSince = undefined;
            if (body.dead) pixel.dead = body.dead;
        }
        else if (!pixel.dead) {
            if (!Number.isFinite(pixel.orphanedSince)) pixel.orphanedSince = pixelTicks;
            if (pixelTicks - pixel.orphanedSince >= 20) pixel.dead = Math.max(1, pixelTicks);
        }
        if (pixel.dead && pixelTicks - Number(pixel.dead) > 200 && Math.random() < 0.1 && pixel.element === "civ_head") {
            changePixel(pixel, "rotten_meat");
        }
    }

    function growChild(child) {
        if (!child || child.del || child.dead) return false;
        finishPersonActivity(child, "completed", "matured");
        const personActivity = cloneActivityValue(ensurePersonActivity(child, false));
        child.personTransitioning = true;
        const options = {
            humanId: child.humanId,
            factionId: child.factionId,
            factionColor: child.factionColor,
            settlementId: child.settlementId,
            birthTick: child.birthTick,
            lifespanYears: child.lifespanYears,
            naturalDeathTick: child.naturalDeathTick,
            role: child.role && child.role !== "child" ? child.role : (factionIsAtWar(child.factionId) ? "guard" : "worker"),
            weapon: "fists",
            dir: child.dir,
            personActivity: personActivity,
            activityTransition: true
        };
        const adult = materializeAdult(child, options);
        if (!adult && !child.del) {
            child.personTransitioning = false;
            child.personActivity = personActivity;
            beginPersonActivity(child, "planning", null);
        }
        if (adult && factionIsAtWar(adult.factionId)) adult.warRole = "defender";
        if (adult) {
            recordPersonLifeEvent(adult, "legacy_child_conversion", {ageYears: ageYears(adult)});
            const banner = settlementForActor(adult);
            if (banner) logSettlementEvent(banner, "legacy_child_conversion", "旧存档儿童已转换为统一工作人口", {humanId: adult.humanId});
        }
        return !!adult;
    }

    function moveChildToward(child, target) {
        if (!child || !target) return false;
        let dirX = Math.sign(target.x - child.x);
        if (!dirX) dirX = child.dir || 1;
        child.dir = dirX;
        if (tryMove(child, child.x + dirX, child.y)) return true;
        if (tryMove(child, child.x, child.y - 1) || tryMove(child, child.x + dirX, child.y - 1)) return true;
        if (target.y > child.y) return tryMove(child, child.x + dirX, child.y + 1) || tryMove(child, child.x, child.y + 1);
        return false;
    }

    function tickChild(pixel) {
        registerPixel(pixel);
        if (!runEnvironment(pixel, "civ_child")) return;
        if (pixel.dead) {
            if (pixelTicks - Number(pixel.dead) > 200 && Math.random() < 0.1) changePixel(pixel, "rotten_meat");
            return;
        }
        processLife(pixel);
        if (pixel.dead) return;
        if (growChild(pixel)) return;
        processCombatFrame(pixel);
        if (!tunnelAt(pixel.x, pixel.y) && tryMove(pixel, pixel.x, pixel.y + 1)) return;
        if (!Number.isFinite(pixel.humanId) || (pixelTicks + pixel.humanId) % C.THINK_INTERVAL !== 0) return;
        const combatTarget = Number.isFinite(pixel.combatTargetId) ? manager.actorById.get(pixel.combatTargetId) : null;
        if (combatTarget && !combatTarget.del && !combatTarget.dead && combatTarget.factionId !== pixel.factionId &&
            (atWar(pixel.factionId, combatTarget.factionId) || retaliationAllowed(pixel, combatTarget)) &&
            (pixel.warRole !== "defender" || manager.territory && manager.territory.ownerAt(combatTarget.x) === pixel.factionId)) {
            const weapon = manager.weapons.get(pixel.weapon) || manager.weapons.get("fists");
            if (!targetInAttackBox(pixel, combatTarget, weapon)) moveChildToward(pixel, combatTarget);
            return;
        }
        if (pixel.task === "combat") clearTask(pixel, combatTarget && combatTarget.dead ? "completed" : "interrupted", combatTarget && combatTarget.dead ? "target_defeated" : "target_lost");
        if (pixel.warRole === "defender") {
            const enemy = currentEnemy(pixel, 30);
            if (enemy) {
                pixel.combatTargetId = enemy.humanId;
                setTask(pixel, "combat", enemy);
                const weapon = manager.weapons.get(pixel.weapon) || manager.weapons.get("fists");
                if (!targetInAttackBox(pixel, enemy, weapon)) moveChildToward(pixel, enemy);
                return;
            }
        }
        const banner = settlementForActor(pixel);
        let direction = pixel.dir || 1;
        if (banner && Core.distance(pixel.x, pixel.y, banner.x, banner.y) > Math.max(4, banner.territoryRadius / 2)) direction = Math.sign(banner.x - pixel.x) || direction;
        else if (Math.random() < 0.2) direction *= -1;
        pixel.dir = direction;
        if (!tryMove(pixel, pixel.x + direction, pixel.y)) {
            if (!tryMove(pixel, pixel.x, pixel.y - 1)) tryMove(pixel, pixel.x + direction, pixel.y - 1);
        }
    }

    function structureOnPlace(pixel, maximumHp) {
        if (!Number.isFinite(pixel.structureHp)) pixel.structureHp = maximumHp;
        if (!Number.isFinite(pixel.structureMaxHp)) pixel.structureMaxHp = maximumHp;
        if (isBuildingCorePixel(pixel)) {
            ensureBuildingMetadata(pixel);
            if (Number.isFinite(pixel.factionId)) reserveBuildingTerritory(pixel);
        }
        registerPixel(pixel);
    }

    function bannerOnPlace(pixel) {
        structureOnPlace(pixel, 120);
        ensureStock(pixel);
        ensureResearchState(pixel);
        migrateLegacyDeathArchive(pixel);
        if (!pixel.diplomacy || typeof pixel.diplomacy !== "object") pixel.diplomacy = {};
    }

    function constructionOnDelete(pixel) {
        if (!pixel.cancelled && !pixel.completed) cancelConstruction(pixel, true);
        else onCivilizedDelete(pixel);
    }

    function actorHoverStat(pixel) {
        const actor = getActorFromPixel(pixel) || pixel;
        const weapon = actor.weapon || "fists";
        const role = actor.role || (actor.element === "civ_child" ? "child" : "worker");
        return "H" + (actor.humanId || "?") + " · " + civilizationText("people.factionShort", "Faction", "阵营") + " " + (actor.factionId || "?") + " · " +
            localizedPersonRole(role) + " · " + civilizationText("people.health", "HP", "生命值") + " " + Math.max(0, Math.round(actor.hp || 0)) + " · " +
            civilizationText("people.age", "Age", "年龄") + " " + ageYears(actor).toFixed(1) + "/" + Math.round(actor.lifespanYears || 55) + " · " + localizedPersonWeapon(weapon);
    }

    function bannerHoverStat(pixel) {
        const faction = manager.factionById.get(pixel.factionId);
        const stock = pixel.stock || {food: 0, wood: 0, stone: 0};
        const era = eraDefinition(pixel.eraId);
        const eraTechIds = era && era.techIds || [];
        const completed = eraTechIds.filter((techId) => pixel.research && pixel.research.unlocked && pixel.research.unlocked[techId]).length;
        return civilizationText("people.factionShort", "Faction", "阵营") + " " + (pixel.factionId || "?") + " · " + (era ? localizedEraName(era) : localizedSettlementStage(pixel.stage || "camp")) + " " + completed + "/" + eraTechIds.length + " · " +
            civilizationText("ui.population", "Population", "人口") + " " + (faction ? faction.population : "?") + "/" + (pixel.housing || 2) + " · " +
            civilizationText("ui.stock", "Stock F/W/S", "库存 食/木/石") + " " + Math.floor(stock.food || 0) + "/" + Math.floor(stock.wood || 0) + "/" + Math.floor(stock.stone || 0);
    }

    function renderTerritoryHover(ctx) {
        const hovered = buildingVisualAt(Math.round(mousePos.x), Math.round(mousePos.y));
        if (!manager.overlaySettings.territory && !hovered) return;
        ctx.save();
        if (manager.overlaySettings.territory && manager.territory) {
            let start = 0;
            while (start < manager.territory.width) {
                const owner = manager.territory.ownerAt(start);
                let end = start;
                while (end + 1 < manager.territory.width && manager.territory.ownerAt(end + 1) === owner) end++;
                if (owner !== null && owner !== undefined) {
                    ctx.globalAlpha = 0.11;
                    ctx.fillStyle = factionColor(owner);
                    ctx.fillRect(canvasCoord(start), canvasCoord(0), (end - start + 1) * pixelSize, (height + 1) * pixelSize);
                }
                start = end + 1;
            }
        }
        if (hovered) {
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = hovered.factionColor || factionColor(hovered.factionId);
            ctx.lineWidth = Math.max(1, pixelSize / 3);
            const minX = Math.max(0, hovered.x - C.TERRITORY_HALF_WIDTH);
            const maxX = Math.min(width, hovered.x + C.TERRITORY_HALF_WIDTH);
            ctx.strokeRect(canvasCoord(minX), canvasCoord(0), (maxX - minX + 1) * pixelSize, (height + 1) * pixelSize);
        }
        ctx.restore();
    }

    function renderResourceOverlay(ctx) {
        if (!manager.overlaySettings.resources) return;
        const filters = manager.overlaySettings.resourceFilters;
        const colors = {
            food: "#76d15f", wood: "#58a35c", stone: "#a6a6a6", sapling: "#8fcf68",
            copper: "#d78655", bronze: "#b87832", raw_iron: "#a85d45", iron: "#c0c4c7", steel: "#7e96a3"
        };
        manager.resourceIndex.forEach((nodes, kind) => {
            const sapling = String(kind || "").indexOf(TREE_SAPLING_PREFIX) === 0;
            const category = kind === "food" ? "food" : (kind === "wood" || sapling ? "tree" : (kind === "stone" ? "stone" : "metals"));
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = sapling ? colors.sapling : (colors[kind] || "#ffffff");
            nodes.forEach((node) => {
                if (!node.pixel || node.pixel.del) return;
                const isDrop = node.pixel._civResourceDrop === true;
                if (isDrop ? !filters.drops : !filters[category]) return;
                ctx.fillRect(canvasCoord(node.x) + pixelSize * 0.3, canvasCoord(node.y) + pixelSize * 0.3, Math.max(1, pixelSize * 0.4), Math.max(1, pixelSize * 0.4));
            });
            ctx.restore();
        });
    }

    function drawPersonWeapon(pixel, ctx) {
        const weapon = pixel.weapon || "fists";
        if (weapon === "fists" || weapon === "fist") return;
        const direction = pixel.dir || 1;
        const centerX = canvasCoord(pixel.x) + pixelSize / 2;
        const centerY = canvasCoord(pixel.y) + pixelSize / 2;
        const spearColors = {
            spear: "#8f8b82", stone_spear: "#8f8b82", bronze_spear: "#bf7b39",
            iron_spear: "#c6c8cb", steel_spear: "#8da3ad"
        };
        const swordColors = {bronze_sword: "#bf7b39", iron_sword: "#c6c8cb", steel_blade: "#8da3ad"};
        ctx.save();
        ctx.lineWidth = Math.max(1, pixelSize / 5);
        if (Object.prototype.hasOwnProperty.call(spearColors, weapon)) {
            const shaftEndX = centerX + direction * pixelSize * 1.15;
            const shaftEndY = centerY - pixelSize * 0.2;
            ctx.strokeStyle = "#795834";
            ctx.beginPath();
            ctx.moveTo(centerX - direction * pixelSize * 0.15, centerY + pixelSize * 0.1);
            ctx.lineTo(shaftEndX, shaftEndY);
            ctx.stroke();
            ctx.strokeStyle = spearColors[weapon];
            ctx.beginPath();
            ctx.moveTo(shaftEndX, shaftEndY);
            ctx.lineTo(shaftEndX + direction * pixelSize * 0.32, shaftEndY - pixelSize * 0.06);
            ctx.stroke();
        }
        else if (Object.prototype.hasOwnProperty.call(swordColors, weapon)) {
            ctx.strokeStyle = "#6f4a2d";
            ctx.beginPath();
            ctx.moveTo(centerX - direction * pixelSize * 0.12, centerY + pixelSize * 0.1);
            ctx.lineTo(centerX + direction * pixelSize * 0.12, centerY - pixelSize * 0.02);
            ctx.stroke();
            ctx.strokeStyle = swordColors[weapon];
            ctx.lineWidth = Math.max(1, pixelSize / 4);
            ctx.beginPath();
            ctx.moveTo(centerX + direction * pixelSize * 0.1, centerY);
            ctx.lineTo(centerX + direction * pixelSize * 0.78, centerY - pixelSize * 0.28);
            ctx.stroke();
        }
        else if (weapon === "bow") {
            ctx.strokeStyle = "#966f3e";
            ctx.beginPath();
            ctx.moveTo(centerX + direction * pixelSize * 0.45, centerY - pixelSize * 0.42);
            ctx.lineTo(centerX + direction * pixelSize * 0.62, centerY);
            ctx.lineTo(centerX + direction * pixelSize * 0.45, centerY + pixelSize * 0.42);
            ctx.lineTo(centerX + direction * pixelSize * 0.45, centerY - pixelSize * 0.42);
            ctx.stroke();
        }
        else if (weapon === "crossbow") {
            ctx.strokeStyle = "#755235";
            ctx.beginPath();
            ctx.moveTo(centerX - direction * pixelSize * 0.1, centerY + pixelSize * 0.15);
            ctx.lineTo(centerX + direction * pixelSize * 0.75, centerY - pixelSize * 0.1);
            ctx.moveTo(centerX + direction * pixelSize * 0.35, centerY - pixelSize * 0.42);
            ctx.lineTo(centerX + direction * pixelSize * 0.5, centerY - pixelSize * 0.08);
            ctx.lineTo(centerX + direction * pixelSize * 0.35, centerY + pixelSize * 0.28);
            ctx.stroke();
        }
        else {
            ctx.strokeStyle = "#6f4a2d";
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + direction * pixelSize * 0.75, centerY - pixelSize * 0.16);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawPersonArmor(pixel, ctx) {
        const armor = canonicalArmorId(pixel.armor);
        const palettes = {
            rattan: {base: "#6f7440", highlight: "#9a8958", shadow: "#4f5832"},
            iron: {base: "#d9dddf", highlight: "#f4f5f2", shadow: "#8d969b"},
            steel: {base: "#202426", highlight: "#525b60", shadow: "#090b0c"}
        };
        const palette = palettes[armor];
        if (!palette) return;
        const left = canvasCoord(pixel.x);
        const top = canvasCoord(pixel.y);
        const factionBelt = pixel.factionColor || factionColor(pixel.factionId) || pixel.color;
        ctx.save();
        ctx.fillStyle = palette.shadow;
        ctx.fillRect(left + pixelSize * 0.05, top + pixelSize * 0.18, pixelSize * 0.9, pixelSize * 0.62);
        ctx.fillStyle = palette.base;
        ctx.fillRect(left + pixelSize * 0.13, top + pixelSize * 0.2, pixelSize * 0.74, pixelSize * 0.56);
        ctx.fillStyle = palette.highlight;
        ctx.fillRect(left + pixelSize * 0.2, top + pixelSize * 0.24, pixelSize * 0.13, pixelSize * 0.34);
        ctx.fillStyle = factionBelt;
        ctx.fillRect(left + pixelSize * 0.08, top + pixelSize * 0.66, pixelSize * 0.84, pixelSize * 0.13);
        ctx.restore();
    }

    function renderCivilizedBody(pixel, ctx) {
        drawSquare(ctx, pixel.color, pixel.x, pixel.y);
        drawPersonArmor(pixel, ctx);
        drawPersonWeapon(pixel, ctx);
    }

    function renderRangedProjectiles(ctx) {
        if (!manager.visualProjectiles.size) return;
        const expired = [];
        manager.visualProjectiles.forEach((projectile) => {
            const duration = Math.max(1, projectile.dueTick - projectile.startTick);
            const progress = Math.max(0, Math.min(1, (pixelTicks - projectile.startTick) / duration));
            const x = projectile.x0 + (projectile.x1 - projectile.x0) * progress;
            const y = projectile.y0 + (projectile.y1 - projectile.y0) * progress;
            ctx.save();
            ctx.fillStyle = projectile.color || "#d4bc85";
            ctx.beginPath();
            ctx.arc(canvasCoord(x) + pixelSize / 2, canvasCoord(y) + pixelSize / 2, Math.max(1, pixelSize / 7), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (pixelTicks > projectile.dueTick + 2) expired.push(projectile);
        });
        for (let i = 0; i < expired.length; i++) manager.visualProjectiles.delete(expired[i]);
    }

    function buildingSpriteEraId(building) {
        if (building && ERA_INDEX.has(building.eraId)) return building.eraId;
        const settlement = building && manager.settlementById.get(building.settlementId);
        if (settlement && ERA_INDEX.has(settlement.eraId)) return settlement.eraId;
        const faction = building && manager.factionById.get(building.factionId);
        const capital = faction && faction.settlements && faction.settlements[0];
        return capital && ERA_INDEX.has(capital.eraId) ? capital.eraId : DEFAULT_ERA_ID;
    }

    function buildingSpriteDescriptor(building) {
        if (!building || typeof World.buildingSpriteDescriptor !== "function") return null;
        const type = building.buildingType || building.blueprintType || building.element;
        return World.buildingSpriteDescriptor(type, buildingSpriteEraId(building));
    }

    function requestBuildingSprite(descriptor) {
        if (!descriptor || typeof root.Image !== "function") return null;
        let asset = buildingSpriteAssets.get(descriptor.fileName);
        if (asset) return asset;
        asset = {state: "loading", image: null, bounds: null, tinted: new Map()};
        buildingSpriteAssets.set(descriptor.fileName, asset);
        const image = new root.Image();
        image.decoding = "async";
        image.onload = function () {
            asset.image = image;
            asset.state = "ready";
        };
        image.onerror = function () {
            asset.state = "failed";
            asset.image = null;
        };
        image.src = BUILDING_SPRITE_ROOT + descriptor.fileName + "?v=" + BUILDING_SPRITE_VERSION;
        return asset;
    }

    function parseSpriteFactionColor(color) {
        const value = String(color || "").trim();
        let match = /^#([0-9a-f]{6})$/i.exec(value);
        if (match) {
            const numeric = parseInt(match[1], 16);
            return {key: match[1].toLowerCase(), r: numeric >> 16, g: numeric >> 8 & 255, b: numeric & 255};
        }
        match = /^#([0-9a-f]{3})$/i.exec(value);
        if (!match) return null;
        const expanded = match[1].split("").map((part) => part + part).join("");
        const numeric = parseInt(expanded, 16);
        return {key: expanded.toLowerCase(), r: numeric >> 16, g: numeric >> 8 & 255, b: numeric & 255};
    }

    function tintedBuildingSprite(asset, color) {
        if (!asset || asset.state !== "ready" || !asset.image || typeof document === "undefined") return null;
        const faction = parseSpriteFactionColor(color);
        if (!faction) return null;
        if (asset.tinted.has(faction.key)) return asset.tinted.get(faction.key);
        const canvas = document.createElement("canvas");
        canvas.width = asset.image.naturalWidth || asset.image.width || 64;
        canvas.height = asset.image.naturalHeight || asset.image.height || 64;
        const spriteContext = canvas.getContext("2d", {willReadFrequently: true});
        if (!spriteContext) return null;
        spriteContext.imageSmoothingEnabled = false;
        spriteContext.drawImage(asset.image, 0, 0, canvas.width, canvas.height);
        try {
            const imageData = spriteContext.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = -1;
            let maxY = -1;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] !== 0) {
                    const pixelIndex = i / 4;
                    const x = pixelIndex % canvas.width;
                    const y = Math.floor(pixelIndex / canvas.width);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
                if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255 && data[i + 3] !== 0) {
                    data[i] = faction.r;
                    data[i + 1] = faction.g;
                    data[i + 2] = faction.b;
                }
            }
            spriteContext.putImageData(imageData, 0, 0);
            asset.bounds = maxX >= minX && maxY >= minY ? {
                x: minX,
                y: minY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            } : {x: 0, y: 0, width: canvas.width, height: canvas.height};
        }
        catch (error) {
            return null;
        }
        const result = {canvas, bounds: asset.bounds};
        asset.tinted.set(faction.key, result);
        return result;
    }

    function renderBuildingSprites(ctx) {
        const seen = new Set();
        const buildings = [];
        const collect = (building) => {
            if (!isBuildingCorePixel(building) || building.buildingState === "destroyed" || seen.has(building)) return;
            seen.add(building);
            buildings.push(building);
        };
        manager.settlements.forEach(collect);
        manager.constructionSites.forEach(collect);
        manager.structures.forEach(collect);
        buildings.sort((first, second) => first.y - second.y || safeNumber(first.buildingId, 0) - safeNumber(second.buildingId, 0));
        buildings.forEach((building) => {
            const faction = building.factionColor || factionColor(building.factionId) || building.color;
            const descriptor = buildingSpriteDescriptor(building);
            const asset = requestBuildingSprite(descriptor);
            const sprite = tintedBuildingSprite(asset, faction);
            const bounds = sprite && sprite.bounds || asset && asset.bounds || {x: 0, y: 0, width: 1, height: 1};
            const rect = buildingDisplayRect(building, bounds);
            ctx.save();
            ctx.globalAlpha = building.element === "civ_construction" ? 0.55 : 1;
            if (sprite) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(
                    sprite.canvas,
                    bounds.x,
                    bounds.y,
                    bounds.width,
                    bounds.height,
                    canvasCoord(rect.left),
                    canvasCoord(rect.top),
                    rect.width * pixelSize,
                    rect.height * pixelSize
                );
            }
            else {
                ctx.fillStyle = faction;
                ctx.fillRect(canvasCoord(rect.left), canvasCoord(rect.top), rect.width * pixelSize, rect.height * pixelSize);
            }
            ctx.restore();
        });
    }

    const organicReactions = {
        cancer: {elem1: "cancer", chance: 0.005},
        radiation: {elem1: ["ash", "meat", "rotten_meat", "cooked_meat"], chance: 0.4},
        plague: {elem1: "plague", chance: 0.05}
    };

    elements.civilized_human = {
        color: SKIN_COLORS,
        category: "civilization",
        properties: {dead: false, dir: 1, panic: 0},
        onPlace: function (pixel) { materializeAdult(pixel, {factionColor: selectedPlacementFactionColor(pixel)}); },
        related: ["civ_body", "civ_head", "civ_child", "civ_banner", "civ_hut_core", "civ_farm_marker", "civ_workshop_core"],
        cooldown: typeof defaultCooldown !== "undefined" ? defaultCooldown : 1,
        maxSize: 1,
        customColor: true,
        forceSaveColor: true,
        desc: "会结成阵营、采集、建造、繁衍并因长期敌意发动战争的人类。"
    };

    elements.civ_body = {
        color: FACTION_COLORS,
        category: "civilization",
        hidden: true,
        density: 1500,
        state: "solid",
        relationGravity: "managed",
        conduct: 0.05,
        temp: 37,
        tempHigh: 150,
        stateHigh: "cooked_meat",
        tempLow: -30,
        stateLow: "frozen_meat",
        burn: 10,
        burnTime: 250,
        burnInto: "cooked_meat",
        breakInto: ["blood", "meat", "bone"],
        properties: {dead: false, dir: 1, panic: 0, hp: C.ADULT_HP, maxHp: C.ADULT_HP, role: "worker", task: "idle", weapon: "fists"},
        reactions: organicReactions,
        tick: tickBody,
        renderer: renderCivilizedBody,
        hoverStat: actorHoverStat,
        onPlace: registerPixel,
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true,
        pickElement: "civilized_human"
    };

    elements.civ_head = {
        color: SKIN_COLORS,
        category: "civilization",
        hidden: true,
        density: 1080,
        state: "solid",
        conduct: 0.05,
        temp: 37,
        tempHigh: 150,
        stateHigh: "cooked_meat",
        tempLow: -30,
        stateLow: "frozen_meat",
        burn: 10,
        burnTime: 250,
        burnInto: "cooked_meat",
        breakInto: ["blood", "meat", "bone"],
        properties: {dead: false},
        reactions: organicReactions,
        tick: tickHead,
        simulationTickInterval: 4,
        hoverStat: actorHoverStat,
        onPlace: registerPixel,
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true,
        pickElement: "civilized_human"
    };

    elements.civ_child = {
        color: FACTION_COLORS,
        category: "civilization",
        hidden: true,
        density: 1200,
        state: "solid",
        conduct: 0.04,
        temp: 37,
        tempHigh: 150,
        stateHigh: "cooked_meat",
        tempLow: -30,
        stateLow: "frozen_meat",
        burn: 10,
        burnTime: 200,
        burnInto: "cooked_meat",
        breakInto: ["blood", "meat", "bone"],
        properties: {dead: false, hp: C.CHILD_HP, maxHp: C.CHILD_HP, role: "child", weapon: "fists", dir: 1},
        reactions: organicReactions,
        tick: tickChild,
        hoverStat: actorHoverStat,
        onPlace: registerPixel,
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true
    };

    elements.civ_banner = {
        color: FACTION_COLORS,
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        alwaysOverlay: true,
        nonBlocking: true,
        eraseProtected: true,
        isBuildingCore: true,
        state: "solid",
        density: 1800,
        burn: 35,
        burnTime: 160,
        burnInto: ["ash", "civ_ruin"],
        breakInto: "civ_ruin",
        properties: {structureHp: 120, structureMaxHp: 120, housing: 4, territoryRadius: C.TERRITORY_BASE_RADIUS, stage: "camp", stock: {food: 0, wood: 0, stone: 0, seeds: {}}, diplomacy: {}, alwaysOverlay: true, nonBlocking: true, eraseProtected: true, isBuildingCore: true},
        renderer: function () {},
        onPlace: bannerOnPlace,
        onErase: function (pixel) { destroyBuilding(pixel, "erased"); },
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        hoverStat: bannerHoverStat,
        hoverRender: renderTerritoryHover,
        forceSaveColor: true
    };

    elements.civ_hut_core = {
        color: "#8d633f",
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        alwaysOverlay: true,
        nonBlocking: true,
        eraseProtected: true,
        isBuildingCore: true,
        state: "solid",
        density: 1700,
        burn: 45,
        burnTime: 180,
        burnInto: "civ_ruin",
        breakInto: "civ_ruin",
        properties: {structureHp: 120, structureMaxHp: 120, alwaysOverlay: true, nonBlocking: true, eraseProtected: true, isBuildingCore: true},
        renderer: function () {},
        onPlace: function (pixel) { structureOnPlace(pixel, 120); },
        onErase: function (pixel) { destroyBuilding(pixel, "erased"); },
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true
    };

    elements.civ_farm_marker = {
        color: "#a88942",
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        alwaysOverlay: true,
        nonBlocking: true,
        eraseProtected: true,
        isBuildingCore: true,
        state: "solid",
        density: 1500,
        burn: 50,
        burnTime: 120,
        burnInto: "ash",
        breakInto: "dirt",
        properties: {structureHp: 60, structureMaxHp: 60, plots: [], alwaysOverlay: true, nonBlocking: true, eraseProtected: true, isBuildingCore: true},
        renderer: function () {},
        onPlace: function (pixel) { structureOnPlace(pixel, 60); },
        onErase: function (pixel) { destroyBuilding(pixel, "erased"); },
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true
    };

    elements.civ_workshop_core = {
        color: "#77756f",
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        alwaysOverlay: true,
        nonBlocking: true,
        eraseProtected: true,
        isBuildingCore: true,
        state: "solid",
        density: 2200,
        burn: 20,
        burnTime: 220,
        burnInto: "civ_ruin",
        breakInto: "civ_ruin",
        properties: {structureHp: 120, structureMaxHp: 120, alwaysOverlay: true, nonBlocking: true, eraseProtected: true, isBuildingCore: true},
        renderer: function () {},
        onPlace: function (pixel) { structureOnPlace(pixel, 120); },
        onErase: function (pixel) { destroyBuilding(pixel, "erased"); },
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true
    };

    function defineSocietyStructureElement(name, options) {
        const opts = options || {};
        elements[name] = {
            color: opts.color || "#77756f",
            category: "civilization",
            hidden: true,
            behavior: behaviors.WALL,
            alwaysOverlay: true,
            nonBlocking: true,
            eraseProtected: true,
            isBuildingCore: true,
            state: "solid",
            density: opts.density || 2100,
            burn: opts.burn === undefined ? 20 : opts.burn,
            burnTime: opts.burnTime || 200,
            burnInto: opts.burnInto || "civ_ruin",
            breakInto: opts.breakInto || "civ_ruin",
            properties: {structureHp: opts.hp || 140, structureMaxHp: opts.hp || 140, alwaysOverlay: true, nonBlocking: true, eraseProtected: true, isBuildingCore: true},
            renderer: function () {},
            onPlace: function (pixel) { structureOnPlace(pixel, opts.hp || 140); },
            onErase: function (pixel) { destroyBuilding(pixel, "erased"); },
            onChange: onCivilizedChange,
            onDelete: onCivilizedDelete,
            forceSaveColor: true
        };
    }

    defineSocietyStructureElement("civ_hearth_core", {color: ["#9a4e2f", "#c06a36"], hp: 80, density: 1800, burn: 5});
    defineSocietyStructureElement("civ_quarry_core", {color: ["#77756f", "#66645f"], hp: 160, density: 2600, burn: 0, breakInto: ["rock", "gravel"]});
    defineSocietyStructureElement("civ_granary_core", {color: ["#9b7440", "#b1884d"], hp: 150, density: 1800, burn: 55});
    defineSocietyStructureElement("civ_kiln_core", {color: ["#704e43", "#835b45"], hp: 170, density: 2500, burn: 0, breakInto: ["brick_rubble", "rock"]});
    defineSocietyStructureElement("civ_foundry_core", {color: ["#5f5652", "#776762"], hp: 190, density: 2700, burn: 0, breakInto: ["metal_scrap", "rock"]});
    defineSocietyStructureElement("civ_forge_core", {color: ["#4f5155", "#686a70"], hp: 220, density: 2800, burn: 0, breakInto: ["metal_scrap", "rock"]});
    defineSocietyStructureElement("civ_keep_core", {color: ["#606269", "#74777e"], hp: 420, density: 2900, burn: 0, breakInto: ["rock", "gravel"]});
    defineSocietyStructureElement("civ_siege_workshop_core", {color: ["#6e5d49", "#806c53"], hp: 260, density: 2300, burn: 25});
    defineSocietyStructureElement("civ_library_core", {color: ["#756751", "#8a795d"], hp: 220, density: 2300, burn: 30});
    defineSocietyStructureElement("civ_market_core", {color: ["#8c653f", "#a47848"], hp: 190, density: 1900, burn: 45});
    defineSocietyStructureElement("civ_tower_core", {color: ["#65676b", "#797b80"], hp: 260, density: 2800, burn: 0, breakInto: ["rock", "gravel"]});
    defineSocietyStructureElement("civ_lumberyard_core", {color: ["#765033", "#8b5f39"], hp: 100, density: 1700, burn: 55, breakInto: ["sawdust", "wood"]});
    defineSocietyStructureElement("civ_gate", {color: ["#68452e", "#805637"], hp: 110, density: 1700, burn: 60, burnInto: ["ember", "ash"], breakInto: ["sawdust", "wood"]});

    // Legacy wall pixels are retained only so old saves can be migrated. New
    // palisades are represented by the single civ_gate logical core and its
    // render-only 3x3 faction-colored sprite.
    elements.civ_palisade = {
        color: ["#765033", "#8b5f39"],
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        state: "solid",
        density: 1700,
        burn: 65,
        burnTime: 200,
        burnInto: ["ember", "ash"],
        breakInto: ["sawdust", "wood"],
        properties: {structureHp: 90, structureMaxHp: 90},
        onPlace: function (pixel) { structureOnPlace(pixel, 90); },
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true
    };

    elements.civ_construction = {
        color: "#c6a36b",
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        alwaysOverlay: true,
        nonBlocking: true,
        eraseProtected: true,
        isBuildingCore: true,
        state: "solid",
        density: 1400,
        burn: 60,
        burnTime: 100,
        burnInto: "ash",
        properties: {alwaysOverlay: true, nonBlocking: true, eraseProtected: true, isBuildingCore: true},
        renderer: function () {},
        onPlace: registerPixel,
        onErase: function (pixel) { destroyBuilding(pixel, "erased"); },
        onChange: onCivilizedChange,
        onDelete: constructionOnDelete,
        forceSaveColor: true
    };

    elements.civ_structure_wood = {
        color: ["#825b39", "#966b43", "#765033"],
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        state: "solid",
        density: 1500,
        burn: 60,
        burnTime: 160,
        burnInto: ["ember", "charcoal", "ash"],
        breakInto: ["sawdust", "wood"],
        properties: {structureHp: 30, structureMaxHp: 30},
        onPlace: function (pixel) { structureOnPlace(pixel, 30); },
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true
    };

    elements.civ_structure_stone = {
        color: ["#77756f", "#85827a", "#686660"],
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        state: "solid",
        density: 2600,
        breakInto: ["rock", "gravel"],
        properties: {structureHp: 80, structureMaxHp: 80},
        onPlace: function (pixel) { structureOnPlace(pixel, 80); },
        onChange: onCivilizedChange,
        onDelete: onCivilizedDelete,
        forceSaveColor: true
    };

    elements.civ_ruin = {
        color: ["#665e52", "#766b5d", "#574f46"],
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        state: "solid",
        density: 2100,
        breakInto: ["rock", "gravel", "dirt"]
    };

    elements.civ_farm_crop = {
        color: ["#70a84f", "#91bd5e", "#d2ad45"],
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        state: "solid",
        density: 160,
        nonBlocking: true,
        humanCollectible: true,
        properties: {_civFarmCrop: true, nonBlocking: true, plantedTick: 0, matureTick: C.FARM_GROW_TICKS},
        tick: function (pixel) {
            if (!pixel || pixel.del || pixel.mature || pixelTicks < safeNumber(pixel.matureTick, safeNumber(pixel.plantedTick, pixelTicks) + C.FARM_GROW_TICKS)) return;
            pixel.mature = true;
            if (typeof setPixelColor === "function") setPixelColor(pixel, "#d2ad45");
        },
        forceSaveColor: true
    };

    elements.civ_wood_resource = {
        color: ["#8d5b35", "#a56d3e", "#724626"],
        category: "civilization",
        hidden: true,
        behavior: behaviors.POWDER,
        state: "solid",
        density: 720,
        movable: true,
        humanCollectible: true,
        properties: {_civResourceDrop: true, _civCollectible: true, resourceKind: "wood"},
        forceSaveColor: true
    };

    elements.civ_tree_sapling_resource = {
        color: ["#65a84a", "#7ebc57", "#4d8f3c"],
        category: "civilization",
        hidden: true,
        behavior: behaviors.POWDER,
        state: "solid",
        density: 620,
        movable: true,
        humanCollectible: true,
        properties: {_civResourceDrop: true, _civCollectible: true, resourceKind: TREE_SAPLING_PREFIX + "sapling", treeSapling: "sapling"},
        forceSaveColor: true
    };

    function defineFallingResourceElement(name, colors, kind, density, extraProperties) {
        elements[name] = {
            color: colors,
            category: "civilization",
            hidden: true,
            behavior: behaviors.POWDER,
            state: "solid",
            density: density,
            movable: true,
            humanCollectible: true,
            properties: Object.assign({_civResourceDrop: true, _civCollectible: true, resourceKind: kind}, extraProperties || {}),
            forceSaveColor: true
        };
    }

    defineFallingResourceElement("civ_food_resource", ["#b65f45", "#d18455", "#9d493b"], "food", 760);
    defineFallingResourceElement("civ_stone_resource", ["#77756f", "#918e86", "#625f5a"], "stone", 2100);
    defineFallingResourceElement("civ_copper_resource", ["#b87333", "#cf8648", "#915728"], "copper", 1900);
    defineFallingResourceElement("civ_tin_resource", ["#b8bcc0", "#d1d4d6", "#969b9f"], "tin", 1800);
    defineFallingResourceElement("civ_raw_iron_resource", ["#8d756b", "#a48779", "#715d56"], "raw_iron", 2200);
    defineFallingResourceElement("civ_charcoal_resource", ["#343434", "#484848", "#252525"], "charcoal", 620);
    defineFallingResourceElement("civ_seed_resource", ["#c9ad55", "#ddc46c", "#a68b3f"], "seed:wheat_seed", 540, {resourceSeed: "wheat_seed"});
    defineFallingResourceElement("civ_resource_drop", ["#d1b36b", "#8a9b72", "#8299a8"], "resource", 900);

    elements.civ_tunnel = {
        color: ["#795c3f", "#6d5138", "#856447"],
        category: "civilization",
        hidden: true,
        behavior: behaviors.WALL,
        state: "solid",
        density: 1900,
        isTunnel: true,
        supportsPowder: true,
        overlapLocked: true,
        properties: {naturalVegetation: false, isTunnel: true, supportsPowder: true, overlapLocked: true},
        forceSaveColor: true
    };

    const ERA_NAMES_ZH = {
        tribal: "部落时代", stone: "石器时代", agriculture: "农耕时代",
        bronze: "青铜时代", iron: "铁器时代", castle: "城堡时代"
    };
    const TECH_NAMES_ZH = {
        organized_gathering: "有组织采集", careful_gathering: "精细采集", controlled_fire: "火种掌控", simple_shelters: "简易住所", woodworking: "木工",
        clan_council: "氏族议会", oral_tradition: "口述传统", war_clubs: "战棍", hunting_cooperation: "协作狩猎",
        stone_knapping: "石器打制", stone_sorting: "石料筛选", polished_axes: "磨制石器", artisan_shed: "工匠棚", quarrying: "采石",
        craft_specialization: "手工业分工", tally_marks: "刻划记事", stone_spearheads: "石制矛头", palisade_defense: "木栅防御",
        seed_selection: "选种", managed_forestry: "林业管理", intensive_harvesting: "丰产采收", granary: "粮仓", irrigation: "灌溉",
        village_planning: "村落规划", barter: "物物交换", militia: "民兵制度", bowmaking: "丝弦法", rattan_armor: "藤甲",
        copper_prospecting: "生铜勘探", tin_prospecting: "青铜合金", charcoal_kiln: "木柴冶炼", bronze_foundry: "青铜铸造", bronze_tools: "青铜工具",
        writing: "文字", administration: "行政管理", bronze_weapons: "范铸法", shield_formation: "盾阵",
        iron_prospecting: "生铁勘探", iron_smelting: "炒炼法", iron_extraction_tools: "铁制采掘工具", forge: "炼钢作坊", stone_fortifications: "石制防御工事",
        coinage: "铸币", codified_law: "成文法", iron_weapons: "铁匠铺", iron_armor: "铁甲护身",
        steelmaking: "炼钢", advanced_extraction: "高效采掘", crop_rotation: "轮作", castle_building: "城堡建筑", siege_workshop: "攻城工坊",
        library: "图书馆", guild_market: "行会市场", crossbow: "机括制造", siege_engineering: "攻城工程", carburizing_tempering: "渗碳百炼", steel_armor: "钢甲裹身"
    };
    const DOMAIN_NAMES_ZH = {production: "生产", construction: "建造", society: "社会", military: "军事"};
    const RESOURCE_NAMES_ZH = {
        food: "食物", wood: "木头", stone: "石头", seed: "种子", tree_seed: "树种", water: "水", salt_water: "盐水", dirty_water: "污水",
        copper: "生铜", tin: "生铜", raw_iron: "生铁", iron: "熟铁", steel: "合金钢", charcoal: "木头", bronze: "青铜",
        tree_branch: "树枝", evergreen: "常绿木", bamboo: "竹材", bamboo_plant: "竹苗", sapling: "树苗", pinecone: "松树苗",
        wheat_seed: "小麦种子", corn_seed: "玉米种子", apple: "苹果", apple_seed: "苹果种子", meat: "肉", cooked_meat: "熟肉", rotten_meat: "腐肉",
        rock: "岩石", gravel: "砾石", limestone: "石灰岩", basalt: "玄武岩", command_destination: "指令目的地", building: "建筑", resource: "资源"
    };
    const RESOURCE_NAMES_EN = {
        food: "Food", wood: "Wood", stone: "Stone", copper: "Raw copper", bronze: "Bronze",
        raw_iron: "Raw iron", iron: "Refined iron", steel: "Alloy steel", sapling: "Sapling",
        command_destination: "Command destination", building: "Building", resource: "Resource"
    };
    const TREE_SAPLING_NAMES = {
        sapling: ["Tree sapling", "普通树苗"], pinecone: ["Pine sapling", "松树苗"], bamboo_plant: ["Bamboo shoot", "竹苗"]
    };
    const BUILDING_NAMES = {
        town_center: ["Town center", "城镇中心"], civ_banner: ["Town center", "城镇中心"], construction: ["Construction site", "施工点"], civ_construction: ["Construction site", "施工点"],
        hut: ["Hut", "住房"], civ_hut_core: ["Hut", "住房"], workshop: ["Workshop", "工坊"], civ_workshop_core: ["Workshop", "工坊"],
        farm: ["Farm", "农场"], civ_farm_marker: ["Farm", "农场"], lumberyard: ["Lumberyard", "伐木场"], civ_lumberyard_core: ["Lumberyard", "伐木场"],
        hearth: ["Hearth", "火塘"], civ_hearth_core: ["Hearth", "火塘"], quarry: ["Quarry", "采石场"], civ_quarry_core: ["Quarry", "采石场"],
        granary: ["Granary", "粮仓"], civ_granary_core: ["Granary", "粮仓"], kiln: ["Ironworks", "冶铁作坊"], civ_kiln_core: ["Ironworks", "冶铁作坊"],
        foundry: ["Foundry", "冶铸作坊"], civ_foundry_core: ["Foundry", "冶铸作坊"], forge: ["Steelworks", "炼钢作坊"], civ_forge_core: ["Steelworks", "炼钢作坊"],
        palisade: ["Palisade", "木栅"], civ_gate: ["Palisade gate", "木栅门"], watchtower: ["Watchtower", "瞭望塔"], civ_tower_core: ["Watchtower", "瞭望塔"],
        keep: ["Keep", "城堡主楼"], civ_keep_core: ["Keep", "城堡主楼"], siege_workshop: ["Siege workshop", "攻城工坊"], civ_siege_workshop_core: ["Siege workshop", "攻城工坊"],
        library: ["Library", "图书馆"], civ_library_core: ["Library", "图书馆"], market: ["Market", "市场"], civ_market_core: ["Market", "市场"]
    };
    const MILESTONE_NAMES = {
        technologies: ["technologies researched", "已研发科技"], eras: ["eras entered", "进入时代"], buildingsCompleted: ["buildings completed", "完工建筑"],
        resourceDeliveries: ["resource deliveries", "资源运送次数"], harvests: ["harvests", "采集次数"], treesPlanted: ["trees planted", "植树数量"],
        itemsSmelted: ["processing batches", "加工批次"], births: ["births", "人口诞生数"]
    };
    const WAR_REASON_LABELS = {manual: ["manual declaration", "手动宣战"], resource_exhaustion: ["non-renewable resources exhausted", "不可再生资源枯竭"]};
    const SETTLEMENT_STAGE_LABELS = {nomadic: ["Nomadic", "游牧阶段"], camp: ["Camp", "营地阶段"], village: ["Village", "村落阶段"], town: ["Town", "城镇阶段"]};
    const PERSON_TASK_LABELS = {
        idle: ["Idle", "待命"], planning: ["Planning work", "规划工作"], move: ["Following command", "执行移动命令"], wander: ["Exploring", "探索"], explore: ["Exploring", "探索"], search_resource: ["Searching resources", "搜寻资源"], harvest: ["Gathering", "采集"], deliver: ["Delivering", "运输"],
        extinguish: ["Extinguishing fire", "灭火"], build: ["Building", "建造"], farm: ["Farming", "耕作"], plant_tree: ["Planting trees", "种树"], wait_tree_growth: ["Waiting for trees to mature", "等待树木成长"], facility: ["Working", "设施工作"],
        combat: ["Fighting", "战斗"], siege: ["Sieging", "攻城"], flee: ["Fleeing", "逃跑"], patrol: ["Patrolling", "巡逻"],
        return: ["Returning", "返回聚落"], placed: ["Entered the world", "进入世界"], birth: ["Born", "出生"], maturity: ["Reached adulthood", "成年"],
        faction_changed: ["Changed faction", "阵营变更"], role_changed: ["Changed role", "职业变更"], death: ["Died", "死亡"], dead: ["Dead", "已死亡"],
        weapon_equipped: ["Equipped weapon", "装备武器"], weapon_removed: ["Removed weapon", "卸下武器"],
        armor_equipped: ["Equipped armor", "装备护甲"], armor_removed: ["Removed armor", "卸下护甲"],
        route_created: ["Planned a route", "规划路线"], resources_unloaded: ["Unloaded resources", "卸下资源"], return_started: ["Started returning", "开始返程"],
        return_broken: ["Return route was blocked", "返程路线受阻"], legacy_child_conversion: ["Legacy child converted", "旧存档儿童转为工作人口"]
    };
    const PERSON_PHASE_LABELS = {
        planning: ["Planning", "规划中"], flat: ["Travelling", "平地移动"], climb: ["Climbing", "攀爬"], tunnel: ["Digging a tunnel", "挖掘矿洞"],
        working: ["Working", "工作中"], waiting: ["Waiting", "等待中"], searching: ["Searching", "搜寻中"], exploring: ["Exploring", "探索中"], patrolling: ["Patrolling", "巡逻中"], attacking: ["Attacking", "攻击中"], fall: ["Falling", "下落"], idle: ["Idle", "待命"]
    };
    const PERSON_OUTCOME_LABELS = {active: ["Active", "进行中"], completed: ["Completed", "完成"], failed: ["Failed", "失败"], interrupted: ["Interrupted", "中断"], death: ["Died", "死亡"]};
    const PERSON_ROLE_LABELS = {
        child: ["Child", "儿童"], worker: ["Worker", "劳动者"], food: ["Gatherer", "采食者"], wood: ["Woodcutter", "伐木工"],
        miner: ["Miner", "矿工"], builder: ["Builder", "建造者"], farmer: ["Farmer", "农民"], forester: ["Forester", "林务员"],
        hunter: ["Hunter", "猎人"], artisan: ["Artisan", "工匠"], industry: ["Industrial worker", "产业工人"], scholar: ["Scholar", "学者"],
        merchant: ["Merchant", "商人"], artisan_trade: ["Trader", "贸易工匠"], warrior: ["Warrior", "战士"], guard: ["Guard", "守卫"]
    };
    const PERSON_WEAPON_LABELS = {
        fist: ["Unarmed", "徒手"], fists: ["Unarmed", "徒手"], club: ["Wooden club", "木棍"],
        spear: ["Stone spear", "石矛"], stone_spear: ["Stone spear", "石矛"], bow: ["Bow", "弓"],
        bronze_spear: ["Bronze spear", "青铜矛"], bronze_sword: ["Bronze sword", "青铜剑"],
        iron_spear: ["Iron spear", "铁矛"], iron_sword: ["Iron sword", "铁剑"],
        steel_blade: ["Steel blade", "钢刀"], steel_spear: ["Steel spear", "钢矛"], crossbow: ["Crossbow", "弩"]
    };
    const PERSON_ARMOR_LABELS = {
        none: ["Unarmored", "无护甲"], rattan: ["Rattan armor", "藤甲"], iron: ["Iron armor", "铁甲"], steel: ["Steel armor", "钢甲"]
    };
    const PERSON_DEATH_CAUSE_LABELS = {injury: ["Injury", "伤害"], old_age: ["Old age", "寿终"], erased: ["Erased", "被擦除"], changed: ["Transformed", "发生转化"], environment: ["Environment", "环境伤害"]};
    let selectedCivilizationFactionId = null;
    let selectedCivilizationSettlementId = null;
    let selectedCivilizationTab = "overview";
    let selectedPersonId = null;
    let focusedPersonId = null;
    let peoplePanelOpen = false;
    let peopleRefreshFrame = null;
    let peopleLastRefreshAt = 0;
    let peopleHistoryLimit = C.PEOPLE_HISTORY_PAGE_SIZE;
    let commandPersonId = null;
    let commandHover = null;
    let commandLastResult = null;
    let commandInputInstalled = false;
    let interactionMode = "place";

    function isChineseUi() {
        if (typeof langCode !== "undefined") return String(langCode).toLowerCase() === "zh_cn";
        return typeof navigator !== "undefined" && /^(zh-cn|zh-sg)\b/i.test(navigator.language || "");
    }

    function civilizationText(key, english, chinese) {
        const translated = typeof langKey === "function" ? langKey("humanSociety." + key, null) : null;
        return translated || (isChineseUi() ? chinese : english);
    }

    function localizedEraName(era) {
        if (!era) return civilizationText("era.unknown", "Unknown Era", "未知时代");
        return civilizationText("era." + era.id, era.name || era.id, ERA_NAMES_ZH[era.id] || "未知时代");
    }

    function localizedTechName(techOrId) {
        const id = typeof techOrId === "string" ? techOrId : techOrId && techOrId.id;
        const tech = typeof techOrId === "string" ? manager.technologies.get(techOrId) : techOrId;
        if (!id) return civilizationText("tech.unknown", "Unknown technology", "未知科技");
        return civilizationText("tech." + id, tech && (tech.name || id) || id.replace(/_/g, " "), TECH_NAMES_ZH[id] || "未知科技");
    }

    function localizedDomain(domain) {
        const value = String(domain || "");
        return civilizationText("domain." + value, value || "Knowledge domain", DOMAIN_NAMES_ZH[value] || "知识领域");
    }

    function localizedMilestoneName(milestone) {
        const value = String(milestone || "");
        const entry = MILESTONE_NAMES[value];
        if (entry) return civilizationText("milestone." + value, entry[0], entry[1]);
        return isChineseUi() ? "发展里程碑" : value.replace(/_/g, " ");
    }

    function localizedWarReason(reason) {
        const value = String(reason || "");
        const entry = WAR_REASON_LABELS[value];
        if (entry) return civilizationText("warReason." + value, entry[0], entry[1]);
        return isChineseUi() ? "其他原因" : value.replace(/_/g, " ");
    }

    function localizedSettlementStage(stage) {
        const value = String(stage || "camp");
        const entry = SETTLEMENT_STAGE_LABELS[value];
        if (entry) return civilizationText("stage." + value, entry[0], entry[1]);
        return isChineseUi() ? "聚落阶段" : value.replace(/_/g, " ");
    }

    function localizedBuildingName(building) {
        const value = String(building || "building");
        const entry = BUILDING_NAMES[value] || BUILDING_NAMES[value.replace(/^civ_|_core$/g, "")];
        if (entry) return civilizationText("building." + value, entry[0], entry[1]);
        return isChineseUi() ? "建筑" : value.replace(/^civ_/, "").replace(/_core$/, "").replace(/_/g, " ");
    }

    function conditionDescription(state) {
        const condition = state.condition || {};
        const mark = state.met ? "✓ " : "○ ";
        const resource = localizedResourceName(condition.resource);
        const progress = " (" + Math.floor(safeNumber(state.current, 0)) + "/" + safeNumber(state.required, condition.minimum || 0) + ")";
        if (condition.type === "population") return mark + civilizationText("condition.population", "Population", "人口") + " ≥ " + condition.minimum + progress;
        if (condition.type === "resource_stock") return mark + civilizationText("condition.stock", "Stock", "库存") + " " + resource + " ≥ " + condition.minimum + progress;
        if (condition.type === "resource_encountered") return mark + civilizationText("condition.encounter", "Discover", "发现") + " " + resource + " × " + condition.minimum + progress;
        if (condition.type === "heat_available") return mark + civilizationText("condition.heat", "Available heat", "可用热值") + " ≥ " + condition.minimum + progress;
        if (condition.type === "milestone") return mark + civilizationText("condition.milestone", "Milestone", "里程碑") + " " + localizedMilestoneName(condition.id) + " × " + condition.minimum + progress;
        return mark + civilizationText("condition.other", "Other condition", "其他条件");
    }

    function localizedPersonLabel(group, key, fallback, chineseFallback) {
        const entry = key !== null && key !== undefined && Object.prototype.hasOwnProperty.call(group, key) ? group[key] : null;
        if (!entry) return isChineseUi() ? (chineseFallback || "未知状态") : (fallback || key || "");
        return civilizationText("people." + key, entry[0], entry[1]);
    }

    function localizedResourceName(kind) {
        const value = String(kind || "");
        if (value.indexOf(TREE_SAPLING_PREFIX) === 0) {
            const seed = value.slice(TREE_SAPLING_PREFIX.length);
            const entry = TREE_SAPLING_NAMES[seed];
            if (entry) return civilizationText("resource.treeSapling." + seed, entry[0], entry[1]);
            return (isChineseUi() ? "树苗 " : "Tree sapling ") + localizedResourceName(seed);
        }
        if (value.indexOf("seed:") === 0) {
            const seed = value.slice(5);
            return localizedResourceName(seed);
        }
        if (BUILDING_NAMES[value]) return localizedBuildingName(value);
        if (isChineseUi() && RESOURCE_NAMES_ZH[value]) return RESOURCE_NAMES_ZH[value];
        const translated = typeof langKey === "function" ? langKey(value, null) : null;
        if (translated && translated !== value) return translated;
        if (!isChineseUi() && RESOURCE_NAMES_EN[value]) return RESOURCE_NAMES_EN[value];
        return isChineseUi() ? (RESOURCE_NAMES_ZH[value] || "资源") : value.replace(/_/g, " ");
    }

    const YIELD_MODIFIER_RESOURCES = Object.freeze({
        foodYieldBonus: "food",
        woodYieldBonus: "wood",
        stoneYieldBonus: "stone",
        copperYieldBonus: "copper",
        rawIronYieldBonus: "raw_iron"
    });

    function technologyYieldEffectDescriptions(technology) {
        if (!technology || !Array.isArray(technology.effects)) return [];
        return technology.effects.reduce((descriptions, effect) => {
            const resourceKind = effect && effect.type === "modifier" ? YIELD_MODIFIER_RESOURCES[effect.stat] : null;
            if (!resourceKind || !Number.isFinite(effect.value) || effect.value <= 0) return descriptions;
            descriptions.push(localizedResourceName(resourceKind) + civilizationText("tech.yieldBonus", " yield +", "产量 +") + Math.round(effect.value * 100) + "%");
            return descriptions;
        }, []);
    }

    function localizedRecipeName(recipeId) {
        const value = String(recipeId || "");
        if (value === "bronze" || value === "iron" || value === "steel") return localizedResourceName(value);
        return isChineseUi() ? "加工配方" : value.replace(/_/g, " ");
    }

    function localizedResearchBlocker(blocker) {
        if (!blocker) return "";
        const reasonParts = String(blocker.reason || "").split(":");
        const type = blocker.type || reasonParts[0] || "unknown";
        const subject = blocker.resource || blocker.milestone || blocker.prerequisiteId || reasonParts[1] || "";
        const techId = blocker.techId || reasonParts[2] || "";
        const current = Math.floor(safeNumber(blocker.current, 0));
        const required = safeNumber(blocker.required, 0);
        let detail;
        if (type === "prerequisite") detail = civilizationText("blocker.prerequisite", "Missing prerequisite", "缺少前置科技") + "：" + localizedTechName(subject);
        else if (type === "resource_stock") detail = civilizationText("blocker.stock", "Stock", "库存") + " " + localizedResourceName(subject) + " " + current + "/" + required;
        else if (type === "resource_encountered") detail = civilizationText("blocker.encounter", "Discovery", "资源发现") + " " + localizedResourceName(subject) + " " + current + "/" + required;
        else if (type === "population") detail = civilizationText("condition.population", "Population", "人口") + " " + current + "/" + required;
        else if (type === "heat_available") detail = civilizationText("condition.heat", "Available heat", "可用热值") + " " + current + "/" + required;
        else if (type === "milestone") detail = localizedMilestoneName(subject) + " " + current + "/" + required;
        else if (type === "era") {
            const tech = manager.technologies.get(techId);
            detail = civilizationText("blocker.era", "Requires era", "需要时代") + "：" + localizedEraName(eraDefinition(tech && techEraId(tech)));
        }
        else detail = civilizationText("blocker.other", "Research conditions are not met", "研发条件尚未满足");
        return civilizationText("blocker.title", "Research blocked", "研究受阻") + "：" + localizedTechName(techId) + " · " + detail;
    }

    function chronicleHasValue(value) {
        return value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== "") && !/^(?:undefined|null)$/i.test(String(value).trim());
    }

    function chronicleAmount(event) {
        return event && chronicleHasValue(event.amount) && Number.isFinite(Number(event.amount)) ? " ×" + Math.round(Number(event.amount)) : "";
    }

    function legacyChronicleBody(message) {
        const value = String(message || "").trim();
        return value.replace(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\s*(?:·|\|)\s*/, "");
    }

    function localizedLegacyTechName(name) {
        const value = String(name || "").trim();
        const normalized = value.toLowerCase();
        const technology = Array.from(manager.technologies.values()).find((candidate) => candidate && (
            String(candidate.id || "").toLowerCase() === normalized || String(candidate.name || "").toLowerCase() === normalized ||
            String(TECH_NAMES_ZH[candidate.id] || "").toLowerCase() === normalized
        ));
        return localizedTechName(technology || value);
    }

    function localizedLegacyEraName(name) {
        const value = String(name || "").trim();
        const normalized = value.toLowerCase();
        const era = Array.from(manager.eras.values()).find((candidate) => candidate && (
            String(candidate.id || "").toLowerCase() === normalized || String(candidate.name || "").toLowerCase() === normalized ||
            String(ERA_NAMES_ZH[candidate.id] || "").toLowerCase() === normalized
        ));
        return localizedEraName(era || null);
    }

    function localizedLegacyChronicleMessage(message) {
        const value = legacyChronicleBody(message);
        if (!value) return civilizationText("log.other", "Civilization event", "文明发展事件");
        if (!isChineseUi()) return value;
        let match = value.match(/^(?:首次采集(?:树苗)?资源|First gathered resource)\s*[:：]\s*(.+)$/i);
        if (match) return civilizationText("log.firstResource", "First gathered resource", "首次采集资源") + "：" + localizedResourceName(match[1]);
        match = value.match(/^(?:领地内发现矿脉|Mineral vein discovered in the territory)\s*[:：]\s*(.+)$/i);
        if (match) return civilizationText("log.mineralBreakthrough", "Mineral vein discovered in the territory", "领地内发现矿脉") + "：" + localizedResourceName(match[1]);
        match = value.match(/^(?:首次生产资源|First produced resource)\s*[:：]\s*(.+)$/i);
        if (match) return civilizationText("log.firstProduction", "First produced resource", "首次生产资源") + "：" + localizedResourceName(match[1]);
        match = value.match(/^(?:科技完成|Technology completed)\s*[:：]\s*(.+)$/i);
        if (match) return civilizationText("log.technology", "Technology completed", "科技完成") + "：" + localizedLegacyTechName(match[1]);
        match = value.match(/^(?:进入时代|Entered era)\s*[:：]\s*(.+)$/i);
        if (match) return civilizationText("log.era", "Entered era", "进入时代") + "：" + localizedLegacyEraName(match[1]);
        match = value.match(/^(?:开始建造|Construction started)\s*[:：]\s*(.+)$/i);
        if (match) return civilizationText("log.construction", "Construction started", "开始建造") + "：" + localizedBuildingName(match[1]);
        match = value.match(/^(?:建筑完成|Building completed)\s*[:：]\s*(.+)$/i);
        if (match) return civilizationText("log.building", "Building completed", "建筑完成") + "：" + localizedBuildingName(match[1]);
        match = value.match(/^(?:建筑被摧毁|Building destroyed)\s*[:：]\s*(.+)$/i);
        if (match) return civilizationText("log.buildingDestroyed", "Building destroyed", "建筑被摧毁") + "：" + localizedBuildingName(match[1]);
        if (/[\u3400-\u9fff]/.test(value)) return value;
        return civilizationText("log.other", "Civilization event", "文明发展事件");
    }

    function localizedChronicleTimestamp(event) {
        if (event && typeof event === "object" && chronicleHasValue(event.timestamp)) return String(event.timestamp);
        if (typeof event === "string") {
            const match = event.trim().match(/^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})\s*(?:·|\|)\s*/);
            if (match) return match[1];
        }
        return civilizationText("log.unknownTime", "Unknown time", "时间不详");
    }

    function localizedFactionReference(factionId) {
        if (chronicleHasValue(factionId) && Number.isFinite(Number(factionId))) {
            return civilizationText("ui.faction", "Faction", "阵营") + " " + Number(factionId);
        }
        return civilizationText("log.unknownFaction", "Unknown faction", "未知阵营");
    }

    function localizedChronicleMessage(event) {
        if (typeof event === "string") return localizedLegacyChronicleMessage(event);
        if (!event || typeof event !== "object") return civilizationText("log.other", "Civilization event", "文明发展事件");
        const human = chronicleHasValue(event.humanId) && Number.isFinite(Number(event.humanId)) ? " H" + Number(event.humanId) : "";
        const building = localizedBuildingName(event.buildingType || "building");
        switch (event.type) {
        case "first_resource":
            return civilizationText("log.firstResource", "First gathered resource", "首次采集资源") + "：" + localizedResourceName(event.resource) + chronicleAmount(event);
        case "mineral_breakthrough":
            return civilizationText("log.mineralBreakthrough", "Mineral vein discovered in the territory", "领地内发现矿脉") + "：" + localizedResourceName(event.resource) + chronicleAmount(event);
        case "technology":
            return civilizationText("log.technology", "Technology completed", "科技完成") + "：" + localizedTechName(event.technologyId) + (event.forced ? civilizationText("log.forced", " (forced)", "（强制）") : "");
        case "era":
            return civilizationText("log.era", "Entered era", "进入时代") + "：" + localizedEraName(eraDefinition(event.eraId));
        case "construction":
            return civilizationText("log.construction", "Construction started", "开始建造") + "：" + building;
        case "building":
            return civilizationText("log.building", "Building completed", "建筑完成") + "：" + building;
        case "settlement":
            return civilizationText("log.settlement", "Settlement founded with a town center", "聚落形成并建立城镇中心");
        case "fire_extinguished":
            return civilizationText("log.fireExtinguished", "Fire extinguished", "扑灭火情") + human;
        case "tunnel":
            return civilizationText("log.tunnel", "First tunnel excavated", "首次开挖矿洞") + human;
        case "war":
            return (isChineseUi() ? "与" : "War began against ") + localizedFactionReference(event.enemyFactionId) + (isChineseUi() ? "开战：" : ": ") + localizedWarReason(event.reason);
        case "town_center_destroyed":
            return civilizationText("log.townCenterDestroyed", "Town center destroyed; settlement operations suspended", "城镇中心被摧毁，聚落暂停运作");
        case "building_destroyed":
            return civilizationText("log.buildingDestroyed", "Building destroyed", "建筑被摧毁") + "：" + building;
        case "town_center_rebuilt":
            return civilizationText("log.townCenterRebuilt", "Residents rebuilt the town center", "居民重建了城镇中心");
        case "annexation":
            return civilizationText("log.annexation", "Annexed ", "吞并") + localizedFactionReference(event.loserFactionId);
        case "war_wave":
            return chronicleHasValue(event.wave) && Number.isFinite(Number(event.wave)) ?
                civilizationText("log.warWave", "Attack wave ", "第 ") + Number(event.wave) + civilizationText("log.warWaveSuffix", " began", " 波进攻开始") :
                civilizationText("log.warWaveUnknown", "A new attack wave began", "新一波进攻开始");
        case "first_production":
            return civilizationText("log.firstProduction", "First produced resource", "首次生产资源") + "：" + localizedResourceName(event.resource) + chronicleAmount(event);
        case "birth":
            return civilizationText("log.birth", "Member born and assigned to work", "成员诞生并立即参加工作") + human;
        case "death":
            return civilizationText("log.death", "Member died", "成员死亡") + human + (event.cause ? " · " + localizedDeathCause(event.cause) : "");
        case "legacy_child_conversion":
            return civilizationText("log.legacyChild", "Legacy child converted into the unified workforce", "旧存档儿童已转换为统一工作人口") + human;
        case "resource_edit":
            return civilizationText("log.resourceEdit", "Player forcibly edited the resource stockpile", "玩家强制修改资源库存");
        default:
            return localizedLegacyChronicleMessage(event.message || event.type || "");
        }
    }

    function activityTargetLabel(targetKind, targetId, targetKey, x, y) {
        if ((targetKey && targetKey.indexOf("human:") === 0) || (Number.isFinite(targetId) && targetKey && targetKey.indexOf("human") === 0)) return "H" + targetId;
        if (targetKey && targetKey.indexOf("settlement:") === 0) return civilizationText("people.settlement", "Settlement ", "聚落 ") + targetId;
        if (targetKey && targetKey.indexOf("building:") === 0) return localizedResourceName(targetKind || "building") + " #" + targetId;
        let label = targetKind ? localizedResourceName(targetKind) : "";
        if (Number.isFinite(x) && Number.isFinite(y)) label += (label ? " " : "") + "(" + x + ", " + y + ")";
        return label;
    }

    function activityProgressForActor(actor) {
        if (!actor) return null;
        if (actor.task === "harvest") {
            const target = Number.isFinite(actor.harvestX) && Number.isFinite(actor.harvestY) ? pixelsAt(actor.harvestX, actor.harvestY).find((pixel) => resourceDescriptor(pixel)) : null;
            const descriptor = resourceDescriptor(target);
            if (!descriptor) return null;
            const faction = manager.factionById.get(actor.factionId);
            const mods = faction && faction.techModifiers || computeTechModifiers(faction);
            let total = descriptor.harvestTicks * safeNumber(mods.harvestSpeed, 1);
            if (descriptor.kind === "wood") total *= safeNumber(mods.woodHarvestSpeed, 1);
            if (descriptor.kind === "stone") total *= safeNumber(mods.stoneHarvestSpeed, 1);
            const specialist = descriptor.kind === "food" ? (actor.role === "food" || actor.role === "farmer" || actor.role === "hunter") :
                (descriptor.kind === "wood" ? (actor.role === "wood" || actor.role === "forester") :
                    (descriptor.kind === "stone" || NONRENEWABLE_KINDS.has(descriptor.kind) ? actor.role === "miner" : true));
            if (!specialist) total *= 2;
            total /= safeNumber(mods.roleWorkSpeed, 1);
            const current = Math.min(total, safeNumber(actor.harvestProgress, 0));
            return {current: current, total: total, percent: total > 0 ? Math.round(current / total * 100) : 0, unit: "ticks"};
        }
        if (actor.task === "build") {
            const site = Array.from(manager.constructionSites).find((candidate) => candidate.buildingId === actor.targetId);
            if (site) {
                const total = Math.max(1, safeNumber(site.workRequired, 1));
                const current = Math.min(total, safeNumber(site.workDone, 0));
                return {current: current, total: total, percent: Math.round(current / total * 100), unit: "work"};
            }
        }
        if (actor.task === "deliver") {
            const current = carriedAmount(actor);
            const total = carryCapacityFor(actor);
            return {current: current, total: total, percent: total > 0 ? Math.round(current / total * 100) : 0, unit: "resources"};
        }
        return null;
    }

    function currentPersonPhase(actor) {
        if (!actor) return "idle";
        if (actor.task === "idle" || actor.task === "wander" || actor.task === "planning") return actor.pathStage === "fall" ? "fall" : "planning";
        if (actor.pathStage === "tunnel") return "tunnel";
        if (actor.task === "combat" || actor.task === "siege") {
            const target = actor.task === "combat" ? manager.actorById.get(actor.targetId) : getBuildingById(actor.targetId);
            const weapon = manager.weapons.get(actor.weapon) || manager.weapons.get("fists");
            if (target && (actor.task === "combat" ? targetInAttackBox(actor, target, weapon) : Core.distance(actor.x, actor.y, target.x, target.y) <= Math.max(2, weapon.range))) return "attacking";
        }
        if (actor.task === "harvest" && Number.isFinite(actor.harvestX) && Core.distance(actor.x, actor.y, actor.harvestX, actor.harvestY) <= 1.5) return "working";
        if (actor.task === "extinguish" && Number.isFinite(actor.targetX) && Core.distance(actor.x, actor.y, actor.targetX, actor.targetY) <= 1.5) return "working";
        if (actor.task === "facility" && Number.isFinite(actor.targetX) && Core.distance(actor.x, actor.y, actor.targetX, actor.targetY) <= 2.5) return "working";
        return actor.pathStage === "climb" || actor.pathStage === "tunnel" ? actor.pathStage : "flat";
    }

    function activityMetricSummary(metrics) {
        if (!metrics || typeof metrics !== "object") return "";
        const parts = [];
        const resourceMap = metrics.resourcesDelivered || metrics.resourcesCollected || metrics.delivered;
        if (resourceMap) {
            const resources = Object.keys(resourceMap).filter((kind) => safeNumber(resourceMap[kind], 0) > 0).map((kind) => localizedResourceName(kind) + " " + Math.round(resourceMap[kind]));
            if (resources.length) parts.push(resources.join(", "));
        }
        if (metrics.buildWork) parts.push(civilizationText("people.work", "Work ", "工作量 ") + Math.round(metrics.buildWork));
        if (metrics.harvestedBlocks) parts.push(civilizationText("people.harvestedBlocks", "Blocks gathered ", "采集方块 ") + Math.round(metrics.harvestedBlocks));
        if (metrics.felledTrees) parts.push(civilizationText("people.felledTrees", "Trees felled ", "砍伐树木 ") + Math.round(metrics.felledTrees));
        if (metrics.resourcesDropped) {
            const dropped = Object.keys(metrics.resourcesDropped).filter((kind) => safeNumber(metrics.resourcesDropped[kind], 0) > 0).map((kind) => localizedResourceName(kind) + " " + Math.round(metrics.resourcesDropped[kind]));
            if (dropped.length) parts.push(civilizationText("people.resourcesDropped", "Dropped ", "掉落 ") + dropped.join(", "));
        }
        if (metrics.tunnelCells) parts.push(civilizationText("people.tunnelCells", "Tunnel cells ", "矿洞格 ") + Math.round(metrics.tunnelCells));
        if (metrics.firesExtinguished) parts.push(civilizationText("people.firesExtinguished", "Fires extinguished ", "扑灭火情 ") + Math.round(metrics.firesExtinguished));
        if (metrics.attacks) parts.push(civilizationText("people.attacks", "Attacks ", "攻击 ") + Math.round(metrics.attacks));
        if (metrics.hits) parts.push(civilizationText("people.hits", "Hits ", "命中 ") + Math.round(metrics.hits));
        if (metrics.misses) parts.push(civilizationText("people.misses", "Misses ", "未命中 ") + Math.round(metrics.misses));
        if (metrics.kills) parts.push(civilizationText("people.kills", "Kills ", "击杀 ") + Math.round(metrics.kills));
        if (metrics.damageDealt) parts.push(civilizationText("people.damageDealt", "Damage dealt ", "造成伤害 ") + Math.round(metrics.damageDealt));
        if (metrics.damageTaken) parts.push(civilizationText("people.damageTaken", "Damage taken ", "承受伤害 ") + Math.round(metrics.damageTaken));
        if (metrics.structureDamage) parts.push(civilizationText("people.structureDamage", "Structure damage ", "建筑伤害 ") + Math.round(metrics.structureDamage));
        if (metrics.structuresDestroyed) parts.push(civilizationText("people.structuresDestroyed", "Structures destroyed ", "摧毁建筑 ") + Math.round(metrics.structuresDestroyed));
        if (metrics.resourcesProduced) {
            const produced = Object.keys(metrics.resourcesProduced).filter((kind) => safeNumber(metrics.resourcesProduced[kind], 0) > 0).map((kind) => localizedResourceName(kind) + " " + Math.round(metrics.resourcesProduced[kind]));
            if (produced.length) parts.push(civilizationText("people.produced", "Produced ", "生产 ") + produced.join(", "));
        }
        if (metrics.recipesCompleted) {
            const recipes = Object.keys(metrics.recipesCompleted).filter((recipe) => safeNumber(metrics.recipesCompleted[recipe], 0) > 0).map((recipe) => localizedRecipeName(recipe) + " " + Math.round(metrics.recipesCompleted[recipe]));
            if (recipes.length) parts.push(civilizationText("people.recipesCompleted", "Recipes ", "完成配方 ") + recipes.join(", "));
        }
        if (metrics.equipmentIssued || metrics.weaponsCrafted) {
            const equipment = metrics.equipmentIssued || metrics.weaponsCrafted;
            const items = Object.keys(equipment).filter((item) => safeNumber(equipment[item], 0) > 0).map((item) => localizedPersonEquipment(item) + " " + Math.round(equipment[item]));
            if (items.length) parts.push(civilizationText("people.equipmentIssued", "Equipment ", "装备 ") + items.join(", "));
        }
        return parts.join(" · ");
    }

    function expandActivityRecord(record, profile, active) {
        if (!record) return null;
        const task = active && profile && profile.task ? profile.task : record.t;
        const phase = active && profile ? currentPersonPhase(profile) : null;
        const targetX = active && profile && Number.isFinite(profile.targetX) ? profile.targetX : record.x;
        const targetY = active && profile && Number.isFinite(profile.targetY) ? profile.targetY : record.y;
        const targetId = active && profile && Number.isFinite(profile.targetId) ? profile.targetId : record.i;
        const targetKind = active && profile && profile.targetKind ? profile.targetKind : record.e;
        const targetKey = active && profile && profile.targetKey ? profile.targetKey : record.g;
        const taskLabel = localizedPersonLabel(PERSON_TASK_LABELS, task, task, "未知活动");
        const targetLabel = activityTargetLabel(targetKind, targetId, targetKey, targetX, targetY);
        const status = active ? "active" : (record.o || "interrupted");
        const phaseLabel = active ? localizedPersonLabel(PERSON_PHASE_LABELS, phase, phase, "未知阶段") : localizedPersonLabel(PERSON_OUTCOME_LABELS, status, status, "未知结果");
        const metrics = cloneActivityValue(record.d) || {};
        const metricSummary = activityMetricSummary(metrics);
        const description = [phaseLabel, taskLabel + (targetLabel ? " · " + targetLabel : ""), metricSummary].filter(Boolean).join(" · ");
        const birthTick = Number.isFinite(profile && profile.birthTick) ? profile.birthTick : null;
        return {
            sequence: record.n,
            kind: record.k || "task",
            type: record.k === "life" ? record.t : "task",
            task: task,
            phase: phase,
            status: status,
            reason: active ? null : (record.z || null),
            role: record.r || profile && profile.role || null,
            factionId: record.f,
            settlementId: record.l,
            targetKey: targetKey,
            targetId: Number.isFinite(targetId) ? targetId : null,
            targetKind: targetKind || null,
            targetX: Number.isFinite(targetX) ? targetX : null,
            targetY: Number.isFinite(targetY) ? targetY : null,
            targetLabel: targetLabel,
            startedAt: record.a,
            endedAt: active ? null : (record.b || null),
            startedTick: record.at,
            endedTick: active ? null : record.bt,
            durationTicks: active ? Math.max(0, pixelTicks - safeNumber(record.at, pixelTicks)) : Math.max(0, safeNumber(record.bt, record.at) - safeNumber(record.at, 0)),
            ageAtStart: birthTick === null ? null : Math.max(0, (safeNumber(record.at, birthTick) - birthTick) / C.TICKS_PER_YEAR),
            ageAtEnd: birthTick === null ? null : Math.max(0, (safeNumber(active ? pixelTicks : record.bt, birthTick) - birthTick) / C.TICKS_PER_YEAR),
            metrics: metrics,
            progress: active ? activityProgressForActor(profile) : null,
            description: description
        };
    }

    function livePersonSnapshot(actor) {
        const activity = ensurePersonActivity(actor, true);
        const carry = cloneActivityValue(ensureActorCarry(actor)) || {};
        const miningAssignment = actor.role === "miner" ? manager.minerAssignments.get(actor.humanId) : null;
        const nav = actor.pathCache && actor.pathCache.version === NAVIGATION_SCHEMA_VERSION ? actor.pathCache : null;
        const trip = actor.workTrip;
        const activeStep = nav && nav.path && nav.path[nav.pathIndex];
        const remainingSteps = nav && Array.isArray(nav.path) ? Math.max(0, nav.path.length - safeNumber(nav.pathIndex, 0)) : 0;
        const anchor = trip && Array.isArray(trip.trail) && Number.isFinite(trip.surfaceAnchorIndex) ? trip.trail[trip.surfaceAnchorIndex] : null;
        return {
            humanId: actor.humanId,
            status: "living",
            element: actor.element,
            isChild: actor.element === "civ_child",
            factionId: actor.factionId,
            settlementId: actor.settlementId || null,
            color: actor.factionColor || factionColor(actor.factionId),
            x: actor.x,
            y: actor.y,
            ageYears: ageYears(actor),
            lifespanYears: actor.lifespanYears,
            birthTick: actor.birthTick,
            hp: Math.max(0, safeNumber(actor.hp, 0)),
            maxHp: Math.max(1, safeNumber(actor.maxHp, actor.element === "civ_child" ? C.CHILD_HP : C.ADULT_HP)),
            role: actor.role || (actor.element === "civ_child" ? "child" : "worker"),
            task: actor.task || "idle",
            weapon: actor.weapon || "fists",
            armor: canonicalArmorId(actor.armor),
            armorBonusHp: Math.max(0, safeNumber(actor.armorBonusHp, 0)),
            warRole: actor.warRole || null,
            carry: carry,
            carryTotal: carriedAmount(actor),
            carryCapacity: carryCapacityFor(actor),
            miningAssignment: miningAssignment ? cloneActivityValue(miningAssignment) : null,
            currentActivity: expandActivityRecord(activity.c, actor, true),
            historyRetained: activity.h.length,
            latestSequence: Math.max(activityRecordSequence(activity.c), activity.h.reduce((maximum, record) => Math.max(maximum, activityRecordSequence(record)), 0)),
            playerOrder: actor.playerOrder ? cloneActivityValue(actor.playerOrder) : null,
            commandSelected: commandPersonId === actor.humanId,
            speech: actor.speech ? cloneActivityValue(actor.speech) : null,
            pathStage: actor.pathStage || null,
            route: nav ? {
                mode: "astar",
                phase: nav.phase || null,
                goal: nav.goal ? cloneActivityValue(nav.goal) : null,
                pathLength: Array.isArray(nav.path) ? nav.path.length : 0,
                remainingSteps: remainingSteps,
                nextAction: activeStep ? {x: activeStep.x, y: activeStep.y, action: activeStep.action, climbSide: activeStep.climbSide || 0} : null,
                searchStatus: nav.searchStatus || null,
                searchMode: nav.searchMode || null,
                searchExpanded: safeNumber(nav.searchExpanded, 0),
                replanReason: nav.replanReason || null,
                surfaceAnchor: anchor ? {x: anchor[0], y: anchor[1]} : null,
                blockedReason: nav.blockedReason || null,
                followingRecordedReturn: !!(trip && trip.returning)
            } : null
        };
    }

    function findLivingActor(humanId) {
        const id = Number(humanId);
        const indexed = manager.actorById.get(id);
        if (indexed && !indexed.del && !indexed.dead) return indexed;
        return Array.from(manager.actors).find((actor) => actor && !actor.del && !actor.dead && actor.humanId === id) || null;
    }

    function getPersonSnapshot(humanId) {
        if (manager.lastIndexTick < 0 && typeof currentPixels !== "undefined") rebuildIndexes(true);
        const actor = findLivingActor(humanId);
        return actor ? livePersonSnapshot(actor) : null;
    }

    function personMatchesFilters(person, filters) {
        if (!person) return false;
        if (filters.factionId !== undefined && filters.factionId !== null && Number(filters.factionId) !== Number(person.factionId)) return false;
        if (filters.settlementId !== undefined && filters.settlementId !== null && Number(filters.settlementId) !== Number(person.settlementId)) return false;
        if (filters.role && String(filters.role) !== person.role) return false;
        if (filters.task && String(filters.task) !== person.task) return false;
        const query = String(filters.query || "").trim().toLowerCase();
        if (!query) return true;
        const searchable = ["h" + person.humanId, String(person.humanId), "f" + person.factionId, person.role, person.task, person.currentActivity && person.currentActivity.description].filter(Boolean).join(" ").toLowerCase();
        return searchable.indexOf(query) !== -1;
    }

    function getPeopleSnapshot(options) {
        if (manager.lastIndexTick < 0 && typeof currentPixels !== "undefined") rebuildIndexes(true);
        const filters = options || {};
        const living = Array.from(manager.actors).filter((actor) => actor && !actor.del && !actor.dead && Number.isFinite(actor.humanId)).map(livePersonSnapshot);
        let people = filters.status === "deceased" ? [] : living;
        people = people.filter((person) => personMatchesFilters(person, filters));
        people.sort((a, b) => a.humanId - b.humanId);
        let deaths = 0;
        manager.settlements.forEach((banner) => {
            if (!banner || banner.del) return;
            if (filters.factionId !== undefined && filters.factionId !== null && Number(filters.factionId) !== Number(banner.factionId)) return;
            if (filters.settlementId !== undefined && filters.settlementId !== null && Number(filters.settlementId) !== Number(banner.settlementId)) return;
            deaths += Math.max(0, safeNumber(banner.deathCount, 0));
        });
        return {
            updatedAt: eventTimestamp(),
            tick: pixelTicks,
            counts: {living: living.length, deceased: 0, deaths: deaths, filtered: people.length},
            people: people
        };
    }

    function getPersonHistory(humanId, options) {
        if (manager.lastIndexTick < 0 && typeof currentPixels !== "undefined") rebuildIndexes(true);
        const actor = findLivingActor(humanId);
        const data = actor ? ensurePersonActivity(actor, true) : null;
        if (!data || !Array.isArray(data.h)) return {entries: [], hasMore: false, nextCursor: null, totalRetained: 0};
        const opts = options || {};
        const limit = Math.max(1, Math.min(C.MAX_PERSON_ACTIVITY, Math.floor(safeNumber(Number(opts.limit), C.PEOPLE_HISTORY_PAGE_SIZE))));
        const before = Number(opts.beforeSequence);
        let records = data.h.slice().sort((a, b) => activityRecordSequence(b) - activityRecordSequence(a));
        if (Number.isFinite(before)) records = records.filter((record) => activityRecordSequence(record) < before);
        const page = records.slice(0, limit);
        const entries = page.map((record) => expandActivityRecord(record, actor, false)).filter(Boolean);
        const hasMore = records.length > page.length;
        return {entries: entries, hasMore: hasMore, nextCursor: hasMore && entries.length ? entries[entries.length - 1].sequence : null, totalRetained: data.h.length};
    }

    function getFactionSnapshot(factionId, settlementId) {
        if (manager.lastIndexTick < 0 && typeof currentPixels !== "undefined") rebuildIndexes(true);
        const faction = manager.factionById.get(Number(factionId));
        const banner = faction && faction.settlements[0];
        if (!faction || !banner) return null;
        const selectedSettlement = faction.settlements.find((settlement) => settlement.settlementId === Number(settlementId)) || banner;
        ensureStock(selectedSettlement);
        const research = ensureResearchState(banner);
        const era = eraDefinition(banner.eraId);
        const technologies = allTechnologies().slice().sort((a, b) => safeNumber(a.eraIndex, 0) - safeNumber(b.eraIndex, 0) || safeNumber(a.tier, 0) - safeNumber(b.tier, 0) || a.id.localeCompare(b.id)).map((tech) => {
            const availability = techAvailability(tech, faction, banner);
            const queueIndex = research.priorityQueue.indexOf(tech.id);
            return {
                id: tech.id,
                name: tech.name,
                eraId: techEraId(tech),
                eraIndex: safeNumber(tech.eraIndex, ERA_INDEX.get(techEraId(tech)) || 0),
                domain: tech.domain,
                cost: effectiveResearchCost(tech, faction, banner),
                progress: safeNumber(research.progress[tech.id], 0),
                unlocked: !!research.unlocked[tech.id],
                state: research.unlocked[tech.id] ? "researched" : (queueIndex >= 0 ? "focused" : "unresearched"),
                forced: !!research.forcedUnlocked[tech.id],
                queueIndex: queueIndex,
                active: research.activeTechId === tech.id,
                focused: queueIndex >= 0,
                future: safeNumber(tech.eraIndex, 0) > eraIndexFor(banner),
                prerequisites: (tech.prerequisites || []).slice(),
                prerequisitesMet: availability.prerequisitesMet,
                conditionsMet: availability.conditionsMet,
                conditionStates: availability.conditionStates || [],
                source: tech
            };
        }).filter(Boolean);
        return {
            id: faction.id,
            color: faction.color,
            population: faction.population,
            adults: faction.adultPopulation,
            housing: faction.housing,
            deathCount: faction.settlements.reduce((sum, settlement) => sum + Math.max(0, safeNumber(settlement.deathCount, 0)), 0),
            selectedSettlementId: selectedSettlement.settlementId,
            settlements: faction.settlements.map((settlement) => ({id: settlement.settlementId, x: settlement.x, y: settlement.y, population: safeNumber(settlement.population, 0), housing: safeNumber(settlement.housing, 4), deathCount: Math.max(0, safeNumber(settlement.deathCount, 0)), active: settlement.townCenterActive !== false, stage: settlement.stage || "camp"})),
            eraId: banner.eraId,
            era: era,
            completedInEra: technologies.filter((tech) => tech.eraId === banner.eraId && tech.unlocked).length,
            requiredToAdvance: safeNumber(era && era.requiredTechsToAdvance, C.RESEARCH_ERA_UNLOCK_COUNT),
            advancement: eraAdvancementState(faction, banner),
            knowledge: research.knowledge,
            knowledgeGain: research.lastKnowledgeGain,
            totalKnowledgeGenerated: research.totalKnowledgeGenerated,
            researchBlocker: research.blockedReason ? {
                techId: research.blockedTechId || null,
                reason: research.blockedReason,
                resource: research.blockedResource || null,
                current: safeNumber(research.blockedCurrent, 0),
                required: safeNumber(research.blockedRequired, 0),
                sinceTick: safeNumber(research.blockedSinceTick, pixelTicks)
            } : null,
            focusTechId: research.focusTechId || null,
            activeTechId: research.activeTechId || null,
            domainExperience: Object.assign({}, research.domainExperience),
            stock: {
                food: stockNumber(selectedSettlement.stock, "food"), wood: stockNumber(selectedSettlement.stock, "wood"), stone: stockNumber(selectedSettlement.stock, "stone"),
                copper: materialAmount(selectedSettlement.stock, "copper"),
                bronze: materialAmount(selectedSettlement.stock, "bronze"), raw_iron: materialAmount(selectedSettlement.stock, "raw_iron"), iron: materialAmount(selectedSettlement.stock, "iron"), steel: materialAmount(selectedSettlement.stock, "steel"),
                sapling: materialAmount(selectedSettlement.stock, "sapling")
            },
            woodSmeltingReserve: smeltingWoodReserveFor(banner),
            technologies: technologies,
            chronicle: ensureChronicle(selectedSettlement).slice(),
            wars: activeEnemyFactionIds(faction.id),
            recordedWars: getWarSnapshot(faction.id),
            peaceMode: getPeaceMode()
        };
    }

    function stockNumber(stock, key) {
        return Math.max(0, safeNumber(stock && stock[key], 0));
    }

    function setTreeSaplingTotal(stock, target) {
        if (!stock) return;
        if (!stock.treeSaplings || typeof stock.treeSaplings !== "object") stock.treeSaplings = {};
        const desired = Math.max(0, safeNumber(Number(target), 0));
        let difference = desired - treeSaplingTotal(stock);
        if (difference > 0) {
            stock.treeSaplings.sapling = safeNumber(stock.treeSaplings.sapling, 0) + difference;
        }
        else if (difference < 0) {
            let remove = -difference;
            ["sapling", "pinecone", "bamboo_plant"].forEach((seed) => {
                if (!remove) return;
                const used = Math.min(remove, Math.max(0, safeNumber(stock.treeSaplings[seed], 0)));
                stock.treeSaplings[seed] -= used;
                remove -= used;
            });
        }
        stock.sapling = treeSaplingTotal(stock);
    }

    function setResearchFocus(factionId, techId) {
        const faction = manager.factionById.get(Number(factionId));
        const banner = faction && faction.settlements[0];
        if (!banner) return false;
        const research = ensureResearchState(banner);
        if (techId === null || techId === undefined || techId === "") {
            delete research.focusTechId;
            research.priorityQueue = [];
            return true;
        }
        const tech = manager.technologies.get(String(techId));
        if (!tech || research.unlocked[tech.id]) return false;
        return setTechnologyState(factionId, tech.id, "focused");
    }

    function enqueueTechnologyWithPrerequisites(research, tech, currentEraIndex, seen) {
        if (!tech || research.unlocked[tech.id]) return;
        const visited = seen || new Set();
        if (visited.has(tech.id)) return;
        visited.add(tech.id);
        (tech.prerequisites || []).forEach((prerequisiteId) => {
            const prerequisite = manager.technologies.get(prerequisiteId);
            if (prerequisite && safeNumber(prerequisite.eraIndex, 0) <= currentEraIndex) enqueueTechnologyWithPrerequisites(research, prerequisite, currentEraIndex, visited);
        });
        if (research.priorityQueue.indexOf(tech.id) === -1) research.priorityQueue.push(tech.id);
    }

    function setTechnologyState(factionId, techId, state) {
        const faction = manager.factionById.get(Number(factionId));
        const banner = faction && faction.settlements[0];
        const tech = manager.technologies.get(String(techId));
        if (!banner || !tech) return false;
        const research = ensureResearchState(banner);
        if (research.unlocked[tech.id]) return state === "researched";
        if (state === "researched") {
            research.forcedUnlocked[tech.id] = true;
            const unlocked = unlockTechnology(faction, banner, tech);
            if (unlocked) maybeAdvanceEra(faction, banner);
            return unlocked;
        }
        if (state === "focused") {
            enqueueTechnologyWithPrerequisites(research, tech, safeNumber(tech.eraIndex, eraIndexFor(banner)));
            research.focusTechId = research.priorityQueue[0] || tech.id;
            research.focusDomain = tech.domain;
            return true;
        }
        if (state === "unresearched") {
            research.priorityQueue = research.priorityQueue.filter((id) => id !== tech.id);
            if (research.focusTechId === tech.id) research.focusTechId = research.priorityQueue[0];
            return true;
        }
        return false;
    }

    function moveResearchPriority(factionId, techId, newIndex) {
        const faction = manager.factionById.get(Number(factionId));
        const banner = faction && faction.settlements[0];
        if (!banner) return false;
        const research = ensureResearchState(banner);
        const oldIndex = research.priorityQueue.indexOf(String(techId));
        if (oldIndex < 0) return false;
        const id = research.priorityQueue.splice(oldIndex, 1)[0];
        const index = Math.max(0, Math.min(research.priorityQueue.length, Math.floor(safeNumber(Number(newIndex), 0))));
        research.priorityQueue.splice(index, 0, id);
        research.focusTechId = research.priorityQueue[0];
        return true;
    }

    function setSettlementResources(factionId, settlementId, patch) {
        const faction = manager.factionById.get(Number(factionId));
        const settlement = faction && faction.settlements.find((candidate) => candidate.settlementId === Number(settlementId));
        if (!settlement || !patch || typeof patch !== "object") return false;
        const stock = ensureStock(settlement);
        STOCK_KEYS.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
            const value = Math.max(0, safeNumber(Number(patch[key]), 0));
            if (key === "food") stock.food = value;
            else if (key === "wood") { stock.wood = value; stock.materials.tree_branch = 0; stock.materials.bamboo = 0; stock.materials.wood = value; }
            else if (key === "stone") { stock.stone = value; stock.materials.stone = value; }
            else if (key === "sapling") setTreeSaplingTotal(stock, value);
            else { stock[key] = value; stock.materials[key] = value; }
        });
        const seeds = patch.seeds && typeof patch.seeds === "object" ? patch.seeds : {};
        Object.keys(seeds).forEach((seed) => {
            const value = Math.max(0, safeNumber(Number(seeds[seed]), 0));
            if (TREE_SAPLING_ELEMENTS.has(seed)) stock.treeSaplings[seed] = value;
            else stock.seeds[seed] = value;
        });
        const treeSaplings = patch.treeSaplings && typeof patch.treeSaplings === "object" ? patch.treeSaplings : {};
        Object.keys(treeSaplings).forEach((seed) => {
            if (TREE_SAPLING_ELEMENTS.has(seed)) stock.treeSaplings[seed] = Math.max(0, safeNumber(Number(treeSaplings[seed]), 0));
        });
        ensureStock(settlement);
        reconcileFactionEquipment(faction);
        logSettlementEvent(settlement, "resource_edit", "玩家强制修改资源库存", {patch: JSON.parse(JSON.stringify(patch))});
        return true;
    }

    function getFactionChronicle(factionId, options) {
        const faction = manager.factionById.get(Number(factionId));
        if (!faction) return manager.archivedChronicles.filter((archive) => archive.factionId === Number(factionId));
        const opts = options || {};
        const settlements = opts.settlementId ? faction.settlements.filter((settlement) => settlement.settlementId === Number(opts.settlementId)) : faction.settlements;
        return settlements.reduce((events, settlement) => events.concat(ensureChronicle(settlement)), []).sort((a, b) => safeNumber(a && a.tick, 0) - safeNumber(b && b.tick, 0)).slice(-C.MAX_CHRONICLE_EVENTS);
    }

    function getWarSnapshot(factionId) {
        const id = Number(factionId);
        const enemies = [];
        manager.relationRecords.forEach((record) => {
            if (!recordedWarActive(record)) return;
            if (record.factionA === id) enemies.push(record.factionB);
            else if (record.factionB === id) enemies.push(record.factionA);
        });
        return enemies.filter((enemyId, index, values) => values.indexOf(enemyId) === index).sort((a, b) => a - b).map((enemyId) => {
            const record = loadPairRecord(pairInfo(id, enemyId), false);
            const faction = manager.factionById.get(id);
            return {enemyFactionId: enemyId, declaredTick: record.declaredTick, reason: record.reason, active: effectiveWarActive(record), suspended: recordedWarActive(record) && !effectiveWarActive(record), wave: safeNumber(firstBanner(id) && firstBanner(id).warState && firstBanner(id).warState.wave, 1), attackers: faction ? faction.adults.filter((actor) => actor.warRole === "attacker" && actor.warFrontId === enemyId).length : 0, defenders: faction ? faction.adults.filter((actor) => actor.warRole === "defender").length : 0};
        });
    }

function setMapOverlay(name, value) {
        if (name === "territory" || name === "resources") { manager.overlaySettings[name] = !!value; return true; }
        if (Object.prototype.hasOwnProperty.call(manager.overlaySettings.resourceFilters, name)) { manager.overlaySettings.resourceFilters[name] = !!value; return true; }
        return false;
    }

    function addKnowledge(factionId, amount, domain) {
        const faction = manager.factionById.get(Number(factionId));
        const banner = faction && faction.settlements[0];
        if (!banner) return false;
        ensureResearchState(banner).knowledge += Math.max(0, safeNumber(amount, 0));
        if (domain) addDomainExperience(banner, domain, Math.max(0, safeNumber(amount, 0)) * 0.05);
        return true;
    }

    function registerEra(era) {
        if (!era || !era.id || manager.eras.has(era.id)) return false;
        const normalized = Object.assign({index: ERA_ORDER.length, vision: 12, requiredTechsToAdvance: C.RESEARCH_ERA_UNLOCK_COUNT, techIds: []}, era);
        manager.eras.set(normalized.id, normalized);
        ERA_INDEX.set(normalized.id, normalized.index);
        ERA_ORDER[normalized.index] = normalized.id;
        return true;
    }

    function registerTechnology(tech) {
        if (!tech || !tech.id || manager.technologies.has(tech.id)) return false;
        const eraId = techEraId(tech);
        if (!manager.eras.has(eraId)) return false;
        const normalized = Object.assign({era: eraId, eraIndex: ERA_INDEX.get(eraId), domain: "society", cost: 1, prerequisites: [], conditions: [], effects: []}, tech);
        manager.technologies.set(normalized.id, normalized);
        TECH_BY_ID.set(normalized.id, normalized);
        if (!TECHS_BY_ERA.has(eraId)) TECHS_BY_ERA.set(eraId, []);
        TECHS_BY_ERA.get(eraId).push(normalized);
        const era = manager.eras.get(eraId);
        if (era.techIds && era.techIds.indexOf(normalized.id) === -1) era.techIds.push(normalized.id);
        return true;
    }

    function refreshCivilizationUi() {
        if (typeof document === "undefined") return;
        const parent = document.getElementById("civilizationParent");
        if (!parent || parent.style.display === "none") return;
        const factionIds = Array.from(manager.factionById.values()).filter((faction) => faction.settlements.length).map((faction) => faction.id).sort((a, b) => a - b);
        if (!factionIds.length) {
            document.getElementById("civilizationContent").textContent = civilizationText("ui.noFaction", "Place at least two civilized humans and let them found a camp.", "请先放置至少两名文明人类，并等待他们建立营地。");
            return;
        }
        if (!factionIds.includes(selectedCivilizationFactionId)) selectedCivilizationFactionId = factionIds[0];
        const selector = document.getElementById("civilizationFactionSelect");
        selector.textContent = "";
        factionIds.forEach((factionId) => {
            const option = document.createElement("option");
            option.value = factionId;
            option.textContent = civilizationText("ui.faction", "Faction", "阵营") + " " + factionId;
            option.selected = factionId === selectedCivilizationFactionId;
            selector.appendChild(option);
        });
        const initial = getFactionSnapshot(selectedCivilizationFactionId, selectedCivilizationSettlementId);
        if (!initial) return;
        if (!initial.settlements.some((settlement) => settlement.id === selectedCivilizationSettlementId)) selectedCivilizationSettlementId = initial.settlements[0].id;
        const snapshot = getFactionSnapshot(selectedCivilizationFactionId, selectedCivilizationSettlementId);
        const factionSwatch = document.getElementById("civilizationFactionSwatch");
        if (factionSwatch) factionSwatch.style.backgroundColor = snapshot.color;
        const settlementSelector = document.getElementById("civilizationSettlementSelect");
        if (settlementSelector) {
            settlementSelector.textContent = "";
            snapshot.settlements.forEach((settlement) => {
                const option = document.createElement("option");
                option.value = settlement.id;
                option.textContent = civilizationText("ui.settlement", "Settlement", "聚落") + " " + settlement.id + " · " + settlement.population + "/" + settlement.housing + (settlement.active ? "" : civilizationText("ui.paused", " (paused)", "（暂停）"));
                option.selected = settlement.id === selectedCivilizationSettlementId;
                settlementSelector.appendChild(option);
            });
        }
        const content = document.getElementById("civilizationContent");
        content.textContent = "";
        const eraTitle = document.createElement("div");
        eraTitle.className = "civ-era-title";
        const currentEraTechCount = snapshot.technologies.filter((entry) => entry.eraId === snapshot.eraId).length;
        eraTitle.textContent = localizedEraName(snapshot.era) + " · " + snapshot.completedInEra + "/" + currentEraTechCount + " · " + civilizationText("ui.advance", "Advance at", "晋级需要") + " " + snapshot.requiredToAdvance + "/" + currentEraTechCount;
        content.appendChild(eraTitle);
        const eraStrip = document.createElement("div");
        eraStrip.className = "civ-era-strip";
        (TechData.ERAS || []).forEach((era) => {
            const chip = document.createElement("span");
            chip.className = "civ-era-chip " + (era.index < safeNumber(ERA_INDEX.get(snapshot.eraId), 0) ? "done" : (era.id === snapshot.eraId ? "current" : "locked"));
            chip.textContent = localizedEraName(era);
            eraStrip.appendChild(chip);
        });
        content.appendChild(eraStrip);
        const tabs = document.createElement("div");
        tabs.className = "civ-tabs";
        [
            ["overview", civilizationText("tab.resources", "Resources", "资源")],
            ["technology", civilizationText("tab.technology", "Technology", "科技")],
            ["wars", civilizationText("tab.wars", "Wars", "战争")],
            ["logs", civilizationText("tab.logs", "Logs", "日志")],
            ["overlays", civilizationText("tab.map", "Map", "地图")]
        ].forEach((item) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = selectedCivilizationTab === item[0] ? "active" : "";
            button.textContent = item[1];
            button.addEventListener("click", function () { selectedCivilizationTab = item[0]; refreshCivilizationUi(); });
            tabs.appendChild(button);
        });
        content.appendChild(tabs);
        const summary = document.createElement("div");
        summary.className = "civ-summary";
        summary.textContent = civilizationText("ui.population", "Population", "人口") + " " + snapshot.population + "/" + snapshot.housing + " · " +
            civilizationText("ui.knowledge", "Knowledge", "知识储备") + " " + snapshot.knowledge.toFixed(1) + " (＋" + snapshot.knowledgeGain.toFixed(1) + ", Σ" + snapshot.totalKnowledgeGenerated.toFixed(1) + ") · " +
            civilizationText("ui.stock", "Stock F/W/S", "库存 食/木/石") + " " + Math.floor(snapshot.stock.food) + "/" + Math.floor(snapshot.stock.wood) + "/" + Math.floor(snapshot.stock.stone);
        content.appendChild(summary);
        if (!snapshot.advancement.finalEra) {
            const advancement = document.createElement("div");
            advancement.className = "civ-advancement" + (snapshot.advancement.canAdvance ? " ready" : " blocked");
            const costText = Object.keys(snapshot.advancement.cost).map((resource) =>
                localizedResourceName(resource) + " " + Math.floor(snapshot.advancement.current[resource] || 0) + "/" + snapshot.advancement.cost[resource]
            ).join(" · ");
            const armorText = snapshot.advancement.armorTarget === "none"
                ? civilizationText("advance.armorNone", "Armor not required", "防具无需")
                : civilizationText("advance.armor", "Armor", "防具") + " " + snapshot.advancement.armorReady + "/" + snapshot.advancement.soldiers;
            advancement.textContent = civilizationText("advance.conditions", "Era advancement", "时代升级") + " · " +
                civilizationText("advance.technology", "Technology", "科技") + " " + snapshot.advancement.completed + "/" + snapshot.advancement.required + " · " +
                civilizationText("advance.soldiers", "Soldiers", "士兵") + " " + snapshot.advancement.soldiers + "/" + snapshot.advancement.minimumSoldiers + " · " +
                civilizationText("advance.weapons", "Weapons", "武器") + " " + snapshot.advancement.weaponsReady + "/" + snapshot.advancement.soldiers + " · " +
                armorText + " · " + costText;
            content.appendChild(advancement);
        }
        if (snapshot.researchBlocker) {
            const blocker = document.createElement("div");
            blocker.className = "civ-summary";
            blocker.textContent = localizedResearchBlocker(snapshot.researchBlocker);
            content.appendChild(blocker);
        }
        if (selectedCivilizationTab === "overview") {
            const reserve = document.createElement("div");
            reserve.className = "civ-summary";
            reserve.textContent = civilizationText("resource.smeltingWoodReserve", "Smelting wood reserve", "冶炼木材保留量") + "：" + Math.floor(snapshot.woodSmeltingReserve);
            content.appendChild(reserve);
            const editor = document.createElement("div");
            editor.className = "civ-resource-editor";
            const inputs = {};
            STOCK_KEYS.forEach((key) => {
                const label = document.createElement("label");
                label.textContent = localizedResourceName(key) + " ";
                const input = document.createElement("input");
                input.type = "number";
                input.min = "0";
                input.value = Math.floor(safeNumber(snapshot.stock[key], 0));
                inputs[key] = input;
                label.appendChild(input);
                editor.appendChild(label);
            });
            const apply = document.createElement("button");
            apply.type = "button";
            apply.textContent = civilizationText("resource.forceWrite", "Force stock values", "强制写入库存");
            apply.addEventListener("click", function () {
                const patch = {};
                Object.keys(inputs).forEach((key) => {
                    patch[key] = Number(inputs[key].value);
                });
                setSettlementResources(snapshot.id, snapshot.selectedSettlementId, patch);
                refreshCivilizationUi();
            });
            editor.appendChild(apply);
            content.appendChild(editor);
        }
        else if (selectedCivilizationTab === "technology") {
            (TechData.ERAS || []).forEach((techEra) => {
                const heading = document.createElement("h3");
                const eraTechnologies = snapshot.technologies.filter((entry) => entry.eraId === techEra.id);
                heading.textContent = localizedEraName(techEra) + " · " + eraTechnologies.filter((entry) => entry.unlocked).length + "/" + eraTechnologies.length;
                content.appendChild(heading);
                const grid = document.createElement("div");
                grid.className = "civ-tech-grid";
                snapshot.technologies.filter((entry) => entry.eraId === techEra.id).forEach((entry) => {
                    const card = document.createElement("div");
                    card.className = "civ-tech-card" + (entry.unlocked ? " unlocked" : "") + (entry.active ? " active" : "") + (entry.focused ? " focused" : "") + ((!entry.prerequisitesMet || !entry.conditionsMet) ? " blocked" : "");
                    const title = document.createElement("strong");
                    title.textContent = localizedTechName(entry.source);
                    card.appendChild(title);
                    const progress = document.createElement("span");
                    progress.textContent = localizedDomain(entry.domain) + " · " + Math.min(entry.cost, entry.progress).toFixed(1) + "/" + entry.cost;
                    card.appendChild(progress);
                    const status = document.createElement("span");
                    status.textContent = entry.unlocked ? (entry.forced ? civilizationText("techStatus.forced", "Researched (forced)", "已研发（强制）") : civilizationText("techStatus.researched", "Researched", "已研发")) :
                        (entry.focused ? civilizationText("techStatus.focused", "Priority research #", "重点研发 #") + (entry.queueIndex + 1) + (entry.future ? civilizationText("techStatus.futureSuffix", " · future era", " · 未来时代") : "") :
                            (entry.future ? civilizationText("techStatus.future", "Future era · unresearched", "未来时代 · 未研发") : civilizationText("techStatus.unresearched", "Unresearched", "未研发")));
                    card.appendChild(status);
                    if (entry.prerequisites.length) {
                        const prerequisites = document.createElement("small");
                        prerequisites.textContent = civilizationText("tech.prerequisites", "Prerequisites: ", "前置：") + entry.prerequisites.map(localizedTechName).join(isChineseUi() ? "、" : ", ") + (entry.prerequisitesMet ? " ✓" : "");
                        card.appendChild(prerequisites);
                    }
                    if (entry.conditionStates.length) {
                        const conditions = document.createElement("small");
                        conditions.textContent = entry.conditionStates.map(conditionDescription).join(" · ");
                        card.appendChild(conditions);
                    }
                    const yieldEffects = technologyYieldEffectDescriptions(entry.source);
                    if (yieldEffects.length) {
                        const effects = document.createElement("small");
                        effects.className = "civ-tech-effects";
                        effects.textContent = civilizationText("tech.effects", "Effects: ", "效果：") + yieldEffects.join(isChineseUi() ? "、" : ", ");
                        card.appendChild(effects);
                    }
                    if (!entry.unlocked) {
                        const controls = document.createElement("span");
                        const focus = document.createElement("button");
                        focus.type = "button";
                        focus.textContent = entry.focused ? civilizationText("tech.unfocus", "Remove priority", "取消重点") : civilizationText("tech.focus", "Mark priority", "标记重点");
                        focus.addEventListener("click", function () { setTechnologyState(snapshot.id, entry.id, entry.focused ? "unresearched" : "focused"); refreshCivilizationUi(); });
                        controls.appendChild(focus);
                        const force = document.createElement("button");
                        force.type = "button";
                        force.textContent = civilizationText("tech.force", "Force complete", "强制完成");
                        force.addEventListener("click", function () { if (typeof confirm !== "function" || confirm(civilizationText("tech.forceConfirm", "Forced completion cannot be undone. Continue?", "强制完成后不可撤销，确定吗？"))) { setTechnologyState(snapshot.id, entry.id, "researched"); refreshCivilizationUi(); } });
                        controls.appendChild(force);
                        if (entry.focused && entry.queueIndex > 0) {
                            const up = document.createElement("button"); up.type = "button"; up.textContent = "↑"; up.addEventListener("click", function () { moveResearchPriority(snapshot.id, entry.id, entry.queueIndex - 1); refreshCivilizationUi(); }); controls.appendChild(up);
                        }
                        card.appendChild(controls);
                    }
                    grid.appendChild(card);
                });
                content.appendChild(grid);
            });
        }
        else if (selectedCivilizationTab === "wars") {
            const modeLabel = document.createElement("label");
            modeLabel.textContent = civilizationText("peace.label", "Peace mode ", "和平模式 ");
            const modeSelect = document.createElement("select");
            [
                ["normal", civilizationText("peace.normal", "Normal", "正常")],
                ["no-new-wars", civilizationText("peace.noNewWars", "No new wars", "仅禁止新战争")],
                ["full-peace", civilizationText("peace.full", "Full peace", "完全和平")]
            ].forEach((item) => {
                const option = document.createElement("option");
                option.value = item[0];
                option.textContent = item[1];
                option.selected = getPeaceMode() === item[0];
                modeSelect.appendChild(option);
            });
            modeSelect.addEventListener("change", function () { setPeaceMode(modeSelect.value); refreshCivilizationUi(); });
            modeLabel.appendChild(modeSelect);
            content.appendChild(modeLabel);
            const explanation = document.createElement("p");
            explanation.textContent = getPeaceMode() === "normal" ? civilizationText("peace.normalHelp", "War declarations and combat are enabled.", "允许宣战和正常战斗。") :
                (getPeaceMode() === "no-new-wars" ? civilizationText("peace.noNewWarsHelp", "New wars are disabled; existing wars continue.", "禁止新战争，已有战争继续。") :
                    civilizationText("peace.fullHelp", "Wars, attacks, retaliation and annexation are paused until this mode is disabled.", "已有战争、攻击、反击和吞并已暂停，关闭后继续。"));
            content.appendChild(explanation);
            const wars = document.createElement("div");
            const active = getWarSnapshot(snapshot.id);
            wars.textContent = active.length ? active.map((war) => civilizationText("war.versus", "Against faction ", "对阵阵营 ") + war.enemyFactionId +
                (war.suspended ? civilizationText("war.suspended", " · suspended", " · 已暂停") :
                    civilizationText("war.wavePrefix", " · wave ", " · 第") + war.wave + civilizationText("war.waveForces", " · attackers ", "波 · 进攻 ") + war.attackers + civilizationText("war.defenders", "/defenders ", "/防守 ") + war.defenders) +
                " · " + localizedWarReason(war.reason)).join("\n") : civilizationText("war.none", "There are no current wars.", "当前没有战争。");
            content.appendChild(wars);
            factionIds.filter((id) => id !== snapshot.id && snapshot.wars.indexOf(id) === -1).forEach((enemyId) => {
                const button = document.createElement("button");
                button.type = "button";
                button.disabled = getPeaceMode() !== "normal";
                button.textContent = civilizationText("war.forcePrefix", "Declare war on faction ", "强制向阵营 ") + enemyId + civilizationText("war.forceSuffix", "", " 宣战");
                button.addEventListener("click", function () { if (typeof confirm !== "function" || confirm(civilizationText("war.confirm", "War lasts until one faction is annexed. Declare war?", "战争将持续到一方被吞并，确定宣战吗？"))) { declareWar(snapshot.id, enemyId, "manual"); refreshCivilizationUi(); } });
                content.appendChild(button);
            });
        }
        else if (selectedCivilizationTab === "logs") {
            const log = document.createElement("div");
            log.className = "civ-log";
            snapshot.chronicle.slice().reverse().forEach((event) => {
                const row = document.createElement("div");
                row.textContent = localizedChronicleTimestamp(event) + " · " + localizedChronicleMessage(event);
                log.appendChild(row);
            });
            content.appendChild(log);
        }
        else if (selectedCivilizationTab === "overlays") {
            [
                ["territory", civilizationText("overlay.territory", "Show territory columns", "显示领地列")],
                ["resources", civilizationText("overlay.resources", "Show resource locations", "显示资源点")],
                ["food", civilizationText("overlay.food", "Food", "食物")],
                ["tree", civilizationText("overlay.tree", "Trees", "树木")],
                ["stone", civilizationText("overlay.stone", "Stone", "石头")],
                ["metals", civilizationText("overlay.metals", "Metals", "金属")],
                ["drops", civilizationText("overlay.drops", "Drops", "掉落物")]
            ].forEach((item) => {
                const label = document.createElement("label");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.checked = item[0] === "territory" || item[0] === "resources" ? manager.overlaySettings[item[0]] : manager.overlaySettings.resourceFilters[item[0]];
                input.addEventListener("change", function () { setMapOverlay(item[0], input.checked); });
                label.appendChild(input);
                label.appendChild(document.createTextNode(item[1]));
                content.appendChild(label);
            });
        }
    }

    function makeFloatingPanelDraggable(panel, handle) {
        if (root && typeof root.registerFloatingWindow === "function") {
            root.registerFloatingWindow(panel, handle);
            return;
        }
        if (!panel || !handle || panel.dataset.civDraggable === "true") return;
        panel.dataset.civDraggable = "true";
        handle.classList.add("civ-drag-handle");
        let drag = null;
        handle.addEventListener("pointerdown", function (event) {
            if (root.innerWidth <= 700 || event.button !== 0 || event.target.closest("button,input,select,a")) return;
            const rect = panel.getBoundingClientRect();
            drag = {pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height};
            panel.style.position = "fixed";
            panel.style.transform = "none";
            panel.style.left = rect.left + "px";
            panel.style.top = rect.top + "px";
            panel.style.right = "auto";
            panel.style.bottom = "auto";
            panel.style.width = rect.width + "px";
            panel.style.height = rect.height + "px";
            handle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        handle.addEventListener("pointermove", function (event) {
            if (!drag || drag.pointerId !== event.pointerId) return;
            const left = Math.max(0, Math.min(root.innerWidth - drag.width, event.clientX - drag.offsetX));
            const top = Math.max(0, Math.min(root.innerHeight - drag.height, event.clientY - drag.offsetY));
            panel.style.left = left + "px";
            panel.style.top = top + "px";
        });
        const finish = function (event) {
            if (!drag || event.pointerId !== drag.pointerId) return;
            drag = null;
        };
        handle.addEventListener("pointerup", finish);
        handle.addEventListener("pointercancel", finish);
    }

    const CIVILIZATION_TUTORIAL_STEPS = [
        {title: ["Choose a faction color", "选择阵营颜色"], body: ["Select Civilized Human, then choose a color. Every human placed with this color belongs to the same faction.", "选择文明人，再选择阵营颜色。以后用同一颜色放置的人会加入同一阵营。"], targets: ["elementButton-civilized_human", "factionColorPalette"]},
        {title: ["Found a group", "建立人群"], body: ["Place two civilized humans of the same color within 12 cells of each other.", "在彼此 12 格以内放置两个同色文明人。"], targets: ["game"]},
        {title: ["Wait for the town center", "等待城镇中心"], body: ["Keep the pair together for 60 ticks. You can use the speed button while they establish a settlement.", "让两人共同活动 60 tick，等待聚落形成；可以使用加速按钮。"], targets: ["speedButton"]},
        {title: ["Inspect the civilization", "查看文明发展"], body: ["Open Civilization to inspect resources, technologies, logs and the faction color.", "打开文明发展面板，查看资源、科技、日志和阵营色块。"], targets: ["civilizationButton"]},
        {title: ["Equip the soldiers", "配给士兵武器"], body: ["Collect the required materials and unlock military technologies. Weapons and armor are issued before any era upgrade.", "采集材料并解锁军事科技。文明会先完成武器和防具配给，再考虑升级时代。"], targets: ["civilizationButton"]},
        {title: ["Advance the era", "升级时代"], body: ["Research more than 70% of the current tree, complete the army equipment target and accumulate every listed upgrade resource.", "研发当前时代超过 70% 的科技，完成军备目标并储备面板列出的全部升本资源。"], targets: ["civilizationButton"]},
        {title: ["Grow a sustainable forest", "培育可持续森林"], body: ["Let a forester plant saplings. New trees become harvestable after 20 seconds at 1x speed and at least one woody cell has grown.", "让林务员种下树苗。新树在 1 倍速累计生长 20 秒且至少长出一格木质部分后即可砍伐。"], targets: ["game"]}
    ];
    let tutorialRefreshTimer = null;

    function tutorialStepComplete(stepIndex) {
        const factions = Array.from(manager.factionById.values());
        if (stepIndex === 0) return typeof currentElement === "string" && currentElement === "civilized_human" && typeof currentColorMap !== "undefined" && !!currentColorMap.civilized_human;
        if (stepIndex === 1) return factions.some((faction) => faction.adults.length >= 2);
        if (stepIndex === 2) return manager.settlements.size > 0;
        if (stepIndex === 3) return typeof showingMenu !== "undefined" && showingMenu === "civilization";
        if (stepIndex === 4) return factions.some((faction) => faction.adults.some((actor) => actorIsSoldier(actor) && canonicalWeaponId(actor.weapon) !== "fists"));
        if (stepIndex === 5) return factions.some((faction) => eraIndexFor(faction) > 0);
        if (stepIndex === 6) {
            const planted = factions.some((faction) => faction.settlements.some((banner) => safeNumber(ensureResearchState(banner).milestones.treesPlanted, 0) > 0));
            const mature = Array.from(manager.treeById.values()).some(treeIsHarvestable);
            return planted && mature;
        }
        return false;
    }

    function saveTutorialSettings() {
        if (typeof localStorage !== "undefined" && typeof settings !== "undefined") localStorage.setItem("settings", JSON.stringify(settings));
    }

    function clearTutorialHighlights() {
        if (typeof document === "undefined") return;
        document.querySelectorAll(".civ-tutorial-highlight").forEach((element) => element.classList.remove("civ-tutorial-highlight"));
    }

    function refreshTutorialUi() {
        if (typeof document === "undefined") return;
        const panel = document.getElementById("civilizationTutorial");
        if (!panel || panel.style.display === "none") return;
        let stepIndex = Math.max(0, Math.min(CIVILIZATION_TUTORIAL_STEPS.length - 1, Math.floor(safeNumber(settings.humanSocietyTutorialStep, 0))));
        while (stepIndex < CIVILIZATION_TUTORIAL_STEPS.length && tutorialStepComplete(stepIndex)) stepIndex++;
        if (stepIndex >= CIVILIZATION_TUTORIAL_STEPS.length) {
            settings.humanSocietyTutorialComplete = true;
            settings.humanSocietyTutorialStep = CIVILIZATION_TUTORIAL_STEPS.length;
            saveTutorialSettings();
            if (typeof closeMenu === "function") closeMenu("tutorial");
            else panel.style.display = "none";
            clearTutorialHighlights();
            return;
        }
        settings.humanSocietyTutorialStep = stepIndex;
        const step = CIVILIZATION_TUTORIAL_STEPS[stepIndex];
        document.getElementById("civilizationTutorialProgress").textContent = (stepIndex + 1) + "/" + CIVILIZATION_TUTORIAL_STEPS.length;
        document.getElementById("civilizationTutorialTitle").textContent = civilizationText("tutorial.title." + stepIndex, step.title[0], step.title[1]);
        document.getElementById("civilizationTutorialBody").textContent = civilizationText("tutorial.body." + stepIndex, step.body[0], step.body[1]);
        clearTutorialHighlights();
        step.targets.forEach((id) => { const target = document.getElementById(id); if (target) target.classList.add("civ-tutorial-highlight"); });
        saveTutorialSettings();
    }

    function showCivilizationTutorial(force) {
        if (typeof document === "undefined") return false;
        installCivilizationTutorial();
        if (!force && settings.humanSocietyTutorialComplete) return false;
        if (!force && typeof settings !== "undefined" && settings.elementPaletteMode === "laboratory") return false;
        const panel = document.getElementById("civilizationTutorial");
        if (typeof openTopLevelWindow === "function") openTopLevelWindow("tutorial", panel, "flex");
        else panel.style.display = "flex";
        refreshTutorialUi();
        if (tutorialRefreshTimer === null && typeof root.setInterval === "function") tutorialRefreshTimer = root.setInterval(refreshTutorialUi, 500);
        return true;
    }

    function closeCivilizationTutorial() {
        const panel = typeof document !== "undefined" && document.getElementById("civilizationTutorial");
        if (panel) {
            if (typeof closeMenu === "function") closeMenu("tutorial");
            else panel.style.display = "none";
        }
        clearTutorialHighlights();
    }

    function skipCivilizationTutorial() {
        settings.humanSocietyTutorialComplete = true;
        settings.humanSocietyTutorialStep = CIVILIZATION_TUTORIAL_STEPS.length;
        saveTutorialSettings();
        closeCivilizationTutorial();
    }

    function restartCivilizationTutorial() {
        settings.humanSocietyTutorialComplete = false;
        settings.humanSocietyTutorialStep = 0;
        saveTutorialSettings();
        return showCivilizationTutorial(true);
    }

    function installCivilizationTutorial() {
        if (typeof document === "undefined" || document.getElementById("civilizationTutorial")) return;
        const style = document.createElement("style");
        style.textContent = ".civ-drag-handle{cursor:move;touch-action:none}.civ-tutorial-highlight{outline:3px solid #ffd45c!important;outline-offset:2px!important}#civilizationTutorial{position:fixed;z-index:100002;left:16px;bottom:16px;width:min(360px,calc(100vw - 32px));display:none;flex-direction:column;border:2px solid #777;background:#161616;color:#eee;box-shadow:0 8px 28px #000c;font:13px/1.45 Arial,sans-serif}#civilizationTutorialHeader{display:flex;align-items:center;gap:8px;padding:8px;background:#292929}#civilizationTutorialHeader strong{min-width:0;flex:1;font-size:14px}#civilizationTutorialHeader button{width:28px;height:28px;border:1px solid #777;border-radius:3px}#civilizationTutorialBody{min-height:54px;padding:10px;overflow-wrap:anywhere}#civilizationTutorialActions{display:flex;justify-content:space-between;gap:8px;padding:8px;border-top:1px solid #444}#civilizationTutorialActions button{padding:5px 9px;border:1px solid #777;border-radius:3px;background:#252525}@media(max-width:700px){#civilizationTutorial{left:8px;right:8px;bottom:8px;width:auto}}";
        document.head.appendChild(style);
        const panel = document.createElement("aside");
        panel.id = "civilizationTutorial";
        const header = document.createElement("header");
        header.id = "civilizationTutorialHeader";
        const progress = document.createElement("span"); progress.id = "civilizationTutorialProgress";
        const title = document.createElement("strong"); title.id = "civilizationTutorialTitle";
        const close = document.createElement("button"); close.type = "button"; close.textContent = "x"; close.title = civilizationText("tutorial.close", "Close", "关闭"); close.addEventListener("click", closeCivilizationTutorial);
        header.appendChild(progress); header.appendChild(title); header.appendChild(close); panel.appendChild(header);
        const body = document.createElement("div"); body.id = "civilizationTutorialBody"; panel.appendChild(body);
        const actions = document.createElement("div"); actions.id = "civilizationTutorialActions";
        const back = document.createElement("button"); back.type = "button"; back.textContent = civilizationText("tutorial.back", "Back", "上一步"); back.addEventListener("click", function () { settings.humanSocietyTutorialStep = Math.max(0, safeNumber(settings.humanSocietyTutorialStep, 0) - 1); refreshTutorialUi(); });
        const skip = document.createElement("button"); skip.type = "button"; skip.textContent = civilizationText("tutorial.skip", "Skip tutorial", "跳过教程"); skip.addEventListener("click", skipCivilizationTutorial);
        actions.appendChild(back); actions.appendChild(skip); panel.appendChild(actions);
        document.body.appendChild(panel);
        makeFloatingPanelDraggable(panel, header);
        const controls = document.getElementById("toolControls");
        if (controls) {
            const button = document.createElement("button"); button.id = "civilizationTutorialButton"; button.className = "controlButton"; button.textContent = civilizationText("tutorial.button", "Guide", "教程"); button.title = civilizationText("tutorial.buttonTitle", "Open the civilization guide", "打开文明发展教程"); button.addEventListener("click", function () { showCivilizationTutorial(true); });
            controls.insertBefore(button, document.getElementById("civilizationButton") || document.getElementById("settingsButton") || null);
        }
    }

    function openCivilizationPanel(factionId) {
        if (typeof document === "undefined") return false;
        if (Number.isFinite(Number(factionId))) selectedCivilizationFactionId = Number(factionId);
        const parent = document.getElementById("civilizationParent");
        if (!parent) return false;
        if (typeof openTopLevelWindow === "function") openTopLevelWindow("civilization", parent);
        else parent.style.display = "block";
        refreshCivilizationUi();
        return true;
    }

    function installCivilizationUi() {
        if (typeof document === "undefined" || document.getElementById("civilizationParent")) return;
        const style = document.createElement("style");
        style.id = "civilizationUiStyle";
        style.textContent = [
            "#civilizationParent{box-sizing:border-box;width:min(94vw,860px);max-width:860px;height:min(82vh,720px);max-height:720px}",
            ".civ-menu{box-sizing:border-box;width:100%!important;max-width:none!important;overflow-y:auto}",
            "#civilizationContent,.civ-tech-card,.civ-resource-editor label{min-width:0}",
            ".civ-toolbar,.civ-tabs{display:flex;flex-wrap:wrap;gap:.55em;align-items:center;justify-content:center;margin:.7em 0}",
            ".civ-tabs button.active{outline:2px solid #63a9de}",
            ".civ-era-title{font-size:1.2em;font-weight:700;margin:.5em}",
            ".civ-era-strip{display:flex;flex-wrap:wrap;gap:.35em;justify-content:center;margin:.4em}",
            ".civ-era-chip{padding:.22em .5em;border:1px solid #777;border-radius:.35em;opacity:.45}",
            ".civ-era-chip.done{opacity:.8;border-color:#78a878}",
            ".civ-era-chip.current{opacity:1;border-color:#e5c15c;color:#ffe08a}",
            ".civ-summary{margin:.5em;text-align:center;overflow-wrap:anywhere}",
            ".civ-advancement{margin:.55em;padding:.5em;border:1px solid #8c6b3d;background:#2b2419;text-align:center;overflow-wrap:anywhere}",
            ".civ-advancement.ready{border-color:#65a66e;background:#1d3022}",
            ".civ-faction-swatch{display:inline-block;width:16px;height:16px;flex:0 0 16px;border:1px solid #fff;border-radius:2px}",
            ".civ-materials{font-size:.82em;opacity:.85}",
            ".civ-tech-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55em;padding:.5em}",
            ".civ-tech-card{display:flex;min-width:0;flex-direction:column;gap:.3em;text-align:left;padding:.65em;border:1px solid #777;border-radius:.45em;background:#252525;color:#eee;overflow-wrap:anywhere}",
            ".civ-tech-card>span{display:flex;flex-wrap:wrap;gap:.3em}",
            ".civ-tech-card.unlocked{border-color:#5ca66b;background:#213526}",
            ".civ-tech-card.active{border-color:#e8bb4a;box-shadow:0 0 8px #e8bb4a88}",
            ".civ-tech-card.focused{outline:2px solid #63a9de}",
            ".civ-tech-card.blocked{opacity:.7}",
            ".civ-tech-domain,.civ-tech-status,.civ-tech-card small{font-size:.8em;opacity:.9}",
            ".civ-resource-editor{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5em;padding:.7em}",
            ".civ-resource-editor label{display:grid;grid-template-columns:minmax(0,1fr) minmax(5em,7em);align-items:center;gap:.4em;overflow-wrap:anywhere}",
            ".civ-resource-editor input{box-sizing:border-box;width:100%;min-width:0;margin:0}",
            ".civ-resource-editor>button{grid-column:1/-1;justify-self:start}",
            ".civ-log{max-height:48vh;overflow:auto;text-align:left;white-space:normal}",
            ".civ-log div{padding:.3em;border-bottom:1px solid #555}",
            "@media(max-width:760px){.civ-tech-grid{grid-template-columns:1fr}.civ-resource-editor{grid-template-columns:repeat(2,minmax(0,1fr))}}",
            "@media(max-width:460px){#civilizationParent{width:96vw;height:88vh;top:2%}.civ-resource-editor{grid-template-columns:1fr}}"
        ].join("");
        document.head.appendChild(style);
        const parent = document.createElement("div");
        parent.id = "civilizationParent";
        parent.className = "menuParent";
        parent.style.display = "none";
        const menu = document.createElement("div");
        menu.className = "menuScreen civ-menu";
        const close = document.createElement("button");
        close.className = "XButton";
        close.textContent = "-";
        close.addEventListener("click", function () { if (typeof closeMenu === "function") closeMenu("civilization"); else parent.style.display = "none"; });
        menu.appendChild(close);
        const title = document.createElement("span");
        title.className = "menuTitle";
        title.textContent = civilizationText("ui.title", "Civilization", "文明发展");
        menu.appendChild(title);
        makeFloatingPanelDraggable(parent, title);
        const toolbar = document.createElement("div");
        toolbar.className = "civ-toolbar";
        const selectLabel = document.createElement("span");
        selectLabel.textContent = civilizationText("ui.observe", "Observe", "查看");
        toolbar.appendChild(selectLabel);
        const selector = document.createElement("select");
        selector.id = "civilizationFactionSelect";
        selector.addEventListener("change", function () { selectedCivilizationFactionId = Number(selector.value); selectedCivilizationSettlementId = null; refreshCivilizationUi(); });
        const factionSwatch = document.createElement("span");
        factionSwatch.id = "civilizationFactionSwatch";
        factionSwatch.className = "civ-faction-swatch";
        factionSwatch.setAttribute("aria-label", civilizationText("ui.factionColor", "Faction color", "阵营颜色"));
        toolbar.appendChild(factionSwatch);
        toolbar.appendChild(selector);
        const settlementSelector = document.createElement("select");
        settlementSelector.id = "civilizationSettlementSelect";
        settlementSelector.addEventListener("change", function () { selectedCivilizationSettlementId = Number(settlementSelector.value); refreshCivilizationUi(); });
        toolbar.appendChild(settlementSelector);
        menu.appendChild(toolbar);
        const content = document.createElement("div");
        content.id = "civilizationContent";
        content.className = "menuText";
        menu.appendChild(content);
        parent.appendChild(menu);
        document.body.appendChild(parent);
        const controls = document.getElementById("toolControls");
        if (controls) {
            const button = document.createElement("button");
            button.id = "civilizationButton";
            button.className = "controlButton";
            button.textContent = civilizationText("ui.button", "Civilization", "文明");
            button.title = civilizationText("ui.buttonTitle", "Open civilization and technology overview", "打开文明与科技总览");
            button.addEventListener("click", function () {
                if (typeof isTopLevelWindowOpen === "function" && isTopLevelWindowOpen("civilization") && typeof closeMenu === "function") closeMenu("civilization");
                else openCivilizationPanel(selectedCivilizationFactionId);
            });
            const settingsButton = document.getElementById("settingsButton");
            controls.insertBefore(button, settingsButton || null);
        }
    }

    function localizedPersonRole(role) {
        const value = role || "worker";
        return localizedPersonLabel(PERSON_ROLE_LABELS, value, String(value).replace(/_/g, " "), "未知职业");
    }

    function localizedPersonTask(task) {
        const value = task || "idle";
        return localizedPersonLabel(PERSON_TASK_LABELS, value, String(value).replace(/_/g, " "), "未知活动");
    }

    function localizedPersonWeapon(weapon) {
        const value = weapon || "fists";
        return localizedPersonLabel(PERSON_WEAPON_LABELS, value, String(value).replace(/_/g, " "), "未知武器");
    }

    function localizedPersonArmor(armor) {
        const raw = String(armor || "none");
        const value = /_armor$/.test(raw) ? raw.slice(0, -6) : canonicalArmorId(raw);
        const entry = Object.prototype.hasOwnProperty.call(PERSON_ARMOR_LABELS, value) ? PERSON_ARMOR_LABELS[value] : null;
        if (!entry) return isChineseUi() ? "未知护甲" : raw.replace(/_/g, " ");
        return civilizationText("armor." + value, entry[0], entry[1]);
    }

    function localizedPersonEquipment(item) {
        const value = String(item || "");
        const armorId = /_armor$/.test(value) ? value.slice(0, -6) : canonicalArmorId(value);
        return Object.prototype.hasOwnProperty.call(PERSON_ARMOR_LABELS, armorId) && armorId !== "none" ? localizedPersonArmor(armorId) : localizedPersonWeapon(value);
    }

    function localizedDeathCause(cause) {
        if (!cause) return "";
        return localizedPersonLabel(PERSON_DEATH_CAUSE_LABELS, cause, String(cause).replace(/_/g, " "), "未知死因");
    }

    function peopleFilterValue(id) {
        const element = typeof document !== "undefined" ? document.getElementById(id) : null;
        return element ? element.value : "";
    }

    function readPeopleFilters() {
        const factionValue = peopleFilterValue("peopleFactionFilter");
        const settlementValue = peopleFilterValue("peopleSettlementFilter");
        return {
            query: peopleFilterValue("peopleSearchInput"),
            factionId: factionValue === "" ? null : Number(factionValue),
            settlementId: settlementValue === "" ? null : Number(settlementValue),
            role: peopleFilterValue("peopleRoleFilter") || null,
            task: peopleFilterValue("peopleTaskFilter") || null
        };
    }

    function setPeopleSelectOptions(id, options, allLabel) {
        const select = document.getElementById(id);
        if (!select) return;
        const signature = options.map((option) => option.value + ":" + option.label).join("|");
        if (select.dataset.signature === signature) return;
        const previous = select.value;
        select.textContent = "";
        const all = document.createElement("option");
        all.value = "";
        all.textContent = allLabel;
        select.appendChild(all);
        options.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.value;
            option.textContent = item.label;
            select.appendChild(option);
        });
        select.dataset.signature = signature;
        select.value = options.some((option) => String(option.value) === previous) ? previous : "";
    }

    function refreshPeopleFilterOptions(people) {
        const factionIds = Array.from(new Set(people.map((person) => person.factionId).filter(Number.isFinite))).sort((a, b) => a - b);
        setPeopleSelectOptions("peopleFactionFilter", factionIds.map((id) => ({value: id, label: civilizationText("people.faction", "Faction ", "阵营 ") + id})), civilizationText("people.allFactions", "All factions", "全部阵营"));

        const factionValue = peopleFilterValue("peopleFactionFilter");
        const settlementIds = Array.from(new Set(people.filter((person) => factionValue === "" || Number(factionValue) === person.factionId).map((person) => person.settlementId).filter(Number.isFinite))).sort((a, b) => a - b);
        setPeopleSelectOptions("peopleSettlementFilter", settlementIds.map((id) => ({value: id, label: civilizationText("people.settlement", "Settlement ", "聚落 ") + id})), civilizationText("people.allSettlements", "All settlements", "全部聚落"));

        const roles = Array.from(new Set(people.map((person) => person.role).filter(Boolean))).sort();
        setPeopleSelectOptions("peopleRoleFilter", roles.map((role) => ({value: role, label: localizedPersonRole(role)})), civilizationText("people.allRoles", "All roles", "全部职业"));
        const tasks = Array.from(new Set(people.map((person) => person.task).filter(Boolean))).sort();
        setPeopleSelectOptions("peopleTaskFilter", tasks.map((task) => ({value: task, label: localizedPersonTask(task)})), civilizationText("people.allTasks", "All activities", "全部活动"));
    }

    function personAgeLabel(person) {
        const age = safeNumber(person && person.ageYears, 0).toFixed(1);
        return isChineseUi() ? age + " 岁" : age + " years";
    }

    function personCarryLabel(person) {
        const carry = person && person.carry || {};
        const parts = Object.keys(carry).filter((kind) => safeNumber(carry[kind], 0) > 0).map((kind) => localizedResourceName(kind) + " " + Math.round(carry[kind]));
        if (!parts.length) return civilizationText("people.emptyCarry", "Empty", "未携带");
        return parts.join(", ") + " (" + Math.round(person.carryTotal) + "/" + Math.round(person.carryCapacity) + ")";
    }

    function addPersonProfileStat(parent, label, value) {
        const item = document.createElement("div");
        item.className = "people-profile-stat";
        const name = document.createElement("span");
        name.textContent = label;
        const content = document.createElement("strong");
        content.textContent = value === null || value === undefined || value === "" ? "-" : String(value);
        item.appendChild(name);
        item.appendChild(content);
        parent.appendChild(item);
    }

    function renderPeopleList(snapshot) {
        const list = document.getElementById("peopleList");
        if (!list) return;
        const scrollTop = list.scrollTop;
        list.textContent = "";
        if (!snapshot.people.length) {
            const empty = document.createElement("div");
            empty.className = "people-empty";
            empty.textContent = civilizationText("people.none", "No matching people", "没有符合条件的人物");
            list.appendChild(empty);
        }
        snapshot.people.forEach((person) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "people-row" + (person.humanId === selectedPersonId ? " selected" : "");
            row.dataset.humanId = String(person.humanId);
            const heading = document.createElement("span");
            heading.className = "people-row-heading";
            const swatch = document.createElement("i");
            swatch.className = "people-swatch";
            swatch.style.backgroundColor = person.color || factionColor(person.factionId);
            const identity = document.createElement("strong");
            identity.textContent = "H" + person.humanId;
            const summary = document.createElement("span");
            summary.textContent = personAgeLabel(person) + " · " + localizedPersonRole(person.role);
            heading.appendChild(swatch);
            heading.appendChild(identity);
            heading.appendChild(summary);
            const activity = document.createElement("span");
            activity.className = "people-row-activity";
            activity.textContent = person.status === "living" && person.currentActivity ? person.currentActivity.description : ((person.diedAt || "") + (person.deathCause ? " · " + localizedDeathCause(person.deathCause) : ""));
            const carry = document.createElement("span");
            carry.className = "people-row-carry";
            carry.textContent = civilizationText("people.carry", "Carrying", "携带") + "：" + personCarryLabel(person);
            row.appendChild(heading);
            row.appendChild(activity);
            row.appendChild(carry);
            row.addEventListener("click", function () {
                selectedPersonId = person.humanId;
                peopleHistoryLimit = C.PEOPLE_HISTORY_PAGE_SIZE;
                refreshPeopleUi();
            });
            list.appendChild(row);
        });
        list.scrollTop = scrollTop;
    }

    function renderActivityProgress(parent, progress) {
        if (!progress || !Number.isFinite(progress.total) || progress.total <= 0) return;
        const label = document.createElement("div");
        label.className = "people-progress-label";
        label.textContent = Math.round(progress.current) + "/" + Math.round(progress.total) + " · " + Math.max(0, Math.min(100, progress.percent)) + "%";
        const track = document.createElement("div");
        track.className = "people-progress";
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        track.setAttribute("aria-valuenow", String(Math.max(0, Math.min(100, progress.percent))));
        const fill = document.createElement("span");
        fill.style.width = Math.max(0, Math.min(100, progress.percent)) + "%";
        track.appendChild(fill);
        parent.appendChild(label);
        parent.appendChild(track);
    }

    function activityHistoryContext(entry) {
        const metrics = entry && entry.metrics || {};
        if (entry && entry.type === "role_changed" && metrics.fromRole && metrics.toRole) return localizedPersonRole(metrics.fromRole) + " → " + localizedPersonRole(metrics.toRole);
        if (entry && entry.type === "faction_changed" && Number.isFinite(metrics.fromFactionId) && Number.isFinite(metrics.toFactionId)) return civilizationText("people.factionShort", "Faction", "阵营") + " " + metrics.fromFactionId + " → " + metrics.toFactionId;
        if (entry && entry.type === "route_created" && metrics.resourceKind) return civilizationText("people.targetResource", "Target resource: ", "目标资源：") + localizedResourceName(metrics.resourceKind);
        if (entry && entry.type === "death" && metrics.cause) return localizedDeathCause(metrics.cause);
        if (entry && entry.type === "weapon_equipped" && metrics.weapon) return civilizationText("people.equippedWeapon", "Equipped ", "装备：") + localizedPersonWeapon(metrics.weapon);
        if (entry && entry.type === "weapon_removed" && metrics.weapon) return civilizationText("people.removedWeapon", "Removed ", "卸下：") + localizedPersonWeapon(metrics.weapon);
        if (entry && entry.type === "armor_equipped" && metrics.armor) return civilizationText("people.equippedArmor", "Equipped ", "装备：") + localizedPersonArmor(metrics.armor);
        if (entry && entry.type === "armor_removed" && metrics.armor) return civilizationText("people.removedArmor", "Removed ", "卸下：") + localizedPersonArmor(metrics.armor);
        if (metrics.recipeId) return civilizationText("people.recipe", "Recipe ", "配方 ") + localizedRecipeName(metrics.recipeId);
        if (metrics.equippedWeapon) return civilizationText("people.equipped", "Equipped ", "装备 ") + localizedPersonWeapon(metrics.equippedWeapon);
        return "";
    }

    function renderPeopleDetail(person) {
        const detail = document.getElementById("peopleDetail");
        if (!detail) return;
        const scrollTop = detail.scrollTop;
        detail.textContent = "";
        if (!person) {
            const empty = document.createElement("div");
            empty.className = "people-empty";
            empty.textContent = civilizationText("people.selectNone", "No person selected", "未选择人物");
            detail.appendChild(empty);
            return;
        }

        const header = document.createElement("div");
        header.className = "people-detail-header";
        const title = document.createElement("div");
        title.className = "people-detail-identity";
        const swatch = document.createElement("i");
        swatch.className = "people-swatch";
        swatch.style.backgroundColor = person.color || factionColor(person.factionId);
        const name = document.createElement("strong");
        name.textContent = "H" + person.humanId;
        const status = document.createElement("span");
        status.className = "people-status";
        status.textContent = civilizationText("people.living", "Living", "现存");
        title.appendChild(swatch);
        title.appendChild(name);
        title.appendChild(status);
        header.appendChild(title);
        const locate = document.createElement("button");
        locate.type = "button";
        locate.className = "people-icon-button";
        locate.textContent = "⌖";
        locate.title = civilizationText("people.locate", "Locate on map", "在地图中定位");
        locate.setAttribute("aria-label", locate.title);
        locate.addEventListener("click", function () { focusPerson(person.humanId); });
        header.appendChild(locate);
        const command = document.createElement("button");
        command.type = "button";
        command.className = "people-icon-button";
        command.textContent = commandPersonId === person.humanId ? "■" : "➤";
        command.title = commandPersonId === person.humanId ? civilizationText("people.commandCancel", "Cancel command mode", "取消指挥") : civilizationText("people.command", "Command this person", "指挥此人");
        command.setAttribute("aria-label", command.title);
        command.disabled = person.isChild;
        command.addEventListener("click", function () {
            if (commandPersonId === person.humanId) cancelPersonCommand();
            else setCommandPerson(person.humanId);
            installPersonCommandInput();
            refreshPeopleUi();
        });
        header.appendChild(command);
        detail.appendChild(header);

        const profile = document.createElement("div");
        profile.className = "people-profile-grid";
        addPersonProfileStat(profile, civilizationText("people.factionShort", "Faction", "阵营"), "F" + person.factionId);
        addPersonProfileStat(profile, civilizationText("people.settlementShort", "Settlement", "聚落"), Number.isFinite(person.settlementId) ? person.settlementId : "-");
        addPersonProfileStat(profile, civilizationText("people.age", "Age", "年龄"), personAgeLabel(person) + " / " + Math.round(safeNumber(person.lifespanYears, 0)));
        addPersonProfileStat(profile, civilizationText("people.role", "Role", "职业"), localizedPersonRole(person.role));
        addPersonProfileStat(profile, civilizationText("people.health", "HP", "生命值"), Math.round(person.hp) + "/" + Math.round(person.maxHp));
        addPersonProfileStat(profile, civilizationText("people.position", "Position", "位置"), "(" + person.x + ", " + person.y + ")");
        addPersonProfileStat(profile, civilizationText("people.weapon", "Weapon", "武器"), localizedPersonWeapon(person.weapon));
        addPersonProfileStat(profile, civilizationText("people.armor", "Armor", "护甲"), localizedPersonArmor(person.armor));
        addPersonProfileStat(profile, civilizationText("people.carry", "Carrying", "携带"), personCarryLabel(person));
        detail.appendChild(profile);

        const current = document.createElement("section");
        current.className = "people-current";
        const heading = document.createElement("h3");
        heading.textContent = civilizationText("people.current", "Current activity", "当前活动");
        current.appendChild(heading);
        const description = document.createElement("div");
        description.className = "people-current-description";
        description.textContent = person.currentActivity ? person.currentActivity.description : localizedPersonTask(person.task);
        current.appendChild(description);
        if (person.currentActivity && person.currentActivity.startedAt) {
            const started = document.createElement("small");
            started.textContent = person.currentActivity.startedAt + " · " + civilizationText("people.duration", "Duration ", "持续 ") + person.currentActivity.durationTicks + civilizationText("people.ticks", " ticks", " 刻");
            current.appendChild(started);
            renderActivityProgress(current, person.currentActivity.progress);
        }
        detail.appendChild(current);

        const historyHeader = document.createElement("div");
        historyHeader.className = "people-history-header";
        const historyTitle = document.createElement("h3");
        historyTitle.textContent = civilizationText("people.history", "Activity history", "过往活动");
        historyHeader.appendChild(historyTitle);
        const retained = document.createElement("span");
        retained.textContent = String(person.historyRetained);
        historyHeader.appendChild(retained);
        detail.appendChild(historyHeader);

        const history = getPersonHistory(person.humanId, {limit: peopleHistoryLimit});
        if (!history.entries.length) {
            const empty = document.createElement("div");
            empty.className = "people-empty compact";
            empty.textContent = civilizationText("people.noHistory", "No completed activities yet", "还没有已完成的活动");
            detail.appendChild(empty);
        }
        history.entries.forEach((entry) => {
            const row = document.createElement("div");
            row.className = "people-history-row";
            const time = document.createElement("time");
            time.textContent = entry.endedAt || entry.startedAt || "";
            const description = document.createElement("div");
            description.textContent = entry.description;
            row.appendChild(time);
            row.appendChild(description);
            const context = activityHistoryContext(entry);
            if (context) {
                const result = document.createElement("small");
                result.textContent = context;
                row.appendChild(result);
            }
            detail.appendChild(row);
        });
        if (history.hasMore) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "people-load-more";
            more.textContent = civilizationText("people.loadOlder", "Load older", "加载更早记录");
            more.addEventListener("click", function () {
                peopleHistoryLimit = Math.min(C.MAX_PERSON_ACTIVITY, peopleHistoryLimit + C.PEOPLE_HISTORY_PAGE_SIZE);
                refreshPeopleUi();
            });
            detail.appendChild(more);
        }
        detail.scrollTop = scrollTop;
    }

    function syncPeopleObserverScrollSpace() {
        if (typeof document === "undefined") return;
        const spacer = document.getElementById("peopleObserverScrollSpace");
        const panel = document.getElementById("peopleObserverPanel");
        if (!spacer || !panel || !peoplePanelOpen) {
            if (spacer) spacer.style.height = "0px";
            return;
        }
        const viewportWidth = root.visualViewport ? root.visualViewport.width : root.innerWidth;
        const panelRect = panel.getBoundingClientRect();
        const bottomSheet = panelRect.width >= viewportWidth * 0.9 && panelRect.top > 0;
        spacer.style.height = bottomSheet ? Math.ceil(panelRect.height) + "px" : "0px";
    }

    function refreshPeopleUi() {
        if (typeof document === "undefined") return;
        const panel = document.getElementById("peopleObserverPanel");
        if (!panel || !peoplePanelOpen) return;
        syncPeopleObserverScrollSpace();
        panel.classList.remove("is-obscured");

        const fullSnapshot = getPeopleSnapshot();
        refreshPeopleFilterOptions(fullSnapshot.people);
        const snapshot = getPeopleSnapshot(readPeopleFilters());
        const counts = document.getElementById("peopleCounts");
        if (counts) counts.textContent = civilizationText("people.living", "Living", "现存") + " " + snapshot.counts.living + " · " + civilizationText("people.totalDeaths", "Deaths", "累计死亡") + " " + snapshot.counts.deaths + " · " + civilizationText("people.visible", "Shown", "显示") + " " + snapshot.counts.filtered;

        const selectedVisible = snapshot.people.some((person) => person.humanId === selectedPersonId);
        if (!selectedVisible) {
            selectedPersonId = snapshot.people.length ? snapshot.people[0].humanId : null;
            peopleHistoryLimit = C.PEOPLE_HISTORY_PAGE_SIZE;
        }
        renderPeopleList(snapshot);
        renderPeopleDetail(selectedPersonId === null ? null : getPersonSnapshot(selectedPersonId));
    }

    function peopleRefreshLoop(timestamp) {
        peopleRefreshFrame = null;
        if (!peoplePanelOpen) return;
        if (!peopleLastRefreshAt || timestamp - peopleLastRefreshAt >= C.PEOPLE_UI_REFRESH_MS) {
            peopleLastRefreshAt = timestamp;
            refreshPeopleUi();
        }
        peopleRefreshFrame = root.requestAnimationFrame(peopleRefreshLoop);
    }

    function startPeopleRefreshLoop() {
        if (!peoplePanelOpen || peopleRefreshFrame !== null || typeof root.requestAnimationFrame !== "function") return;
        peopleRefreshFrame = root.requestAnimationFrame(peopleRefreshLoop);
    }

    function stopPeopleRefreshLoop() {
        if (peopleRefreshFrame !== null && typeof root.cancelAnimationFrame === "function") root.cancelAnimationFrame(peopleRefreshFrame);
        peopleRefreshFrame = null;
    }

    function focusPerson(humanId) {
        const actor = findLivingActor(humanId);
        if (!actor) {
            focusedPersonId = null;
            return false;
        }
        focusedPersonId = actor.humanId;
        if (typeof document === "undefined") return true;
        syncPeopleObserverScrollSpace();
        const canvasElement = document.getElementById("game");
        if (!canvasElement || typeof root.scrollTo !== "function") return true;
        const rect = canvasElement.getBoundingClientRect();
        const canvasWidth = Math.max(1, canvasElement.width || rect.width);
        const canvasHeight = Math.max(1, canvasElement.height || rect.height);
        const targetX = rect.left + root.pageXOffset + (canvasCoord(actor.x) + pixelSize / 2) / canvasWidth * rect.width;
        const targetY = rect.top + root.pageYOffset + (canvasCoord(actor.y) + pixelSize / 2) / canvasHeight * rect.height;
        const panel = document.getElementById("peopleObserverPanel");
        const viewportWidth = root.visualViewport ? root.visualViewport.width : root.innerWidth;
        const viewportHeight = root.visualViewport ? root.visualViewport.height : root.innerHeight;
        const panelRect = panel ? panel.getBoundingClientRect() : null;
        const bottomSheet = panelRect && panelRect.width >= viewportWidth * 0.9 && panelRect.top > 0;
        const panelWidth = panelRect && !bottomSheet ? panelRect.width : 0;
        const visibleHeight = bottomSheet ? Math.max(80, panelRect.top) : viewportHeight;
        root.scrollTo({left: Math.max(0, targetX - (viewportWidth - panelWidth) / 2), top: Math.max(0, targetY - visibleHeight / 2), behavior: "smooth"});
        return true;
    }

    function cancelActorTaskState(actor, reason) {
        if (!actor) return;
        cancelPendingAttacksFor(actor);
        delete actor.resumeAfterDelivery;
        delete actor.combatTargetId;
        delete actor.underAttackUntil;
        clearTask(actor, "interrupted", reason || "player_command");
    }

    function commandResult(accepted, action, reason, target) {
        return {accepted: !!accepted, action: action || null, reason: reason || null, target: target || null};
    }

    function syncInteractionModeUi() {
        if (typeof document === "undefined") return;
        const place = document.getElementById("interactionModePlace");
        const control = document.getElementById("interactionModeControl");
        if (place) {
            place.setAttribute("on", interactionMode === "place" ? "true" : "false");
            place.setAttribute("aria-pressed", interactionMode === "place" ? "true" : "false");
        }
        if (control) {
            control.setAttribute("on", interactionMode === "control" ? "true" : "false");
            control.setAttribute("aria-pressed", interactionMode === "control" ? "true" : "false");
        }
    }

    function setInteractionMode(nextMode) {
        const next = nextMode === "control" ? "control" : "place";
        interactionMode = next;
        if (next === "place") cancelPersonCommand();
        syncInteractionModeUi();
        return interactionMode;
    }

    function getInteractionMode() {
        return interactionMode;
    }

    function cancelPersonCommand() {
        commandPersonId = null;
        commandHover = null;
        commandLastResult = commandResult(true, "cancel", "command_mode_cancelled", null);
        return true;
    }

    function setCommandPerson(humanId) {
        const actor = findLivingActor(humanId);
        if (!actor || actor.element !== "civ_body") return commandResult(false, "select", "adult_not_available", null);
        interactionMode = "control";
        commandPersonId = actor.humanId;
        focusedPersonId = actor.humanId;
        commandLastResult = commandResult(true, "select", null, {humanId: actor.humanId});
        syncInteractionModeUi();
        return commandLastResult;
    }

    function getPersonCommandState() {
        const actor = commandPersonId === null ? null : findLivingActor(commandPersonId);
        if (!actor && commandPersonId !== null) cancelPersonCommand();
        return {
            active: !!actor,
            humanId: actor ? actor.humanId : null,
            hover: commandHover ? Object.assign({}, commandHover) : null,
            order: actor && actor.playerOrder ? cloneActivityValue(actor.playerOrder) : null,
            lastResult: commandLastResult ? cloneActivityValue(commandLastResult) : null
        };
    }

    function clearPlayerOrder(actor, outcome, reason) {
        if (!actor) return;
        delete actor.playerOrder;
        if (actor.task === "move" || actor.task === "harvest" || actor.task === "deliver" || actor.task === "combat") clearTask(actor, outcome || "completed", reason || "player_order_finished");
    }

    function nearestCommandDestination(actor, x, y) {
        if (actorCanStandAt(actor, x, y)) return {x, y};
        if (y > actor.y && excavationPositionPossible(actor, x, y)) return {x, y};
        if (y < actor.y && highApproachHasSupport(actor, x, y) && (actorCanOccupyAt(actor, x, y) || excavationPositionPossible(actor, x, y))) return {x, y};
        for (let radius = 0; radius <= 6; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (radius && Math.abs(dx) !== radius) continue;
                const px = x + dx;
                if (outOfBounds(px, y)) continue;
                const surfaceY = findSurfaceY(px, y);
                if (surfaceY !== null && actorCanStandAt(actor, px, surfaceY)) return {x: px, y: surfaceY};
            }
        }
        return null;
    }

    function legalDeliveryBuilding(actor, building) {
        if (!actor || !building || !isBuildingCorePixel(building) || building.del || building.buildingState === "destroyed" || building.townCenterActive === false) return false;
        if (building.factionId !== actor.factionId || building.settlementId !== actor.settlementId) return false;
        const carry = ensureActorCarry(actor);
        const kinds = Object.keys(carry).filter((kind) => carry[kind] > 0);
        if (!kinds.length) return false;
        return kinds.some((kind) => {
            const preferred = deliveryDestination(actor, kind);
            return building.element === "civ_banner" || preferred === building || preferred && preferred.buildingType === building.buildingType;
        });
    }

    function manualResourceTarget(actor, x, y) {
        let pixel = pixelsAt(x, y).find((candidate) => resourceDescriptor(candidate)) || null;
        const tree = getTreeAt(x, y);
        if (tree && tree.base) pixel = tree.base;
        const descriptor = resourceDescriptor(pixel);
        if (!pixel || !descriptor) return null;
        const faction = manager.factionById.get(actor.factionId);
        if (!resourceUnlockedForFaction(faction, descriptor.kind)) return commandResult(false, "harvest", "technology_required", null);
        if ((descriptor.kind === "copper" || descriptor.kind === "raw_iron") && actor.role !== "miner") return commandResult(false, "harvest", "miner_required", null);
        const owner = manager.territory && manager.territory.ownerAt(pixel.x);
        if (owner !== null && owner !== undefined && owner !== actor.factionId) return commandResult(false, "harvest", "foreign_territory", null);
        const key = pixel.element + "@" + pixel.x + "," + pixel.y;
        if (manager.resourceReservations && manager.resourceReservations.reservedBy({key, x: pixel.x, y: pixel.y, element: pixel.element}) !== undefined && manager.resourceReservations.reservedBy({key, x: pixel.x, y: pixel.y, element: pixel.element}) !== actor.humanId) return commandResult(false, "harvest", "resource_reserved_by_other", null);
        const approach = harvestApproach(actor, pixel);
        if (!approach) return commandResult(false, "harvest", "unreachable", null);
        return {pixel, descriptor, approach, key};
    }

    function applyPlayerOrder(actor) {
        const order = actor && actor.playerOrder;
        if (!actor || !order || actor.dead || actor.del) return false;
        if (order.type === "move") {
            if (Core.distance(actor.x, actor.y, order.x, order.y) <= 1) {
                clearPlayerOrder(actor, "completed", "destination_reached");
                return true;
            }
            if (actor.task !== "move" || actor.targetKey !== taskTargetKey({x: order.x, y: order.y, kind: "command_destination"})) setTask(actor, "move", {x: order.x, y: order.y, kind: "command_destination"});
            return true;
        }
        if (order.type === "harvest") {
            const pixel = pixelsAt(order.x, order.y).find((candidate) => resourceDescriptor(candidate)) || null;
            if (!pixel) { clearPlayerOrder(actor, "interrupted", "resource_disappeared"); return false; }
            if (actor.task !== "harvest") {
                const found = manualResourceTarget(actor, order.x, order.y);
                if (!found || found.accepted === false || !setHarvestTask(actor, found)) { clearPlayerOrder(actor, "failed", found && found.reason || "invalid_resource_target"); return false; }
            }
            return true;
        }
        if (order.type === "deliver") {
            const building = getBuildingById(order.buildingId) || getBuildingCoreAt(order.x, order.y);
            if (!legalDeliveryBuilding(actor, building)) { clearPlayerOrder(actor, "interrupted", "delivery_destination_lost"); return false; }
            if (actor.task !== "deliver") setTask(actor, "deliver", building);
            return true;
        }
        if (order.type === "attack") {
            const target = findLivingActor(order.targetId);
            if (!target || (!atWar(actor.factionId, target.factionId) && !retaliationAllowed(actor, target))) { clearPlayerOrder(actor, "interrupted", "hostility_ended"); return false; }
            if (actor.task !== "combat" || actor.targetId !== target.humanId) { delete actor.combatTargetId; lockCombatTarget(actor, target); }
            return true;
        }
        return false;
    }

    function commitPlayerOrder(actor, order, taskTarget) {
        cancelActorTaskState(actor, "player_command_replaced");
        actor.playerOrder = order;
        if (taskTarget) setTask(actor, order.type === "attack" ? "combat" : order.type, taskTarget);
        else applyPlayerOrder(actor);
        return true;
    }

    function issuePersonCommandAt(humanId, button, x, y) {
        const actor = findLivingActor(humanId);
        x = Math.round(Number(x));
        y = Math.round(Number(y));
        if (!actor || actor.element !== "civ_body") return commandResult(false, null, "adult_not_available", null);
        if (!Number.isFinite(x) || !Number.isFinite(y) || outOfBounds(x, y)) return commandResult(false, null, "invalid_coordinates", null);
        if (Number(button) === 0) {
            const target = pixelsAt(x, y).slice().reverse().map(getActorFromPixel).find((candidate) => candidate && candidate.humanId !== actor.humanId) || null;
            if (!target) return commandResult(false, "attack", "no_unit", {x, y});
            if (target.factionId === actor.factionId) return commandResult(false, "attack", "friendly_unit", {humanId: target.humanId});
            if (!atWar(actor.factionId, target.factionId) && !retaliationAllowed(actor, target)) return commandResult(false, "attack", getPeaceMode() === "full-peace" ? "full_peace" : "not_at_war", {humanId: target.humanId});
            commitPlayerOrder(actor, {type: "attack", targetId: target.humanId});
            return commandResult(true, "attack", null, {humanId: target.humanId, x: target.x, y: target.y});
        }
        const building = buildingVisualAt(x, y) || getBuildingCoreAt(x, y);
        if (building && carriedAmount(actor) > 0) {
            if (!legalDeliveryBuilding(actor, building)) return commandResult(false, "deliver", "invalid_delivery_building", {buildingId: building.buildingId, x, y});
            commitPlayerOrder(actor, {type: "deliver", buildingId: building.buildingId, x: building.x, y: building.y}, building);
            return commandResult(true, "deliver", null, {buildingId: building.buildingId, x: building.x, y: building.y});
        }
        const resource = manualResourceTarget(actor, x, y);
        if (resource) {
            if (resource.accepted === false) return resource;
            commitPlayerOrder(actor, {type: "harvest", x: resource.pixel.x, y: resource.pixel.y, element: resource.pixel.element});
            return commandResult(true, "harvest", null, {element: resource.pixel.element, x: resource.pixel.x, y: resource.pixel.y});
        }
        const destination = nearestCommandDestination(actor, x, y);
        if (!destination) return commandResult(false, "move", "no_standable_destination", {x, y});
        commitPlayerOrder(actor, {type: "move", x: destination.x, y: destination.y}, {x: destination.x, y: destination.y, kind: "command_destination"});
        return commandResult(true, "move", null, destination);
    }

    function handleCommandMouse(event) {
        if (interactionMode !== "control" || (event.button !== 0 && event.button !== 2)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const canvas = document.getElementById("game");
        const position = typeof getMousePos === "function" ? getMousePos(canvas, event) : mousePos;
        const clickedActor = pixelsAt(position.x, position.y).slice().reverse().map(getActorFromPixel).find((candidate) => candidate && !candidate.dead && !candidate.del && candidate.element === "civ_body") || null;
        if (event.button === 2 && clickedActor) {
            commandLastResult = setCommandPerson(clickedActor.humanId);
            commandHover = {x: position.x, y: position.y, action: "select", accepted: true};
            if (peoplePanelOpen) refreshPeopleUi();
            return;
        }
        if (commandPersonId === null) {
            commandLastResult = commandResult(false, event.button === 0 ? "attack" : "select", "no_person_selected", position);
            commandHover = {x: position.x, y: position.y, action: commandLastResult.action, accepted: false};
            return;
        }
        commandLastResult = issuePersonCommandAt(commandPersonId, event.button, position.x, position.y);
        commandHover = {x: position.x, y: position.y, action: commandLastResult.action, accepted: commandLastResult.accepted};
        if (peoplePanelOpen) refreshPeopleUi();
    }

    function installPersonCommandInput() {
        if (commandInputInstalled || typeof document === "undefined") return;
        const canvas = document.getElementById("game");
        if (!canvas) return;
        commandInputInstalled = true;
        canvas.addEventListener("mousedown", handleCommandMouse, true);
        canvas.addEventListener("mousemove", function (event) {
            if (interactionMode !== "control") return;
            const position = typeof getMousePos === "function" ? getMousePos(canvas, event) : mousePos;
            commandHover = {x: position.x, y: position.y};
        }, true);
        root.addEventListener("mouseup", function (event) {
            if (interactionMode !== "control" || (event.button !== 0 && event.button !== 2)) return;
            if (typeof mouseIsDown !== "undefined") mouseIsDown = false;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
        root.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && interactionMode === "control") {
                if (commandPersonId !== null) cancelPersonCommand();
                else setInteractionMode("place");
                event.preventDefault();
                event.stopImmediatePropagation();
                if (peoplePanelOpen) refreshPeopleUi();
            }
        }, true);
    }

    function renderPersonCommand(ctx) {
        if (commandPersonId === null) return;
        const actor = findLivingActor(commandPersonId);
        if (!actor) { cancelPersonCommand(); return; }
        const order = actor.playerOrder;
        const target = order ? {x: order.x, y: order.y} : commandHover;
        const colors = {move: "#62b8ff", harvest: "#73d16b", deliver: "#f3c65e", attack: "#ff655e"};
        const color = colors[order && order.type || commandHover && commandHover.action] || "#ffffff";
        const ax = canvasCoord(actor.x) + pixelSize / 2;
        const ay = canvasCoord(actor.y - 1) + pixelSize / 2;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(2, pixelSize * 0.12);
        ctx.beginPath();
        ctx.moveTo(ax, ay - pixelSize * 1.4);
        ctx.lineTo(ax - pixelSize * 0.35, ay - pixelSize * 0.8);
        ctx.lineTo(ax + pixelSize * 0.35, ay - pixelSize * 0.8);
        ctx.closePath();
        ctx.fill();
        if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
            const tx = canvasCoord(target.x) + pixelSize / 2;
            const ty = canvasCoord(target.y) + pixelSize / 2;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.strokeRect(tx - pixelSize * 0.35, ty - pixelSize * 0.35, pixelSize * 0.7, pixelSize * 0.7);
        }
        ctx.restore();
    }

    function renderPersonSpeech(ctx) {
        if (typeof settings !== "undefined" && settings.humanSocietySpeech === false) return;
        const speakers = Array.from(manager.actors).filter((actor) => actor && !actor.dead && !actor.del && actor.speech && actor.speech.untilTick > pixelTicks);
        speakers.sort((a, b) => safeNumber(b.speech.priority, 0) - safeNumber(a.speech.priority, 0) || safeNumber(b.speech.startedTick, 0) - safeNumber(a.speech.startedTick, 0));
        const placed = [];
        ctx.save();
        ctx.font = "12px sans-serif";
        ctx.textBaseline = "middle";
        for (let i = 0; i < Math.min(12, speakers.length); i++) {
            const actor = speakers[i];
            const text = localizedSpeechText(actor.speech.text).slice(0, 64);
            if (!text) continue;
            const measured = typeof ctx.measureText === "function" ? ctx.measureText(text).width : text.length * 7;
            const bubbleWidth = Math.max(34, Math.min(180, Math.ceil(measured) + 12));
            const bubbleHeight = 20;
            let x = canvasCoord(actor.x) + pixelSize / 2 - bubbleWidth / 2;
            let y = canvasCoord(actor.y - 2) - bubbleHeight - 5;
            x = Math.max(2, Math.min(ctx.canvas.width - bubbleWidth - 2, x));
            let attempts = 0;
            while (placed.some((rect) => x < rect.x + rect.width + 3 && x + bubbleWidth + 3 > rect.x && y < rect.y + rect.height + 3 && y + bubbleHeight + 3 > rect.y) && attempts < 10) {
                y -= bubbleHeight + 4;
                attempts++;
            }
            if (y < 2) continue;
            const opacity = Math.min(1, Math.max(0.25, (actor.speech.untilTick - pixelTicks) / 20));
            ctx.globalAlpha = opacity;
            ctx.fillStyle = "rgba(255,255,255,0.94)";
            ctx.strokeStyle = "rgba(20,20,20,0.9)";
            ctx.lineWidth = 1;
            ctx.fillRect(x, y, bubbleWidth, bubbleHeight);
            ctx.strokeRect(x, y, bubbleWidth, bubbleHeight);
            const pointerX = Math.max(x + 5, Math.min(x + bubbleWidth - 5, canvasCoord(actor.x) + pixelSize / 2));
            ctx.beginPath();
            ctx.moveTo(pointerX - 3, y + bubbleHeight);
            ctx.lineTo(pointerX + 3, y + bubbleHeight);
            ctx.lineTo(pointerX, y + bubbleHeight + 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#111111";
            ctx.fillText(text, x + 6, y + bubbleHeight / 2, bubbleWidth - 12);
            placed.push({x, y, width: bubbleWidth, height: bubbleHeight + 4});
        }
        ctx.restore();
    }

    function renderPersonFocus(ctx) {
        if (focusedPersonId === null) return;
        const actor = findLivingActor(focusedPersonId);
        if (!actor) {
            focusedPersonId = null;
            return;
        }
        const pulse = (Math.sin(Date.now() / 170) + 1) / 2;
        const top = actor.element === "civ_body" ? actor.y - 1 : actor.y;
        const cellsHigh = actor.element === "civ_body" ? 2 : 1;
        const padding = pixelSize * (0.22 + pulse * 0.18);
        const x = canvasCoord(actor.x) - padding;
        const y = canvasCoord(top) - padding;
        const boxWidth = pixelSize + padding * 2;
        const boxHeight = pixelSize * cellsHigh + padding * 2;
        ctx.save();
        ctx.lineWidth = Math.max(2, pixelSize * 0.2);
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeRect(x - 1, y - 1, boxWidth + 2, boxHeight + 2);
        ctx.lineWidth = Math.max(1, pixelSize * 0.12);
        ctx.strokeStyle = pulse > 0.5 ? "#ffffff" : "#ffd84a";
        ctx.strokeRect(x, y, boxWidth, boxHeight);
        ctx.restore();
    }

    function resetPeopleObserverState() {
        selectedPersonId = null;
        focusedPersonId = null;
        peopleHistoryLimit = C.PEOPLE_HISTORY_PAGE_SIZE;
        peopleLastRefreshAt = 0;
        cancelPersonCommand();
        if (peoplePanelOpen) refreshPeopleUi();
    }

    function closePeoplePanel() {
        peoplePanelOpen = false;
        focusedPersonId = null;
        stopPeopleRefreshLoop();
        if (typeof document !== "undefined") {
            const panel = document.getElementById("peopleObserverPanel");
            if (panel) {
                if (typeof closeMenu === "function") closeMenu("people");
                else panel.style.display = "none";
                panel.setAttribute("aria-hidden", "true");
            }
            const button = document.getElementById("peopleObserverButton");
            if (button) button.setAttribute("on", "false");
            syncPeopleObserverScrollSpace();
        }
        return true;
    }

    function openPeoplePanel(humanId) {
        if (typeof document === "undefined") return false;
        installPeopleObserverUi();
        if (humanId !== undefined && humanId !== null) {
            const person = getPersonSnapshot(humanId);
            if (person) {
                selectedPersonId = person.humanId;
                peopleHistoryLimit = C.PEOPLE_HISTORY_PAGE_SIZE;
            }
        }
        const panel = document.getElementById("peopleObserverPanel");
        if (!panel) return false;
        peoplePanelOpen = true;
        if (typeof openTopLevelWindow === "function") openTopLevelWindow("people", panel, "flex");
        else panel.style.display = "flex";
        panel.setAttribute("aria-hidden", "false");
        const button = document.getElementById("peopleObserverButton");
        if (button) button.setAttribute("on", "true");
        peopleLastRefreshAt = 0;
        refreshPeopleUi();
        startPeopleRefreshLoop();
        return true;
    }

    function installPeopleObserverUi() {
        if (typeof document === "undefined" || document.getElementById("peopleObserverPanel")) return;
        const style = document.createElement("style");
        style.id = "peopleObserverStyle";
        style.textContent = "#peopleObserverPanel{position:fixed;z-index:9000;top:8px;right:8px;bottom:8px;width:min(470px,calc(100vw - 16px));display:none;flex-direction:column;min-width:0;overflow:hidden;background:var(--theme-darkest2);color:#eee;border:2px solid var(--theme-opac85);border-radius:6px;box-shadow:0 8px 28px #000b;font:13px/1.35 Arial,sans-serif;text-align:left;user-select:text}#peopleObserverPanel.is-obscured{visibility:hidden;pointer-events:none}.people-observer-header{display:flex;align-items:center;gap:8px;min-height:40px;padding:6px 8px;border-bottom:1px solid var(--theme-dark);background:var(--theme-darker)}.people-observer-header h2{min-width:0;margin:0;font-size:16px;letter-spacing:0}.people-observer-header .people-counts{margin-left:auto;font-size:11px;opacity:.78;white-space:nowrap}.people-icon-button{width:30px;height:30px;flex:0 0 30px;padding:0;border:1px solid var(--theme)!important;border-radius:4px;background:var(--theme-darkest2);color:#eee;font-size:20px;line-height:1;cursor:pointer}.people-icon-button:disabled{opacity:.35;cursor:default}.people-status-tabs{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--theme-dark)}.people-status-tabs button{padding:7px;border:0;border-right:1px solid var(--theme-dark);background:var(--theme-darkest2);color:#bbb;cursor:pointer}.people-status-tabs button.active{background:var(--theme-dark);color:#fff;box-shadow:inset 0 -2px #63a9de}.people-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:7px;border-bottom:1px solid var(--theme-dark)}.people-filters input,.people-filters select{box-sizing:border-box;width:100%;min-width:0;height:29px;padding:3px 6px;border:1px solid var(--theme-dark);border-radius:3px;background:var(--theme-darkest2);color:#eee;font-size:12px}.people-filters input{grid-column:1/-1}.people-observer-content{display:grid;grid-template-columns:minmax(142px,38%) minmax(0,1fr);min-height:0;flex:1}.people-list,.people-detail{min-width:0;min-height:0;overflow:auto}.people-list{border-right:1px solid var(--theme-dark);background:#090909}.people-row{display:flex;width:100%;min-width:0;flex-direction:column;gap:4px;padding:8px;border:0;border-bottom:1px solid #292929;background:transparent;color:#ddd;text-align:left;cursor:pointer}.people-row:hover{background:#202020}.people-row.selected{background:#25333a;box-shadow:inset 3px 0 #63a9de}.people-row-heading{display:grid;grid-template-columns:10px auto minmax(0,1fr);align-items:center;gap:5px;min-width:0}.people-row-heading>span{overflow:hidden;color:#aaa;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.people-swatch{display:inline-block;width:9px;height:9px;flex:0 0 9px;border:1px solid #fff8;border-radius:2px}.people-row-activity{display:-webkit-box;min-width:0;overflow:hidden;color:#aaa;font-size:11px;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2}.people-row-carry{min-width:0;color:#d4b86a;font-size:10px;overflow-wrap:anywhere;white-space:normal}.people-detail{padding:9px}.people-detail-header{display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1px solid var(--theme-dark)}.people-detail-identity{display:flex;min-width:0;align-items:center;gap:6px;font-size:17px}.people-detail-header>.people-icon-button{margin-left:auto}.people-status{padding:2px 5px;border:1px solid #666;border-radius:3px;color:#bbb;font-size:10px;font-weight:400}.people-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin:8px 0;background:#303030}.people-profile-stat{display:flex;min-width:0;flex-direction:column;gap:2px;padding:6px;background:#111}.people-profile-stat span{color:#888;font-size:10px}.people-profile-stat strong{min-width:0;overflow-wrap:anywhere;font-size:11px;font-weight:600}.people-current,.people-death-summary{margin:8px 0;padding:8px 0;border-top:1px solid var(--theme-dark);border-bottom:1px solid var(--theme-dark)}.people-current h3,.people-history-header h3{margin:0;font-size:12px}.people-current-description{margin:5px 0;overflow-wrap:anywhere}.people-current small,.people-history-row small{display:block;color:#999;overflow-wrap:anywhere}.people-progress-label{margin-top:6px;color:#aaa;font-size:10px}.people-progress{height:4px;margin-top:3px;overflow:hidden;background:#333;border-radius:2px}.people-progress span{display:block;height:100%;background:#63a9de}.people-history-header{display:flex;align-items:center;justify-content:space-between;margin:10px 0 3px}.people-history-header span{color:#888;font-size:10px}.people-history-row{padding:7px 0;border-bottom:1px solid #292929;overflow-wrap:anywhere}.people-history-row time{display:block;margin-bottom:2px;color:#777;font-size:9px}.people-history-row div{font-size:11px}.people-load-more{width:100%;margin-top:8px;padding:6px;border:1px solid var(--theme-dark);border-radius:3px;background:#222;color:#ddd;cursor:pointer}.people-empty{padding:18px 9px;color:#888;text-align:center;overflow-wrap:anywhere}.people-empty.compact{padding:9px}.people-death-summary{color:#c8a0a0;overflow-wrap:anywhere}@media(max-width:700px){#peopleObserverPanel{top:auto;right:0;bottom:0;left:0;width:100%;height:min(70dvh,620px);border-right:0;border-bottom:0;border-left:0;border-radius:0}.people-observer-header{min-height:36px}.people-observer-content{grid-template-columns:minmax(128px,40%) minmax(0,1fr)}.people-profile-grid{grid-template-columns:1fr}.people-row{padding:7px 6px}}";
        document.head.appendChild(style);

        const panel = document.createElement("aside");
        panel.id = "peopleObserverPanel";
        panel.setAttribute("aria-hidden", "true");
        panel.setAttribute("aria-label", civilizationText("people.title", "People observer", "人物观察"));
        panel.addEventListener("click", function (event) { event.stopPropagation(); });
        panel.addEventListener("keydown", function (event) {
            event.stopPropagation();
            if (event.key === "Escape") closePeoplePanel();
        });

        const header = document.createElement("header");
        header.className = "people-observer-header";
        const title = document.createElement("h2");
        title.textContent = civilizationText("people.title", "People observer", "人物观察");
        const counts = document.createElement("span");
        counts.id = "peopleCounts";
        counts.className = "people-counts";
        const close = document.createElement("button");
        close.type = "button";
        close.className = "people-icon-button";
        close.textContent = "×";
        close.title = civilizationText("people.close", "Close", "关闭");
        close.setAttribute("aria-label", close.title);
        close.addEventListener("click", closePeoplePanel);
        header.appendChild(title);
        header.appendChild(counts);
        header.appendChild(close);
        panel.appendChild(header);
        makeFloatingPanelDraggable(panel, header);

        const filters = document.createElement("div");
        filters.className = "people-filters";
        const search = document.createElement("input");
        search.id = "peopleSearchInput";
        search.type = "search";
        search.placeholder = civilizationText("people.search", "Search ID, role or activity", "搜索编号、职业或活动");
        search.setAttribute("aria-label", search.placeholder);
        search.addEventListener("input", refreshPeopleUi);
        filters.appendChild(search);
        [["peopleFactionFilter", "Faction", "阵营"], ["peopleSettlementFilter", "Settlement", "聚落"], ["peopleRoleFilter", "Role", "职业"], ["peopleTaskFilter", "Activity", "活动"]].forEach((definition) => {
            const select = document.createElement("select");
            select.id = definition[0];
            select.setAttribute("aria-label", civilizationText("people.filter." + definition[0], definition[1], definition[2]));
            select.addEventListener("change", function () {
                selectedPersonId = null;
                peopleHistoryLimit = C.PEOPLE_HISTORY_PAGE_SIZE;
                refreshPeopleUi();
            });
            filters.appendChild(select);
        });
        panel.appendChild(filters);

        const content = document.createElement("div");
        content.className = "people-observer-content";
        const list = document.createElement("div");
        list.id = "peopleList";
        list.className = "people-list";
        const detail = document.createElement("div");
        detail.id = "peopleDetail";
        detail.className = "people-detail";
        content.appendChild(list);
        content.appendChild(detail);
        panel.appendChild(content);
        document.body.appendChild(panel);
        const scrollSpace = document.createElement("div");
        scrollSpace.id = "peopleObserverScrollSpace";
        scrollSpace.setAttribute("aria-hidden", "true");
        scrollSpace.style.height = "0px";
        scrollSpace.style.pointerEvents = "none";
        document.body.appendChild(scrollSpace);

        const controls = document.getElementById("toolControls");
        if (controls && !document.getElementById("peopleObserverButton")) {
            const button = document.createElement("button");
            button.id = "peopleObserverButton";
            button.className = "controlButton";
            button.textContent = civilizationText("people.button", "People", "人物");
            button.title = civilizationText("people.buttonTitle", "Observe every person's current and past activities", "查看每个人当前与过去的活动");
            button.setAttribute("on", "false");
            button.addEventListener("click", function () { if (peoplePanelOpen) closePeoplePanel(); else openPeoplePanel(); });
            controls.insertBefore(button, document.getElementById("civilizationButton") || document.getElementById("settingsButton") || null);
        }
    }

    function debugSnapshot() {
        const factions = [];
        let livingPopulation = 0;
        manager.actors.forEach((actor) => { if (actor && !actor.del && !actor.dead) livingPopulation++; });
        manager.factionById.forEach((faction) => {
            const banner = faction.settlements[0];
            factions.push({
                id: faction.id,
                population: faction.population,
                adults: faction.adultPopulation,
                housing: faction.housing,
                stage: banner ? banner.stage : "nomadic",
                eraId: banner ? banner.eraId : null,
                technologies: banner && banner.research ? Object.keys(banner.research.unlocked || {}).filter((techId) => banner.research.unlocked[techId]).length : 0,
                knowledge: banner && banner.research ? banner.research.knowledge : 0,
                stock: banner && banner.stock ? {food: banner.stock.food, wood: banner.stock.wood, stone: banner.stock.stone} : null,
                militaryPower: faction.militaryPower,
                atWar: factionIsAtWar(faction.id)
            });
        });
        return {
            population: livingPopulation,
            factions: factions,
            pendingAttacks: manager.pendingAttacks.length + manager.pendingStructureAttacks.length + manager.pendingRangedImpacts.length,
            averageTickMs: manager.perfSamples ? manager.perfTotal / manager.perfSamples : 0,
            maxTickMs: manager.perfMax,
            indexAudit: {running: manager.auditRunning, cursor: manager.auditCursor, limit: manager.auditLimit, lastFullRebuildTick: manager.lastFullRebuild, lastStartedTick: manager.lastAuditStartedTick, lastCompletedTick: manager.lastAuditCompletedTick, pixelsChecked: manager.auditPixels, lifecycleEvents: manager.lifecycleEvents, dirtyTrees: manager.dirtyTreeLineages.size, resourceNodes: Array.from(manager.resourceIndex.values()).reduce((sum, nodes) => sum + nodes.length, 0), trees: manager.treeById.size}
        };
    }

    function societyTick() {
        const started = nowMs();
        const civilizationTick = pixelTicks % C.CIVILIZATION_INTERVAL === 0;
        if (manager.pendingResourceDrops.length) {
            const drops = manager.pendingResourceDrops.splice(0, Math.min(8, manager.pendingResourceDrops.length));
            drops.forEach((drop) => queueResourceDrops(drop.kind, drop.element, drop.amount, drop.x, drop.y, drop.metadata));
        }
        if (manager.lastFullRebuild < 0) rebuildIndexes(true);
        else if (civilizationTick) {
            manager.treeById.forEach((tree) => {
                if (treeIsHarvestable(tree) && tree.lineage && !manager.resourceNodeByPixel.has(tree.base)) manager.dirtyTreeLineages.add(tree.lineage);
            });
        }
        else if (!civilizationTick) {
            processIncrementalAudit(safeNumber(C.INDEX_AUDIT_BUDGET_MS, 0.35));
            processDirtyTrees(safeNumber(C.INDEX_AUDIT_BUDGET_MS, 0.35));
            if (manager.derivedIndexesDirty && (manager.lastDerivedRefreshTick < 0 || pixelTicks - manager.lastDerivedRefreshTick >= C.CIVILIZATION_INTERVAL)) refreshDerivedIndexes();
        }
        applyBuildingGravity();
        resolvePendingAttacks();
        if (civilizationTick) civilizationStep();
        const elapsed = nowMs() - started;
        manager.perfTotal += elapsed;
        manager.perfSamples++;
        manager.perfMax = Math.max(manager.perfMax, elapsed);
        if (manager.perfSamples > 600) {
            manager.perfTotal *= 0.5;
            manager.perfSamples = Math.floor(manager.perfSamples * 0.5);
        }
    }

    root.HumanSociety = Object.freeze({
        config: C,
        registerResource: registerResource,
        registerWeapon: registerWeapon,
        registerEra: registerEra,
        registerTechnology: registerTechnology,
        damageActor: damageActor,
        damageStructure: damageStructure,
        recordIncident: recordIncident,
        atWar: atWar,
        addKnowledge: addKnowledge,
        setResearchFocus: setResearchFocus,
        setTechnologyState: setTechnologyState,
        moveResearchPriority: moveResearchPriority,
        setSettlementResources: setSettlementResources,
        getFactionSnapshot: getFactionSnapshot,
        getFactionChronicle: getFactionChronicle,
        getPeopleSnapshot: getPeopleSnapshot,
        getPersonSnapshot: getPersonSnapshot,
        getPersonHistory: getPersonHistory,
        getWarSnapshot: getWarSnapshot,
        getPeaceMode: getPeaceMode,
        setPeaceMode: setPeaceMode,
        declareWar: declareWar,
        setMapOverlay: setMapOverlay,
        getBuildingById: getBuildingById,
        getBuildingCoreAt: getBuildingCoreAt,
        getTreeAt: getTreeAt,
        fellTreeAt: fellTreeAt,
        buildingVisualAt: buildingVisualAt,
        destroyBuilding: destroyBuilding,
        territoryOwnerAt: territoryOwnerAt,
        openCivilizationPanel: openCivilizationPanel,
        openPeoplePanel: openPeoplePanel,
        closePeoplePanel: closePeoplePanel,
        focusPerson: focusPerson,
        setCommandPerson: setCommandPerson,
        cancelPersonCommand: cancelPersonCommand,
        issuePersonCommandAt: issuePersonCommandAt,
        getPersonCommandState: getPersonCommandState,
        setInteractionMode: setInteractionMode,
        getInteractionMode: getInteractionMode,
        showTutorial: showCivilizationTutorial,
        restartTutorial: restartCivilizationTutorial,
        onPaletteModeChanged: function (mode) { if (mode === "civilization" && !settings.humanSocietyTutorialComplete) showCivilizationTutorial(false); else if (mode === "laboratory") closeCivilizationTutorial(); },
        forceReindex: function () { rebuildIndexes(true); },
        getDebugSnapshot: debugSnapshot
    });

    runEveryTick(societyTick);
    if (typeof addPixelLifecycleListener === "function") addPixelLifecycleListener(handlePixelLifecycle);
    if (typeof renderMidPixel === "function") renderMidPixel(renderBuildingSprites);
    else if (typeof renderPostPixel === "function") renderPostPixel(renderBuildingSprites);
    if (typeof renderPostPixel === "function") {
        renderPostPixel(renderTerritoryHover);
        renderPostPixel(renderResourceOverlay);
        renderPostPixel(renderRangedProjectiles);
        renderPostPixel(renderPersonSpeech);
        renderPostPixel(renderPersonFocus);
        renderPostPixel(renderPersonCommand);
    }
    runAfterReset(resetManager);
    if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            root.addEventListener("load", installCivilizationUi);
            root.addEventListener("load", installPeopleObserverUi);
            root.addEventListener("load", installPersonCommandInput);
            root.addEventListener("load", function () { installCivilizationTutorial(); if (typeof root.setTimeout === "function") root.setTimeout(function () { showCivilizationTutorial(false); }, 500); });
        }
        else {
            installCivilizationUi();
            installPeopleObserverUi();
            installPersonCommandInput();
            installCivilizationTutorial();
            if (typeof root.setTimeout === "function") root.setTimeout(function () { showCivilizationTutorial(false); }, 500);
        }
    }
}(typeof globalThis !== "undefined" ? globalThis : window));
