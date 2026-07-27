"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const Core = require("../scripts/human_society_core.js");
const Data = require("../scripts/human_society_tech_data.js");

const EXPECTED_ERA_IDS = ["tribal", "stone", "agriculture", "bronze", "iron", "castle"];
const EXPECTED_VISION = [8, 8, 9, 10, 11, 12];
const EXPECTED_COSTS = [
    [20, 28],
    [35, 48],
    [55, 75],
    [80, 110],
    [115, 155],
    [160, 220]
];
const EXPECTED_COUNTS = {
    tribal: 7,
    stone: 6,
    agriculture: 6,
    bronze: 6,
    iron: 5,
    castle: 8
};
const EXPECTED_ADVANCE_REQUIREMENTS = {
    tribal: 5,
    stone: 5,
    agriculture: 5,
    bronze: 5,
    iron: 4,
    castle: 6
};
const EXPECTED_POPULATION_TARGETS = {
    tribal: 6,
    stone: 8,
    agriculture: 12,
    bronze: 16,
    iron: 20,
    castle: 24
};
const EXPECTED_JOB_WEIGHTS = {
    tribal: {food: 2, wood: 2, builder: 1, flex: 1},
    stone: {food: 2, wood: 2, miner: 2, builder: 1, artisan: 1},
    agriculture: {
        food: 4, wood: 2, miner: 1, builder: 1, forester: 1,
        artisan: 1, military: 1, flex: 1
    },
    bronze: {
        food: 4, wood: 2, miner: 3, builder: 2, forester: 1,
        artisan: 2, scholar: 1, military: 1
    },
    iron: {
        food: 5, wood: 2, miner: 4, builder: 2, forester: 1,
        artisan: 3, scholar: 1, military: 2
    },
    castle: {
        food: 6, wood: 2, miner: 4, builder: 2, forester: 2,
        artisan_trade: 3, scholar: 2, military: 3
    }
};
const EXPECTED_TECHS = {
    tribal: [
        ["organized_gathering", "production", 1, 20],
        ["controlled_fire", "production", 2, 28],
        ["simple_shelters", "construction", 1, 20],
        ["woodworking", "construction", 2, 28],
        ["clan_council", "society", 1, 20],
        ["oral_tradition", "society", 2, 28],
        ["war_clubs", "military", 1, 20]
    ],
    stone: [
        ["stone_knapping", "production", 1, 35],
        ["polished_axes", "production", 2, 48],
        ["quarrying", "construction", 2, 48],
        ["craft_specialization", "society", 1, 35],
        ["tally_marks", "society", 2, 48],
        ["palisade_defense", "military", 2, 48]
    ],
    agriculture: [
        ["food_preservation", "production", 1, 55],
        ["managed_forestry", "production", 2, 75],
        ["village_planning", "construction", 1, 55],
        ["militia", "society", 1, 55],
        ["bowmaking", "military", 1, 55],
        ["rattan_armor", "military", 2, 75]
    ],
    bronze: [
        ["copper_prospecting", "production", 1, 80],
        ["bronze_foundry", "construction", 2, 110],
        ["writing", "society", 1, 80],
        ["administration", "society", 2, 110],
        ["bronze_weapons", "military", 1, 80],
        ["shield_formation", "military", 2, 110]
    ],
    iron: [
        ["iron_prospecting", "production", 1, 115],
        ["iron_smelting", "production", 2, 155],
        ["stone_fortifications", "construction", 1, 115],
        ["iron_weapons", "military", 1, 115],
        ["iron_armor", "military", 2, 155]
    ],
    castle: [
        ["steelmaking", "production", 1, 160],
        ["supply_logistics", "society", 2, 220],
        ["castle_building", "construction", 1, 160],
        ["library", "society", 1, 160],
        ["carburizing_tempering", "production", 2, 220],
        ["crossbow", "military", 1, 160],
        ["steel_armor", "military", 2, 220],
        ["siege_engineering", "military", 2, 220]
    ]
};

const ALLOWED_MODIFIER_OPERATIONS = {
    carryCapacity: "add",
    harvestDurationMultiplier: "multiply",
    woodHarvestDurationMultiplier: "multiply",
    stoneHarvestDurationMultiplier: "multiply",
    foodHarvestDurationMultiplier: "multiply",
    buildDurationMultiplier: "multiply",
    roleWorkRateMultiplier: "multiply",
    knowledgeRateMultiplier: "multiply",
    milestoneKnowledgeMultiplier: "multiply",
    hutHousingBonus: "add",
    constructionSlots: "set",
    peacetimeWarriors: "set",
    wartimeWarriorRatio: "set",
    incomingDamageMultiplier: "multiply",
    oldTechCostMultiplier: "multiply",
    structureDamageMultiplier: "multiply"
};
const ALLOWED_UNLOCK_TARGETS = new Set(["building", "weapon", "armor", "role", "resource", "recipe"]);
const ALLOWED_FEATURES = new Set(["hearthHealing", "deliveryKnowledge", "treePlanting"]);

function assertJsonValue(value, location) {
    if (value === null) return;

    const valueType = typeof value;
    assert.notEqual(valueType, "undefined", `${location} must not contain undefined`);
    assert.notEqual(valueType, "function", `${location} must not contain functions`);
    assert.notEqual(valueType, "symbol", `${location} must not contain symbols`);
    assert.notEqual(valueType, "bigint", `${location} must not contain bigint`);

    if (valueType === "number") {
        assert.ok(Number.isFinite(value), `${location} must contain finite numbers`);
        return;
    }
    if (valueType !== "object") return;

    if (Array.isArray(value)) {
        value.forEach((item, index) => assertJsonValue(item, `${location}[${index}]`));
        return;
    }

    assert.equal(Object.getPrototypeOf(value), Object.prototype, `${location} must be a plain object`);
    Object.entries(value).forEach(([key, item]) => assertJsonValue(item, `${location}.${key}`));
}

function findCondition(technology, type, resource) {
    return technology.conditions.find((condition) =>
        condition.type === type && (resource === undefined || condition.resource === resource)
    );
}

function findEffect(technology, type, target, id) {
    return technology.effects.find((effect) =>
        effect.type === type && effect.target === target && effect.id === id
    );
}

function resourceConditions(technology) {
    return Object.fromEntries(technology.conditions
        .filter((condition) => condition.type === "resource_stock")
        .map((condition) => [condition.resource, condition.minimum]));
}

test("module exports JSON-friendly data in CommonJS and browser-global modes", () => {
    assertJsonValue(Data, "HumanSocietyTechData");
    assert.deepEqual(JSON.parse(JSON.stringify(Data)), Data);

    const source = fs.readFileSync(
        path.join(__dirname, "../scripts/human_society_tech_data.js"),
        "utf8"
    );
    const context = {};
    vm.createContext(context);
    vm.runInContext(source, context);

    assert.equal(context.HumanSocietyTechData.version, 1);
    assert.equal(context.HumanSocietyTechData.ERAS.length, 6);
    assert.equal(context.HumanSocietyTechData.TECHNOLOGIES.length, 38);
});

test("compact eras expose exact technology order and strict over-70-percent thresholds", () => {
    assert.deepEqual(Data.KNOWLEDGE_DOMAINS, ["production", "construction", "society", "military"]);
    assert.deepEqual(Data.DEFAULT_VISION, EXPECTED_VISION);
    assert.equal(Data.ERA_TECH_COUNT, 8);
    assert.equal(Data.ERA_ADVANCE_REQUIRED, 6);
    assert.deepEqual(Data.ERA_TECH_COUNTS, EXPECTED_COUNTS);
    assert.deepEqual(Data.ERA_ADVANCE_REQUIREMENTS, EXPECTED_ADVANCE_REQUIREMENTS);
    assert.deepEqual(Data.ERA_POPULATION_TARGETS, EXPECTED_POPULATION_TARGETS);
    assert.deepEqual(Data.ERA_JOB_WEIGHTS, EXPECTED_JOB_WEIGHTS);
    assert.deepEqual(Data.WOOD_SMELTING_RESERVE_BY_ERA, {
        tribal: 8,
        stone: 16,
        agriculture: 32,
        bronze: 48,
        iron: 64,
        castle: 96
    });
    assert.deepEqual(Data.ERAS.map((era) => era.id), EXPECTED_ERA_IDS);
    assert.equal(Data.TECHNOLOGIES.length, 38);
    assert.equal(JSON.stringify(Data.ERA_JOB_WEIGHTS).includes("industry"), false);

    const allIds = new Set();
    Data.ERAS.forEach((era, eraIndex) => {
        const expectedSpecs = EXPECTED_TECHS[era.id];
        const expectedIds = expectedSpecs.map(([id]) => id);
        const expectedCount = EXPECTED_COUNTS[era.id];
        const expectedRequired = EXPECTED_ADVANCE_REQUIREMENTS[era.id];

        assert.equal(era.index, eraIndex);
        assert.equal(era.vision, EXPECTED_VISION[eraIndex]);
        assert.deepEqual(era.costs, EXPECTED_COSTS[eraIndex]);
        assert.equal(era.technologyCount, expectedCount);
        assert.equal(era.requiredTechsToAdvance, expectedRequired);
        assert.deepEqual(era.advancement, {
            technologyCount: expectedCount,
            required: expectedRequired,
            ratio: expectedRequired / expectedCount
        });
        assert.ok(expectedRequired > expectedCount * 0.70);
        assert.ok(expectedRequired - 1 <= expectedCount * 0.70);
        assert.equal(era.populationTarget, EXPECTED_POPULATION_TARGETS[era.id]);
        assert.deepEqual(era.jobWeights, EXPECTED_JOB_WEIGHTS[era.id]);
        assert.equal(
            Object.values(era.jobWeights).reduce((sum, weight) => sum + weight, 0),
            era.populationTarget
        );
        assert.deepEqual(era.techIds, expectedIds);

        const technologies = Data.TECHNOLOGIES.filter((technology) => technology.era === era.id);
        assert.deepEqual(technologies.map((technology) => technology.id), expectedIds);
        technologies.forEach((technology, index) => {
            const [id, domain, tier, cost] = expectedSpecs[index];
            assert.equal(technology.id, id);
            assert.equal(technology.domain, domain);
            assert.equal(technology.tier, tier);
            assert.equal(technology.cost, cost);
            assert.ok(Object.hasOwn(technology, "domain"));
            assert.ok(Object.hasOwn(technology, "tier"));
            assert.ok(Object.hasOwn(technology, "cost"));
            assert.match(technology.id, /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
            assert.equal(allIds.has(technology.id), false, `duplicate technology id ${technology.id}`);
            allIds.add(technology.id);
            assert.equal(technology.eraIndex, eraIndex);
            assert.equal(technology.peaceful, technology.domain !== "military");
            assert.equal(technology.prerequisiteMode, "all");
            assert.ok(Array.isArray(technology.prerequisites));
            assert.equal(technology.conditionMode, "all");
            assert.ok(Array.isArray(technology.conditions) && technology.conditions.length > 0);
            assert.ok(Array.isArray(technology.effects) && technology.effects.length > 0);
        });
    });
});

test("technology prerequisites exist, are earlier in the tree, and are acyclic", () => {
    const technologyById = Object.fromEntries(Data.TECHNOLOGIES.map((technology) => [technology.id, technology]));
    const positionById = Object.fromEntries(Data.TECHNOLOGIES.map((technology, index) => [technology.id, index]));
    const visiting = new Set();
    const visited = new Set();

    function visit(technology) {
        if (visited.has(technology.id)) return;
        assert.equal(visiting.has(technology.id), false, `cycle at ${technology.id}`);
        visiting.add(technology.id);
        technology.prerequisites.forEach((prerequisiteId) => visit(technologyById[prerequisiteId]));
        visiting.delete(technology.id);
        visited.add(technology.id);
    }

    Data.TECHNOLOGIES.forEach((technology) => {
        technology.prerequisites.forEach((prerequisiteId) => {
            assert.ok(technologyById[prerequisiteId], `${technology.id} has missing prerequisite ${prerequisiteId}`);
            assert.ok(
                positionById[prerequisiteId] < positionById[technology.id],
                `${technology.id} must only depend on an earlier technology`
            );
        });
        visit(technology);
    });
    assert.equal(visited.size, 38);
});

test("all effects use the runtime's canonical technology-effect contract", () => {
    assert.equal(Core.validateTechnologyEffects(Data.TECHNOLOGIES), true);

    Data.TECHNOLOGIES.forEach((technology) => {
        technology.effects.forEach((effect, effectIndex) => {
            const location = `${technology.id}.effects[${effectIndex}]`;
            if (effect.type === "unlock") {
                assert.deepEqual(Object.keys(effect).sort(), ["id", "target", "type"]);
                assert.ok(ALLOWED_UNLOCK_TARGETS.has(effect.target), `${location} has invalid target ${effect.target}`);
                assert.match(effect.id, /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
                return;
            }
            if (effect.type === "modifier") {
                assert.deepEqual(Object.keys(effect).sort(), ["operation", "stat", "type", "value"]);
                assert.equal(effect.operation, ALLOWED_MODIFIER_OPERATIONS[effect.stat], `${location} has invalid operation`);
                assert.ok(Number.isFinite(effect.value));
                return;
            }
            if (effect.type === "set") {
                assert.deepEqual(Object.keys(effect).sort(), ["stat", "type", "value"]);
                assert.equal(ALLOWED_MODIFIER_OPERATIONS[effect.stat], "set", `${location} has invalid set stat`);
                assert.ok(Number.isFinite(effect.value));
                return;
            }
            if (effect.type === "enable") {
                assert.deepEqual(Object.keys(effect).sort(), ["feature", "type"]);
                assert.ok(ALLOWED_FEATURES.has(effect.feature), `${location} has invalid feature ${effect.feature}`);
                return;
            }
            assert.fail(`${location} has invalid effect type ${effect.type}`);
        });
    });
});

test("renamed technologies and era equipment unlocks match the compact design", () => {
    const technologyById = Object.fromEntries(Data.TECHNOLOGIES.map((technology) => [technology.id, technology]));

    assert.equal(technologyById.polished_axes.name, "Polished Stone Tools");
    assert.equal(technologyById.bowmaking.name, "Silk String Method");
    assert.equal(technologyById.bronze_weapons.name, "Piece-Mold Casting");
    assert.equal(technologyById.iron_weapons.name, "Blacksmith Workshop");

    const expectedWeaponTechs = {
        war_clubs: {conditions: {wood: 1}, unlocks: ["club"]},
        polished_axes: {conditions: {wood: 2, stone: 1}, unlocks: ["stone_spear"]},
        bowmaking: {conditions: {wood: 10}, unlocks: ["bow"]},
        bronze_weapons: {conditions: {wood: 2, bronze: 2}, unlocks: ["bronze_sword", "bronze_spear"]},
        iron_weapons: {conditions: {wood: 2, iron: 2}, unlocks: ["iron_sword", "iron_spear"]},
        carburizing_tempering: {
            conditions: {wood: 1, bronze: 1, iron: 1, steel: 2},
            unlocks: ["steel_blade", "steel_spear"]
        },
        crossbow: {conditions: {wood: 10, steel: 1}, unlocks: ["crossbow"]}
    };

    Object.entries(expectedWeaponTechs).forEach(([techId, expected]) => {
        const technology = technologyById[techId];
        assert.deepEqual(resourceConditions(technology), expected.conditions);
        assert.deepEqual(
            technology.effects
                .filter((effect) => effect.type === "unlock" && effect.target === "weapon")
                .map((effect) => effect.id),
            expected.unlocks
        );
    });

    assert.ok(findEffect(technologyById.rattan_armor, "unlock", "armor", "rattan"));
    assert.ok(findEffect(technologyById.iron_armor, "unlock", "armor", "iron"));
    assert.ok(findEffect(technologyById.steel_armor, "unlock", "armor", "steel"));
    assert.deepEqual(resourceConditions(technologyById.rattan_armor), {wood: 4});
    assert.deepEqual(resourceConditions(technologyById.iron_armor), {iron: 4});
    assert.deepEqual(resourceConditions(technologyById.steel_armor), {steel: 4});
});

test("bronze, iron, and steel progression uses the three workshop mapping", () => {
    const technologyById = Object.fromEntries(Data.TECHNOLOGIES.map((technology) => [technology.id, technology]));

    assert.deepEqual(technologyById.bronze_foundry.conditions, [
        {type: "resource_stock", resource: "copper", minimum: 1, hard: true},
        {type: "heat_available", minimum: 1, hard: true}
    ]);
    assert.ok(findEffect(technologyById.bronze_foundry, "unlock", "building", "foundry"));
    assert.ok(findEffect(technologyById.bronze_foundry, "unlock", "recipe", "bronze"));

    assert.deepEqual(technologyById.iron_smelting.conditions, [
        {type: "resource_stock", resource: "raw_iron", minimum: 1, hard: true},
        {type: "resource_stock", resource: "bronze", minimum: 1, hard: true},
        {type: "heat_available", minimum: 2, hard: true}
    ]);
    assert.ok(findEffect(technologyById.iron_smelting, "unlock", "building", "kiln"));
    assert.ok(findEffect(technologyById.iron_smelting, "unlock", "recipe", "iron"));

    assert.deepEqual(technologyById.steelmaking.conditions, [
        {type: "resource_stock", resource: "iron", minimum: 2, hard: true},
        {type: "resource_stock", resource: "bronze", minimum: 1, hard: true},
        {type: "heat_available", minimum: 4, hard: true}
    ]);
    assert.ok(findEffect(technologyById.steelmaking, "unlock", "building", "forge"));
    assert.ok(findEffect(technologyById.steelmaking, "unlock", "recipe", "steel"));

    assert.deepEqual(technologyById.food_preservation.conditions, [
        {type: "resource_stock", resource: "food", minimum: 12, hard: false}
    ]);
    assert.deepEqual(technologyById.food_preservation.effects, [
        {type: "modifier", stat: "foodHarvestDurationMultiplier", operation: "multiply", value: 0.85}
    ]);
    assert.deepEqual(technologyById.supply_logistics.conditions, [
        {type: "milestone", id: "resourceDeliveries", minimum: 12, hard: false}
    ]);
    assert.deepEqual(technologyById.supply_logistics.effects, [
        {type: "modifier", stat: "carryCapacity", operation: "add", value: 2}
    ]);
    assert.deepEqual(
        technologyById.siege_engineering.effects.find((effect) => effect.stat === "structureDamageMultiplier"),
        {type: "modifier", stat: "structureDamageMultiplier", operation: "multiply", value: 1.5}
    );
});

test("wood heat, crafting recipes, and ranged weapon parameters remain exact", () => {
    assert.deepEqual(Data.FUELS, {wood: 1});
    assert.deepEqual(Data.RECIPES, {
        bronze: {
            id: "bronze",
            inputs: [{resource: "copper", amount: 1}],
            heat: 1,
            outputs: [{resource: "bronze", amount: 1}]
        },
        iron: {
            id: "iron",
            inputs: [{resource: "raw_iron", amount: 1}, {resource: "bronze", amount: 1}],
            heat: 2,
            outputs: [{resource: "iron", amount: 1}]
        },
        steel: {
            id: "steel",
            inputs: [{resource: "iron", amount: 2}, {resource: "bronze", amount: 1}],
            heat: 4,
            outputs: [{resource: "steel", amount: 1}]
        }
    });
    assert.deepEqual(Data.RANGED_WEAPONS.bow, {
        id: "bow",
        unlockEra: "agriculture",
        range: 25,
        damage: 15
    });
    assert.deepEqual(Data.RANGED_WEAPONS.crossbow, {
        id: "crossbow",
        unlockEra: "castle",
        range: 30,
        damage: 40
    });
});

test("obsolete technologies, materials, trade targets, and farming effects are absent", () => {
    const obsoleteIds = [
        "hunting_cooperation", "artisan_shed", "stone_spearheads", "seed_selection",
        "granary", "irrigation", "barter", "tin_prospecting", "charcoal_kiln",
        "forge", "coinage", "codified_law", "crop_rotation", "siege_workshop",
        "guild_market"
    ];
    const technologyIds = new Set(Data.TECHNOLOGIES.map((technology) => technology.id));
    obsoleteIds.forEach((id) => assert.equal(technologyIds.has(id), false, `${id} must be removed`));

    const allConditions = Data.TECHNOLOGIES.flatMap((technology) => technology.conditions);
    const allEffects = Data.TECHNOLOGIES.flatMap((technology) => technology.effects);
    assert.equal(allConditions.some((condition) => condition.resource === "tin" || condition.resource === "charcoal"), false);
    assert.equal(allEffects.some((effect) => effect.target === "trade" || effect.target === "foodSource"), false);
    assert.equal(allEffects.some((effect) => /^farm/i.test(effect.stat || "")), false);
    assert.equal(allEffects.some((effect) => effect.target === "building" && effect.id === "farm"), false);
    assert.equal(Object.hasOwn(Data.RECIPES, "charcoal"), false);
    assert.equal(Object.hasOwn(Data.FUELS, "charcoal"), false);
});
