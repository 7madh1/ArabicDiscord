/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const VALID_PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

export function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates a compiled Discord/FormatJS AST node strictly by node kind (1..8).
 * @param {unknown} node
 * @param {(message: string) => void} [onIssue]
 * @returns {boolean}
 */
export function isValidAstNode(node, onIssue) {
    if (typeof node === "string") {
        onIssue?.(node);
        return true;
    }

    if (!Array.isArray(node) || node.length === 0) {
        return false;
    }

    const kind = node[0];
    if (typeof kind !== "number" || !Number.isInteger(kind) || kind < 1 || kind > 8) {
        return false;
    }

    // 7: `#` plural argument placeholder -> [7]
    if (kind === 7) {
        return node.length === 1;
    }

    // All remaining node kinds (1..6, 8) carry a non-empty identifier/tag at index 1.
    if (typeof node[1] !== "string" || node[1].length === 0) {
        return false;
    }

    // 1: argument [1, name]
    if (kind === 1) {
        return node.length === 2;
    }

    // 2: number, 3: date, 4: time -> [kind, name] or [kind, name, style]
    if (kind === 2 || kind === 3 || kind === 4) {
        return node.length === 2 || (node.length === 3 && typeof node[2] === "string");
    }

    // 5: select [5, name, branches], 6: plural [6, name, branches, offset, pluralType]
    if (kind === 5 || kind === 6) {
        if (kind === 5 && node.length !== 3) return false;
        if (kind === 6) {
            if (node.length !== 5) return false;
            if (typeof node[3] !== "number" || !Number.isInteger(node[3])) return false;
            if (node[4] !== "cardinal" && node[4] !== "ordinal") return false;
        }

        const branches = node[2];
        if (!isPlainObject(branches)) return false;

        const entries = Object.entries(branches);
        if (entries.length === 0) return false;

        for (const [cat, branchNodes] of entries) {
            if (
                kind === 6 &&
                !VALID_PLURAL_CATEGORIES.has(cat) &&
                !/^=-?\d+$/.test(cat)
            ) {
                return false;
            }
            if (!Array.isArray(branchNodes)) return false;
            for (const child of branchNodes) {
                if (!isValidAstNode(child, onIssue)) return false;
            }
        }
        return true;
    }

    // 8: rich tag -> [8, tagName, children] or [8, tagName, children, extraChildren]
    if (kind === 8) {
        if (node.length !== 3 && node.length !== 4) return false;
        if (!Array.isArray(node[2])) return false;
        if (node.length === 4 && !Array.isArray(node[3])) return false;

        for (const child of node[2]) {
            if (!isValidAstNode(child, onIssue)) return false;
        }
        if (node.length === 4) {
            for (const child of node[3]) {
                if (!isValidAstNode(child, onIssue)) return false;
            }
        }
        return true;
    }

    return false;
}

/**
 * Validates simple and complex translation dictionaries structurally.
 * @param {unknown} arJson
 * @param {unknown} complexJson
 * @returns {boolean}
 */
export function isValidDictionaries(arJson, complexJson) {
    if (!isPlainObject(arJson) || !isPlainObject(complexJson)) return false;
    if (!isPlainObject(arJson.byText)) return false;
    if (arJson.byKey != null && !isPlainObject(arJson.byKey)) return false;

    const textEntries = Object.values(arJson.byText);
    const complexEntries = Object.values(complexJson);
    if (textEntries.length < 100 || complexEntries.length < 100) return false;

    for (const v of textEntries) {
        if (typeof v !== "string" || !v.trim()) return false;
    }
    if (arJson.byKey) {
        for (const v of Object.values(arJson.byKey)) {
            if (typeof v !== "string" || !v.trim()) return false;
        }
    }
    for (const ast of complexEntries) {
        if (!Array.isArray(ast)) return false;
        for (const node of ast) {
            if (!isValidAstNode(node)) return false;
        }
    }
    return true;
}
