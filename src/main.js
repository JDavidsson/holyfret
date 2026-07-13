/* Holds the app state, builds the controls, and re-renders
 * the fretboard whenever the state changes.
 *
 * Data flow: control event -> update `state` -> render(state).
 *
 */

/* Indicate custom instrument */
const CUSTOM = 'Custom';

const CLEFS = [
    { value: 'treble', label: 'Treble' },
    { value: 'treble-8', label: 'Treble 8vb (guitar)' },
    { value: 'bass', label: 'Bass' },
    { value: 'bass-8', label: 'Bass 8vb (bass guitar)' },
];

const state = {
    instrument: 'Guitar',              // an INSTRUMENTS name, or CUSTOM when
                                       // strings/frets are hand-picked
    tuning: 'Standard',                // a tuning name, or CUSTOM
    customTuning: [40, 45, 50, 55, 59, 64], // MIDI notes, used when tuning === CUSTOM
    frets: 24,
    key: 'C',
    useSharps: false,
    mode: 'notes',                     // 'intervals' | 'notes' | 'both'
                                       // notes: the cold open reads "C E G", legible without theory
    intervals: new Set(['1', '3', '5']),
    showAll: false,
    lefty: false,
    zoom: 1,
    comment: '',                       // free text shown in the saved image
    sheet: false,                      // render the selection as sheet music
    clef: 'treble-8',                  // clef for the sheet music (guitar's default)
    keysig: false,                     // render the sheet with a key signature
    tab: false,                        // highlight a chord voicing on the board
    voicingIndex: 0,                   // which voicing the spotlight shows
    voicingAll: false,                 // spotlight every voicing at once
    inversions: false,                 // voicings may put a 3rd/5th in the bass
    freehand: false,                   // hand-pick exact frets by clicking
    picks: new Set(),                  // "string:fret" positions (free hand)
    theme: 'Default',                  // a THEMES name
    sound: false,                      // play a pluck on note/pick clicks (off by default)
};

const instrumentInput = document.getElementById('instrument-input');
const tuningInput = document.getElementById('tuning-input');
const stringsInput = document.getElementById('strings-input');
const fretsInput = document.getElementById('frets-input');
const keySelect = document.getElementById('key-select');
const accidentalSelect = document.getElementById('accidental-select');
const scaleInput = document.getElementById('scale-input');
const chordInput = document.getElementById('chord-input');
const modeSelect = document.getElementById('mode-select');
const showAllCheckbox = document.getElementById('show-all');
const leftyCheckbox = document.getElementById('lefty');
const sheetCheckbox = document.getElementById('show-sheet');
const sheetSection = document.getElementById('sheet-section');
const clefSelect = document.getElementById('clef-select');
const keySigCheckbox = document.getElementById('key-signature');
const tabCheckbox = document.getElementById('show-tab');
const freehandCheckbox = document.getElementById('free-hand');
const soundCheckbox = document.getElementById('sound-toggle');
const voicingBar = document.getElementById('voicing-bar');
const voicingLabel = document.getElementById('voicing-label');
const voicingPrev = document.getElementById('voicing-prev');
const voicingNext = document.getElementById('voicing-next');
const voicingAllCheckbox = document.getElementById('voicing-all');
const voicingInvCheckbox = document.getElementById('voicing-inv');
const sheetContainer = document.getElementById('sheet-music');
const commentInput = document.getElementById('board-comment');
const themeSelect = document.getElementById('theme-select');
const summaryLine = document.getElementById('summary');
const chordMatchLine = document.getElementById('chord-matches');
const scaleMatchLine = document.getElementById('scale-matches');
const customTuningSection = document.getElementById('custom-tuning-section');
const customTuningBox = document.getElementById('custom-tuning');
const selectionLabel = document.getElementById('selection-label');
const selectionBox = document.getElementById('selection-checkboxes');
const boardContainer = document.getElementById('fretboard-container');
const collectionAddButton = document.getElementById('collection-add');
const collectionSaveButton = document.getElementById('collection-save');
const collectionClearButton = document.getElementById('collection-clear');
const collectionPreviewBox = document.getElementById('collection-preview');

/* ---- user-facing copy ----
 * copy.json is the single source of truth; it is generated into window.COPY
 * (copy.js, loaded before this file). C is a shorthand, T() fills {token}
 * placeholders, and applyCopy() stamps the static text / titles / placeholders
 * onto the [data-t] / [data-tt] / [data-tp] elements in index.html. */
const C = window.COPY || {};
const T = (s, vars) => (s || '').replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const copyAt = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), C);
function applyCopy() {
    if (C.ui && C.ui.title) document.title = C.ui.title;
    document.querySelectorAll('[data-t]').forEach(el => {
        const v = copyAt(el.dataset.t); if (v != null) el.textContent = v;
    });
    document.querySelectorAll('[data-tt]').forEach(el => {
        const v = copyAt(el.dataset.tt); if (v != null) el.title = v;
    });
    document.querySelectorAll('[data-tp]').forEach(el => {
        const v = copyAt(el.dataset.tp); if (v != null) el.placeholder = v;
    });
}
applyCopy();

/* rotating slogan beside the title — a different one each refresh. The
 * original "get-a-grip" pun lives on here as one of the rotation. */
const SLOGANS = (C.slogans && C.slogans.length) ? C.slogans : ['Get a grip on the fretboard'];
const sloganEl = document.getElementById('slogan');
if (sloganEl) sloganEl.textContent = SLOGANS[Math.floor(Math.random() * SLOGANS.length)];

/* the logo is a home link; on the app page itself, make clicking it a plain
 * refresh (keep the current view/state) rather than resetting to a bare URL */
const logoEl = document.getElementById('logo');
if (logoEl) logoEl.addEventListener('click', (e) => { e.preventDefault(); location.reload(); });

function noteNames() {
    return state.useSharps ? SHARP_KEYS : FLAT_KEYS;
}

function currentTuning() {
    return state.tuning === CUSTOM
        ? state.customTuning
        : INSTRUMENTS[state.instrument].tunings[state.tuning];
}

/* does the current instrument customarily carry inlay dots? */
function currentInlays() {
    return state.instrument !== CUSTOM
        && Boolean(INSTRUMENTS[state.instrument]?.inlays);
}

/* the notation clef an instrument is conventionally written in
 * (guitars/basses sound an octave below the treble/bass staff) */
function instrumentClef() {
    return (state.instrument !== CUSTOM && INSTRUMENTS[state.instrument]?.clef)
        || 'treble';
}

/* pitch class of an interval name in the current key */
function intervalPc(iv) {
    return (keyIndex(state.key) + INTERVAL_NAMES.indexOf(iv)) % 12;
}

/* free hand: the pitch classes of the hand-picked positions */
function pickedPcs() {
    const tuning = currentTuning();
    const pcs = [];
    for (const key of state.picks) {
        const [string, fret] = key.split(':').map(Number);
        if (string < tuning.length) {
            pcs.push((tuning[string] + fret) % 12);
        }
    }
    return pcs;
}

/* the interval set the board represents: the checkbox selection, or in
 * free-hand mode the intervals implied by the picked positions */
function effectiveIntervals() {
    if (!state.freehand) {
        return state.intervals;
    }
    const root = keyIndex(state.key);
    return new Set(pickedPcs().map(pc => INTERVAL_NAMES[(pc - root + 12) % 12]));
}

/* the last rendered board, kept for the image download */
let lastNeck = null;
let lastOpts = null;

/* boards saved for the collection image; restored from the URL */
const collection = [];

/* all good voicings of the current selection (not just chord presets:
 * hand-tweaked selections voice too, as long as a root is selected and
 * the tones fit on the strings — otherwise "Show tab" disables) */
let lastVoicings = [];

function currentVoicings() {
    if (state.freehand) {
        return [];
    }
    const tuning = currentTuning();
    const size = state.intervals.size;
    if (size < 2 || size > tuning.length || tuning.length > 8) {
        return [];
    }
    const pcs = new Set([...state.intervals].map(iv => intervalPc(iv)));
    return findVoicings(pcs, tuning, keyIndex(state.key), state.frets, state.inversions);
}

function updateVoicingBar() {
    const n = lastVoicings.length;
    voicingBar.hidden = !state.tab || state.freehand;
    if (voicingBar.hidden) {
        return;
    }
    voicingBar.classList.toggle('dimmed', n === 0);
    voicingAllCheckbox.checked = state.voicingAll;
    voicingInvCheckbox.checked = state.inversions;
    voicingAllCheckbox.disabled = n === 0;
    voicingInvCheckbox.disabled = n === 0;
    if (n === 0) {
        voicingLabel.textContent = C.messages.noVoicings;
        voicingPrev.disabled = true;
        voicingNext.disabled = true;
        return;
    }
    const positionText = voicing => {
        /* "open position" only when a string is actually played open;
         * a 1st-fret barre (e.g. F) is "fret 1", not open */
        const usesOpen = voicing.frets.some(f => f === 0);
        const lowestFret = Math.min(...voicing.frets.filter(f => f > 0), 99);
        const where = lowestFret === 99 ? 'open strings'
            : usesOpen ? 'open position' : 'fret ' + lowestFret;
        const slash = voicing.bass !== keyIndex(state.key)
            ? ' /' + noteNames()[voicing.bass] : '';
        return where + slash;
    };
    if (state.voicingAll) {
        /* a colored legend, one swatch per voicing */
        voicingLabel.replaceChildren('All ' + n + ' voicings: ');
        lastVoicings.forEach((voicing, i) => {
            const chip = document.createElement('span');
            chip.className = 'voicing-swatch';
            chip.style.backgroundColor = VOICING_COLORS[i % VOICING_COLORS.length];
            chip.textContent = positionText(voicing);
            voicingLabel.appendChild(chip);
        });
        voicingPrev.disabled = true;
        voicingNext.disabled = true;
        return;
    }
    const voicing = lastVoicings[state.voicingIndex];
    voicingLabel.textContent = T(C.messages.voicingOf, { n: state.voicingIndex + 1, total: n })
        + ' — ' + positionText(voicing);
    voicingPrev.disabled = n < 2;
    voicingNext.disabled = n < 2;
}

function render() {
    lastVoicings = currentVoicings();
    if (state.voicingIndex >= lastVoicings.length) {
        state.voicingIndex = 0;
    }
    tabCheckbox.disabled = lastVoicings.length === 0;
    lastNeck = buildNeck(keyIndex(state.key), currentTuning(), state.frets, noteNames());
    lastOpts = {
        mode: state.mode,
        selectedIntervals: state.intervals,
        showAll: state.showAll,
        lefty: state.lefty,
        tab: state.tab && !state.voicingAll && lastVoicings.length
            ? lastVoicings[state.voicingIndex] : null,
        tabAll: state.tab && state.voicingAll && lastVoicings.length
            ? lastVoicings : null,
        picks: state.freehand ? state.picks : null,
        inlays: currentInlays(),
        onToggle: toggleCell,
    };
    renderFretboard(boardContainer, lastNeck, lastOpts);
    syncSelectionCheckboxes();
    updateVoicingBar();
    updateSummary();
    updateMatches();
    updateSheet();
    persistState();
}

/* Sheet music spelling is driven by the interval, not the flat/sharp
 * toggle: a b3 is written on the third staff position above the root
 * (C minor = C Eb G, never C D# G — D# would read as a #9). Only the
 * root's own spelling follows the toggle (Db minor vs C# minor).
 * Each interval therefore maps to a letter distance from the root; the
 * accidental is whatever makes that letter hit the right pitch. */
const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/* midi pitch written on each clef's middle line, to center the notes */
const CLEF_CENTERS = {
    'treble': 71, 'treble-8': 71, 'bass': 50, 'bass-8': 50,
};
const NOTE_LETTER_PCS = [0, 2, 4, 5, 7, 9, 11];
const INTERVAL_LETTER_STEPS = {
    '1': 0, 'b9': 1, '2': 1, 'b3': 2, '3': 2, '4': 3,
    '#11': 3, '5': 4, '#5': 4, '6': 5, 'b7': 6, '7': 6,
};

/* major key signatures: number of sharps (positve) and number of flats (negative)
   when I was a kid I learned (swedish)
     "Giv dem alla en hel (b) fisk och
     Frosten berövade esters astrar dess gestalt :) "" */
const SIG_COUNTS = {
    'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
    'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6,
};
const SIG_SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const SIG_ENHARMONIC = { 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb' };

/* the signature to draw and what it does to each letter (-1/0/+1) */
function signatureInfo() {
    if (!state.keysig) {
        return { abcKey: 'C', letterDiff: {} };
    }
    const name = SIG_ENHARMONIC[state.key] ?? state.key;
    const count = SIG_COUNTS[name] ?? 0;
    const letterDiff = {};
    if (count > 0) {
        SIG_SHARP_ORDER.slice(0, count).forEach(letter => { letterDiff[letter] = 1; });
    } else if (count < 0) {
        [...SIG_SHARP_ORDER].reverse().slice(0, -count)
            .forEach(letter => { letterDiff[letter] = -1; });
    }
    return { abcKey: name, letterDiff };
}

/* emit an accidental only when the note differs from what the signature
 * (and earlier accidentals in the bar) already imply for that letter */
function accidentalFor(diff, letter, octaveKey, altered, letterDiff) {
    const current = altered.has(octaveKey) ? altered.get(octaveKey)
        : (letterDiff[letter] ?? 0);
    if (diff === current) {
        return '';
    }
    altered.set(octaveKey, diff);
    return diff === 0 ? '=' : diff < 0 ? '_'.repeat(-diff) : '^'.repeat(diff);
}

/* free hand: the picked positions as ABC notes at their REAL pitches
 * (the tunings store MIDI numbers, so string octaves are known) */
function freehandSheetTokens() {
    const tuning = currentTuning();
    const names = noteNames();
    const midis = [...new Set([...state.picks].map(key => {
        const [string, fret] = key.split(':').map(Number);
        return string < tuning.length ? tuning[string] + fret : null;
    }).filter(m => m !== null))].sort((a, b) => a - b);
    /* octave clefs (guitar's treble-8, bass guitar's bass-8) write the
     * music an octave above where it sounds — that is the convention
     * players are used to reading */
    const writtenShift = state.clef.endsWith('-8') ? 12 : 0;
    const { letterDiff } = signatureInfo();
    const altered = new Map();
    return midis.map(midi => {
        const written = midi + writtenShift;
        const name = names[written % 12];
        const letter = name[0];
        const diff = name[1] === 'b' ? -1 : name[1] === '#' ? 1 : 0;
        const octaveIndex = Math.floor(written / 12) - 1; // C4 = 60 -> 4
        const accidental =
            accidentalFor(diff, letter, letter + octaveIndex, altered, letterDiff);
        const pitch = octaveIndex >= 5
            ? letter.toLowerCase() + "'".repeat(octaveIndex - 5)
            : letter + ','.repeat(4 - octaveIndex);
        return { token: accidental + pitch, semitone: midi - 60 };
    });
}

/* the selection as ABC notes, one ascending octave from the root; each
 * entry carries its semitone above middle C so a click can play it.
 * In notes mode the sheet mirrors the board's literal note names instead
 * (D# stays D#, even where it is functionally an Eb). */
function sheetTokens() {
    if (state.freehand) {
        return freehandSheetTokens();
    }
    const selected = effectiveIntervals();
    const ivs = INTERVAL_NAMES.filter(iv => selected.has(iv));
    const rootLetter = NOTE_LETTERS.indexOf(state.key[0]);
    const rootPc = keyIndex(state.key);
    const names = noteNames();
    const altered = new Map(); // accidental currently in effect per letter+octave
    /* whole octaves between the selection's center and the clef's middle */
    const clefCenter = CLEF_CENTERS[state.clef] ?? 71;
    const octaveShift = Math.round((clefCenter - (60 + rootPc + 6)) / 12);
    const { letterDiff } = signatureInfo();
    return ivs.map(iv => {
        const semitone = rootPc + INTERVAL_NAMES.indexOf(iv);
        let letter;
        let octaveUp;
        let diff;
        if (state.mode === 'notes') {
            /* literal: take the displayed note name as-is */
            const name = names[semitone % 12];
            letter = name[0];
            octaveUp = semitone >= 12;
            diff = name[1] === 'b' ? -1 : name[1] === '#' ? 1 : 0;
        } else {
            /* interval-based: the letter comes from the interval's degree */
            const letterIndex = rootLetter + INTERVAL_LETTER_STEPS[iv];
            letter = NOTE_LETTERS[letterIndex % 7];
            octaveUp = letterIndex >= 7;
            const naturalPitch = NOTE_LETTER_PCS[letterIndex % 7] + (octaveUp ? 12 : 0);
            diff = semitone - naturalPitch; // -1=flat, +1=sharp, +-2=double
        }
        /* shift whole octaves so the run sits around the clef's middle */
        const octaveIndex = (octaveUp ? 5 : 4) + octaveShift;
        const accidental =
            accidentalFor(diff, letter, letter + octaveIndex, altered, letterDiff);
        const pitch = octaveIndex >= 5
            ? letter.toLowerCase() + "'".repeat(octaveIndex - 5)
            : letter + ','.repeat(4 - octaveIndex);
        return { token: accidental + pitch, semitone };
    });
}

/* clicked notes play through a short WebAudio pluck — no extra library */
let audioContext = null;

function playTone(semitone, delay = 0) {
    if (!state.sound) {
        return; // audio is opt-in (off by default)
    }
    audioContext = audioContext
        ?? new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const at = audioContext.currentTime + delay;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 261.63 * 2 ** (semitone / 12); // from middle C
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 1);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(at);
    osc.stop(at + 1.05);
}

/* all selected tones at once, lightly strummed low-to-high */
function playChord(semitones) {
    semitones.forEach((semitone, i) => playTone(semitone, i * 0.04));
}

/* the current selection as one ABC tune (one ascending octave from the
 * root), with the note-start offsets the click handler needs; null when
 * there is nothing to write */
function currentAbc() {
    const notes = sheetTokens();
    if (!notes.length) {
        return null;
    }
    let abc = 'X:1\nL:1/4\nK:' + signatureInfo().abcKey
        + ' clef=' + state.clef + '\n';
    const starts = [];
    notes.forEach(note => {
        starts.push(abc.length);
        abc += note.token + ' ';
    });
    if (notes.length > 1) {
        /* re-spell in a fresh bar so measure accidentals start over */
        abc += '| [' + sheetTokens().map(n => n.token).join('') + ']';
    }
    abc += '|]';
    return { abc, starts, notes };
}

/* render an ABC string offscreen and rasterize it onto a white canvas
 * (2x for crispness); resolves null if it cannot be rendered */
function rasterizeSheet(abc) {
    return new Promise(resolve => {
        if (!abc || typeof ABCJS === 'undefined') {
            resolve(null);
            return;
        }
        const holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;left:-10000px;top:0;width:760px;';
        document.body.appendChild(holder);
        ABCJS.renderAbc(holder, abc, { paddingtop: 0, paddingbottom: 0, staffwidth: 700 });
        const svg = holder.querySelector('svg');
        if (!svg) {
            holder.remove();
            resolve(null);
            return;
        }
        const width = Math.ceil(svg.viewBox?.baseVal?.width || svg.clientWidth || 700);
        const height = Math.ceil(svg.viewBox?.baseVal?.height || svg.clientHeight || 130);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        const data = new XMLSerializer().serializeToString(svg);
        holder.remove();
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas);
        };
        img.onerror = () => resolve(null);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
    });
}

/* board image + notation image stacked into one canvas */
function composeWithSheet(boardCanvas, sheetCanvas) {
    if (!sheetCanvas) {
        return boardCanvas;
    }
    const gap = 12;
    const inset = 24;
    const out = document.createElement('canvas');
    out.width = Math.max(boardCanvas.width, sheetCanvas.width + inset * 2);
    out.height = boardCanvas.height + gap + sheetCanvas.height + inset;
    const ctx = out.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(boardCanvas, 0, 0);
    ctx.drawImage(sheetCanvas, inset, boardCanvas.height + gap);
    return out;
}

function updateSheet() {
    sheetSection.hidden = !state.sheet;
    if (!state.sheet) {
        return;
    }
    if (typeof ABCJS === 'undefined') {
        /* the library loads async; wait for it a little before giving up */
        sheetContainer.textContent = C.messages.loadingSheet;
        if (!updateSheet.waiting) {
            let attempts = 0;
            updateSheet.waiting = setInterval(() => {
                if (typeof ABCJS !== 'undefined' || ++attempts > 50) {
                    clearInterval(updateSheet.waiting);
                    updateSheet.waiting = null;
                    if (typeof ABCJS !== 'undefined') {
                        updateSheet();
                    } else {
                        sheetContainer.textContent = C.messages.sheetError;
                    }
                }
            }, 300);
        }
        return;
    }
    const built = currentAbc();
    if (!built) {
        sheetContainer.replaceChildren();
        return;
    }
    const { abc, starts, notes } = built;
    ABCJS.renderAbc(sheetContainer, abc, {
        paddingtop: 0,
        paddingbottom: 0,
        add_classes: true,
        clickListener: abcelem => {
            /* the stacked chord at the end carries several pitches */
            if ((abcelem.pitches ?? []).length > 1) {
                playChord(notes.map(n => n.semitone));
                return;
            }
            for (let i = starts.length - 1; i >= 0; i--) {
                if (starts[i] <= abcelem.startChar) {
                    playTone(notes[i].semitone);
                    break;
                }
            }
        },
    });
}

/* --- chord voicings ---
 * When a chord preset is active, search the current tuning for playable
 * voicings the way chord charts write them. Hard rules — a shape is only
 * shown if it passes all of them:
 *   - every chord tone sounds, every sounding note is a chord tone
 *   - the root is the lowest sounding note
 *   - no muted strings in the middle (only at the edges)
 *   - fretted notes sit inside a four-fret window
 *   - at most four fingers, where a barre on the lowest fret counts as one
 *   - open strings only in open position: chord charts up the neck are
 *     movable shapes, not open-string hybrids
 * Returns the best shape per neck position, low positions first, so the
 * list reads like the familiar chord-chart positions up the neck. */

function fingerCount(frets) {
    const fretted = frets.filter(f => f > 0);
    if (!fretted.length) {
        return 0;
    }
    const lowest = Math.min(...fretted);
    const atLowest = fretted.filter(f => f === lowest).length;
    return 1 + fretted.length - atLowest; // the lowest fret can be barred
}

function findVoicings(pcs, tuning, rootPc, maxFret, allowInversions = false) {
    if (tuning.length > 8) {
        return []; // brute force is for fretted hand instruments
    }
    const found = [];
    const frets = [];
    for (let base = 0; base + 3 <= Math.min(maxFret, 15); base++) {
        const best = new Map(); // one shape per bass note per window
        const options = tuning.map(open => {
            const list = [-1];
            for (let f = 0; f <= base + 3; f++) {
                if (f === 0 && base > 1) {
                    continue; // open strings only near the nut
                }
                if (f !== 0 && f < base) {
                    continue; // fretted notes must sit in the window
                }
                if (pcs.has((open + f) % 12)) {
                    list.push(f);
                }
            }
            return list;
        });
        const consider = () => {
            const sounding = [];
            frets.forEach((f, i) => {
                if (f >= 0) {
                    sounding.push((tuning[i] + f) % 12);
                }
            });
            if (!sounding.length || ![...pcs].every(pc => sounding.includes(pc))) {
                return;
            }
            const bass = frets.findIndex(f => f >= 0);
            const bassPc = (tuning[bass] + frets[bass]) % 12;
            if (bassPc !== rootPc && !allowInversions) {
                return; // root in the bass (unless inversions are allowed)
            }
            const top = frets.length - 1 - [...frets].reverse().findIndex(f => f >= 0);
            for (let i = bass; i <= top; i++) {
                if (frets[i] < 0) {
                    return; // no muted strings in the middle
                }
            }
            if (fingerCount(frets) > 4) {
                return;
            }
            const score = sounding.length * 12
                + (bassPc === rootPc ? 8 : 0)
                - fingerCount(frets) * 2
                - frets.reduce((s, f) => s + Math.max(f, 0), 0) * 0.3;
            if (!best.has(bassPc) || score > best.get(bassPc).score) {
                best.set(bassPc, { frets: [...frets], base, score, bass: bassPc });
            }
        };
        const walk = i => {
            if (i === tuning.length) {
                consider();
                return;
            }
            for (const f of options[i]) {
                frets[i] = f;
                walk(i + 1);
            }
        };
        walk(0);
        found.push(...best.values());
    }
    /* the same shape is found by several overlapping windows — dedup,
     * then order by neck position */
    const seen = new Set();
    const unique = [];
    for (const v of found) {
        const key = v.frets.join(',');
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(v);
        }
    }
    const position = v => Math.min(...v.frets.filter(f => f > 0), 99);
    unique.sort((a, b) => position(a) - position(b)
        || (a.bass === rootPc ? 0 : 1) - (b.bass === rootPc ? 0 : 1));
    return unique;
}

/* clicking a fret: in free hand it toggles that exact position; in the
 * normal modes it toggles the tone (in both vocabularies, they sync) */
function toggleCell(cell, string, fret) {
    const pitch = currentTuning()[string] + fret - 60; // the pressed fret's actual pitch
    if (state.freehand) {
        const key = string + ':' + fret;
        if (!state.picks.delete(key)) {
            state.picks.add(key);
            playTone(pitch); // sound the added note
        }
        render();
        return;
    }
    if (!state.intervals.delete(cell.interval)) {
        state.intervals.add(cell.interval);
        playTone(pitch); // sound the added note
    }
    syncSelectionCheckboxes();
    clearPresets();
    render();
}

/* plain-text description of what is on the board, matching the mode:
 * intervals: "C Major: 1 3 5"
 * notes:     "Notes: C E G"
 * both:      "C Major: 1 3 5 (C E G)" */
function updateSummary() {
    const names = noteNames();
    if (state.freehand) {
        const pcs = [...new Set(pickedPcs())];
        summaryLine.textContent = pcs.length
            ? T(C.messages.freehand, { notes: pcs.map(pc => names[pc]).join(' '), n: state.picks.size })
            : C.messages.freehandEmpty;
        return;
    }
    const preset = scaleInput.value || chordInput.value;
    const head = (state.key + ' ' + (preset || '')).trim();
    const ivs = INTERVAL_NAMES.filter(iv => state.intervals.has(iv));
    const tones = ivs.map(iv => names[intervalPc(iv)]);

    let text = '';
    if (ivs.length) {
        if (state.mode === 'intervals') {
            text = head + ': ' + ivs.join(' ');
        } else if (state.mode === 'notes') {
            text = C.messages.notesPrefix + tones.join(' ');
        } else {
            text = head + ': ' + ivs.join(' ') + ' (' + tones.join(' ') + ')';
        }
    }
    summaryLine.textContent = text;
}

/* --- recognizing the selection ---
 * the tones on the board are compared, as a pitch-class set, against
 * every chord and scale at every possible root. Scales must match
 * exactly; chords also match when they are contained in the selection
 * (so C melodic minor lists Cm, Cm(maj7), ...). Results are clickable
 * chips: click applies that chord/scale, hover previews it on the board. */

function intervalsToMask(intervals) {
    let mask = 0;
    for (const iv of intervals) {
        mask |= 1 << INTERVAL_NAMES.indexOf(iv);
    }
    return mask;
}

const CHORD_MASKS = [...CHORDS].map(([name, ivs], i) => ({ name, i, mask: intervalsToMask(ivs) }));
const SCALE_MASKS = [...SCALES].map(([name, ivs], i) => ({ name, i, mask: intervalsToMask(ivs) }));

/* transpose a root-0 pitch-class mask up by `root` semitones */
function transposeMask(mask, root) {
    return ((mask << root) | (mask >>> (12 - root))) & 0xfff;
}

/* pitch-class mask of everything selected on the board */
function selectionMask() {
    let mask = 0;
    if (state.freehand) {
        for (const pc of pickedPcs()) {
            mask |= 1 << pc;
        }
        return mask;
    }
    for (const iv of state.intervals) {
        mask |= 1 << intervalPc(iv);
    }
    return mask;
}

function computeMatches() {
    const sel = selectionMask();
    const chords = [];
    const scales = [];
    if (!sel) {
        return { chords, scales };
    }
    const names = noteNames();
    const cur = keyIndex(state.key);
    for (let root = 0; root < 12; root++) {
        if (!(sel & (1 << root))) {
            continue; // every chord/scale contains its root
        }
        for (const c of CHORD_MASKS) {
            const m = transposeMask(c.mask, root);
            if ((m & sel) === m) { // chord contained in the selection
                chords.push({ ...c, root, mask: m, label: names[root] + ' ' + c.name,
                    samekey: root === cur, isScale: false });
            }
        }
        for (const s of SCALE_MASKS) {
            if (transposeMask(s.mask, root) === sel) { // scales must match exactly
                scales.push({ ...s, root, mask: sel, label: names[root] + ' ' + s.name,
                    samekey: root === cur, isScale: true });
            }
        }
    }
    /* the selected key's matches first (they render in bold), then by
     * distance from the key, keeping the data-table order within a root */
    const cmp = (a, b) =>
        ((a.root - cur + 12) % 12) - ((b.root - cur + 12) % 12) || a.i - b.i;
    chords.sort(cmp);
    scales.sort(cmp);
    return { chords, scales };
}

/* hover preview: darken the board markers belonging to a match */
function emphasize(mask) {
    for (const marker of boardContainer.querySelectorAll('.marker')) {
        marker.classList.toggle('emph', Boolean(mask & (1 << Number(marker.dataset.pc))));
    }
}

/* clicking a match applies it: its root becomes the key, and the
 * chord/scale becomes the active preset */
function applyMatch(match) {
    state.key = noteNames()[match.root];
    keySelect.value = state.key;
    rebuildSelectionSection();
    scaleInput.value = match.isScale ? match.name : '';
    chordInput.value = match.isScale ? '' : match.name;
    applyPreset((match.isScale ? SCALES : CHORDS).get(match.name));
}

const MATCH_LIMIT = 8;

function renderMatchLine(container, heading, list, expanded) {
    container.hidden = list.length === 0;
    container.replaceChildren();
    if (!list.length) {
        return;
    }
    container.append(heading + ' ');
    const shown = expanded ? list : list.slice(0, MATCH_LIMIT);
    for (const match of shown) {
        const chip = document.createElement('span');
        chip.className = 'match-chip' + (match.samekey ? ' samekey' : '');
        chip.textContent = match.label;
        chip.addEventListener('click', () => applyMatch(match));
        chip.addEventListener('mouseenter', () => emphasize(match.mask));
        chip.addEventListener('mouseleave', () => emphasize(0));
        container.appendChild(chip);
    }
    if (list.length > shown.length) {
        const more = document.createElement('span');
        more.className = 'match-chip';
        more.textContent = T(C.messages.moreCount, { n: list.length - shown.length });
        more.addEventListener('click', () => renderMatchLine(container, heading, list, true));
        container.appendChild(more);
    }
}

function updateMatches() {
    const { chords, scales } = computeMatches();
    renderMatchLine(chordMatchLine, C.messages.chordMatches, chords, false);
    renderMatchLine(scaleMatchLine, C.messages.scaleMatches, scales, false);
}

/* --- saving and restoring the whole setup ---
 * every change is written to the URL (shareable, bookmarkable) and to
 * localStorage; on load the URL wins, then localStorage, then defaults */

const STORAGE_KEY = 'holyfret-state';

function stateToParams() {
    const p = new URLSearchParams();
    p.set('instrument', state.instrument);
    p.set('tuning', state.tuning);
    if (state.tuning === CUSTOM) {
        p.set('pitches', state.customTuning.join('.'));
    }
    p.set('frets', state.frets);
    p.set('key', state.key);
    if (state.useSharps) {
        p.set('sharps', '1');
    }
    p.set('mode', state.mode);
    p.set('intervals', [...state.intervals].join('.'));
    if (state.showAll) {
        p.set('all', '1');
    }
    if (state.lefty) {
        p.set('lefty', '1');
    }
    if (state.zoom !== 1) {
        p.set('zoom', state.zoom);
    }
    if (state.comment) {
        p.set('comment', state.comment);
    }
    if (state.sheet) {
        p.set('sheet', '1');
    }
    if (state.tab) {
        p.set('tab', '1');
    }
    if (state.clef !== instrumentClef()) {
        p.set('clef', state.clef); // only when it differs from the instrument's default
    }
    if (state.keysig) {
        p.set('ks', '1');
    }
    if (state.voicingIndex > 0) {
        p.set('voicing', state.voicingIndex);
    }
    if (state.voicingAll) {
        p.set('voicingall', '1');
    }
    if (state.inversions) {
        p.set('inv', '1');
    }
    if (state.freehand) {
        p.set('fh', '1');
    }
    if (state.sound) {
        p.set('sound', '1');
    }
    if (state.picks.size) {
        p.set('picks', [...state.picks].join(','));
    }
    if (state.theme !== 'Default') {
        p.set('theme', state.theme);
    }
    if (scaleInput.value) {
        p.set('scale', scaleInput.value);
    }
    if (chordInput.value) {
        p.set('chord', chordInput.value);
    }
    for (const item of collection) {
        p.append('col', item.params);
    }
    return p;
}

function persistState() {
    const q = stateToParams().toString();
    rememberForUndo(q);
    try {
        history.replaceState(null, '', '?' + q);
    } catch (e) { /* not allowed on file:// in some browsers */ }
    try {
        localStorage.setItem(STORAGE_KEY, q);
    } catch (e) { /* private mode etc. */ }
}

/* mutates `state` (and the collection) from a params string, validating
 * everything; returns the saved scale/chord preset names */
function applyParams(q) {
    /* fields whose params are omitted at their defaults must be reset
     * first, so applying an older snapshot cannot leave stale values */
    state.zoom = 1;
    state.theme = 'Default';
    state.voicingIndex = 0;
    collection.length = 0;
    const p = new URLSearchParams(q);

    state.useSharps = p.get('sharps') === '1';
    state.showAll = p.get('all') === '1';
    state.lefty = p.get('lefty') === '1';
    state.sheet = p.get('sheet') === '1';
    state.tab = p.get('tab') === '1';
    state.voicingAll = p.get('voicingall') === '1';
    state.inversions = !state.voicingAll && p.get('inv') === '1';
    state.freehand = p.get('fh') === '1';
    state.sound = p.get('sound') === '1';
    state.picks = new Set((p.get('picks') ?? '').split(',')
        .filter(k => /^\d+:\d+$/.test(k)).slice(0, 100));
    const voicingIndex = Number(p.get('voicing'));
    if (Number.isInteger(voicingIndex) && voicingIndex > 0 && voicingIndex < 24) {
        state.voicingIndex = voicingIndex; // clamped against the list on render
    }
    state.comment = (p.get('comment') ?? p.get('note') ?? '').slice(0, 300);
    state.keysig = p.get('ks') === '1';
    const themeName = p.get('theme') === 'Guitar' ? 'Rosewood' : p.get('theme');
    if (THEMES[themeName]) {
        state.theme = themeName;
    }
    const zoom = Number(p.get('zoom'));
    if (zoom >= 0.6 && zoom <= 2.4) {
        state.zoom = zoom;
    }

    if (INSTRUMENTS[p.get('instrument')] || p.get('instrument') === CUSTOM) {
        state.instrument = p.get('instrument');
    }
    const frets = Number(p.get('frets'));
    if (frets >= 3 && frets <= 36) {
        state.frets = frets;
    }
    const pitches = (p.get('pitches') ?? '').split('.').map(Number)
        .map(n => n >= 0 && n < 12 ? n + 48 : n); // legacy links stored pitch classes
    if (p.get('tuning') === CUSTOM && pitches.length >= 1 && pitches.length <= 12
        && pitches.every(n => Number.isInteger(n) && n >= 12 && n <= 96)) {
        state.tuning = CUSTOM;
        state.customTuning = pitches;
    } else if (state.instrument !== CUSTOM
        && INSTRUMENTS[state.instrument].tunings[p.get('tuning')]) {
        state.tuning = p.get('tuning');
    } else if (state.instrument === CUSTOM) {
        /* a custom instrument needs a valid custom tuning */
        state.instrument = 'Guitar';
    }

    /* an explicit clef in the link wins; otherwise adopt the instrument's
     * natural clef (guitar -> treble 8vb, bass -> bass 8vb) */
    state.clef = CLEFS.some(c => c.value === p.get('clef'))
        ? p.get('clef') : instrumentClef();

    const keys = state.useSharps ? SHARP_KEYS : FLAT_KEYS;
    if (keys.includes(p.get('key'))) {
        state.key = p.get('key');
    }
    if (['intervals', 'notes', 'both'].includes(p.get('mode'))) {
        state.mode = p.get('mode');
    }
    if (p.get('intervals') !== null) {
        state.intervals = new Set(
            p.get('intervals').split('.').filter(iv => INTERVAL_NAMES.includes(iv)));
    } else if (p.get('notes') !== null) {
        /* legacy links stored notes separately; derive intervals from them */
        const root = keyIndex(state.key);
        state.intervals = new Set(p.get('notes').split('.').map(Number)
            .filter(n => Number.isInteger(n) && n >= 0 && n <= 11)
            .map(pc => INTERVAL_NAMES[(pc - root + 12) % 12]));
    } else if (SCALES.has(p.get('scale'))) {
        /* hand-authored link (e.g. an SEO landing page): no intervals but
         * a named scale/chord — derive the selection from the preset */
        state.intervals = new Set(SCALES.get(p.get('scale')));
    } else if (CHORDS.has(p.get('chord'))) {
        state.intervals = new Set(CHORDS.get(p.get('chord')));
    }
    for (const colParams of p.getAll('col').slice(0, 10)) {
        collection.push(paramsToSnapshot(colParams));
    }
    return { scale: p.get('scale'), chord: p.get('chord') };
}

/* on load: the URL wins, then localStorage, then defaults */
function restoreState() {
    let q = location.search.replace(/^\?/, '');
    if (!q) {
        try {
            q = localStorage.getItem(STORAGE_KEY) ?? '';
        } catch (e) { /* ignore */ }
    }
    if (!q) {
        return null;
    }
    return applyParams(q);
}

/* push every distinct state onto an undo stack (as its params string) */
const undoStack = [];
let lastParams = null;
let undoing = false;

function rememberForUndo(q) {
    if (q === lastParams) {
        return;
    }
    if (lastParams !== null && !undoing) {
        undoStack.push(lastParams);
        if (undoStack.length > 100) {
            undoStack.shift();
        }
    }
    lastParams = q;
}

/* one sync pass that makes every control reflect `state` — used at
 * startup and after an undo */
function syncAllControls(presets) {
    fillKeySelect();
    rebuildSelectionSection();
    syncInstrumentControls();
    modeSelect.value = state.mode;
    accidentalSelect.value = state.useSharps ? 'sharp' : 'flat';
    showAllCheckbox.checked = state.showAll;
    leftyCheckbox.checked = state.lefty;
    sheetCheckbox.checked = state.sheet;
    tabCheckbox.checked = state.tab;
    freehandCheckbox.checked = state.freehand;
    soundCheckbox.checked = state.sound;
    keySigCheckbox.checked = state.keysig;
    clefSelect.value = state.clef;
    themeSelect.value = state.theme;
    applyTheme();
    applyZoom();
    commentInput.value = state.comment;
    // reveal the (collapsed-by-default) comment box when a restored/shared
    // state already carries text, so it isn't silently hidden
    const commentDetails = document.getElementById('comment-details');
    if (commentDetails) commentDetails.open = !!state.comment;
    scaleInput.value = presets && presets.scale && SCALES.has(presets.scale)
        ? presets.scale : '';
    chordInput.value = presets && presets.chord && CHORDS.has(presets.chord)
        ? presets.chord : '';
    renderCollectionPreview();
    updateCollectionButtons();
}

document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z'
        || event.shiftKey || event.altKey) {
        return;
    }
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA'
        || (active.tagName === 'INPUT' && active.type === 'text'))) {
        return; // let text fields keep their native undo
    }
    if (!undoStack.length) {
        return;
    }
    event.preventDefault();
    undoing = true;
    const presets = applyParams(undoStack.pop());
    syncAllControls(presets);
    render();
    undoing = false;
});

/* a collection entry, rebuilt purely from a saved parameter string so
 * entries survive the shareable link round-trip */
function paramsToSnapshot(q) {
    const p = new URLSearchParams(q);
    const useSharps = p.get('sharps') === '1';
    const names = useSharps ? SHARP_KEYS : FLAT_KEYS;
    const key = names.includes(p.get('key')) ? p.get('key') : 'C';
    let frets = Number(p.get('frets'));
    if (!(frets >= 3 && frets <= 36)) {
        frets = 24;
    }
    const instrument = INSTRUMENTS[p.get('instrument')];
    const pitches = (p.get('pitches') ?? '').split('.').map(Number)
        .map(n => n >= 0 && n < 12 ? n + 48 : n);
    let tuning = INSTRUMENTS['Guitar'].tunings['Standard'];
    if (p.get('tuning') === CUSTOM && pitches.length >= 1 && pitches.length <= 12
        && pitches.every(n => Number.isInteger(n) && n >= 12 && n <= 96)) {
        tuning = pitches;
    } else if (instrument && instrument.tunings[p.get('tuning')]) {
        tuning = instrument.tunings[p.get('tuning')];
    } else if (instrument) {
        tuning = Object.values(instrument.tunings)[0];
    }
    const mode = ['intervals', 'notes', 'both'].includes(p.get('mode'))
        ? p.get('mode') : 'intervals';
    const snapTheme = p.get('theme') === 'Guitar' ? 'Rosewood' : p.get('theme');
    const theme = THEMES[snapTheme] ? snapTheme : 'Default';
    const intervals = new Set((p.get('intervals') ?? '')
        .split('.').filter(iv => INTERVAL_NAMES.includes(iv)));

    /* the snapshot keeps its tab spotlight, recomputed from its own state */
    let tab = null;
    let tabAll = null;
    if (p.get('tab') === '1' && intervals.size >= 2 && intervals.size <= tuning.length) {
        const rootPc = keyIndex(key);
        const pcs = new Set([...intervals]
            .map(iv => (rootPc + INTERVAL_NAMES.indexOf(iv)) % 12));
        const voicings = findVoicings(pcs, tuning, rootPc, frets, p.get('inv') === '1');
        if (voicings.length) {
            if (p.get('voicingall') === '1') {
                tabAll = voicings;
            } else {
                const index = Number(p.get('voicing'));
                tab = voicings[index > 0 && index < voicings.length ? index : 0];
            }
        }
    }

    const picks = p.get('fh') === '1'
        ? new Set((p.get('picks') ?? '').split(',').filter(k => /^\d+:\d+$/.test(k)))
        : null;
    const inlays = Boolean(instrument?.inlays);
    return {
        params: q,
        neck: buildNeck(keyIndex(key), tuning, frets, names),
        opts: {
            mode,
            selectedIntervals: intervals,
            showAll: p.get('all') === '1',
            lefty: p.get('lefty') === '1',
            tab,
            tabAll,
            picks,
            inlays,
        },
        caption: p.get('caption') ?? '',
        comment: p.get('comment') ?? '',
        abc: p.get('abc'),
        colors: THEMES[theme],
    };
}

/* --- small helpers --- */

function clamp(value, min, max, fallback) {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/* --- keeping the controls in sync with state --- */

/* instrument, tuning list, strings/frets and the custom-tuning row are
 * all coupled, so one sync function keeps them consistent */
function syncInstrumentControls() {
    instrumentInput.value = state.instrument;
    instrumentInput.classList.toggle('dimmed', state.instrument === CUSTOM);

    tuningInput.value = state.tuning;
    stringsInput.value = currentTuning().length;
    fretsInput.value = state.frets;

    customTuningSection.hidden = state.tuning !== CUSTOM;
    if (state.tuning === CUSTOM) {
        fillCustomTuning();
    }
}

/* per string: a note dropdown plus an octave dropdown (octaves matter
 * for the free-hand sheet music; C4 is middle C) */
function fillCustomTuning() {
    customTuningBox.replaceChildren();
    const names = noteNames();
    state.customTuning.forEach((midi, i) => {
        const wrap = document.createElement('span');
        wrap.className = 'custom-string';
        const noteSelect = document.createElement('select');
        names.forEach((name, pc) => noteSelect.append(new Option(name, pc)));
        noteSelect.value = midi % 12;
        const octaveSelect = document.createElement('select');
        octaveSelect.title = 'Octave (4 holds middle C)';
        for (let octave = 0; octave <= 6; octave++) {
            octaveSelect.append(new Option(octave, octave));
        }
        octaveSelect.value = Math.floor(midi / 12) - 1;
        const apply = () => {
            state.customTuning[i] =
                (Number(octaveSelect.value) + 1) * 12 + Number(noteSelect.value);
            render();
        };
        noteSelect.addEventListener('change', apply);
        octaveSelect.addEventListener('change', apply);
        wrap.append(noteSelect, octaveSelect);
        customTuningBox.appendChild(wrap);
    });
}

/* copy the current preset tuning into customTuning and select it,
 * so custom editing always starts from what was on screen */
function switchToCustomTuning() {
    if (state.tuning !== CUSTOM) {
        state.customTuning = [...currentTuning()];
        state.tuning = CUSTOM;
    }
}

/* (re)fill the key dropdown with flat or sharp names, keeping the
 * currently selected pitch */
function fillKeySelect() {
    const names = noteNames();
    state.key = names[keyIndex(state.key)];
    keySelect.replaceChildren();
    for (const name of names) {
        keySelect.append(new Option(name, name));
    }
    keySelect.value = state.key;
}

/* the single selection checkbox row; every checkbox toggles an interval
 * (notes are the same selection, just spelled for the current key):
 * intervals mode: "1"  "b9"  ...   in interval order
 * notes mode:     "C"  "Db"  ...   in pitch order
 * both mode:      "1/C"  "b9/Db"   in interval order */
function rebuildSelectionSection() {
    const names = noteNames();
    const root = keyIndex(state.key);
    selectionLabel.textContent = C.messages.selectionLabel[state.mode];

    selectionBox.replaceChildren();
    for (let i = 0; i < 12; i++) {
        let iv, text;
        if (state.mode === 'notes') {
            iv = INTERVAL_NAMES[(i - root + 12) % 12]; // i is a pitch class here
            text = names[i];
        } else {
            iv = INTERVAL_NAMES[i];
            text = state.mode === 'both' ? iv + ', ' + names[(root + i) % 12] : iv;
        }
        const label = document.createElement('label');
        label.className = 'interval-checkbox';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = iv;
        box.checked = state.intervals.has(iv);
        label.append(text, box);
        selectionBox.appendChild(label);
    }
    /* "Show all" lives at the end of this row */
    selectionBox.appendChild(showAllCheckbox.closest('label'));
}

function syncSelectionCheckboxes() {
    const effective = effectiveIntervals();
    for (const box of selectionBox.querySelectorAll('input')) {
        if (box === showAllCheckbox) {
            continue;
        }
        box.checked = effective.has(box.value);
        box.disabled = state.freehand; // read-only indicators in free hand
    }
}

function clearPresets() {
    scaleInput.value = '';
    chordInput.value = '';
}

function applyPreset(intervals) {
    state.freehand = false; // presets think in tones, not positions
    freehandCheckbox.checked = false;
    state.intervals = new Set(intervals);
    syncSelectionCheckboxes();
    render();
}

/* --- restore any saved setup, then build the controls from it --- */

const savedPresets = restoreState();

for (const name of Object.keys(THEMES)) {
    themeSelect.append(new Option(name, name));
}
for (const clef of CLEFS) {
    clefSelect.append(new Option(clef.label, clef.value));
}

syncAllControls(savedPresets);
if (!savedPresets) {
    chordInput.value = 'Major'; // matches the initial 1-3-5 selection
}

/* --- events --- */

makeCombobox(instrumentInput,
    () => [CUSTOM, ...Object.keys(INSTRUMENTS)],
    name => {
        if (name === CUSTOM) {
            switchToCustomTuning();
            state.instrument = CUSTOM;
        } else if (name) {
            state.instrument = name;
            state.tuning = Object.keys(INSTRUMENTS[name].tunings)[0];
            state.frets = INSTRUMENTS[name].frets;
            state.clef = instrumentClef();   // adopt the instrument's natural clef
            clefSelect.value = state.clef;
        }
        /* no match: syncInstrumentControls restores the previous value */
        syncInstrumentControls();
        render();
    });

makeCombobox(tuningInput,
    () => state.instrument === CUSTOM
        ? [CUSTOM]
        : [...Object.keys(INSTRUMENTS[state.instrument].tunings), CUSTOM],
    name => {
        if (name === CUSTOM) {
            switchToCustomTuning();
        } else if (name) {
            state.tuning = name;
        }
        syncInstrumentControls();
        render();
    });

/* hand-picking strings or frets means we're no longer on a preset
 * instrument: instrument becomes Custom (dimmed) and the tuning opens
 * up for editing, seeded from what was selected */
stringsInput.addEventListener('change', () => {
    const n = clamp(Number(stringsInput.value), 1, 12, currentTuning().length);
    switchToCustomTuning();
    state.instrument = CUSTOM;
    while (state.customTuning.length < n) {
        state.customTuning.push(state.customTuning[state.customTuning.length - 1] ?? 40);
    }
    state.customTuning.length = n;
    syncInstrumentControls();
    render();
});

fretsInput.addEventListener('change', () => {
    switchToCustomTuning();
    state.instrument = CUSTOM;
    state.frets = clamp(Number(fretsInput.value), 3, 36, state.frets);
    syncInstrumentControls();
    render();
});

keySelect.addEventListener('change', () => {
    state.key = keySelect.value;
    rebuildSelectionSection(); // note labels follow the key
    render();
});

/* switching between flat and sharp spellings keeps the same pitches
 * selected everywhere; only the names change */
accidentalSelect.addEventListener('change', () => {
    state.useSharps = accidentalSelect.value === 'sharp';
    fillKeySelect();
    rebuildSelectionSection();
    if (state.tuning === CUSTOM) {
        fillCustomTuning();
    }
    render();
});

makeCombobox(scaleInput,
    () => [...SCALES.keys()],
    name => {
        chordInput.value = '';
        scaleInput.value = name ?? '';
        if (name) {
            applyPreset(SCALES.get(name));
        }
    });

makeCombobox(chordInput,
    () => [...CHORDS.keys()],
    name => {
        scaleInput.value = '';
        chordInput.value = name ?? '';
        if (name) {
            applyPreset(CHORDS.get(name));
        }
    });

/* toggling a checkbox by hand means the selection is no longer a preset */
selectionBox.addEventListener('change', event => {
    if (!INTERVAL_NAMES.includes(event.target.value)) {
        return; // e.g. the "Show all" checkbox at the end of this row
    }
    if (event.target.checked) {
        state.intervals.add(event.target.value);
    } else {
        state.intervals.delete(event.target.value);
    }
    clearPresets();
    render();
});

document.getElementById('reset-selection').addEventListener('click', () => {
    if (state.freehand) {
        state.picks.clear();
    } else {
        state.intervals = new Set();
        clearPresets();
    }
    syncSelectionCheckboxes();
    render();
});

modeSelect.addEventListener('change', () => {
    state.mode = modeSelect.value;
    rebuildSelectionSection();
    render();
});

showAllCheckbox.addEventListener('change', () => {
    state.showAll = showAllCheckbox.checked;
    render();
});

freehandCheckbox.addEventListener('change', () => {
    state.freehand = freehandCheckbox.checked;
    if (state.freehand) {
        clearPresets(); // suggestions now come from the picked frets
    }
    render();
});

leftyCheckbox.addEventListener('change', () => {
    state.lefty = leftyCheckbox.checked;
    render();
});

soundCheckbox.addEventListener('change', () => {
    state.sound = soundCheckbox.checked;
    if (state.sound) {
        playTone(0); // unlock the audio context on this user gesture + preview
    }
    persistState();
});

sheetCheckbox.addEventListener('change', () => {
    state.sheet = sheetCheckbox.checked;
    updateSheet();
    persistState();
});

clefSelect.addEventListener('change', () => {
    state.clef = clefSelect.value;
    updateSheet();
    persistState();
});

keySigCheckbox.addEventListener('change', () => {
    state.keysig = keySigCheckbox.checked;
    updateSheet();
    persistState();
});

tabCheckbox.addEventListener('change', () => {
    state.tab = tabCheckbox.checked;
    render();
});

voicingPrev.addEventListener('click', () => {
    const n = lastVoicings.length;
    state.voicingIndex = (state.voicingIndex - 1 + n) % n;
    render();
});

voicingNext.addEventListener('click', () => {
    const n = lastVoicings.length;
    state.voicingIndex = (state.voicingIndex + 1) % n;
    render();
});

/* "Show all voicings" and "Inversions" are mutually exclusive:
 * 25 inverted shapes in 8 colors is noise, not information */
voicingAllCheckbox.addEventListener('change', () => {
    state.voicingAll = voicingAllCheckbox.checked;
    if (state.voicingAll) {
        state.inversions = false;
    }
    render();
});

voicingInvCheckbox.addEventListener('change', () => {
    state.inversions = voicingInvCheckbox.checked;
    if (state.inversions) {
        state.voicingAll = false;
    }
    render();
});

commentInput.addEventListener('input', () => {
    state.comment = commentInput.value;
    persistState();
});

themeSelect.addEventListener('change', () => {
    state.theme = themeSelect.value;
    applyTheme();
    persistState();
});

/* push the chosen theme's colors into the CSS variables the board uses;
 * the PNG renderer gets the same values via opts.colors */
function applyTheme() {
    const t = THEMES[state.theme] ?? THEMES['Default'];
    const s = document.documentElement.style;
    s.setProperty('--board-bg', t.boardBg);
    s.setProperty('--string-line', t.string);
    s.setProperty('--fret-wire', t.wire);
    s.setProperty('--nut-bar', t.nut);
    s.setProperty('--marker-bg', t.marker);
    s.setProperty('--marker-selected', t.markerSelected);
    s.setProperty('--marker-root', t.root);
    s.setProperty('--marker-root-selected', t.rootSelected);
    s.setProperty('--marker-emph', t.emph);
    s.setProperty('--marker-emph-selected', t.emphSelected);
    s.setProperty('--marker-text', t.markerText);
    s.setProperty('--board-text', t.boardText);
    s.setProperty('--inlay', t.inlay ?? 'rgba(0, 0, 0, 0.1)');
}

/* board zoom: pure CSS scaling, no re-render needed */
function applyZoom() {
    boardContainer.style.zoom = state.zoom;
}

function changeZoom(step) {
    state.zoom = Math.round(Math.min(2.4, Math.max(0.6, state.zoom + step)) * 10) / 10;
    applyZoom();
    persistState();
}

document.getElementById('full-reset').addEventListener('click', () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
    /* Reset everything but the selected instrument */
    const p = new URLSearchParams();
    p.set('instrument', state.instrument);
    if (state.instrument === CUSTOM) {
        // a custom instrument has no named tunings — keep its pitches
        p.set('tuning', CUSTOM);
        p.set('pitches', state.customTuning.join('.'));
    } else {
        // reset to the instrument's default (first) tuning
        p.set('tuning', Object.keys(INSTRUMENTS[state.instrument].tunings)[0]);
    }
    p.set('intervals', ''); // clear the selection; everything else omitted → defaults
    location.replace(location.pathname + '?' + p.toString());
});

document.getElementById('zoom-in').addEventListener('click', () => changeZoom(0.2));
document.getElementById('zoom-out').addEventListener('click', () => changeZoom(-0.2));

const copyLinkButton = document.getElementById('copy-link');
copyLinkButton.addEventListener('click', async () => {
    const url = location.href;
    try {
        await navigator.clipboard.writeText(url);
    } catch (e) {
        /* older browsers / non-secure contexts */
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    }
    copyLinkButton.textContent = C.messages.copied;
    setTimeout(() => { copyLinkButton.textContent = C.ui.buttons.copyLink; }, 1500);
});

applyZoom();

function downloadCanvas(canvas, nameParts) {
    const link = document.createElement('a');
    link.download = ['holyfret', ...nameParts].join('-').replaceAll(' ', '_') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

document.getElementById('save-image').addEventListener('click', async () => {
    let canvas = drawFretboardCanvas(lastNeck, {
        ...lastOpts,
        headline: false,
        caption: summaryLine.textContent,
        comment: state.comment,
        colors: THEMES[state.theme],
    });
    if (state.sheet) {
        canvas = composeWithSheet(canvas, await rasterizeSheet(currentAbc()?.abc));
    }
    const preset = scaleInput.value || chordInput.value;
    downloadCanvas(canvas, [state.key, preset || state.mode]);
});

/* --- the collection: stack up boards, save them as one image ---
 * entries live in the URL too, so a shared link carries the collection */

function updateCollectionButtons() {
    // the two collection buttons only appear once there's a collection to
    // act on, so the default action row stays uncluttered
    collectionSaveButton.hidden = collection.length === 0;
    collectionSaveButton.disabled = collection.length === 0;
    collectionSaveButton.textContent = C.ui.buttons.collectionSave
        + (collection.length ? ' (' + collection.length + ')' : '');
    collectionClearButton.hidden = collection.length === 0;
}

/* thumbnails of every saved board, with reorder and remove controls */
function renderCollectionPreview() {
    collectionPreviewBox.hidden = collection.length === 0;
    collectionPreviewBox.replaceChildren();
    collection.forEach((snap, i) => {
        const item = document.createElement('div');
        item.className = 'collection-item';

        const img = document.createElement('img');
        img.src = drawFretboardCanvas(snap.neck, {
            ...snap.opts,
            headline: false,
            caption: snap.caption,
            comment: snap.comment,
            colors: snap.colors,
        }).toDataURL('image/png');
        img.alt = snap.caption || 'fretboard';
        item.appendChild(img);

        const controls = document.createElement('div');
        controls.className = 'collection-item-controls';
        const button = (text, title, disabled, onClick) => {
            const b = document.createElement('button');
            b.textContent = text;
            b.title = title;
            b.disabled = disabled;
            b.addEventListener('click', () => {
                onClick();
                collectionChanged();
            });
            controls.appendChild(b);
        };
        button('\u25c0', 'Move left', i === 0,
            () => collection.splice(i - 1, 0, collection.splice(i, 1)[0]));
        button('\u00d7', 'Remove from collection', false,
            () => collection.splice(i, 1));
        button('\u25b6', 'Move right', i === collection.length - 1,
            () => collection.splice(i + 1, 0, collection.splice(i, 1)[0]));
        item.appendChild(controls);

        collectionPreviewBox.appendChild(item);
    });
}

function collectionChanged() {
    renderCollectionPreview();
    updateCollectionButtons();
    persistState();
}

collectionAddButton.addEventListener('click', () => {
    if (collection.length >= 10) {
        return; // keeps the shareable link a sane length
    }
    const p = stateToParams();
    p.delete('col'); // a snapshot must not nest the collection
    p.set('caption', summaryLine.textContent);
    if (state.sheet) {
        const built = currentAbc();
        if (built) {
            p.set('abc', built.abc); // the snapshot's own notation
        }
    }
    collection.push(paramsToSnapshot(p.toString()));
    collectionChanged();
});

collectionSaveButton.addEventListener('click', async () => {
    const canvases = await Promise.all(collection.map(async (snap, i) => {
        const board = drawFretboardCanvas(snap.neck, {
            ...snap.opts,
            headline: false,
            caption: snap.caption,
            comment: snap.comment,
            colors: snap.colors,
        });
        return snap.abc ? composeWithSheet(board, await rasterizeSheet(snap.abc)) : board;
    }));
    const gap = 24;
    const out = document.createElement('canvas');
    out.width = Math.max(...canvases.map(c => c.width));
    out.height = canvases.reduce((h, c) => h + c.height, 0) + gap * (canvases.length - 1);
    const ctx = out.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, out.width, out.height);
    let y = 0;
    for (const c of canvases) {
        ctx.drawImage(c, 0, y);
        y += c.height + gap;
    }
    downloadCanvas(out, ['collection']);
});

collectionClearButton.addEventListener('click', () => {
    collection.length = 0;
    collectionChanged();
});

renderCollectionPreview();
updateCollectionButtons();

render();
