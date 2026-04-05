# Anforderungsdokument: Offline P2P Multiplayer

## Einleitung

Dieses Feature ermöglicht es zwei Spielern, das Würfelspiel (Kniffel / Free Roll) auf zwei separaten Geräten ohne Internetverbindung zu spielen. Die Verbindung wird über WebRTC Peer-to-Peer hergestellt. Da kein Signaling-Server verfügbar ist, erfolgt der Verbindungsaufbau über manuellen SDP-Austausch (QR-Code oder Copy/Paste). Ein typischer Anwendungsfall: Zwei Personen spielen im Flugzeug auf ihren Smartphones gegeneinander.

## Glossar

- **App**: Die Kniffel/Free-Roll PWA-Würfelspiel-Anwendung
- **Host**: Der Spieler, der ein neues Offline-Multiplayer-Spiel erstellt und das SDP-Offer generiert
- **Client**: Der Spieler, der dem Spiel des Hosts beitritt, indem er das SDP-Offer empfängt und ein SDP-Answer zurücksendet
- **Signaling**: Der Prozess des Austauschs von SDP-Offer/Answer und ICE-Kandidaten zwischen Host und Client, um eine WebRTC-Verbindung herzustellen
- **SDP-Payload**: Ein serialisiertes JSON-Objekt, das SDP-Beschreibung und ICE-Kandidaten enthält
- **DataChannel**: Der WebRTC-RTCDataChannel, über den Spielaktionen zwischen Host und Client übertragen werden
- **GameAction**: Eine JSON-Nachricht, die eine Spielaktion beschreibt (z.B. Würfeln, Halten, Punktwahl)
- **GameState**: Der vollständige Spielzustand, der vom Host verwaltet und an den Client synchronisiert wird
- **Lobby_Screen**: Der Bildschirm, auf dem Spieler vor Spielbeginn die Verbindung herstellen
- **QR-Code**: Ein zweidimensionaler Barcode, der den SDP-Payload visuell kodiert

## Anforderungen

### Anforderung 1: Offline-Multiplayer starten (Host)

**User Story:** Als Host möchte ich ein Offline-Multiplayer-Spiel erstellen, damit ein zweiter Spieler meinem Spiel beitreten kann.

#### Akzeptanzkriterien

1. WHEN der Benutzer auf dem Home-Screen einen Spielmodus auswählt und "Offline Multiplayer" als Spieltyp wählt, THE App SHALL zum Lobby_Screen navigieren und die Host-Rolle zuweisen.
2. WHEN der Lobby_Screen als Host geladen wird, THE App SHALL automatisch ein SDP-Offer generieren und als QR-Code anzeigen.
3. THE App SHALL den SDP-Payload zusätzlich als kopierbaren Text bereitstellen, damit der Austausch auch ohne Kamera möglich ist.
4. WHILE das SDP-Offer generiert wird, THE App SHALL einen Ladezustand im Lobby_Screen anzeigen.

### Anforderung 2: Offline-Multiplayer beitreten (Client)

**User Story:** Als Client möchte ich dem Spiel des Hosts beitreten, damit wir zusammen spielen können.

#### Akzeptanzkriterien

1. WHEN der Benutzer auf dem Home-Screen "Spiel beitreten" wählt, THE App SHALL zum Lobby_Screen navigieren und die Client-Rolle zuweisen.
2. WHEN der Lobby_Screen als Client geladen wird, THE App SHALL eine Möglichkeit zum Scannen des QR-Codes des Hosts anbieten.
3. THE App SHALL dem Client alternativ ein Textfeld bereitstellen, in das der SDP-Payload des Hosts manuell eingefügt werden kann.
4. WHEN der Client den SDP-Payload des Hosts empfangen hat, THE App SHALL automatisch ein SDP-Answer generieren und als QR-Code sowie kopierbaren Text anzeigen.
5. WHILE der Client auf den SDP-Payload des Hosts wartet, THE App SHALL eine Anleitung zum Verbindungsaufbau anzeigen.

### Anforderung 3: Signaling-Ablauf (Verbindungsaufbau)

**User Story:** Als Spieler möchte ich die WebRTC-Verbindung ohne Server herstellen, damit das Spiel komplett offline funktioniert.

#### Akzeptanzkriterien

1. WHEN der Host ein SDP-Offer erstellt, THE App SHALL SDP-Beschreibung und alle ICE-Kandidaten in einem einzigen JSON-Objekt bündeln.
2. WHEN der Client das SDP-Offer des Hosts verarbeitet hat, THE App SHALL ein SDP-Answer mit SDP-Beschreibung und ICE-Kandidaten als JSON-Objekt erzeugen.
3. WHEN der Host das SDP-Answer des Clients empfangen hat, THE App SHALL die WebRTC-Verbindung aufbauen und den DataChannel öffnen.
4. WHEN der DataChannel den Status "open" erreicht, THE App SHALL beide Spieler als "verbunden" im Lobby_Screen anzeigen.
5. IF der Signaling-Payload ungültig ist oder nicht geparst werden kann, THEN THE App SHALL eine verständliche Fehlermeldung anzeigen und den Benutzer auffordern, den Vorgang zu wiederholen.
6. FOR ALL gültige SDP-Payloads, das Serialisieren und anschließende Deserialisieren eines SDP-Payload SHALL ein äquivalentes Objekt erzeugen (Round-Trip-Eigenschaft).

### Anforderung 4: Spielzustand-Synchronisation

**User Story:** Als Spieler möchte ich, dass der Spielzustand auf beiden Geräten synchron ist, damit das Spiel fair und konsistent abläuft.

#### Akzeptanzkriterien

1. THE App SHALL den Host als autoritative Quelle für den GameState verwenden (Host-Authority-Modell).
2. WHEN ein Spieler eine GameAction ausführt (Würfeln, Halten, Punktwahl), THE App SHALL die Aktion über den DataChannel an den anderen Spieler senden.
3. WHEN der Host eine GameAction vom Client empfängt, THE App SHALL die Aktion auf den GameState anwenden und den aktualisierten GameState an den Client senden.
4. WHEN der Client einen aktualisierten GameState vom Host empfängt, THE App SHALL den lokalen Zustand durch den empfangenen GameState ersetzen.
5. THE App SHALL jede GameAction mit einem Zeitstempel und einer Spieler-ID versehen.

### Anforderung 5: Spielablauf über zwei Geräte

**User Story:** Als Spieler möchte ich auf meinem eigenen Gerät würfeln und Punkte wählen, damit jeder Spieler sein eigenes Gerät nutzen kann.

#### Akzeptanzkriterien

1. WHILE der aktuelle Spieler am Zug ist, THE App SHALL auf dem Gerät des aktiven Spielers die Würfel- und Halte-Steuerung aktivieren.
2. WHILE ein Spieler nicht am Zug ist, THE App SHALL auf dem Gerät des wartenden Spielers die Würfel- und Halte-Steuerung deaktivieren und den aktuellen Spielzustand anzeigen.
3. WHEN ein Spieler seinen Zug beendet (Punktwahl in Kniffel oder nächster Zug in Free Roll), THE App SHALL den Zugwechsel auf beiden Geräten anzeigen.
4. WHEN das Spiel beendet ist, THE App SHALL auf beiden Geräten den Ergebnis-Screen mit den finalen Punktzahlen anzeigen.

### Anforderung 6: Spiel aus der Lobby starten

**User Story:** Als Host möchte ich das Spiel starten, sobald beide Spieler verbunden sind.

#### Akzeptanzkriterien

1. WHILE weniger als zwei Spieler verbunden sind, THE App SHALL den "Spiel starten"-Button im Lobby_Screen deaktivieren.
2. WHEN beide Spieler verbunden sind, THE App SHALL den "Spiel starten"-Button aktivieren.
3. WHEN der Host den "Spiel starten"-Button drückt, THE App SHALL den initialen GameState erstellen und an den Client senden.
4. WHEN der Client den initialen GameState empfängt, THE App SHALL zum Game-Screen navigieren.

### Anforderung 7: Verbindungsabbruch und Wiederherstellung

**User Story:** Als Spieler möchte ich bei einem Verbindungsabbruch informiert werden und die Möglichkeit haben, das Spiel fortzusetzen.

#### Akzeptanzkriterien

1. WHEN die WebRTC-Verbindung den Status "disconnected" erreicht, THE App SHALL auf beiden Geräten eine Warnung anzeigen, dass die Verbindung unterbrochen ist.
2. WHEN die WebRTC-Verbindung den Status "failed" erreicht, THE App SHALL eine Meldung anzeigen, dass die Verbindung verloren wurde, und eine Option zum Zurückkehren zum Home-Screen anbieten.
3. WHILE die Verbindung unterbrochen ist, THE App SHALL den Spielzustand lokal beibehalten.
4. IF die WebRTC-Verbindung nach einem Abbruch automatisch wiederhergestellt wird, THEN THE App SHALL den GameState zwischen Host und Client erneut synchronisieren.

### Anforderung 8: QR-Code-Anzeige und -Scan

**User Story:** Als Spieler möchte ich den SDP-Austausch über QR-Codes durchführen, damit die Verbindung schnell und einfach hergestellt werden kann.

#### Akzeptanzkriterien

1. WHEN ein SDP-Payload als QR-Code angezeigt werden soll, THE App SHALL den JSON-String in einen QR-Code kodieren und auf dem Bildschirm darstellen.
2. WHEN der Benutzer den QR-Code-Scanner aktiviert, THE App SHALL die Gerätekamera öffnen und den QR-Code des anderen Geräts scannen.
3. WHEN ein QR-Code erfolgreich gescannt wurde, THE App SHALL den enthaltenen SDP-Payload automatisch verarbeiten.
4. IF die Kamera nicht verfügbar ist oder der Zugriff verweigert wird, THEN THE App SHALL den Benutzer auf die manuelle Texteingabe hinweisen.
5. IF der gescannte QR-Code keinen gültigen SDP-Payload enthält, THEN THE App SHALL eine Fehlermeldung anzeigen und den Benutzer auffordern, erneut zu scannen.

### Anforderung 9: SDP-Payload Serialisierung

**User Story:** Als Entwickler möchte ich, dass der SDP-Payload zuverlässig serialisiert und deserialisiert wird, damit der Signaling-Prozess fehlerfrei funktioniert.

#### Akzeptanzkriterien

1. THE App SHALL den SDP-Payload als kompaktes JSON serialisieren, das SDP-Typ, SDP-String und ICE-Kandidaten enthält.
2. THE App SHALL den serialisierten SDP-Payload validieren, bevor er verarbeitet wird (Typ-Prüfung auf erforderliche Felder: sdp, type, candidates).
3. FOR ALL gültige SDP-Payload-Objekte, das Serialisieren (JSON.stringify) und Deserialisieren (JSON.parse) SHALL ein strukturell äquivalentes Objekt erzeugen.
4. IF ein SDP-Payload das Validierungsschema nicht erfüllt, THEN THE App SHALL einen beschreibenden Fehler zurückgeben, der das fehlende oder ungültige Feld benennt.

### Anforderung 10: Offline-Fähigkeit

**User Story:** Als Spieler möchte ich das Offline-Multiplayer-Feature ohne Internetverbindung nutzen, damit ich auch im Flugzeug spielen kann.

#### Akzeptanzkriterien

1. THE App SHALL alle für das Offline-Multiplayer-Feature benötigten Ressourcen (JavaScript, CSS, HTML-Templates) über den Service Worker cachen.
2. WHEN die App ohne Internetverbindung gestartet wird, THE App SHALL den Home-Screen mit der Offline-Multiplayer-Option anzeigen.
3. THE App SHALL für die WebRTC-Verbindung keine externen STUN/TURN-Server voraussetzen, wenn sich beide Geräte im selben lokalen Netzwerk befinden oder direkt verbunden sind.
