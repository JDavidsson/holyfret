/* A minimal searchable dropdown: a text input with a menu that shows
 * every option on click and narrows as you type. No dependencies.
 *
 * makeCombobox(input, getOptions, commit)
 *   input:      the <input> element to enhance
 *   getOptions: () -> array of option names (called on every open,
 *               so the list may change between opens)
 *   commit:     called with the chosen/matched name, or null when the
 *               text matches nothing — the caller decides what a null
 *               commit means (revert, clear, ...)
 */

/* typed text -> a canonical option name, or null;
 * exact match first, otherwise a unique substring match */
function matchName(text, names) {
    const t = text.trim().toLowerCase();
    if (!t) {
        return null;
    }
    const exact = names.find(n => n.toLowerCase() === t);
    if (exact) {
        return exact;
    }
    const partial = names.filter(n => n.toLowerCase().includes(t));
    return partial.length === 1 ? partial[0] : null;
}

/* width of the widest string in the input's font, in px */
const measureCtx = document.createElement('canvas').getContext('2d');
function widestText(input, texts) {
    measureCtx.font = getComputedStyle(input).font;
    return Math.max(...texts.map(t => measureCtx.measureText(t).width), 0);
}

function makeCombobox(input, getOptions, commit) {

    const wrap = document.createElement('span');
    wrap.className = 'combobox';
    input.replaceWith(wrap);
    wrap.appendChild(input);

    /* size the box to its longest option (plus room for the arrow),
     * re-checked on open since option lists can change */
    function sizeToOptions() {
        const texts = [...getOptions(), input.placeholder || ''];
        input.style.width = Math.ceil(widestText(input, texts)) + 34 + 'px';
    }
    sizeToOptions();

    const menu = document.createElement('div');
    menu.className = 'combobox-menu';
    menu.hidden = true;
    wrap.appendChild(menu);

    let items = [];
    let active = -1;

    function open(filter) {
        sizeToOptions();
        const t = filter.trim().toLowerCase();
        items = getOptions().filter(n => n.toLowerCase().includes(t));
        active = -1;
        menu.replaceChildren();
        items.forEach(name => {
            const item = document.createElement('div');
            item.className = 'combobox-item';
            item.textContent = name;
            if (name === input.value) {
                item.classList.add('selected');
            }
            /* mousedown (not click) so the pick wins over the input's blur */
            item.addEventListener('mousedown', event => {
                event.preventDefault();
                choose(name);
            });
            menu.appendChild(item);
        });
        menu.hidden = items.length === 0;
    }

    function close() {
        menu.hidden = true;
        active = -1;
    }

    function choose(name) {
        input.value = name;
        close();
        commit(name);
    }

    function moveActive(step) {
        if (items.length === 0) {
            return;
        }
        active = (active + step + items.length) % items.length;
        [...menu.children].forEach((el, i) => el.classList.toggle('active', i === active));
        menu.children[active].scrollIntoView({ block: 'nearest' });
    }

    /* show the full list on focus/click, even when the box has text —
     * typing is what narrows it down */
    input.addEventListener('focus', () => {
        input.select();
        open('');
    });
    input.addEventListener('click', () => {
        if (menu.hidden) {
            open('');
        }
    });
    input.addEventListener('input', () => open(input.value));

    input.addEventListener('blur', () => {
        close();
        commit(matchName(input.value, getOptions()));
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (menu.hidden) {
                open(input.value);
            }
            moveActive(event.key === 'ArrowDown' ? 1 : -1);
            event.preventDefault();
        } else if (event.key === 'Enter') {
            if (!menu.hidden && active >= 0) {
                choose(items[active]);
            } else {
                close();
                commit(matchName(input.value, getOptions()));
            }
            event.preventDefault();
        } else if (event.key === 'Escape') {
            close();
        }
    });
}
