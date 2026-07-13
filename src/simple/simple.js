/* holyfret · simple — a stripped-down, freehand-only view.
 *
 * You don't pick scales or chords: you tap frets to place notes by hand.
 * Reuses the full engine (theory.js, data.js, fretboard.js) and the shared
 * stylesheet; this file is the whole controller. Deliberately self-contained
 * — no copy.js, no combobox, none of the full app's controls.
 */

const FRETS = 15; // fixed board length (no fret/zoom controls in simple)

const state = {
    instrument: 'Guitar',
    tuning: 'Standard',
    root: 'C',            // the note interval labels are measured from
    lefty: false,
    mode: 'notes',        // 'notes' | 'intervals'
    picks: new Set(),     // "string:fret" positions
};

const instrumentSelect = document.getElementById('instrument-select');
const tuningSelect = document.getElementById('tuning-select');
const rootSelect = document.getElementById('root-select');
const modeSelect = document.getElementById('mode-select');
const leftyCheckbox = document.getElementById('lefty');
const clearButton = document.getElementById('clear');
const saveButton = document.getElementById('save-image');
const copyLinkButton = document.getElementById('copy-link');
const summaryLine = document.getElementById('summary');
const boardContainer = document.getElementById('board');

let lastNeck = null; // kept from the last render so "Save image" can redraw it
let lastOpts = null;

/* simple always spells with flats; there's no accidental toggle here */
function noteNames() { return FLAT_KEYS; }
function currentTuning() { return INSTRUMENTS[state.instrument].tunings[state.tuning]; }
function currentInlays() { return Boolean(INSTRUMENTS[state.instrument].inlays); }

/* pitch class each picked position sounds */
function pickedPcs() {
    return [...state.picks].map(key => {
        const [s, f] = key.split(':').map(Number);
        return ((currentTuning()[s] + f) % 12 + 12) % 12;
    });
}

/* interval labels are measured from the chosen Root */
function labelRootPc() { return keyIndex(state.root); }

function updateSummary() {
    const names = noteNames();
    const pcs = [...new Set(pickedPcs())];
    if (!pcs.length) {
        summaryLine.textContent = 'Tap the fretboard to place notes.';
        return;
    }
    const showIvs = state.mode === 'intervals';
    const root = labelRootPc();
    // both rows share the same order so each interval sits under its note;
    // intervals mode orders from the root (1 first), notes mode by pitch class
    const ordered = [...pcs].sort((a, b) => showIvs
        ? ((a - root + 12) % 12) - ((b - root + 12) % 12)
        : a - b);

    // a 2-row grid (Notes on top, Intervals beneath) — one column per note
    const grid = document.createElement('div');
    grid.className = 'freehand-legend';
    grid.style.gridTemplateRows = showIvs ? 'auto auto' : 'auto';

    const cell = (text, cls) => {
        const el = document.createElement('span');
        el.className = cls;
        el.textContent = text;
        grid.appendChild(el);
    };
    // first column: the row labels; then one column per note
    cell('Notes:', 'cell lbl');
    if (showIvs) { cell('Intervals:', 'cell lbl iv'); }
    for (const pc of ordered) {
        cell(names[pc], 'cell');
        if (showIvs) { cell(INTERVAL_NAMES[(pc - root + 12) % 12], 'cell iv'); }
    }
    summaryLine.replaceChildren(grid);
}

/* ---- render ---- */
function toggleCell(cell, string, fret) {
    const key = string + ':' + fret;
    if (!state.picks.delete(key)) { state.picks.add(key); }
    render();
}

function render() {
    lastNeck = buildNeck(labelRootPc(), currentTuning(), FRETS, noteNames());
    lastOpts = {
        mode: state.mode,
        selectedIntervals: new Set(), // unused in freehand
        showAll: false,
        lefty: state.lefty,
        tab: null,
        tabAll: null,
        picks: state.picks,
        inlays: currentInlays(),
        onToggle: toggleCell,
    };
    renderFretboard(boardContainer, lastNeck, lastOpts);
    updateSummary();
    persist();
}

/* ---- controls ---- */
function fillOptions(select, names, value) {
    select.replaceChildren();
    for (const name of names) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    }
    select.value = value;
}
function fillInstruments() { fillOptions(instrumentSelect, Object.keys(INSTRUMENTS), state.instrument); }
function fillTunings() { fillOptions(tuningSelect, Object.keys(INSTRUMENTS[state.instrument].tunings), state.tuning); }
function fillRoots() { fillOptions(rootSelect, FLAT_KEYS, state.root); }

/* keep only picks that still land on a string this tuning has */
function prunePicks() {
    const strings = currentTuning().length;
    for (const key of [...state.picks]) {
        if (Number(key.split(':')[0]) >= strings) { state.picks.delete(key); }
    }
}

instrumentSelect.addEventListener('change', () => {
    state.instrument = instrumentSelect.value;
    state.tuning = Object.keys(INSTRUMENTS[state.instrument].tunings)[0];
    fillTunings();
    prunePicks();
    render();
});
tuningSelect.addEventListener('change', () => {
    state.tuning = tuningSelect.value;
    prunePicks();
    render();
});
rootSelect.addEventListener('change', () => { state.root = rootSelect.value; render(); });
modeSelect.addEventListener('change', () => { state.mode = modeSelect.value; render(); });
leftyCheckbox.addEventListener('change', () => { state.lefty = leftyCheckbox.checked; render(); });
clearButton.addEventListener('click', () => {
    state.picks.clear();
    render();
});

saveButton.addEventListener('click', () => {
    if (!lastNeck) { return; }
    const canvas = drawFretboardCanvas(lastNeck, {
        ...lastOpts,
        headline: false, // no holyfret.com logo on saved images
        caption: state.picks.size ? summaryCaption() : '',
        colors: THEMES['Default'],
    });
    const link = document.createElement('a');
    link.download = ['holyfret', 'freehand', state.instrument].join('-').replaceAll(' ', '_') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

/* one-line plain-text version of the summary, for the saved image caption */
function summaryCaption() {
    const names = noteNames();
    const root = labelRootPc();
    const pcs = [...new Set(pickedPcs())];
    const notes = [...pcs].sort((a, b) => a - b).map(pc => names[pc]).join(' ');
    if (state.mode !== 'intervals') { return 'Notes: ' + notes; }
    const ivs = [...pcs]
        .sort((a, b) => ((a - root + 12) % 12) - ((b - root + 12) % 12))
        .map(pc => INTERVAL_NAMES[(pc - root + 12) % 12]).join(' ');
    return 'Notes: ' + notes + '  ·  Intervals: ' + ivs;
}

copyLinkButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(location.href);
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = location.href;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    }
    copyLinkButton.textContent = 'Copied!';
    setTimeout(() => { copyLinkButton.textContent = 'Copy link'; }, 1500);
});

/* ---- state <-> URL (for the copy link) ---- */
function persist() {
    const p = new URLSearchParams();
    p.set('i', state.instrument);
    p.set('t', state.tuning);
    p.set('r', state.root);
    if (state.mode !== 'notes') { p.set('m', state.mode); }
    if (state.lefty) { p.set('l', '1'); }
    if (state.picks.size) {
        p.set('p', [...state.picks].map(k => k.replace(':', '-')).join('.'));
    }
    history.replaceState(null, '', location.pathname + '?' + p.toString());
}

function restore() {
    const p = new URLSearchParams(location.search);
    if (p.get('i') && INSTRUMENTS[p.get('i')]) { state.instrument = p.get('i'); }
    const tunings = INSTRUMENTS[state.instrument].tunings;
    state.tuning = (p.get('t') && tunings[p.get('t')]) ? p.get('t') : Object.keys(tunings)[0];
    if (FLAT_KEYS.includes(p.get('r'))) { state.root = p.get('r'); }
    if (p.get('m') === 'intervals') { state.mode = 'intervals'; }
    state.lefty = p.get('l') === '1';
    if (p.get('p')) {
        const strings = currentTuning().length;
        for (const token of p.get('p').split('.')) {
            const [s, f] = token.split('-').map(Number);
            if (s >= 0 && s < strings && f >= 0 && f <= FRETS) {
                state.picks.add(s + ':' + f);
            }
        }
    }
}

/* ---- boot ---- */
restore();
fillInstruments();
fillTunings();
fillRoots();
modeSelect.value = state.mode;
leftyCheckbox.checked = state.lefty;
render();
