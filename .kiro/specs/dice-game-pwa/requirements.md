# Anforderungsdokument — Dice Game PWA

## Einleitung

Dieses Dokument beschreibt die Anforderungen für eine Progressive Web App (PWA), die sich auf das Werfen von Würfeln fokussiert. Die App ermöglicht verschiedene Würfelspiele wie Kniffel und soll nach und nach um weitere Spielmodi erweiterbar sein. Das Design ist extrem minimalistisch mit Premium-UX-Qualität (Referenz: Apple, AirBnB, Sonos, Shopify). Die Würfel haben eine softe 3D-Optik. Die App nutzt das bestehende Design System des Projekts sowie motion.dev für Animationen. Multiplayer ist sowohl online als auch offline via Peer-to-Peer-Technologie (z.B. WebRTC) möglich.

## Glossar

- **App**: Die Dice Game Progressive Web App
- **Design_System**: Das im Projekt unter `design-system/` hinterlegte adaptive CSS-Design-System mit foundation.css, Komponenten, Modulen und Templates
- **Motion_System**: Ein auf motion.dev (https://motion.dev/) aufbauendes Animationssystem für die App
- **Würfel**: Ein virtueller 3D-Würfel mit softer, abgerundeter Optik, der geworfen werden kann
- **Würfelwurf**: Die Aktion, bei der ein oder mehrere Würfel geworfen werden und ein zufälliges Ergebnis erzeugen
- **Spielmodus**: Ein konkretes Regelwerk für ein Würfelspiel (z.B. Kniffel), das als Modul geladen wird
- **Spielmodus_Registry**: Das zentrale Register, über das Spielmodi registriert und geladen werden
- **Spieler**: Eine Person, die an einem Spiel teilnimmt
- **Lobby**: Der Bereich, in dem Spieler einem Spiel beitreten und Einstellungen vornehmen, bevor das Spiel startet
- **Online_Multiplayer**: Mehrspielermodus über eine Internetverbindung via WebSocket oder vergleichbare Technologie
- **Offline_Multiplayer**: Mehrspielermodus ohne Internetverbindung via WebRTC oder vergleichbare Peer-to-Peer-Technologie (z.B. im Flugzeug nutzbar)
- **Service_Worker**: Die PWA-Komponente, die Offline-Fähigkeit und Caching bereitstellt
- **Spielstand**: Der aktuelle Zustand eines laufenden Spiels inklusive Punktzahlen und Rundeninformationen
- **Scoreboard**: Die Anzeige der Punktzahlen aller Spieler während und nach einem Spiel

---

## Anforderungen

### Anforderung 1: Progressive Web App Grundstruktur

**User Story:** Als Spieler möchte ich die Dice Game App als PWA installieren und nutzen können, damit ich sie wie eine native App auf meinem Gerät verwenden kann.

#### Akzeptanzkriterien

1. THE App SHALL ein gültiges Web App Manifest bereitstellen, das Installation auf dem Homescreen ermöglicht
2. THE Service_Worker SHALL alle für den Spielbetrieb notwendigen Assets cachen, sodass die App nach erstmaligem Laden offline funktionsfähig ist
3. THE App SHALL responsive sein und sich an Bildschirmgrößen von 320px bis 1440px Breite anpassen
4. THE App SHALL das Design_System als einzige Grundlage für Layout, Farben, Typografie und Komponenten-Styling verwenden
5. THE App SHALL den Dark Mode automatisch über `prefers-color-scheme` unterstützen, ohne manuellen Toggle

---

### Anforderung 2: Motion System

**User Story:** Als Spieler möchte ich flüssige, hochwertige Animationen erleben, damit sich die App premium und lebendig anfühlt.

#### Akzeptanzkriterien

1. THE Motion_System SHALL auf der motion.dev-Bibliothek aufbauen und eine einheitliche API für alle Animationen der App bereitstellen
2. THE Motion_System SHALL vordefinierte Animationspresets für Standardübergänge bereitstellen (Einblenden, Ausblenden, Skalieren, Verschieben)
3. THE Motion_System SHALL spring-basierte Physik für Würfelanimationen verwenden, um ein natürliches Bewegungsgefühl zu erzeugen
4. WHILE ein Gerät `prefers-reduced-motion: reduce` meldet, SHALL das Motion_System alle Animationen auf sofortige Zustandswechsel ohne Bewegung reduzieren

---

### Anforderung 3: Würfel-Rendering und 3D-Optik

**User Story:** Als Spieler möchte ich visuell ansprechende Würfel mit softer 3D-Optik sehen, damit das Spielerlebnis hochwertig wirkt.

#### Akzeptanzkriterien

1. THE App SHALL Würfel mit softer, abgerundeter 3D-Optik rendern, die durch CSS-Schatten, Verläufe und Perspektive erzeugt wird
2. THE App SHALL die Würfelaugen (Pips) klar erkennbar und kontrastreich auf den Würfelflächen darstellen
3. WHEN ein Würfelwurf ausgelöst wird, SHALL das Motion_System eine Wurfanimation mit Rotation und Physik-Simulation abspielen
4. THE App SHALL zwischen 1 und 6 Würfel gleichzeitig darstellen können, abhängig vom aktiven Spielmodus
5. WHEN ein Spieler einzelne Würfel auswählt, SHALL die App den Auswahlzustand visuell durch eine subtile Hervorhebung kennzeichnen

---

### Anforderung 4: Würfelwurf-Mechanik

**User Story:** Als Spieler möchte ich Würfel werfen und faire Zufallsergebnisse erhalten, damit das Spiel korrekt abläuft.

#### Akzeptanzkriterien

1. WHEN ein Spieler die Wurf-Aktion auslöst, SHALL die App für jeden nicht-gehaltenen Würfel einen kryptografisch sicheren Zufallswert zwischen 1 und 6 generieren
2. WHEN ein Würfelwurf abgeschlossen ist, SHALL die App das Ergebnis aller Würfel als Array von Ganzzahlen (1–6) an den aktiven Spielmodus übergeben
3. THE App SHALL eine Geste (Swipe oder Tap) als primäre Wurf-Aktion unterstützen
4. WHEN ein Spieler einen Würfel als "gehalten" markiert, SHALL die App diesen Würfel beim nächsten Wurf nicht erneut würfeln

---

### Anforderung 5: Erweiterbares Spielmodus-System

**User Story:** Als Entwickler möchte ich neue Spielmodi einfach hinzufügen können, damit die App nach und nach um weitere Würfelspiele erweitert werden kann.

#### Akzeptanzkriterien

1. THE Spielmodus_Registry SHALL eine definierte Schnittstelle bereitstellen, über die neue Spielmodi registriert werden können
2. THE Spielmodus_Registry SHALL mindestens folgende Konfiguration pro Spielmodus akzeptieren: Name, Anzahl der Würfel, maximale Spieleranzahl, Rundenlimit und Bewertungslogik
3. WHEN die App startet, SHALL die Spielmodus_Registry alle registrierten Spielmodi laden und im Auswahlmenü anzeigen
4. THE App SHALL als initialen Spielmodus einen "Freies Würfeln"-Modus bereitstellen, der keine Regeln erzwingt
5. THE App SHALL als zweiten Spielmodus eine Kniffel-Implementierung bereitstellen, die das vollständige Kniffel-Regelwerk umsetzt

---

### Anforderung 6: Spielablauf und Scoreboard

**User Story:** Als Spieler möchte ich den Spielverlauf und die Punktzahlen aller Spieler übersichtlich sehen, damit ich den Spielstand jederzeit nachvollziehen kann.

#### Akzeptanzkriterien

1. THE Scoreboard SHALL die Punktzahlen aller Spieler in Echtzeit anzeigen und bei Änderungen aktualisieren
2. THE App SHALL den aktuellen Spieler und die aktuelle Runde klar hervorheben
3. WHEN ein Spiel endet, SHALL die App eine Ergebnisübersicht mit Endpunktzahlen und Platzierungen anzeigen
4. THE App SHALL den Spielstand lokal im Browser persistieren, sodass ein unterbrochenes Spiel fortgesetzt werden kann
5. WHEN ein Spieler die App während eines laufenden Spiels erneut öffnet, SHALL die App anbieten, das unterbrochene Spiel fortzusetzen

---

### Anforderung 7: Online Multiplayer

**User Story:** Als Spieler möchte ich online mit anderen Spielern spielen können, damit ich auch mit entfernten Freunden würfeln kann.

#### Akzeptanzkriterien

1. THE Online_Multiplayer SHALL eine Lobby bereitstellen, in der ein Spieler ein Spiel erstellen und andere Spieler über einen Einladungslink beitreten können
2. THE Online_Multiplayer SHALL Spielzüge und Spielstandänderungen in Echtzeit zwischen allen verbundenen Spielern synchronisieren
3. THE Online_Multiplayer SHALL zwischen 2 und 8 gleichzeitige Spieler pro Spiel unterstützen
4. IF ein Spieler die Verbindung verliert, THEN SHALL die App den Spieler als "getrennt" markieren und das Spiel für die verbleibenden Spieler fortsetzen
5. WHEN ein getrennter Spieler sich erneut verbindet, SHALL die App den aktuellen Spielstand synchronisieren und den Spieler wieder in das laufende Spiel eingliedern

---

### Anforderung 8: Offline Multiplayer (Peer-to-Peer)

**User Story:** Als Spieler möchte ich auch ohne Internetverbindung mit Spielern in meiner Nähe spielen können, damit ich z.B. im Flugzeug mit Freunden würfeln kann.

#### Akzeptanzkriterien

1. THE Offline_Multiplayer SHALL eine Peer-to-Peer-Verbindung zwischen Geräten im selben lokalen Netzwerk oder über WebRTC herstellen können
2. THE Offline_Multiplayer SHALL eine Lobby bereitstellen, in der nahegelegene Spieler sichtbar sind und einem Spiel beitreten können
3. THE Offline_Multiplayer SHALL Spielzüge und Spielstandänderungen zwischen allen verbundenen Peers synchronisieren
4. THE Offline_Multiplayer SHALL ohne Internetverbindung und ohne zentralen Server funktionieren
5. IF die Peer-to-Peer-Verbindung zwischen zwei Geräten abbricht, THEN SHALL die App den betroffenen Spieler als "getrennt" markieren und eine erneute Verbindung ermöglichen

---

### Anforderung 9: Minimalistisches UI und Premium UX

**User Story:** Als Spieler möchte ich eine extrem aufgeräumte, intuitive Oberfläche erleben, damit sich die App hochwertig und mühelos anfühlt.

#### Akzeptanzkriterien

1. THE App SHALL maximal eine primäre Aktion pro Bildschirm hervorheben, um kognitive Belastung zu minimieren
2. THE App SHALL Übergänge zwischen Bildschirmen mit dem Motion_System animieren, um ein nahtloses Navigationsgefühl zu erzeugen
3. THE App SHALL haptisches Feedback (Vibration API) beim Würfelwurf auslösen, sofern das Gerät Vibration unterstützt
4. THE App SHALL alle interaktiven Elemente mit einer Mindestgröße von 44x44 CSS-Pixeln darstellen, um Touch-Bedienbarkeit sicherzustellen
5. THE App SHALL Ladezeiten und Zustandswechsel durch Skeleton-Screens oder subtile Animationen überbrücken, sodass keine leeren Bildschirme sichtbar sind
6. THE App SHALL alle Texte, Labels und Statusmeldungen über ein zentrales Lokalisierungssystem bereitstellen, um spätere Mehrsprachigkeit zu ermöglichen

---

### Anforderung 10: Barrierefreiheit

**User Story:** Als Spieler mit Einschränkungen möchte ich die App vollständig bedienen können, damit niemand vom Spielerlebnis ausgeschlossen wird.

#### Akzeptanzkriterien

1. THE App SHALL alle interaktiven Elemente mit semantischem HTML und ARIA-Attributen auszeichnen
2. THE App SHALL vollständig per Tastatur bedienbar sein, einschließlich Würfelwurf, Würfelauswahl und Navigation
3. THE App SHALL Würfelergebnisse nach jedem Wurf über eine ARIA-Live-Region als Screenreader-Ansage bereitstellen
4. THE App SHALL Farbkontraste gemäß WCAG 2.1 Level AA einhalten, gesteuert über das `data-wcag`-Attribut des Design_Systems
