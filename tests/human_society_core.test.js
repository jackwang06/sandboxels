"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../scripts/human_society_core.js");

test("chooseFaction selects the nearest faction within the join radius", () => {
    const candidates = [
        { factionId: "far", x: 20, y: 0 },
        { factionId: "near", pixel: { x: 4, y: 3 } },
        { factionId: "outside", x: 50, y: 50 }
    ];

    assert.equal(Core.chooseFaction(candidates, 0, 0, 24), "near");
    assert.equal(Core.chooseFaction(candidates, 100, 100, 24), null);
    assert.equal(Core.distance(0, 0, 3, 4), 5);
});

test("hostility incidents clamp and update attack time", () => {
    const record = { hostility: 70 };
    Core.applyHostility(record, { type: "hit", tick: 10 });
    assert.equal(record.hostility, 90);
    assert.equal(record.lastAttackTick, 10);

    Core.applyHostility(record, { type: "kill", tick: 11 });
    assert.equal(record.hostility, 100);
});

test("hostility bookkeeping never declares war or ends an existing permanent war", () => {
    const record = { hostility: 92, atWar: false };

    Core.stepDiplomacy(record, { tick: 0, territoryOverlap: true });
    Core.stepDiplomacy(record, { tick: 30, territoryOverlap: true });
    assert.equal(record.hostility, 96);
    Core.stepDiplomacy(record, { tick: 60, territoryOverlap: true });
    assert.equal(record.hostility, 100);
    assert.equal(record.atWar, false);

    record.atWar = true;
    record.warStartTick = 60;
    record.hostility = 26;
    record.lastAttackTick = 60;
    Core.stepDiplomacy(record, { tick: 60, territoryOverlap: false });
    Core.stepDiplomacy(record, { tick: 120, territoryOverlap: false });
    assert.equal(record.hostility, 25);
    assert.equal(record.atWar, true);

    Core.stepDiplomacy(record, { tick: 960, territoryOverlap: false });
    assert.equal(record.hostility, 11);
    assert.equal(record.atWar, true);
    assert.equal(record.warEndTick, undefined);
});

test("surrender requires only a sustained three-to-one power imbalance", () => {
    const record = {
        atWar: true,
        warStartTick: 0,
        factionA: "red",
        factionB: "blue"
    };

    Core.stepSurrender(record, {
        tick: 120,
        powerA: 30,
        powerB: 10
    });
    Core.stepSurrender(record, {
        tick: 299,
        powerA: 30,
        powerB: 10
    });
    assert.equal(record.powerImbalanceTicks, 179);
    assert.equal(record.surrendered, undefined);

    Core.stepSurrender(record, {
        tick: 300,
        powerA: 30,
        powerB: 10
    });
    assert.equal(record.surrendered, true);
    assert.equal(record.victorFactionId, "red");
    assert.equal(record.loserFactionId, "blue");
});

test("surrender imbalance timer resets whenever the ratio falls below three-to-one", () => {
    const record = { atWar: true, warStartTick: 0, factionA: "a", factionB: "b" };

    Core.stepSurrender(record, { tick: 0, powerA: 4, powerB: 1 });
    Core.stepSurrender(record, { tick: 100, powerA: 4, powerB: 1 });
    Core.stepSurrender(record, { tick: 101, powerA: 2, powerB: 1 });
    assert.equal(record.powerImbalanceTicks, 0);

    Core.stepSurrender(record, { tick: 120, powerA: 4, powerB: 1 });
    Core.stepSurrender(record, { tick: 300, powerA: 4, powerB: 1 });
    assert.equal(record.surrendered, true);
});

test("population creation depends only on food and the settlement's ideal population", () => {
    const settlement = { resources: { food: 2 }, housing: 5, lastBirthTick: 0 };
    const stats = { population: 4, targetPopulation: 6, healthyAdults: 0, atWar: false };

    assert.equal(Core.canReproduce(settlement, stats, 300, 119), true);
    assert.equal(Core.canReproduce(settlement, stats, 1, 9999), true);
    assert.equal(Core.canReproduce(settlement, { ...stats, population: 6 }, 300, 119), false);
    assert.equal(Core.canReproduce(settlement, { ...stats, atWar: true }, 300, 119), true);
    assert.equal(Core.canReproduce({ ...settlement, resources: { food: 1 } }, stats, 300, 119), false);
});

test("construction refund returns half of only the unplaced materials", () => {
    assert.deepEqual(
        Core.constructionRefund({ wood: 12, stone: 8 }, 0.25),
        { wood: 4, stone: 3 }
    );
    assert.deepEqual(Core.constructionRefund({ wood: 12 }, 1), { wood: 0 });
});

test("weapon catalog exposes the complete canonical loadout and legacy aliases", () => {
    const expected = {
        fists: {range: 1, damage: 5, cost: {}},
        club: {range: 2, damage: 10, cost: {wood: 1}},
        stone_spear: {range: 3, damage: 20, cost: {wood: 2, stone: 1}},
        bow: {range: 25, damage: 15, cost: {wood: 10}, ranged: true},
        bronze_spear: {range: 3, damage: 25, cost: {wood: 2, bronze: 1}},
        bronze_sword: {range: 2, damage: 35, cost: {wood: 1, bronze: 2}},
        iron_spear: {range: 3, damage: 35, cost: {wood: 2, iron: 1}},
        iron_sword: {range: 2, damage: 50, cost: {wood: 1, iron: 2}},
        steel_blade: {
            range: 2,
            damage: 100,
            cost: {wood: 1, bronze: 1, iron: 1, steel: 2}
        },
        steel_spear: {
            range: 4,
            damage: 70,
            cost: {wood: 2, bronze: 1, iron: 1, steel: 1}
        },
        crossbow: {range: 30, damage: 40, cost: {wood: 10, steel: 1}, ranged: true}
    };

    Object.entries(expected).forEach(([id, stats]) => {
        const weapon = Core.WEAPONS[id];
        assert.equal(weapon.id, id);
        assert.equal(weapon.range, stats.range);
        assert.equal(weapon.damage, stats.damage);
        assert.equal(weapon.hitChance, 0.5);
        assert.equal(weapon.knockback, 1);
        assert.equal(weapon.ranged === true, stats.ranged === true);
        assert.deepEqual(weapon.cost, stats.cost);
    });

    assert.strictEqual(Core.WEAPONS.fist, Core.WEAPONS.fists);
    assert.strictEqual(Core.WEAPONS.spear, Core.WEAPONS.stone_spear);
    assert.equal(Core.WEAPONS.spear.id, "stone_spear");
});

test("armor catalog exposes immutable HP bonuses and material costs", () => {
    assert.deepEqual(Object.keys(Core.ARMORS), ["none", "rattan", "iron", "steel"]);
    assert.deepEqual(Core.ARMORS, {
        none: {id: "none", hpBonus: 0, cost: {}},
        rattan: {id: "rattan", hpBonus: 100, cost: {wood: 4}},
        iron: {id: "iron", hpBonus: 220, cost: {iron: 4}},
        steel: {id: "steel", hpBonus: 420, cost: {steel: 4}}
    });
    assert.equal(Object.isFrozen(Core.ARMORS), true);
    Object.values(Core.ARMORS).forEach((armor) => {
        assert.equal(Object.isFrozen(armor), true);
        assert.equal(Object.isFrozen(armor.cost), true);
    });
});

test("armorFor resolves ids and descriptors with a safe unarmored fallback", () => {
    assert.strictEqual(Core.armorFor("rattan"), Core.ARMORS.rattan);
    assert.strictEqual(Core.armorFor({armor: "iron"}), Core.ARMORS.iron);
    assert.strictEqual(Core.armorFor({armor: {id: "steel"}}), Core.ARMORS.steel);
    assert.strictEqual(Core.armorFor({id: "rattan"}), Core.ARMORS.rattan);
    assert.strictEqual(Core.armorFor({armor: {id: "unknown", hpBonus: 999}}), Core.ARMORS.none);
    assert.strictEqual(Core.armorFor({armor: "unknown"}), Core.ARMORS.none);
    assert.strictEqual(Core.armorFor({}), Core.ARMORS.none);
    assert.strictEqual(Core.armorFor(null), Core.ARMORS.none);
});

test("attack intents aggregate same-tick damage and allow mutual kills", () => {
    const actors = new Map([
        ["red", {
            id: "red", factionId: "r", x: 0, y: 0, hp: 0.8,
            weapon: "fist", attackReadyTick: 0
        }],
        ["blue", {
            id: "blue", factionId: "b", x: 1, y: 0, hp: 0.8,
            weapon: "fist", attackReadyTick: 0
        }]
    ]);
    const outcome = Core.resolveAttackIntents([
        { attackerId: "red", targetId: "blue", tick: 10 },
        { attackerId: "blue", targetId: "red", tick: 10 }
    ], actors, () => 0);

    assert.equal(actors.get("red").hp, 0);
    assert.equal(actors.get("blue").hp, 0);
    assert.deepEqual(new Set(outcome.deaths), new Set(["red", "blue"]));
    assert.equal(outcome.results.every((result) => result.valid), true);
    assert.equal(outcome.results.every((result) => result.damage === 5), true);
    assert.deepEqual(outcome.results[0].knockback, {dx: 1, dy: 0});
    assert.deepEqual(outcome.results[1].knockback, {dx: -1, dy: 0});
    assert.equal(actors.get("red").attackReadyTick, 10);
});

test("attack validation allows child targets and attackers, ignores cooldowns, and rejects allies or range", () => {
    const actors = {
        attacker: {
            id: "attacker", factionId: "a", x: 0, y: 0, hp: 100,
            weapon: "spear", attackReadyTick: 20
        },
        ally: { id: "ally", factionId: "a", x: 1, y: 0, hp: 100 },
        child: { id: "child", factionId: "b", x: 1, y: 0, hp: 100, isChild: true },
        distant: { id: "distant", factionId: "b", x: 4, y: 0, hp: 100 }
    };
    const outcome = Core.resolveAttackIntents([
        { attackerId: "attacker", targetId: "ally", tick: 20 },
        { attackerId: "attacker", targetId: "child", tick: 19 },
        { attackerId: "attacker", targetId: "distant", tick: 20 },
        { attackerId: "child", targetId: "attacker", tick: 21 }
    ], actors, () => 0);

    assert.equal(outcome.results[0].valid, true);
    assert.equal(outcome.results[0].hit, true);
    assert.equal(outcome.results[1].reason, "same_faction");
    assert.equal(outcome.results[2].reason, "out_of_range");
    assert.equal(outcome.results[3].valid, true);
    assert.equal(outcome.results[3].hit, true);
    assert.equal(outcome.results[0].weapon, "stone_spear");
    assert.equal(actors.child.hp, 80);
    assert.equal(actors.attacker.hp, 95);
    assert.equal(actors.distant.hp, 100);
});

test("weapon ranges are centered Chebyshev squares driven by descriptor range", () => {
    const actors = {
        archer: {id: "archer", factionId: "a", x: 10, y: 10, hp: 100, weapon: "bow"},
        edge: {id: "edge", factionId: "b", x: -15, y: 35, hp: 100},
        outside: {id: "outside", factionId: "b", x: 36, y: 10, hp: 100},
        clubber: {
            id: "clubber", factionId: "a", x: 0, y: 0, hp: 100, weapon: "club", dir: 1
        },
        behindDiagonal: {id: "behindDiagonal", factionId: "b", x: -2, y: 2, hp: 100}
    };
    const outcome = Core.resolveAttackIntents([
        {attackerId: "archer", targetId: "edge", tick: 1},
        {attackerId: "archer", targetId: "outside", tick: 2},
        {attackerId: "clubber", targetId: "behindDiagonal", tick: 3}
    ], actors, () => 0);

    assert.equal(outcome.results[0].valid, true);
    assert.equal(outcome.results[0].damage, 15);
    assert.equal(outcome.results[1].reason, "out_of_range");
    assert.equal(outcome.results[2].valid, true);
    assert.equal(outcome.results[2].damage, 10);
    assert.deepEqual(outcome.results[2].knockback, {dx: -1, dy: 1});
});

test("attack resolution uses a fixed fifty-percent threshold and full weapon damage", () => {
    const missActors = {
        attacker: {id: "attacker", factionId: "a", x: 0, y: 0, hp: 100, weapon: "steel_blade"},
        target: {id: "target", factionId: "b", x: 2, y: 2, hp: 150}
    };
    const miss = Core.resolveAttackIntents([
        {attackerId: "attacker", targetId: "target", tick: 1}
    ], missActors, () => 0.5);
    assert.equal(miss.results[0].hit, false);
    assert.equal(miss.results[0].damage, 0);
    assert.equal(missActors.target.hp, 150);

    const hit = Core.resolveAttackIntents([
        {attackerId: "attacker", targetId: "target", tick: 2}
    ], missActors, () => 0.499999);
    assert.equal(hit.results[0].hit, true);
    assert.equal(hit.results[0].damage, 100);
    assert.equal(missActors.target.hp, 50);
    assert.deepEqual(hit.results[0].knockback, {dx: 1, dy: 1});
});

test("military power uses actual weapon damage with health and role multipliers", () => {
    const power = Core.computeMilitaryPower([
        {hp: 100, maxHp: 100, role: "warrior", weapon: "steel_blade"},
        {hp: 50, maxHp: 100, role: "guard", weapon: "bow"},
        {hp: 25, maxHp: 100, role: "worker", weapon: {id: "custom", damage: 12, range: 1}},
        {hp: 100, maxHp: 100, role: "warrior", weapon: "iron_sword", dead: true},
        {hp: 100, maxHp: 100, role: "warrior", weapon: "crossbow", isChild: true}
    ]);

    assert.equal(power, 136.25);
});

test("military power scores armor HP against base HP without capping its benefit", () => {
    assert.equal(Core.computeMilitaryPower([
        {hp: 100, maxHp: 100, weapon: "fists"}
    ]), 5);
    assert.equal(Core.computeMilitaryPower([
        {hp: 200, maxHp: 200, baseMaxHp: 100, armor: "rattan", weapon: "fists"}
    ]), 10);
    assert.equal(Core.computeMilitaryPower([
        {hp: 160, maxHp: 320, armor: {id: "iron"}, weapon: "fists"}
    ]), 8);
    assert.equal(Core.computeMilitaryPower([
        {hp: 999, maxHp: 200, baseMaxHp: 100, armor: "rattan", weapon: "fists"}
    ]), 10, "current HP is capped at maxHp before comparing it with base HP");
    assert.equal(Core.computeMilitaryPower([
        {hp: 200, baseMaxHp: 100, armor: "rattan", weapon: "fists"},
        {hp: 200, maxHp: 200, baseMaxHp: 100, armor: "rattan", weapon: "fists", dead: true},
        {hp: 320, maxHp: 320, baseMaxHp: 100, armor: "iron", weapon: "fists", isChild: true}
    ]), 10);
});

test("technology effects compile all supported capabilities from a technology object", () => {
    const technology = {
        id: "complete-example",
        effects: [
            {type: "unlock", target: "building", id: "hut"},
            {type: "unlock", target: "weapon", id: "bow"},
            {type: "unlock", target: "armor", id: "rattan"},
            {type: "unlock", target: "role", id: "farmer"},
            {type: "unlock", target: "resource", id: "stone"},
            {type: "unlock", target: "recipe", id: "bronze"},
            {type: "modifier", stat: "carryCapacity", operation: "add", value: 2},
            {
                type: "modifier",
                stat: "harvestDurationMultiplier",
                operation: "multiply",
                value: 0.8
            },
            {type: "set", stat: "constructionSlots", value: 2},
            {type: "enable", feature: "hearthHealing"},
            {type: "enable", feature: "deliveryKnowledge"},
            {type: "enable", feature: "treePlanting"}
        ]
    };

    assert.deepEqual(Core.compileTechnologyEffects(technology), {
        unlocks: {
            building: ["hut"],
            weapon: ["bow"],
            armor: ["rattan"],
            role: ["farmer"],
            resource: ["stone"],
            recipe: ["bronze"]
        },
        modifiers: {
            carryCapacity: {operation: "add", value: 2},
            harvestDurationMultiplier: {operation: "multiply", value: 0.8},
            constructionSlots: {operation: "set", value: 2}
        },
        features: ["hearthHealing", "deliveryKnowledge", "treePlanting"]
    });
    assert.equal(Core.validateTechnologyEffects(technology.effects), true);
});

test("technology effect compilation deduplicates and combines effects deterministically", () => {
    const effects = [
        {type: "unlock", target: "building", id: "hut"},
        {type: "unlock", target: "building", id: "hut"},
        {type: "unlock", target: "weapon", id: "bow"},
        {type: "modifier", stat: "carryCapacity", operation: "add", value: 2},
        {type: "modifier", stat: "carryCapacity", operation: "add", value: -1},
        {
            type: "modifier",
            stat: "incomingDamageMultiplier",
            operation: "multiply",
            value: 0.8
        },
        {
            type: "modifier",
            stat: "incomingDamageMultiplier",
            operation: "multiply",
            value: 0.5
        },
        {type: "set", stat: "peacetimeWarriors", value: 2},
        {type: "set", stat: "peacetimeWarriors", value: 2},
        {type: "enable", feature: "treePlanting"},
        {type: "enable", feature: "treePlanting"}
    ];
    const capabilities = Core.compileTechnologyEffects(effects);

    assert.deepEqual(capabilities.unlocks.building, ["hut"]);
    assert.deepEqual(capabilities.unlocks.weapon, ["bow"]);
    assert.deepEqual(capabilities.modifiers, {
        carryCapacity: {operation: "add", value: 1},
        incomingDamageMultiplier: {operation: "multiply", value: 0.4},
        peacetimeWarriors: {operation: "set", value: 2}
    });
    assert.deepEqual(capabilities.features, ["treePlanting"]);
    assert.throws(() => Core.compileTechnologyEffects([
        {type: "set", stat: "constructionSlots", value: 1},
        {type: "set", stat: "constructionSlots", value: 2}
    ]), /Conflicting set values/);
});

test("resource yield modifiers add across technologies without changing harvest speed", () => {
    const capabilities = Core.compileTechnologyEffects([
        {type: "modifier", stat: "foodYieldBonus", operation: "add", value: 0.25},
        {type: "modifier", stat: "foodYieldBonus", operation: "add", value: 0.75},
        {type: "modifier", stat: "woodYieldBonus", operation: "add", value: 2},
        {type: "modifier", stat: "stoneYieldBonus", operation: "add", value: 1},
        {type: "modifier", stat: "copperYieldBonus", operation: "add", value: 1},
        {type: "modifier", stat: "rawIronYieldBonus", operation: "add", value: 1}
    ]);

    assert.deepEqual(capabilities.modifiers, {
        foodYieldBonus: {operation: "add", value: 1},
        woodYieldBonus: {operation: "add", value: 2},
        stoneYieldBonus: {operation: "add", value: 1},
        copperYieldBonus: {operation: "add", value: 1},
        rawIronYieldBonus: {operation: "add", value: 1}
    });
    assert.equal(capabilities.modifiers.harvestDurationMultiplier, undefined);
});

test("legacy technology modifier aliases compile to canonical runtime fields", () => {
    const capabilities = Core.compileTechnologyEffects([
        {type: "modifier", stat: "harvestSpeed", operation: "multiply", value: 1.25},
        {type: "modifier", stat: "woodHarvestSpeed", operation: "multiply", value: 2},
        {type: "modifier", stat: "stoneHarvestSpeed", operation: "multiply", value: 2},
        {type: "modifier", stat: "stoneYield", operation: "multiply", value: 4},
        {type: "modifier", stat: "buildSpeed", operation: "multiply", value: 5},
        {type: "modifier", stat: "roleWorkSpeed", operation: "multiply", value: 1.2},
        {type: "modifier", stat: "knowledgeGain", operation: "multiply", value: 1.1},
        {type: "modifier", stat: "milestoneKnowledge", operation: "multiply", value: 1.25},
        {type: "modifier", stat: "hutHousing", operation: "add", value: 2},
        {type: "modifier", stat: "incomingDamage", operation: "multiply", value: 0.85},
        {type: "modifier", stat: "structureDamage", operation: "multiply", value: 1.5},
        {type: "set", stat: "oldTechDiscount", value: 0.25}
    ]);

    assert.deepEqual(capabilities.modifiers, {
        harvestDurationMultiplier: {operation: "multiply", value: 0.8},
        woodHarvestDurationMultiplier: {operation: "multiply", value: 0.5},
        stoneHarvestDurationMultiplier: {operation: "multiply", value: 0.125},
        buildDurationMultiplier: {operation: "multiply", value: 0.2},
        roleWorkRateMultiplier: {operation: "multiply", value: 1.2},
        knowledgeRateMultiplier: {operation: "multiply", value: 1.1},
        milestoneKnowledgeMultiplier: {operation: "multiply", value: 1.25},
        hutHousingBonus: {operation: "add", value: 2},
        incomingDamageMultiplier: {operation: "multiply", value: 0.85},
        structureDamageMultiplier: {operation: "multiply", value: 1.5},
        oldTechCostMultiplier: {operation: "multiply", value: 0.75}
    });
});

test("technology effect compiler rejects unsupported or malformed effects", () => {
    const invalidEffects = [
        [{type: "mystery"}, /Unknown technology effect type/],
        [{type: "unlock", target: "trade", id: "basic"}, /Unknown technology unlock target/],
        [{type: "unlock", target: "weapon", id: "  "}, /unlock id must be a non-empty string/],
        [{type: "modifier", stat: "farmPlots", operation: "add", value: 2}, /Unknown technology modifier stat/],
        [{type: "modifier", stat: "carryCapacity", operation: "multiply", value: 2}, /Invalid operation/],
        [{type: "modifier", stat: "carryCapacity", operation: "add", value: Infinity}, /value must be finite/],
        [{type: "enable", feature: "bronzeAlloying"}, /Unknown technology feature/]
    ];

    invalidEffects.forEach(([effect, error]) => {
        assert.throws(() => Core.compileTechnologyEffects(effect), error);
        assert.throws(() => Core.validateTechnologyEffects([effect]), error);
    });
});

test("technology effect compilation does not mutate source effects or technology objects", () => {
    const technology = {
        id: "immutable-source",
        effects: [
            {type: "unlock", target: "weapon", id: " bow "},
            {type: "modifier", stat: "harvestSpeed", operation: "multiply", value: 2},
            {type: "enable", feature: "treePlanting"}
        ]
    };
    const before = JSON.parse(JSON.stringify(technology));

    Core.compileTechnologyEffects(technology);
    assert.deepEqual(technology, before);

    const technologies = [technology, {
        id: "second",
        effects: [{type: "unlock", target: "armor", id: "rattan"}]
    }];
    const combined = Core.compileTechnologyEffects(technologies);
    assert.deepEqual(combined.unlocks.weapon, ["bow"]);
    assert.deepEqual(combined.unlocks.armor, ["rattan"]);
});

test("life constants and lifespan rolls use an inclusive uniform 50-60 year range", () => {
    assert.equal(Core.TICKS_PER_YEAR, 240);
    assert.equal(Core.ADULT_AGE_YEARS, 0);
    assert.equal(Core.LIFESPAN_MIN_YEARS, 50);
    assert.equal(Core.LIFESPAN_MAX_YEARS, 60);
    assert.equal(Core.CONFIG.TICKS_PER_YEAR, 240);
    assert.equal(Core.randomLifespanYears(() => 0), 50);
    assert.equal(Core.randomLifespanYears(() => 1), 60);

    const allRolls = Array.from({length: 11}, (_, index) =>
        Core.randomLifespanYears(() => (index + 0.5) / 11)
    );
    assert.deepEqual(allRolls, [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
    assert.equal(allRolls.reduce((sum, value) => sum + value, 0) / allRolls.length, 55);
});

test("createLifeHistory gives every newly created worker age zero", () => {
    const adult = Core.createLifeHistory({currentTick: 4800, isAdult: true}, () => 0);
    assert.deepEqual(adult, {
        birthTick: 4800,
        lifespanYears: 50,
        naturalDeathTick: 16800
    });

    const child = Core.createLifeHistory({currentTick: 4800}, () => 1);
    assert.deepEqual(child, {
        birthTick: 4800,
        lifespanYears: 60,
        naturalDeathTick: 19200
    });
});

test("createLifeHistory preserves saved absolute ticks and derives missing lifespan", () => {
    const saved = Core.createLifeHistory({
        currentTick: 2000,
        isAdult: true,
        birthTick: 0,
        naturalDeathTick: 13200
    }, () => {
        throw new Error("a saved death tick must not reroll lifespan");
    });
    assert.deepEqual(saved, {
        birthTick: 0,
        lifespanYears: 55,
        naturalDeathTick: 13200
    });
});

test("age and natural-death helpers use absolute simulation ticks", () => {
    const history = {birthTick: 240, naturalDeathTick: 12240};
    assert.equal(Core.ageInYears(history, 3840), 15);
    assert.equal(Core.ageYears(240, 3840), 15);
    assert.equal(Core.isNaturalDeathDue(history, 12239), false);
    assert.equal(Core.isNaturalDeathDue(history, 12240), true);
    assert.equal(Core.hasReachedNaturalDeath(history, 15000), true);
});

test("era advancement requires six unique researched technologies out of eight", () => {
    const eraTechs = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const five = Core.eraResearchProgress(["a", "b", "c", "d", "e", "e", "old"], eraTechs);
    assert.deepEqual(five, {completed: 5, total: 8, required: 6, canAdvance: false});

    const six = Core.eraResearchProgress(
        {a: true, b: true, c: true, d: true, e: true, f: true, g: false},
        eraTechs
    );
    assert.equal(six.canAdvance, true);
    assert.equal(Core.shouldAdvanceEra(new Set(["a", "b", "c", "d", "e", "f"]), eraTechs), true);
});

test("era constants expose six eras, population targets, and semantic job weights", () => {
    assert.equal(Core.ERA_TECH_COUNT, 8);
    assert.equal(Core.ERA_ADVANCE_REQUIRED, 6);
    assert.deepEqual(Core.ERA_IDS, [
        "tribal", "stone", "agriculture", "bronze", "iron", "castle"
    ]);
    assert.deepEqual(Core.ERA_POPULATION_TARGETS, {
        tribal: 6,
        stone: 8,
        agriculture: 12,
        bronze: 16,
        iron: 20,
        castle: 24
    });
    assert.deepEqual(Core.ERA_JOB_WEIGHTS.tribal, {
        food: 1, wood: 1, miner: 1, builder: 1, forester: 1, military: 1
    });
    assert.deepEqual(Core.ERA_JOB_WEIGHTS.castle, {
        food: 6,
        wood: 2,
        miner: 4,
        builder: 2,
        forester: 2,
        artisan_trade: 3,
        scholar: 2,
        military: 3
    });

    Core.ERA_IDS.forEach((eraId) => {
        const weightTotal = Object.values(Core.ERA_JOB_WEIGHTS[eraId])
            .reduce((sum, weight) => sum + weight, 0);
        assert.equal(weightTotal, Core.ERA_POPULATION_TARGETS[eraId]);
    });
});

test("era lookup and largest-remainder job allocation are deterministic", () => {
    assert.equal(Core.eraIndexFor("agriculture"), 2);
    assert.equal(Core.eraIndexFor({eraId: "bronze"}), 3);
    assert.equal(Core.eraIdFor(4), "iron");
    assert.equal(Core.nextEraId("iron"), "castle");
    assert.equal(Core.nextEraId("castle"), null);
    assert.equal(Core.eraPopulationTarget("agriculture"), 12);
    assert.equal(Core.eraPopulationTarget("unknown", 9.8), 9);

    const copiedWeights = Core.eraJobWeights("tribal");
    copiedWeights.food = 99;
    assert.equal(Core.ERA_JOB_WEIGHTS.tribal.food, 1);

    assert.deepEqual(Core.eraJobAllocation("tribal", 3), {
        food: 1,
        wood: 1,
        miner: 1,
        builder: 0,
        forester: 0,
        military: 0
    });
    assert.deepEqual(Core.allocateJobWeights({first: 1, second: 1, third: 1}, 2), {
        first: 1,
        second: 1,
        third: 0
    });
    Core.ERA_IDS.forEach((eraId) => {
        assert.deepEqual(
            Core.eraJobAllocation(eraId, Core.eraPopulationTarget(eraId)),
            Core.eraJobWeights(eraId)
        );
    });
});

test("era progression distinguishes reaching the threshold from leaving the final era", () => {
    const eraTechs = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const researched = ["a", "b", "c", "d", "e", "f"];
    assert.deepEqual(Core.eraProgressionState("tribal", researched, eraTechs), {
        eraId: "tribal",
        eraIndex: 0,
        nextEraId: "stone",
        finalEra: false,
        completed: 6,
        total: 8,
        required: 6,
        completionRatio: 0.75,
        thresholdMet: true,
        canAdvance: true
    });

    const finalState = Core.eraProgressionState("castle", researched, eraTechs);
    assert.equal(finalState.finalEra, true);
    assert.equal(finalState.thresholdMet, true);
    assert.equal(finalState.nextEraId, null);
    assert.equal(finalState.canAdvance, false);
});

test("domain experience discounts research cost by at most 25 percent", () => {
    assert.equal(Core.domainExperienceDiscount(0), 0);
    assert.equal(Core.domainExperienceDiscount(10), 0.1);
    assert.equal(Core.domainExperienceDiscount(25), 0.25);
    assert.equal(Core.domainExperienceDiscount(1000), 0.25);
    assert.equal(Core.researchCost(65, 10), 59);
    assert.equal(Core.researchCost(100, 25), 75);
    assert.equal(Core.researchCost(100, 80), 75);
});

test("focused research selection respects affordability, tech focus, domain focus, and priority", () => {
    const candidates = [
        {id: "cheap-production", domain: "production", cost: 30, priority: 2},
        {id: "focused-building", domain: "construction", cost: 40, priority: 0},
        {id: "expensive-focus", domain: "military", cost: 90, priority: 100},
        {id: "unavailable", domain: "construction", cost: 1, conditionMet: false}
    ];
    const selected = Core.selectFocusedResearch(candidates, {
        knowledge: 36,
        focusTechId: "expensive-focus",
        focusDomain: "construction",
        domainExperience: {construction: 10}
    });
    assert.equal(selected.id, "focused-building");
    assert.equal(selected.effectiveCost, 36);
    assert.equal(selected.discount, 0.1);

    const priorityFallback = Core.selectFocusedResearch(candidates, {knowledge: 35});
    assert.equal(priorityFallback.id, "cheap-production");
    assert.equal(Core.selectFocusedResearch(candidates, {knowledge: 0}), null);
});

test("conquest merges half of knowledge and half of technology progress without mutating inputs", () => {
    const winner = {
        knowledge: 20,
        researchedTechs: ["known"],
        techProgress: {bronze: 50, partial: 10}
    };
    const loser = {
        knowledge: 10,
        researchedTechs: ["bronze"],
        techProgress: {partial: 40, untouched: 60}
    };
    const merged = Core.mergeConquestResearch(winner, loser, {
        known: 80,
        bronze: 100,
        partial: 100,
        untouched: 100
    });

    assert.equal(merged.knowledge, 25);
    assert.deepEqual(new Set(merged.researchedTechs), new Set(["known", "bronze"]));
    assert.deepEqual(merged.techProgress, {
        known: 80,
        bronze: 100,
        partial: 30,
        untouched: 30
    });
    assert.deepEqual(winner.techProgress, {bronze: 50, partial: 10});
    assert.deepEqual(loser.techProgress, {partial: 40, untouched: 60});
});

test("fuel selection minimizes waste, then items, while preserving higher-value fuels", () => {
    assert.deepEqual(
        Core.selectFuelCombination({wood: 2, charcoal: 1}, 8),
        {
            used: {tree_branch: 0, bamboo: 0, wood: 2, charcoal: 0},
            provided: 8,
            waste: 0,
            itemCount: 2
        }
    );

    const tie = Core.selectFuelCombination({tree_branch: 1, bamboo: 2, wood: 1}, 6);
    assert.deepEqual(tie.used, {tree_branch: 0, bamboo: 2, wood: 0, charcoal: 0});
    assert.equal(tie.waste, 0);
    assert.equal(tie.itemCount, 2);

    const charcoalOnly = Core.selectFuelCombination({charcoal: 2}, 11);
    assert.equal(charcoalOnly.provided, 20);
    assert.equal(charcoalOnly.waste, 9);
    assert.equal(Core.selectFuelCombination({tree_branch: 2}, 5), null);
});

test("Bresenham line returns inclusive integer cells in either direction", () => {
    assert.deepEqual(Core.bresenhamLine(0, 0, 4, 2), [
        {x: 0, y: 0},
        {x: 1, y: 1},
        {x: 2, y: 1},
        {x: 3, y: 2},
        {x: 4, y: 2}
    ]);
    assert.deepEqual(Core.bresenhamLine(2, 3, 2, 0), [
        {x: 2, y: 3}, {x: 2, y: 2}, {x: 2, y: 1}, {x: 2, y: 0}
    ]);
    assert.deepEqual(Core.bresenhamLine(NaN, 0, 1, 1), []);
});

test("line-of-sight transparency multiplies interior cells and supports hard blockers", () => {
    const transparency = Core.lineOfSightTransparency(0, 0, 4, 0, (x) => {
        if (x === 1) return 0.5;
        if (x === 2) return {transparency: 0.8};
        return 1;
    });
    assert.ok(Math.abs(transparency - 0.4) < 1e-12);
    assert.equal(Core.hasLineOfSight(0, 0, 4, 0, (x) => x === 2 ? false : true), false);
    assert.equal(Core.hasLineOfSight(0, 0, 4, 0, () => 0.5, 0.1), true);

    // Endpoints are excluded unless explicitly requested.
    assert.equal(Core.lineOfSightTransparency(0, 0, 1, 0, () => 0), 1);
    assert.equal(Core.lineOfSightTransparency(0, 0, 1, 0, () => 0, {includeEnd: true}), 0);
});

test("ranged hit probability is exactly fifty percent whenever a shot is valid", () => {
    assert.equal(Core.rangedHitProbability({distance: 0, maxRange: 10}), 0.5);
    assert.equal(Core.rangedHitProbability({distance: 10, maxRange: 10, skill: 1, cover: 1}), 0.5);
    assert.equal(Core.rangedHitProbability({distance: 11, maxRange: 10}), 0);
    assert.equal(Core.rangedHitProbability({distance: 5, maxRange: 10, visibility: 0}), 0);
});
