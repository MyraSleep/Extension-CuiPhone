# CUI Phone — SillyTavern Extension

A floating in-page phone UI (iOS shell + KakaoTalk + Instagram) that mirrors
your current SillyTavern character and chat. Works as a same-layer panel —
no iframe, no popup window, no QR codes.

## Install

1. Drop this whole `Extension-CuiPhone` folder into:

   ```
   SillyTavern/data/<your-user-handle>/extensions/third-party/Extension-CuiPhone/
   ```

   (That folder is also reachable as `/scripts/extensions/third-party/Extension-CuiPhone`
   when ST serves over HTTP — paths in the code rely on that.)

2. Restart SillyTavern (or refresh the browser tab).

3. Open the **Extensions** panel → enable **CUI Phone**.

4. A floating 📱 button appears at the bottom-right. Click to toggle the
   phone panel. You can also run `/phone` if your ST version supports
   slash command registration.

## What it does

- Reads `SillyTavern.getContext().chat` and the current character on every
  ST chat event (`MESSAGE_RECEIVED`, `CHAT_CHANGED`, `MESSAGE_SENT`,
  `MESSAGE_EDITED`, `MESSAGE_DELETED`, `MESSAGE_SWIPED`) and projects
  them into the KakaoTalk thread of the first room.
- When you type into the phone's KKT input and press send, it writes the
  text into ST's main `#send_textarea` and clicks `#send_but`. ST handles
  generation, character cards, and persistence — the phone is just a skin.
- All ST chat history is the source of truth. The phone never owns data
  on its own, so you can't get out of sync.

## File map

| File              | Role                                                          |
| ----------------- | ------------------------------------------------------------- |
| `manifest.json`   | ST extension metadata                                         |
| `index.js`        | Boot: builds floating root, loads HTML, wires bridge          |
| `style.css`       | Outer container styles (FAB, panel, drag handle)              |
| `phone.html`      | Original phone-shell HTML fragment                            |
| `phone-inner.css` | Original phone CSS, every selector scoped to `#cui-phone-root`|
| `phone.js`        | Original phone JS, wrapped as `mountPhoneUI(root)` ES module  |
| `st-bridge.js`    | ST `getContext()` ↔ phone state synchronizer                  |

## Known caveats (verify against your ST version)

- **Slash command API** has changed across versions; `index.js` tries the
  new `SlashCommandParser.addCommandObject` first and falls back to the
  legacy `registerSlashCommand`. If neither exists the FAB still works.
- **Character avatar URL** uses `/thumbnail?type=avatar&file=...`. Some
  builds expose the file directly under `/characters/`. Adjust
  `resolveAvatarUrl()` in `st-bridge.js` if avatars don't load.
- **sendToST()** writes to `#send_textarea` and clicks `#send_but` — this
  works across versions but is intentionally low-level. If you have a
  stable `Generate()` / `sendMessageAsUser()` exposed in your build,
  prefer that.
- All inner CSS is scoped under `#cui-phone-root`, so the phone shouldn't
  bleed into ST's main UI. If you ever notice global CSS leakage, check
  `phone-inner.css` — `:root` was rewritten to `#cui-phone-root` and
  `html, body` rules were dropped on purpose.

## Persisting state (optional next step)

`extensionSettings[MODULE_NAME]` is initialized in `index.js` for global
prefs (start collapsed, default panel). For per-chat state (custom room
names, avatars), use `SillyTavern.getContext().chatMetadata['cui_phone']`
and call `saveMetadata()`.
