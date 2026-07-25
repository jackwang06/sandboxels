(function (root, factory) {
    "use strict";

    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.HumanSocietyPathfinding = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    class MinHeap {
        constructor(compare) {
            this.items = [];
            this.compare = compare;
        }

        get size() {
            return this.items.length;
        }

        push(value) {
            const items = this.items;
            items.push(value);
            let index = items.length - 1;
            while (index > 0) {
                const parent = Math.floor((index - 1) / 2);
                if (this.compare(items[parent], value) <= 0) break;
                items[index] = items[parent];
                index = parent;
            }
            items[index] = value;
        }

        pop() {
            const items = this.items;
            if (!items.length) return null;
            const first = items[0];
            const last = items.pop();
            if (!items.length) return first;
            let index = 0;
            while (true) {
                const left = index * 2 + 1;
                const right = left + 1;
                if (left >= items.length) break;
                let child = left;
                if (right < items.length && this.compare(items[right], items[left]) < 0) child = right;
                if (this.compare(last, items[child]) <= 0) break;
                items[index] = items[child];
                index = child;
            }
            items[index] = last;
            return first;
        }
    }

    function defaultKey(node) {
        return String(node.x) + "," + String(node.y);
    }

    function reconstructPath(search, goalKey) {
        const path = [];
        let key = goalKey;
        while (key !== search.startKey) {
            const record = search.records.get(key);
            if (!record || !record.parentKey) return [];
            path.push(Object.assign({x: record.node.x, y: record.node.y}, record.action || {}));
            key = record.parentKey;
        }
        path.reverse();
        return path;
    }

    function createSearch(options) {
        const opts = options || {};
        if (!opts.start || typeof opts.neighbors !== "function" || typeof opts.isGoal !== "function") {
            throw new TypeError("A* requires start, neighbors, and isGoal");
        }
        const keyOf = typeof opts.key === "function" ? opts.key : defaultKey;
        const heuristic = typeof opts.heuristic === "function" ? opts.heuristic : function () { return 0; };
        let sequence = 0;
        const compare = function (a, b) {
            return a.f - b.f || a.h - b.h || a.key.localeCompare(b.key) || a.sequence - b.sequence;
        };
        const open = new MinHeap(compare);
        const startKey = keyOf(opts.start);
        const startH = Math.max(0, Number(heuristic(opts.start)) || 0);
        const records = new Map();
        records.set(startKey, {node: opts.start, g: 0, h: startH, parentKey: null, action: null, closed: false});
        open.push({key: startKey, g: 0, h: startH, f: startH, sequence: sequence++});
        return {
            status: "searching",
            reason: null,
            path: null,
            startKey: startKey,
            records: records,
            open: open,
            keyOf: keyOf,
            heuristic: heuristic,
            neighbors: opts.neighbors,
            isGoal: opts.isGoal,
            maxNodes: Math.max(1, Math.floor(Number(opts.maxNodes) || 4096)),
            expanded: 0,
            discovered: 1,
            sequence: sequence
        };
    }

    function advanceSearch(search, expansionBudget) {
        if (!search || search.status !== "searching") return search;
        let remaining = Math.max(1, Math.floor(Number(expansionBudget) || 1));
        while (remaining-- > 0) {
            if (search.expanded >= search.maxNodes) {
                search.status = "exhausted";
                search.reason = "node_budget";
                return search;
            }
            let currentEntry = search.open.pop();
            while (currentEntry) {
                const currentRecord = search.records.get(currentEntry.key);
                if (currentRecord && !currentRecord.closed && currentRecord.g === currentEntry.g) break;
                currentEntry = search.open.pop();
            }
            if (!currentEntry) {
                search.status = "no_path";
                search.reason = "open_set_empty";
                return search;
            }
            const current = search.records.get(currentEntry.key);
            current.closed = true;
            search.expanded++;
            if (search.isGoal(current.node)) {
                search.status = "found";
                search.reason = null;
                search.path = reconstructPath(search, currentEntry.key);
                return search;
            }
            const candidates = search.neighbors(current.node) || [];
            for (let index = 0; index < candidates.length; index++) {
                const edge = candidates[index];
                if (!edge || !edge.node) continue;
                const cost = Number(edge.cost);
                if (!Number.isFinite(cost) || cost < 0) continue;
                const key = search.keyOf(edge.node);
                const nextG = current.g + cost;
                const previous = search.records.get(key);
                if (previous && nextG >= previous.g) continue;
                const h = Math.max(0, Number(search.heuristic(edge.node)) || 0);
                search.records.set(key, {
                    node: edge.node,
                    g: nextG,
                    h: h,
                    parentKey: currentEntry.key,
                    action: edge.action || null,
                    closed: false
                });
                search.open.push({key: key, g: nextG, h: h, f: nextG + h, sequence: search.sequence++});
                if (!previous) search.discovered++;
            }
        }
        return search;
    }

    return Object.freeze({
        createSearch: createSearch,
        advanceSearch: advanceSearch,
        reconstructPath: reconstructPath
    });
});
