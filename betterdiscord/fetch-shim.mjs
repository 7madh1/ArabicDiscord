/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export async function fetch(input, init) {
    if (init?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
    }

    const url = typeof input === "string" ? input : input?.url;
    const bdNet = globalThis.BdApi?.Net;
    if (
        typeof url === "string" &&
        url.startsWith("https://raw.githubusercontent.com/") &&
        typeof bdNet?.fetch === "function"
    ) {
        const res = await bdNet.fetch(url, {
            method: init?.method ?? "GET",
            headers: init?.headers,
        });
        if (init?.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }
        return {
            ok: res.ok ?? (res.status >= 200 && res.status < 300),
            status: res.status ?? 200,
            json: async () => (typeof res.json === "function" ? res.json() : JSON.parse(await res.text())),
        };
    }

    return globalThis.fetch(input, init);
}
