# Implementierungsplan: Dice Game PWA

## Übersicht

Schrittweise Implementierung der Dice Game PWA mit Vanilla JS und ES-Modulen. Jeder Task baut auf den vorherigen auf und endet mit der vollständigen Integration aller Komponenten. Testframework: Vitest + fast-check.

## Tasks

- [x] 1. Projektstruktur, PWA-Shell und Grundkonfiguration
  - [x] 1.1 Projektverzeichnisse und Basisdateien anlegen
    - Verzeichnisstruktur gemäß Design erstellen: `css/`, `js/motion/`, `js/dice/`, `js/game/`, `js/game/modes/`, `js/multiplayer/`, `js/store/`, `js/screens/`, `locales/`
    - `index.html` als PWA-Shell mit semantischem HTML, Viewport-Meta, Manifest-Link und Design-System-CSS-Einbindung
    - `manifest.json` mit App-Name, Icons-Platzhalter, `display: standalone`, Theme-Color
    - `sw.js` als Service Worker mit Cache-First-Strategie für alle App-Assets
    - _Anforderungen: 1.1, 1.2, 1.4_

  - [x] 1.2 Vitest und fast-check Testkonfiguration einrichten
    - `package.json` mit Vitest, fast-check, jsdom als Dev-Dependencies
    - `vitest.config.js` mit jsdom-Environment konfigurieren
    - Testverzeichnis `tests/` anlegen mit einer Smoke-Test-Datei
    - _Anforderungen: Teststrategie_

  - [x] 1.3 i18n-System implementieren (`js/i18n.js`)
    - `setLocale(locale)` lädt JSON-Datei aus `locales/`
    - `t(key, params)` löst Schlüssel auf und ersetzt `{placeholder}`-Marker
    - Fallback auf Key-String wenn Schlüssel nicht gefunden
    - `locales/de.json` mit initialen Strings für alle UI-Texte anlegen
    - _Anforderungen: 9.6_

  - [x] 1.4 Property-Test für i18n-Schlüssel-Auflösung schreiben
    - **Property 10: i18n-Schlüssel-Auflösung mit Platzhaltern**
    - Für jeden definierten Key und beliebige Platzhalter-Werte: `t(key, params)` liefert nicht-leeren String ohne unresolvierte Platzhalter
    - **Validiert: Anforderung 9.6**

- [x] 2. Motion System und CSS-3D-Würfel-Rendering
  - [x] 2.1 Motion System implementieren (`js/motion/motion-system.js`)
    - Wrapper um motion.dev mit Presets: `fadeIn`, `fadeOut`, `scaleIn`, `slideUp`, `slideDown`, `diceRoll`, `diceBounce`
    - `animate(element, keyframes, config)` — animiert Element mit Preset oder Custom-Config
    - `shouldReduceMotion()` — prüft `prefers-reduced-motion` Media Query
    - `transition(outEl, inEl, type)` — Screen-Übergang mit Fade oder Slide
    - Bei `prefers-reduced-motion: reduce` alle Animationen auf `duration: 0`
    - _Anforderungen: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Property-Test für Reduced Motion schreiben
    - **Property 9: Reduced Motion deaktiviert Animationen**
    - Für jedes Preset: wenn `shouldReduceMotion()` true, dann effektive Dauer = 0
    - **Validiert: Anforderung 2.4**

  - [x] 2.3 CSS-3D-Würfel-Styles erstellen (`css/dice.css`)
    - 3D-Würfel mit `transform-style: preserve-3d`, `perspective` auf Container
    - 6 Seiten mit korrekten `rotateX`/`rotateY`-Transforms
    - Softe Optik: `border-radius`, mehrlagige `box-shadow`, `linear-gradient` für Lichtreflexion
    - Pip-Layout (Würfelaugen) für Werte 1–6 mit kontrastreichem Styling
    - Held-State visuell hervorgehoben (subtile Outline/Glow)
    - _Anforderungen: 3.1, 3.2, 3.5_

  - [x] 2.4 Dice Renderer implementieren (`js/dice/dice-renderer.js`)
    - `create(container, count)` — erzeugt n Würfel-DOM-Elemente
    - `update(result, animate)` — aktualisiert Anzeige mit motion.dev Spring-Animation
    - `setHeld(index, held)` — setzt visuellen Haltezustand
    - `destroy()` — entfernt alle Würfel-DOM-Elemente
    - ARIA-Attribute auf Würfel-Elementen für Screenreader
    - _Anforderungen: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1_

  - [x] 2.5 Property-Test für Würfel-Rendering-Anzahl schreiben
    - **Property 2: Würfel-Rendering erzeugt korrekte Anzahl**
    - Für jede gültige Anzahl n (1–6): Renderer erzeugt exakt n Würfel-DOM-Elemente
    - **Validiert: Anforderung 3.4**

- [x] 3. Dice Engine und Würfelwurf-Mechanik
  - [x] 3.1 Dice Engine implementieren (`js/dice/dice-engine.js`)
    - `roll(count, heldIndices)` — generiert kryptografisch sichere Zufallswerte (1–6) via Web Crypto API
    - `getState()` — gibt aktuellen DiceState zurück
    - `toggleHold(index)` — Würfel halten/freigeben
    - `reset(count)` — alle Würfel zurücksetzen
    - Fallback auf `Math.random()` wenn Crypto API nicht verfügbar
    - _Anforderungen: 4.1, 4.2, 4.4_

  - [x] 3.2 Property-Test für Würfelwurf-Gültigkeit schreiben
    - **Property 1: Würfelwurf-Gültigkeit und Halte-Invarianz**
    - Für beliebige Anzahlen (1–6) und Halte-Kombinationen: alle Werte in [1,6], gehaltene Würfel unverändert, nur nicht-gehaltene neu gewürfelt
    - **Validiert: Anforderungen 4.1, 4.2, 4.4**

  - [x] 3.3 ARIA-Live-Region für Würfelergebnisse implementieren
    - Nach jedem Wurf: Ergebnis als Text in ARIA-Live-Region schreiben
    - Screenreader-Ansage mit allen Würfelwerten
    - _Anforderungen: 10.3_

  - [x] 3.4 Property-Test für ARIA-Live-Region schreiben
    - **Property 11: ARIA-Live-Region enthält Würfelergebnis**
    - Für jedes Würfelergebnis: ARIA-Live-Region enthält Text mit allen Würfelwerten
    - **Validiert: Anforderung 10.3**

- [x] 4. Checkpoint — Basis-Würfelmechanik verifizieren
  - Sicherstellen, dass alle bisherigen Tests bestehen. Bei Fragen den Nutzer konsultieren.

- [x] 5. Spielmodus-System und Kniffel-Implementierung
  - [x] 5.1 Game Mode Registry implementieren (`js/game/game-mode-registry.js`)
    - `register(config)` — Spielmodus registrieren mit id, name, diceCount, maxPlayers, maxRounds, rollsPerTurn, scoring, categories
    - `get(id)` — Spielmodus abrufen
    - `getAll()` — alle registrierten Modi auflisten
    - _Anforderungen: 5.1, 5.2, 5.3_

  - [x] 5.2 Property-Test für Registry Round-Trip schreiben
    - **Property 3: Spielmodus-Registry Round-Trip**
    - Für jede gültige GameModeConfig: nach `register()` liefert `get(id)` identische Config, `getAll()` enthält sie
    - **Validiert: Anforderungen 5.1, 5.2, 5.3**

  - [x] 5.3 Freies-Würfeln-Modus implementieren (`js/game/modes/free-roll.js`)
    - Keine Regeln, unbegrenzte Würfe und Runden
    - Einfache Summen-Bewertung
    - Registrierung in der Registry
    - _Anforderungen: 5.4_

  - [x] 5.4 Kniffel-Modus implementieren (`js/game/modes/kniffel.js`)
    - Vollständiges Kniffel-Regelwerk: 13 Kategorien (oberer + unterer Block)
    - `calculateOptions(dice, state)` — berechnet mögliche Punktzahlen für alle offenen Kategorien
    - `applyScore(option, state)` — wendet gewählte Wertung an
    - `isGameOver(state)` — prüft ob alle Kategorien belegt
    - `getFinalScores(state)` — Endpunktzahlen mit korrektem Bonus (35 bei ≥63 im oberen Block)
    - 3 Würfe pro Zug, 5 Würfel
    - _Anforderungen: 5.5_

  - [x] 5.5 Property-Test für Kniffel-Bewertung schreiben
    - **Property 12: Kniffel-Bewertung berechnet korrekte Punktzahlen**
    - Für jede gültige 5-Würfel-Kombination und jede Kategorie: korrekte Punktzahl gemäß offiziellem Regelwerk
    - **Validiert: Anforderung 5.5**

- [x] 6. Game Engine und Scoreboard
  - [x] 6.1 Game Engine implementieren (`js/game/game-engine.js`)
    - `startGame(modeId, players)` — neues Spiel initialisieren
    - `roll()` — Würfeln delegieren an DiceEngine
    - `selectScore(option)` — Wertung wählen (für Modi mit Kategorien)
    - `nextTurn()` — nächster Spieler
    - `getState()` — aktueller GameState
    - Event-System: `on(event, handler)` für `stateChange`, `roll`, `turnEnd`, `gameOver`, `playerDisconnected`, `playerReconnected`
    - Validierung: Aktionen nur vom aktiven Spieler, Würfe-Limit pro Zug
    - _Anforderungen: 4.1, 4.2, 6.2_

  - [x] 6.2 Property-Test für Endpunktzahlen-Sortierung schreiben
    - **Property 4: Endpunktzahlen-Sortierung**
    - Für jeden abgeschlossenen Spielzustand: `getFinalScores()` liefert absteigende Sortierung, gleiche Punktzahl = gleiche Platzierung
    - **Validiert: Anforderung 6.3**

  - [x] 6.3 Scoreboard-Logik implementieren (`js/game/scoreboard.js`)
    - Scoreboard-DOM-Rendering basierend auf GameState
    - Echtzeit-Aktualisierung bei `stateChange`-Events
    - Aktuellen Spieler und aktuelle Runde hervorheben
    - Kniffel-spezifisches Scoreboard mit allen 13 Kategorien + Bonus
    - _Anforderungen: 6.1, 6.2, 6.3_

- [x] 7. Persistenz-Schicht (IndexedDB)
  - [x] 7.1 Game Store implementieren (`js/store/game-store.js`)
    - IndexedDB-Datenbank `dice-game-pwa` mit ObjectStore `games` (keyPath: `gameId`)
    - Indexes: `status`, `updatedAt`
    - `save(state)` — Spielstand speichern
    - `load(gameId)` — Spielstand laden
    - `listActive()` — nur Spiele mit `status !== 'finished'`
    - `delete(gameId)` — Spielstand löschen
    - Fallback auf `localStorage` wenn IndexedDB nicht verfügbar
    - _Anforderungen: 6.4, 6.5_

  - [x] 7.2 Property-Test für Spielstand-Serialisierung schreiben
    - **Property 5: Spielstand-Serialisierung Round-Trip**
    - Für jeden gültigen GameState: `save()` + `load(gameId)` liefert semantisch identischen Zustand
    - **Validiert: Anforderung 6.4**

  - [x] 7.3 Property-Test für Aktive-Spiele-Filter schreiben
    - **Property 6: Aktive-Spiele-Filter**
    - Für jede Menge gespeicherter Spiele: `listActive()` liefert ausschließlich nicht-beendete Spiele, kein aktives fehlt
    - **Validiert: Anforderung 6.5**

- [x] 8. Checkpoint — Spiellogik und Persistenz verifizieren
  - Sicherstellen, dass alle bisherigen Tests bestehen. Bei Fragen den Nutzer konsultieren.

- [x] 9. Screens und UI-Navigation
  - [x] 9.1 App-Router und Bootstrap implementieren (`js/app.js`)
    - Einfacher Hash-basierter Router für Screen-Navigation
    - Screen-Lifecycle: `mount()`, `unmount()` pro Screen
    - Screen-Übergänge via Motion System
    - Service Worker Registration
    - Design-System CSS und Screen-CSS laden
    - _Anforderungen: 1.1, 1.2, 9.2_

  - [x] 9.2 Home Screen implementieren (`js/screens/home-screen.js`)
    - Spielmodus-Auswahl aus Registry
    - "Spiel fortsetzen"-Option wenn aktive Spiele in GameStore vorhanden
    - Optionen: Solo, Online Multiplayer, Offline Multiplayer
    - Maximal eine primäre Aktion hervorgehoben
    - _Anforderungen: 5.3, 6.5, 9.1_

  - [x] 9.3 Game Screen implementieren (`js/screens/game-screen.js`)
    - Würfel-Container mit DiceRenderer
    - Wurf-Aktion via Tap/Swipe-Geste
    - Haptisches Feedback (Vibration API) beim Wurf
    - Scoreboard-Integration
    - Würfel-Auswahl (Hold/Release) per Tap
    - Tastatur-Bedienbarkeit: Leertaste = Würfeln, Tab = Würfel-Navigation, Enter = Hold-Toggle
    - _Anforderungen: 3.3, 3.5, 4.3, 9.3, 9.4, 10.2_

  - [x] 9.4 Lobby Screen implementieren (`js/screens/lobby-screen.js`)
    - Spielerstellung mit Einladungslink (Online) oder Peer-Discovery (Offline)
    - Spielerliste mit Verbindungsstatus
    - Spiel-Starten-Button (nur Host)
    - _Anforderungen: 7.1, 8.2_

  - [x] 9.5 Result Screen implementieren (`js/screens/result-screen.js`)
    - Ergebnisübersicht mit Endpunktzahlen und Platzierungen
    - Optionen: Neues Spiel, Rematch
    - _Anforderungen: 6.3_

  - [x] 9.6 Screen-spezifische Styles erstellen (`css/game.css`, `css/screens.css`)
    - Responsive Layout (320px–1440px) basierend auf Design System
    - Dark Mode via `prefers-color-scheme`
    - Touch-Targets mindestens 44x44px
    - Skeleton-Screens für Ladezustände
    - _Anforderungen: 1.3, 1.4, 1.5, 9.4, 9.5, 10.4_

- [x] 10. Online Multiplayer (WebSocket)
  - [x] 10.1 WebSocket Client implementieren (`js/multiplayer/websocket-client.js`)
    - Verbindung zu WebSocket-Server herstellen
    - Automatischer Reconnect mit exponential Backoff (max 5 Versuche)
    - Senden und Empfangen von GameAction-Nachrichten
    - _Anforderungen: 7.2_

  - [x] 10.2 Sync Protocol implementieren (`js/multiplayer/sync-protocol.js`)
    - Abstraktion über WebSocket und WebRTC
    - `connect(config)`, `sendAction(action)`, `onAction(handler)`, `onConnectionChange(handler)`, `disconnect()`
    - Full-State-Sync bei Reconnect
    - Spieler-Disconnect/Reconnect-Handling in GameEngine integrieren
    - _Anforderungen: 7.2, 7.3, 7.4, 7.5_

  - [x] 10.3 Property-Test für Spieler-Disconnect schreiben
    - **Property 7: Spieler-Disconnect setzt Status**
    - Für jeden Spielzustand und verbundenen Spieler: bei Verbindungsabbruch wird `connectionStatus` auf `disconnected` gesetzt, Spiel bleibt `playing`
    - **Validiert: Anforderungen 7.4, 8.5**

  - [x] 10.4 Property-Test für Spieler-Reconnect schreiben
    - **Property 8: Spieler-Reconnect stellt Zustand wieder her**
    - Für jeden Spielzustand mit getrenntem Spieler: nach Reconnect wird Status `connected`, Spieler erhält vollständigen Spielzustand
    - **Validiert: Anforderung 7.5**

- [x] 11. Offline Multiplayer (WebRTC P2P)
  - [x] 11.1 WebRTC Peer Manager implementieren (`js/multiplayer/webrtc-peer.js`)
    - Peer-to-Peer-Verbindung ohne zentralen Server
    - Host-/Client-Rollen
    - Signalisierung für Verbindungsaufbau (z.B. via QR-Code oder manuellen Austausch)
    - Peer-Discovery im lokalen Netzwerk
    - Disconnect-Erkennung und Reconnect-Möglichkeit
    - _Anforderungen: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 11.2 WebRTC in Sync Protocol integrieren
    - `ConnectionConfig` mit `type: 'webrtc'` unterstützen
    - Gleiche GameAction-Nachrichten wie WebSocket
    - Offline-Funktionalität ohne Internet
    - _Anforderungen: 8.3, 8.4_

- [x] 12. Checkpoint — Multiplayer verifizieren
  - Sicherstellen, dass alle bisherigen Tests bestehen. Bei Fragen den Nutzer konsultieren.

- [x] 13. Integration und Feinschliff
  - [x] 13.1 Alle Screens mit GameEngine, Store und Multiplayer verdrahten
    - Home Screen: Spielmodus-Auswahl → Lobby oder direkt Game Screen
    - Lobby Screen: Multiplayer-Verbindung → Game Screen
    - Game Screen: GameEngine-Events → UI-Updates, Persistenz bei jedem Zug
    - Result Screen: Endpunktzahlen aus GameEngine
    - Spiel-Fortsetzen-Flow: GameStore → GameEngine → Game Screen
    - _Anforderungen: 6.4, 6.5, 9.2_

  - [x] 13.2 Service Worker Caching finalisieren
    - Alle JS-Module, CSS-Dateien, Locale-Dateien und HTML im Cache
    - Cache-Versionierung für Updates
    - Offline-Funktionalität end-to-end sicherstellen
    - _Anforderungen: 1.2_

  - [x] 13.3 Barrierefreiheit vervollständigen
    - Semantisches HTML und ARIA-Attribute auf allen interaktiven Elementen prüfen
    - Fokus-Management bei Screen-Wechseln
    - Tastatur-Navigation durchgängig sicherstellen
    - Farbkontraste via Design System `data-wcag`-Attribut
    - _Anforderungen: 10.1, 10.2, 10.4_

- [x] 14. Abschluss-Checkpoint — Alle Tests und Integration verifizieren
  - Sicherstellen, dass alle Tests bestehen. Bei Fragen den Nutzer konsultieren.

## Hinweise

- Tasks mit `*` sind optional und können für ein schnelleres MVP übersprungen werden
- Jeder Task referenziert spezifische Anforderungen für Nachverfolgbarkeit
- Checkpoints sichern inkrementelle Validierung
- Property-Tests validieren universelle Korrektheitseigenschaften
- Unit-Tests validieren spezifische Beispiele und Edge Cases
