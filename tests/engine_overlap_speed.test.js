"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../style.css"), "utf8");

function extractBlock(signature) {
    const start = html.indexOf(signature);
    assert.ok(start >= 0, `missing source block: ${signature}`);
    const openingBrace = html.indexOf("{", start);
    assert.ok(openingBrace >= 0, `missing opening brace: ${signature}`);
    let depth = 0;
    for (let index = openingBrace; index < html.length; index++) {
        if (html[index] === "{") depth++;
        else if (html[index] === "}") {
            depth--;
            if (depth === 0) return html.slice(start, index + 1);
        }
    }
    assert.fail(`unterminated source block: ${signature}`);
}

function createEngineHarness() {
    const size = 9;
    const context = {
        elements: {
            unknown: {color: "#000", state: "solid"},
            rock: {color: "#777", state: "solid", density: 2500},
            sand: {color: "#cc9", state: "solid", density: 1600},
            water: {color: "#39f", state: "liquid", density: 1000, movable: true},
            plant: {color: "#3a3", state: "solid", density: 900, passableVegetation: true},
            creature: {color: "#a63", state: "solid", density: 1400, isCreature: true},
            civ_body: {color: "#a63", state: "solid", density: 1500, movable: true, isCreature: true},
            civ_head: {color: "#d98", state: "solid", density: 1080, movable: true, isCreature: true},
            civ_child: {color: "#a63", state: "solid", density: 1200, movable: true, isCreature: true},
            building: {
                color: "#963",
                state: "solid",
                alwaysOverlay: true,
                nonBlocking: true,
                eraseProtected: true,
                isBuildingCore: true,
                properties: {structureHp: 100, alwaysOverlay: true, nonBlocking: true, eraseProtected: true, isBuildingCore: true}
            },
            building_variant: {color: "#864", state: "solid", alwaysOverlay: true, nonBlocking: true, eraseProtected: true, isBuildingCore: true},
            nonblocking_marker: {color: "#fc0", state: "solid", nonBlocking: true},
            blocking_overlay: {color: "#f00", state: "solid", alwaysOverlay: true},
            late_building: {color: "#c84", state: "solid"},
            protected_primary: {color: "#555", state: "solid", eraseProtected: true}
            , civ_tunnel: {color: "#765", state: "solid", supportsPowder: true, overlapLocked: true},
            wood: {color: "#753", state: "solid"},
            dark_wood: {color: "#432", state: "solid"},
            wooden_plank: {color: "#975", state: "solid"},
            wool: {color: "#eee", state: "solid"}
            , civ_food_resource: {color: "#b65", state: "solid", movable: true, humanCollectible: true, properties: {_civResourceDrop: true, _civCollectible: true}}
        },
        pixelMap: Array.from({length: size}, () => []),
        overlapMap: [],
        currentPixels: [],
        currentRelations: {_id: 1},
        currentlyTickingPixel: null,
        maxPixelCount: 1000,
        width: size - 1,
        height: size - 1,
        settings: {textures: 0},
        airTemp: 20,
        pixelTicks: 10,
        validateMovesList: [],
        validDensitySwaps: {
            solid: {liquid: true, gas: true},
            liquid: {liquid: true, gas: true},
            gas: {gas: true}
        },
        outOfBounds(x, y) { return x < 0 || y < 0 || x >= size || y >= size; },
        looksLikeCreatureElement(element, info) { return !!(info && info.isCreature); },
        looksLikePassableVegetationElement(element, info) { return !!(info && info.passableVegetation); },
        isCreaturePixel(pixel) { return !!(pixel && context.elements[pixel.element] && context.elements[pixel.element].isCreature); },
        isPassableVegetationPixel(pixel) { return !!(pixel && context.elements[pixel.element] && context.elements[pixel.element].passableVegetation); },
        pixelColorPick() { return "rgb(0,0,0)"; },
        colorPatternPick() { return "rgb(0,0,0)"; },
        pixelTempCheck() {},
        wakePixelForSimulation() {},
        wakePixelsNearForSimulation() {},
        checkUnlock() {},
        saveSettings() {},
        removeFromRelation(pixel) { delete pixel._r; },
        reactPixels() { return false; },
        shuffleArray(array) { return array; },
        console
    };
    vm.createContext(context);
    const functionNames = [
        "addPixelLifecycleListener",
        "removePixelLifecycleListener",
        "emitPixelLifecycleEvent",
        "elementFlag",
        "isLockedOverlapElement",
        "isBuildingTunnelPair",
        "isCivilizedHumanElement",
        "defaultElementsCanOverlap",
        "ensureElementOverlapEntry",
        "setCatalogPair",
        "initializeElementOverlapCatalog",
        "getElementOverlapDirectory",
        "interactionOverlapMode",
        "interactionRenderLayer",
        "interactionSameElementMode",
        "interactionAllowWith",
        "pixelFlag",
        "isAlwaysOverlayPixel",
        "isNonBlockingPixel",
        "isEraseProtectedPixel",
        "isCivilizedHumanPixel",
        "civilizedHumansCanOverlap",
        "isCivilizationCollectiblePixel",
        "pixelsCanOverlap",
        "requiresOverlayStorageElement",
        "requiresOverlayStoragePixel",
        "normalizeOverlayExclusiveGroup",
        "getElementOverlayExclusiveGroup",
        "getOverlayExclusiveGroup",
        "getExclusiveOverlayConflict",
        "refreshOverlayExclusiveConflicts",
        "getOverlapCell",
        "getOverlayPixels",
        "orderOverlappingPixelsForDisplay",
        "getPixelsAt",
        "getTopErasablePixelAt",
        "getProtectedEraseActionPixelAt",
        "getSolidPixelsAt",
        "getInteractionConflictAt",
        "canPixelShareCell",
        "getBlockingOverlay",
        "canCreatureOccupy",
        "addPixelToOverlap",
        "promoteOverlapPixel",
        "detachPixelFromGrid",
        "attachPixelToGrid",
        "enforceAlwaysOverlayStorage",
        "canTransientOverlayRemain",
        "validateOverlaysAt",
        "clearPixelOverlaySemantics",
        "reconcilePixelStorageAfterChange",
        "pixelHasInteractionConflict",
        "movePixelOrRelationToNearestValid",
        "isPixelStored",
        "deletePixelObject",
        "erasePixelObject",
        "erasePixelAt",
        "deletePixelsAt",
        "isEmpty",
        "canMove",
        "cellSupportsPowder",
        "tryGravityMove",
        "movePixel",
        "applyInitialPixelProperties",
        "createPixel",
        "swapPixels",
        "changePixel",
        "tryCreate",
        "tryDelete",
        "tryMove",
        "getRelation",
        "captureRelationMoveSnapshot",
        "restoreRelationMoveSnapshot",
        "tryMoveRelation",
        "relationUsesGenericGravity",
        "applyRelationGravity"
    ];
    const source = [
        "elementOverlapCatalog = null; elementOverlapCatalogInitializing = false; pixelLifecycleListeners = [];",
        extractBlock("class Pixel"),
        ...functionNames.map((name) => extractBlock(`function ${name}(`)),
        `globalThis.engine = { Pixel, ${functionNames.join(", ")} };`
    ].join("\n");
    vm.runInContext(source, context);
    return {context, engine: context.engine};
}

test("engine provides a persisted creature overlap layer for passable vegetation", () => {
    for (const sourceFragment of [
        "overlapMap = []",
        "function getPixelsAt(x,y)",
        "function canCreatureOccupy(pixel,x,y,ignoreRelation)",
        "function deletePixelObject(pixel)",
        '"overlayPixels":overlayPixels',
        "saveJSON.overlayPixels"
    ]) {
        assert.ok(html.includes(sourceFragment), `missing engine feature: ${sourceFragment}`);
    }
    assert.match(html, /looksLikePassableVegetationElement/);
    assert.match(html, /naturalVegetation\s*=\s*true/);
});

test("the building render hook sits between terrain and plant or creature pixels", () => {
    assert.match(html, /renderMidPixelList\s*=\s*\[\]/);
    assert.match(html, /isCreaturePixel\(pixel\)\s*\|\|\s*vegetationRendersAboveBuilding\(pixel\).*pixelsAboveBuildings\.push\(pixel\)/s);
    assert.match(extractBlock("function vegetationRendersAboveBuilding("), /ensureTreeBuildingLayer\(pixel\)\s*!==\s*"below"/);
    assert.match(html, /drawPixelLayer\(pixelsBelowBuildings\).*renderMidPixelList.*drawPixelLayer\(pixelsAboveBuildings\)/s);
    assert.match(html, /id="setting-humanSocietyBuildingScale"[^>]*type="range"[^>]*min="50"[^>]*max="200"/);
});

test("pixel lifecycle listeners receive low-frequency create, change, and delete events", () => {
    const {engine} = createEngineHarness();
    const events = [];
    const listener = (event) => events.push(event);
    assert.equal(engine.addPixelLifecycleListener(listener), true);
    assert.equal(engine.addPixelLifecycleListener(listener), false);

    const pixel = engine.createPixel("rock", 1, 1);
    engine.changePixel(pixel, "sand");
    engine.movePixel(pixel, 2, 1);
    engine.deletePixelObject(pixel);

    assert.deepEqual(Array.from(events, (event) => event.type), ["create", "change", "delete"]);
    assert.equal(events[1].old.element, "rock");
    assert.equal(events[2].old.element, "sand");
    assert.equal(engine.removePixelLifecycleListener(listener), true);
    assert.equal(engine.removePixelLifecycleListener(listener), false);
});

test("always-overlay and non-blocking objects are created atomically without replacing the base", () => {
    const {context, engine} = createEngineHarness();
    const baseKinds = ["rock", "water", "plant"];

    for (let index = 0; index < baseKinds.length; index++) {
        const x = index + 1;
        const base = engine.createPixel(baseKinds[index], x, 1);
        const building = engine.createPixel("building", x, 1, {buildingId: index + 1});
        assert.equal(context.pixelMap[x][1], base);
        assert.equal(building._overlap, true);
        assert.equal(engine.isPixelStored(base), true);
        assert.equal(engine.isPixelStored(building), true);
        assert.ok(engine.getOverlayPixels(x, 1).includes(building));
    }

    const markerBase = engine.createPixel("rock", 4, 1);
    const marker = engine.createPixel("nonblocking_marker", 4, 1);
    assert.equal(context.pixelMap[4][1], markerBase);
    assert.equal(marker._overlap, true, "nonBlocking alone uses auxiliary storage");

    const lateBase = engine.createPixel("rock", 5, 1);
    const initialProperties = {alwaysOverlay: true, nonBlocking: true, eraseProtected: true, nested: {value: 3}};
    const lateBuilding = engine.createPixel("late_building", 5, 1, initialProperties);
    initialProperties.nested.value = 99;
    assert.equal(context.pixelMap[5][1], lateBase);
    assert.equal(lateBuilding._overlap, true);
    assert.equal(lateBuilding.nested.value, 3, "initial metadata is copied before attachment");
});

test("non-blocking overlays are ignored by occupancy, solid queries, movement, and density swaps", () => {
    const {context, engine} = createEngineHarness();
    const plant = engine.createPixel("plant", 2, 2);
    const building = engine.createPixel("building", 2, 2);
    const creatureProbe = {element: "creature"};

    assert.equal(engine.getBlockingOverlay(2, 2), null);
    assert.deepEqual(Array.from(engine.getSolidPixelsAt(2, 2)), [plant]);
    assert.equal(engine.canCreatureOccupy(creatureProbe, 2, 2), true);

    const mover = engine.createPixel("sand", 1, 3);
    const emptyCellBuilding = engine.createPixel("building", 2, 3);
    assert.equal(engine.movePixel(mover, 2, 3), true);
    assert.equal(context.pixelMap[2][3], mover);
    assert.equal(emptyCellBuilding.x, 2);
    assert.equal(emptyCellBuilding.y, 3);
    assert.ok(engine.getOverlayPixels(2, 3).includes(emptyCellBuilding));
    assert.equal(engine.canMove(mover, 2, 3), true);
    assert.equal(engine.tryMove(mover, 2, 3), true);
    assert.equal(engine.movePixel(mover, 2, 3), true);

    const left = engine.createPixel("rock", 3, 3);
    const right = engine.createPixel("sand", 4, 3);
    const swapBuilding = engine.createPixel("building", 3, 3);
    assert.equal(engine.swapPixels(left, right), true);
    assert.equal(context.pixelMap[3][3], right);
    assert.equal(context.pixelMap[4][3], left);
    assert.ok(engine.getOverlayPixels(3, 3).includes(swapBuilding));

    const blocker = engine.createPixel("blocking_overlay", 6, 3);
    const blockedMover = engine.createPixel("sand", 5, 3);
    assert.equal(engine.getBlockingOverlay(6, 3), blocker);
    assert.equal(engine.canMove(blockedMover, 6, 3), false);
    assert.equal(engine.tryMove(blockedMover, 6, 3), false);
    assert.equal(engine.movePixel(blockedMover, 6, 3), false);

    const sourceBlockedCreature = engine.createPixel("creature", 5, 4);
    const sourceBlocker = engine.createPixel("blocking_overlay", 5, 4);
    assert.equal(engine.getBlockingOverlay(5, 4, undefined, sourceBlockedCreature), sourceBlocker);
    assert.equal(engine.canMove(sourceBlockedCreature, 6, 4), false);
    assert.equal(engine.tryMove(sourceBlockedCreature, 6, 4), false);
    assert.equal(engine.movePixel(sourceBlockedCreature, 6, 4), false);

    const legacyMarker = new engine.Pixel(7, 3, "nonblocking_marker", false);
    context.currentPixels.push(legacyMarker);
    context.pixelMap[7][3] = legacyMarker;
    const legacyMover = engine.createPixel("sand", 7, 2);
    assert.equal(engine.canMove(legacyMover, 7, 3), true);
    assert.equal(engine.tryMove(legacyMover, 7, 3), true);
    assert.equal(context.pixelMap[7][3], legacyMover);
    assert.ok(engine.getOverlayPixels(7, 3).includes(legacyMarker));
});

test("promotion keeps all overlays out of pixelMap while preserving vegetation-creature overlap", () => {
    const {context, engine} = createEngineHarness();
    const plant = engine.createPixel("plant", 3, 4);
    const building = engine.createPixel("building", 3, 4);
    const creature = engine.createPixel("creature", 3, 4);

    assert.equal(creature._overlap, true);
    assert.equal(engine.deletePixelObject(plant), true);
    assert.equal(context.pixelMap[3][4], undefined);
    assert.ok(engine.getOverlayPixels(3, 4).includes(building));
    assert.ok(engine.getOverlayPixels(3, 4).includes(creature));
    assert.equal(building._overlapMustExit, undefined);
    assert.equal(creature._overlapMustExit, true);

    engine.promoteOverlapPixel(3, 4);
    assert.equal(context.pixelMap[3][4], undefined);
    assert.equal(building._overlap, true);
    assert.equal(creature._overlap, true);
});

test("civilized humans overlap without limit regardless of faction", () => {
    const {context, engine} = createEngineHarness();
    const first = engine.createPixel("civ_body", 7, 2, {factionId: 4, humanId: 1});
    const second = engine.createPixel("civ_child", 7, 2, {factionId: 4, humanId: 2});
    const enemy = engine.createPixel("civ_body", 7, 2, {factionId: 5, humanId: 3});
    assert.equal(context.pixelMap[7][2], first);
    assert.ok(engine.getOverlayPixels(7, 2).includes(second));
    assert.ok(engine.getOverlayPixels(7, 2).includes(enemy));
    assert.equal(engine.canCreatureOccupy({element: "civ_body", factionId: 4}, 7, 2), true);
    assert.equal(engine.canCreatureOccupy({element: "civ_body", factionId: 5}, 7, 2), true);

    const mover = engine.createPixel("civ_body", 6, 2, {factionId: 9, humanId: 4});
    assert.equal(engine.canMove(mover, 7, 2), true);
    assert.equal(engine.tryMove(mover, 7, 2), true);
    assert.ok(engine.getOverlayPixels(7, 2).includes(mover));
});

test("building-core overlays are exclusive for new operations while legacy conflicts are preserved", () => {
    const {context, engine} = createEngineHarness();
    const base = engine.createPixel("rock", 1, 6);
    const first = engine.createPixel("building", 1, 6, {buildingId: 1});
    const beforeCount = context.currentPixels.length;

    assert.equal(engine.createPixel("building_variant", 1, 6, {buildingId: 2}), null);
    assert.equal(context.currentPixels.length, beforeCount);
    assert.equal(context.pixelMap[1][6], base);

    const legacy = new engine.Pixel(1, 6, "building_variant", false);
    context.currentPixels.push(legacy);
    assert.equal(engine.attachPixelToGrid(legacy, 1, 6, true, true), true);
    assert.equal(first._legacyExclusiveConflict, true);
    assert.equal(legacy._legacyExclusiveConflict, true);
    assert.equal(engine.createPixel("building", 1, 6, {buildingId: 3}), null);

    assert.equal(engine.deletePixelObject(legacy), true);
    assert.equal(first._legacyExclusiveConflict, undefined);

    const legacyPrimary = new engine.Pixel(6, 6, "building", false);
    const legacyOverlay = new engine.Pixel(6, 6, "building_variant", false);
    context.currentPixels.push(legacyPrimary, legacyOverlay);
    context.pixelMap[6][6] = legacyPrimary;
    assert.equal(engine.attachPixelToGrid(legacyOverlay, 6, 6, true, true), true);
    assert.equal(legacyPrimary._legacyExclusiveConflict, true);
    assert.equal(legacyOverlay._legacyExclusiveConflict, true);
    assert.equal(engine.createPixel("building", 6, 6), null, "strict creation also sees legacy cores still in the primary layer");

    const legacyCellMover = engine.createPixel("sand", 6, 7);
    assert.equal(engine.canMove(legacyCellMover, 6, 6), true);
    assert.equal(engine.tryMove(legacyCellMover, 6, 6), true);
    assert.equal(context.pixelMap[6][6], legacyCellMover);
    assert.ok(engine.getOverlayPixels(6, 6).includes(legacyPrimary));
    assert.ok(engine.getOverlayPixels(6, 6).includes(legacyOverlay));
    assert.equal(legacyPrimary._legacyExclusiveConflict, true);
    assert.equal(legacyOverlay._legacyExclusiveConflict, true);

    const movingCore = engine.createPixel("building", 3, 6, {buildingId: 4});
    const targetCore = engine.createPixel("building", 4, 6, {buildingId: 5});
    assert.equal(engine.canMove(movingCore, 4, 6), false);
    assert.equal(engine.tryMove(movingCore, 4, 6), false);
    assert.equal(movingCore.x, 3);
    assert.ok(engine.getOverlayPixels(3, 6).includes(movingCore));
    assert.ok(engine.getOverlayPixels(4, 6).includes(targetCore));
});

test("changePixel reconciles primary and overlay storage in both directions", () => {
    const {context, engine} = createEngineHarness();

    const emptyBuilding = engine.createPixel("building", 1, 7);
    assert.equal(engine.changePixel(emptyBuilding, "rock"), emptyBuilding);
    assert.equal(context.pixelMap[1][7], emptyBuilding);
    assert.equal(emptyBuilding._overlap, undefined);
    assert.equal(emptyBuilding.alwaysOverlay, undefined);
    assert.equal(emptyBuilding.eraseProtected, undefined);

    const occupiedBase = engine.createPixel("rock", 2, 7);
    const occupiedBuilding = engine.createPixel("building", 2, 7);
    assert.equal(engine.changePixel(occupiedBuilding, "sand"), occupiedBuilding);
    assert.equal(context.pixelMap[2][7], occupiedBase);
    assert.equal(occupiedBuilding._overlap, true);
    assert.equal(occupiedBuilding._overlapMustExit, true);

    const ordinary = engine.createPixel("rock", 3, 7);
    assert.equal(engine.changePixel(ordinary, "building"), ordinary);
    assert.equal(context.pixelMap[3][7], undefined);
    assert.equal(ordinary._overlap, true);

    const plant = engine.createPixel("plant", 4, 7);
    const creature = engine.createPixel("creature", 4, 7);
    const existingCore = engine.createPixel("building", 4, 7);
    assert.equal(engine.changePixel(creature, "building_variant"), false);
    assert.equal(creature.element, "creature");
    assert.equal(creature._overlap, true);
    assert.equal(context.pixelMap[4][7], plant);
    assert.ok(engine.getOverlayPixels(4, 7).includes(existingCore));
});

test("collectible resources always overlap civilization humans", () => {
    const {context, engine} = createEngineHarness();
    const body = {element: "civ_body"};
    const head = {element: "civ_head"};
    const resource = {element: "civ_food_resource", _civResourceDrop: true};
    const markedRockDrop = {element: "rock", _civCollectible: true};

    assert.equal(engine.pixelsCanOverlap(body, resource), true);
    assert.equal(engine.pixelsCanOverlap(resource, head), true);
    assert.equal(engine.pixelsCanOverlap(body, markedRockDrop), true);
    assert.ok(engine.getElementOverlapDirectory("civ_food_resource").includes("civ_body"));

    const humanFirst = engine.createPixel("civ_body", 1, 7, {humanId: 10});
    const resourceSecond = engine.createPixel("civ_food_resource", 1, 7);
    assert.equal(context.pixelMap[1][7], humanFirst, "storage may retain placement order");
    assert.equal(engine.getPixelsAt(1, 7).at(-1), humanFirst, "human is visually topmost when placed first");
    assert.equal(engine.getPixelsAt(1, 7)[0], resourceSecond);

    const resourceFirst = engine.createPixel("civ_food_resource", 2, 7);
    const humanSecond = engine.createPixel("civ_body", 2, 7, {humanId: 11});
    assert.equal(context.pixelMap[2][7], resourceFirst);
    assert.equal(engine.getPixelsAt(2, 7).at(-1), humanSecond, "human is visually topmost when placed second");
    assert.match(html, /isCivilizationCollectiblePixel\(pixel\).*getPixelsAt\(pixel\.x,pixel\.y\)\.some\(isCivilizedHumanPixel\).*pixelsUnderlay\.push\(pixel\)/s);
});

test("tunnels overlap every element except logical building cores", () => {
    const {context, engine} = createEngineHarness();
    const tunnel = {element: "civ_tunnel"};
    for (const element of Object.keys(context.elements)) {
        const isBuildingCore = context.elements[element].isBuildingCore === true || context.elements[element].properties && context.elements[element].properties.isBuildingCore === true;
        assert.equal(engine.pixelsCanOverlap(tunnel, {element}), !isBuildingCore, `unexpected tunnel overlap rule for ${element}`);
    }
    assert.ok(engine.getElementOverlapDirectory("sand").includes("civ_tunnel"));
    assert.equal(engine.getElementOverlapDirectory("building").includes("civ_tunnel"), false);
    assert.equal(engine.getElementOverlapDirectory("civ_tunnel").includes("building_variant"), false);

    const placedTunnel = engine.createPixel("civ_tunnel", 7, 7);
    assert.ok(placedTunnel);
    assert.equal(engine.createPixel("building", 7, 7), null, "a building core cannot be created on a tunnel");
    const placedBuilding = engine.createPixel("building", 8, 7);
    assert.ok(placedBuilding);
    assert.equal(engine.createPixel("civ_tunnel", 8, 7), null, "a tunnel cannot be created on a building core");
    assert.doesNotMatch(html, /id="elementInteractionSetting"/);
    assert.doesNotMatch(html, /elementInteractionDatalist/);
    assert.doesNotMatch(html, /function setElementInteractionSettings\(/);
    assert.doesNotMatch(html, /"elementInteractionsVersion"/);
});

test("tunnels support passive powder without blocking deliberate movement", () => {
    const {context, engine} = createEngineHarness();
    const tunnel = engine.createPixel("civ_tunnel", 4, 4);
    const powder = engine.createPixel("sand", 4, 3);

    assert.equal(engine.cellSupportsPowder(powder, 4, 4), true);
    assert.equal(engine.tryGravityMove(powder, 4, 4), false, "powder must not fall into a tunnel");
    assert.equal(context.pixelMap[4][3], powder);
    assert.equal(context.pixelMap[4][4], tunnel);

    const human = engine.createPixel("civ_body", 5, 3, {humanId: 21});
    const secondTunnel = engine.createPixel("civ_tunnel", 5, 4);
    assert.equal(engine.tryMove(human, 5, 4), true, "humans must still enter tunnel cells");
    assert.ok(engine.getPixelsAt(5, 4).includes(human));
    assert.ok(engine.getPixelsAt(5, 4).includes(secondTunnel));

    const deliberatelyPlacedPowder = engine.createPixel("sand", 6, 4);
    const thirdTunnel = engine.createPixel("civ_tunnel", 6, 4);
    assert.ok(deliberatelyPlacedPowder && thirdTunnel, "explicit overlap remains permitted");
});

test("generic erase and replace preserve protected objects while explicit deletion can remove them", () => {

    const {context, engine} = createEngineHarness();
    context.elements.self_deleting = {
        color: "#000",
        state: "solid",
        onPlace(pixel) { engine.deletePixelObject(pixel); }
    };
    assert.equal(engine.tryCreate("self_deleting", 8, 4, false), null, "onPlace self-deletion is reported as a failed creation");
    assert.equal(context.pixelMap[8][4], undefined);

    const base = engine.createPixel("rock", 2, 5);
    const building = engine.createPixel("building", 2, 5);

    assert.equal(engine.getTopErasablePixelAt(2, 5), base);
    assert.equal(engine.deletePixelsAt(2, 5), 1);
    assert.equal(base.del, true);
    assert.equal(building.del, undefined);
    assert.equal(context.pixelMap[2][5], undefined);
    assert.ok(engine.getOverlayPixels(2, 5).includes(building));

    const replacement = engine.tryCreate("sand", 2, 5, true);
    assert.equal(context.pixelMap[2][5], replacement);
    assert.ok(engine.getOverlayPixels(2, 5).includes(building));
    assert.equal(engine.tryDelete(2, 5), replacement);
    assert.equal(building.del, undefined);
    assert.equal(engine.erasePixelObject(building), false);
    assert.equal(engine.deletePixelObject(building), true, "script-level exact deletion bypasses erase protection");

    const protectedPrimary = engine.createPixel("protected_primary", 6, 5);
    const survivingOverlay = engine.createPixel("blocking_overlay", 6, 5);
    const beforeCount = context.currentPixels.length;
    assert.equal(engine.tryCreate("sand", 6, 5, true), null);
    assert.equal(context.pixelMap[6][5], protectedPrimary);
    assert.ok(engine.getOverlayPixels(6, 5).includes(survivingOverlay), "failed replace is non-destructive");
    assert.equal(context.currentPixels.length, beforeCount, "failed replace does not create an orphan pixel");
    assert.equal(engine.tryDelete(6, 5), survivingOverlay);
    assert.equal(engine.tryDelete(6, 5), null, "protected primary is not reported as deleted");

    const replacementBase = engine.createPixel("rock", 7, 5);
    const existingCore = engine.createPixel("building", 7, 5);
    assert.equal(engine.tryCreate("building_variant", 7, 5, true), null);
    assert.equal(context.pixelMap[7][5], replacementBase, "exclusive preflight runs before replace deletion");
    assert.ok(engine.getOverlayPixels(7, 5).includes(existingCore));

    const capacityBase = engine.createPixel("rock", 8, 5);
    context.maxPixelCount = context.currentPixels.length;
    assert.equal(engine.tryCreate("sand", 8, 5, true), null);
    assert.equal(context.pixelMap[8][5], capacityBase, "capacity failure is checked before replace deletion");
    assert.equal(capacityBase.del, undefined);
});

test("eraser prioritizes a protected building core below human overlays", () => {
    const {context, engine} = createEngineHarness();
    let erased = null;
    context.elements.building.onErase = pixel => {
        erased = pixel;
        engine.deletePixelObject(pixel);
    };

    const base = engine.createPixel("plant", 2, 8);
    const building = engine.createPixel("building", 2, 8);
    const human = engine.createPixel("civ_body", 2, 8, {factionId: 1});
    assert.equal(engine.getPixelsAt(2, 8).at(-1), human);
    assert.equal(engine.getProtectedEraseActionPixelAt(2, 8), building);

    assert.equal(engine.erasePixelAt(2, 8), building);
    assert.equal(erased, building);
    assert.equal(building.del, true);
    assert.equal(base.del, undefined);
    assert.equal(human.del, undefined);
    assert.ok(engine.getOverlayPixels(2, 8).includes(human));

    erased = null;
    engine.createPixel("plant", 4, 8);
    const filteredBuilding = engine.createPixel("building", 4, 8);
    const filteredHuman = engine.createPixel("civ_body", 4, 8, {factionId: 2});
    assert.equal(engine.erasePixelAt(4, 8, "civ_body"), filteredHuman);
    assert.equal(erased, null, "a filter for the human does not trigger the building action");
    assert.equal(filteredBuilding.del, undefined);
    assert.equal(filteredHuman.del, true);

    const visualOnlyBase = engine.createPixel("rock", 3, 8);
    assert.equal(engine.getProtectedEraseActionPixelAt(3, 8), null);
    assert.equal(engine.erasePixelAt(3, 8), visualOnlyBase);
    assert.equal(visualOnlyBase.del, true);
});

test("relation movement rolls back exact grid state when a commit step fails", () => {
    const {context, engine} = createEngineHarness();
    const plant = engine.createPixel("plant", 1, 3);
    const body = engine.createPixel("civ_body", 1, 3, {factionId: 1});
    const head = engine.createPixel("civ_head", 1, 4, {factionId: 1});
    body._r = 1;
    head._r = 1;
    const relation = {p: [body, head], lastMove: 4};
    context.currentRelations[1] = relation;
    const originalOverlapCell = context.overlapMap[1][3];
    const originalAttach = context.attachPixelToGrid;
    let attachCalls = 0;
    context.attachPixelToGrid = function (...args) {
        attachCalls++;
        const attached = originalAttach(...args);
        return attachCalls === 2 ? false : attached;
    };

    assert.equal(engine.tryMoveRelation(relation, 1, 0), false);
    assert.equal(relation.lastMove, 4);
    assert.equal(context.pixelMap[1][3], plant);
    assert.equal(context.pixelMap[1][4], head);
    assert.equal(context.overlapMap[1][3], originalOverlapCell, "rollback preserves Set identity");
    assert.ok(originalOverlapCell.has(body));
    assert.equal(body.x, 1);
    assert.equal(body.y, 3);
    assert.equal(body._overlap, true);
    assert.equal(Object.hasOwn(body, "_overlapMustExit"), false);
    assert.equal(head.x, 1);
    assert.equal(head.y, 4);
    assert.equal(head._overlap, undefined);

    context.attachPixelToGrid = originalAttach;
    const staleTarget = engine.createPixel("rock", 5, 2);
    const stalePart = engine.createPixel("civ_body", 5, 1, {factionId: 1});
    staleTarget._r = 2;
    stalePart._r = 2;
    const staleRelation = {p: [stalePart]};
    context.currentRelations[2] = staleRelation;
    assert.equal(engine.tryMoveRelation(staleRelation, 0, 1), false);
    assert.equal(context.pixelMap[5][1], stalePart);
    assert.equal(context.pixelMap[5][2], staleTarget);

    const staleOverlayPart = engine.createPixel("civ_body", 7, 1, {factionId: 1});
    const staleOverlay = engine.createPixel("blocking_overlay", 7, 2);
    staleOverlayPart._r = 4;
    staleOverlay._r = 4;
    const staleOverlayRelation = {p: [staleOverlayPart]};
    context.currentRelations[4] = staleOverlayRelation;
    assert.equal(engine.tryMoveRelation(staleOverlayRelation, 0, 1), false);
    assert.equal(context.pixelMap[7][1], staleOverlayPart);
    assert.ok(engine.getOverlayPixels(7, 2).includes(staleOverlay));
});

test("relation movement also rolls back when displaced-pixel attachment fails", () => {
    const {context, engine} = createEngineHarness();
    const body = engine.createPixel("civ_body", 3, 2, {factionId: 1});
    const water = engine.createPixel("water", 3, 3);
    body._r = 3;
    const relation = {p: [body]};
    context.currentRelations[3] = relation;
    const originalAttach = context.attachPixelToGrid;
    let attachCalls = 0;
    context.attachPixelToGrid = function (...args) {
        attachCalls++;
        const attached = originalAttach(...args);
        return attachCalls === 2 ? false : attached;
    };

    assert.equal(engine.tryMoveRelation(relation, 0, 1), false);
    assert.equal(Object.hasOwn(relation, "lastMove"), false);
    assert.equal(context.pixelMap[3][2], body);
    assert.equal(context.pixelMap[3][3], water);
    assert.equal(body.x, 3);
    assert.equal(body.y, 2);
    assert.equal(water.x, 3);
    assert.equal(water.y, 3);
});

test("managed civilization relations opt out of generic end-of-tick gravity", () => {
    const {context, engine} = createEngineHarness();
    context.elements.civ_body.relationGravity = "managed";
    const body = engine.createPixel("civ_body", 2, 2, {humanId: 1});
    const head = engine.createPixel("civ_head", 2, 1, {humanId: 1});
    body._r = 1;
    head._r = 1;
    context.currentRelations[1] = {p: [body, head]};
    assert.equal(engine.relationUsesGenericGravity(context.currentRelations[1]), false);
    engine.applyRelationGravity();
    assert.equal(body.y, 2);
    assert.equal(head.y, 1);

    const ordinary = engine.createPixel("sand", 5, 2);
    ordinary._r = 2;
    context.currentRelations[2] = {p: [ordinary]};
    assert.equal(engine.relationUsesGenericGravity(context.currentRelations[2]), true);
    engine.applyRelationGravity();
    assert.equal(ordinary.y, 3);

    engine.deletePixelObject(body);
    context.currentRelations[1].p = [head];
    assert.equal(engine.relationUsesGenericGravity(context.currentRelations[1]), true);
});

test("save and load paths preserve auxiliary storage and restore pixel metadata before attachment", () => {

    for (const sourceFragment of [
        "const loadedPixel = createPixel(pixel.element,x,y,pixel)",
        "applyInitialPixelProperties(loadedPixel,savedPixel)",
        "attachPixelToGrid(loadedPixel,x,y,true,true)",
        "delete savedPixel._legacyExclusiveConflict",
        "const placedPixel = tryCreate(currentElement,x,y,replaceForCreate,currentElementProp)",
        '"overlayPixels":overlayPixels',
        "saveJSON.overlayPixels"
    ]) {
        assert.ok(html.includes(sourceFragment), `missing save/load overlay path: ${sourceFragment}`);
    }
});

test("element palette modes classify civilization resources without changing the laboratory catalog", () => {
    const start = html.indexOf("const CIVILIZATION_PALETTE_ELEMENTS");
    const end = html.indexOf("function applyElementPaletteButtonVisibility", start);
    assert.ok(start >= 0 && end > start, "missing element palette classification source");
    const context = {
        Set,
        settings: {elementPaletteMode: "civilization"},
        elements: {
            civilized_human: {category: "civilization"},
            civ_body: {category: "civilization", hidden: true},
            water: {category: "liquids"},
            wood: {category: "solids"},
            sapling: {category: "life", seed: true},
            copper: {category: "solids"},
            tin: {category: "solids"},
            civ_tin_resource: {category: "civilization", humanCollectible: true},
            apple: {category: "food", isFood: true},
            wheat_seed: {category: "life", seed: true},
            mod_resource: {category: "other", humanCollectible: true},
            mod_essential: {category: "other", civilizationRelevant: true},
            excluded_water: {category: "liquids", civilizationRelevant: false},
            plasma: {category: "energy"}
        }
    };
    vm.createContext(context);
    vm.runInContext(
        html.slice(start, end) + "\nglobalThis.palette = {normalizeElementPaletteMode,isCivilizationPaletteElement,isElementVisibleInPaletteMode};",
        context
    );

    assert.equal(context.palette.normalizeElementPaletteMode("laboratory"), "laboratory");
    assert.equal(context.palette.normalizeElementPaletteMode("invalid-old-value"), "civilization");
    for (const element of ["civilized_human", "water", "wood", "sapling", "copper", "apple", "mod_resource", "mod_essential"]) {
        assert.equal(context.palette.isElementVisibleInPaletteMode(element, "civilization"), true, `${element} should be available in civilization mode`);
    }
    for (const retiredElement of ["tin", "civ_tin_resource", "wheat_seed"]) {
        assert.equal(context.palette.isElementVisibleInPaletteMode(retiredElement, "civilization"), false, `${retiredElement} is retired from civilization mode`);
        assert.equal(context.palette.isElementVisibleInPaletteMode(retiredElement, "laboratory"), true, `${retiredElement} remains available in laboratory mode`);
    }
    assert.equal(context.palette.isElementVisibleInPaletteMode("civ_body", "civilization"), false, "hidden implementation pixels are not civilization palette entries");
    assert.equal(context.palette.isElementVisibleInPaletteMode("excluded_water", "civilization"), false, "an explicit false marker overrides automatic inclusion");
    assert.equal(context.palette.isElementVisibleInPaletteMode("plasma", "civilization"), false);
    assert.equal(context.palette.isElementVisibleInPaletteMode("plasma", "laboratory"), true);
    assert.equal(context.palette.isElementVisibleInPaletteMode("civ_body", "laboratory"), true, "the mode layer leaves the existing hidden/discovery rule in charge");
});

test("element palette mode is persistent, immediate, and applied to startup and dynamic buttons", () => {
    assert.match(html, /settings\.elementPaletteMode\s*=\s*"civilization"/);
    assert.match(html, /id="elementPaletteModeSelect"[^>]*onchange="setElementPaletteMode\(this\.value\)"/);
    assert.match(html, /option value="civilization"[^>]*>文明发展<\/option>/);
    assert.match(html, /option value="laboratory"[^>]*>实验室<\/option>/);
    const setter = extractBlock("function setElementPaletteMode(");
    assert.match(setter, /elementPaletteModeSelect/);
    assert.match(setter, /saveSettings\(\)[\s\S]*refreshElementPaletteVisibility\(true\)/);
    assert.match(extractBlock("function createElementButton("), /applyElementPaletteButtonVisibility\(button, element\)/);
    assert.match(extractBlock("function checkUnlock("), /refreshElementPaletteVisibility\(false\)/);
    assert.match(extractBlock("function addElement("), /refreshElementPaletteVisibility/);
    assert.match(html, /refreshElementPaletteVisibility\(false\);[\s\S]*firstVisiblePaletteCategoryButton\(\)/);
    assert.match(html, /firstVisiblePaletteElementButton\(getElementPaletteMode\(\) === "civilization" \? "civilized_human" : null\)/);
});

test("simulation speed cycles through 1x, 2x, 3x, and 5x with a hard 5x cap", () => {
    assert.match(html, /MAX_TPS\s*=\s*150/);
    assert.match(html, /SIMULATION_SPEEDS\s*=\s*\[30,60,90,150\]/);
    assert.match(html, /id="speedButton"[^>]*>1×<\/button>/);
    assert.match(html, /function cycleSimulationSpeed\(\)/);
    assert.match(html, /SIMULATION_PULSE_MS\s*=\s*1000\/30/);
    assert.match(html, /SIMULATION_MAX_TICKS_PER_PULSE\s*=\s*8/);
    assert.match(html, /SIMULATION_WORK_BUDGET_MS\s*=\s*4/);
    assert.match(html, /SIMULATION_MAX_BACKLOG_TICKS\s*=\s*15/);
    assert.match(html, /while \(simulationTickDebt >= 1 && completed < SIMULATION_MAX_TICKS_PER_PULSE/);
    assert.match(html, /function simulationSchedulerLoop\(\)/);
    assert.match(html, /simulationPulse\(simulationWorkBudget\(\)\)/);
    assert.match(html, /if \(document\.hidden\) simulationPulse\(12\)/);
    assert.doesNotMatch(extractBlock("let animation = function("), /simulationPulse/);
    assert.match(extractBlock("function simulationRenderInterval("), /tps < 150[\s\S]*1000\/30[\s\S]*1000\/20/);
    const speedButtonUpdater = extractBlock("function updateSpeedButton(");
    assert.match(speedButtonUpdater, /langKey\("guitemplate\.speedButton\.title"/);
    assert.match(speedButtonUpdater, /simulationActualTPS\.toFixed\(1\)/);
    assert.match(speedButtonUpdater, /targetLabel\+"\/"\+actualLabel/);
    assert.match(speedButtonUpdater, /data-saturated/);
    assert.doesNotMatch(html, /setInterval\(tick,\s*1000\/(?:new)?tps\)/);
});

test("stable wall and powder pixels use wakeable, periodically audited sleep", () => {
    assert.match(html, /const pixelSimulationSleepState = new WeakMap\(\)/);
    assert.match(html, /PIXEL_SLEEP_STABLE_TICKS\s*=\s*4/);
    assert.match(html, /PIXEL_SLEEP_RECHECK_INTERVAL\s*=\s*120/);
    assert.match(extractBlock("function pixelRequiresSimulation("), /info\._simulationBehavior === "wall"/);
    assert.match(extractBlock("function pixelRequiresSimulation("), /info\._simulationBehavior !== "powder"/);
    assert.match(extractBlock("function finalizeElementAfter("), /simulationOriginalBehavior === behaviors\.POWDER/);
    assert.match(extractBlock("function tickPixels("), /simulationSleepingPixels\+\+/);
    assert.match(extractBlock("function movePixel("), /wakePixelsNearForSimulation\(oldX,oldY\)/);
    assert.match(extractBlock("function deletePixelObject("), /wakePixelsNearForSimulation\(deletedState\.x,deletedState\.y\)/);
    assert.match(extractBlock("function burnPixel("), /wakePixelForSimulation\(pixel\)/);
    assert.match(extractBlock("function pixelRequiresSimulation("), /simulationTickInterval/);
    assert.match(fs.readFileSync(path.join(__dirname, "../scripts/human_society.js"), "utf8"), /elements\.civ_head\s*=\s*\{[\s\S]*simulationTickInterval:\s*4/);
});

test("the default pixel capacity scales to twice the canvas cell count", () => {
    const context = {width: 199, height: 99, settings: {}, maxPixelCount: 0};
    vm.createContext(context);
    vm.runInContext([
        extractBlock("function defaultMaxPixels("),
        extractBlock("function refreshMaxPixels("),
        "globalThis.result = refreshMaxPixels();"
    ].join("\n"), context);
    assert.equal(context.result, 40000);
    assert.equal(context.maxPixelCount, 40000);

    context.settings.limitless = true;
    assert.equal(vm.runInContext("refreshMaxPixels()", context), 999999999999);
    assert.match(html, /width\s*=\s*Math\.round\(newWidth\/newPixelSize\)-1;\s*refreshMaxPixels\(\)/);
    assert.doesNotMatch(extractBlock("function refreshMaxPixels("), /settings\.maxpixels\s*\|\|/);
});

test("civilization-planted trees atomically reach a six-cell minimum height", () => {
    const created = [];
    const seed = {element: "sapling", x: 3, y: 8, temp: 20, civPlantedTreeId: 71, treeLineage: "managed-tree", treeSpecies: "sapling"};
    const context = {
        pixelTicks: 0,
        maxPixelCount: 100,
        currentPixels: [seed],
        treeIdentitySerial: 0,
        treeIdentityElements: new Set(["sapling", "wood"]),
        Date,
        isEmpty() { return true; },
        movePixel(pixel, x, y) { pixel.x = x; pixel.y = y; return true; },
        createPixel(element, x, y) {
            const pixel = {element, x, y};
            created.push(pixel);
            context.currentPixels.push(pixel);
            return pixel;
        }
    };
    vm.createContext(context);
    vm.runInContext([
        extractBlock("function stableTreeBuildingLayer("),
        extractBlock("function assignNewTreeBuildingLayer("),
        extractBlock("function ensureTreeBuildingLayer("),
        extractBlock("function ensureTreeIdentity("),
        extractBlock("function inheritTreeIdentity("),
        extractBlock("function growCivilizationPlantedSeed("),
        "globalThis.grow = growCivilizationPlantedSeed;"
    ].join("\n"), context);

    for (let segment = 0; segment < 5; segment++) {
        context.pixelTicks = segment * 60;
        context.grow(seed, "wood");
        context.pixelTicks = seed.civGrowthReadyTick;
        assert.equal(context.grow(seed, "wood"), true);
    }
    assert.equal(seed.civGrowthSegments, 5);
    assert.equal(seed.y, 3);
    assert.equal(created.length, 5);
    assert.ok(created.every((pixel) => pixel.treeId === 71 && pixel.treeLineage === "managed-tree"));
    assert.ok(seed.treeBuildingLayer === "above" || seed.treeBuildingLayer === "below");
    assert.ok(created.every((pixel) => pixel.treeBuildingLayer === seed.treeBuildingLayer));
    assert.equal(context.grow(seed, "wood"), false);
});

test("whole trees share one stable building layer and legacy identities migrate deterministically", () => {
    const context = {Math: Object.create(Math), Date, pixelTicks: 0, treeIdentitySerial: 0, treeIdentityElements: new Set(["sapling", "wood"])};
    context.Math.random = () => 0.25;
    vm.createContext(context);
    vm.runInContext([
        extractBlock("function stableTreeBuildingLayer("),
        extractBlock("function assignNewTreeBuildingLayer("),
        extractBlock("function ensureTreeBuildingLayer("),
        extractBlock("function ensureTreeIdentity("),
        extractBlock("function inheritTreeIdentity("),
        "globalThis.api = {ensureTreeIdentity, inheritTreeIdentity, ensureTreeBuildingLayer};"
    ].join("\n"), context);

    const planted = {treeLineage: "legacy-oak-17", element: "sapling"};
    const firstLayer = context.api.ensureTreeBuildingLayer(planted);
    assert.equal(context.api.ensureTreeBuildingLayer({treeLineage: "legacy-oak-17"}), firstLayer);

    const child = {element: "wood"};
    context.api.inheritTreeIdentity(planted, child);
    assert.equal(child.treeBuildingLayer, firstLayer);
    assert.equal(child.treeLineage, planted.treeLineage);

    const fresh = {element: "sapling"};
    context.api.ensureTreeIdentity(fresh, "sapling");
    assert.equal(fresh.treeBuildingLayer, "above");
});

test("top-level windows support persisted dragging and eight-way resizing on desktop", () => {
    const register = extractBlock("function registerFloatingWindow(");
    assert.match(register, /\["n","ne","e","se","s","sw","w","nw"\]/);
    assert.match(register, /floatingWindowLayoutStore\(\)\[panel\.id\]/);
    assert.match(extractBlock("function finishFloatingWindow("), /applyFloatingWindowRect[\s\S]*true/);
    assert.match(extractBlock("function floatingWindowMinimums("), /360,height:260/);
    assert.match(html, /#infoParent,#settingsParent,\.menuParent,#peopleObserverPanel,#civilizationParent,#civilizationTutorial/);
    assert.doesNotMatch(html, /id="(?:elemSelectButton|editModeButton|infoButton|modsButton|modParent|category-edit)"/);
    assert.match(css, /\.floating-window-resize-ne[\s\S]*cursor:\s*nesw-resize/);
    assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.floating-window-resize\s*\{\s*display:\s*none/);
});

test("hot tick and render paths reuse pixel buffers instead of allocating full lists", () => {
    assert.match(html, /const tickPixelBuffer\s*=\s*\[\]/);
    assert.match(html, /const newCurrentPixels\s*=\s*tickPixelBuffer/);
    assert.doesNotMatch(html, /(?:var|let|const) newCurrentPixels\s*=\s*\[\.\.\.currentPixels\]/);
    assert.match(html, /const drawPixelListBuffer\s*=\s*\[\]/);
    assert.match(html, /const pixelDrawList\s*=\s*drawPixelListBuffer/);
    assert.doesNotMatch(html, /pixelsUnderlay\.concat\(pixelsFirst,pixelsOverlay,pixelsLast\)/);
});

test("local development never loads third-party advertising work", () => {
    assert.match(html, /localHostname === "localhost"/);
    assert.match(html, /localHostname === "127\.0\.0\.1"/);
    assert.match(html, /localHostname === "::1"/);
    assert.ok(html.indexOf('if (localHostname === "localhost"') < html.indexOf('adscript1.src = "https://pagead2.googlesyndication.com/'), "the local guard runs before advertising is requested");
});

test("technology data loads between the core rules and browser adapter", () => {
    const core = html.indexOf('src="scripts/human_society_core.js');
    const data = html.indexOf('src="scripts/human_society_tech_data.js');
    const pathfinding = html.indexOf('src="scripts/human_society_pathfinding.js');
    const adapter = html.indexOf('src="scripts/human_society.js');
    assert.ok(core >= 0 && data > core && pathfinding > data && adapter > pathfinding);
});

test("tree growth no longer creates roots and propagates whole-tree identity", () => {
    const sapling = extractBlock('"sapling": {\n\tcolor');
    const pinecone = extractBlock('"pinecone": {\n\tcolor');
    const branch = extractBlock('"tree_branch": {\n\tcolor');
    const evergreen = extractBlock('"evergreen": {\n\tcolor');

    assert.doesNotMatch(sapling, /changePixel\(dirtPixel\s*,\s*"root"\)/);
    assert.doesNotMatch(pinecone, /changePixel\(dirtPixel\s*,\s*"root"\)/);
    assert.match(sapling, /ensureTreeIdentity\(pixel,"sapling"\)/);
    assert.match(pinecone, /ensureTreeIdentity\(pixel,"pinecone"\)/);
    assert.match(branch, /inheritTreeIdentity\(pixel,leftLeaf\)/);
    assert.match(evergreen, /inheritTreeIdentity\(pixel,leftEvergreen\)/);
});
