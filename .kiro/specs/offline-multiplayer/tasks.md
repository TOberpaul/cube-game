# Implementierungsplan: Offline P2P Multiplayer

## Übersicht

Schrittweise Implementierung des Offline-P2P-Multiplayer-Features. Beginn mit dem SDP-Payload-Serializer (Kernbaustein für den Signaling-Ablauf), dann QR-Code-Modul, Offline-Lobby-UI, Offline-Game-Controller, und abschließend Service-Worker-Erweiterung und Integration.

## Tasks

- [x] 1. SDP-Payload-Serializer implementieren
  - [x] 1.1 `js/multiplayer/sdp-payload.js` erstellen mit `serializeSdpPayload`, `deserializeSdpPayload` und `validateSdpPayload`
    - `serializeSdpPayload(payload)` — Serialisiert ein SdpPayload-Objekt zu kompaktem JSON-String
    - `deserializeSdpPayload(json)` — Deserialisiert JSON-String zu SdpPayload, wirft Fehler bei ungültigem JSON
    - `validateSdpPayload(payload)` — Gibt `{ valid: true }` oder `{ valid: false, error: string }` zurück, benennt fehlendes/ungültiges Feld
    - Validierung prüft: `type` ∈ {"offer", "answer"}, `sdp` ist nicht-leerer String, `candidates` ist Array
    - _Anforderungen: 3.1, 3.2, 3.5, 3.6, 9.1, 9.2, 9.3, 9.4_

  - [x] 1.2 Property-Test: SDP-Payload Round-Trip
    - **Property 1: SDP-Payload Round-Trip**
    - Generiert zufällige gültige SDP-Payloads und prüft `deserializeSdpPayload(serializeSdpPayload(payload))` ≡ `payload`
    - Testdatei: `tests/sdp-payload.property.test.js`
    - **Validiert: Anforderungen 3.6, 9.3**

  - [x] 1.3 Property-Test: SDP-Payload Strukturelle Invariante
    - **Property 2: SDP-Payload Strukturelle Invariante**
    - Prüft, dass serialisierte Form genau die Felder `type`, `sdp`, `candidates` enthält mit korrekten Typen
    - Testdatei: `tests/sdp-payload.property.test.js`
    - **Validiert: Anforderungen 3.1, 3.2, 9.1**

  - [x] 1.4 Property-Test: SDP-Payload Validierung — Ungültige Payloads
    - **Property 3: SDP-Payload Validierung — Ungültige Payloads**
    - Generiert Objekte mit fehlenden/falschen Feldern und prüft `validateSdpPayload` gibt `{ valid: false, error }` zurück
    - Testdatei: `tests/sdp-payload.property.test.js`
    - **Validiert: Anforderungen 3.5, 9.2, 9.4**

- [x] 2. Checkpoint — SDP-Payload-Serializer verifizieren
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. QR-Code-Modul implementieren
  - [x] 3.1 `js/multiplayer/qr-code.js` erstellen mit `generateQrCode`, `scanQrCode` und `stopScanner`
    - `generateQrCode(data)` — Erzeugt QR-Code als Data-URL aus einem String (nutzt `qrcode-generator` oder ähnliche leichtgewichtige Bibliothek)
    - `scanQrCode(videoElement)` — Startet Kamera-Scanner, nutzt `BarcodeDetector`-API mit Fallback auf `jsQR`
    - `stopScanner()` — Stoppt Scanner und gibt Kamera-Stream frei
    - Fehlerbehandlung: `NotAllowedError` → Hinweis auf Texteingabe, `NotFoundError` → Scanner ausblenden
    - _Anforderungen: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.2 Unit-Tests für QR-Code-Modul
    - Test: `generateQrCode` erzeugt gültige Data-URL für SDP-Payload
    - Test: `stopScanner` gibt Kamera-Stream frei
    - Test: Kamera-Fehler werden korrekt behandelt (NotAllowedError, NotFoundError)
    - Testdatei: `tests/qr-code.test.js`
    - _Anforderungen: 8.1, 8.4, 8.5_

- [x] 4. Offline-Lobby-UI implementieren
  - [x] 4.1 Lobby-Template erweitern (`templates/lobby.html`)
    - Neue Bereiche für Offline-Modus: QR-Code-Anzeige-Container, Kamera-Scanner-Overlay mit Video-Element, kopierbares Textfeld für SDP-Payload, Einfüge-Textfeld für empfangenen Payload, Schritt-für-Schritt-Anleitung, Verbindungsstatus-Indikator
    - Elemente mit `data-offline-*` Attributen für einfache Selektion
    - _Anforderungen: 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 `lobby-screen.js` um Offline-Modus erweitern
    - Erkennung von `playType=offline` und `role` (host/client) aus URL-Parametern
    - Host-Flow: Ladezustand → `peer.connect({ isHost: true })` → `peer.getOffer()` → `serializeSdpPayload` → QR-Code + Text anzeigen → Scanner/Textfeld für Answer → `deserializeSdpPayload` → `peer.setAnswer()` → Verbunden
    - Client-Flow: Anleitung anzeigen → Scanner/Textfeld für Offer → `deserializeSdpPayload` → `peer.connect({ isHost: false })` → `peer.setOffer()` → `peer.getAnswer()` → `serializeSdpPayload` → QR-Code + Text anzeigen → Verbunden
    - Fehlerbehandlung bei ungültigem SDP-Payload (Fehlermeldung anzeigen, erneut versuchen)
    - "Spiel starten"-Button deaktiviert bis `connectionStatus === 'connected'`
    - _Anforderungen: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4, 3.5, 6.1, 6.2_

  - [x] 4.3 Property-Test: Start-Button-Zustand
    - **Property 8: Start-Button-Zustand**
    - Generiert zufällige Lobby-States mit 0-2 verbundenen Spielern, prüft Button genau dann aktiviert wenn 2 Spieler connected
    - Testdatei: `tests/offline-lobby.property.test.js`
    - **Validiert: Anforderungen 6.1, 6.2**

  - [x] 4.4 Unit-Tests für Offline-Lobby
    - Test: Host-Navigation (Home → Lobby mit role=host, playType=offline)
    - Test: Client-Navigation (Home → Lobby mit role=client, playType=offline)
    - Test: Ladezustand wird während SDP-Generierung angezeigt
    - Test: Ungültiger SDP-Payload zeigt Fehlermeldung
    - Testdatei: `tests/offline-lobby.test.js`
    - _Anforderungen: 1.1, 1.4, 2.1, 3.5_

- [x] 5. Checkpoint — Lobby-Flow verifizieren
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Offline-Game-Controller implementieren
  - [x] 6.1 `js/multiplayer/offline-game-controller.js` erstellen mit `createOfflineGameController`
    - Factory-Funktion mit Parametern: `{ peer, gameEngine, isHost, playerId }`
    - `createGameAction(type, payload)` — Erstellt GameAction mit `playerId`, `timestamp`, `type`, `payload`
    - `sendAction(action)` — Sendet GameAction über `peer.send()`
    - `handleRemoteAction(action)` — Verarbeitet empfangene GameAction
    - Host: Empfängt Client-Actions → wendet auf GameEngine an → sendet aktualisierten GameState
    - Client: Empfängt GameState-Updates → ersetzt lokalen State
    - `startGame(modeId, players)` — Host erstellt initialen GameState und sendet an Client
    - `isMyTurn()` — Prüft ob lokaler Spieler am Zug ist basierend auf `currentPlayerIndex`
    - `destroy()` — Räumt Event-Listener auf
    - _Anforderungen: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 6.3, 6.4_

  - [x] 6.2 Property-Test: GameAction Metadaten-Invariante
    - **Property 4: GameAction Metadaten-Invariante**
    - Generiert zufällige GameActions und prüft `timestamp > 0` und `playerId` nicht leer
    - Testdatei: `tests/offline-game-controller.property.test.js`
    - **Validiert: Anforderungen 4.5**

  - [x] 6.3 Property-Test: Host-Action-Verarbeitung
    - **Property 5: Host-Action-Verarbeitung**
    - Generiert zufällige GameStates und Actions, prüft dass Host korrekt verarbeitet und `updatedAt` monoton steigt
    - Testdatei: `tests/offline-game-controller.property.test.js`
    - **Validiert: Anforderungen 4.3**

  - [x] 6.4 Property-Test: Client-State-Ersetzung
    - **Property 6: Client-State-Ersetzung**
    - Generiert zufällige GameStates, prüft dass Client-State nach Empfang exakt dem empfangenen State entspricht
    - Testdatei: `tests/offline-game-controller.property.test.js`
    - **Validiert: Anforderungen 4.4**

  - [x] 6.5 Property-Test: Zugbasierte Steuerungsaktivierung
    - **Property 7: Zugbasierte Steuerungsaktivierung**
    - Generiert zufällige GameStates mit verschiedenen `currentPlayerIndex`-Werten, prüft Steuerung genau dann aktiviert wenn lokaler Spieler am Zug
    - Testdatei: `tests/offline-lobby.property.test.js`
    - **Validiert: Anforderungen 5.1, 5.2**

  - [x] 6.6 Unit-Tests für Offline-Game-Controller
    - Test: Host sendet initialen GameState bei Spielstart
    - Test: Client navigiert zum Game-Screen nach Empfang des initialen GameState
    - Test: Zugwechsel wird auf beiden Geräten angezeigt
    - Test: Spielende navigiert zum Result-Screen
    - Test: Host ignoriert Action wenn Client nicht am Zug
    - Testdatei: `tests/offline-game-controller.test.js`
    - _Anforderungen: 4.2, 4.3, 5.3, 5.4, 6.3, 6.4_

- [x] 7. Checkpoint — Game-Controller verifizieren
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Verbindungsüberwachung und Wiederherstellung
  - [x] 8.1 Verbindungsabbruch-Handling in `offline-game-controller.js` integrieren
    - `peer.onConnectionChange` registrieren für Status-Änderungen
    - `disconnected` → Warnung-Banner anzeigen, Spielzustand lokal beibehalten
    - `failed` → Meldung + "Zurück zum Start"-Button anzeigen
    - Automatische Wiederverbindung → Host sendet GameState-Resync an Client
    - _Anforderungen: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.2 Property-Test: Spielzustand-Erhaltung bei Disconnect
    - **Property 9: Spielzustand-Erhaltung bei Verbindungsabbruch**
    - Generiert zufällige GameStates, simuliert Disconnect, prüft State-Gleichheit (deep equality)
    - Testdatei: `tests/offline-game-controller.property.test.js`
    - **Validiert: Anforderungen 7.3**

  - [x] 8.3 Property-Test: Reconnection-State-Sync
    - **Property 10: Reconnection-State-Sync**
    - Generiert zufällige GameStates, simuliert Disconnect+Reconnect, prüft dass Client den Host-State erhält
    - Testdatei: `tests/offline-game-controller.property.test.js`
    - **Validiert: Anforderungen 7.4**

- [x] 9. Home-Screen und Navigation erweitern
  - [x] 9.1 Home-Screen um "Offline Multiplayer"-Option und "Spiel beitreten"-Button erweitern
    - "Offline Multiplayer" als Spieltyp-Option im Home-Dialog hinzufügen
    - "Spiel beitreten"-Button hinzufügen, navigiert zu `#lobby?playType=offline&role=client`
    - Host-Flow navigiert zu `#lobby?playType=offline&role=host&modeId=<modeId>`
    - i18n-Schlüssel in `locales/de.json` ergänzen für alle neuen UI-Texte (Offline-Lobby-Anleitungen, Fehlermeldungen, Buttons, Status-Texte)
    - _Anforderungen: 1.1, 2.1, 10.2_

- [x] 10. Service-Worker und Offline-Fähigkeit
  - [x] 10.1 Service-Worker-Cache erweitern (`sw.js`)
    - Neue Dateien zur `ASSETS_TO_CACHE`-Liste hinzufügen: `js/multiplayer/sdp-payload.js`, `js/multiplayer/qr-code.js`, `js/multiplayer/offline-game-controller.js`
    - Cache-Version hochzählen (`dice-game-v2`)
    - _Anforderungen: 10.1, 10.2, 10.3_

- [x] 11. Integration und Verdrahtung
  - [x] 11.1 Alle Komponenten im Lobby-Screen und Game-Screen verdrahten
    - Lobby-Screen: SDP-Payload-Serializer + QR-Code-Modul + WebRTC-Peer zusammenführen für vollständigen Signaling-Flow
    - Game-Screen: Offline-Game-Controller mit GameEngine und WebRTC-Peer verbinden
    - Spielstart: Host drückt "Spiel starten" → `offlineGameController.startGame()` → Client empfängt GameState → beide navigieren zum Game-Screen
    - Spielende: `gameOver`-Event → beide navigieren zum Result-Screen mit finalen Punktzahlen
    - Steuerung: Würfel/Halten nur aktiv wenn `offlineGameController.isMyTurn()` true
    - _Anforderungen: 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 6.3, 6.4_

  - [x] 11.2 Integrationstests
    - Test: Vollständiger Signaling-Flow (Offer → Answer → Connected)
    - Test: Spielstart über Lobby bis Game-Screen
    - Test: Zugwechsel und Spielende über DataChannel
    - Testdatei: `tests/offline-multiplayer-integration.test.js`
    - _Anforderungen: 3.3, 3.4, 6.3, 6.4, 5.3, 5.4_

- [x] 12. Finaler Checkpoint — Alle Tests bestehen
  - Ensure all tests pass, ask the user if questions arise.

## Hinweise

- Tasks mit `*` sind optional und können für ein schnelleres MVP übersprungen werden
- Jeder Task referenziert spezifische Anforderungen für Nachverfolgbarkeit
- Checkpoints stellen inkrementelle Validierung sicher
- Property-Tests validieren universelle Korrektheitseigenschaften aus dem Design-Dokument
- Unit-Tests validieren spezifische Szenarien und Edge-Cases
