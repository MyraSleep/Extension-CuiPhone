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

/** Inject inner phone CSS once (scoped under #cui-phone-root). */
function injectInnerCss() {
    if (document.getElementById('cui-phone-inner-css')) return;
    const link = document.createElement('link');
    link.id = 'cui-phone-inner-css';
    link.rel = 'stylesheet';
    link.href = `${EXT_PATH}/phone-inner.css`;
    document.head.appendChild(link);
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

    injectInnerCss();
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

    // Open / close
    const toggle = () => root.classList.toggle('cui-collapsed');
    root.querySelector('#cui-phone-fab').onclick = toggle;
    root.querySelector('#cui-phone-close').onclick = () => root.classList.add('cui-collapsed');
    if (!settings.startCollapsed) root.classList.remove('cui-collapsed');

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
