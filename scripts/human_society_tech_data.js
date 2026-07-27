/*
 * Human Society technology data.
 *
 * The exported value intentionally contains JSON-compatible data only. Runtime
 * systems may build indexes or attach behavior after loading this module.
 */
(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    }
    else {
        root.HumanSocietyTechData = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
    "use strict";

    const KNOWLEDGE_DOMAINS = ["production", "construction", "society", "military"];
    const DEFAULT_VISION = [8, 8, 9, 10, 11, 12];
    // Legacy defaults retained for consumers that have not moved to per-era values.
    const ERA_TECH_COUNT = 8;
    const ERA_ADVANCE_REQUIRED = 6;
    const ERA_POPULATION_TARGETS = {
        tribal: 6,
        stone: 8,
        agriculture: 12,
        bronze: 16,
        iron: 20,
        castle: 24
    };
    const ERA_JOB_WEIGHTS = {
        tribal: {food: 2, wood: 2, builder: 1, flex: 1},
        stone: {food: 2, wood: 2, miner: 2, builder: 1, artisan: 1},
        agriculture: {
            food: 4,
            wood: 2,
            miner: 1,
            builder: 1,
            forester: 1,
            artisan: 1,
            military: 1,
            flex: 1
        },
        bronze: {
            food: 4,
            wood: 2,
            miner: 3,
            builder: 2,
            forester: 1,
            artisan: 2,
            scholar: 1,
            military: 1
        },
        iron: {
            food: 5,
            wood: 2,
            miner: 4,
            builder: 2,
            forester: 1,
            artisan: 3,
            scholar: 1,
            military: 2
        },
        castle: {
            food: 6,
            wood: 2,
            miner: 4,
            builder: 2,
            forester: 2,
            artisan_trade: 3,
            scholar: 2,
            military: 3
        }
    };
    const WOOD_SMELTING_RESERVE_BY_ERA = {
        tribal: 8,
        stone: 16,
        agriculture: 32,
        bronze: 48,
        iron: 64,
        castle: 96
    };

    const ERA_SPECS = [
        {id: "tribal", name: "Tribal", costs: [20, 28]},
        {id: "stone", name: "Stone", costs: [35, 48]},
        {id: "agriculture", name: "Agriculture", costs: [55, 75]},
        {id: "bronze", name: "Bronze", costs: [80, 110]},
        {id: "iron", name: "Iron", costs: [115, 155]},
        {id: "castle", name: "Castle", costs: [160, 220]}
    ];

    function stock(resource, minimum, hard) {
        return {type: "resource_stock", resource, minimum, hard: Boolean(hard)};
    }

    function encountered(resource, minimum, hard) {
        return {type: "resource_encountered", resource, minimum, hard: Boolean(hard)};
    }

    function heat(minimum, hard) {
        return {type: "heat_available", minimum, hard: Boolean(hard)};
    }

    function population(minimum) {
        return {type: "population", minimum, hard: false};
    }

    function milestone(id, minimum) {
        return {type: "milestone", id, minimum, hard: false};
    }

    function unlock(target, id) {
        return {type: "unlock", target, id};
    }

    function modifier(stat, operation, value) {
        return {type: "modifier", stat, operation, value};
    }

    function set(stat, value) {
        return {type: "set", stat, value};
    }

    function enable(feature) {
        return {type: "enable", feature};
    }

    /*
     * Domain, tier, and cost are deliberately explicit. The compact tree no
     * longer has a fixed two-technologies-per-domain layout, so array position
     * must never alter research semantics.
     */
    const TECH_SPECS = {
        tribal: [
            {
                id: "organized_gathering",
                name: "Organized Gathering",
                domain: "production",
                tier: 1,
                cost: 20,
                prerequisites: [],
                conditions: [population(2)],
                effects: [
                    modifier("carryCapacity", "add", 2),
                    modifier("harvestDurationMultiplier", "multiply", 0.9)
                ]
            },
            {
                id: "controlled_fire",
                name: "Controlled Fire",
                domain: "production",
                tier: 2,
                cost: 28,
                prerequisites: ["organized_gathering"],
                conditions: [stock("wood", 3, false)],
                effects: [
                    unlock("building", "hearth"),
                    enable("hearthHealing")
                ]
            },
            {
                id: "simple_shelters",
                name: "Simple Shelters",
                domain: "construction",
                tier: 1,
                cost: 20,
                prerequisites: [],
                conditions: [stock("wood", 4, false)],
                effects: [unlock("building", "hut")]
            },
            {
                id: "woodworking",
                name: "Woodworking",
                domain: "construction",
                tier: 2,
                cost: 28,
                prerequisites: ["simple_shelters"],
                conditions: [stock("wood", 6, false)],
                effects: [
                    modifier("buildDurationMultiplier", "multiply", 0.8),
                    modifier("woodHarvestDurationMultiplier", "multiply", 0.9)
                ]
            },
            {
                id: "clan_council",
                name: "Clan Council",
                domain: "society",
                tier: 1,
                cost: 20,
                prerequisites: [],
                conditions: [population(3)],
                effects: [modifier("knowledgeRateMultiplier", "multiply", 1.1)]
            },
            {
                id: "oral_tradition",
                name: "Oral Tradition",
                domain: "society",
                tier: 2,
                cost: 28,
                prerequisites: ["clan_council"],
                conditions: [population(4)],
                effects: [modifier("milestoneKnowledgeMultiplier", "multiply", 1.25)]
            },
            {
                id: "war_clubs",
                name: "War Clubs",
                domain: "military",
                tier: 1,
                cost: 20,
                prerequisites: ["woodworking"],
                conditions: [stock("wood", 1, false)],
                effects: [unlock("weapon", "club")]
            }
        ],

        stone: [
            {
                id: "stone_knapping",
                name: "Stone Knapping",
                domain: "production",
                tier: 1,
                cost: 35,
                prerequisites: ["organized_gathering"],
                conditions: [encountered("stone", 1, false)],
                effects: [unlock("resource", "stone")]
            },
            {
                id: "polished_axes",
                name: "Polished Stone Tools",
                domain: "production",
                tier: 2,
                cost: 48,
                prerequisites: ["stone_knapping", "woodworking"],
                conditions: [stock("wood", 2, false), stock("stone", 1, false)],
                effects: [
                    modifier("woodHarvestDurationMultiplier", "multiply", 0.8),
                    unlock("weapon", "stone_spear")
                ]
            },
            {
                id: "quarrying",
                name: "Quarrying",
                domain: "construction",
                tier: 2,
                cost: 48,
                prerequisites: ["stone_knapping", "woodworking"],
                conditions: [stock("stone", 6, false)],
                effects: [
                    unlock("building", "quarry"),
                    modifier("stoneHarvestDurationMultiplier", "multiply", 0.8)
                ]
            },
            {
                id: "craft_specialization",
                name: "Craft Specialization",
                domain: "society",
                tier: 1,
                cost: 35,
                prerequisites: ["clan_council", "woodworking"],
                conditions: [population(6)],
                effects: [modifier("roleWorkRateMultiplier", "multiply", 1.15)]
            },
            {
                id: "tally_marks",
                name: "Tally Marks",
                domain: "society",
                tier: 2,
                cost: 48,
                prerequisites: ["craft_specialization", "oral_tradition"],
                conditions: [milestone("resourceDeliveries", 3)],
                effects: [enable("deliveryKnowledge")]
            },
            {
                id: "palisade_defense",
                name: "Palisade Defense",
                domain: "military",
                tier: 2,
                cost: 48,
                prerequisites: ["polished_axes", "woodworking"],
                conditions: [stock("wood", 12, false)],
                effects: [
                    unlock("building", "palisade"),
                    unlock("building", "palisade_gate")
                ]
            }
        ],

        agriculture: [
            {
                id: "food_preservation",
                name: "Food Preservation",
                domain: "production",
                tier: 1,
                cost: 55,
                prerequisites: ["organized_gathering", "controlled_fire"],
                conditions: [stock("food", 12, false)],
                effects: [modifier("foodHarvestDurationMultiplier", "multiply", 0.85)]
            },
            {
                id: "managed_forestry",
                name: "Managed Forestry",
                domain: "production",
                tier: 2,
                cost: 75,
                prerequisites: ["food_preservation", "polished_axes"],
                conditions: [encountered("tree_seed", 1, false)],
                effects: [
                    unlock("role", "forester"),
                    enable("treePlanting")
                ]
            },
            {
                id: "village_planning",
                name: "Village Planning",
                domain: "construction",
                tier: 1,
                cost: 55,
                prerequisites: ["craft_specialization", "simple_shelters"],
                conditions: [population(8)],
                effects: [modifier("hutHousingBonus", "add", 1)]
            },
            {
                id: "militia",
                name: "Militia",
                domain: "society",
                tier: 1,
                cost: 55,
                prerequisites: ["palisade_defense", "village_planning"],
                conditions: [population(8)],
                effects: [
                    set("peacetimeWarriors", 1),
                    set("wartimeWarriorRatio", 0.5)
                ]
            },
            {
                id: "bowmaking",
                name: "Silk String Method",
                domain: "military",
                tier: 1,
                cost: 55,
                prerequisites: ["militia", "managed_forestry"],
                conditions: [stock("wood", 10, false)],
                effects: [unlock("weapon", "bow")]
            },
            {
                id: "rattan_armor",
                name: "Rattan Armor",
                domain: "military",
                tier: 2,
                cost: 75,
                prerequisites: ["bowmaking", "craft_specialization"],
                conditions: [stock("wood", 4, false)],
                effects: [unlock("armor", "rattan")]
            }
        ],

        bronze: [
            {
                id: "copper_prospecting",
                name: "Copper Prospecting",
                domain: "production",
                tier: 1,
                cost: 80,
                prerequisites: ["managed_forestry", "stone_knapping"],
                conditions: [encountered("copper", 1, true)],
                effects: [unlock("resource", "copper")]
            },
            {
                id: "bronze_foundry",
                name: "Bronze Foundry",
                domain: "construction",
                tier: 2,
                cost: 110,
                prerequisites: ["controlled_fire", "copper_prospecting"],
                conditions: [stock("copper", 1, true), heat(1, true)],
                effects: [
                    unlock("building", "foundry"),
                    unlock("recipe", "bronze")
                ]
            },
            {
                id: "writing",
                name: "Writing",
                domain: "society",
                tier: 1,
                cost: 80,
                prerequisites: ["tally_marks", "village_planning"],
                conditions: [population(10)],
                effects: [modifier("knowledgeRateMultiplier", "multiply", 1.2)]
            },
            {
                id: "administration",
                name: "Administration",
                domain: "society",
                tier: 2,
                cost: 110,
                prerequisites: ["writing", "village_planning"],
                conditions: [population(12)],
                effects: [set("constructionSlots", 2)]
            },
            {
                id: "bronze_weapons",
                name: "Piece-Mold Casting",
                domain: "military",
                tier: 1,
                cost: 80,
                prerequisites: ["bronze_foundry", "bowmaking"],
                conditions: [stock("wood", 2, false), stock("bronze", 2, true)],
                effects: [
                    unlock("weapon", "bronze_sword"),
                    unlock("weapon", "bronze_spear")
                ]
            },
            {
                id: "shield_formation",
                name: "Shield Formation",
                domain: "military",
                tier: 2,
                cost: 110,
                prerequisites: ["bronze_weapons", "militia"],
                conditions: [stock("bronze", 4, true), population(10)],
                effects: [modifier("incomingDamageMultiplier", "multiply", 0.85)]
            }
        ],

        iron: [
            {
                id: "iron_prospecting",
                name: "Iron Prospecting",
                domain: "production",
                tier: 1,
                cost: 115,
                prerequisites: ["copper_prospecting"],
                conditions: [encountered("raw_iron", 1, true)],
                effects: [unlock("resource", "raw_iron")]
            },
            {
                id: "iron_smelting",
                name: "Iron Smelting",
                domain: "production",
                tier: 2,
                cost: 155,
                prerequisites: ["iron_prospecting", "bronze_foundry"],
                conditions: [
                    stock("raw_iron", 1, true),
                    stock("bronze", 1, true),
                    heat(2, true)
                ],
                effects: [
                    unlock("building", "kiln"),
                    unlock("recipe", "iron"),
                    modifier("roleWorkRateMultiplier", "multiply", 1.2)
                ]
            },
            {
                id: "stone_fortifications",
                name: "Stone Fortifications",
                domain: "construction",
                tier: 1,
                cost: 115,
                prerequisites: ["iron_smelting", "quarrying"],
                conditions: [stock("stone", 20, false), stock("iron", 2, true)],
                effects: [
                    unlock("building", "stone_wall"),
                    unlock("building", "stone_gate"),
                    unlock("building", "watchtower")
                ]
            },
            {
                id: "iron_weapons",
                name: "Blacksmith Workshop",
                domain: "military",
                tier: 1,
                cost: 115,
                prerequisites: ["iron_smelting", "bronze_weapons"],
                conditions: [stock("wood", 2, false), stock("iron", 2, true)],
                effects: [
                    unlock("weapon", "iron_sword"),
                    unlock("weapon", "iron_spear")
                ]
            },
            {
                id: "iron_armor",
                name: "Iron Armor",
                domain: "military",
                tier: 2,
                cost: 155,
                prerequisites: ["iron_weapons", "iron_smelting"],
                conditions: [stock("iron", 4, true)],
                effects: [unlock("armor", "iron")]
            }
        ],

        castle: [
            {
                id: "steelmaking",
                name: "Steelmaking",
                domain: "production",
                tier: 1,
                cost: 160,
                prerequisites: ["iron_smelting", "bronze_foundry"],
                conditions: [
                    stock("iron", 2, true),
                    stock("bronze", 1, true),
                    heat(4, true)
                ],
                effects: [
                    unlock("building", "forge"),
                    unlock("recipe", "steel")
                ]
            },
            {
                id: "supply_logistics",
                name: "Supply Logistics",
                domain: "society",
                tier: 2,
                cost: 220,
                prerequisites: ["administration", "tally_marks"],
                conditions: [milestone("resourceDeliveries", 12)],
                effects: [modifier("carryCapacity", "add", 2)]
            },
            {
                id: "castle_building",
                name: "Castle Building",
                domain: "construction",
                tier: 1,
                cost: 160,
                prerequisites: ["stone_fortifications", "steelmaking"],
                conditions: [stock("stone", 30, false), stock("steel", 2, true)],
                effects: [
                    unlock("building", "keep"),
                    modifier("hutHousingBonus", "add", 8)
                ]
            },
            {
                id: "library",
                name: "Library",
                domain: "society",
                tier: 1,
                cost: 160,
                prerequisites: ["writing", "administration"],
                conditions: [population(16)],
                effects: [
                    modifier("knowledgeRateMultiplier", "multiply", 1.4),
                    modifier("oldTechCostMultiplier", "multiply", 0.8)
                ]
            },
            {
                id: "carburizing_tempering",
                name: "Carburizing and Tempering",
                domain: "production",
                tier: 2,
                cost: 220,
                prerequisites: ["steelmaking", "iron_weapons"],
                conditions: [
                    stock("wood", 1, false),
                    stock("bronze", 1, true),
                    stock("iron", 1, true),
                    stock("steel", 2, true)
                ],
                effects: [
                    unlock("weapon", "steel_blade"),
                    unlock("weapon", "steel_spear")
                ]
            },
            {
                id: "crossbow",
                name: "Crossbow",
                domain: "military",
                tier: 1,
                cost: 160,
                prerequisites: ["iron_weapons", "bowmaking", "steelmaking"],
                conditions: [stock("wood", 10, false), stock("steel", 1, true)],
                effects: [unlock("weapon", "crossbow")]
            },
            {
                id: "steel_armor",
                name: "Steel Armor",
                domain: "military",
                tier: 2,
                cost: 220,
                prerequisites: ["iron_armor", "steelmaking"],
                conditions: [stock("steel", 4, true)],
                effects: [unlock("armor", "steel")]
            },
            {
                id: "siege_engineering",
                name: "Siege Engineering",
                domain: "military",
                tier: 2,
                cost: 220,
                prerequisites: ["crossbow", "castle_building"],
                conditions: [stock("steel", 4, true), stock("wood", 24, false)],
                effects: [
                    unlock("weapon", "battering_ram"),
                    unlock("weapon", "catapult"),
                    modifier("structureDamageMultiplier", "multiply", 1.5)
                ]
            }
        ]
    };

    const TECHNOLOGIES = [];
    const ERA_TECH_COUNTS = {};
    const ERA_ADVANCE_REQUIREMENTS = {};
    const ERAS = ERA_SPECS.map(function(eraSpec, eraIndex) {
        const specs = TECH_SPECS[eraSpec.id];
        const techIds = [];
        const technologyCount = specs.length;
        const requiredTechsToAdvance = Math.floor(technologyCount * 0.70) + 1;

        ERA_TECH_COUNTS[eraSpec.id] = technologyCount;
        ERA_ADVANCE_REQUIREMENTS[eraSpec.id] = requiredTechsToAdvance;

        specs.forEach(function(spec) {
            const technology = {
                id: spec.id,
                name: spec.name,
                era: eraSpec.id,
                eraIndex,
                domain: spec.domain,
                tier: spec.tier,
                cost: spec.cost,
                peaceful: spec.domain !== "military",
                prerequisiteMode: "all",
                prerequisites: spec.prerequisites.slice(),
                conditionMode: "all",
                conditions: spec.conditions.slice(),
                effects: spec.effects.slice()
            };

            TECHNOLOGIES.push(technology);
            techIds.push(technology.id);
        });

        return {
            id: eraSpec.id,
            name: eraSpec.name,
            index: eraIndex,
            vision: DEFAULT_VISION[eraIndex],
            costs: eraSpec.costs.slice(),
            technologyCount,
            requiredTechsToAdvance,
            advancement: {
                technologyCount,
                required: requiredTechsToAdvance,
                ratio: requiredTechsToAdvance / technologyCount
            },
            populationTarget: ERA_POPULATION_TARGETS[eraSpec.id],
            jobWeights: Object.assign({}, ERA_JOB_WEIGHTS[eraSpec.id]),
            techIds
        };
    });

    const FUELS = {wood: 1};

    const RECIPES = {
        bronze: {
            id: "bronze",
            inputs: [{resource: "copper", amount: 1}],
            heat: 1,
            outputs: [{resource: "bronze", amount: 1}]
        },
        iron: {
            id: "iron",
            inputs: [
                {resource: "raw_iron", amount: 1},
                {resource: "bronze", amount: 1}
            ],
            heat: 2,
            outputs: [{resource: "iron", amount: 1}]
        },
        steel: {
            id: "steel",
            inputs: [
                {resource: "iron", amount: 2},
                {resource: "bronze", amount: 1}
            ],
            heat: 4,
            outputs: [{resource: "steel", amount: 1}]
        }
    };

    const RANGED_WEAPONS = {
        bow: {
            id: "bow",
            unlockEra: "agriculture",
            range: 25,
            damage: 15
        },
        crossbow: {
            id: "crossbow",
            unlockEra: "castle",
            range: 30,
            damage: 40
        }
    };

    return {
        version: 1,
        KNOWLEDGE_DOMAINS,
        DEFAULT_VISION,
        ERA_TECH_COUNT,
        ERA_ADVANCE_REQUIRED,
        ERA_TECH_COUNTS,
        ERA_ADVANCE_REQUIREMENTS,
        ERA_POPULATION_TARGETS,
        ERA_JOB_WEIGHTS,
        WOOD_SMELTING_RESERVE_BY_ERA,
        ERAS,
        TECHNOLOGIES,
        FUELS,
        RECIPES,
        RANGED_WEAPONS
    };
});
