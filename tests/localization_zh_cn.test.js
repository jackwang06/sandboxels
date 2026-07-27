"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.join(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "index.html");
const SOCIETY_PATH = path.join(ROOT, "scripts/human_society.js");
const TEMPLATE_PATH = path.join(ROOT, "lang/template.json");
const ZH_CN_PATH = path.join(ROOT, "lang/zh_cn.json");

const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const societySource = fs.readFileSync(SOCIETY_PATH, "utf8");

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function duplicateTopLevelKeys(file) {
    const source = fs.readFileSync(file, "utf8");
    const seen = new Set();
    const duplicates = new Set();
    for (const match of source.matchAll(/^\s*"((?:\\.|[^"\\])+)"\s*:/gm)) {
        const key = JSON.parse(`"${match[1]}"`);
        if (seen.has(key)) duplicates.add(key);
        seen.add(key);
    }
    return Array.from(duplicates).sort();
}

function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function hasHanText(value) {
    return typeof value === "string" && /[\u3400-\u9fff]/u.test(value);
}

function extractLiteralFirstArguments(source, functionName) {
    const expression = new RegExp(
        `\\b${functionName}\\s*\\(\\s*(["'])([^"'\\r\\n]+)\\1`,
        "g"
    );
    return Array.from(source.matchAll(expression), (match) => match[2]);
}

function findMatchingDelimiter(source, openingIndex, open, close) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = openingIndex; index < source.length; index++) {
        const character = source[index];
        if (quote !== null) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = null;
            continue;
        }
        if (character === '"' || character === "'" || character === "`") {
            quote = character;
            continue;
        }
        if (character === open) depth++;
        else if (character === close && --depth === 0) return index;
    }
    return -1;
}

function splitTopLevelArguments(source) {
    const argumentsList = [];
    let start = 0;
    let quote = null;
    let escaped = false;
    let roundDepth = 0;
    let squareDepth = 0;
    let curlyDepth = 0;
    for (let index = 0; index < source.length; index++) {
        const character = source[index];
        if (quote !== null) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = null;
            continue;
        }
        if (character === '"' || character === "'" || character === "`") {
            quote = character;
            continue;
        }
        if (character === "(") roundDepth++;
        else if (character === ")") roundDepth--;
        else if (character === "[") squareDepth++;
        else if (character === "]") squareDepth--;
        else if (character === "{") curlyDepth++;
        else if (character === "}") curlyDepth--;
        else if (character === "," && roundDepth === 0 && squareDepth === 0 && curlyDepth === 0) {
            argumentsList.push(source.slice(start, index).trim());
            start = index + 1;
        }
    }
    argumentsList.push(source.slice(start).trim());
    return argumentsList;
}

function quotedLiteralValue(source) {
    const match = source.match(/^(["'])([\s\S]*)\1$/);
    return match ? match[2] : null;
}

function extractCalls(source, functionName) {
    const calls = [];
    const expression = new RegExp(`\\b${functionName}\\s*\\(`, "g");
    let match;
    while ((match = expression.exec(source)) !== null) {
        const openingIndex = source.indexOf("(", match.index);
        const closingIndex = findMatchingDelimiter(source, openingIndex, "(", ")");
        assert.notEqual(closingIndex, -1, `unterminated ${functionName} call at offset ${match.index}`);
        calls.push(splitTopLevelArguments(source.slice(openingIndex + 1, closingIndex)));
        expression.lastIndex = closingIndex + 1;
    }
    return calls;
}

function extractConstObject(source, name) {
    const signature = new RegExp(`\\bconst\\s+${name}\\s*=\\s*{`).exec(source);
    assert.ok(signature, `missing localization map ${name}`);
    const openingIndex = source.indexOf("{", signature.index);
    const closingIndex = findMatchingDelimiter(source, openingIndex, "{", "}");
    assert.notEqual(closingIndex, -1, `unterminated localization map ${name}`);
    return source.slice(openingIndex + 1, closingIndex);
}

test("Simplified Chinese and template locale files are valid JSON objects", () => {
    let template;
    let simplifiedChinese;
    assert.doesNotThrow(() => { template = readJson(TEMPLATE_PATH); });
    assert.doesNotThrow(() => { simplifiedChinese = readJson(ZH_CN_PATH); });
    assert.ok(template && typeof template === "object" && !Array.isArray(template));
    assert.ok(simplifiedChinese && typeof simplifiedChinese === "object" && !Array.isArray(simplifiedChinese));
    assert.equal(simplifiedChinese["#lang.name"], "简体中文");
    assert.deepEqual(duplicateTopLevelKeys(ZH_CN_PATH), [], "zh_cn must not contain duplicate keys");
});

test("Simplified Chinese contains every template key with a non-empty value", () => {
    const template = readJson(TEMPLATE_PATH);
    const simplifiedChinese = readJson(ZH_CN_PATH);
    const missing = Object.keys(template).filter((key) => !own(simplifiedChinese, key));
    const empty = Object.keys(template).filter((key) => own(simplifiedChinese, key) && (
        typeof simplifiedChinese[key] !== "string" || simplifiedChinese[key].trim() === ""
    ));
    assert.deepEqual(missing, [], `missing zh_cn template keys: ${missing.join(", ")}`);
    assert.deepEqual(empty, [], `empty zh_cn template values: ${empty.join(", ")}`);
});

test("every literal langKey lookup used by the main UI has a Simplified Chinese entry", () => {
    const simplifiedChinese = readJson(ZH_CN_PATH);
    const keys = new Set([
        ...extractLiteralFirstArguments(indexSource, "langKey"),
        ...extractLiteralFirstArguments(societySource, "langKey")
    ]);
    const completeKeys = Array.from(keys).filter((key) => !key.endsWith(".") && !key.endsWith("-")).sort();
    const missing = completeKeys.filter((key) => !own(simplifiedChinese, key));
    const empty = completeKeys.filter((key) => own(simplifiedChinese, key) && (
        typeof simplifiedChinese[key] !== "string" || simplifiedChinese[key].trim() === ""
    ));
    assert.deepEqual(missing, [], `missing direct langKey entries: ${missing.join(", ")}`);
    assert.deepEqual(empty, [], `empty direct langKey entries: ${empty.join(", ")}`);
});

test("civilizationText literal calls provide a real Simplified Chinese fallback", () => {
    const calls = extractCalls(societySource, "civilizationText");
    const failures = [];
    let checked = 0;
    for (const argumentsList of calls) {
        const key = quotedLiteralValue(argumentsList[0] || "");
        if (key === null || key.endsWith(".")) continue;
        checked++;
        const chinese = quotedLiteralValue(argumentsList[2] || "");
        if (!hasHanText(chinese)) failures.push(key);
    }
    assert.ok(checked > 40, `expected broad civilization UI coverage, found only ${checked} literal calls`);
    assert.deepEqual(failures, [], `civilizationText calls without Chinese fallback: ${failures.join(", ")}`);
});

test("dynamic civilization label maps keep Simplified Chinese values", () => {
    const scalarMaps = ["ERA_NAMES_ZH", "TECH_NAMES_ZH", "DOMAIN_NAMES_ZH", "RESOURCE_NAMES_ZH"];
    for (const mapName of scalarMaps) {
        const block = extractConstObject(societySource, mapName);
        const entries = Array.from(block.matchAll(/\b([a-z][a-z0-9_]*)\s*:\s*"([^"]*)"/g));
        assert.ok(entries.length > 0, `${mapName} has no statically testable entries`);
        const untranslated = entries.filter((entry) => !hasHanText(entry[2])).map((entry) => entry[1]);
        assert.deepEqual(untranslated, [], `${mapName} entries without Chinese text: ${untranslated.join(", ")}`);
    }

    const pairedMaps = [
        "PERSON_TASK_LABELS", "PERSON_PHASE_LABELS", "PERSON_OUTCOME_LABELS",
        "PERSON_ROLE_LABELS", "PERSON_WEAPON_LABELS", "PERSON_DEATH_CAUSE_LABELS"
    ];
    for (const mapName of pairedMaps) {
        const block = extractConstObject(societySource, mapName);
        const entries = Array.from(block.matchAll(/\b([a-z][a-z0-9_]*)\s*:\s*\[\s*"[^"]*"\s*,\s*"([^"]*)"\s*\]/g));
        assert.ok(entries.length > 0, `${mapName} has no statically testable entries`);
        const untranslated = entries.filter((entry) => !hasHanText(entry[2])).map((entry) => entry[1]);
        assert.deepEqual(untranslated, [], `${mapName} entries without Chinese text: ${untranslated.join(", ")}`);
    }
});

test("civilization industry and equipment terminology matches the gameplay rules", () => {
    const simplifiedChinese = readJson(ZH_CN_PATH);
    const expected = {
        "humanSociety.tech.polished_axes": "磨制石器",
        "humanSociety.tech.bowmaking": "丝弦法",
        "humanSociety.tech.bronze_weapons": "范铸法",
        "humanSociety.tech.iron_smelting": "炒炼法",
        "humanSociety.tech.iron_weapons": "铁匠铺",
        "humanSociety.tech.crossbow": "机括制造",
        "humanSociety.building.civ_foundry_core": "冶铸作坊",
        "humanSociety.building.civ_kiln_core": "冶铁作坊",
        "humanSociety.building.civ_forge_core": "炼钢作坊"
    };
    Object.entries(expected).forEach(([key, value]) => {
        assert.equal(simplifiedChinese[key], value, `${key} must use the configured civilization term`);
    });

    const fallbackBlock = extractConstObject(societySource, "TECH_NAMES_ZH") + extractConstObject(societySource, "BUILDING_NAMES");
    Object.values(expected).forEach((value) => {
        assert.ok(fallbackBlock.includes(`"${value}"`), `fallback labels must include ${value}`);
    });
});

test("all civilization element identifiers defined by human_society have Chinese names", () => {
    const simplifiedChinese = readJson(ZH_CN_PATH);
    const identifiers = new Set(["civilized_human"]);
    for (const match of societySource.matchAll(/\belements\.(civ_[a-z0-9_]+)\s*=/g)) identifiers.add(match[1]);
    for (const match of societySource.matchAll(/\b(?:defineSocietyStructureElement|defineFallingResourceElement)\(\s*["'](civ_[a-z0-9_]+)["']/g)) identifiers.add(match[1]);

    const missing = Array.from(identifiers).filter((key) => !own(simplifiedChinese, key)).sort();
    const untranslated = Array.from(identifiers).filter((key) => own(simplifiedChinese, key) && !hasHanText(simplifiedChinese[key])).sort();
    assert.ok(identifiers.size >= 30, `expected the full civilization element set, found only ${identifiers.size}`);
    assert.deepEqual(missing, [], `civilization elements missing zh_cn names: ${missing.join(", ")}`);
    assert.deepEqual(untranslated, [], `civilization elements without Chinese names: ${untranslated.join(", ")}`);
});

test("language loading tries the repository locale before any remote fallback", () => {
    const loaderStart = indexSource.indexOf("// Language Loader");
    const loaderEnd = indexSource.indexOf("function langKey", loaderStart);
    assert.ok(loaderStart >= 0 && loaderEnd > loaderStart, "missing language loader source block");
    const loader = indexSource.slice(loaderStart, loaderEnd);
    const localPattern = /(?:["'](?:\.\.\/|\.\/|\/)?lang\/["']\s*\+\s*(?:encodeURIComponent\(\s*)?langCode(?:\s*\))?\s*\+\s*["']\.json["']|`(?:\.\.\/|\.\/|\/)?lang\/\$\{langCode\}\.json`)/;
    const localMatch = localPattern.exec(loader);
    assert.ok(localMatch, "language loader must request the repository's lang/<code>.json file");

    const remoteIndex = loader.indexOf("https://sandboxels.r74n.com/lang/");
    if (remoteIndex >= 0) {
        assert.ok(localMatch.index < remoteIndex, "local language file must be attempted before the remote fallback");
    }
});

test("known severe Simplified Chinese mistranslations stay corrected", () => {
    const simplifiedChinese = readJson(ZH_CN_PATH);
    assert.equal(simplifiedChinese.torch, "火把");
    assert.equal(simplifiedChinese.ember, "余烬");
    assert.equal(simplifiedChinese.coral, "珊瑚");
});
