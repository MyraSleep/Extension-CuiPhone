/* =====================================================================
 * CUI Phone — SillyTavern <-> Phone bridge
 * ---------------------------------------------------------------------
 * Listens to ST chat events. On every change it scans ALL chat messages
 * for <kakao_chat> / <ins_feed> / <ins_story> / <user_profile> blocks,
 * concatenates the matches, and pushes them into the phone UI via
 * CuiPhone.applyImport().
 *
 * Rationale: the worldbook instructs the LLM to wrap KKT and INS output
 * in those tags. The phone is a renderer for those tags — not a literal
 * mirror of the chat log.
 * ===================================================================== */

const BLOCK_PATTERNS = [
    /<kakao_chat>[\s\S]*?<\/kakao_chat>/g,
    /<ins_feed>[\s\S]*?<\/ins_feed>/g,
    /<ins_story>[\s\S]*?<\/ins_story>/g,
    /<user_profile>[\s\S]*?<\/user_profile>/g,
];

/** Resolve a usable avatar URL from a character object. */
function resolveAvatarUrl(character) {
    if (!character) return '';
    const file = character.avatar;
    if (!file || file === 'none') return '';
    return `/thumbnail?type=avatar&file=${encodeURIComponent(file)}`;
}

/** Pull all matching wrapped blocks out of the chat log, in order. */
function extractBlocksFromChat(chat) {
    if (!Array.isArray(chat) || !chat.length) return '';
    const pieces = [];
    for (const m of chat) {
        const text = typeof m?.mes === 'string' ? m.mes : '';
        if (!text) continue;
        for (const re of BLOCK_PATTERNS) {
            const found = text.match(re);
            if (found) pieces.push(...found);
        }
    }
    return pieces.join('\n\n');
}

/**
 * Auto-detect the most recent room/chat to focus.
 * If the latest LLM message contains a <kakao_chat>, jump to that room.
 */
function pickActivePanel(chat) {
    if (!Array.isArray(chat)) return null;
    for (let i = chat.length - 1; i >= 0; i--) {
        const t = chat[i]?.mes || '';
        if (/<kakao_chat>/.test(t)) return 'kkt';
        if (/<ins_story>/.test(t)) return 'story';
        if (/<ins_feed>/.test(t)) return 'feed';
    }
    return null;
}

export function wireSTBridge(ctx, phone) {
    if (!phone) {
        console.warn('[CUI Phone] window.CuiPhone is not ready; bridge skipped.');
        return;
    }
    const { eventSource, event_types } = ctx;

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

    const sync = () => {
        try {
            const c = SillyTavern.getContext();
            const chat = c.chat || [];
            const importText = extractBlocksFromChat(chat);
            const character = getCurrentCharacter();

            if (importText) {
                // Reset rooms list before applying so old <kakao_chat> data
                // from previous chats doesn't linger.
                phone.state.rooms = [];
                phone.state.threads = {};
                phone.applyImport(importText);

                // If the parsed rooms have no avatar, fall back to ST character avatar
                if (character && phone.state.rooms.length) {
                    for (const room of phone.state.rooms) {
                        if (!room.avatar && room.name === character.name) {
                            phone.state.roomIdentity[room.id] = {
                                name: character.name,
                                avatar: character.avatar,
                            };
                        }
                    }
                    phone.renderChatList?.();
                    phone.renderThread?.();
                }

                // Auto-jump to the panel that was just produced
                const target = pickActivePanel(chat);
                if (target === 'kkt') phone.switchKktPanel?.('list');
                if (target === 'feed') phone.switchInsPanel?.('feed');
                if (target === 'story') phone.switchInsPanel?.('story');
            } else {
                // No wrapped blocks anywhere — show empty state
                phone.state.rooms = [];
                phone.state.threads = {};
                phone.state.stories = [];
                phone.state.posts = [];
                phone.renderChatList?.();
                phone.renderThread?.();
            }
        } catch (e) {
            console.error('[CUI Phone] sync failed:', e);
        }
    };

    // Initial sync (in case chat is already populated when extension loads)
    setTimeout(sync, 200);

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
     * Send a message from the phone UI into ST's main composer.
     * Strategy: write into #send_textarea + click #send_but. Works across
     * recent ST versions; verify against your installed version if needed.
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
        await Promise.resolve();
        btn.click();
    };

    // Manual refresh helper (handy in DevTools)
    phone.forceSync = sync;
    phone._st = { getCurrentCharacter, extractBlocksFromChat, sync };

    console.log('[CUI Phone] ST bridge wired (auto-detects <kakao_chat>/<ins_feed>/<ins_story>).');
}
