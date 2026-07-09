/* The app's physical catalog: instruments, tunings and color themes.
 * (Scales and chords — pure music theory — live in theory.js.)
 *
 * Tunings are MIDI note numbers (C4 = middle C = 60), listed in the
 * instrument's physical string order (the array's first entry renders at
 * the bottom of the board). Octaves really only matter for the free-hand sheet music atm.
 * Everything else only uses the pitch class (midi % 12).
 */

const INSTRUMENTS = {
    'Guitar': {
        clef: 'treble-8',
        inlays: true, /* Most guitars have inlays, so why not visualize them */
        frets: 24,
        tunings: {
            'Standard':   [40, 45, 50, 55, 59, 64],  // E2 A2 D3 G3 B3 E4
            'Drop D':     [38, 45, 50, 55, 59, 64],  // D2 A2 D3 G3 B3 E4
            'DADGAD':     [38, 45, 50, 55, 57, 62],  // D2 A2 D3 G3 A3 D4
            'Open G':     [38, 43, 50, 55, 59, 62],  // D2 G2 D3 G3 B3 D4
        },
    },
    'Guitar (7-string)': {
        clef: 'treble-8',
        inlays: true,
        frets: 24,
        tunings: {
            'Standard':   [35, 40, 45, 50, 55, 59, 64], // B1 E2 A2 D3 G3 B3 E4
        },
    },
    'Bass': {
        clef: 'bass-8',
        inlays: true,
        frets: 24, /* Lets go for 24 even if 20 is probably more common */
        tunings: {
            'Standard':   [28, 33, 38, 43],          // E1 A1 D2 G2
            'Drop D':     [26, 33, 38, 43],          // D1 A1 D2 G2
            '5-string':   [23, 28, 33, 38, 43],      // B0 E1 A1 D2 G2
            '6-string':   [23, 28, 33, 38, 43, 48],  // B0 E1 A1 D2 G2 C3
        },
    },
    'Ukulele': {
        inlays: true,
        frets: 15,
        tunings: {
            'Standard':   [67, 60, 64, 69],          // g4 C4 E4 A4
            'Baritone':   [50, 55, 59, 64],          // D3 G3 B3 E4
        },
    },
    'Mandolin': {
        inlays: true,
        frets: 20,
        tunings: {
            'Standard':   [55, 62, 69, 76],          // G3 D4 A4 E5
        },
    },
    'Banjo (5-string)': {
        inlays: true,
        frets: 22,
        tunings: {
            'Open G':     [67, 50, 55, 59, 62],      // g4 D3 G3 B3 D4
            'Double C':   [67, 48, 55, 60, 62],      // g4 C3 G3 C4 D4
        },
    },
    'Banjo (tenor)': {
        inlays: true,
        frets: 19,
        tunings: {
            'Standard':   [48, 55, 62, 69],          // C3 G3 D4 A4
            'Irish':      [43, 50, 57, 64],          // G2 D3 A3 E4
        },
    },
    'Bouzouki (Irish)': {
        inlays: true,
        frets: 22,
        tunings: {
            'GDAD':       [43, 50, 57, 62],          // G2 D3 A3 D4
            'GDAE':       [43, 50, 57, 64],          // G2 D3 A3 E4
        },
    },
    'Dobro': {
        clef: 'treble-8',
        inlays: true,
        frets: 19,
        tunings: {
            'Open G':     [55, 59, 62, 67, 71, 74],  // G3 B3 D4 G4 B4 D5
        },
    },
    'Baritone guitar': {
        clef: 'treble-8',
        inlays: true,
        frets: 24,
        tunings: {
            'Standard':   [35, 40, 45, 50, 54, 59],  // B1 E2 A2 D3 F#3 B3
        },
    },
    'Lap steel': {
        clef: 'treble-8',
        inlays: true,
        frets: 24,
        tunings: {
            'C6':         [48, 52, 55, 57, 60, 64],  // C3 E3 G3 A3 C4 E4
            'Open E':     [40, 47, 52, 56, 59, 64],  // E2 B2 E3 G#3 B3 E4
        },
    },
};

/* color themes for the board; applied as CSS variables (style.css) and
 * used directly by the PNG renderer (fretboard.js) */
const THEMES = {
    'Default': {
        boardBg: 'white',
        string: 'rgb(192, 192, 192)',
        wire: 'rgb(192, 192, 192)',
        nut: 'rgb(109, 109, 109)',
        marker: 'rgb(192, 192, 192)',
        markerSelected: 'rgb(70, 70, 70)',
        root: 'rgb(160, 160, 160)',
        rootSelected: 'rgb(25, 25, 25)',
        emph: 'rgb(150, 150, 150)',
        emphSelected: 'rgb(0, 0, 0)',
        markerText: 'white',
        text: 'black',
        subText: 'rgb(70, 70, 70)',
        boardText: 'rgb(133, 133, 133)',
        inlay: 'rgba(0, 0, 0, 0.1)',
    },
    'Rosewood': {
        boardBg: 'rgb(107, 74, 47)',        // rosewood brown
        string: 'rgb(216, 216, 216)',       // silver strings
        wire: 'rgb(176, 176, 176)',         // silver fret wire
        nut: 'rgb(232, 220, 196)',          // bone nut
        marker: 'rgb(163, 129, 95)',        // light tan
        markerSelected: 'rgb(38, 22, 10)',  // dark brown
        root: 'rgb(140, 105, 72)',
        rootSelected: 'rgb(0, 0, 0)',
        emph: 'rgb(120, 90, 58)',
        emphSelected: 'rgb(0, 0, 0)',
        markerText: 'white',
        /* labels/numbers/texts sit outside the wood, on the page background */
        text: 'black',
        subText: 'rgb(70, 70, 70)',
        boardText: 'rgb(133, 133, 133)',
        inlay: 'rgba(255, 246, 225, 0.5)',      // mother-of-pearl on dark wood
    },
    'Maple': {
        boardBg: 'rgb(233, 202, 146)',      // pale maple
        string: 'rgb(150, 150, 150)',       // silver strings on light wood
        wire: 'rgb(138, 138, 138)',
        nut: 'rgb(90, 66, 40)',             // dark nut for contrast
        marker: 'rgb(182, 152, 102)',
        markerSelected: 'rgb(62, 42, 20)',
        root: 'rgb(152, 122, 76)',
        rootSelected: 'rgb(0, 0, 0)',
        emph: 'rgb(140, 110, 70)',
        emphSelected: 'rgb(0, 0, 0)',
        markerText: 'white',
        text: 'black',
        subText: 'rgb(70, 70, 70)',
        boardText: 'rgb(133, 133, 133)',
        inlay: 'rgba(80, 55, 30, 0.25)',        // dark dots on pale maple
    },
};
