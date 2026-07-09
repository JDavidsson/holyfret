/* Pure music theory — no DOM code in this file: the interval vocabulary,
 * pitch-class helpers, buildNeck(), and the scale & chord catalogs.
 *
 * Pitch classes are numbers 0–11 (C = 0, C# = 1, ... B = 11). Tunings
 * arrive as MIDI note numbers (middle C = 60); every function here only
 * uses their pitch class, so (open + fret) % 12 works unchanged.
 * Each pitch class relative to a root has exactly one display name,
 * taken from INTERVAL_NAMES — so e.g. a b6 is written '#5' and a b5 as
 * '#11'. TODO: support showing b6 if people prefer that?
 */

const FLAT_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const INTERVAL_NAMES = ['1', 'b9', '2', 'b3', '3', '4', '#11', '5', '#5', '6', 'b7', '7'];

/* Key name ("Eb" or "D#") -> pitch class (3). */
function keyIndex(keyName) {
    const flat = FLAT_KEYS.indexOf(keyName);
    return flat >= 0 ? flat : SHARP_KEYS.indexOf(keyName);
}

/* Interval name at a given fret.
 * root: pitch class of the key, open: pitch class of the open string. */
function intervalAt(root, open, fret) {
    return INTERVAL_NAMES[(12 - root + open + fret) % 12];
}

/* Note name at a given fret, using the given spelling (FLAT_KEYS or SHARP_KEYS). */
function noteAt(noteNames, open, fret) {
    return noteNames[(open + fret) % 12];
}

/* Build the whole neck as a 2D array of { interval, note, pc } cells
 * (pc = pitch class, so selections survive flat/sharp respelling):
 * neck[string][fret], fret 0 = open string, strings in the tuning's order.
 * frets = number of fretted positions, so each string gets frets + 1 entries. */
function buildNeck(root, tuning, frets, noteNames) {
    return tuning.map(open =>
        Array.from({ length: frets + 1 }, (_, fret) => ({
            interval: intervalAt(root, open, fret),
            note: noteAt(noteNames, open, fret),
            pc: (open + fret) % 12,
        }))
    );
}


/* ---- Scale & chord catalogs ----
 * Each is a named set of interval names (from INTERVAL_NAMES above); the
 * app maps those to pitch classes at render time. Add a scale or chord with
 * one line here. (Instruments, tunings and themes — the app's physical
 * catalog — live in data.js.) */

const SCALES = new Map([

    /* major & minor families */
    ['Major',                    ['1', '2', '3', '4', '5', '6', '7']],
    ['Natural minor',            ['1', '2', 'b3', '4', '5', '#5', 'b7']],
    ['Harmonic minor',           ['1', '2', 'b3', '4', '5', '#5', '7']],
    ['Melodic minor',            ['1', '2', 'b3', '4', '5', '6', '7']],
    ['Harmonic major',           ['1', '2', '3', '4', '5', '#5', '7']],
    ['Double harmonic',          ['1', 'b9', '3', '4', '5', '#5', '7']],
    ['Hungarian minor',          ['1', '2', 'b3', '#11', '5', '#5', '7']],
    ['Hungarian major',          ['1', 'b3', '3', '#11', '5', '6', 'b7']],
    ['Neapolitan minor',         ['1', 'b9', 'b3', '4', '5', '#5', '7']],
    ['Neapolitan major',         ['1', 'b9', 'b3', '4', '5', '6', '7']],

    /* modes of the major scale */
    ['Dorian',                   ['1', '2', 'b3', '4', '5', '6', 'b7']],
    ['Phrygian',                 ['1', 'b9', 'b3', '4', '5', '#5', 'b7']],
    ['Lydian',                   ['1', '2', '3', '#11', '5', '6', '7']],
    ['Mixolydian',               ['1', '2', '3', '4', '5', '6', 'b7']],
    ['Locrian',                  ['1', 'b9', 'b3', '4', '#11', '#5', 'b7']],

    /* modes of melodic minor */
    ['Dorian b2',                ['1', 'b9', 'b3', '4', '5', '6', 'b7']],
    ['Lydian augmented',         ['1', '2', '3', '#11', '#5', '6', '7']],
    ['Lydian dominant',          ['1', '2', '3', '#11', '5', '6', 'b7']],
    ['Mixolydian b6',            ['1', '2', '3', '4', '5', '#5', 'b7']],
    ['Locrian #2',               ['1', '2', 'b3', '4', '#11', '#5', 'b7']],
    ['Altered',                  ['1', 'b9', 'b3', '3', '#11', '#5', 'b7']],

    /* modes of harmonic minor */
    ['Locrian nat6',             ['1', 'b9', 'b3', '4', '#11', '6', 'b7']],
    ['Ionian augmented',         ['1', '2', '3', '4', '#5', '6', '7']],
    ['Dorian #4',                ['1', '2', 'b3', '#11', '5', '6', 'b7']],
    ['Phrygian dominant',        ['1', 'b9', '3', '4', '5', '#5', 'b7']],
    ['Lydian #2',                ['1', 'b3', '3', '#11', '5', '6', '7']],
    ['Ultralocrian',             ['1', 'b9', 'b3', '3', '#11', '#5', '6']],

    /* pentatonic & blues */
    ['Major pentatonic',         ['1', '2', '3', '5', '6']],
    ['Minor pentatonic',         ['1', 'b3', '4', '5', 'b7']],
    ['Blues',                    ['1', 'b3', '4', '#11', '5', 'b7']],
    ['Major blues',              ['1', '2', 'b3', '3', '5', '6']],
    ['Egyptian',                 ['1', '2', '4', '5', 'b7']],
    ['Dominant pentatonic',      ['1', '2', '3', '5', 'b7']],
    ['Hirajoshi',                ['1', '2', 'b3', '5', '#5']],
    ['In (Sakura)',              ['1', 'b9', '4', '5', '#5']],
    ['Iwato',                    ['1', 'b9', '4', '#11', 'b7']],
    ['Insen',                    ['1', 'b9', '4', '5', 'b7']],
    ['Yo',                       ['1', '2', '4', '5', '6']],
    ['Balinese pelog',           ['1', 'b9', 'b3', '5', '#5']],

    /* bebop */
    ['Bebop dominant',           ['1', '2', '3', '4', '5', '6', 'b7', '7']],
    ['Bebop major',              ['1', '2', '3', '4', '5', '#5', '6', '7']],
    ['Bebop Dorian',             ['1', '2', 'b3', '3', '4', '5', '6', 'b7']],
    ['Bebop melodic minor',      ['1', '2', 'b3', '4', '5', '#5', '6', '7']],

    /* modes of harmonic major */
    ['Dorian b5',                ['1', '2', 'b3', '4', '#11', '6', 'b7']],
    ['Phrygian b4',              ['1', 'b9', 'b3', '3', '5', '#5', 'b7']],
    ['Lydian b3',                ['1', '2', 'b3', '#11', '5', '6', '7']],
    ['Mixolydian b2',            ['1', 'b9', '3', '4', '5', '6', 'b7']],
    ['Lydian augmented #2',      ['1', 'b3', '3', '#11', '#5', '6', '7']],
    ['Locrian bb7',              ['1', 'b9', 'b3', '4', '#11', '#5', '6']],

    /* more pentatonic & world */
    ['Kumoi',                    ['1', '2', 'b3', '5', '6']],
    ['Man Gong',                 ['1', 'b3', '4', '#5', 'b7']],
    ['Chinese',                  ['1', '3', '#11', '5', '7']],
    ['Hamsadhwani',              ['1', '2', '3', '5', '7']],
    ['Okinawan',                 ['1', '3', '4', '5', '7']],
    ['Hawaiian',                 ['1', '2', 'b3', '5', '6', '7']],
    ['Marva',                    ['1', 'b9', '3', '#11', '5', '6', '7']],
    ['Purvi',                    ['1', 'b9', '3', '#11', '5', '#5', '7']],
    ['Todi',                     ['1', 'b9', 'b3', '#11', '5', '#5', '7']],
    ['Ichikosucho',              ['1', '2', '3', '4', '#11', '5', '6', '7']],

    /* more hexatonic & bebop */
    ['Major hexatonic',          ['1', '2', '3', '4', '5', '6']],
    ['Minor hexatonic',          ['1', '2', 'b3', '4', '5', 'b7']],
    ['Bebop harmonic minor',     ['1', '2', 'b3', '4', '5', '#5', 'b7', '7']],
    ['Composite blues',          ['1', '2', 'b3', '3', '4', '#11', '5', '6', 'b7']],
    ['Lydian minor',             ['1', '2', '3', '#11', '5', '#5', 'b7']],
    ['Enigmatic minor',          ['1', 'b9', 'b3', '#11', '5', 'b7', '7']],
    ['Prometheus Neapolitan',    ['1', 'b9', '3', '#11', '6', 'b7']],

    /* Messiaen's modes of limited transposition (1 = whole tone,
     * 2 = diminished, both listed elsewhere) */
    ['Messiaen mode 3',          ['1', '2', 'b3', '3', '#11', '5', '#5', 'b7', '7']],
    ['Messiaen mode 4',          ['1', 'b9', '2', '4', '#11', '5', '#5', '7']],
    ['Messiaen mode 5',          ['1', 'b9', '4', '#11', '5', '7']],
    ['Messiaen mode 6',          ['1', '2', '3', '4', '#11', '#5', 'b7', '7']],
    ['Messiaen mode 7',          ['1', 'b9', '2', 'b3', '4', '#11', '5', '#5', '6', '7']],

    /* symmetric & other */
    ['Whole tone',               ['1', '2', '3', '#11', '#5', 'b7']],
    ['Diminished (whole-half)',  ['1', '2', 'b3', '4', '#11', '#5', '6', '7']],
    ['Diminished (half-whole)',  ['1', 'b9', 'b3', '3', '#11', '5', '6', 'b7']],
    ['Augmented',                ['1', 'b3', '3', '5', '#5', '7']],
    ['Chromatic',                ['1', 'b9', '2', 'b3', '3', '4', '#11', '5', '#5', '6', 'b7', '7']],
    ['Tritone',                  ['1', 'b9', '3', '#11', '5', 'b7']],
    ['Prometheus',               ['1', '2', '3', '#11', '6', 'b7']],
    ['Enigmatic',                ['1', 'b9', '3', '#11', '#5', 'b7', '7']],
    ['Persian',                  ['1', 'b9', '3', '4', '#11', '#5', '7']],
    ['Spanish 8-tone',           ['1', 'b9', 'b3', '3', '4', '#11', '#5', 'b7']],
    ['Major Locrian',            ['1', '2', '3', '4', '#11', '#5', 'b7']],
    ['Leading whole tone',       ['1', '2', '3', '#11', '#5', 'b7', '7']],
]);

const CHORDS = new Map([

    /* triads & power chord */
    ['Major',    ['1', '3', '5']],
    ['Minor',    ['1', 'b3', '5']],
    ['aug',      ['1', '3', '#5']],
    ['dim',      ['1', 'b3', '#11']],
    ['5',        ['1', '5']],
    ['sus2',     ['1', '2', '5']],
    ['sus4',     ['1', '4', '5']],

    /* sixths */
    ['6',        ['1', '3', '5', '6']],
    ['m6',       ['1', 'b3', '5', '6']],
    ['6/9',      ['1', '3', '5', '6', '2']],
    ['m6/9',     ['1', 'b3', '5', '6', '2']],

    /* sevenths */
    ['7',        ['1', '3', '5', 'b7']],
    ['maj7',     ['1', '3', '5', '7']],
    ['m7',       ['1', 'b3', '5', 'b7']],
    ['m(maj7)',  ['1', 'b3', '5', '7']],
    ['m7b5',     ['1', 'b3', '#11', 'b7']],
    ['dim7',     ['1', 'b3', '#11', '6']],
    ['7sus2',    ['1', '2', '5', 'b7']],
    ['7sus4',    ['1', '4', '5', 'b7']],
    ['7b5',      ['1', '3', '#11', 'b7']],
    ['7#5',      ['1', '3', '#5', 'b7']],
    ['maj7b5',   ['1', '3', '#11', '7']],
    ['maj7#5',   ['1', '3', '#5', '7']],
    ['m7#5',     ['1', 'b3', '#5', 'b7']],

    /* added notes */
    ['add9',     ['1', '3', '5', '2']],
    ['madd9',    ['1', 'b3', '5', '2']],
    ['add11',    ['1', '3', '5', '4']],

    /* ninths */
    ['9',        ['1', '3', '5', 'b7', '2']],
    ['maj9',     ['1', '3', '5', '7', '2']],
    ['m9',       ['1', 'b3', '5', 'b7', '2']],
    ['m(maj9)',  ['1', 'b3', '5', '7', '2']],
    ['9sus4',    ['1', '4', '5', 'b7', '2']],
    ['9b5',      ['1', '3', '#11', 'b7', '2']],
    ['9#5',      ['1', '3', '#5', 'b7', '2']],
    ['7b9',      ['1', '3', '5', 'b7', 'b9']],
    ['7#9',      ['1', '3', '5', 'b7', 'b3']],

    /* elevenths & #11 */
    ['7#11',     ['1', '3', '5', 'b7', '#11']],
    ['maj7#11',  ['1', '3', '5', '7', '#11']],
    ['maj9#11',  ['1', '3', '5', '7', '2', '#11']],
    ['11',       ['1', '3', '5', 'b7', '2', '4']],
    ['m11',      ['1', 'b3', '5', 'b7', '2', '4']],
    ['m11b5',    ['1', 'b3', '#11', 'b7', '4']],

    /* thirteenths */
    ['13',       ['1', '3', '5', 'b7', '2', '6']],
    ['maj13',    ['1', '3', '5', '7', '2', '6']],
    ['m13',      ['1', 'b3', '5', 'b7', '2', '6']],
    ['13sus4',   ['1', '4', '5', 'b7', '2', '6']],
    ['13#11',    ['1', '3', '5', 'b7', '2', '#11', '6']],
    ['13b9',     ['1', '3', '5', 'b7', 'b9', '6']],
    ['13#9',     ['1', '3', '5', 'b7', 'b3', '6']],
    ['maj13#11', ['1', '3', '5', '7', '2', '#11', '6']],

    /* altered dominants */
    ['7b9b5',    ['1', '3', '#11', 'b7', 'b9']],
    ['7b9#5',    ['1', '3', '#5', 'b7', 'b9']],
    ['7#9b5',    ['1', '3', '#11', 'b7', 'b3']],
    ['7#9#5',    ['1', '3', '#5', 'b7', 'b3']],
    ['9#11',     ['1', '3', '5', 'b7', '2', '#11']],
    ['11b9',     ['1', '3', '5', 'b7', 'b9', '4']],
    ['7sus4b9',  ['1', '4', '5', 'b7', 'b9']],
    ['7add13',   ['1', '3', '5', 'b7', '6']],

    /* more colors */
    ['m7b9',     ['1', 'b3', '5', 'b7', 'b9']],
    ['m7add11',  ['1', 'b3', '5', 'b7', '4']],
    ['m9b5',     ['1', 'b3', '#11', 'b7', '2']],
    ['m(b6)',    ['1', 'b3', '5', '#5']],
    ['dim(maj7)', ['1', 'b3', '#11', '7']],
    ['add#11',   ['1', '3', '5', '#11']],
    ['6#11',     ['1', '3', '5', '6', '#11']],
    ['sus2/4',   ['1', '2', '4', '5']],
    ['maj7sus2', ['1', '2', '5', '7']],
    ['maj7sus4', ['1', '4', '5', '7']],
    ['maj9#5',   ['1', '3', '#5', '7', '2']],
    ['maj11',    ['1', '3', '5', '7', '2', '4']],
]);
