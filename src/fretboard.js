/* Fretboard view — turns a neck (from theory.js) into DOM.
 * The board is rebuilt from scratch on every render; nothing in here
 * is ever looked up again after it is created.
 */

const FRET_BASE_WIDTH = 3.6;  // rem, width of the first fret (incl. fret wire)
const FRET_SCALING = 0.97;    // each successive fret is slightly narrower
const DOTTED_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

/* distinct colors for the "all voicings" overlay (theme-independent) */
const VOICING_COLORS = ['rgb(31, 119, 180)', 'rgb(214, 39, 40)', 'rgb(44, 160, 44)',
    'rgb(148, 103, 189)', 'rgb(255, 127, 14)', 'rgb(23, 190, 207)',
    'rgb(227, 119, 194)', 'rgb(140, 86, 75)'];

function fretWidthRem(fret) {
    return FRET_BASE_WIDTH * FRET_SCALING ** (fret - 1);
}

function fretWidth(fret) {
    return fretWidthRem(fret) + 'rem';
}

/* is this neck cell part of the current selection? intervals and notes
 * are always in sync, so the interval set alone decides */
function cellIsSelected(cell, opts) {
    return opts.selectedIntervals.has(cell.interval);
}

/* container:  element to render into (existing contents are replaced)
 * neck:       neck[string][fret] cells of { interval, note, pc }, strings low to high
 * opts:
 *   mode:               'intervals' | 'notes' | 'both' — what the markers say
 *   selectedIntervals:  Set of interval names to highlight
 *   showAll:            if true, unselected markers are shown dimmed instead of hidden
 *   lefty:              mirror the board for left-handed players
 *   tab:                a voicing { frets: per-string fret or -1 } to spotlight:
 *                       its positions stay crisp, everything else fades,
 *                       muted strings get an x on their label
 *   tabAll:             an array of voicings to spotlight at once, each
 *                       colored from VOICING_COLORS
 *   picks:              free-hand mode: a Set of "string:fret" positions;
 *                       when present it replaces the interval selection
 *   onToggle:           called with (cell, string, fret) when a fret is clicked */
function renderFretboard(container, neck, opts) {

    const { mode, showAll, tab, tabAll } = opts;

    const label = (marker, cell) => {
        if (mode === 'both') {
            for (const text of [cell.interval, cell.note]) {
                const line = document.createElement('div');
                line.className = 'marker-line';
                line.textContent = text;
                marker.appendChild(line);
            }
        } else {
            marker.textContent = mode === 'notes' ? cell.note : cell.interval;
        }
    };

    const board = document.createElement('div');
    board.className = 'fretboard';
    board.classList.toggle('lefty', Boolean(opts.lefty));

    /* strings from high to low, so the high string ends up on top
     * like a regular fretboard diagram */
    for (let s = neck.length - 1; s >= 0; s--) {
        const string = document.createElement('div');
        string.className = 'string';

        /* open-string name to the left of the nut */
        const tag = document.createElement('div');
        tag.className = 'string-label';
        tag.textContent = neck[s][0].note;
        if (tab && tab.frets[s] < 0) {
            tag.classList.add('muted');
        }
        string.appendChild(tag);

        neck[s].forEach((neckCell, fret) => {
            const cell = document.createElement('div');
            cell.className = fret === 0 ? 'nut' : 'fret';
            if (fret > 0) {
                cell.style.width = fretWidth(fret);
            }
            if (opts.onToggle) {
                cell.addEventListener('click', () => opts.onToggle(neckCell, s, fret));
            }

            const marker = document.createElement('div');
            marker.className = 'marker';
            marker.dataset.pc = neckCell.pc; // for hover emphasis from the match list
            if (neckCell.interval === '1') {
                marker.classList.add('root');
            }
            label(marker, neckCell);
            const isSelected = opts.picks
                ? opts.picks.has(s + ':' + fret)
                : cellIsSelected(neckCell, opts);
            if (isSelected) {
                marker.classList.add('highlight');
            } else if (!showAll) {
                marker.classList.add('hidden-marker');
            }
            if (tab) {
                marker.classList.add(tab.frets[s] === fret ? 'tab-pick' : 'tab-dim');
            } else if (tabAll) {
                const hits = [];
                tabAll.forEach((voicing, v) => {
                    if (voicing.frets[s] === fret) {
                        hits.push(VOICING_COLORS[v % VOICING_COLORS.length]);
                    }
                });
                if (hits.length === 1) {
                    marker.classList.add('tab-pick');
                    marker.style.backgroundColor = hits[0];
                } else if (hits.length > 1) {
                    /* shared by several voicings: split the circle */
                    marker.classList.add('tab-pick');
                    const seg = 100 / hits.length;
                    marker.style.background = 'linear-gradient(135deg, ' + hits
                        .map((c, i) => c + ' ' + i * seg + '% ' + (i + 1) * seg + '%')
                        .join(', ') + ')';
                } else {
                    marker.classList.add('tab-dim');
                }
            }

            cell.appendChild(marker);
            string.appendChild(cell);
        });

        board.appendChild(string);
    }

    /* inlay dots on the wood, like a real neck (double at 12 and 24) —
     * only for instruments that customarily have them (opts.inlays) */
    const strings = neck.length;
    const positions = neck[0].length;
    let leftRem = 1.8 + 2.5; // string label + open-string cell (see CSS)
    let totalRem = leftRem;
    for (let f = 1; f < positions; f++) {
        totalRem += fretWidthRem(f);
    }
    const midRem = 1 + strings; // 1rem board padding + half of strings*2rem
    const doubleOffset = Math.max(0.8, strings * 0.3);
    for (let f = 1; opts.inlays && f < positions; f++) {
        const width = fretWidthRem(f);
        if (DOTTED_FRETS.includes(f)) {
            const center = leftRem + width / 2;
            const x = opts.lefty ? totalRem - center : center;
            const ys = f % 12 === 0
                ? [midRem - doubleOffset, midRem + doubleOffset] : [midRem];
            for (const y of ys) {
                const dot = document.createElement('div');
                dot.className = 'inlay-dot';
                dot.style.left = x + 'rem';
                dot.style.top = y + 'rem';
                board.appendChild(dot);
            }
        }
        leftRem += width;
    }

    /* fret numbers under the board, at the usual inlay positions */
    const numbers = document.createElement('div');
    numbers.className = 'fret-numbers';
    const spacer = document.createElement('div');
    spacer.className = 'string-label';
    numbers.appendChild(spacer);
    for (let fret = 0; fret < neck[0].length; fret++) {
        const cell = document.createElement('div');
        cell.className = fret === 0 ? 'nut-number' : 'fret-number';
        if (fret > 0) {
            cell.style.width = fretWidth(fret);
            if (DOTTED_FRETS.includes(fret)) {
                cell.textContent = fret;
            }
        }
        numbers.appendChild(cell);
    }
    board.appendChild(numbers);

    container.replaceChildren(board);
}

/* Draw the same board onto a canvas, for saving as a PNG.
 * Same inputs as renderFretboard; returns the canvas.
 * Extra opts for images: headline (default true), caption (summary
 * text above the board), comment (free text below the board, wrapped),
 * colors (a THEMES entry; defaults to the Default theme).
 * Geometry mirrors the CSS at the default 12px root font size. */
function drawFretboardCanvas(neck, opts) {

    const colors = opts.colors ?? THEMES['Default'];
    const REM = 12;                 // px per rem
    const ROW = 2 * REM;            // string row height
    const LABEL_W = 1.8 * REM;      // open-string name column
    const NUT_W = 2 * REM;          // open-string area before the nut bar
    const NUT_BAR = 0.5 * REM;      // the nut itself
    const WIRE = 0.24 * REM;        // fret wire width
    const R = 0.85 * REM;           // marker radius
    const PAD = REM;                // outer padding
    const NUMBERS_H = 1.4 * REM;    // fret number strip below the board
    const imgHeadline = (window.COPY && COPY.image && COPY.image.headline) || 'holyfret.com';
    const imgCredit = (window.COPY && COPY.image && COPY.image.credit) || '';
    const HEAD_H = opts.headline === false ? 0 : (imgCredit ? 3.6 : 2.2) * REM;
    const CAPTION_H = opts.caption ? 1.6 * REM : 0;

    const strings = neck.length;
    const positions = neck[0].length;

    /* x of each cell's left edge (cell 0 is the open-string area) */
    const cellX = [PAD + LABEL_W];
    cellX.push(cellX[0] + NUT_W + NUT_BAR);
    for (let f = 1; f < positions; f++) {
        cellX.push(cellX[f] + FRET_BASE_WIDTH * FRET_SCALING ** (f - 1) * REM);
    }
    const boardRight = cellX[positions];

    const width = Math.ceil(boardRight + PAD);

    /* wrap the note into lines that fit the image width */
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = 0.9 * REM + 'px Karla, sans-serif';
    const noteLines = [];
    if (opts.comment) {
        for (const paragraph of opts.comment.trim().split('\n')) {
            if (!paragraph.trim()) {
                noteLines.push('');
                continue;
            }
            let line = '';
            for (const word of paragraph.trim().split(/\s+/)) {
                const tryLine = line ? line + ' ' + word : word;
                if (line && measure.measureText(tryLine).width > width - 2 * PAD) {
                    noteLines.push(line);
                    line = word;
                } else {
                    line = tryLine;
                }
            }
            if (line) {
                noteLines.push(line);
            }
        }
    }
    const NOTE_H = noteLines.length ? noteLines.length * 1.3 * REM + 0.4 * REM : 0;

    const height = Math.ceil(PAD + HEAD_H + CAPTION_H + strings * ROW + NUMBERS_H + NOTE_H + PAD);

    /* mirroring helpers for lefty mode: a point, and a rect's left edge */
    const mx = x => opts.lefty ? width - x : x;
    const rx = (x, w) => opts.lefty ? width - x - w : x;

    const canvas = document.createElement('canvas');
    const scale = 2; // crisper PNG
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* headline, same content as the page header */
    if (HEAD_H) {
        ctx.fillStyle = colors.text;
        ctx.font = 'bold ' + 1.5 * REM + 'px Karla, sans-serif';
        ctx.fillText(imgHeadline, PAD, PAD + 1.3 * REM);
        if (imgCredit) {
            ctx.fillStyle = colors.subText;
            ctx.font = 0.8 * REM + 'px Karla, sans-serif';
            ctx.fillText(imgCredit, PAD, PAD + 2.4 * REM);
        }
    }

    /* caption: what is on the board (the page's summary line) */
    if (CAPTION_H) {
        ctx.fillStyle = colors.subText;
        ctx.font = 'bold ' + 0.9 * REM + 'px Karla, sans-serif';
        ctx.fillText(opts.caption, PAD, PAD + HEAD_H + 1.1 * REM);
    }

    const top = PAD + HEAD_H + CAPTION_H;
    const bottom = top + strings * ROW;

    /* the neck's wood: from the nut to the last fret, strings-high only */
    const woodLeft = cellX[0] + NUT_W;
    ctx.fillStyle = colors.boardBg;
    ctx.fillRect(rx(woodLeft, boardRight - woodLeft), top, boardRight - woodLeft, bottom - top);

    /* inlay dots on the wood (double at 12 and 24) */
    ctx.fillStyle = colors.inlay ?? 'rgba(0, 0, 0, 0.1)';
    const inlayMid = top + strings * ROW / 2;
    const inlayOffset = Math.max(0.8, strings * 0.3) * REM;
    for (const f of opts.inlays ? DOTTED_FRETS : []) {
        if (f >= positions) {
            continue;
        }
        const dotX = mx((cellX[f] + cellX[f + 1] - WIRE) / 2);
        const ys = f % 12 === 0
            ? [inlayMid - inlayOffset, inlayMid + inlayOffset] : [inlayMid];
        for (const y of ys) {
            ctx.beginPath();
            ctx.arc(dotX, y, 0.35 * REM, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    /* strings (one per row, through the row's vertical middle) */
    ctx.fillStyle = colors.string;
    for (let r = 0; r < strings; r++) {
        ctx.fillRect(rx(cellX[0], boardRight - cellX[0]), top + r * ROW + ROW / 2 - 1,
            boardRight - cellX[0], 2);
    }

    /* nut + fret wires */
    ctx.fillStyle = colors.nut;
    ctx.fillRect(rx(cellX[0] + NUT_W, NUT_BAR), top, NUT_BAR, bottom - top);
    ctx.fillStyle = colors.wire;
    for (let f = 1; f < positions; f++) {
        ctx.fillRect(rx(cellX[f + 1] - WIRE, WIRE), top, WIRE, bottom - top);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    /* row 0 is the highest string, like the DOM board */
    const tab = opts.tab;
    const tabAll = opts.tabAll;
    for (let r = 0; r < strings; r++) {
        const stringIndex = strings - 1 - r;
        const cells = neck[stringIndex];
        const cy = top + r * ROW + ROW / 2;

        /* open-string name; an x marks strings the voicing mutes */
        const mutedString = tab && tab.frets[stringIndex] < 0;
        ctx.fillStyle = colors.boardText;
        ctx.font = 'bold ' + 0.8 * REM + 'px Karla, sans-serif';
        ctx.globalAlpha = mutedString ? 0.45 : 1;
        ctx.fillText(cells[0].note + (mutedString ? '×' : ''), mx(PAD + LABEL_W / 2), cy);
        ctx.globalAlpha = 1;

        cells.forEach((cell, f) => {
            const selected = opts.picks
                ? opts.picks.has(stringIndex + ':' + f)
                : cellIsSelected(cell, opts);
            if (!selected && !opts.showAll) {
                return;
            }
            let voicingHits = [];
            if (tabAll) {
                tabAll.forEach((voicing, v) => {
                    if (voicing.frets[stringIndex] === f) {
                        voicingHits.push(VOICING_COLORS[v % VOICING_COLORS.length]);
                    }
                });
                ctx.globalAlpha = voicingHits.length ? 1 : 0.4;
            } else {
                ctx.globalAlpha = tab && tab.frets[stringIndex] !== f ? 0.4 : 1;
            }
            const cx = mx(f === 0
                ? cellX[0] + NUT_W / 2
                : (cellX[f] + cellX[f + 1] - WIRE) / 2);
            const isRoot = cell.interval === '1';
            if (voicingHits.length > 1) {
                /* shared position: one pie wedge per voicing color */
                const step = 2 * Math.PI / voicingHits.length;
                voicingHits.forEach((color, i) => {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.arc(cx, cy, R, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step);
                    ctx.closePath();
                    ctx.fill();
                });
            } else {
                ctx.fillStyle = voicingHits[0] ?? (selected
                    ? (isRoot ? colors.rootSelected : colors.markerSelected)
                    : (isRoot ? colors.root : colors.marker));
                ctx.beginPath();
                ctx.arc(cx, cy, R, 0, 2 * Math.PI);
                ctx.fill();
            }
            ctx.fillStyle = colors.markerText;
            if (opts.mode === 'both') {
                ctx.font = 0.6 * REM + 'px Karla, sans-serif';
                ctx.fillText(cell.interval, cx, cy - 0.35 * REM);
                ctx.fillText(cell.note, cx, cy + 0.35 * REM);
            } else {
                ctx.font = 0.8 * REM + 'px Karla, sans-serif';
                ctx.fillText(opts.mode === 'notes' ? cell.note : cell.interval, cx, cy);
            }
        });
        ctx.globalAlpha = 1;
    }

    /* fret numbers */
    ctx.fillStyle = colors.boardText;
    ctx.font = 0.9 * REM + 'px Karla, sans-serif';
    for (const f of DOTTED_FRETS) {
        if (f < positions) {
            ctx.fillText(f, mx((cellX[f] + cellX[f + 1] - WIRE) / 2), bottom + NUMBERS_H / 2);
        }
    }

    /* the user's comment below the board */
    if (noteLines.length) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = colors.subText;
        ctx.font = 0.9 * REM + 'px Karla, sans-serif';
        noteLines.forEach((line, i) => {
            ctx.fillText(line, PAD, bottom + NUMBERS_H + (i + 1) * 1.3 * REM);
        });
    }

    return canvas;
}
