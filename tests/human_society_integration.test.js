"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const Core = require("../scripts/human_society_core.js");
const TechData = require("../scripts/human_society_tech_data.js");
const World = require("../scripts/human_society_world.js");
const Pathfinding = require("../scripts/human_society_pathfinding.js");
const techDataSource = fs.readFileSync(
    path.join(__dirname, "../scripts/human_society_tech_data.js"),
    "utf8"
);
const societySource = fs.readFileSync(
    path.join(__dirname, "../scripts/human_society.js"),
    "utf8"
);

function cloneProperties(properties) {
    if (!properties) return {};
    return JSON.parse(JSON.stringify(properties));
}

function createHarness(options) {
    const opts = options || {};
    const width = 96;
    const height = 24;
    const currentPixels = [];
    const pixelMap = Array.from({length: width}, () => Array(height));
    const currentRelations = {_id: 1};
    const everyTickCallbacks = [];
    const resetCallbacks = [];
    const pixelLifecycleListeners = [];
    const overlayPixels = Array.isArray(opts.overlayPixels) ? opts.overlayPixels : [];
    const wallBehavior = Object.freeze([["XX", "XX", "XX"], ["XX", "XX", "XX"], ["XX", "XX", "XX"]]);
    const powderBehavior = Object.freeze([["XX", "XX", "XX"], ["XX", "XX", "XX"], ["M2", "M1", "M2"]]);

    const elements = {
        blood: {color: "#bb0000", state: "liquid", properties: {}},
        cooked_meat: {color: "#8b493f", state: "solid", properties: {}},
        frozen_meat: {color: "#a9c7d8", state: "solid", properties: {}},
        rotten_meat: {color: "#65723a", state: "solid", properties: {}},
        rock: {color: "#777777", state: "solid", behavior: wallBehavior, properties: {}},
        dirt: {color: "#795c3d", state: "solid", behavior: wallBehavior, properties: {}},
        root: {color: "#80715b", state: "solid", behavior: wallBehavior, properties: {}},
        fiber: {color: "#9b8b6b", state: "solid", behavior: wallBehavior, properties: {}},
        apple: {color: "#cc3322", state: "solid", isFood: true, seed: "apple_seed", properties: {}},
        apple_seed: {color: "#886633", state: "solid", seed: true, isFood: true, properties: {}},
        wheat_seed: {color: "#b6c981", state: "solid", seed: true, properties: {}},
        corn_seed: {color: "#f2b813", state: "solid", seed: true, properties: {}},
        sapling: {color: "#3e9c3e", state: "solid", seed: true, properties: {}},
        wood: {color: "#82552f", state: "solid", properties: {}},
        tree_branch: {color: "#6f4f2f", state: "solid", properties: {}},
        plant: {color: "#4c963f", state: "solid", properties: {}},
        sawdust: {color: "#b88955", state: "solid", properties: {}},
        gravel: {color: "#888888", state: "solid", properties: {}},
        copper: {color: "#b87333", state: "solid", properties: {}},
        tin: {color: "#d4d7dc", state: "solid", properties: {}},
        iron: {color: "#8f6552", state: "solid", properties: {}},
        fire: {color: "#ff7a22", state: "gas", properties: {}},
        plasma: {color: "#ffd8aa", state: "gas", properties: {}},
        ember: {color: "#d95b24", state: "solid", properties: {}},
        fw_ember: {color: "#ff4455", state: "solid", properties: {}},
        torch: {color: "#9b5a2f", state: "solid", properties: {}},
        smoke: {color: "#777777", state: "gas", properties: {}},
        ash: {color: "#555555", state: "solid", properties: {}},
        water: {color: "#3f86d9", state: "liquid", properties: {}},
        unknown: {color: "#ff00ff", state: "solid", properties: {}},
        meat: {color: "#8b493f", state: "solid", isFood: true, properties: {}}
    };

    function outOfBounds(x, y) {
        return x < 0 || y < 0 || x >= width || y >= height;
    }

    function getPixel(x, y) {
        if (outOfBounds(x, y)) return undefined;
        return pixelMap[x][y];
    }

    function isEmpty(x, y) {
        return !outOfBounds(x, y) && getPixel(x, y) === undefined;
    }

    function pixelColorPick(pixel, requestedColor) {
        let color = requestedColor;
        if (color === undefined) {
            const definition = elements[pixel.element];
            color = definition && definition.color;
        }
        return Array.isArray(color) ? color[0] : (color || "#000000");
    }

    function getRelation(id) {
        if (!currentRelations[id]) {
            currentRelations[id] = {
                p: currentPixels.filter((pixel) => !pixel.del && pixel._r === id)
            };
        }
        return currentRelations[id];
    }

    function addToRelation(pixel, id) {
        if (id === undefined) id = pixel._r;
        if (id === undefined) return;
        const relation = getRelation(id);
        if (!relation.p.includes(pixel)) relation.p.push(pixel);
        pixel._r = id;
    }

    function removeFromRelation(pixel) {
        if (pixel._r === undefined) return;
        const id = pixel._r;
        const relation = getRelation(id);
        const index = relation.p.indexOf(pixel);
        if (index !== -1) relation.p.splice(index, 1);
        delete pixel._r;
        if (relation.p.length === 0) delete currentRelations[id];
    }

    function createPixel(elementName, x, y, initialProperties) {
        assert.equal(outOfBounds(x, y), false, "test attempted to place a pixel out of bounds");
        assert.equal(getPixel(x, y), undefined, "test attempted to overwrite an occupied pixel");
        const definition = elements[elementName];
        assert.ok(definition, `unknown test element: ${elementName}`);
        const pixel = Object.assign({
            x,
            y,
            element: elementName,
            start: sandbox.pixelTicks,
            temp: definition.temp === undefined ? 20 : definition.temp
        }, cloneProperties(definition.properties), cloneProperties(initialProperties));
        pixel.color = pixelColorPick(pixel);
        currentPixels.push(pixel);
        if (Array.isArray(opts.overlayStorageElements) && opts.overlayStorageElements.includes(elementName)) {
            pixel._overlap = true;
            overlayPixels.push(pixel);
        }
        else pixelMap[x][y] = pixel;
        if (definition.onPlace) definition.onPlace(pixel);
        pixelLifecycleListeners.slice().forEach((listener) => listener({type: "create", pixel}));
        return pixel;
    }

    function deletePixelObject(pixel) {
        if (!pixel || pixel.del) return false;
        const old = {element: pixel.element, x: pixel.x, y: pixel.y, treeLineage: pixel.treeLineage, treeId: pixel.treeId, civPlantedTreeId: pixel.civPlantedTreeId};
        pixel.del = true;
        const definition = elements[pixel.element];
        if (definition && definition.onDelete) definition.onDelete(pixel);
        if (pixelMap[pixel.x] && pixelMap[pixel.x][pixel.y] === pixel) pixelMap[pixel.x][pixel.y] = undefined;
        const overlayIndex = overlayPixels.indexOf(pixel);
        if (overlayIndex !== -1) overlayPixels.splice(overlayIndex, 1);
        pixelLifecycleListeners.slice().forEach((listener) => listener({type: "delete", pixel, old}));
        return true;
    }

    function deletePixel(x, y) {
        const pixel = getPixel(x, y);
        if (!pixel) return;
        const old = {element: pixel.element, x: pixel.x, y: pixel.y, treeLineage: pixel.treeLineage, treeId: pixel.treeId, civPlantedTreeId: pixel.civPlantedTreeId};
        pixel.del = true;
        const definition = elements[pixel.element];
        if (definition && definition.onDelete) definition.onDelete(pixel);
        pixelMap[x][y] = undefined;
        pixelLifecycleListeners.slice().forEach((listener) => listener({type: "delete", pixel, old}));
    }

    function changePixel(pixel, elementName) {
        const old = {element: pixel.element, x: pixel.x, y: pixel.y, treeLineage: pixel.treeLineage, treeId: pixel.treeId, civPlantedTreeId: pixel.civPlantedTreeId};
        const oldDefinition = elements[pixel.element];
        if (oldDefinition && oldDefinition.onChange) oldDefinition.onChange(pixel, elementName);
        const definition = elements[elementName] || elements.unknown;
        pixel.element = elements[elementName] ? elementName : "unknown";
        pixel.color = pixelColorPick(pixel);
        pixel.start = sandbox.pixelTicks;
        Object.assign(pixel, cloneProperties(definition.properties));
        if (definition.onPlace) definition.onPlace(pixel);
        pixelLifecycleListeners.slice().forEach((listener) => listener({type: "change", pixel, old}));
    }

    function movePixel(pixel, x, y) {
        if (!isEmpty(x, y)) return false;
        pixelMap[pixel.x][pixel.y] = undefined;
        pixel.x = x;
        pixel.y = y;
        pixelMap[x][y] = pixel;
        return true;
    }

    function tryMoveRelation(relation, dirX, dirY) {
        if (!opts.relationMovement || !relation || !Array.isArray(relation.p)) return false;
        const parts = relation.p.filter((pixel) => pixel && !pixel.del);
        const partSet = new Set(parts);
        for (const pixel of parts) {
            const x = pixel.x + dirX;
            const y = pixel.y + dirY;
            if (outOfBounds(x, y)) return false;
            const occupant = getPixel(x, y);
            if (occupant && !partSet.has(occupant)) return false;
        }
        for (const pixel of parts) {
            if (getPixel(pixel.x, pixel.y) === pixel) pixelMap[pixel.x][pixel.y] = undefined;
        }
        for (const pixel of parts) {
            pixel.x += dirX;
            pixel.y += dirY;
            pixelMap[pixel.x][pixel.y] = pixel;
        }
        return true;
    }

    function getPixelByElement(x, y, elementName) {
        if (elementName === "civ_tunnel" && Array.isArray(opts.tunnelCells) && opts.tunnelCells.includes(`${x},${y}`)) {
            return {x, y, element: "civ_tunnel"};
        }
        const pixel = getPixel(x, y);
        if (pixel && pixel.element === elementName) return pixel;
        return overlayPixels.find((candidate) => candidate && !candidate.del && candidate.x === x && candidate.y === y && candidate.element === elementName) || null;
    }

    let domCanvasListeners = null;
    let domDocument = null;
    if (opts.dom) {
        domCanvasListeners = {mousedown: [], mousemove: [], touchstart: []};
        // Permissive DOM element stub. Reads of common structural properties return
        // usable objects; method calls are no-ops; everything else is writable. This lets
        // installCivilizationUi()/refreshCivilizationUi() run without a real DOM.
        function makeElement(id) {
            const store = {id: id || "", value: "", textContent: "", className: "", type: "", title: "", disabled: false};
            const seeds = {style: {}, classList: {add() {}, remove() {}, toggle() {}, contains() { return false; }}, dataset: {}};
            const proxy = new Proxy(store, {
                get(target, prop) {
                    if (prop in target) return target[prop];
                    if (prop in seeds) return seeds[prop];
                    if (prop === "appendChild" || prop === "insertBefore" || prop === "removeChild") return (node) => node;
                    if (prop === "addEventListener" || prop === "removeEventListener" || prop === "setAttribute" || prop === "focus" || prop === "blur" || prop === "click" || prop === "remove") return () => {};
                    if (prop === "getAttribute") return () => null;
                    if (prop === "querySelector" || prop === "closest") return () => null;
                    if (prop === "querySelectorAll" || prop === "children") return [];
                    if (prop === Symbol.toPrimitive) return () => "";
                    return undefined;
                },
                set(target, prop, val) { target[prop] = val; return true; }
            });
            return proxy;
        }
        const registry = new Map();
        const canvas = makeElement("game");
        canvas.addEventListener = function (type, handler) {
            if (domCanvasListeners[type]) domCanvasListeners[type].push(handler);
        };
        registry.set("game", canvas);
        domDocument = {
            readyState: "complete",
            head: makeElement("head"),
            body: makeElement("body"),
            createElement(tag) { return makeElement(""); },
            getElementById(id) {
                if (registry.has(id)) return registry.get(id);
                // Elements the adapter looks up before creating: report absent so it builds them.
                if (id === "civilizationParent" || id === "toolControls" || id === "settingsButton" || id === "civilizationButton") {
                    if (id === "civilizationParent" && registry.has("__civParentBuilt")) {
                        return registry.get("__civParentBuilt");
                    }
                    return null;
                }
                const el = makeElement(id);
                registry.set(id, el);
                return el;
            }
        };
        // openCivilizationPanel() needs a persistent parent whose style.display we can assert.
        registry.set("__civParentBuilt", makeElement("civilizationParent"));
    }

    const sandbox = {
        HumanSocietyCore: opts.core || Core,
        HumanSocietyWorld: World,
        elements,
        behaviors: {WALL: wallBehavior, POWDER: powderBehavior},
        currentPixels,
        pixelMap,
        currentRelations,
        pixelTicks: 0,
        width: width - 1,
        height: height - 1,
        defaultCooldown: 1,
        performance: {now: () => 0},
        Math: Object.create(Math),
        JSON,
        Map,
        Set,
        Object,
        Number,
        Date,
        console,
        getPixel,
        isEmpty,
        outOfBounds,
        pixelColorPick,
        getPixelByElement,
        createPixel,
        deletePixel,
        changePixel,
        movePixel,
        tryMove(pixel, x, y) {
            return movePixel(pixel, x, y);
        },
        tryMoveRelation,
        getRelation,
        addToRelation,
        removeFromRelation,
        runEveryTick(callback) { everyTickCallbacks.push(callback); },
        runAfterReset(callback) { resetCallbacks.push(callback); },
        addPixelLifecycleListener(callback) { if (!pixelLifecycleListeners.includes(callback)) pixelLifecycleListeners.push(callback); },
        doHeat() {},
        doBurning() {},
        doElectricity() {},
        pixelTempCheck() {},
        drawSquare() {},
        canvasCoord(value) { return value; },
        pixelSize: 1,
        mousePos: {x: 0, y: 0},
        settings: {humanSocietyPeaceMode: "normal"},
        HumanSocietyPathfinding: Pathfinding,
        saveSettings() {},
        getPixelsAt(x, y) {
            const pixel = getPixel(x, y);
            const pixels = pixel ? [pixel] : [];
            overlayPixels.forEach((overlay) => {
                if (overlay && !overlay.del && overlay.x === x && overlay.y === y) pixels.push(overlay);
            });
            return pixels;
        }
    };

    if (Array.isArray(opts.overlayStorageElements)) sandbox.deletePixelObject = deletePixelObject;

    if (Array.isArray(opts.overlapElements)) {
        sandbox.pixelsCanOverlap = function (first, second) {
            return !!(first && second && (opts.overlapElements.includes(first.element) || opts.overlapElements.includes(second.element)));
        };
    }

    if (opts.dom) {
        sandbox.document = domDocument;
        sandbox.getMousePos = function (canvas, event) {
            const source = event.touches ? event.touches[0] : event;
            return {x: source.clientX, y: source.clientY};
        };
        sandbox.addEventListener = function () {};
        sandbox.removeEventListener = function () {};
    }

    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    if (opts.techData) {
        vm.runInContext(techDataSource, sandbox, {filename: "scripts/human_society_tech_data.js"});
    }
    vm.runInContext(societySource, sandbox, {filename: "scripts/human_society.js"});

    return {
        sandbox,
        elements,
        currentPixels,
        currentRelations,
        everyTickCallbacks,
        resetCallbacks,
        wallBehavior,
        powderBehavior,
        getPixel,
        createPixel,
        changePixel,
        domCanvasListeners,
        domDocument
    };
}

test("browser adapter loads and registers the civilization API and elements", () => {
    const harness = createHarness();
    const api = harness.sandbox.HumanSociety;

    assert.ok(api);
    for (const method of [
        "registerResource", "registerWeapon", "damageActor", "damageStructure",
        "recordIncident", "atWar", "forceReindex", "getDebugSnapshot",
        "getPeaceMode", "setPeaceMode", "setCommandPerson", "cancelPersonCommand", "issuePersonCommandAt", "getPersonCommandState",
        "setInteractionMode", "getInteractionMode",
        "getPeopleSnapshot", "getPersonSnapshot", "getPersonHistory"
    ]) {
        assert.equal(typeof api[method], "function", `${method} should be public`);
    }
    for (const elementName of [
        "civilized_human", "civ_body", "civ_head", "civ_child", "civ_banner",
        "civ_hut_core", "civ_farm_marker", "civ_workshop_core", "civ_construction",
        "civ_structure_wood", "civ_structure_stone", "civ_ruin"
    ]) {
        assert.ok(harness.elements[elementName], `${elementName} should be registered`);
    }
    for (const elementName of [
        "civ_wood_resource", "civ_tree_sapling_resource", "civ_food_resource", "civ_stone_resource",
        "civ_copper_resource", "civ_tin_resource", "civ_raw_iron_resource", "civ_charcoal_resource",
        "civ_seed_resource", "civ_resource_drop"
    ]) {
        assert.equal(harness.elements[elementName].behavior, harness.powderBehavior, `${elementName} should fall under gravity`);
        assert.equal(harness.elements[elementName].humanCollectible, true, `${elementName} should overlap civilization humans`);
        assert.equal(harness.elements[elementName].properties._civResourceDrop, true);
    }
    for (const removedMethod of [
        "getElementOverlapDirectory", "setElementOverlapDirectory", "getElementInteractionSettings",
        "setElementInteractionSettings", "resetElementInteractionSettings"
    ]) {
        assert.equal(api[removedMethod], undefined, `${removedMethod} should no longer be public`);
    }
    assert.equal(harness.everyTickCallbacks.length, 1);
    assert.equal(harness.resetCallbacks.length, 1);
});

test("periodic index maintenance audits pixels without repeating a synchronous full rebuild", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.sandbox.pixelTicks = 30;
    harness.everyTickCallbacks[0]();
    const initial = harness.sandbox.HumanSociety.getDebugSnapshot().indexAudit;

    harness.sandbox.pixelTicks = 330;
    harness.everyTickCallbacks[0]();
    const audited = harness.sandbox.HumanSociety.getDebugSnapshot().indexAudit;

    assert.equal(audited.lastFullRebuildTick, initial.lastFullRebuildTick);
    assert.equal(audited.lastStartedTick, 330);
    assert.ok(audited.pixelsChecked > initial.pixelsChecked);
    assert.equal(audited.lastCompletedTick, 330, "small maps finish the bounded audit in one maintenance slice");
});

test("lifecycle events update resources immediately and rebuild only the changed tree lineage", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.sandbox.pixelTicks = 30;
    harness.everyTickCallbacks[0]();
    const initial = harness.sandbox.HumanSociety.getDebugSnapshot().indexAudit;

    const apple = harness.createPixel("apple", 20, 9);
    const afterCreate = harness.sandbox.HumanSociety.getDebugSnapshot().indexAudit;
    assert.equal(afterCreate.resourceNodes, initial.resourceNodes + 1);
    harness.changePixel(apple, "dirt");
    const afterChange = harness.sandbox.HumanSociety.getDebugSnapshot().indexAudit;
    assert.equal(afterChange.resourceNodes, initial.resourceNodes);

    harness.createPixel("tree_branch", 24, 9, {naturalVegetation: true, treeLineage: "incremental-tree"});
    harness.createPixel("plant", 24, 8, {naturalVegetation: true, treeLineage: "incremental-tree"});
    harness.sandbox.pixelTicks = 31;
    harness.everyTickCallbacks[0]();
    const afterTree = harness.sandbox.HumanSociety.getDebugSnapshot().indexAudit;
    assert.equal(afterTree.trees, initial.trees + 1);
    assert.equal(afterTree.resourceNodes, initial.resourceNodes + 1);
    assert.equal(afterTree.lastFullRebuildTick, initial.lastFullRebuildTick);
});

test("incremental audits preserve indexed trees as harvestable wood resources", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    const root = harness.createPixel("tree_branch", 24, 9, {naturalVegetation: true, treeLineage: "audited-tree"});
    const branch = harness.createPixel("wood", 24, 8, {naturalVegetation: true, treeLineage: "audited-tree"});
    const leaf = harness.createPixel("plant", 24, 7, {naturalVegetation: true, treeLineage: "audited-tree"});
    harness.sandbox.pixelTicks = 30;
    harness.everyTickCallbacks[0]();
    const beforeAudit = harness.sandbox.HumanSociety.getDebugSnapshot().indexAudit;

    harness.sandbox.pixelTicks = 330;
    harness.everyTickCallbacks[0]();
    const afterAudit = harness.sandbox.HumanSociety.getDebugSnapshot().indexAudit;

    assert.equal(afterAudit.trees, beforeAudit.trees);
    assert.equal(afterAudit.resourceNodes, beforeAudit.resourceNodes);
    const result = harness.sandbox.HumanSociety.fellTreeAt(root.x, root.y);
    assert.equal(result.removedPixels, 3);
    assert.equal(root.del, true);
    assert.equal(branch.del, true);
    assert.equal(leaf.del, true);
});

test("civilized humans have bounded natural lifespans and never acquire hunger state", () => {
    const harness = createHarness({techData: true});
    harness.createPixel("civilized_human", 8, 7);
    const head = harness.getPixel(8, 7);
    const body = harness.getPixel(8, 8);
    const child = harness.createPixel("civ_child", 12, 8);
    body.hunger = 1;
    body.lastHungerTick = 10;
    harness.sandbox.HumanSociety.forceReindex();

    for (const actor of [head, body, child]) {
        assert.equal(Object.prototype.hasOwnProperty.call(actor, "hunger"), false);
    }
    for (const actor of [body, child]) {
        assert.equal(Number.isInteger(actor.lifespanYears), true);
        assert.ok(actor.lifespanYears >= 50 && actor.lifespanYears <= 60);
        assert.equal(
            actor.naturalDeathTick,
            actor.birthTick + actor.lifespanYears * harness.sandbox.HumanSociety.config.TICKS_PER_YEAR
        );
    }

    const startingHp = body.hp;
    harness.sandbox.pixelTicks = body.birthTick + 49 * harness.sandbox.HumanSociety.config.TICKS_PER_YEAR;
    harness.elements.civ_body.tick(body);
    assert.equal(body.hp, startingHp);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "hunger"), false);

    harness.sandbox.pixelTicks = body.naturalDeathTick;
    harness.elements.civ_body.tick(body);
    assert.equal(body.deathCause, "old_age");
    assert.equal(body.dead, body.naturalDeathTick);
});

test("adult relations fall when unsupported but never fall while occupying a tunnel", () => {
    const fallingHarness = createHarness({techData: true, relationMovement: true});
    fallingHarness.createPixel("civilized_human", 8, 5);
    const fallingHead = fallingHarness.getPixel(8, 5);
    const fallingBody = fallingHarness.getPixel(8, 6);
    fallingHarness.sandbox.pixelTicks = 2;
    fallingHarness.elements.civ_body.tick(fallingBody);
    assert.equal(fallingHead.y, 6);
    assert.equal(fallingBody.y, 7);

    const tunnelHarness = createHarness({techData: true, relationMovement: true, tunnelCells: ["12,5", "12,6"]});
    tunnelHarness.createPixel("civilized_human", 12, 5);
    const tunnelHead = tunnelHarness.getPixel(12, 5);
    const tunnelBody = tunnelHarness.getPixel(12, 6);
    tunnelHarness.sandbox.pixelTicks = 2;
    tunnelHarness.elements.civ_body.tick(tunnelBody);
    assert.equal(tunnelHead.y, 5);
    assert.equal(tunnelBody.y, 6);
});

test("directed adults climb one-block steps without a separate vertical pause", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 20; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("rock", 9, 9);
    harness.createPixel("civilized_human", 8, 8);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    assert.equal(api.issuePersonCommandAt(body.humanId, 2, 12, 8).accepted, true);
    const moveTick = (2 - ((0 + body.humanId) % 2)) % 2;
    harness.sandbox.pixelTicks = moveTick;
    harness.elements.civ_body.tick(body);
    assert.equal(body.x, 9);
    assert.equal(body.y, 8);
    assert.equal(body.pathStage, "step");
});

test("collectible resources allow free horizontal travel without forcing a climb", () => {
    const resourceOverlay = {x: 8, y: 9, element: "civ_stone_resource", _civCollectible: true};
    const harness = createHarness({relationMovement: true, overlayPixels: [resourceOverlay], overlapElements: ["civ_stone_resource"]});
    for (let x = 1; x <= 20; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    assert.equal(api.issuePersonCommandAt(body.humanId, 2, 14, 9).accepted, true);
    body.targetY = 8;
    body.playerOrder.y = 8;

    const moveTick = (2 - ((0 + body.humanId) % 2)) % 2;
    harness.sandbox.pixelTicks = moveTick;
    harness.elements.civ_body.tick(body);

    assert.equal(body.x, 9);
    assert.equal(body.y, 9);
    assert.equal(body.pathStage, "flat");
});

test("a same-column target climbs vertically through a collectible resource", () => {
    const resourceOverlay = {x: 8, y: 9, element: "civ_stone_resource", _civCollectible: true};
    const harness = createHarness({relationMovement: true, overlayPixels: [resourceOverlay], overlapElements: ["civ_stone_resource"]});
    for (let x = 1; x <= 20; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    assert.equal(api.issuePersonCommandAt(body.humanId, 2, 14, 9).accepted, true);
    body.targetX = 8;
    body.targetY = 7;
    body.playerOrder.x = 8;
    body.playerOrder.y = 7;

    const moveTick = (2 - ((0 + body.humanId) % 2)) % 2;
    harness.sandbox.pixelTicks = moveTick;
    harness.elements.civ_body.tick(body);

    assert.equal(body.x, 8);
    assert.equal(body.y, 8);
    assert.equal(body.pathStage, "climb");
    assert.ok(body.climbHoldUntil >= moveTick + 2);
});

test("an overlap-compatible resource never triggers the stalled-route tunnel fallback", () => {
    const harness = createHarness({relationMovement: true, overlapElements: ["civ_stone_resource"]});
    for (let x = 1; x <= 20; x++) harness.createPixel("rock", x, 10);
    const resource = harness.createPixel("civ_stone_resource", 9, 9);
    harness.createPixel("civilized_human", 8, 8);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    assert.equal(api.issuePersonCommandAt(body.humanId, 2, 14, 9).accepted, true);

    let moveTick = (2 - ((0 + body.humanId) % 2)) % 2;
    for (let attempt = 0; attempt < 20; attempt++, moveTick += 2) {
        harness.sandbox.pixelTicks = moveTick;
        harness.elements.civ_body.tick(body);
    }

    assert.equal(resource.element, "civ_stone_resource");
    assert.notEqual(body.pathStage, "tunnel");
    assert.notEqual(body.pathCache && body.pathCache.forceTunnel, true);
    assert.equal(harness.currentPixels.some((pixel) => !pixel.del && pixel.element === "civ_tunnel"), false);
});

test("six-cell walls are climbed while seven-cell walls make every role carve a tunnel", () => {
    function prepare(height) {
        const harness = createHarness({relationMovement: true});
        for (let x = 1; x <= 20; x++) harness.createPixel("rock", x, 10);
        for (let y = 9; y >= 10 - height; y--) harness.createPixel("rock", 9, y);
        harness.createPixel("civilized_human", 8, 8);
        const api = harness.sandbox.HumanSociety;
        api.forceReindex();
        const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
        body.role = "food";
        assert.equal(api.issuePersonCommandAt(body.humanId, 2, 12, 9).accepted, true);
        const tick = (2 - ((0 + body.humanId) % 2)) % 2;
        for (let attempt = 0; attempt < 20; attempt++) {
            harness.sandbox.pixelTicks = tick + attempt * 2;
            harness.elements.civ_body.tick(body);
            if (body.pathStage === "climb" || harness.getPixel(9, 9).element === "civ_tunnel") break;
        }
        return {harness, body};
    }

    const six = prepare(6);
    assert.equal(six.harness.getPixel(9, 9).element, "rock");
    assert.equal(six.body.pathStage, "climb");

    const seven = prepare(7);
    assert.equal(seven.harness.getPixel(9, 9).element, "civ_tunnel");
    assert.equal(seven.harness.getPixel(9, 8).element, "civ_tunnel");
    assert.equal(seven.body.pathCache.searchMode, "tunnel");
    assert.equal(seven.body.carry.stone, undefined, "non-miners destroy traversal material without collecting it");
});

test("directed adults crest a six-cell wall and descend onto the ground behind it", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 24; x++) harness.createPixel("rock", x, 12);
    for (let y = 11; y >= 6; y--) harness.createPixel("rock", 10, y);
    harness.createPixel("civilized_human", 8, 10);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    assert.equal(api.issuePersonCommandAt(body.humanId, 2, 15, 11).accepted, true);

    for (let tick = 1; tick <= 180 && body.x < 14; tick++) {
        harness.sandbox.pixelTicks = tick;
        harness.elements.civ_body.tick(body);
    }

    assert.ok(body.x >= 14, `expected the person beyond the wall, got (${body.x}, ${body.y})`);
    assert.ok(body.y >= 10, `expected the person to descend toward the ground, got y=${body.y}`);
});

test("a controlled adult follows a far multi-turn route across several walls", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 52; x++) harness.createPixel("rock", x, 16);
    for (let y = 15; y >= 13; y--) harness.createPixel("rock", 16, y);
    for (let y = 15; y >= 12; y--) harness.createPixel("rock", 31, y);
    harness.createPixel("civilized_human", 8, 14);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    assert.equal(api.issuePersonCommandAt(body.humanId, 2, 46, 15).accepted, true);

    let sawClimb = false;
    let sawDescent = false;
    for (let tick = 1; tick <= 600 && body.playerOrder; tick++) {
        harness.sandbox.pixelTicks = tick;
        harness.elements.civ_body.tick(body);
        if (body.pathStage === "climb" || body.pathStage === "top") sawClimb = true;
        if (body.pathStage === "down" || body.pathStage === "ledge") sawDescent = true;
    }

    assert.ok(body.x >= 45, `expected the person near the far goal, got (${body.x}, ${body.y})`);
    assert.equal(body.playerOrder, undefined);
    assert.equal(sawClimb, true);
    assert.equal(sawDescent, true);
    assert.equal(harness.currentPixels.some((pixel) => !pixel.del && pixel.element === "civ_tunnel"), false);
});

test("an invalidated next edge is rejected and replanned instead of retried forever", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 32; x++) harness.createPixel("rock", x, 12);
    harness.createPixel("civilized_human", 8, 10);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    const command = api.issuePersonCommandAt(body.humanId, 2, 25, 11);
    assert.equal(command.accepted, true);

    let tick = (2 - ((0 + body.humanId) % 2)) % 2;
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);
    const next = body.pathCache.path[body.pathCache.pathIndex];
    assert.ok(next);
    harness.createPixel("rock", next.x, next.y);

    tick += 2;
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);
    assert.equal(body.pathCache.replanReason, "next_edge_invalid");
    assert.ok(body.pathCache.lastInvalidStep);

    for (let attempt = 0; attempt < 240 && body.playerOrder; attempt++) {
        tick += 2;
        harness.sandbox.pixelTicks = tick;
        harness.elements.civ_body.tick(body);
    }
    assert.equal(body.playerOrder, undefined);
    assert.ok(body.x > next.x, `expected replanning to pass the new obstacle, got (${body.x}, ${body.y})`);
    const history = api.getPersonHistory(body.humanId, {limit: 20}).entries;
    assert.ok(history.some((entry) => entry.task === "move" && entry.status === "completed" && entry.reason === "destination_reached"));
});

test("person snapshots expose the active A* route and its remaining work", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 24; x++) harness.createPixel("rock", x, 12);
    harness.createPixel("civilized_human", 8, 10);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    assert.equal(api.issuePersonCommandAt(body.humanId, 2, 15, 11).accepted, true);
    const tick = (2 - ((0 + body.humanId) % 2)) % 2;
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);

    const route = api.getPersonSnapshot(body.humanId).route;
    assert.equal(body.pathCache.version, 4);
    assert.equal(route.phase, "outbound");
    assert.deepEqual(JSON.parse(JSON.stringify(route.goal)), {x: 15, y: 11, radius: 1, task: "move", targetId: null, targetKind: "command_destination"});
    assert.equal(route.mode, "astar");
    assert.ok(route.nextAction);
    assert.ok(route.remainingSteps > 0);
});

test("gatherers batch the same resource, return their real trail, and unload", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 32; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 13, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const body = harness.getPixel(8, 9);
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner" && pixel.settlementId === body.settlementId);
    const initialFood = banner.stock.food;
    for (const x of [1, 3, 5, 7]) harness.createPixel("apple", x, 9);
    body.role = "food";
    body.task = "planning";
    harness.sandbox.HumanSociety.forceReindex();

    for (let tick = 100; tick <= 1200 && banner.stock.food < initialFood + 4; tick++) {
        harness.sandbox.pixelTicks = tick;
        harness.elements.civ_body.tick(body);
    }

    assert.equal(banner.stock.food, initialFood + 4);
    assert.equal(body.carry.food || 0, 0);
    assert.ok(body.x >= 8, `expected a return toward the settlement, got x=${body.x}`);
    const history = harness.sandbox.HumanSociety.getPersonHistory(body.humanId, {limit: 50}).entries;
    assert.ok(history.some((entry) => entry.type === "return_started"));
    assert.ok(history.some((entry) => entry.type === "resources_unloaded"));
});

test("a blocked recorded return path immediately switches to a repair route", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 24; x++) harness.createPixel("rock", x, 12);
    harness.createPixel("civilized_human", 10, 10);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    body.task = "deliver";
    body.targetX = 4;
    body.targetY = 11;
    body.targetKind = "civ_banner";
    body.workTrip = {version: 1, resourceKind: "stone", phase: "return", trail: [[8, 11], [9, 11], [10, 11]], returning: true, returnCursor: 1};
    harness.createPixel("rock", 9, 11);
    const tick = (2 - ((0 + body.humanId) % 2)) % 2;
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);

    const route = api.getPersonSnapshot(body.humanId).route;
    assert.equal(body.workTrip.returning, false);
    assert.equal(route.blockedReason, "recorded_return_path_blocked");
    assert.equal(route.phase, "return");
});

test("a low target uses a planned shaft and miners keep excavated stone", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 24; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const body = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    body.role = "miner";
    assert.equal(api.issuePersonCommandAt(body.humanId, 2, 14, 15).accepted, true);
    const tick = (2 - ((0 + body.humanId) % 2)) % 2;
    for (let attempt = 0; attempt < 80 && !harness.currentPixels.some((pixel) => !pixel.del && pixel.element === "civ_tunnel"); attempt++) {
        harness.sandbox.pixelTicks = tick + attempt * 2;
        harness.elements.civ_body.tick(body);
    }

    const route = api.getPersonSnapshot(body.humanId).route;
    assert.equal(route.mode, "astar");
    assert.equal(route.searchMode, "tunnel");
    assert.equal(route.nextAction.action, "tunnel");
    assert.ok(harness.currentPixels.some((pixel) => !pixel.del && pixel.element === "civ_tunnel"));
    assert.equal(body.carry.stone, 1);
    assert.equal(societySource.includes('createPixel("civ_tunnel"'), false, "empty cells must never create tunnel pixels");
});

test("floating high resources remain unassigned until continuous climb support exists", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 28; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 13, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const body = harness.getPixel(8, 9);
    const apple = harness.createPixel("apple", 18, 4);
    body.role = "food";
    body.task = "planning";
    harness.sandbox.HumanSociety.forceReindex();
    let tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);
    assert.notEqual(body.targetKey, "apple@18,4");

    for (let y = 5; y <= 9; y++) harness.createPixel("rock", 18, y);
    body.task = "planning";
    body.lastPlanTick = -1;
    harness.sandbox.HumanSociety.forceReindex();
    tick += 10;
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);
    assert.equal(body.task, "harvest");
    assert.equal(body.targetKey, "apple@18,4");
    assert.equal(apple.del, undefined);
});

test("technology boot registers the expanded structures as static civilization elements", () => {

    const harness = createHarness({techData: true});
    const buildingCores = [
        "civ_hearth_core", "civ_quarry_core", "civ_granary_core", "civ_kiln_core",
        "civ_foundry_core", "civ_forge_core", "civ_keep_core", "civ_siege_workshop_core",
        "civ_library_core", "civ_market_core", "civ_tower_core", "civ_lumberyard_core", "civ_gate"
    ];
    for (const elementName of buildingCores) {
        assert.ok(harness.elements[elementName], `${elementName} should be registered`);
        assert.equal(harness.elements[elementName].behavior, harness.wallBehavior);
        assert.equal(harness.elements[elementName].category, "civilization");
        assert.equal(harness.elements[elementName].alwaysOverlay, true);
        assert.equal(harness.elements[elementName].nonBlocking, true);
        assert.equal(harness.elements[elementName].eraseProtected, true);
        assert.equal(harness.elements[elementName].isBuildingCore, true);
    }
    assert.equal(harness.elements.civ_palisade.isBuildingCore, undefined, "legacy wall pixels are not logical building cores");
});

test("placing civilized_human materializes a head/body pair with one identity and relation", () => {
    const harness = createHarness();
    harness.createPixel("civilized_human", 8, 7);

    const head = harness.getPixel(8, 7);
    const body = harness.getPixel(8, 8);
    assert.equal(head.element, "civ_head");
    assert.equal(body.element, "civ_body");
    assert.equal(Number.isFinite(head.humanId), true);
    assert.equal(head.humanId, body.humanId);
    assert.equal(head.factionId, body.factionId);
    assert.equal(head._r, body._r);
    assert.deepEqual(new Set(harness.currentRelations[body._r].p), new Set([head, body]));
});

test("a body thermal conversion runs onChange and detaches it from its relation", () => {
    const harness = createHarness();
    harness.createPixel("civilized_human", 11, 6);
    const head = harness.getPixel(11, 6);
    const body = harness.getPixel(11, 7);
    const relationId = body._r;

    harness.changePixel(body, harness.elements.civ_body.stateHigh);

    assert.equal(body.element, "cooked_meat");
    assert.equal(body._r, undefined);
    assert.equal(body.humanId, undefined);
    assert.equal(head._r, relationId);
    assert.deepEqual(harness.currentRelations[relationId].p, [head]);
});

test("reindex repairs a saved head identity from its authoritative body relation", () => {
    const harness = createHarness();
    harness.createPixel("civilized_human", 10, 6);
    const head = harness.getPixel(10, 6);
    const body = harness.getPixel(10, 7);
    delete head.humanId;
    delete head.factionId;
    head.settlementId = 999;

    harness.sandbox.HumanSociety.forceReindex();

    assert.equal(head.humanId, body.humanId);
    assert.equal(head.factionId, body.factionId);
    assert.equal(head.settlementId, body.settlementId);
});

test("legacy children convert into unified workers and living filters remain stable", () => {
    const harness = createHarness();
    harness.createPixel("civilized_human", 8, 7);
    const adult = harness.getPixel(8, 8);
    adult.settlementId = 11;
    const child = harness.createPixel("civ_child", 30, 8, {
        humanId: 99,
        factionId: 42,
        settlementId: 12,
        factionColor: "#336699",
        task: "idle"
    });
    harness.sandbox.HumanSociety.forceReindex();
    harness.sandbox.pixelTicks = 1;
    harness.elements.civ_child.tick(child);
    const converted = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_body" && pixel.humanId === 99);
    assert.ok(converted);

    const api = harness.sandbox.HumanSociety;
    const allLiving = api.getPeopleSnapshot({status: "living"});
    assert.equal(typeof allLiving.updatedAt, "string");
    assert.equal(allLiving.tick, harness.sandbox.pixelTicks);
    assert.deepEqual(
        {living: allLiving.counts.living, deceased: allLiving.counts.deceased, filtered: allLiving.counts.filtered},
        {living: 2, deceased: 0, filtered: 2}
    );
    assert.deepEqual(Array.from(allLiving.people, (person) => person.humanId), [adult.humanId, converted.humanId]);
    for (const person of allLiving.people) {
        assert.equal(person.status, "living");
        assert.equal(typeof person.role, "string");
        assert.equal(typeof person.task, "string");
        assert.ok(person.currentActivity);
    }

    const convertedOnly = api.getPeopleSnapshot({
        status: "living",
        factionId: converted.factionId,
        settlementId: converted.settlementId,
        role: "worker",
        query: "H99"
    });
    assert.equal(convertedOnly.counts.filtered, 1);
    assert.equal(convertedOnly.people[0].humanId, converted.humanId);
    assert.equal(api.getPersonSnapshot(converted.humanId).humanId, converted.humanId);
    assert.equal(api.getPersonSnapshot(123456), null);
});

test("semantic task sessions are deduplicated and close once when their target dies", () => {
    const harness = createHarness();
    for (let x = 1; x <= 90; x++) harness.createPixel("rock", x, 12);
    harness.createPixel("civilized_human", 8, 10);
    harness.createPixel("civilized_human", 70, 10);
    const victim = harness.getPixel(8, 11);
    const attacker = harness.getPixel(70, 11);
    attacker.factionId = victim.factionId + 1;
    harness.sandbox.HumanSociety.forceReindex();

    const api = harness.sandbox.HumanSociety;
    harness.sandbox.pixelTicks = 1;
    assert.equal(api.damageActor(victim, 1, attacker), true);
    harness.sandbox.pixelTicks = 2;
    assert.equal(api.damageActor(victim, 1, attacker), true);
    const active = api.getPersonSnapshot(victim.humanId);
    assert.equal(active.task, "combat");
    assert.equal(active.currentActivity.task, "combat");
    assert.equal(active.currentActivity.targetId, attacker.humanId);
    assert.equal(api.getPersonHistory(victim.humanId, {limit: 500}).entries.filter((entry) => entry.task === "combat").length, 0);

    harness.sandbox.pixelTicks = 3;
    api.damageActor(attacker, 1000, victim);
    const thinkInterval = api.config.THINK_INTERVAL;
    const clearTick = 4 + ((thinkInterval - ((4 + victim.humanId) % thinkInterval)) % thinkInterval);
    harness.sandbox.pixelTicks = clearTick;
    harness.elements.civ_body.tick(victim);

    const history = api.getPersonHistory(victim.humanId, {limit: 500});
    const combatEntries = history.entries.filter((entry) => entry.task === "combat");
    assert.equal(combatEntries.length, 1);
    assert.ok(combatEntries[0].endedAt);
    assert.ok(["completed", "interrupted", "failed"].includes(combatEntries[0].status));
});

test("person history retains only the newest five hundred completed sessions", () => {
    const harness = createHarness();
    harness.createPixel("civilized_human", 8, 7);
    const actor = harness.getPixel(8, 8);
    const sources = [
        {humanId: 7001, factionId: actor.factionId + 1, x: 30, y: 8, element: "civ_body"},
        {humanId: 7002, factionId: actor.factionId + 1, x: 31, y: 8, element: "civ_body"}
    ];
    const api = harness.sandbox.HumanSociety;

    for (let index = 0; index < 505; index++) {
        actor.combatTargetId = undefined;
        actor.task = "idle";
        harness.sandbox.pixelTicks = index + 1;
        assert.equal(api.damageActor(actor, 0.01, sources[index % sources.length]), true);
    }

    const history = api.getPersonHistory(actor.humanId, {limit: 500});
    assert.equal(history.entries.length, 500);
    assert.equal(history.totalRetained, 500);
    assert.equal(history.hasMore, false);
    assert.equal(history.nextCursor, null);
    for (let index = 1; index < history.entries.length; index++) {
        assert.ok(history.entries[index - 1].sequence > history.entries[index].sequence, "history must be newest first");
    }

    const firstPage = api.getPersonHistory(actor.humanId, {limit: 20});
    assert.equal(firstPage.entries.length, 20);
    assert.equal(firstPage.hasMore, true);
    assert.equal(firstPage.nextCursor, firstPage.entries.at(-1).sequence);
    const secondPage = api.getPersonHistory(actor.humanId, {limit: 20, beforeSequence: firstPage.nextCursor});
    assert.equal(secondPage.entries.length, 20);
    assert.ok(secondPage.entries.every((entry) => entry.sequence < firstPage.nextCursor));
    assert.equal(
        secondPage.entries.some((entry) => firstPage.entries.some((firstEntry) => firstEntry.sequence === entry.sequence)),
        false
    );
});

test("death archives a settled person exactly once across repeated damage and reindexing", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const actor = harness.getPixel(8, 9);
    const humanId = actor.humanId;
    const api = harness.sandbox.HumanSociety;

    harness.sandbox.pixelTicks = 100;
    assert.equal(api.damageActor(actor, 1000, {factionId: actor.factionId + 1}), true);
    assert.equal(api.damageActor(actor, 1000, {factionId: actor.factionId + 1}), false);
    api.forceReindex();
    api.forceReindex();

    const deceased = api.getPeopleSnapshot({status: "deceased", settlementId: actor.settlementId});
    assert.equal(deceased.counts.deceased, 1);
    assert.equal(deceased.counts.filtered, 1);
    assert.equal(deceased.people[0].humanId, humanId);
    assert.equal(deceased.people[0].status, "deceased");
    const archived = api.getPersonSnapshot(humanId);
    assert.equal(archived.status, "deceased");
    assert.equal(archived.currentActivity, null);
    const history = api.getPersonHistory(humanId, {limit: 500});
    assert.equal(history.entries.filter((entry) => entry.status === "death").length, 1);
});

test("a settlement retains only its newest five hundred deceased people", () => {
    const harness = createHarness();
    const deceasedPeople = Array.from({length: 501}, (_, index) => ({
        h: index + 1,
        f: 7,
        l: 17,
        e: "civ_body",
        dt: index + 1,
        dc: "old_age",
        r: "worker"
    }));
    const banner = harness.createPixel("civ_banner", 40, 8, {
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        deceasedPeople
    });
    const api = harness.sandbox.HumanSociety;

    api.forceReindex();

    assert.equal(banner.deceasedPeople.length, api.config.MAX_DECEASED_PER_SETTLEMENT);
    assert.equal(banner.deceasedPeople[0].h, 2, "the oldest archived identity is evicted first");
    assert.equal(banner.deceasedPeople.at(-1).h, 501);
    const snapshot = api.getPeopleSnapshot({status: "deceased", settlementId: 17});
    assert.equal(snapshot.counts.filtered, 500);
    assert.equal(api.getPersonSnapshot(1), null);
    assert.equal(api.getPersonSnapshot(2).status, "deceased");
    assert.equal(api.getPersonSnapshot(501).status, "deceased");
});

test("human ids archived in a loaded settlement are never reused", () => {
    const harness = createHarness();
    harness.createPixel("civ_banner", 40, 8, {
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        deceasedPeople: [{
            h: 700,
            f: 7,
            l: 17,
            e: "civ_body",
            dt: 100,
            dc: "old_age",
            r: "worker"
        }]
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();

    harness.createPixel("civilized_human", 8, 7);
    const newcomer = harness.getPixel(8, 8);

    assert.equal(api.getPersonSnapshot(700).status, "deceased");
    assert.ok(newcomer.humanId > 700);
    assert.notEqual(newcomer.humanId, 700);
});

test("role changes are recorded once and stable role assignments add no duplicate events", () => {
    const harness = createHarness();
    harness.createPixel("civ_banner", 40, 8, {
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699"
    });
    const actor = harness.createPixel("civ_body", 8, 8, {
        humanId: 100,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "worker",
        task: "idle",
        hp: 100,
        maxHp: 100
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();

    harness.sandbox.pixelTicks = api.config.CIVILIZATION_INTERVAL;
    harness.everyTickCallbacks[0]();
    const assignedRole = actor.role;
    const firstHistory = api.getPersonHistory(actor.humanId, {limit: 500});
    const firstRoleEvents = firstHistory.entries.filter((entry) => entry.type === "role_changed");

    assert.notEqual(assignedRole, "worker", "the first job allocation must perform a real role change");
    assert.equal(firstRoleEvents.length, 1);

    harness.sandbox.pixelTicks += api.config.CIVILIZATION_INTERVAL;
    harness.everyTickCallbacks[0]();
    const secondHistory = api.getPersonHistory(actor.humanId, {limit: 500});
    const secondRoleEvents = secondHistory.entries.filter((entry) => entry.type === "role_changed");

    assert.equal(actor.role, assignedRole);
    assert.equal(secondRoleEvents.length, firstRoleEvents.length);
});

test("role reassignment cancels incompatible work and delivers existing cargo without resuming the old job", () => {
    const harness = createHarness();
    const banner = harness.createPixel("civ_banner", 40, 8, {
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699"
    });
    const actor = harness.createPixel("civ_body", 8, 8, {
        humanId: 100,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "miner",
        task: "harvest",
        targetX: 20,
        targetY: 8,
        targetKind: "rock",
        harvestX: 20,
        harvestY: 8,
        reservedResourceKey: "rock@20,8",
        carry: {stone: 2},
        workTrip: {version: 1, resourceKind: "stone", suspendedTask: {task: "harvest"}, resuming: true},
        resumeAfterDelivery: {task: "harvest", resourceKind: "stone"},
        hp: 100,
        maxHp: 100
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();

    harness.sandbox.pixelTicks = api.config.CIVILIZATION_INTERVAL;
    harness.everyTickCallbacks[0]();

    assert.notEqual(actor.role, "miner");
    assert.equal(actor.task, "deliver");
    assert.equal(actor.targetId, banner.buildingId);
    assert.equal(actor.carry.stone, 2);
    assert.equal(actor.resumeAfterDelivery, undefined);
    assert.equal(actor.reservedResourceKey, undefined);
    assert.equal(actor.workTrip, undefined);
    const history = api.getPersonHistory(actor.humanId, {limit: 20}).entries;
    assert.ok(history.some((entry) => entry.task === "harvest" && entry.reason === "job_reassigned"));
});

test("stable food is preferred over rotten meat and failed rotten meat targets enter category backoff", () => {
    const harness = createHarness();
    harness.elements.rotten_meat.isFood = true;
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 14, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    harness.createPixel("rotten_meat", 16, 9);
    harness.createPixel("apple", 18, 9);
    const body = harness.getPixel(8, 9);
    body.role = "food";
    body.task = "planning";
    harness.sandbox.HumanSociety.registerResource("rotten_meat", {kind: "food", yield: 1, harvestTicks: 6});
    harness.sandbox.HumanSociety.forceReindex();

    let tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);
    assert.equal(body.harvestX, 18, "stable food should win even when rotten meat is closer");

    const apple = harness.getPixel(18, 9);
    harness.changePixel(apple, "dirt");
    const firstRotten = harness.getPixel(16, 9);
    body.task = "planning";
    harness.sandbox.HumanSociety.forceReindex();
    tick += 10;
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);
    assert.equal(body.targetKind, "rotten_meat");

    harness.changePixel(firstRotten, "dirt");
    harness.createPixel("rotten_meat", 20, 9);
    harness.sandbox.HumanSociety.forceReindex();
    tick += 10;
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);

    assert.notEqual(body.task, "harvest");
    assert.equal(body.blockedResourceKey, "16,9:rotten_meat");
    assert.equal(body.blockedResourceCategory, "rotten_meat");
    assert.ok(body.blockedResourceCategoryUntil - tick >= 590);
});

test("a legacy child's activity history remains attached after unified-worker conversion", () => {
    const harness = createHarness();
    for (let x = 1; x <= 90; x++) harness.createPixel("rock", x, 12);
    harness.createPixel("civilized_human", 8, 10);
    const parent = harness.getPixel(8, 11);
    const child = harness.createPixel("civ_child", 20, 11, {
        humanId: 99,
        factionId: parent.factionId,
        settlementId: null,
        factionColor: parent.factionColor,
        task: "idle",
        birthTick: 0,
        lifespanYears: 55,
        naturalDeathTick: 55 * harness.sandbox.HumanSociety.config.TICKS_PER_YEAR
    });
    harness.createPixel("civilized_human", 70, 10);
    const attacker = harness.getPixel(70, 11);
    attacker.factionId = parent.factionId + 1;
    harness.sandbox.HumanSociety.forceReindex();

    const api = harness.sandbox.HumanSociety;
    harness.sandbox.pixelTicks = 1;
    api.damageActor(child, 1, attacker);
    assert.equal(api.getPersonSnapshot(child.humanId).currentActivity.task, "combat");

    harness.sandbox.pixelTicks = 2;
    child.birthTick = 0;
    child.ageTicks = 2;
    child.naturalDeathTick = child.lifespanYears * api.config.TICKS_PER_YEAR;
    harness.elements.civ_child.tick(child);

    const adult = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_body" && pixel.humanId === 99);
    assert.ok(adult);
    const snapshot = api.getPersonSnapshot(99);
    assert.equal(snapshot.humanId, 99);
    assert.equal(snapshot.status, "living");
    assert.notEqual(snapshot.role, "child");
    const history = api.getPersonHistory(99, {limit: 500});
    assert.ok(history.entries.some((entry) => entry.task === "combat"), "the child's active task is retained when adulthood interrupts it");
    assert.ok(history.entries.some((entry) => entry.type === "legacy_child_conversion"), "conversion is recorded on the same timeline");
});

test("forceReindex initializes activity data for actors loaded from a legacy save", () => {
    const harness = createHarness();
    harness.createPixel("civilized_human", 8, 7);
    const actor = harness.getPixel(8, 8);
    for (const field of [
        "personActivity", "activityCurrent", "activityHistory", "activitySequence",
        "personActivitySchemaVersion", "activitySchemaVersion"
    ]) delete actor[field];

    const api = harness.sandbox.HumanSociety;
    assert.doesNotThrow(() => api.forceReindex());
    const snapshot = api.getPersonSnapshot(actor.humanId);
    assert.equal(snapshot.status, "living");
    assert.equal(snapshot.currentActivity.task, actor.task);
    const history = api.getPersonHistory(actor.humanId, {limit: 50});
    assert.deepEqual(Array.from(history.entries), []);
    assert.equal(history.totalRetained, 0);
});

test("every attacked human, including a child, immediately locks the attacker for retaliation", () => {
    const harness = createHarness();
    const child = harness.createPixel("civ_child", 15, 10);
    child.humanId = 99;
    child.factionId = 1;
    harness.createPixel("civilized_human", 16, 9);
    const attackerHead = harness.getPixel(16, 9);
    const attackerBody = harness.getPixel(16, 10);
    attackerHead.factionId = 2;
    attackerBody.factionId = 2;
    harness.sandbox.HumanSociety.forceReindex();
    const startingHp = child.hp;

    assert.equal(harness.sandbox.HumanSociety.damageActor(child, 12, attackerBody), true);
    assert.equal(child.hp, startingHp - 12);
    assert.equal(child.combatTargetId, attackerBody.humanId);
    assert.equal(child.task, "combat");
});

test("civilization buildings use the engine WALL behavior", () => {
    const harness = createHarness();
    for (const elementName of [
        "civ_banner", "civ_hut_core", "civ_farm_marker", "civ_workshop_core",
        "civ_construction", "civ_structure_wood", "civ_structure_stone", "civ_ruin"
    ]) {
        assert.equal(
            harness.elements[elementName].behavior,
            harness.wallBehavior,
            `${elementName} should be static`
        );
    }
});

test("logical building cores fall onto solid terrain, carry metadata, and stop above tunnels", () => {
    const harness = createHarness();
    harness.createPixel("rock", 40, 7);
    const workshop = harness.createPixel("civ_workshop_core", 40, 4, {
        factionId: 1,
        settlementId: 1,
        buildingId: 100,
        originX: 40,
        originY: 4
    });
    harness.sandbox.HumanSociety.forceReindex();
    assert.equal(workshop.buildingType, "workshop");

    harness.sandbox.pixelTicks = 1;
    harness.everyTickCallbacks[0]();
    harness.sandbox.pixelTicks = 2;
    harness.everyTickCallbacks[0]();
    harness.sandbox.pixelTicks = 3;
    harness.everyTickCallbacks[0]();

    assert.equal(workshop.y, 6);
    assert.equal(workshop.originY, 6);

    const tunnel = harness.createPixel("civ_tunnel", 45, 6);
    const hut = harness.createPixel("civ_hut_core", 45, 5, {factionId: 1, settlementId: 1, buildingId: 101, originX: 45, originY: 5});
    harness.sandbox.HumanSociety.forceReindex();
    harness.sandbox.pixelTicks = 4;
    harness.everyTickCallbacks[0]();
    assert.equal(hut.y, 5);
    assert.equal(harness.getPixel(45, 6), tunnel);
});

test("two nearby grounded adults autonomously found a camp after the stability window", () => {
    const harness = createHarness();
    for (let x = 3; x <= 20; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);

    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }

    const banners = harness.currentPixels.filter((pixel) => !pixel.del && pixel.element === "civ_banner");
    assert.equal(banners.length, 1);
    assert.equal(banners[0].factionId, harness.getPixel(8, 9).factionId);
    assert.equal(banners[0].stage, "camp");
});

test("a settlement spends food to create an immediately working person without cooldown", () => {
    const harness = createHarness();
    for (let x = 3; x <= 20; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner");
    banner.stock.food = 2;

    harness.sandbox.pixelTicks = 120;
    harness.everyTickCallbacks[0]();

    const workers = harness.currentPixels.filter((pixel) => !pixel.del && pixel.element === "civ_body");
    assert.equal(workers.length, 3);
    assert.equal(harness.currentPixels.filter((pixel) => !pixel.del && pixel.element === "civ_child").length, 0);
    assert.equal(banner.stock.food, 0);
    assert.equal(workers.filter((worker) => worker.settlementId === banner.settlementId).length, 3);
    assert.ok(workers.every((worker) => worker.task !== "idle"));
    assert.ok(banner.chronicle.some((event) => event.type === "birth"));
});

test("a settlement creates repeatedly until it reaches the current era's ideal population", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner");
    banner.stock.food = 20;

    harness.sandbox.pixelTicks = 120;
    harness.everyTickCallbacks[0]();

    const workers = harness.currentPixels.filter((pixel) => !pixel.del && pixel.element === "civ_body" && pixel.settlementId === banner.settlementId);
    assert.equal(workers.length, 6);
    assert.equal(banner.stock.food, 12);
    assert.ok(workers.every((worker) => worker.task !== "idle"));
});

test("erasing a town-center core removes its sprite permanently instead of auto-rebuilding", () => {
    const harness = createHarness();
    for (let x = 3; x <= 20; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner");

    harness.elements.civ_banner.onErase(banner);
    for (const tick of [120, 180, 240, 300, 360, 420, 480]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }

    assert.equal(banner.townCenterActive, false);
    assert.equal(banner.buildingState, "destroyed");
    assert.equal(banner.destroyedCause, "erased");
});

test("a camp advances only after clearing the current era's dynamic seventy-percent threshold", () => {
    const harness = createHarness({techData: true});
    for (let x = 1; x <= 40; x++) harness.createPixel("rock", x, 10);
    for (const x of [8, 12, 16, 20]) harness.createPixel("civilized_human", x, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }

    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner");
    assert.ok(banner);
    assert.equal(banner.eraId, "tribal");
    banner.stock.wood = 1000;
    banner.stock.materials.wood = 1000;
    banner.research.knowledge = 10000;
    const tribalEra = TechData.ERAS.find((era) => era.id === "tribal");
    const tribalTechIds = tribalEra.techIds;
    const required = tribalEra.requiredTechsToAdvance;
    const researchedCount = () => tribalTechIds.filter((techId) => banner.research.unlocked[techId]).length;

    for (let index = 0; index < required - 1; index++) {
        const tick = 120 + index * 30;
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    assert.equal(researchedCount(), required - 1);
    assert.equal(banner.eraId, "tribal");

    harness.sandbox.pixelTicks = 120 + (required - 1) * 30;
    harness.everyTickCallbacks[0]();
    assert.equal(researchedCount(), required);
    assert.equal(banner.research.eraCompleted, required);
    assert.equal(banner.eraId, "stone");
});

test("agriculture keeps generating knowledge and autonomously clears its compact technology tree", () => {
    const harness = createHarness({techData: true});
    for (let x = 1; x <= 50; x++) harness.createPixel("rock", x, 15);
    harness.createPixel("wheat_seed", 55, 12);
    harness.createPixel("corn_seed", 57, 12);
    harness.createPixel("sapling", 59, 12);
    harness.createPixel("water", 61, 12);
    for (const x of [8, 12, 16, 20]) harness.createPixel("civilized_human", x, 13);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const api = harness.sandbox.HumanSociety;
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner");
    const factionId = banner.factionId;
    for (const eraId of ["tribal", "stone"]) {
        const era = TechData.ERAS.find((candidate) => candidate.id === eraId);
        era.techIds.forEach((techId) => assert.equal(api.setTechnologyState(factionId, techId, "researched"), true));
    }
    assert.equal(banner.eraId, "agriculture");
    api.setSettlementResources(factionId, banner.settlementId, {food: 200, wood: 200, stone: 200});
    api.forceReindex();
    const foodPreservation = api.getFactionSnapshot(factionId, banner.settlementId).technologies.find((tech) => tech.id === "food_preservation");
    const foodCondition = foodPreservation.conditionStates.find((state) => state.condition.type === "resource_stock" && state.condition.resource === "food");
    assert.ok(foodCondition.current >= 12, "food stock satisfies food preservation without a crop-seed subsystem");

    for (let tick = 120; tick <= 2400 && banner.eraId === "agriculture"; tick += 30) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const snapshot = api.getFactionSnapshot(factionId, banner.settlementId);
    const agricultureEra = TechData.ERAS.find((era) => era.id === "agriculture");
    assert.ok(snapshot.totalKnowledgeGenerated > 0);
    assert.ok(snapshot.knowledgeGain > 0);
    assert.equal(snapshot.technologies.filter((tech) => tech.eraId === "agriculture" && tech.unlocked).length >= agricultureEra.requiredTechsToAdvance, true);
    assert.equal(banner.eraId, "bronze");
});

test("civilization ticks never synthesize ore into surrounding rock", () => {
    const harness = createHarness({techData: true});
    for (let x = 1; x <= 90; x++) harness.createPixel("rock", x, 15);
    const banner = harness.createPixel("civ_banner", 20, 14, {
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        eraId: "castle",
        housing: 100
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    TechData.TECHNOLOGIES.forEach((technology) => {
        banner.research.unlocked[technology.id] = true;
    });

    const originalRock = harness.currentPixels.filter((pixel) => !pixel.del && pixel.element === "rock").slice();
    for (let tick = 120; tick <= 3000; tick += 30) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }

    assert.ok(originalRock.every((pixel) => !pixel.del && pixel.element === "rock"));
    assert.equal(harness.currentPixels.some((pixel) => !pixel.del && ["copper", "tin", "iron", "iron_ore"].includes(pixel.element)), false);
    assert.equal(banner.element, "civ_banner");
});

test("resource editing, irreversible forced research, condition progress, and real-time logs are public", () => {
    const harness = createHarness({techData: true});
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("copper", 70, 6);
    harness.createPixel("water", 80, 6);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const api = harness.sandbox.HumanSociety;
    const initial = api.getFactionSnapshot(harness.getPixel(8, 9).factionId);
    assert.equal(api.setSettlementResources(initial.id, initial.selectedSettlementId, {wood: 3, food: 9, sapling: 2}), true);
    assert.equal(api.setTechnologyState(initial.id, "controlled_fire", "focused"), true);
    const queued = api.getFactionSnapshot(initial.id, initial.selectedSettlementId);
    assert.ok(queued.technologies.find((tech) => tech.id === "organized_gathering").focused, "prerequisite closure is queued first");
    assert.equal(api.setTechnologyState(initial.id, "controlled_fire", "researched"), true);
    assert.equal(api.setTechnologyState(initial.id, "controlled_fire", "unresearched"), false);
    assert.equal(api.setTechnologyState(initial.id, "steelmaking", "researched"), true, "future-era technologies can be force-completed");
    const snapshot = api.getFactionSnapshot(initial.id, initial.selectedSettlementId);
    assert.equal(snapshot.stock.wood, 3);
    assert.equal(snapshot.stock.sapling, 2);
    const controlledFire = snapshot.technologies.find((tech) => tech.id === "controlled_fire");
    assert.equal(controlledFire.state, "researched");
    assert.equal(controlledFire.forced, true);
    assert.equal(snapshot.technologies.find((tech) => tech.id === "steelmaking").forced, true);
    assert.equal(controlledFire.conditionStates[0].current, 3);
    assert.equal(snapshot.technologies.find((tech) => tech.id === "copper_prospecting").conditionStates[0].current, 1, "remote ore is globally known");
    assert.equal(snapshot.technologies.find((tech) => tech.id === "irrigation"), undefined, "retired farming technology is absent from the public tree");
    const chronicle = api.getFactionChronicle(initial.id, {settlementId: initial.selectedSettlementId});
    assert.ok(chronicle.some((event) => event.type === "resource_edit"));
    assert.ok(chronicle.some((event) => event.type === "technology" && event.technologyId === "controlled_fire"));
    assert.match(chronicle[0].timestamp, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test("hostility incidents alone never start a war", () => {
    const harness = createHarness();
    for (let x = 1; x <= 72; x++) harness.createPixel("rock", x, 10);
    for (const x of [4, 6, 60, 62]) harness.createPixel("civilized_human", x, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const firstFaction = harness.getPixel(4, 9).factionId;
    const secondFaction = harness.getPixel(60, 9).factionId;
    for (let i = 0; i < 20; i++) harness.sandbox.HumanSociety.recordIncident(firstFaction, secondFaction, "hit");
    harness.sandbox.pixelTicks = 120;
    harness.everyTickCallbacks[0]();
    assert.equal(harness.sandbox.HumanSociety.atWar(firstFaction, secondFaction), false);
});

test("unlocked ranged weapons participate in era quotas without a workshop", () => {
    const agriculture = createEquipmentScenario({
        eraId: "agriculture",
        adultCount: 2,
        soldierCount: 2,
        unlocked: ["polished_axes", "bowmaking"]
    });
    stepCivilization(agriculture.harness, 30);
    assert.deepEqual(countWeapons(agriculture.adults), {stone_spear: 1, bow: 1});

    const castle = createEquipmentScenario({
        eraId: "castle",
        adultCount: 3,
        soldierCount: 3,
        unlocked: ["carburizing_tempering", "crossbow"]
    });
    stepCivilization(castle.harness, 30);
    assert.deepEqual(countWeapons(castle.adults), {steel_blade: 1, steel_spear: 1, crossbow: 1});
});

test("camp planning builds the tribal lumberyard as a one-cell logical construction", () => {
    const harness = createHarness();
    for (let x = 1; x <= 24; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner");
    banner.stock.wood = 12;

    harness.sandbox.pixelTicks = 120;
    harness.everyTickCallbacks[0]();

    const site = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_construction");
    assert.ok(site);
    assert.equal(site.blueprintType, "lumberyard");
    assert.equal(banner.stock.wood, 8);
    assert.equal(site.costs.wood, 4);
    assert.equal(site.workRequired, 2);
    assert.equal(site.alwaysOverlay, true);
});

test("a completed building keeps one logical core at the construction origin", () => {
    const harness = createHarness();
    for (let x = 1; x <= 28; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner");
    banner.stock.wood = 12;
    harness.sandbox.pixelTicks = 120;
    harness.everyTickCallbacks[0]();
    const site = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_construction");
    harness.sandbox.pixelTicks = 150;
    harness.everyTickCallbacks[0]();
    const builder = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_body" && pixel.role === "builder");
    assert.ok(builder, "urgent housing/building work must take a real quota slot");
    const head = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_head" && pixel.humanId === builder.humanId);
    harness.sandbox.movePixel(head, site.x - 2, site.y - 2);
    harness.sandbox.movePixel(builder, site.x - 2, site.y - 1);
    builder.role = "builder";
    builder.task = "idle";

    let tick = 160 + ((10 - ((160 + builder.humanId) % 10)) % 10);
    for (let step = 0; step < 25 && site.element === "civ_construction"; step++, tick += 10) {
        harness.sandbox.pixelTicks = tick;
        harness.elements.civ_body.tick(builder);
    }

    assert.equal(site.element, "civ_lumberyard_core");
    assert.equal(site.x, site.originX);
    assert.equal(site.y, site.originY);
    assert.equal(site.isBuildingCore, true);
    assert.equal(harness.currentPixels.some((pixel) => !pixel.del && pixel.buildingId === site.buildingId && (pixel.element === "civ_structure_wood" || pixel.element === "civ_structure_stone")), false);
    assert.equal(banner.stock.wood, 8);
});

test("resource planning can find a reachable food source beyond the old five-cell scan", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    harness.createPixel("apple", 18, 9);
    const body = harness.getPixel(8, 9);
    harness.sandbox.HumanSociety.forceReindex();

    for (let attempt = 0; attempt < 6 && body.task !== "harvest"; attempt++) {
        harness.sandbox.pixelTicks = 9 + attempt * 60;
        harness.elements.civ_body.tick(body);
    }

    assert.equal(body.task, "harvest");
    assert.equal(body.harvestX, 18);
    assert.equal(body.harvestY, 9);
    assert.ok(Math.abs(body.targetX - body.harvestX) <= 1);
});

test("the first-resource chronicle entry is written when a block is harvested, before delivery", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const apple = harness.createPixel("apple", 9, 9);
    const body = harness.getPixel(8, 9);
    harness.sandbox.HumanSociety.forceReindex();
    body.role = "food";
    body.task = "idle";

    const tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);

    const snapshot = harness.sandbox.HumanSociety.getFactionSnapshot(body.factionId, body.settlementId);
    assert.equal(apple.del, true);
    assert.equal((body.carry.food || 0) + snapshot.stock.food, 1);
    assert.equal(harness.currentPixels.find((pixel) => pixel.element === "civ_banner").research.milestones.harvests, 1);
    assert.ok(snapshot.chronicle.some((event) => event.type === "first_resource" && event.resource === "food"));
});

test("surface-mined non-food and non-wood resource sources become clean dirt", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    const copper = harness.createPixel("copper", 9, 9);
    const body = harness.getPixel(8, 9);
    harness.sandbox.HumanSociety.forceReindex();
    body.role = "miner";
    body.task = "harvest";
    body.targetX = 8;
    body.targetY = 9;
    body.harvestX = 9;
    body.harvestY = 9;
    body.targetKind = "copper";

    let tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
    for (let attempt = 0; attempt < 6 && copper.element === "copper"; attempt++, tick += 10) {
        harness.sandbox.pixelTicks = tick;
        harness.elements.civ_body.tick(body);
    }

    assert.equal(copper.element, "dirt");
    assert.equal(copper._civCollectible, undefined);
    assert.equal(copper._civResourceDrop, undefined);
    assert.equal(body.carry.copper, 1);
});

test("underground natural stone and ores leave faction-marked tunnels when harvested", () => {
    for (const [elementName, resourceKind] of [["rock", "stone"], ["copper", "copper"], ["iron", "raw_iron"]]) {
        const harness = createHarness();
        for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
        harness.createPixel("civilized_human", 8, 8);
        harness.createPixel("dirt", 9, 8);
        const mineral = harness.createPixel(elementName, 9, 9);
        const body = harness.getPixel(8, 9);
        harness.sandbox.HumanSociety.forceReindex();
        body.role = "miner";
        body.task = "harvest";
        body.targetX = 8;
        body.targetY = 9;
        body.harvestX = 9;
        body.harvestY = 9;
        body.targetKind = elementName;

        let tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
        for (let attempt = 0; attempt < 8 && mineral.element === elementName; attempt++, tick += 10) {
            harness.sandbox.pixelTicks = tick;
            harness.elements.civ_body.tick(body);
        }

        assert.equal(mineral.element, "civ_tunnel", `${elementName} should leave a tunnel below cover`);
        assert.equal(mineral.dugByFactionId, body.factionId);
        assert.equal(mineral.dugByHumanId, body.humanId);
        assert.equal(mineral._civCollectible, undefined);
        assert.equal(body.carry[resourceKind], 1);
    }
});

test("adults interrupt ordinary work to extinguish fires and record the response", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const fire = harness.createPixel("fire", 9, 9);
    const body = harness.getPixel(8, 9);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    body.task = "patrol";

    const tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);

    assert.equal(fire.element, "smoke");
    const history = api.getPersonHistory(body.humanId, {limit: 20}).entries;
    assert.ok(history.some((entry) => entry.task === "extinguish" && entry.reason === "fire_extinguished" && entry.metrics.firesExtinguished === 1));
    const snapshot = api.getFactionSnapshot(body.factionId, body.settlementId);
    assert.ok(snapshot.chronicle.some((event) => event.type === "fire_extinguished" && event.humanId === body.humanId));
});

test("a settlement limits simultaneous fire responders instead of abandoning every job", () => {
    const harness = createHarness();
    harness.createPixel("civ_banner", 7, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 40,
        factionColor: "#336699"
    });
    const actors = Array.from({length: 5}, (_, index) => harness.createPixel("civ_body", 8 + index * 2, 15, {
        humanId: 100 + index,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "worker",
        task: "planning",
        hp: 100,
        maxHp: 100,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "fists"
    }));
    for (let x = 5; x <= 40; x++) harness.createPixel("dirt", x, 16);
    harness.createPixel("fire", 35, 15);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();

    actors.forEach((actor, index) => {
        const baseTick = 100 + index * api.config.THINK_INTERVAL;
        harness.sandbox.pixelTicks = baseTick + ((api.config.THINK_INTERVAL - ((baseTick + actor.humanId) % api.config.THINK_INTERVAL)) % api.config.THINK_INTERVAL);
        harness.elements.civ_body.tick(actor);
    });

    assert.equal(actors.filter((actor) => actor.task === "extinguish").length, api.config.MAX_FIRE_RESPONDERS_PER_SETTLEMENT);
    assert.ok(actors.some((actor) => actor.task !== "extinguish"), "non-responders must continue ordinary work");
});

test("felling a whole tree halves wood and rolls one sapling drop per tree", () => {
    const harness = createHarness({techData: true});
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 14, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const seed = harness.createPixel("sapling", 9, 7, {civPlantedTreeId: 501, civTreeOriginX: 9, civTreeOriginY: 9});
    const legacyLeaf = harness.createPixel("plant", 8, 7);
    const trunkTop = harness.createPixel("wood", 9, 8, {naturalVegetation: true});
    const root = harness.createPixel("wood", 9, 9, {naturalVegetation: true});
    const body = harness.getPixel(8, 9);
    harness.sandbox.HumanSociety.forceReindex();
    body.role = "wood";
    body.task = "idle";
    harness.sandbox.Math.random = () => 0.799999;

    let tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);
    harness.sandbox.pixelTicks = tick + 10;
    harness.elements.civ_body.tick(body);

    assert.equal(root.del, true);
    assert.equal(trunkTop.del, true);
    assert.equal(seed.del, true);
    assert.equal(legacyLeaf.del, true);
    const woodDrops = harness.currentPixels.filter((pixel) => !pixel.del && pixel.element === "civ_wood_resource");
    const saplingDrops = harness.currentPixels.filter((pixel) => !pixel.del && pixel.element === "civ_tree_sapling_resource");
    assert.equal(woodDrops.length, 1);
    assert.equal(saplingDrops.length, 1, "the 80% branch drops exactly one sapling for the whole tree");
    assert.ok(saplingDrops.every((drop) => drop.treeSapling === "sapling"));
    assert.equal(woodDrops[0].y, trunkTop.y, "wood should begin falling from a woody tree cell");
    assert.ok(saplingDrops.every((drop) => drop.y === root.y), "saplings should appear along the former base, not in the canopy");
    assert.equal(body.carry.wood, undefined);
});

test("felling refreshes live tree membership after indexing and removes detached same-lineage growth", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    const root = harness.createPixel("tree_branch", 9, 9, {naturalVegetation: true, treeLineage: "growing-tree"});
    const initialLeaf = harness.createPixel("plant", 9, 8, {naturalVegetation: true, treeLineage: "growing-tree"});
    harness.sandbox.HumanSociety.forceReindex();

    const lateBranch = harness.createPixel("tree_branch", 10, 8, {naturalVegetation: true, treeLineage: "growing-tree"});
    const lateLeaf = harness.createPixel("plant", 11, 7, {naturalVegetation: true, treeLineage: "growing-tree"});
    const detachedLeaf = harness.createPixel("plant", 18, 4, {naturalVegetation: true, treeLineage: "growing-tree"});
    harness.sandbox.Math.random = () => 0.8;
    const result = harness.sandbox.HumanSociety.fellTreeAt(detachedLeaf.x, detachedLeaf.y);

    assert.equal(result.removedPixels, 5);
    assert.equal(result.woodDrops, 1);
    assert.equal(result.saplingDrops, 2, "the 20% branch drops exactly two saplings for the whole tree");
    assert.ok([root, initialLeaf, lateBranch, lateLeaf, detachedLeaf].every((pixel) => pixel.del === true));
    harness.sandbox.HumanSociety.forceReindex();
    assert.equal(harness.sandbox.HumanSociety.getTreeAt(root.x, root.y), null);
});

test("legacy untagged canopies are attached to closure instead of leaving leaves beyond two cells", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    const root = harness.createPixel("tree_branch", 18, 9, {naturalVegetation: true});
    const canopy = [
        harness.createPixel("plant", 18, 8),
        harness.createPixel("plant", 19, 7),
        harness.createPixel("plant", 20, 6),
        harness.createPixel("plant", 21, 5),
        harness.createPixel("plant", 22, 4)
    ];
    harness.sandbox.HumanSociety.forceReindex();
    harness.sandbox.Math.random = () => 0;
    const result = harness.sandbox.HumanSociety.fellTreeAt(root.x, root.y);

    assert.equal(result.removedPixels, 6);
    assert.equal(result.woodDrops, 1);
    assert.equal(result.saplingDrops, 1);
    assert.equal(root.del, true);
    assert.ok(canopy.every((pixel) => pixel.del === true));
});

test("legacy root networks directly below a recognized tree are converted back to dirt", () => {
    const harness = createHarness();
    harness.createPixel("wood", 10, 6, {naturalVegetation: true, treeLineage: "legacy-tree"});
    const root = harness.createPixel("root", 10, 7);
    const fiber = harness.createPixel("fiber", 10, 8);

    harness.sandbox.HumanSociety.forceReindex();

    assert.equal(root.element, "dirt");
    assert.equal(fiber.element, "dirt");
});

test("collecting a tree sapling resource preserves its species for planting", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 14, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const drop = harness.createPixel("civ_tree_sapling_resource", 9, 9, {treeSapling: "pinecone"});
    const body = harness.getPixel(8, 9);
    harness.sandbox.HumanSociety.forceReindex();
    body.role = "wood";
    body.task = "planning";

    const tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);

    const snapshot = harness.sandbox.HumanSociety.getFactionSnapshot(body.factionId, body.settlementId);
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner" && pixel.settlementId === body.settlementId);
    assert.equal(drop.del, true);
    assert.equal(snapshot.stock.wood + (body.carry.wood || 0), 0);
    assert.equal((banner.stock.treeSaplings.pinecone || 0) + (body.carry["tree_sapling:pinecone"] || 0), 1);
    assert.equal(banner.stock.treeSaplings.sapling || 0, 0);
    assert.equal(snapshot.stock.sapling + (body.carry["tree_sapling:pinecone"] || 0), 1);
});

test("legacy truncated tree sapling inventory keys migrate once into valid species", () => {
    const harness = createHarness();
    const banner = harness.createPixel("civ_banner", 40, 8, {
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        stock: {
            food: 0,
            wood: 0,
            stone: 0,
            materials: {},
            seeds: {},
            treeSaplings: {apling: 724, sapling: 2, inecone: 3, amboo_plant: 4}
        }
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    api.forceReindex();

    const stock = api.getFactionSnapshot(banner.factionId, banner.settlementId).stock;
    assert.equal(stock.sapling, 733);
    assert.deepEqual(JSON.parse(JSON.stringify(banner.stock.treeSaplings)), {sapling: 726, pinecone: 3, bamboo_plant: 4});
});

test("delivered tree saplings can be planted by a forester", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 30; x++) harness.createPixel("dirt", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 14, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const body = harness.getPixel(14, 9);
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner" && pixel.settlementId === body.settlementId);
    banner.stock.treeSaplings.sapling = 1;
    body.role = "forester";
    body.task = "planning";
    harness.sandbox.HumanSociety.forceReindex();

    for (let tick = 100; tick <= 500 && banner.stock.treeSaplings.sapling > 0; tick++) {
        harness.sandbox.pixelTicks = tick;
        harness.elements.civ_body.tick(body);
    }

    const planted = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "sapling" && Number.isFinite(pixel.civPlantedTreeId));
    assert.ok(planted, "the abstract sapling stock should create a plantable sapling pixel");
    assert.equal(banner.stock.treeSaplings.sapling, 0);

    harness.sandbox.HumanSociety.forceReindex();
    for (let tick = 501; tick <= 650; tick++) {
        harness.sandbox.pixelTicks = tick;
        harness.elements.civ_body.tick(body);
    }
    assert.equal(planted.del, undefined, "an immature planted tree must not be re-indexed as harvestable wood");
});

test("foresters reserve root-spaced planting sites across all owned territory", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 30; x <= 61; x++) harness.createPixel("dirt", x, 16);
    const banner = harness.createPixel("civ_banner", 10, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 40,
        factionColor: "#336699",
        eraId: "castle"
    });
    harness.createPixel("civ_lumberyard_core", 50, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 41,
        factionColor: "#336699"
    });
    harness.createPixel("wood", 44, 15, {naturalVegetation: true, treeLineage: "spacing-tree"});
    harness.createPixel("plant", 39, 13);
    const foresters = [
        harness.createPixel("civ_body", 30, 15, {
            humanId: 100, factionId: 7, settlementId: 17, factionColor: "#336699",
            role: "forester", task: "planning", hp: 100, maxHp: 100,
            birthTick: 0, naturalDeathTick: 100000, weapon: "fists", _r: 1000
        }),
        harness.createPixel("civ_body", 31, 15, {
            humanId: 110, factionId: 7, settlementId: 17, factionColor: "#336699",
            role: "forester", task: "planning", hp: 100, maxHp: 100,
            birthTick: 0, naturalDeathTick: 100000, weapon: "fists", _r: 1001
        })
    ];
    harness.createPixel("civ_head", 30, 14, {factionId: 7, settlementId: 17, _r: 1000});
    harness.createPixel("civ_head", 31, 14, {factionId: 7, settlementId: 17, _r: 1001});
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    banner.stock.treeSaplings.sapling = 2;
    assert.equal(api.territoryOwnerAt(39, 15).factionId, 7);
    assert.deepEqual(foresters.map((forester) => forester.role), ["forester", "forester"]);
    harness.sandbox.pixelTicks = 100;
    foresters.forEach((forester) => harness.elements.civ_body.tick(forester));

    foresters.forEach((forester) => {
        assert.equal(forester.task, "plant_tree");
        assert.ok(forester.targetX >= 39 && forester.targetX <= 61, "the search reaches owned columns beyond the old banner radius");
        assert.equal(api.territoryOwnerAt(forester.targetX, forester.targetY).factionId, 7);
        assert.ok(Math.abs(forester.targetX - 44) > 2, "an indexed tree root reserves two columns on each side");
    });
    assert.ok(Math.abs(foresters[0].targetX - foresters[1].targetX) > 2, "active planting tasks act as temporary roots");
    assert.ok(foresters.some((forester) => forester.targetX === 39), "an untagged leaf does not count as a tree root");
});

test("foresters recheck planting every think interval but deliver cargo first", () => {
    function prepare(carry) {
        const harness = createHarness({relationMovement: true});
        for (let x = 1; x <= 35; x++) harness.createPixel("dirt", x, 16);
        const banner = harness.createPixel("civ_banner", 8, 15, {
            factionId: 7, settlementId: 17, buildingId: 40, factionColor: "#336699"
        });
        harness.createPixel("civ_lumberyard_core", 6, 15, {
            factionId: 7, settlementId: 17, buildingId: 41, factionColor: "#336699"
        });
        harness.createPixel("wood", 21, 15, {naturalVegetation: true, treeLineage: "priority-tree"});
        const forester = harness.createPixel("civ_body", 20, 15, {
            humanId: 100, factionId: 7, settlementId: 17, factionColor: "#336699",
            role: "forester", task: "harvest", targetX: 34, targetY: 15,
            targetKind: "wood", hp: 100, maxHp: 100, birthTick: 0,
            naturalDeathTick: 100000, weapon: "fists", carry: carry || {}, _r: 1000
        });
        harness.createPixel("civ_head", 20, 14, {factionId: 7, settlementId: 17, _r: 1000});
        const api = harness.sandbox.HumanSociety;
        api.forceReindex();
        banner.stock.treeSaplings.sapling = 1;
        assert.equal(forester.role, "forester");
        harness.sandbox.pixelTicks = 100;
        harness.elements.civ_body.tick(forester);
        return {forester, banner};
    }

    const empty = prepare({});
    assert.equal(empty.forester.task, "plant_tree", "ordinary harvesting is interrupted for an available planting site");
    assert.ok(Math.abs(empty.forester.targetX - 21) > 2);

    const carrying = prepare({wood: 1});
    assert.equal(carrying.forester.task, "deliver", "cargo is returned before a planting task begins");
    assert.equal(carrying.banner.stock.treeSaplings.sapling, 1);
});

test("forester quotas stay with woodcutters until managed forestry is researched", () => {
    const harness = createHarness({techData: true});
    for (let x = 1; x <= 40; x++) harness.createPixel("dirt", x, 16);
    const banner = harness.createPixel("civ_banner", 20, 15, {
        factionId: 7, settlementId: 17, buildingId: 40, factionColor: "#336699",
        eraId: "agriculture", housing: 20
    });
    for (let index = 0; index < 12; index++) {
        harness.createPixel("civ_body", 5 + index, 15, {
            humanId: 100 + index, factionId: 7, settlementId: 17, factionColor: "#336699",
            role: "worker", task: "planning", hp: 100, maxHp: 100,
            birthTick: 0, naturalDeathTick: 100000, weapon: "fists"
        });
    }
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    api.setSettlementResources(7, 17, {food: 100, wood: 100, stone: 100});
    stepCivilization(harness, 30);
    assert.equal(harness.currentPixels.some((pixel) => !pixel.del && pixel.element === "civ_body" && pixel.role === "forester"), false);
    assert.equal(banner.roleQuotas.forester, 0);

    assert.equal(api.setTechnologyState(7, "managed_forestry", "researched"), true);
    stepCivilization(harness, 60);
    assert.equal(harness.currentPixels.some((pixel) => !pixel.del && pixel.element === "civ_body" && pixel.role === "forester"), true);
    assert.ok(banner.roleQuotas.forester > 0);
});

test("every role can carve traversal tunnels but only permanent miners collect stone", () => {
    function prepare(role) {
        const harness = createHarness({relationMovement: true});
        for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
        harness.createPixel("civilized_human", 8, 8);
        harness.createPixel("civilized_human", 14, 8);
        for (const tick of [30, 60, 90]) {
            harness.sandbox.pixelTicks = tick;
            harness.everyTickCallbacks[0]();
        }
        for (let y = 7; y >= 3; y--) harness.createPixel("rock", 9, y);
        const wallHead = harness.createPixel("rock", 9, 8);
        const wallBody = harness.createPixel("rock", 9, 9);
        const targetX = harness.getPixel(12, 9) ? 13 : 12;
        const target = harness.createPixel("apple", targetX, 9);
        const body = harness.getPixel(8, 9);
        body.role = role;
        body.task = "harvest";
        body.targetX = 10;
        body.targetY = 9;
        body.harvestX = target.x;
        body.harvestY = target.y;
        body.targetKind = "apple";
        return {harness, body, wallHead, wallBody};
    }

    const workerCase = prepare("food");
    let tick = 100 + ((10 - ((100 + workerCase.body.humanId) % 10)) % 10);
    for (let attempt = 0; attempt < 20 && workerCase.wallHead.element !== "civ_tunnel"; attempt++) {
        workerCase.harness.sandbox.pixelTicks = tick + attempt * 10;
        workerCase.harness.elements.civ_body.tick(workerCase.body);
    }
    assert.equal(workerCase.wallHead.element, "civ_tunnel");
    assert.equal(workerCase.wallBody.element, "civ_tunnel");
    assert.equal(workerCase.body.role, "food");
    assert.equal(workerCase.body.carry.stone, undefined);

    const minerCase = prepare("miner");
    tick = 100 + ((10 - ((100 + minerCase.body.humanId) % 10)) % 10);
    for (let attempt = 0; attempt < 20 && minerCase.wallHead.element !== "civ_tunnel"; attempt++) {
        minerCase.harness.sandbox.pixelTicks = tick + attempt * 10;
        minerCase.harness.elements.civ_body.tick(minerCase.body);
    }
    assert.equal(minerCase.wallHead.element, "civ_tunnel");
    assert.equal(minerCase.wallBody.element, "civ_tunnel");
    assert.equal(minerCase.body.role, "miner");
    assert.equal(minerCase.body.carry.stone, 2);

    minerCase.body.carry.stone = 4;
    const banner = minerCase.harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner" && pixel.settlementId === minerCase.body.settlementId);
    minerCase.harness.createPixel("civ_quarry_core", 7, 9, {factionId: minerCase.body.factionId, settlementId: minerCase.body.settlementId, buildingId: 999});
    minerCase.harness.sandbox.HumanSociety.forceReindex();
    minerCase.harness.sandbox.pixelTicks = tick + 10;
    minerCase.harness.elements.civ_body.tick(minerCase.body);
    const snapshot = minerCase.harness.sandbox.HumanSociety.getFactionSnapshot(minerCase.body.factionId, minerCase.body.settlementId);
    assert.equal(snapshot.stock.stone, 4);
    assert.equal(minerCase.body.role, "miner");
    assert.equal(minerCase.body.task, "harvest");
});

test("touching canopies with established tree ids remain separate root-harvest targets", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 14, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const firstRoot = harness.createPixel("tree_branch", 9, 9, {treeId: 101, _civTreeRoot: true, naturalVegetation: true});
    harness.createPixel("plant", 9, 8, {treeId: 101, naturalVegetation: true});
    const secondRoot = harness.createPixel("tree_branch", 10, 9, {treeId: 102, _civTreeRoot: true, naturalVegetation: true});
    const secondCanopy = harness.createPixel("plant", 10, 8, {treeId: 102, naturalVegetation: true});
    const body = harness.getPixel(8, 9);
    harness.sandbox.HumanSociety.forceReindex();
    body.role = "wood";
    body.task = "idle";

    let tick = 100 + ((10 - ((100 + body.humanId) % 10)) % 10);
    harness.sandbox.pixelTicks = tick;
    harness.elements.civ_body.tick(body);
    harness.sandbox.pixelTicks = tick + 10;
    harness.elements.civ_body.tick(body);

    assert.equal(firstRoot.del, true);
    assert.equal(secondRoot.del, undefined);
    assert.equal(secondCanopy.del, undefined);
});

test("a persistent unreachable resource eventually triggers no-progress blacklisting", () => {
    const harness = createHarness();
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    harness.createPixel("apple", 18, 9);
    const body = harness.getPixel(8, 9);
    harness.sandbox.HumanSociety.forceReindex();

    let failureTick = null;
    for (let attempt = 0; attempt < 30; attempt++) {
        harness.sandbox.pixelTicks = 9 + attempt * 60;
        harness.elements.civ_body.tick(body);
        if (body.blockedResourceKey) {
            failureTick = harness.sandbox.pixelTicks;
            break;
        }
    }

    assert.ok(Number.isFinite(failureTick));
    assert.notEqual(body.task, "harvest");
    assert.equal(body.blockedResourceKey, "18,9:apple");
    assert.ok(body.blockedResourceUntil > harness.sandbox.pixelTicks);
});

test("new buildings center inside existing territory and expand the same faction columns", () => {
    const harness = createHarness();
    for (let x = 1; x <= 35; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    harness.createPixel("civilized_human", 12, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const banner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner");
    const hut = harness.createPixel("civ_hut_core", 28, 9);
    hut.factionId = banner.factionId;
    hut.factionColor = banner.factionColor;
    hut.settlementId = banner.settlementId;
    hut.buildingId = 500;
    banner.stock.wood = 10;
    banner.stock.stone = 8;
    banner.stock.seeds.apple_seed = 1;
    harness.sandbox.HumanSociety.forceReindex();

    harness.sandbox.pixelTicks = 120;
    harness.everyTickCallbacks[0]();

    const site = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_construction");
    assert.ok(site);
    assert.equal(site.blueprintType, "lumberyard");
    assert.equal(harness.sandbox.HumanSociety.territoryOwnerAt(site.x, site.y).factionId, banner.factionId);
    assert.ok(site.claimMaxX - site.claimMinX <= 22);
});

test("manual war persists until a sustained three-to-one imbalance annexes the weaker faction", () => {
    const harness = createHarness();
    for (let x = 1; x <= 72; x++) harness.createPixel("rock", x, 10);
    for (const x of [4, 6, 8, 10, 12, 14, 60, 62]) harness.createPixel("civilized_human", x, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }

    const strongBody = harness.getPixel(4, 9);
    const weakBodyA = harness.getPixel(60, 9);
    const weakBodyB = harness.getPixel(62, 9);
    const strongFaction = strongBody.factionId;
    const weakFaction = weakBodyA.factionId;
    assert.notEqual(strongFaction, weakFaction);
    harness.sandbox.pixelTicks = 120;
    assert.equal(harness.sandbox.HumanSociety.declareWar(strongFaction, weakFaction, "manual"), true);
    assert.equal(harness.sandbox.HumanSociety.atWar(strongFaction, weakFaction), true);
    harness.sandbox.HumanSociety.damageActor(weakBodyA, 1000, {factionId: strongFaction});

    for (let tick = 150; tick <= 660; tick += 30) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }

    assert.equal(harness.sandbox.HumanSociety.atWar(strongFaction, weakFaction), false);
    assert.equal(weakBodyB.factionId, strongFaction);
    const capturedBanner = harness.currentPixels.find((pixel) => !pixel.del && pixel.element === "civ_banner" && pixel.settlementId === weakBodyB.settlementId);
    assert.ok(capturedBanner);
    assert.equal(capturedBanner.factionId, strongFaction);

    // A save reload resets manager counters. Historical diplomacy IDs must
    // remain reserved so a new faction does not inherit a surrendered record.
    harness.resetCallbacks[0]();
    harness.sandbox.HumanSociety.forceReindex();
    harness.createPixel("civilized_human", 90, 8);
    assert.ok(harness.getPixel(90, 9).factionId > weakFaction);
});

test("surrender transfers partial research progress without directly unlocking a technology", () => {
    const harness = createHarness({techData: true});
    for (let x = 1; x <= 94; x++) harness.createPixel("rock", x, 10);
    for (const x of [4, 6, 8, 10, 12, 14, 16, 18, 70, 72]) {
        harness.createPixel("civilized_human", x, 8);
    }
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }

    const strongBody = harness.getPixel(4, 9);
    const weakBodyA = harness.getPixel(70, 9);
    const weakBodyB = harness.getPixel(72, 9);
    const strongFaction = strongBody.factionId;
    const weakFaction = weakBodyA.factionId;
    const banners = harness.currentPixels.filter((pixel) => !pixel.del && pixel.element === "civ_banner");
    const strongBanner = banners.find((banner) => banner.factionId === strongFaction);
    const weakBanner = banners.find((banner) => banner.factionId === weakFaction);
    const transferredTech = TechData.TECHNOLOGIES.find((tech) => tech.id === "siege_engineering");
    weakBanner.research.unlocked[transferredTech.id] = true;
    weakBanner.research.progress[transferredTech.id] = transferredTech.cost;

    harness.sandbox.pixelTicks = 120;
    harness.sandbox.HumanSociety.declareWar(strongFaction, weakFaction, "manual");
    assert.equal(harness.sandbox.HumanSociety.atWar(strongFaction, weakFaction), true);
    harness.sandbox.HumanSociety.damageActor(weakBodyA, 1000, {factionId: strongFaction});

    for (let tick = 150; tick <= 660; tick += 30) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }

    assert.equal(harness.sandbox.HumanSociety.atWar(strongFaction, weakFaction), false);
    assert.equal(weakBodyB.factionId, strongFaction);
    assert.equal(Boolean(strongBanner.research.unlocked[transferredTech.id]), false);
    assert.ok(strongBanner.research.progress[transferredTech.id] > 0);
    assert.ok(strongBanner.research.progress[transferredTech.id] < transferredTech.cost);
});

test("peace modes block declarations and suspend hostile damage without ending recorded wars", () => {
    const harness = createHarness();
    for (let x = 1; x <= 95; x++) harness.createPixel("rock", x, 10);
    for (const x of [6, 10]) harness.createPixel("civilized_human", x, 8);
    for (const tick of [30, 60, 90]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    for (const x of [70, 74]) harness.createPixel("civilized_human", x, 8);
    for (const tick of [120, 150, 180]) {
        harness.sandbox.pixelTicks = tick;
        harness.everyTickCallbacks[0]();
    }
    const api = harness.sandbox.HumanSociety;
    const factions = api.getDebugSnapshot().factions.map((entry) => entry.id).sort((a, b) => a - b);
    assert.equal(factions.length, 2);
    assert.equal(api.declareWar(factions[0], factions[1], "manual"), true);
    assert.equal(api.atWar(factions[0], factions[1]), true);

    assert.equal(api.setPeaceMode("full-peace"), "full-peace");
    assert.equal(api.atWar(factions[0], factions[1]), false);
    const suspended = api.getWarSnapshot(factions[0]);
    assert.equal(suspended.length, 1);
    assert.equal(suspended[0].suspended, true);
    const target = harness.currentPixels.find((pixel) => pixel.element === "civ_body" && pixel.factionId === factions[1]);
    const attacker = harness.currentPixels.find((pixel) => pixel.element === "civ_body" && pixel.factionId === factions[0]);
    const hp = target.hp;
    assert.equal(api.damageActor(target, 10, attacker), false);
    assert.equal(target.hp, hp);

    assert.equal(api.setPeaceMode("no-new-wars"), "no-new-wars");
    assert.equal(api.atWar(factions[0], factions[1]), true, "existing war resumes outside full peace");
    assert.equal(api.declareWar(factions[0], factions[1], "manual"), false, "new declarations are disabled even for an existing pair");
});

test("person commands select adults, move them, and preserve exact carry snapshots", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const actor = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    actor.carry = {wood: 2, food: 1};
    const selected = api.setCommandPerson(actor.humanId);
    assert.equal(selected.accepted, true);
    assert.equal(api.getInteractionMode(), "control");
    assert.equal(api.getPersonCommandState().humanId, actor.humanId);
    const move = api.issuePersonCommandAt(actor.humanId, 2, 14, 8);
    assert.equal(move.accepted, true);
    assert.equal(move.action, "move");
    assert.equal(actor.playerOrder.type, "move");
    const snapshot = api.getPersonSnapshot(actor.humanId);
    assert.equal(snapshot.carry.wood, 2);
    assert.equal(snapshot.carry.food, 1);
    assert.equal(snapshot.carryTotal, 3);
    assert.equal(snapshot.playerOrder.type, "move");
    api.cancelPersonCommand();
    assert.equal(api.getPersonCommandState().active, false);
    assert.equal(api.setInteractionMode("place"), "place");
});

test("task speech is exposed live and the persistent setting clears it", () => {
    const harness = createHarness({relationMovement: true});
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const actor = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    assert.equal(api.issuePersonCommandAt(actor.humanId, 2, 14, 9).accepted, true);
    assert.match(api.getPersonSnapshot(actor.humanId).speech.text, /On my way|我这就过去/);

    harness.sandbox.settings.humanSocietySpeech = false;
    harness.sandbox.pixelTicks = 2;
    harness.elements.civ_body.tick(actor);
    assert.equal(api.getPersonSnapshot(actor.humanId).speech, null);
});

test("control mode right-click selects a person and consumes the placement input", () => {
    const harness = createHarness({dom: true, relationMovement: true});
    for (let x = 1; x <= 30; x++) harness.createPixel("rock", x, 10);
    harness.createPixel("civilized_human", 8, 8);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const actor = harness.currentPixels.find((pixel) => pixel.element === "civ_body");
    api.setInteractionMode("control");

    const select = dispatchCanvasMouseDown(harness, 2, actor.x, actor.y);
    assert.equal(select.defaultPrevented, true);
    assert.equal(select.propagationStopped, true);
    assert.equal(api.getPersonCommandState().humanId, actor.humanId);

    const move = dispatchCanvasMouseDown(harness, 2, 14, 9);
    assert.equal(move.defaultPrevented, true);
    assert.equal(actor.playerOrder.type, "move");
});

test("buildingVisualAt resolves the whole 3x3 banner sprite and is not masked by overlapping humans", () => {
    const harness = createHarness();
    const banner = harness.createPixel("civ_banner", 40, 8, {factionId: 7, settlementId: 17, factionColor: "#336699"});
    // A civilized human overlaps a non-core sprite cell. buildingVisualAt() resolves the sprite
    // from the manager index, so the overlap must not hide it from erase, command, or render tools.
    harness.createPixel("civ_body", 39, 7, {humanId: 9001, factionId: 7});
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    // Every cell of the 3x3 sprite (core at 40,8; rect x 39..41, y 6..8) must resolve to the banner.
    for (let x = 39; x <= 41; x++) {
        for (let y = 6; y <= 8; y++) {
            const found = api.buildingVisualAt(x, y);
            assert.ok(found, `expected a banner at sprite cell (${x}, ${y})`);
            assert.equal(found.element, "civ_banner");
            assert.equal(found.factionId, 7);
        }
    }
    // Cells outside the sprite return nothing.
    assert.equal(api.buildingVisualAt(38, 8), null);
    assert.equal(api.buildingVisualAt(40, 9), null);
    assert.equal(api.buildingVisualAt(40, 5), null);
});

function dispatchCanvasMouseDown(harness, button, clientX, clientY) {
    const event = {
        button,
        clientX,
        clientY,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopImmediatePropagation() { this.propagationStopped = true; }
    };
    const listeners = harness.domCanvasListeners.mousedown;
    for (let i = 0; i < listeners.length; i++) {
        listeners[i](event);
        if (event.propagationStopped) break;
    }
    return event;
}

function dispatchCanvasTouchStart(harness, clientX, clientY) {
    const event = {
        touches: [{clientX, clientY}],
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopImmediatePropagation() { this.propagationStopped = true; }
    };
    const listeners = harness.domCanvasListeners.touchstart;
    for (let i = 0; i < listeners.length; i++) {
        listeners[i](event);
        if (event.propagationStopped) break;
    }
    return event;
}

test("clicking or touching a banner never opens the civilization panel", () => {
    const harness = createHarness({dom: true, techData: true});
    harness.createPixel("civ_banner", 40, 8, {factionId: 7, settlementId: 17, factionColor: "#336699"});
    harness.createPixel("civ_body", 39, 7, {humanId: 9001, factionId: 7});
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const parent = harness.domDocument.getElementById("civilizationParent");
    parent.style.display = "none";
    assert.equal(harness.elements.civ_banner.onClicked, undefined, "the logical core has no click callback");

    const mouse = dispatchCanvasMouseDown(harness, 0, 39, 6);
    assert.equal(mouse.defaultPrevented, false, "the normal engine click path remains available");
    assert.equal(mouse.propagationStopped, false);
    assert.equal(parent.style.display, "none");

    const touch = dispatchCanvasTouchStart(harness, 41, 6);
    assert.equal(touch.defaultPrevented, false);
    assert.equal(touch.propagationStopped, false);
    assert.equal(parent.style.display, "none");

    assert.equal(api.openCivilizationPanel(7), true, "the toolbar/API path remains available");
    assert.equal(parent.style.display, "block");
});

function createEquipmentScenario(options) {
    const settings = Object.assign({eraId: "tribal", adultCount: 1, soldierCount: 1, unlocked: []}, options || {});
    const quota = {soldiers: settings.soldierCount};
    const equipmentCore = Object.assign({}, Core, {
        eraPopulationTarget() {
            return settings.adultCount;
        },
        eraJobAllocation(era, workerCount) {
            const soldiers = Math.max(0, Math.min(workerCount, quota.soldiers));
            return {military: soldiers, flex: workerCount - soldiers};
        }
    });
    const harness = createHarness({techData: true, core: equipmentCore});
    const banner = harness.createPixel("civ_banner", 46, 20, {
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        eraId: settings.eraId,
        housing: Math.max(4, settings.adultCount)
    });
    const adults = [];
    for (let index = 0; index < settings.adultCount; index++) {
        adults.push(harness.createPixel("civ_body", 4 + index * 2, 8, {
            humanId: 100 + index,
            factionId: 7,
            settlementId: 17,
            factionColor: "#336699",
            role: "worker",
            task: "planning",
            hp: 100,
            maxHp: 100,
            baseMaxHp: 100,
            healthDamage: 0,
            birthTick: 0,
            naturalDeathTick: 100000,
            weapon: "fists",
            armor: "none",
            equipmentSchemaVersion: 3
        }));
    }
    const child = harness.createPixel("civ_child", 90, 8, {
        humanId: 999,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "child",
        hp: 40,
        maxHp: 40,
        baseMaxHp: 40,
        healthDamage: 0,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "fists",
        armor: "none",
        equipmentSchemaVersion: 3
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    banner.eraId = settings.eraId;
    settings.unlocked.forEach((techId) => { banner.research.unlocked[techId] = true; });
    api.setSettlementResources(7, 17, Object.assign({
        food: 100,
        wood: 100,
        stone: 100,
        copper: 100,
        bronze: 100,
        raw_iron: 100,
        iron: 100,
        steel: 100,
        sapling: 0
    }, settings.stock || {}));
    return {harness, api, banner, adults, child, quota};
}

function stepCivilization(harness, tick) {
    harness.sandbox.pixelTicks = tick;
    harness.everyTickCallbacks[0]();
}

function countWeapons(actors) {
    return actors.reduce((counts, actor) => {
        counts[actor.weapon] = (counts[actor.weapon] || 0) + 1;
        return counts;
    }, {});
}

test("public stock exposes exactly nine resources and legacy saves migrate once", () => {
    const harness = createHarness({techData: true});
    const banner = harness.createPixel("civ_banner", 46, 20, {
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        stock: {
            food: 2,
            wood: 4,
            stone: 5,
            copper: 7,
            tin: 3,
            charcoal: 2,
            bronze: 8,
            raw_iron: 9,
            iron: 10,
            steel: 11,
            materials: {wood: 4, stone: 5, copper: 7, tin: 3, charcoal: 2, bronze: 8, raw_iron: 9, iron: 10, steel: 11},
            seeds: {wheat_seed: 2, corn_seed: 1, sapling: 2},
            treeSaplings: {pinecone: 3}
        }
    });
    const veteran = harness.createPixel("civ_body", 8, 8, {
        humanId: 100,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "guard",
        task: "planning",
        hp: 100,
        maxHp: 100,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "spear"
    });
    const tinDrop = harness.createPixel("civ_tin_resource", 20, 8, {resourceKind: "tin", resourceAmount: 2});
    const charcoalDrop = harness.createPixel("civ_charcoal_resource", 22, 8, {resourceKind: "charcoal", resourceAmount: 2});
    const seedDrop = harness.createPixel("civ_seed_resource", 24, 8, {resourceKind: "seed:wheat_seed"});
    const api = harness.sandbox.HumanSociety;

    api.forceReindex();
    const first = api.getFactionSnapshot(7, 17);
    assert.deepEqual(Object.keys(first.stock).sort(), [
        "bronze", "copper", "food", "iron", "raw_iron", "sapling", "steel", "stone", "wood"
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(first.stock)), {
        food: 5,
        wood: 10,
        stone: 5,
        copper: 10,
        bronze: 8,
        raw_iron: 9,
        iron: 10,
        steel: 11,
        sapling: 5
    });
    assert.equal(veteran.weapon, "stone_spear");
    assert.deepEqual(JSON.parse(JSON.stringify(veteran.weaponPaidCost)), {wood: 1, stone: 1});
    assert.equal(tinDrop.element, "civ_copper_resource");
    assert.equal(tinDrop.resourceKind, "copper");
    assert.equal(charcoalDrop.element, "civ_wood_resource");
    assert.equal(charcoalDrop.resourceKind, "wood");
    assert.equal(charcoalDrop.resourceAmount, 6);
    assert.equal(seedDrop.element, "civ_food_resource");
    assert.equal(seedDrop.resourceKind, "food");

    api.forceReindex();
    assert.deepEqual(JSON.parse(JSON.stringify(api.getFactionSnapshot(7, 17).stock)), JSON.parse(JSON.stringify(first.stock)));
    assert.equal(banner.stock.resourceSchemaVersion > 0, true);
});

test("legacy farms and granaries retire into ruins while crops and workers migrate", () => {
    const harness = createHarness({techData: true});
    const banner = harness.createPixel("civ_banner", 7, 20, {
        factionId: 7,
        settlementId: 17,
        buildingId: 40,
        factionColor: "#336699",
        stock: {food: 0, wood: 0, materials: {}, seeds: {}, treeSaplings: {}}
    });
    const farm = harness.createPixel("civ_farm_marker", 12, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 55,
        factionColor: "#336699"
    });
    const granary = harness.createPixel("civ_granary_core", 15, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 56,
        factionColor: "#336699"
    });
    const unfinished = harness.createPixel("civ_construction", 18, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 57,
        factionColor: "#336699",
        blueprintType: "farm",
        costs: {wood: 8, stone: 3},
        workDone: 3,
        workRequired: 4
    });
    const immatureCrop = harness.createPixel("civ_farm_crop", 21, 15, {mature: false, matureTick: 100});
    const matureCrop = harness.createPixel("civ_farm_crop", 23, 15, {mature: true, matureTick: 0});
    const farmer = harness.createPixel("civ_body", 25, 15, {
        humanId: 100,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "farmer",
        task: "farm",
        targetId: farm.buildingId,
        hp: 100,
        maxHp: 100,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "fists"
    });
    const industryWorker = harness.createPixel("civ_body", 27, 15, {
        humanId: 101,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "industry",
        task: "facility",
        targetId: granary.buildingId,
        hp: 100,
        maxHp: 100,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "fists"
    });
    const api = harness.sandbox.HumanSociety;

    api.forceReindex();

    assert.equal(farm.element, "civ_ruin");
    assert.equal(granary.element, "civ_ruin");
    assert.equal(unfinished.del, true);
    assert.equal(api.getFactionSnapshot(7, 17).stock.wood, 8, "removed construction refunds every paid wood unit regardless of progress");
    assert.equal(api.getFactionSnapshot(7, 17).stock.stone, 3, "removed construction refunds every paid stone unit regardless of progress");
    assert.equal(immatureCrop.element, "civ_food_resource");
    assert.equal(immatureCrop.resourceAmount, 1);
    assert.equal(matureCrop.element, "civ_food_resource");
    assert.equal(matureCrop.resourceAmount, 2);
    assert.equal(farmer.role, "food");
    assert.equal(farmer.task, "planning");
    assert.equal(industryWorker.role, "worker");
    assert.equal(industryWorker.task, "planning");
    assert.ok(TechData.TECHNOLOGIES.every((technology) => (technology.effects || []).every((effect) => {
        return effect.type !== "unlock" || effect.target !== "building" || (effect.id !== "farm" && effect.id !== "granary");
    })));
    assert.equal(banner.element, "civ_banner");
});

test("ordinary construction cancellation still refunds half of only unfinished work", () => {
    const harness = createHarness({techData: true});
    harness.createPixel("civ_banner", 7, 20, {
        factionId: 7,
        settlementId: 17,
        buildingId: 40,
        factionColor: "#336699",
        stock: {food: 0, wood: 0, stone: 0, materials: {}, seeds: {}, treeSaplings: {}}
    });
    const site = harness.createPixel("civ_construction", 18, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 57,
        factionColor: "#336699",
        blueprintType: "workshop",
        costs: {wood: 10, stone: 8},
        workDone: 3,
        workRequired: 6
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();

    harness.sandbox.deletePixel(site.x, site.y);

    assert.equal(api.getFactionSnapshot(7, 17).stock.wood, 2);
    assert.equal(api.getFactionSnapshot(7, 17).stock.stone, 2);
});

test("specialists without a usable facility gather resources instead of patrolling", () => {
    const harness = createHarness({techData: true});
    const banner = harness.createPixel("civ_banner", 7, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 40,
        factionColor: "#336699",
        stock: {food: 0, wood: 0, stone: 0, materials: {}, seeds: {}, treeSaplings: {}}
    });
    const automaticFoundry = harness.createPixel("civ_foundry_core", 50, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 50,
        factionColor: "#336699"
    });
    for (let x = 5; x <= 50; x++) harness.createPixel("dirt", x, 16);
    const specialists = ["artisan", "scholar", "merchant"].map((role, index) => harness.createPixel("civ_body", 10 + index * 2, 15, {
        humanId: 100 + index,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role,
        task: role === "merchant" ? "facility" : "planning",
        targetId: role === "merchant" ? automaticFoundry.buildingId : undefined,
        targetX: role === "merchant" ? automaticFoundry.x : undefined,
        targetY: role === "merchant" ? automaticFoundry.y : undefined,
        hp: 100,
        maxHp: 100,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "fists"
    }));
    [20, 30, 40].forEach((x) => harness.createPixel("civ_food_resource", x, 15, {
        resourceKind: "food",
        resourceAmount: 1
    }));
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    assert.deepEqual(specialists.map((actor) => actor.role), ["artisan", "scholar", "merchant"]);

    specialists.forEach((actor, index) => {
        const baseTick = 1 + index * api.config.THINK_INTERVAL;
        harness.sandbox.pixelTicks = baseTick + ((api.config.THINK_INTERVAL - ((baseTick + actor.humanId) % api.config.THINK_INTERVAL)) % api.config.THINK_INTERVAL);
        harness.elements.civ_body.tick(actor);
        assert.equal(actor.task, "harvest", `${actor.role} should fall back to resource gathering`);
        assert.equal(actor.workTrip && actor.workTrip.resourceKind, "food");
        assert.notEqual(actor.task, "patrol");
    });
    assert.equal(banner.element, "civ_banner");
});

test("peacetime guards patrol even when collectible resources are available", () => {
    const harness = createHarness({techData: true});
    harness.sandbox.Math.random = () => 0;
    const banner = harness.createPixel("civ_banner", 7, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 40,
        factionColor: "#336699"
    });
    const guard = harness.createPixel("civ_body", 10, 15, {
        humanId: 100,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "guard",
        task: "planning",
        hp: 100,
        maxHp: 100,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "fists"
    });
    for (let x = 5; x <= 24; x++) harness.createPixel("dirt", x, 16);
    harness.createPixel("apple", 20, 15);
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    const baseTick = 1;
    harness.sandbox.pixelTicks = baseTick + ((api.config.THINK_INTERVAL - ((baseTick + guard.humanId) % api.config.THINK_INTERVAL)) % api.config.THINK_INTERVAL);
    harness.elements.civ_body.tick(guard);

    assert.equal(guard.task, "patrol");
    assert.equal(guard.targetId, banner.buildingId);
    assert.equal(guard.harvestX, undefined);
});

test("automatic metal workshops consume the exact bronze, iron, and steel recipes", () => {
    const fuelRequests = [];
    const industryCore = Object.assign({}, Core, {
        eraPopulationTarget() {
            return 1;
        },
        eraJobAllocation(era, workerCount) {
            return {flex: workerCount};
        },
        selectFuelCombination(available, requiredFuel, fuelValues) {
            fuelRequests.push({available: Object.assign({}, available), requiredFuel});
            return Core.selectFuelCombination(available, requiredFuel, fuelValues);
        }
    });
    const cases = [
        {
            name: "bronze",
            facility: "civ_foundry_core",
            tech: "bronze_foundry",
            eraId: "bronze",
            stock: {wood: 49, copper: 1},
            expected: {wood: 48, bronze: 1}
        },
        {
            name: "iron",
            facility: "civ_kiln_core",
            tech: "iron_smelting",
            eraId: "iron",
            stock: {wood: 66, bronze: 1, raw_iron: 1},
            expected: {wood: 64, iron: 1}
        },
        {
            name: "steel",
            facility: "civ_forge_core",
            tech: "steelmaking",
            eraId: "castle",
            stock: {wood: 100, bronze: 1, iron: 2},
            expected: {wood: 96, steel: 1}
        }
    ];

    for (const entry of cases) {
        fuelRequests.length = 0;
        const harness = createHarness({techData: true, core: industryCore});
        const banner = harness.createPixel("civ_banner", 20, 20, {
            factionId: 7,
            settlementId: 17,
            buildingId: 40,
            factionColor: "#336699",
            eraId: entry.eraId
        });
        const facility = harness.createPixel(entry.facility, 20, 15, {
            factionId: 7,
            settlementId: 17,
            buildingId: 50,
            factionColor: "#336699",
            lastProcessTick: 0
        });
        const legacyKiln = harness.createPixel("civ_kiln_core", 22, 15, {
            factionId: 7,
            settlementId: 17,
            buildingId: 52,
            factionColor: "#336699"
        });
        harness.createPixel("civ_lumberyard_core", 30, 15, {
            factionId: 7,
            settlementId: 17,
            buildingId: 51,
            factionColor: "#336699"
        });
        const worker = harness.createPixel("civ_body", 21, 15, {
            humanId: 100,
            factionId: 7,
            settlementId: 17,
            factionColor: "#336699",
            role: "worker",
            task: "planning",
            hp: 100,
            maxHp: 100,
            birthTick: 0,
            naturalDeathTick: 100000,
            weapon: "fists"
        });
        harness.createPixel("dirt", 21, 16);
        const api = harness.sandbox.HumanSociety;
        api.forceReindex();
        banner.research.unlocked[entry.tech] = true;
        api.setSettlementResources(7, 17, Object.assign({
            food: 100,
            wood: 0,
            stone: 0,
            copper: 0,
            bronze: 0,
            raw_iron: 0,
            iron: 0,
            steel: 0,
            sapling: 0
        }, entry.stock));

        stepCivilization(harness, 150);

        assert.equal(worker.role, "worker", `${entry.name} production must not create an industry job`);
        assert.equal(facility.lastProcessTick, 150, `${entry.name} runs in the real facility processing loop`);
        assert.deepEqual(JSON.parse(JSON.stringify(api.getFactionSnapshot(7, 17).stock)), Object.assign({
            food: 100,
            wood: 0,
            stone: 0,
            copper: 0,
            bronze: 0,
            raw_iron: 0,
            iron: 0,
            steel: 0,
            sapling: 0
        }, entry.expected));

        worker.task = "planning";
        harness.sandbox.pixelTicks = 160;
        harness.elements.civ_body.tick(worker);
        assert.notEqual(worker.task, "facility");
        assert.notEqual(worker.targetId, legacyKiln.buildingId);
    }
});

test("automatic workshops never burn below the current era wood reserve", () => {
    const cases = [
        {eraId: "bronze", reserve: 48, heat: 1, facility: "civ_foundry_core", tech: "bronze_foundry", inputs: {copper: 1}, output: "bronze"},
        {eraId: "iron", reserve: 64, heat: 2, facility: "civ_kiln_core", tech: "iron_smelting", inputs: {raw_iron: 1, bronze: 1}, output: "iron"},
        {eraId: "castle", reserve: 96, heat: 4, facility: "civ_forge_core", tech: "steelmaking", inputs: {iron: 2, bronze: 1}, output: "steel"}
    ];
    for (const entry of cases) {
        const harness = createHarness({techData: true});
        const banner = harness.createPixel("civ_banner", 20, 15, {
            factionId: 7, settlementId: 17, buildingId: 40, factionColor: "#336699", eraId: entry.eraId
        });
        const facility = harness.createPixel(entry.facility, 24, 15, {
            factionId: 7, settlementId: 17, buildingId: 41, factionColor: "#336699", lastProcessTick: 0
        });
        const api = harness.sandbox.HumanSociety;
        api.forceReindex();
        banner.research.unlocked[entry.tech] = true;
        api.setSettlementResources(7, 17, Object.assign({food: 0, wood: entry.reserve + entry.heat - 1}, entry.inputs));
        stepCivilization(harness, 30);
        assert.equal(facility.lastProcessTick, 0, `${entry.eraId} pauses one wood below the protected batch threshold`);
        assert.equal(api.getFactionSnapshot(7, 17).stock[entry.output], 0);

        api.setSettlementResources(7, 17, {wood: entry.reserve + entry.heat});
        stepCivilization(harness, 60);
        const snapshot = api.getFactionSnapshot(7, 17);
        assert.equal(facility.lastProcessTick, 60);
        assert.equal(snapshot.stock.wood, entry.reserve);
        assert.equal(snapshot.stock[entry.output], 1);
        assert.equal(snapshot.woodSmeltingReserve, entry.reserve);
    }
});

test("same-tick workshop reservations share one protected wood ledger", () => {
    const harness = createHarness({techData: true});
    const banner = harness.createPixel("civ_banner", 20, 15, {
        factionId: 7, settlementId: 17, buildingId: 40, factionColor: "#336699", eraId: "castle"
    });
    const facilities = [
        harness.createPixel("civ_foundry_core", 24, 15, {factionId: 7, settlementId: 17, buildingId: 41, factionColor: "#336699", lastProcessTick: 0}),
        harness.createPixel("civ_foundry_core", 26, 15, {factionId: 7, settlementId: 17, buildingId: 42, factionColor: "#336699", lastProcessTick: 0}),
        harness.createPixel("civ_kiln_core", 28, 15, {factionId: 7, settlementId: 17, buildingId: 43, factionColor: "#336699", lastProcessTick: 0}),
        harness.createPixel("civ_forge_core", 30, 15, {factionId: 7, settlementId: 17, buildingId: 44, factionColor: "#336699", lastProcessTick: 0})
    ];
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    ["bronze_foundry", "iron_smelting", "steelmaking"].forEach((techId) => { banner.research.unlocked[techId] = true; });
    api.setSettlementResources(7, 17, {food: 0, wood: 100, copper: 2, bronze: 2, raw_iron: 1, iron: 2});
    stepCivilization(harness, 30);
    const stock = api.getFactionSnapshot(7, 17).stock;
    assert.equal(stock.wood, 96);
    assert.equal(stock.steel, 0, "the later forge cannot spend wood reserved by earlier proposals");
    assert.deepEqual(facilities.map((facility) => facility.lastProcessTick), [30, 30, 30, 0]);
});

test("legacy facility assignments retire instead of creating industry workers", () => {
    const industryCore = Object.assign({}, Core, {
        eraPopulationTarget() {
            return 2;
        },
        eraJobAllocation(era, workerCount) {
            return {flex: workerCount};
        }
    });
    const harness = createHarness({techData: true, core: industryCore});
    const banner = harness.createPixel("civ_banner", 46, 20, {
        factionId: 7,
        settlementId: 17,
        buildingId: 40,
        factionColor: "#336699",
        eraId: "castle"
    });
    const foundry = harness.createPixel("civ_foundry_core", 25, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 50,
        factionColor: "#336699"
    });
    const forge = harness.createPixel("civ_forge_core", 70, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 51,
        factionColor: "#336699"
    });
    harness.createPixel("civ_lumberyard_core", 46, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 52,
        factionColor: "#336699"
    });
    const workers = [100, 110].map((humanId, index) => harness.createPixel("civ_body", 23 + index, 15, {
        humanId,
        factionId: 7,
        settlementId: 17,
        factionColor: "#336699",
        role: "worker",
        task: "facility",
        targetId: foundry.buildingId,
        targetX: foundry.x,
        targetY: foundry.y,
        targetKind: foundry.element,
        hp: 100,
        maxHp: 100,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "fists"
    }));
    for (let x = 23; x <= 70; x++) harness.createPixel("dirt", x, 16);

    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    banner.research.unlocked.bronze_foundry = true;
    banner.research.unlocked.iron_smelting = true;
    banner.research.unlocked.steelmaking = true;
    api.setSettlementResources(7, 17, {
        food: 100,
        wood: 7,
        copper: 1,
        bronze: 2,
        raw_iron: 1,
        iron: 2
    });
    stepCivilization(harness, 30);
    assert.equal(api.getBuildingById(foundry.buildingId), foundry);
    assert.equal(api.getBuildingById(forge.buildingId), forge);
    workers.forEach((worker) => {
        assert.equal(worker.role, "worker");
        assert.notEqual(worker.task, "facility");
        assert.notEqual(worker.targetId, foundry.buildingId);
        assert.notEqual(worker.targetId, forge.buildingId);
    });
});

test("three automatic workshops run once per 30 ticks with two-phase recipe settlement", () => {
    const harness = createHarness({techData: true});
    for (const x of [10, 20, 30, 40, 50]) harness.createPixel("dirt", x, 16);
    const banner = harness.createPixel("civ_banner", 10, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 40,
        factionColor: "#336699",
        eraId: "castle",
        housing: 100
    });
    const foundry = harness.createPixel("civ_foundry_core", 20, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 50,
        factionColor: "#336699",
        lastProcessTick: 0
    });
    const kiln = harness.createPixel("civ_kiln_core", 30, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 51,
        factionColor: "#336699",
        lastProcessTick: 0
    });
    const forge = harness.createPixel("civ_forge_core", 40, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 52,
        factionColor: "#336699",
        lastProcessTick: 0
    });
    harness.createPixel("civ_lumberyard_core", 50, 15, {
        factionId: 7,
        settlementId: 17,
        buildingId: 53,
        factionColor: "#336699"
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    ["bronze_foundry", "iron_smelting", "steelmaking"].forEach((techId) => {
        banner.research.unlocked[techId] = true;
    });
    api.setSettlementResources(7, 17, {
        food: 0,
        wood: 196,
        stone: 0,
        copper: 4,
        bronze: 0,
        raw_iron: 2,
        iron: 0,
        steel: 0,
        sapling: 0
    });
    const stock = () => JSON.parse(JSON.stringify(api.getFactionSnapshot(7, 17).stock));

    stepCivilization(harness, 29);
    assert.deepEqual(stock(), {food: 0, wood: 196, stone: 0, copper: 4, bronze: 0, raw_iron: 2, iron: 0, steel: 0, sapling: 0});

    stepCivilization(harness, 30);
    assert.deepEqual(stock(), {food: 0, wood: 195, stone: 0, copper: 3, bronze: 1, raw_iron: 2, iron: 0, steel: 0, sapling: 0});

    stepCivilization(harness, 60);
    assert.deepEqual(stock(), {food: 0, wood: 192, stone: 0, copper: 2, bronze: 1, raw_iron: 1, iron: 1, steel: 0, sapling: 0}, "bronze made at tick 60 cannot feed the kiln until the next batch");

    stepCivilization(harness, 90);
    assert.deepEqual(stock(), {food: 0, wood: 189, stone: 0, copper: 1, bronze: 1, raw_iron: 0, iron: 2, steel: 0, sapling: 0}, "new iron cannot feed the forge in the same batch");

    stepCivilization(harness, 120);
    assert.deepEqual(stock(), {food: 0, wood: 184, stone: 0, copper: 0, bronze: 1, raw_iron: 0, iron: 0, steel: 1, sapling: 0});
    stepCivilization(harness, 120);
    assert.deepEqual(stock(), {food: 0, wood: 184, stone: 0, copper: 0, bronze: 1, raw_iron: 0, iron: 0, steel: 1, sapling: 0}, "a workshop cannot run twice at the same 30-tick boundary");
    assert.equal(foundry.lastProcessTick, 120);
    assert.equal(kiln.lastProcessTick, 90);
    assert.equal(forge.lastProcessTick, 120);
    assert.equal(harness.currentPixels.some((pixel) => !pixel.del && pixel.element === "civ_body"), false, "production needs no worker");
});

test("castle equipment demand recursively requests raw ore and fuel for every intermediate", () => {
    const scenario = createEquipmentScenario({
        eraId: "castle",
        adultCount: 1,
        soldierCount: 1,
        unlocked: TechData.TECHNOLOGIES.map((technology) => technology.id),
        stock: {
            food: 0,
            wood: 0,
            stone: 0,
            copper: 0,
            bronze: 0,
            raw_iron: 0,
            iron: 0,
            steel: 0,
            sapling: 0
        }
    });
    const facilities = [
        "civ_lumberyard_core", "civ_hearth_core", "civ_workshop_core", "civ_quarry_core",
        "civ_foundry_core", "civ_kiln_core", "civ_forge_core"
    ];
    facilities.forEach((elementName, index) => {
        scenario.harness.createPixel(elementName, 56 + index * 2, 15, {
            factionId: 7,
            settlementId: 17,
            buildingId: 200 + index,
            factionColor: "#336699"
        });
    });
    scenario.api.forceReindex();
    stepCivilization(scenario.harness, 30);
    stepCivilization(scenario.harness, 60);

    assert.deepEqual(JSON.parse(JSON.stringify(scenario.banner.resourceDemand)), {
        food: 0,
        wood: 167,
        stone: 2,
        copper: 20,
        raw_iron: 13
    });
    assert.equal(scenario.adults[0].weapon, "fists", "missing inputs leave the soldier waiting for equipment");
    assert.equal(scenario.adults[0].armor, "none");
    assert.equal(scenario.api.getFactionSnapshot(7, 17).woodSmeltingReserve, 96);
});

test("era equipment quotas are deterministic, immediate, and restricted to soldiers", () => {
    const cases = [
        {eraId: "tribal", unlocked: [], expected: {club: 5}},
        {eraId: "stone", unlocked: ["polished_axes"], expected: {stone_spear: 5}},
        {eraId: "agriculture", unlocked: ["polished_axes", "bowmaking"], expected: {stone_spear: 3, bow: 2}},
        {eraId: "bronze", unlocked: ["bronze_weapons", "bowmaking"], expected: {bronze_sword: 2, bronze_spear: 2, bow: 1}},
        {eraId: "iron", unlocked: ["iron_weapons", "bowmaking"], expected: {iron_sword: 2, iron_spear: 2, bow: 1}},
        {eraId: "castle", unlocked: ["carburizing_tempering", "crossbow"], expected: {steel_blade: 2, steel_spear: 2, crossbow: 1}}
    ];

    for (const entry of cases) {
        const first = createEquipmentScenario({
            eraId: entry.eraId,
            adultCount: 5,
            soldierCount: 5,
            unlocked: entry.unlocked
        });
        stepCivilization(first.harness, 30);
        const soldiers = first.adults.filter((actor) => actor.role === "guard" || actor.role === "warrior" || actor.warRole === "attacker" || actor.warRole === "defender");
        const civilians = first.adults.filter((actor) => !soldiers.includes(actor));
        const assignment = first.adults.slice().sort((a, b) => a.humanId - b.humanId).map((actor) => actor.weapon);

        assert.equal(first.harness.currentPixels.some((pixel) => !pixel.del && [
            "civ_workshop_core", "civ_foundry_core", "civ_forge_core"
        ].includes(pixel.element)), false, `${entry.eraId} equipment must not need a facility`);
        assert.equal(soldiers.length, 5, JSON.stringify({
            allocation: first.harness.sandbox.HumanSocietyCore.eraJobAllocation(0, first.adults.length),
            roles: first.adults.map((actor) => ({id: actor.humanId, role: actor.role, warRole: actor.warRole, weapon: actor.weapon}))
        }));
        assert.deepEqual(countWeapons(soldiers), entry.expected);
        assert.ok(civilians.every((actor) => actor.weapon === "fists"));
        assert.equal(first.child.weapon, "fists");

        const stockAfterEquip = JSON.stringify(first.api.getFactionSnapshot(7, 17).stock);
        stepCivilization(first.harness, 60);
        assert.deepEqual(first.adults.slice().sort((a, b) => a.humanId - b.humanId).map((actor) => actor.weapon), assignment);
        assert.equal(JSON.stringify(first.api.getFactionSnapshot(7, 17).stock), stockAfterEquip, `${entry.eraId} stable equipment must not spend twice`);

        const second = createEquipmentScenario({
            eraId: entry.eraId,
            adultCount: 5,
            soldierCount: 5,
            unlocked: entry.unlocked
        });
        stepCivilization(second.harness, 30);
        assert.deepEqual(second.adults.slice().sort((a, b) => a.humanId - b.humanId).map((actor) => actor.weapon), assignment);
    }

    const restricted = createEquipmentScenario({
        eraId: "agriculture",
        adultCount: 7,
        soldierCount: 1,
        unlocked: ["polished_axes", "bowmaking"]
    });
    stepCivilization(restricted.harness, 30);
    const armedAdults = restricted.adults.filter((actor) => actor.weapon !== "fists");
    assert.equal(armedAdults.length, 1);
    assert.ok(armedAdults.every((actor) => actor.role === "guard" || actor.role === "warrior" || actor.warRole === "attacker" || actor.warRole === "defender"));
    assert.ok(restricted.adults.filter((actor) => !armedAdults.includes(actor)).every((actor) => actor.weapon === "fists"));
    assert.equal(restricted.child.weapon, "fists");
});

test("tribal clubs need only wood while later weapons retain their technology gates", () => {
    const tribal = createEquipmentScenario({eraId: "tribal", adultCount: 1, soldierCount: 1, unlocked: []});
    stepCivilization(tribal.harness, 30);
    assert.deepEqual(countWeapons(tribal.adults), {club: 1});

    const stone = createEquipmentScenario({eraId: "stone", adultCount: 1, soldierCount: 1, unlocked: []});
    stepCivilization(stone.harness, 30);
    assert.deepEqual(countWeapons(stone.adults), {club: 1}, "without polished tools the soldier keeps the tribal club");
    stone.banner.research.unlocked.polished_axes = true;
    stepCivilization(stone.harness, 60);
    assert.deepEqual(countWeapons(stone.adults), {stone_spear: 1});

    const agriculture = createEquipmentScenario({eraId: "agriculture", adultCount: 2, soldierCount: 2, unlocked: ["polished_axes"]});
    stepCivilization(agriculture.harness, 30);
    assert.deepEqual(countWeapons(agriculture.adults), {stone_spear: 2}, "locked bow slots retain the best researched earlier-era weapon");
    agriculture.banner.research.unlocked.bowmaking = true;
    stepCivilization(agriculture.harness, 60);
    assert.deepEqual(countWeapons(agriculture.adults), {stone_spear: 1, bow: 1});

    const bronze = createEquipmentScenario({eraId: "bronze", adultCount: 3, soldierCount: 3, unlocked: ["bowmaking"]});
    stepCivilization(bronze.harness, 30);
    assert.deepEqual(countWeapons(bronze.adults), {club: 2, bow: 1});
    bronze.banner.research.unlocked.bronze_weapons = true;
    stepCivilization(bronze.harness, 60);
    assert.deepEqual(countWeapons(bronze.adults), {bronze_sword: 1, bronze_spear: 1, bow: 1});

    const iron = createEquipmentScenario({eraId: "iron", adultCount: 3, soldierCount: 3, unlocked: ["bowmaking"]});
    stepCivilization(iron.harness, 30);
    assert.deepEqual(countWeapons(iron.adults), {club: 2, bow: 1});
    iron.banner.research.unlocked.iron_weapons = true;
    stepCivilization(iron.harness, 60);
    assert.deepEqual(countWeapons(iron.adults), {iron_sword: 1, iron_spear: 1, bow: 1});

    const castle = createEquipmentScenario({eraId: "castle", adultCount: 3, soldierCount: 3, unlocked: ["carburizing_tempering"]});
    stepCivilization(castle.harness, 30);
    assert.deepEqual(countWeapons(castle.adults), {steel_blade: 1, steel_spear: 1, club: 1});
    castle.banner.research.unlocked.crossbow = true;
    stepCivilization(castle.harness, 60);
    assert.deepEqual(countWeapons(castle.adults), {steel_blade: 1, steel_spear: 1, crossbow: 1});
});

test("weapon swaps and demotions fully refund paid costs while deaths refund nothing", () => {
    const swap = createEquipmentScenario({
        eraId: "tribal",
        adultCount: 1,
        soldierCount: 1,
        unlocked: ["war_clubs", "polished_axes"],
        stock: {wood: 3, stone: 1, bronze: 0, iron: 0, steel: 0}
    });
    stepCivilization(swap.harness, 30);
    assert.equal(swap.adults[0].weapon, "club");
    assert.deepEqual(JSON.parse(JSON.stringify(swap.adults[0].weaponPaidCost)), {wood: 1});
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.wood, 2);

    swap.banner.eraId = "stone";
    stepCivilization(swap.harness, 60);
    assert.equal(swap.adults[0].weapon, "stone_spear");
    assert.deepEqual(JSON.parse(JSON.stringify(swap.adults[0].weaponPaidCost)), {wood: 2, stone: 1});
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.wood, 1, "the club cost is refunded before the spear cost is paid");
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.stone, 0);

    swap.quota.soldiers = 0;
    stepCivilization(swap.harness, 90);
    assert.equal(swap.adults[0].weapon, "fists");
    assert.equal(swap.adults[0].weaponPaidCost, undefined);
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.wood, 3);
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.stone, 1);

    const death = createEquipmentScenario({
        eraId: "tribal",
        adultCount: 1,
        soldierCount: 1,
        unlocked: ["war_clubs"],
        stock: {wood: 1, stone: 0, bronze: 0, iron: 0, steel: 0}
    });
    stepCivilization(death.harness, 30);
    assert.equal(death.adults[0].weapon, "club");
    assert.equal(death.api.getFactionSnapshot(7, 17).stock.wood, 0);
    assert.equal(death.api.damageActor(death.adults[0], 1000, {factionId: 8}), true);
    stepCivilization(death.harness, 60);
    assert.equal(death.api.getFactionSnapshot(7, 17).stock.wood, 0, "a dead soldier's weapon is permanently lost");
});

test("armor era targets equip immediately but remain restricted to soldiers and technology gates", () => {
    const cases = [
        {eraId: "stone", tech: "rattan_armor", armor: "none", bonus: 0, resource: "wood", expectedRemaining: 8},
        {eraId: "agriculture", tech: "rattan_armor", armor: "rattan", bonus: 100, resource: "wood", expectedRemaining: 0},
        {eraId: "bronze", tech: "rattan_armor", armor: "rattan", bonus: 100, resource: "wood", expectedRemaining: 0},
        {eraId: "iron", tech: "iron_armor", armor: "iron", bonus: 220, resource: "iron", expectedRemaining: 0},
        {eraId: "castle", tech: "steel_armor", armor: "steel", bonus: 420, resource: "steel", expectedRemaining: 0}
    ];

    for (const entry of cases) {
        const scenario = createEquipmentScenario({
            eraId: entry.eraId,
            adultCount: 3,
            soldierCount: 2,
            unlocked: [entry.tech],
            stock: {wood: 10, iron: 8, steel: 8}
        });
        stepCivilization(scenario.harness, 30);
        const soldiers = scenario.adults.filter((actor) => actor.role === "guard" || actor.role === "warrior");
        const civilians = scenario.adults.filter((actor) => !soldiers.includes(actor));

        assert.equal(soldiers.length, 2);
        assert.ok(soldiers.every((actor) => actor.armor === entry.armor));
        assert.ok(soldiers.every((actor) => actor.maxHp === 100 + entry.bonus && actor.hp === 100 + entry.bonus));
        assert.ok(civilians.every((actor) => actor.armor === "none" && actor.maxHp === 100));
        assert.equal(scenario.child.armor, "none");
        assert.equal(scenario.api.getFactionSnapshot(7, 17).stock[entry.resource], entry.expectedRemaining);
    }

    const gated = createEquipmentScenario({
        eraId: "agriculture",
        adultCount: 1,
        soldierCount: 1,
        unlocked: [],
        stock: {wood: 4}
    });
    stepCivilization(gated.harness, 30);
    assert.equal(gated.adults[0].armor, "none");
    assert.equal(gated.api.getFactionSnapshot(7, 17).stock.wood, 3, "the ungated club still consumes one wood");
});

test("scarce shared materials arm every soldier before issuing armor", () => {
    const scenario = createEquipmentScenario({
        eraId: "agriculture",
        adultCount: 2,
        soldierCount: 2,
        unlocked: ["rattan_armor"],
        stock: {wood: 5, stone: 0, iron: 0, steel: 0}
    });

    stepCivilization(scenario.harness, 30);

    assert.deepEqual(countWeapons(scenario.adults), {club: 2});
    assert.ok(scenario.adults.every((actor) => actor.armor === "none"));
    assert.equal(scenario.api.getFactionSnapshot(7, 17).stock.wood, 3);
});

test("armor swaps and demotions refund costs while preserving absolute damage", () => {
    const swap = createEquipmentScenario({
        eraId: "agriculture",
        adultCount: 1,
        soldierCount: 1,
        unlocked: ["rattan_armor"],
        stock: {wood: 5, iron: 4, steel: 4}
    });
    const actor = swap.adults[0];
    stepCivilization(swap.harness, 30);
    assert.equal(actor.armor, "rattan");
    assert.deepEqual(JSON.parse(JSON.stringify(actor.armorPaidCost)), {wood: 4});
    assert.equal(actor.maxHp, 200);
    assert.equal(actor.hp, 200);
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.wood, 0);

    assert.equal(swap.api.damageActor(actor, 150, {factionId: 8}), true);
    assert.equal(actor.healthDamage, 150);
    assert.equal(actor.hp, 50);

    swap.quota.soldiers = 0;
    stepCivilization(swap.harness, 60);
    assert.equal(actor.armor, "none");
    assert.equal(actor.maxHp, 100);
    assert.equal(actor.hp, 1, "removing armor cannot kill a living soldier");
    assert.equal(actor.healthDamage, 150);
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.wood, 5);

    swap.quota.soldiers = 1;
    stepCivilization(swap.harness, 90);
    assert.equal(actor.armor, "rattan");
    assert.equal(actor.maxHp, 200);
    assert.equal(actor.hp, 50, "putting the same armor back on cannot heal the stored damage");
    assert.equal(actor.healthDamage, 150);

    swap.banner.eraId = "iron";
    swap.banner.research.unlocked.iron_armor = true;
    stepCivilization(swap.harness, 120);
    assert.equal(actor.armor, "iron");
    assert.equal(actor.maxHp, 320);
    assert.equal(actor.hp, 170);
    assert.deepEqual(JSON.parse(JSON.stringify(actor.armorPaidCost)), {iron: 4});
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.wood, 4);
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.iron, 0);

    swap.banner.eraId = "castle";
    swap.banner.research.unlocked.steel_armor = true;
    stepCivilization(swap.harness, 150);
    assert.equal(actor.armor, "steel");
    assert.equal(actor.maxHp, 520);
    assert.equal(actor.hp, 370);
    assert.deepEqual(JSON.parse(JSON.stringify(actor.armorPaidCost)), {steel: 4});
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.iron, 4);
    assert.equal(swap.api.getFactionSnapshot(7, 17).stock.steel, 0);

    const death = createEquipmentScenario({
        eraId: "agriculture",
        adultCount: 1,
        soldierCount: 1,
        unlocked: ["rattan_armor"],
        stock: {wood: 5}
    });
    stepCivilization(death.harness, 30);
    assert.equal(death.adults[0].armor, "rattan");
    assert.equal(death.api.getFactionSnapshot(7, 17).stock.wood, 0);
    assert.equal(death.api.damageActor(death.adults[0], 1000, {factionId: 8}), true);
    stepCivilization(death.harness, 60);
    assert.equal(death.api.getFactionSnapshot(7, 17).stock.wood, 0, "dead soldiers do not refund armor");
});

test("person snapshots and Simplified Chinese histories expose weapon and armor changes", () => {
    const scenario = createEquipmentScenario({
        eraId: "agriculture",
        adultCount: 1,
        soldierCount: 1,
        unlocked: ["polished_axes", "rattan_armor"],
        stock: {wood: 6, stone: 1}
    });
    scenario.harness.sandbox.langCode = "zh_cn";
    const actor = scenario.adults[0];

    stepCivilization(scenario.harness, 30);
    const living = scenario.api.getPersonSnapshot(actor.humanId);
    assert.equal(living.weapon, "stone_spear");
    assert.equal(living.armor, "rattan");
    assert.equal(living.armorBonusHp, 100);

    let history = scenario.api.getPersonHistory(actor.humanId, {limit: 100});
    const equippedWeapon = history.entries.find((entry) => entry.type === "weapon_equipped");
    const equippedArmor = history.entries.find((entry) => entry.type === "armor_equipped");
    assert.match(equippedWeapon.description, /装备武器/);
    assert.match(equippedArmor.description, /装备护甲/);
    assert.doesNotMatch(equippedWeapon.description + equippedArmor.description, /未知活动|未知武器|未知护甲/);

    scenario.quota.soldiers = 0;
    stepCivilization(scenario.harness, 60);
    history = scenario.api.getPersonHistory(actor.humanId, {limit: 100});
    const removedWeapon = history.entries.find((entry) => entry.type === "weapon_removed");
    const removedArmor = history.entries.find((entry) => entry.type === "armor_removed");
    assert.match(removedWeapon.description, /卸下武器/);
    assert.match(removedArmor.description, /卸下护甲/);
    assert.doesNotMatch(removedWeapon.description + removedArmor.description, /未知活动|未知武器|未知护甲/);

    scenario.quota.soldiers = 1;
    stepCivilization(scenario.harness, 90);
    assert.equal(scenario.api.damageActor(actor, 1000, {factionId: 8}), true);
    const deceased = scenario.api.getPersonSnapshot(actor.humanId);
    assert.equal(deceased.status, "deceased");
    assert.equal(deceased.weapon, "stone_spear");
    assert.equal(deceased.armor, "rattan");
    assert.equal(deceased.armorBonusHp, 100);
});

test("civilized-human renderer draws armor by material and restores the faction-color belt", () => {
    const harness = createHarness();
    const renderer = harness.elements.civ_body.renderer;
    const expectedColors = {rattan: "#6f7440", iron: "#d9dddf", steel: "#202426"};

    Object.entries(expectedColors).forEach(([armor, expectedColor]) => {
        const fills = [];
        const context = {
            fillStyle: "",
            save() {},
            restore() {},
            fillRect() { fills.push(this.fillStyle); }
        };
        renderer({x: 4, y: 5, color: "#224466", factionColor: "#cc3355", factionId: 7, armor, weapon: "fists"}, context);
        assert.ok(fills.includes(expectedColor), `${armor} uses its material color`);
        assert.equal(fills.at(-1), "#cc3355", `${armor} leaves a visible faction-color belt above the armor`);
    });
});

function createCombatScenario(weapon, distance, targetHp) {
    const harness = createHarness({techData: true, relationMovement: true});
    harness.sandbox.Math.random = () => 0;
    harness.createPixel("civ_banner", 2, 20, {factionId: 1, settlementId: 11, factionColor: "#aa3333"});
    harness.createPixel("civ_banner", 92, 20, {factionId: 2, settlementId: 22, factionColor: "#3333aa"});
    const attacker = harness.createPixel("civ_body", 3, 8, {
        humanId: 101,
        factionId: 1,
        settlementId: 11,
        factionColor: "#aa3333",
        role: "guard",
        task: "combat",
        hp: 500,
        maxHp: 500,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon
    });
    const target = harness.createPixel("civ_body", 3 + distance, 8, {
        humanId: 202,
        factionId: 2,
        settlementId: 22,
        factionColor: "#3333aa",
        role: "guard",
        task: "planning",
        hp: targetHp,
        maxHp: targetHp,
        birthTick: 0,
        naturalDeathTick: 100000,
        weapon: "fists"
    });
    const api = harness.sandbox.HumanSociety;
    api.forceReindex();
    assert.equal(api.declareWar(1, 2, "manual"), true);
    attacker.combatTargetId = target.humanId;
    attacker.targetId = target.humanId;
    attacker.task = "combat";
    return {harness, api, attacker, target};
}

test("combat runtime honors full weapon range, direct damage, and one-cell knockback", () => {
    const bow = createCombatScenario("bow", 25, 100);
    bow.harness.sandbox.pixelTicks = 1;
    bow.harness.elements.civ_body.tick(bow.attacker);
    assert.equal(bow.api.getDebugSnapshot().pendingAttacks, 1, "a bow can attack at exactly 25 cells");
    bow.harness.sandbox.pixelTicks = 2;
    bow.harness.everyTickCallbacks[0]();
    assert.equal(bow.target.hp, 85);
    assert.equal(bow.target.x, 29, "a hit knocks the target one cell away");

    const outside = createCombatScenario("bow", 26, 100);
    outside.harness.sandbox.pixelTicks = 1;
    outside.harness.elements.civ_body.tick(outside.attacker);
    assert.equal(outside.api.getDebugSnapshot().pendingAttacks, 0, "a bow cannot attack beyond 25 cells");
    assert.equal(outside.target.hp, 100);

    const blade = createCombatScenario("steel_blade", 2, 250);
    blade.harness.createPixel("rock", 6, 8);
    blade.harness.sandbox.pixelTicks = 1;
    blade.harness.elements.civ_body.tick(blade.attacker);
    blade.harness.sandbox.pixelTicks = 2;
    blade.harness.everyTickCallbacks[0]();
    assert.equal(blade.target.hp, 150, "steel blade damage is applied directly without a 0.1 multiplier");
    assert.equal(blade.target.x, 5, "blocked knockback does not move through a solid cell");

    blade.harness.sandbox.pixelTicks = 3;
    blade.harness.elements.civ_body.tick(blade.attacker);
    blade.harness.sandbox.pixelTicks = 4;
    blade.harness.everyTickCallbacks[0]();
    assert.equal(blade.target.hp, 50, "there is no legacy attack cooldown between consecutive frames");
});
