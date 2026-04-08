# Anforderungsdokument — Dice Game React Rewrite

## Einleitung

Neuimplementierung der bestehenden Vanilla-JS Dice Game PWA (`dice-game-pwa/`) als React-Anwendung im Verzeichnis `dice-game-react/`. Die App nutzt das CSS Design System aus `design-system/` mit adaptiven Klassen und `data-*` Attributen. Wiederverwendbare, UI-unabhängige Module aus `dice-game-pwa/js/` (Spiellogik, Würfel-Engine, Multiplayer, i18n) werden direkt importiert statt neu geschrieben.

## Glossar

- **React_App**: Die neue React-Anwendung im Verzeichnis `dice-game-react/`
- **Design_System**: Das CSS-basierte Design System in `design-system/`, bestehend aus `foundation.css`, Komponenten-CSS, Modul-CSS und Template-CSS
- **Adaptive_Klasse**: Die CSS-Klasse `.adaptive` aus dem Design System, die als Basis für alle visuellen Elemente dient
- **Data_Attribute**: HTML-Attribute wie `data-color`, `data-material`, `data-size`, `data-interactive`, `data-emphasis`, `data-mode`, `data-container-contrast`, `data-content-contrast`, die das visuelle Verhalten steuern
- **Dice_Engine**: Das Modul `dice-game-pwa/js/dice/dice-engine.js` für kryptografisch sichere Würfelwurf-Logik
- **Game_Engine**: Das Modul `dice-game-pwa/js/game/game-engine.js` für die Spielablauf-Steuerung
- **Game_Mode_Registry**: Das Modul `dice-game-pwa/js/game/game-mode-registry.js` für die Verwaltung registrierter Spielmodi
- **Dice_Renderer**: Das Three.js-basierte 3D-Würfel-Rendering-Modul `dice-game-pwa/js/dice/dice-renderer.js`
- **Motion_System**: Das Animations-Modul `dice-game-pwa/js/motion/motion-system.js` basierend auf motion.dev
- **I18n_System**: Das Lokalisierungsmodul `dice-game-pwa/js/i18n.js`
- **Game_Store**: Das IndexedDB/localStorage-Persistenzmodul `dice-game-pwa/js/store/game-store.js`
- **WebRTC_Peer**: Das WebRTC-Peer-Modul `dice-game-pwa/js/multiplayer/webrtc-peer.js` für P2P-Verbindungen
- **Offline_Game_Controller**: Das Modul `dice-game-pwa/js/multiplayer/offline-game-controller.js` für die Spielsteuerung über den DataChannel
- **SDP_Payload**: Das Modul `dice-game-pwa/js/multiplayer/sdp-payload.js` für die Serialisierung von SDP-Daten
- **QR_Code_Modul**: Das Modul `dice-game-pwa/js/multiplayer/qr-code.js` für QR-Code-Generierung und -Scanning
- **Screen**: Eine Bildschirmansicht der App (Home, Game, Lobby, Result)
- **Kniffel_Modus**: Der Yahtzee/Kniffel-Spielmodus mit 13 Kategorien, 5 Würfeln und 3 Würfen pro Runde
- **Free_Roll_Modus**: Der freie Würfelmodus ohne Regelbeschränkungen

## Anforderungen

### Anforderung 1: Projekt-Setup und Build-Konfiguration

**User Story:** Als Entwickler möchte ich ein korrekt konfiguriertes React-Projekt in `dice-game-react/`, damit ich die App entwickeln und bauen kann.

#### Akzeptanzkriterien

1. THE React_App SHALL use React 18+ with Vite as the build tool in the `dice-game-react/` directory
2. THE React_App SHALL import the Design_System CSS files (`foundation.css`, component CSS, module CSS) via relative paths from `design-system/`
3. THE React_App SHALL import reusable logic modules from `dice-game-pwa/js/` via relative paths without duplicating the source code
4. THE React_App SHALL include a `manifest.json` for PWA support with app name, icons, and display mode
5. THE React_App SHALL include a service worker for offline caching of static assets

### Anforderung 2: Design-System-Integration mit Adaptive-Klassen und Data-Attributen

**User Story:** Als Entwickler möchte ich das bestehende CSS Design System korrekt in React-Komponenten nutzen, damit die App visuell konsistent ist.

#### Akzeptanzkriterien

1. THE React_App SHALL apply the `adaptive` CSS class to all visual React elements that render UI
2. THE React_App SHALL use `data-color`, `data-material`, `data-size`, `data-emphasis`, `data-mode`, `data-interactive`, `data-container-contrast`, and `data-content-contrast` attributes to control component appearance
3. THE React_App SHALL rely on CSS inheritance for `data-size`, `data-color`, `data-material`, `data-emphasis`, and `data-mode` attributes from parent elements
4. THE React_App SHALL set `data-interactive` explicitly on each interactive element (buttons, clickable cards, toggles)
5. THE React_App SHALL set `data-container-contrast` and `data-content-contrast` explicitly where needed, as these attributes do not inherit
6. THE React_App SHALL use Lucide React icons with the `icon` CSS class, inheriting color from `--db-visual` via `currentColor`
7. THE React_App SHALL use layout spacing tokens (`--layout-spacing`, `--layout-spacing-min`, `--layout-spacing-max`) for spacing between independent components
8. THE React_App SHALL use component spacing tokens (`--size-padding`, `--size-gap-min`, `--size-gap-max`) for spacing within components

### Anforderung 3: Hash-basiertes Routing und Screen-Navigation

**User Story:** Als Nutzer möchte ich zwischen den Screens (Home, Lobby, Game, Result) navigieren können, damit ich den Spielfluss durchlaufen kann.

#### Akzeptanzkriterien

1. THE React_App SHALL implement hash-based routing with the routes `#home`, `#lobby`, `#game`, and `#result`
2. WHEN no hash is present in the URL, THE React_App SHALL navigate to the `#home` route
3. WHEN the route changes, THE React_App SHALL unmount the previous screen and mount the new screen with a fade transition using the Motion_System
4. WHEN a new screen mounts, THE React_App SHALL move focus to the first heading or first focusable element in the new screen
5. THE React_App SHALL support route parameters encoded as query strings (e.g. `#game?modeId=kniffel&playType=solo`)
6. WHEN a deep-link route `#join` with an `sdp` parameter is accessed, THE React_App SHALL redirect to the lobby screen with `role=client` and the SDP data
7. WHEN a deep-link route `#answer` with an `sdp` parameter is accessed, THE React_App SHALL redirect to the lobby screen with `role=host` and the answer SDP data

### Anforderung 4: Home Screen — Spielmodus-Auswahl

**User Story:** Als Nutzer möchte ich auf dem Startbildschirm einen Spielmodus auswählen, damit ich ein Spiel starten kann.

#### Akzeptanzkriterien

1. THE React_App SHALL display all registered game modes from the Game_Mode_Registry as selectable cards on the home screen
2. WHEN the user selects the Free_Roll_Modus, THE React_App SHALL navigate directly to the game screen with `playType=solo`
3. WHEN the user selects the Kniffel_Modus, THE React_App SHALL open a modal dialog with play-type options (Solo, Lokal, Offline-Multiplayer, Spiel beitreten)
4. WHEN the user selects "Solo" or "Lokal" in the dialog, THE React_App SHALL open a player setup dialog with name inputs and a player count picker (for Lokal mode)
5. WHEN the user selects "Offline-Multiplayer", THE React_App SHALL navigate to the lobby screen with `role=host`
6. WHEN the user selects "Spiel beitreten", THE React_App SHALL navigate to the lobby screen with `role=client`
7. THE React_App SHALL display a highscore list of the top 5 scores from finished games stored in the Game_Store
8. WHEN the user presses Escape or clicks the backdrop, THE React_App SHALL close the open modal dialog

### Anforderung 5: Game Screen — Würfelbereich und Spielsteuerung

**User Story:** Als Nutzer möchte ich auf dem Spielbildschirm würfeln, Würfel halten und Punkte vergeben können, damit ich das Spiel spielen kann.

#### Akzeptanzkriterien

1. THE React_App SHALL render the 3D dice area using the existing Dice_Renderer module within a React component
2. WHEN the user clicks the roll button, THE React_App SHALL call the Game_Engine roll method and animate the dice via the Dice_Renderer
3. WHEN the user clicks a die in the 3D area, THE React_App SHALL toggle the hold state of that die via the Game_Engine
4. WHILE the game mode has a roll limit (e.g. Kniffel_Modus with 3 rolls), THE React_App SHALL display the current roll count and disable the roll button when the limit is reached
5. WHEN the game mode is Free_Roll_Modus, THE React_App SHALL display a dice count selector (1–6) and allow changing the number of dice mid-game
6. THE React_App SHALL display a player bar showing all players with avatar, name, and score, with the active player highlighted
7. WHEN a roll occurs, THE React_App SHALL announce the dice result to screen readers via an ARIA live region using the Dice Announcer
8. WHEN a roll occurs, THE React_App SHALL trigger haptic feedback via `navigator.vibrate(50)` if available
9. THE React_App SHALL provide a horizontal scroll-snap layout with a dice page and a scoreboard page for the Kniffel_Modus
10. WHEN the last roll of a turn is used in Kniffel_Modus, THE React_App SHALL auto-scroll to the scoreboard page after the dice animation completes

### Anforderung 6: Scoreboard — Kniffel-Punktetabelle

**User Story:** Als Nutzer möchte ich die Kniffel-Punktetabelle sehen und Kategorien auswählen können, damit ich meine Punkte vergeben kann.

#### Akzeptanzkriterien

1. WHILE the game mode is Kniffel_Modus, THE React_App SHALL display a scoreboard with all 13 Kniffel categories, upper bonus row, section totals, and grand total
2. THE React_App SHALL display columns for each player, with the active player's column visually highlighted
3. WHEN the current player has rolled at least once, THE React_App SHALL display potential scores for all open categories as clickable rows
4. WHEN the user clicks a category row, THE React_App SHALL apply the score via the Game_Engine and advance to the next turn
5. WHEN a category is already filled, THE React_App SHALL display the scored value with `data-material="inverted"` and `data-container-contrast="max"` styling
6. WHILE the game mode is Free_Roll_Modus, THE React_App SHALL display only the dice sum after rolling instead of a full scoreboard

### Anforderung 7: Spielzustand-Persistenz

**User Story:** Als Nutzer möchte ich meinen Spielstand gespeichert haben, damit ich ein unterbrochenes Spiel fortsetzen kann.

#### Akzeptanzkriterien

1. THE React_App SHALL use the existing Game_Store module for persisting game state to IndexedDB with localStorage fallback
2. WHEN the game state changes (roll, hold, score), THE React_App SHALL save the updated state to the Game_Store
3. WHEN the game is finished, THE React_App SHALL save the final state with `status: 'finished'` for highscore display

### Anforderung 8: Result Screen — Spielergebnis

**User Story:** Als Nutzer möchte ich nach Spielende das Ergebnis mit Rangliste sehen, damit ich weiß, wer gewonnen hat.

#### Akzeptanzkriterien

1. WHEN the game status changes to `finished`, THE React_App SHALL navigate to the result screen
2. THE React_App SHALL display the final scores with player names, avatars, total scores, and ranks sorted by score descending
3. THE React_App SHALL provide a "Neues Spiel" button that navigates back to the home screen
4. IF the game state cannot be loaded from the Game_Store, THEN THE React_App SHALL display an error message and a button to return to the home screen

### Anforderung 9: Offline-Multiplayer via WebRTC

**User Story:** Als Nutzer möchte ich mit einem anderen Spieler über WebRTC ohne Server spielen können, damit ich lokal Multiplayer spielen kann.

#### Akzeptanzkriterien

1. THE React_App SHALL use the existing WebRTC_Peer module for peer-to-peer connections
2. THE React_App SHALL use the existing Offline_Game_Controller module for host-authority game state management
3. WHEN the user is the host on the lobby screen, THE React_App SHALL generate an SDP offer, compress it via the SDP_Payload module, and display it as a QR code and a shareable deep-link URL
4. WHEN the user is the client on the lobby screen, THE React_App SHALL provide a QR code scanner and a text input for pasting the SDP offer
5. WHEN the WebRTC connection is established, THE React_App SHALL navigate both peers to the game screen
6. WHILE the connection status is `disconnected`, THE React_App SHALL display a warning banner on the game screen
7. IF the connection status changes to `failed`, THEN THE React_App SHALL display an error banner with a button to return to the home screen
8. WHEN the connection is re-established after a disconnect, THE React_App SHALL resynchronize the game state from the host

### Anforderung 10: Lokalisierung (i18n)

**User Story:** Als Nutzer möchte ich die App in deutscher Sprache nutzen, damit ich alle Texte verstehen kann.

#### Akzeptanzkriterien

1. THE React_App SHALL use the existing I18n_System module to load and resolve translation keys
2. THE React_App SHALL load the German locale file (`locales/de.json`) on app initialization
3. WHEN a translation key is not found, THE React_App SHALL display the key itself as fallback text

### Anforderung 11: Motion und Animationen

**User Story:** Als Nutzer möchte ich flüssige Animationen und Übergänge sehen, damit die App sich hochwertig anfühlt.

#### Akzeptanzkriterien

1. THE React_App SHALL use the existing Motion_System module for screen transitions (fade, slide)
2. THE React_App SHALL use the Dice_Renderer's built-in spring-based animations for dice rolls and bounces
3. WHEN the user has `prefers-reduced-motion: reduce` enabled, THE React_App SHALL set all animation durations to 0

### Anforderung 12: Barrierefreiheit (Accessibility)

**User Story:** Als Nutzer mit Hilfstechnologien möchte ich die App bedienen können, damit ich gleichberechtigt spielen kann.

#### Akzeptanzkriterien

1. THE React_App SHALL provide an ARIA live region (`aria-live="polite"`) for announcing dice results to screen readers
2. THE React_App SHALL set appropriate `role`, `aria-label`, and `tabindex` attributes on interactive elements (roll button, die click area, scoreboard rows)
3. WHEN a new screen is mounted, THE React_App SHALL move focus to the first heading or focusable element
4. THE React_App SHALL support keyboard navigation: Space/Enter for rolling, Enter for toggling die hold, Escape for closing dialogs
5. THE React_App SHALL use the Design_System's built-in focus styles (`[data-interactive]:focus-visible` double ring) without overriding them

### Anforderung 13: PWA-Funktionalität

**User Story:** Als Nutzer möchte ich die App installieren und offline nutzen können, damit ich auch ohne Internetverbindung spielen kann.

#### Akzeptanzkriterien

1. THE React_App SHALL register a service worker that caches all static assets (HTML, CSS, JS, GLB model, icons, locale files)
2. WHEN a new service worker version is detected, THE React_App SHALL reload the page to activate the new version
3. THE React_App SHALL include a valid `manifest.json` with `display: "standalone"`, app icons, and theme color
4. THE React_App SHALL function fully offline after the initial load, including all game modes and local multiplayer

### Anforderung 14: Wiederverwendung bestehender Module

**User Story:** Als Entwickler möchte ich die bestehenden, UI-unabhängigen Module aus `dice-game-pwa/js/` direkt importieren, damit ich keine Logik dupliziere.

#### Akzeptanzkriterien

1. THE React_App SHALL import the Dice_Engine, Game_Engine, Game_Mode_Registry, Free_Roll_Modus, and Kniffel_Modus modules from `dice-game-pwa/js/` via relative paths
2. THE React_App SHALL import the Game_Store module from `dice-game-pwa/js/store/` via relative paths
3. THE React_App SHALL import the WebRTC_Peer, Offline_Game_Controller, SDP_Payload, and QR_Code_Modul from `dice-game-pwa/js/multiplayer/` via relative paths
4. THE React_App SHALL import the I18n_System module from `dice-game-pwa/js/` via relative paths
5. THE React_App SHALL import the Motion_System module from `dice-game-pwa/js/motion/` via relative paths
6. THE React_App SHALL import the Dice_Renderer module from `dice-game-pwa/js/dice/` via relative paths
7. THE React_App SHALL import the Avatars module from `dice-game-pwa/js/` via relative paths
