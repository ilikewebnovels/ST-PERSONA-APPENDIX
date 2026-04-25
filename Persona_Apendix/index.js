/*
 * ================================================================
 *  Persona Appendix v1.2.0 — SillyTavern Extension
 *
 *  Global / Character / Chat notes appended to persona.
 *  Features: color-tag glow, search/filter, import/export.
 * ================================================================
 */

import { getContext, extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, event_types, eventSource } from "../../../../script.js";


let _personasModule = null;
async function loadPersonasModule() {
    if (_personasModule) return _personasModule;
    try {
        _personasModule = await import(/* webpackIgnore: true */ '/scripts/personas.js');
        return _personasModule;
    } catch (e) {
        console.warn('[PersonaAppendix] Could not import personas.js:', e.message);
        return null;
    }
}

/* ──────────── Constants ──────────── */

const EXT_NAME   = "persona-appendix";
const EXT_KEY    = "persona_appendix";
const WRAPPER_ID = "persona-appendix-wrapper";

const SCOPE_GLOBAL    = "global";
const SCOPE_CHARACTER = "character";
const SCOPE_CHAT      = "chat";

const COLOR_OPTIONS = ["none","red","orange","yellow","green","cyan","blue","purple","pink"];


/* ──────────── Settings ──────────── */

const DEFAULT_SETTINGS = {
    notes: {},
    enabled: true,
    activeTab: SCOPE_GLOBAL,
};

function getSettings() {
    if (!extension_settings[EXT_KEY]) {
        extension_settings[EXT_KEY] = structuredClone(DEFAULT_SETTINGS);
    }
    const s = extension_settings[EXT_KEY];
    if (s.notes === undefined)     s.notes = {};
    if (s.enabled === undefined)   s.enabled = true;
    if (s.activeTab === undefined) s.activeTab = SCOPE_GLOBAL;
    return s;
}

function save() {
    saveSettingsDebounced();
}

/* ──────────── Context helpers ──────────── */

function getChatId() {
    try {
        const ctx = getContext();
        if (ctx.chatId) return String(ctx.chatId);
        if (typeof ctx.getCurrentChatId === "function") {
            const cid = ctx.getCurrentChatId();
            if (cid) return String(cid);
        }
    } catch (_) {}
    return null;
}

function getCharacterAvatar() {
    try {
        const ctx = getContext();
        if (ctx.characterId != null && ctx.characters) {
            const c = ctx.characters[ctx.characterId];
            if (c && c.avatar) return String(c.avatar);
        }
    } catch (_) {}
    return null;
}

function getCharacterName() {
    try {
        const ctx = getContext();
        if (ctx.name2) return ctx.name2;
        if (ctx.characterId != null && ctx.characters) {
            const c = ctx.characters[ctx.characterId];
            if (c) return c.name || null;
        }
    } catch (_) {}
    return null;
}

/* ──────────── Scope key builders ──────────── */


function getActivePersonaId() {
    // Live binding — always reflects ST's current value
    if (_personasModule?.user_avatar) {
        return _personasModule.user_avatar;
    }
    return 'default';
}

function scopeKeyGlobal() {
    return `persona::${getActivePersonaId()}::global`;
}

function scopeKeyCharacter() {
    const a = getCharacterAvatar();
    return a ? `persona::${getActivePersonaId()}::char::${a}` : null;
}

function scopeKeyChat() {
    const c = getChatId();
    return c ? `persona::${getActivePersonaId()}::chat::${c}` : null;
}

function scopeKeyFor(scope) {
    if (scope === SCOPE_GLOBAL)    return scopeKeyGlobal();
    if (scope === SCOPE_CHARACTER) return scopeKeyCharacter();
    if (scope === SCOPE_CHAT)      return scopeKeyChat();
    return null;
}

function scopeAvailable(scope) {
    return scopeKeyFor(scope) !== null;
}

/* ──────────── Notes CRUD ──────────── */

function getNotesArray(scopeKey) {
    if (!scopeKey) return [];
    const s = getSettings();
    if (!s.notes[scopeKey]) s.notes[scopeKey] = [];
    return s.notes[scopeKey];
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addNote(scopeKey, text, color = "none") {
    if (!scopeKey || !text.trim()) return null;
    const arr = getNotesArray(scopeKey);
    const note = {
        id: generateId(),
        text: text.trim(),
        enabled: true,
        color: color || "none",
    };
    arr.push(note);
    save();
    return note;
}

function deleteNote(scopeKey, noteId) {
    if (!scopeKey) return;
    const s = getSettings();
    const arr = s.notes[scopeKey];
    if (!arr) return;
    const idx = arr.findIndex(n => n.id === noteId);
    if (idx !== -1) {
        arr.splice(idx, 1);
        save();
    }
}

function updateNoteText(scopeKey, noteId, newText) {
    const arr = getNotesArray(scopeKey);
    const note = arr.find(n => n.id === noteId);
    if (note) {
        note.text = newText;
        save();
    }
}

function toggleNote(scopeKey, noteId) {
    const arr = getNotesArray(scopeKey);
    const note = arr.find(n => n.id === noteId);
    if (note) {
        note.enabled = !note.enabled;
        save();
    }
}

function changeNoteColor(scopeKey, noteId, color) {
    const arr = getNotesArray(scopeKey);
    const note = arr.find(n => n.id === noteId);
    if (note) {
        note.color = color || "none";
        save();
    }
}


/* ──────────── Import / Export ──────────── */

function exportAllNotes() {
    const s = getSettings();
    const data = JSON.stringify(s.notes, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `persona-appendix-notes-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function importNotesFromJson() {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.addEventListener("change", () => {
            const file = input.files[0];
            if (!file) { resolve(false); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (typeof imported !== "object" || imported === null) {
                        toastr.error("Invalid format");
                        resolve(false);
                        return;
                    }
                    const s = getSettings();
                    for (const [key, arr] of Object.entries(imported)) {
                        if (!Array.isArray(arr)) continue;
                        if (!s.notes[key]) s.notes[key] = [];
                        for (const note of arr) {
                            if (!note.text) continue;
                            s.notes[key].push({
                                id: generateId(),
                                text: String(note.text),
                                enabled: note.enabled !== false,
                                color: COLOR_OPTIONS.includes(note.color) ? note.color : "none",
                            });
                        }
                    }
                    save();
                    toastr.success("Notes imported");
                    resolve(true);
                } catch (err) {
                    toastr.error("Failed to parse JSON");
                    resolve(false);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });
}

/* ──────────── Prompt injection ──────────── */

function buildPromptText() {
    const s = getSettings();
    if (!s.enabled) return "";

    const scopes = [SCOPE_GLOBAL, SCOPE_CHARACTER, SCOPE_CHAT];
    const lines = [];

    for (const scope of scopes) {
        const key = scopeKeyFor(scope);
        if (!key) continue;
        const arr = getNotesArray(key);
        for (const note of arr) {
            if (note.enabled && note.text.trim()) {
                lines.push(note.text.trim());
            }
        }
    }

    if (lines.length === 0) return "";
    return lines.join("\n");
}

let _injectionActive = false;
let _lastInjectedText = null;
const STORAGE_KEY = 'pa_lastInjectedText';

function injectPrompt() {
    const ctx = getContext();
    if (!ctx.powerUserSettings) {
        console.warn(`[${EXT_NAME}] powerUserSettings not available`);
        return;
    }

    cleanupPrompt();

    const notes = buildPromptText();
    if (!notes) {
        console.log(`[${EXT_NAME}] No notes to inject`);
        return;
    }

    _lastInjectedText = '\n' + notes;
    ctx.powerUserSettings.persona_description += _lastInjectedText;
    sessionStorage.setItem(STORAGE_KEY, _lastInjectedText);
    console.log(`[${EXT_NAME}] Injected notes into persona description`);

    setTimeout(() => {
        cleanupPrompt();
        console.log(`[${EXT_NAME}] Auto-cleaned after injection`);
    }, 300);
}

function cleanupPrompt() {
    // Recover from refresh: if JS state is gone, check sessionStorage
    if (_lastInjectedText === null) {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            _lastInjectedText = stored;
        }
    }

    if (_lastInjectedText === null) return;

    const ctx = getContext();
    if (ctx.powerUserSettings && ctx.powerUserSettings.persona_description) {
        const desc = ctx.powerUserSettings.persona_description;
        const idx = desc.lastIndexOf(_lastInjectedText);
        if (idx !== -1) {
            ctx.powerUserSettings.persona_description =
                desc.slice(0, idx) + desc.slice(idx + _lastInjectedText.length);
            console.log(`[${EXT_NAME}] Cleaned injected text from persona description`);
        }
    }
    _lastInjectedText = null;
    sessionStorage.removeItem(STORAGE_KEY);
}

/* ──────────── State ──────────── */

let searchQuery = "";
let ioVisible = false;

/* ──────────── UI Rendering ──────────── */

function getWrapper() {
    return document.getElementById(WRAPPER_ID);
}

function ensureWrapper() {
    let w = getWrapper();
    if (w) return w;

    const anchor =
        document.getElementById("persona_description") ||
        document.querySelector("#persona_description_container") ||
        document.querySelector('[name="persona_description"]');

    if (!anchor) return null;

    w = document.createElement("div");
    w.id = WRAPPER_ID;
    anchor.parentElement.insertBefore(w, anchor.nextSibling);
    return w;
}

function renderUI() {

    const w = ensureWrapper();
    if (!w) return;

    const s = getSettings();
    const activeTab = s.activeTab || SCOPE_GLOBAL;
    const currentScopeKey = scopeKeyFor(activeTab);
    const notes = currentScopeKey ? getNotesArray(currentScopeKey) : [];

    const charAvail = scopeAvailable(SCOPE_CHARACTER);
    const chatAvail = scopeAvailable(SCOPE_CHAT);

    // Check all-off across all active scopes
    let totalEnabled = 0;
    let totalNotes = 0;
    for (const scope of [SCOPE_GLOBAL, SCOPE_CHARACTER, SCOPE_CHAT]) {
        const key = scopeKeyFor(scope);
        if (!key) continue;
        const arr = getNotesArray(key);
        totalNotes += arr.length;
        totalEnabled += arr.filter(n => n.enabled).length;
    }
    const allOff = totalNotes > 0 && totalEnabled === 0;

    // Counts for tabs
    const globalCount = getNotesArray(scopeKeyGlobal()).length;
    const charCount = charAvail ? getNotesArray(scopeKeyCharacter()).length : 0;
    const chatCount = chatAvail ? getNotesArray(scopeKeyChat()).length : 0;

    // Scope display name
    let scopeLabel = "Global";
    if (activeTab === SCOPE_CHARACTER) {
        const ctx = getContext();
        const personaName = ctx?.personaName || ctx?.powerUserSettings?.persona_description_name || 'default';
        const charName = getCharacterName() || "Character";
        scopeLabel = `${charName} (${personaName})`;
    }
    else if (activeTab === SCOPE_CHAT) scopeLabel = "This Chat";


    let html = "";

    // ── Header
    html += `<div class="pa-header">`;
    html += `<div class="pa-header-left">`;
    html += `<span class="pa-title">📝 Persona Appendix</span>`;
    html += `<span class="pa-scope-badge">${escHtml(scopeLabel)}</span>`;
    html += `<span class="pa-all-off-badge ${allOff ? "visible" : ""}">ALL OFF</span>`;
    html += `</div>`;
    html += `<div class="pa-header-actions">`;
    html += `<button class="pa-icon-btn pa-btn-io" title="Import / Export">📦</button>`;
    html += `<button class="pa-icon-btn pa-btn-add" title="Add note">＋</button>`;
    html += `</div>`;
    html += `</div>`;

    // ── Search bar
    html += `<div class="pa-search-row">`;
    html += `<input class="pa-search-input" type="text" placeholder="Search notes…" value="${escHtml(searchQuery)}" />`;
    html += `</div>`;

    // ── Tab bar
    html += `<div class="pa-tabs">`;
    html += `<button class="pa-tab ${activeTab === SCOPE_GLOBAL ? "active" : ""}" data-tab="${SCOPE_GLOBAL}">🌐 Global <span class="pa-tab-count">${globalCount}</span></button>`;
    html += `<button class="pa-tab ${activeTab === SCOPE_CHARACTER ? "active" : ""} ${!charAvail ? "disabled-tab" : ""}" data-tab="${SCOPE_CHARACTER}">🧑 Character <span class="pa-tab-count">${charCount}</span></button>`;
    html += `<button class="pa-tab ${activeTab === SCOPE_CHAT ? "active" : ""} ${!chatAvail ? "disabled-tab" : ""}" data-tab="${SCOPE_CHAT}">💬 Chat <span class="pa-tab-count">${chatCount}</span></button>`;
    html += `</div>`;

    // ── Notes list
    html += `<div class="pa-notes-list">`;
    if (!currentScopeKey) {
        html += `<div class="pa-empty">No active scope — open a chat first.</div>`;
    } else if (notes.length === 0) {
        html += `<div class="pa-empty">No notes yet. Press ＋ to add one.</div>`;
    } else {
        for (const note of notes) {
            const isHex = note.color && note.color.startsWith("#");
            const colorClass = isHex ? "color-hex" : `color-${note.color || "none"}`;
            const stateClass = note.enabled ? "enabled" : "disabled";
            const missClass = searchQuery && !note.text.toLowerCase().includes(searchQuery.toLowerCase()) ? "search-miss" : "";
            const glowColor = isHex ? note.color : null;

            // NOTE: no draggable="true" here — the handle enables it dynamically
            html += `<div class="pa-note ${stateClass} ${colorClass} ${missClass}" data-note-id="${note.id}" data-scope-key="${escHtml(currentScopeKey)}"`;
            if (glowColor && note.enabled) {
                html += ` style="box-shadow:0 0 12px ${hexToRgba(glowColor,0.45)}, 0 0 25px ${hexToRgba(glowColor,0.15)}, inset 0 0 12px ${hexToRgba(glowColor,0.08)}; border-color:${hexToRgba(glowColor,0.5)};"`;
            }
            html += `>`;


            // Color picker circle
            html += `<div class="pa-color-picker-circle">`;
            html += `<input type="color" class="pa-native-color" data-note-id="${note.id}" value="${isHex ? note.color : '#888888'}" title="Pick color" />`;
            html += `</div>`;

            // Toggle checkbox
            html += `<input type="checkbox" class="pa-note-toggle" data-note-id="${note.id}" ${note.enabled ? "checked" : ""} />`;

            // Textarea
            html += `<textarea class="pa-note-text" data-note-id="${note.id}" rows="1">${escHtml(note.text)}</textarea>`;

            // Delete
            html += `<button class="pa-note-delete" data-note-id="${note.id}" title="Delete note">✕</button>`;

            html += `</div>`;
        }
    }
    html += `</div>`;

    // ── New note input
    html += `<div class="pa-new-note-row">`;
    html += `<div class="pa-new-color-row">`;
    html += `<span>Color:</span>`;
    html += `<div class="pa-color-picker-circle">`;
    html += `<input type="color" class="pa-new-native-color" value="#888888" />`;
    html += `</div>`;
    html += `</div>`;
    html += `<textarea class="pa-new-note-input" placeholder="Write a new note…" rows="2"></textarea>`;
    html += `<div class="pa-new-note-actions">`;
    html += `<button class="pa-new-note-cancel">Cancel</button>`;
    html += `<button class="pa-new-note-confirm">Add Note</button>`;
    html += `</div>`;
    html += `</div>`;

    // ── Import / Export row
    html += `<div class="pa-io-row ${ioVisible ? "visible" : ""}">`;
    html += `<button class="pa-io-btn pa-io-export">Export JSON</button>`;
    html += `<button class="pa-io-btn pa-io-import">Import JSON</button>`;
    html += `</div>`;

    w.innerHTML = html;

    // Size textareas once on render — no flicker
    w.querySelectorAll(".pa-note-text, .pa-new-note-input").forEach(el => {
        el.style.height = "0";
        el.style.height = el.scrollHeight + "px";
    });

    bindEvents(w);
}

function escHtml(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
}

function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith("#")) return `rgba(136,136,136,${alpha})`;
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
}

function autoResize(el) {
    // If content overflows, grow to fit
    if (el.scrollHeight > el.offsetHeight) {
        el.style.height = el.scrollHeight + "px";
        return;
    }
    // Only check for shrink: temporarily measure, then restore if no change needed
    const prev = el.style.height;
    el.style.height = "0";
    const needed = el.scrollHeight;
    if (needed + "px" !== prev) {
        el.style.height = needed + "px";
    } else {
        el.style.height = prev;
    }
}

/* ──────────── Event Binding ──────────── */

function bindEvents(w) {
    const s = getSettings();
    const activeTab = s.activeTab || SCOPE_GLOBAL;
    const currentScopeKey = scopeKeyFor(activeTab);

    // ── Tab clicks
    w.querySelectorAll(".pa-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const scope = tab.dataset.tab;
            if (!scope) return;
            if (!scopeAvailable(scope) && scope !== SCOPE_GLOBAL) return;
            s.activeTab = scope;
            save();
            searchQuery = "";
            renderUI();
        });
    });

    // ── Add button
    w.querySelector(".pa-btn-add")?.addEventListener("click", () => {
        const row = w.querySelector(".pa-new-note-row");
        if (row.classList.contains("visible")) {
            row.classList.remove("visible");
        } else {
            row.classList.add("visible");
            w.querySelector(".pa-new-note-input")?.focus();
        }
    });

    // ── Confirm new note
    w.querySelector(".pa-new-note-confirm")?.addEventListener("click", () => {
        const input = w.querySelector(".pa-new-note-input");
        const text = input?.value?.trim();
        if (!text) return;
        const colorPicker = w.querySelector(".pa-new-native-color");
        const color = colorPicker ? colorPicker.value : "#888888";
        if (!currentScopeKey) return;
        addNote(currentScopeKey, text, color);
        renderUI();
    });

    // ── Cancel new note
    w.querySelector(".pa-new-note-cancel")?.addEventListener("click", () => {
        w.querySelector(".pa-new-note-row")?.classList.remove("visible");
    });


    // ── Search input
    w.querySelector(".pa-search-input")?.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        applySearchFilter(w);
    });

    // ── Import / Export toggle
    w.querySelector(".pa-btn-io")?.addEventListener("click", () => {
        ioVisible = !ioVisible;
        renderUI();
    });

    // ── Export
    w.querySelector(".pa-io-export")?.addEventListener("click", () => {
        exportAllNotes();
    });

    // ── Import
    w.querySelector(".pa-io-import")?.addEventListener("click", async () => {
        const ok = await importNotesFromJson();
        if (ok) renderUI();
    });

    // ── Per-note events
    w.querySelectorAll(".pa-note").forEach(noteEl => {
        const noteId = noteEl.dataset.noteId;
        const noteScopeKey = noteEl.dataset.scopeKey;

        // Toggle checkbox
        noteEl.querySelector(".pa-note-toggle")?.addEventListener("change", () => {
            toggleNote(noteScopeKey, noteId);
            renderUI();
        });

        // Text edit
        const textarea = noteEl.querySelector(".pa-note-text");
        if (textarea) {
            textarea.addEventListener("input", () => {
                updateNoteText(noteScopeKey, noteId, textarea.value);
                autoResize(textarea);
            });
            textarea.addEventListener("focus", () => autoResize(textarea));
        }

        // Delete
        noteEl.querySelector(".pa-note-delete")?.addEventListener("click", () => {
            deleteNote(noteScopeKey, noteId);
            renderUI();
        });

        // Native color picker per note
        const colorInput = noteEl.querySelector(".pa-native-color");
        if (colorInput) {
            colorInput.addEventListener("input", (e) => {
                e.stopPropagation();
                changeNoteColor(noteScopeKey, noteId, e.target.value);
                renderUI();
            });
            colorInput.addEventListener("click", (e) => e.stopPropagation());
        }
    });


    // ── Auto-resize new note input
    const newInput = w.querySelector(".pa-new-note-input");
    if (newInput) {
        newInput.addEventListener("input", () => autoResize(newInput));
    }
}

function applySearchFilter(w) {
    if (!w) return;
    const q = searchQuery.toLowerCase();
    w.querySelectorAll(".pa-note").forEach(noteEl => {
        const text = noteEl.querySelector(".pa-note-text")?.value?.toLowerCase() || "";
        if (q && !text.includes(q)) {
            noteEl.classList.add("search-miss");
        } else {
            noteEl.classList.remove("search-miss");
        }
    });
}

/* ──────────── Lifecycle ──────────── */

function onChatChanged() {
    cleanupPrompt();
    const s = getSettings();
    if (!scopeAvailable(s.activeTab) && s.activeTab !== SCOPE_GLOBAL) {
        s.activeTab = SCOPE_GLOBAL;
        save();
    }
    searchQuery = "";
    renderUI();
}


async function init() {
    getSettings();

    await loadPersonasModule();
    // First thing: clean up any ghost injection from a previous session/refresh
    const tryCleanup = () => {
        const ctx = getContext();
        if (ctx.powerUserSettings) {
            cleanupPrompt();
        } else {
            setTimeout(tryCleanup, 300);
        }
    };
    tryCleanup();
    const tryRender = () => {
        const anchor =
            document.getElementById("persona_description") ||
            document.querySelector("#persona_description_container") ||
            document.querySelector('[name="persona_description"]');
        if (anchor) {
            renderUI();
        } else {
            setTimeout(tryRender, 500);
        }
    };
    setTimeout(tryRender, 300);

    const eventSource = getContext().eventSource || window.eventSource;
    const eventTypes = getContext().eventTypes || window.event_types;

    if (typeof eventSource !== "undefined" && eventSource) {
        if (event_types.CHAT_CHANGED) {
            eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
        }

        if (event_types.GENERATION_STARTED) {
            eventSource.on(event_types.GENERATION_STARTED, injectPrompt);
        }

        if (event_types.CHARACTER_MESSAGE_RENDERED) {
            eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, renderUI);
        }
        if (event_types.PERSONA_DESCRIPTION_CHANGED) {
            eventSource.on(event_types.PERSONA_DESCRIPTION_CHANGED, renderUI);
        }
        if (event_types.GENERATION_ENDED) {
            eventSource.on(event_types.GENERATION_ENDED, cleanupPrompt);
        }
        if (event_types.GENERATION_STOPPED) {
        eventSource.on(event_types.GENERATION_STOPPED, cleanupPrompt); // covers aborted gens too
        }
        if (event_types.CHARACTER_MESSAGE_RENDERED) {
            eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => {
                cleanupPrompt();
                renderUI();
            });
        }
        if (event_types.USER_MESSAGE_RENDERED) {
            eventSource.on(event_types.USER_MESSAGE_RENDERED, cleanupPrompt);
        }

        if (event_types?.PERSONA_CHANGED) {
            eventSource.on(event_types.PERSONA_CHANGED, () => {
                cleanupPrompt();
                renderUI();
            });
        }
    }
    console.log(`[${EXT_NAME}] v1.2.0 loaded.`);
}

// ── Entry point
init();
