# Implementierungsplan: Dice Game React Rewrite

## Übersicht

Schrittweise Neuimplementierung der Dice Game PWA als React 18+ Anwendung mit Vite. Bestehende UI-unabhängige Module aus `dice-game-pwa/js/` werden direkt importiert. Das CSS Design System aus `design-system/` wird über `.adaptive`-Klassen und `data-*`-Attribute integriert. Alle Code-Beispiele verwenden TypeScript/JSX.

## Tasks

- [x] 1. Projekt-Setup und Grundstruktur
  - [x] 1.1 Vite + React 18+ Projekt in `dice-game-react/` initialisieren
    - `package.json` mit React 18+, Vite, TypeScript-Abhängigkeiten erstellen
    - `vite.config.ts` mit Pfad-Aliase für `dice-game-pwa/js/` und `design-system/` konfigurieren
    - `tsconfig.json` mit JSX-Support und Pfad-Mappings erstellen
    - `index.html` Einstiegspunkt erstellen
    - _Anforderungen: 1.1, 1.3, 14.1–14.7_

  - [x] 1.2 Design System CSS-Imports einrichten
    - `foundation.css`, Komponenten-CSS, Modul-CSS und Template-CSS aus `design-system/` importieren
    - Sicherstellen, dass CSS-Variablen (`--layout-spacing`, `--size-padding`, etc.) verfügbar sind
    - _Anforderungen: 1.2, 2.7, 2.8_

  - [x] 1.3 App-Einstiegspunkt (`main.tsx`, `App.tsx`) erstellen
    - `main.tsx` mit `createRoot` und CSS-Imports
    - `App.tsx` als Root-Komponente mit Router- und Context-Provider-Platzhaltern
    - _Anforderungen: 1.1_

- [x] 2. Hash-basierter Router
  - [x] 2.1 `useHashRouter`-Hook implementieren
    - Hash-Parsing (`#route?key=value`) und `hashchange`-Listener
    - `navigate(route, params)`-Funktion
    - Default-Route `#home` bei leerem Hash
    - Deep-Link-Redirects: `#join?sdp=...` → `#lobby?role=client&sdp=...`, `#answer?sdp=...` → `#lobby?role=host&sdp=...`
    - _Anforderungen: 3.1, 3.2, 3.5, 3.6, 3.7_

  - [ ]* 2.2 Property-Test: Route-Parsing Round-Trip
    - **Property 1: Route-Parsing Round-Trip**
    - Für jede gültige Route und beliebige Key-Value-Parameter: Kodieren → Parsen = Original
    - **Validiert: Anforderungen 3.1, 3.5**

  - [ ]* 2.3 Unit-Tests für Router
    - Leerer Hash → `#home`, ungültige Route → `#home`
    - Deep-Link-Redirects `#join`, `#answer`
    - Query-Parameter-Parsing
    - _Anforderungen: 3.1, 3.2, 3.5, 3.6, 3.7_

  - [x] 2.4 Router-Komponente mit Screen-Mounting und Transitions
    - Screen-Wechsel mit Fade-Transition via Motion_System
    - Focus-Management: nach Mount Fokus auf erstes `<h1>`/`<h2>` oder fokussierbares Element
    - Unmount der vorherigen Screen-Komponente
    - _Anforderungen: 3.3, 3.4, 11.1_

- [x] 3. Checkpoint — Router und Projekt-Setup verifizieren
  - Sicherstellen, dass alle Tests bestehen. Bei Fragen den Nutzer konsultieren.

- [x] 4. GameContext und Spielzustand-Management
  - [x] 4.1 GameContext-Provider implementieren
    - `GameContext` mit `useReducer` für Spielzustand
    - GameEngine-Instanz als `useRef`, Synchronisation über `stateChange`-Events
    - GameStore-Instanz als `useRef` mit async Init
    - Actions: `startGame`, `roll`, `toggleHold`, `selectScore`, `resetDice`, `loadGame`
    - _Anforderungen: 7.1, 14.1, 14.2_

  - [x] 4.2 Spielzustand-Persistenz integrieren
    - Bei jeder State-Änderung (Roll, Hold, Score) → `GameStore.save()`
    - Bei Spielende → Status `finished` speichern für Highscore
    - _Anforderungen: 7.2, 7.3_

  - [ ]* 4.3 Property-Test: Spielzustand-Persistenz Round-Trip
    - **Property 10: Spielzustand-Persistenz Round-Trip**
    - Für jeden gültigen GameState: Speichern → Laden mit gleicher gameId = identischer Zustand
    - **Validiert: Anforderungen 7.2**

- [x] 5. i18n-Integration
  - [x] 5.1 i18n-System initialisieren und `t()`-Funktion bereitstellen
    - `I18n_System` importieren, `setLocale('de')` bei App-Init
    - Deutsche Locale-Datei (`locales/de.json`) laden
    - `t()`-Funktion in Komponenten verfügbar machen (z.B. via Context oder direktem Import)
    - _Anforderungen: 10.1, 10.2, 10.3, 14.4_

  - [ ]* 5.2 Property-Test: i18n-Fallback gibt Schlüssel zurück
    - **Property 13: i18n-Fallback gibt Schlüssel zurück**
    - Für jeden beliebigen String, der kein gültiger Schlüssel ist: `t(key)` === `key`
    - **Validiert: Anforderungen 10.3**

- [x] 6. Home Screen
  - [x] 6.1 HomeScreen-Komponente mit Spielmodus-Karten
    - Alle registrierten Modi aus `GameModeRegistry.getAll()` als Karten rendern
    - `.adaptive`-Klasse und `data-*`-Attribute (color, material, size, interactive) auf Karten setzen
    - Free Roll → direkt zu `#game?modeId=free-roll&playType=solo` navigieren
    - Kniffel → Modal öffnen
    - _Anforderungen: 4.1, 4.2, 4.3, 2.1, 2.2, 2.4_

  - [ ]* 6.2 Property-Test: Alle registrierten Spielmodi werden angezeigt
    - **Property 2: Alle registrierten Spielmodi werden angezeigt**
    - Für jede nicht-leere Menge registrierter Modi: genau eine Karte pro Modus
    - **Validiert: Anforderungen 4.1**

  - [x] 6.3 Modal-Komponente implementieren
    - `<dialog>`-Element mit Backdrop-Klick und Escape zum Schließen
    - Focus-Trap innerhalb des Modals
    - Design System Styling (`.adaptive` + `data-*`)
    - _Anforderungen: 4.8, 12.4, 2.1, 2.4, 2.5_

  - [x] 6.4 Spieltyp-Auswahl-Dialog und PlayerSetup-Dialog
    - Kniffel-Spieltyp-Optionen: Solo, Lokal, Offline-Multiplayer, Spiel beitreten
    - PlayerSetup: Namensinputs, Spieleranzahl-Picker (für Lokal)
    - Navigation zu `#game` (Solo/Lokal) oder `#lobby` (Multiplayer/Beitreten)
    - _Anforderungen: 4.3, 4.4, 4.5, 4.6_

  - [x] 6.5 Highscore-Liste auf dem Home Screen
    - Top 5 Scores aus `GameStore.listFinished()` laden und absteigend anzeigen
    - _Anforderungen: 4.7_

  - [ ]* 6.6 Property-Test: Highscore-Liste ist Top 5 absteigend sortiert
    - **Property 3: Highscore-Liste ist Top 5 absteigend sortiert**
    - Für jede Liste abgeschlossener Spiele: max 5 Einträge, absteigend, höchste Werte
    - **Validiert: Anforderungen 4.7**

- [x] 7. Checkpoint — Home Screen und Grundfunktionen verifizieren
  - Sicherstellen, dass alle Tests bestehen. Bei Fragen den Nutzer konsultieren.

- [x] 8. DiceArea-Komponente
  - [x] 8.1 DiceArea mit Three.js Dice_Renderer integrieren
    - `useRef` für Container-Element und Renderer-Instanz
    - `useEffect` für `create()` bei Mount, `destroy()` bei Unmount
    - `die-click`-Event an `onDieClick`-Callback weiterleiten
    - `diceCount`-Prop für dynamische Würfelanzahl
    - Expose `update()` und `setHeld()` via Ref oder Callback
    - _Anforderungen: 5.1, 5.3, 11.2, 14.6_

  - [ ]* 8.2 Unit-Tests für DiceArea
    - Mount/Unmount-Lifecycle (create/destroy)
    - Die-Click-Event-Weiterleitung
    - _Anforderungen: 5.1, 5.3_

- [x] 9. Game Screen
  - [x] 9.1 GameScreen-Grundstruktur mit Scroll-Snap-Layout
    - Horizontales Scroll-Snap-Layout: Würfel-Seite | Scoreboard-Seite (Kniffel)
    - Nur Würfel-Seite für Free Roll
    - DiceArea-Komponente einbinden
    - _Anforderungen: 5.9, 5.5_

  - [x] 9.2 Roll-Button und Spielsteuerung
    - Roll-Button: Klick → `GameContext.roll()` → Dice_Renderer Animation
    - Wurf-Zähler anzeigen (Kniffel: max 3 Würfe)
    - Button deaktivieren bei erreichtem Wurf-Limit
    - Haptic Feedback via `navigator.vibrate(50)` wenn verfügbar
    - _Anforderungen: 5.2, 5.4, 5.8_

  - [ ]* 9.3 Property-Test: Würfel-Button deaktiviert bei Wurf-Limit
    - **Property 4: Würfel-Button deaktiviert bei Wurf-Limit**
    - Für jeden Kniffel-State mit `rollsThisTurn === rollsPerTurn`: Button disabled
    - **Validiert: Anforderungen 5.4**

  - [x] 9.4 PlayerBar-Komponente
    - Avatar (Emoji), Name, Punktestand pro Spieler
    - Aktiver Spieler hervorgehoben (`data-emphasis="strong"`)
    - `.adaptive`-Klasse und Design System Attribute
    - _Anforderungen: 5.6, 2.1, 2.2, 2.3_

  - [ ]* 9.5 Property-Test: Spielerleiste zeigt alle Spieler vollständig
    - **Property 5: Spielerleiste zeigt alle Spieler vollständig**
    - Für 1–8 Spieler: genau N Einträge, aktiver Spieler hervorgehoben
    - **Validiert: Anforderungen 5.6**

  - [x] 9.6 ARIA Live Region für Würfelergebnis-Ansagen
    - `aria-live="polite"` Region im GameScreen
    - Nach jedem Wurf: Dice Announcer Text in Live Region schreiben
    - _Anforderungen: 5.7, 12.1_

  - [ ]* 9.7 Property-Test: Würfelergebnis wird per ARIA angekündigt
    - **Property 6: Würfelergebnis wird per ARIA angekündigt**
    - Für jedes Würfelergebnis (1–6 Werte, je 1–6): Announcer-Text enthält alle Werte
    - **Validiert: Anforderungen 5.7, 12.1**

  - [x] 9.8 Dice-Count-Selector für Free Roll Modus
    - Selector (1–6 Würfel) anzeigen wenn `modeId === 'free-roll'`
    - Würfelanzahl ändern via `GameContext.resetDice(count)`
    - _Anforderungen: 5.5_

  - [x] 9.9 Auto-Scroll zum Scoreboard nach letztem Wurf
    - Wenn letzter Wurf im Kniffel-Modus verbraucht → nach Dice-Animation zum Scoreboard scrollen
    - _Anforderungen: 5.10_

- [x] 10. Scoreboard-Komponente (Kniffel)
  - [x] 10.1 ScoreboardReact implementieren
    - 13 Kniffel-Kategorien als Tabellenzeilen
    - Bonus-Zeile, Zwischensummen, Gesamtsumme
    - Spalte pro Spieler, aktiver Spieler visuell hervorgehoben
    - _Anforderungen: 6.1, 6.2_

  - [ ]* 10.2 Property-Test: Scoreboard-Struktur ist vollständig
    - **Property 7: Scoreboard-Struktur ist vollständig**
    - Für 1–8 Spieler: 13 Kategorien, Bonus, Summen, N Spalten
    - **Validiert: Anforderungen 6.1, 6.2**

  - [x] 10.3 Klickbare Kategorien und Punktevergabe
    - Offene Kategorien als klickbare Zeilen mit potentiellen Punkten (nach mindestens 1 Wurf)
    - Klick → `GameContext.selectScore(option)` → nächster Zug
    - Gefüllte Kategorien: `data-material="inverted"` + `data-container-contrast="max"`
    - Keyboard-Navigation: Enter/Space zum Auswählen
    - _Anforderungen: 6.3, 6.4, 6.5, 12.4_

  - [ ]* 10.4 Property-Test: Offene Kategorien sind klickbar nach Wurf
    - **Property 8: Offene Kategorien sind klickbar nach Wurf**
    - Für jeden State mit `rollsThisTurn > 0`: Anzahl klickbarer Zeilen = Anzahl offener Kategorien
    - **Validiert: Anforderungen 6.3**

  - [ ]* 10.5 Property-Test: Ausgefüllte Kategorien zeigen den Punktwert
    - **Property 9: Ausgefüllte Kategorien zeigen den Punktwert**
    - Für jede Kategorie mit Wert ≠ null: Zelle zeigt diesen Wert als Text
    - **Validiert: Anforderungen 6.5**

  - [x] 10.6 Free Roll Summen-Anzeige
    - Nur Würfelsumme anzeigen statt vollem Scoreboard wenn `modeId === 'free-roll'`
    - _Anforderungen: 6.6_

- [x] 11. Checkpoint — Game Screen und Scoreboard verifizieren
  - Sicherstellen, dass alle Tests bestehen. Bei Fragen den Nutzer konsultieren.

- [x] 12. Result Screen
  - [x] 12.1 ResultScreen-Komponente implementieren
    - Navigation zum Result Screen bei `status === 'finished'`
    - Rangliste: Spielernamen, Avatare, Gesamtpunktzahlen, Ränge (absteigend)
    - "Neues Spiel"-Button → `#home`
    - Fehleranzeige + "Zurück zum Start"-Button falls Spielstand nicht ladbar
    - _Anforderungen: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 12.2 Property-Test: Endergebnis absteigend sortiert mit korrekten Rängen
    - **Property 11: Endergebnis absteigend sortiert mit korrekten Rängen**
    - Für beliebige Punktzahlen: absteigend sortiert, gleiche Punktzahl = gleicher Rang
    - **Validiert: Anforderungen 8.2**

  - [ ]* 12.3 Unit-Tests für Result Screen
    - Fehlerfall: Spielstand nicht ladbar → Fehlermeldung + Button
    - Navigation bei "Neues Spiel"
    - _Anforderungen: 8.3, 8.4_

- [x] 13. Lobby Screen (WebRTC Offline-Multiplayer)
  - [x] 13.1 LobbyScreen-Grundstruktur mit Host/Client-Modus
    - Host: SDP-Offer generieren via WebRTC_Peer, komprimieren via SDP_Payload
    - QR-Code anzeigen via QR_Code_Modul + Deep-Link-URL als kopierbarer Text
    - Client: QR-Scanner und Text-Input für SDP-Offer
    - Verbindungsstatus-Anzeige
    - _Anforderungen: 9.1, 9.2, 9.3, 9.4_

  - [x] 13.2 Verbindungsaufbau und Navigation zum Game Screen
    - Nach erfolgreicher WebRTC-Verbindung → `#game` navigieren
    - OfflineGameController für Host-Authority-Spielsteuerung integrieren
    - _Anforderungen: 9.2, 9.5_

  - [x] 13.3 Verbindungsstatus-Banner im Game Screen
    - Warning-Banner bei `connectionStatus === 'disconnected'`
    - Error-Banner mit "Zurück zum Start"-Button bei `connectionStatus === 'failed'`
    - Resynchronisation bei Wiederverbindung
    - _Anforderungen: 9.6, 9.7, 9.8_

  - [ ]* 13.4 Property-Test: Verbindungsstatus-Banner bei Disconnect
    - **Property 12: Verbindungsstatus-Banner bei Disconnect**
    - Für jeden Multiplayer-State mit `connectionStatus === 'disconnected'`: Banner sichtbar
    - **Validiert: Anforderungen 9.6**

  - [ ]* 13.5 Unit-Tests für Lobby Screen
    - Host-Flow: Offer-Generierung, QR-Code-Anzeige
    - Client-Flow: SDP-Input, Verbindungsaufbau
    - Error-Handling: ungültiger SDP-Payload, Kamera verweigert
    - _Anforderungen: 9.3, 9.4, 9.7_

- [x] 14. Checkpoint — Multiplayer und Result Screen verifizieren
  - Sicherstellen, dass alle Tests bestehen. Bei Fragen den Nutzer konsultieren.

- [x] 15. Motion und Animationen
  - [x] 15.1 Screen-Transitions mit Motion_System
    - Fade-Transition beim Routenwechsel (bereits in Task 2.4 vorbereitet, hier finalisieren)
    - `prefers-reduced-motion: reduce` → alle Animationsdauern auf 0
    - _Anforderungen: 11.1, 11.3_

  - [x] 15.2 Dice-Animationen verifizieren
    - Spring-basierte Animationen des Dice_Renderer für Würfe und Bounces sicherstellen
    - _Anforderungen: 11.2_

- [x] 16. Barrierefreiheit (Accessibility)
  - [x] 16.1 ARIA-Attribute und Keyboard-Navigation
    - `role`, `aria-label`, `tabindex` auf interaktiven Elementen (Roll-Button, Würfel-Klickbereich, Scoreboard-Zeilen)
    - Keyboard: Space/Enter zum Würfeln, Enter für Hold-Toggle, Escape für Dialoge
    - Design System Focus-Styles (`[data-interactive]:focus-visible`) nicht überschreiben
    - _Anforderungen: 12.2, 12.4, 12.5_

  - [ ]* 16.2 Property-Test: Interaktive Elemente haben ARIA-Attribute
    - **Property 14: Interaktive Elemente haben ARIA-Attribute**
    - Für jedes interaktive Element: `role`/semantisches HTML + `aria-label`/sichtbarer Text + `tabindex` (wenn nicht nativ fokussierbar)
    - **Validiert: Anforderungen 12.2**

  - [x] 16.3 Focus-Management bei Screen-Wechsel
    - Nach Mount einer neuen Screen → Fokus auf erstes Heading oder fokussierbares Element
    - (Ergänzung zu Task 2.4, hier End-to-End sicherstellen)
    - _Anforderungen: 3.4, 12.3_

- [x] 17. PWA-Funktionalität
  - [x] 17.1 Service Worker und Manifest erstellen
    - `manifest.json` mit `display: "standalone"`, App-Name, Icons, Theme-Color
    - Service Worker für Offline-Caching aller statischen Assets (HTML, CSS, JS, GLB, Icons, Locale-Dateien)
    - Service Worker Registration in `main.tsx`
    - Auto-Reload bei neuer Service Worker Version
    - _Anforderungen: 1.4, 1.5, 13.1, 13.2, 13.3, 13.4_

- [x] 18. Abschluss-Checkpoint — Vollständige Integration verifizieren
  - Sicherstellen, dass alle Tests bestehen. Bei Fragen den Nutzer konsultieren.
  - Prüfen, dass alle 14 Anforderungen durch die Implementierung abgedeckt sind.
  - Prüfen, dass die App offline funktioniert und als PWA installierbar ist.

## Hinweise

- Tasks mit `*` markiert sind optional und können für ein schnelleres MVP übersprungen werden
- Jeder Task referenziert spezifische Anforderungen für Nachverfolgbarkeit
- Checkpoints stellen inkrementelle Validierung sicher
- Property-Tests validieren universelle Korrektheitseigenschaften aus dem Design-Dokument
- Unit-Tests validieren spezifische Beispiele und Edge Cases
- Alle Module aus `dice-game-pwa/js/` werden per relativem Import wiederverwendet (Anforderung 14)
