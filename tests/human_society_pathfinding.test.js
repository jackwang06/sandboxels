"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Pathfinding = require("../scripts/human_society_pathfinding.js");

function gridSearch(options) {
    const opts = options || {};
    const blocked = new Set(opts.blocked || []);
    const goal = opts.goal;
    return Pathfinding.createSearch({
        start: opts.start,
        maxNodes: opts.maxNodes || 4096,
        isGoal(node) { return node.x === goal.x && node.y === goal.y; },
        heuristic(node) { return Math.abs(goal.x - node.x) + Math.abs(goal.y - node.y); },
        neighbors(node) {
            return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({
                node: {x: node.x + dx, y: node.y + dy},
                action: {dx, dy, action: "move"},
                cost: 1
            })).filter((edge) => edge.node.x >= 0 && edge.node.y >= 0 && edge.node.x < 20 && edge.node.y < 20 && !blocked.has(edge.node.x + "," + edge.node.y));
        }
    });
}

test("incremental A* finds a deterministic route with several turns", () => {
    const blocked = [];
    for (let y = 0; y < 20; y++) if (y !== 2) blocked.push("4," + y);
    for (let y = 0; y < 20; y++) if (y !== 9) blocked.push("9," + y);
    const search = gridSearch({start: {x: 1, y: 5}, goal: {x: 14, y: 5}, blocked});
    while (search.status === "searching") Pathfinding.advanceSearch(search, 7);
    assert.equal(search.status, "found");
    assert.deepEqual(search.path.at(-1), {x: 14, y: 5, dx: 1, dy: 0, action: "move"});
    assert.ok(search.path.some((step) => step.y === 2));
    assert.ok(search.path.some((step) => step.y === 9));
});

test("incremental A* reports node budget exhaustion without looping", () => {
    const search = gridSearch({start: {x: 0, y: 0}, goal: {x: 19, y: 19}, maxNodes: 3});
    Pathfinding.advanceSearch(search, 100);
    assert.equal(search.status, "exhausted");
    assert.equal(search.reason, "node_budget");
    assert.equal(search.expanded, 3);
});

test("incremental A* reports no path when the open set is exhausted", () => {
    const search = gridSearch({start: {x: 0, y: 0}, goal: {x: 2, y: 0}, blocked: ["1,0", "0,1"]});
    Pathfinding.advanceSearch(search, 100);
    assert.equal(search.status, "no_path");
    assert.equal(search.reason, "open_set_empty");
});
