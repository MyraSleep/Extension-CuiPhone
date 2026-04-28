/* =====================================================================
 * CUI Phone — SillyTavern <-> Phone bridge
 * ---------------------------------------------------------------------
 * Reads ST's current character + chat and pushes them into the phone UI
 * via CuiPhone.refreshFromST(). Also exposes CuiPhone.sendToST(text)
 * which mirrors a phone-side message into ST's main composer and sends.
 * ===================================================================== */

/**
 * Resolve a usable avatar URL from a character object.
 * NOTE: The exact path scheme has changed across ST versions — this needs
 * to be verified against your installed version. We try common patterns.
 */
function resolveAvatarUrl(character) {
    if (!character) return '';
    const file = character.avatar;
    if (!file || file === 'none') return '';
    // Most common in modern ST: thumbnail endpoint
    return `/thumbnail?type=avatar&file=${encodeURIComponent(file)}`;
}

/** Convert ST chat message -> phone-friendly shape. */
function normalizeMessage(m, characterName) {
    return {
        from: m.is_user ? 'me' : (m.name || characterName || 'them'),
        is_user: !!m.is_user,
        text: typeof m.mes === 'string' ? m.mes : String(m.mes ?? ''),
        time: m.send_date || '',
    };
}

export function wireSTBridge(ctx, phone) {
    if (!phone) {
        console.warn('[CUI Phone] window.CuiPhone is not ready; bridge skipped.');
        return;
    }

    const { eventSource, event_types } = ctx;

    // Read current character (always fresh — characterId is just an index).
    const getCurrentCharacter = () => {
        const c = SillyTavern.getContext();
        const idx = c.characterId;
        const ch = (idx != null) ? c.characters?.[idx] : null;
        if (!ch) return null;
        return {
            name: ch.name,
            avatar: resolveAvatarUrl(ch),
            description: ch.description || '',
        };
    };

    const getCurrentChat = () => {
        const c = SillyTavern.getContext();
        const character = getCurrentCharacter();
        return (c.chat || []).map(m => normalizeMessage(m, character?.name));
    };

    const sync = () => {
        try {
            phone.refreshFromST?.({
                character: getCurrentCharacter(),
                chat: getCurrentChat(),
            });
        } catch (e) {
            console.error('[CUI Phone] refreshFromST failed:', e);
        }
    };

    // Initial sync
    sync();

    // Subscribe to all relevant events
    const events = [
        'CHAT_CHANGED',
        'MESSAGE_RECEIVED',
        'MESSAGE_SENT',
        'MESSAGE_EDITED',
        'MESSAGE_DELETED',
        'MESSAGE_SWIPED',
        'CHARACTER_MESSAGE_RENDERED',
        'USER_MESSAGE_RENDERED',
    ];
    for (const key of events) {
        const t = event_types?.[key];
        if (t) {
            try { eventSource.on(t, sync); } catch (e) { /* ignore */ }
        }
    }

    /**
     * Send a message from the phone UI into ST.
     * Strategy: write into ST's main textarea + click the send button.
     * This is intentionally low-level so it works across versions.
     * NOTE: If your ST exposes a stable Generate() / sendMessageAsUser(),
     * prefer that. Verify against your installed version.
     */
    phone.sendToST = async (text) => {
        if (!text || !text.trim()) return;
        const ta = document.querySelector('#send_textarea');
        const btn = document.querySelector('#send_but');
        if (!ta || !btn) {
            console.warn('[CUI Phone] ST composer not found.');
            return;
        }
        ta.value = text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        // Some versions need a microtask before click registers properly
        await Promise.resolve();
        btn.click();
    };

    // Expose helpers for debugging
    phone._st = { getCurrentCharacter, getCurrentChat, sync };
    console.log('[CUI Phone] ST bridge wired.');
}
