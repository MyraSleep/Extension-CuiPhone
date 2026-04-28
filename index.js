/* =====================================================================
 * CUI Phone — extension entry point
 * ---------------------------------------------------------------------
 * Mounts an in-page floating phone panel into SillyTavern, loads the
 * original clean-HTML phone UI, and wires it to ST's chat data.
 * ===================================================================== */

import { mountPhoneUI } from './phone.js';
import { wireSTBridge } from './st-bridge.js';

const MODULE_NAME = 'cui_phone';

/** Resolve the extension's own base URL at runtime, no matter where it's installed. */
const EXT_PATH = (() => {
    try {
        // import.meta.url is the absolute URL of THIS file (index.js).
        // Strip the filename to get the directory.
        const u = new URL('.', import.meta.url);
        return u.pathname.replace(/\/$/, '');
    } catch (e) {
        // Fallback for older bundlers that don't expose import.meta
        return '/scripts/extensions/third-party/Extension-CuiPhone';
    }
})();
console.log('[CUI Phone] EXT_PATH =', EXT_PATH);

/** Inject inner phone CSS once (scoped under #cui-phone-root).
 *  Uses fetch+<style> rather than <link> so we can see the failure mode
 *  loudly (404 -> visible error in console + on-screen banner) and so the
 *  styles survive any path/serving quirk where ST doesn't expose the file
 *  via the static route.
 */
async function injectInnerCss() {
    if (document.getElementById('cui-phone-inner-css')) return;
    const url = `${EXT_PATH}/phone-inner.css`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
        const cssText = await resp.text();
        const style = document.createElement('style');
        style.id = 'cui-phone-inner-css';
        style.textContent = cssText;
        document.head.appendChild(style);
        console.log('[CUI Phone] phone-inner.css inlined,', cssText.length, 'bytes');
    } catch (e) {
        console.error('[CUI Phone] Failed to load phone-inner.css from', url, e);
        // Fallback: try a <link> too, in case fetch was blocked but link works.
        const link = document.createElement('link');
        link.id = 'cui-phone-inner-css';
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
    }
}

/** Build the floating root skeleton.
 *  v2 layout: no outer panel/handle. Just FAB + a transparent shell that hosts
 *  the phone UI directly, plus a tiny floating close button.
 */
function buildRoot() {
    if (document.getElementById('cui-phone-root')) {
        return document.getElementById('cui-phone-root');
    }
    const root = document.createElement('div');
    root.id = 'cui-phone-root';
    root.className = 'cui-phone-root cui-collapsed';
    // Inline fallback styles so the FAB is always visible even if style.css
    // didn't load (e.g. cache miss, manifest css line ignored, etc.).
    root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9998;';
    root.innerHTML = `
        <button class="cui-phone-fab" id="cui-phone-fab" title="Phone"
            style="width:52px;height:52px;border-radius:50%;border:none;background:linear-gradient(135deg,#0a84ff,#6228d7);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 12px 32px rgba(15,23,42,.35);display:grid;place-items:center;">📱</button>
        <div class="cui-phone-shell">
            <button class="cui-phone-close" id="cui-phone-close" title="Close">✕</button>
            <div class="cui-phone-mount" id="cui-phone-mount"></div>
        </div>
    `;
    document.body.appendChild(root);
    return root;
}

/** Try to register a /phone slash command across multiple ST API versions.
 *  This is best-effort; failure is silent so the main feature still works.
 *  NOTE: slash command API has shifted over ST versions — this needs to be
 *  verified against your installed version.
 */
function registerPhoneCommand(toggle) {
    try {
        const ctx = SillyTavern.getContext();
        // Newer API (SlashCommand / SlashCommandParser)
        if (ctx.SlashCommandParser && ctx.SlashCommand) {
            const cmd = ctx.SlashCommand.fromProps({
                name: 'phone',
                callback: () => { toggle(); return ''; },
                helpString: 'Toggle the CUI Phone panel.',
            });
            ctx.SlashCommandParser.addCommandObject(cmd);
            console.log('[CUI Phone] /phone slash command registered (new API).');
            return;
        }
        // Legacy API
        if (typeof ctx.registerSlashCommand === 'function') {
            ctx.registerSlashCommand('phone', () => { toggle(); return ''; }, [],
                'Toggle the CUI Phone panel.', true, true);
            console.log('[CUI Phone] /phone slash command registered (legacy API).');
            return;
        }
        console.warn('[CUI Phone] No known slash command API found; skipping.');
    } catch (e) {
        console.warn('[CUI Phone] Slash command registration failed:', e);
    }
}

/** Persistent extension settings (global preferences). */
function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = {
            startCollapsed: true,
            defaultPanel: 'kkt', // 'kkt' or 'ins'
        };
    }
    return extensionSettings[MODULE_NAME];
}

(async function init() {
    // Wait for SillyTavern global to be available
    if (typeof SillyTavern === 'undefined' || !SillyTavern.getContext) {
        console.warn('[CUI Phone] SillyTavern context not ready; aborting.');
        return;
    }

    const ctx = SillyTavern.getContext();
    const settings = getSettings();

    await injectInnerCss();
    const root = buildRoot();

    // Load HTML fragment
    let html;
    try {
        const resp = await fetch(`${EXT_PATH}/phone.html`);
        html = await resp.text();
    } catch (e) {
        console.error('[CUI Phone] Failed to load phone.html:', e);
        return;
    }

    const mount = root.querySelector('#cui-phone-mount');
    mount.innerHTML = html;

    // Boot the original phone UI script
    try {
        mountPhoneUI(mount);
    } catch (e) {
        console.error('[CUI Phone] mountPhoneUI failed:', e);
    }

    // ---- FAB drag + open-near-FAB positioning ----
    const FAB_POS_KEY = 'cuiphone:fab_pos';
    const fab = root.querySelector('#cui-phone-fab');
    const shell = root.querySelector('.cui-phone-shell');

    function loadFabPos() {
        try {
            const p = JSON.parse(localStorage.getItem(FAB_POS_KEY) || 'null');
            if (p && typeof p.left === 'number' && typeof p.top === 'number') return p;
        } catch (_) {}
        return null;
    }
    function saveFabPos(left, top) {
        try { localStorage.setItem(FAB_POS_KEY, JSON.stringify({ left, top })); } catch (_) {}
    }
    function clampFabPos(p) {
        // Keep at least the FAB visible inside the viewport.
        const fw = fab.offsetWidth || 52;
        const fh = fab.offsetHeight || 52;
        const left = Math.max(0, Math.min(window.innerWidth - fw, p.left));
        const top = Math.max(0, Math.min(window.innerHeight - fh, p.top));
        return { left, top };
    }
    function applyFabPos(p) {
        if (!p) return;
        fab.style.left = p.left + 'px';
        fab.style.top = p.top + 'px';
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
    }
    function positionPhoneNearFab() {
        // The phone-shell renders at PHONE_W x PHONE_H * --cui-scale.
        // We anchor it to whichever corner of the viewport the FAB currently
        // sits closest to — phone visually grows out from that corner.
        const r = fab.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        const onRight = (r.left + r.width / 2) > vw / 2;
        const onBottom = (r.top + r.height / 2) > vh / 2;

        // Anchor to the FAB's nearest corner. The phone overlays the FAB
        // (no gap) so 底部到 FAB 不会再有空隙.
        if (onRight) {
            shell.style.right = Math.max(0, vw - r.right) + 'px';
            shell.style.left = 'auto';
        } else {
            shell.style.left = Math.max(0, r.left) + 'px';
            shell.style.right = 'auto';
        }
        if (onBottom) {
            shell.style.bottom = Math.max(0, vh - r.bottom) + 'px';
            shell.style.top = 'auto';
        } else {
            shell.style.top = Math.max(0, r.top) + 'px';
            shell.style.bottom = 'auto';
        }
        shell.style.transformOrigin = (onBottom ? 'bottom ' : 'top ') + (onRight ? 'right' : 'left');
    }

    // Restore stored FAB position (if any) on startup.
    const savedFab = loadFabPos();
    if (savedFab) applyFabPos(clampFabPos(savedFab));

    // Pointer-based drag (works for mouse + touch + pen).
    let dragging = false, didMove = false, sx = 0, sy = 0, ox = 0, oy = 0;
    fab.addEventListener('pointerdown', (e) => {
        // Left mouse button only; touch/pen always pass.
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        didMove = false;
        const rect = fab.getBoundingClientRect();
        sx = e.clientX; sy = e.clientY;
        ox = rect.left; oy = rect.top;
        try { fab.setPointerCapture(e.pointerId); } catch (_) {}
        fab.classList.add('dragging');
    });
    fab.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!didMove && (Math.abs(dx) + Math.abs(dy) > 4)) didMove = true;
        if (!didMove) return;
        const fw = fab.offsetWidth || 52;
        const fh = fab.offsetHeight || 52;
        const nx = Math.max(0, Math.min(window.innerWidth - fw, ox + dx));
        const ny = Math.max(0, Math.min(window.innerHeight - fh, oy + dy));
        fab.style.left = nx + 'px';
        fab.style.top = ny + 'px';
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
    });
    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        fab.classList.remove('dragging');
        if (didMove) {
            const rect = fab.getBoundingClientRect();
            saveFabPos(rect.left, rect.top);
        }
        try { if (e && e.pointerId != null) fab.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', endDrag);

    // Open / close. After a drag, swallow the click so the phone doesn't toggle.
    const toggle = () => {
        if (root.classList.contains('cui-collapsed')) {
            positionPhoneNearFab();
            root.classList.remove('cui-collapsed');
        } else {
            root.classList.add('cui-collapsed');
        }
    };
    fab.addEventListener('click', (e) => {
        if (didMove) { e.preventDefault(); e.stopPropagation(); didMove = false; return; }
        toggle();
    });
    root.querySelector('#cui-phone-close').onclick = () => root.classList.add('cui-collapsed');

    // Re-clamp FAB on viewport resize so it never escapes off-screen.
    window.addEventListener('resize', () => {
        const cur = loadFabPos();
        if (cur) applyFabPos(clampFabPos(cur));
        if (!root.classList.contains('cui-collapsed')) positionPhoneNearFab();
    });

    if (!settings.startCollapsed) {
        positionPhoneNearFab();
        root.classList.remove('cui-collapsed');
    }

    // ---- Auto-fit + user-adjustable scale ----
    // Native phone-shell size is 390 x 844. We must fit it inside
    //   width-budget = innerWidth - 32   (margins)
    //   height-budget = innerHeight - 96  (FAB + margins)
    // and then multiply by the user's preferred scale (default 1, range 0.5..1.6).
    const PHONE_W = 390, PHONE_H = 844;
    const SCALE_KEY = 'cuiphone:user_scale';
    let userScale = 1;
    try {
        const saved = parseFloat(localStorage.getItem(SCALE_KEY) || '');
        if (!isNaN(saved) && saved > 0) userScale = Math.max(0.5, Math.min(1.6, saved));
    } catch(_){}

    function recomputeScale() {
        // Phone is open in place of the FAB now, so the height budget is the
        // entire viewport minus a small safety margin.
        const fitW = (window.innerWidth - 32) / PHONE_W;
        const fitH = (window.innerHeight - 32) / PHONE_H;
        const fit = Math.min(1, fitW, fitH);   // never enlarge past native size
        const final = Math.max(0.4, fit * userScale);
        root.style.setProperty('--cui-scale', final.toFixed(3));
    }
    recomputeScale();
    window.addEventListener('resize', recomputeScale);

    function applyUserScale(s) {
        userScale = Math.max(0.5, Math.min(1.6, s));
        try { localStorage.setItem(SCALE_KEY, String(userScale)); } catch(_){}
        recomputeScale();
    }
    root.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        applyUserScale(userScale + (e.deltaY < 0 ? 0.05 : -0.05));
    }, { passive: false });

    window.CuiPhone = window.CuiPhone || {};
    window.CuiPhone.setScale = applyUserScale;
    window.CuiPhone.getScale = () => userScale;
    window.CuiPhone.recomputeScale = recomputeScale;

    // Wire ST <-> phone (chat sync, send-back, events)
    try {
        wireSTBridge(ctx, window.CuiPhone);
    } catch (e) {
        console.error('[CUI Phone] wireSTBridge failed:', e);
    }

    // /phone command
    registerPhoneCommand(toggle);

    console.log('[CUI Phone] Loaded. Click the 📱 FAB or run /phone to toggle.');
})();
