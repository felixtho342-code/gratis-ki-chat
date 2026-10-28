# Gratis KI Chat

Eine deutschsprachige Desktop-Chat-App mit Electron. Sie verwendet den
kostenlosen, anonym erreichbaren Textdienst von Pollinations.ai. Es wird kein
KI-Modell auf den Rechner heruntergeladen und für den Chat ist kein eigener
API-Schlüssel erforderlich. Die App speichert den Gesprächsverlauf lokal im
Electron-Browserprofil.

## Voraussetzungen und Entwicklung

- Node.js 22.12 oder neuer
- Windows für den unten beschriebenen Windows-Installer

```powershell
npm install
npm start
```

Der kostenlose Dienst wird ohne Verfügbarkeitsgarantie angeboten und begrenzt
anonyme Anfragen. Bei Drosselung kann der Chat auf Puter.js ausweichen. Puter
benötigt eine kostenlose Anmeldung und hat ein eigenes monatliches Gratis-
Kontingent sowie Request-Limits; kein Anbieter garantiert unbegrenzte Anfragen
oder völlige Cooldown-Freiheit. Du kannst im Chat zwischen automatischer
Auswahl, Pollinations und Puter wählen. Für Puter werden verfügbare kostenlose
Modelle dynamisch aufgelistet. Die Nachrichten werden zur Beantwortung an den
jeweiligen Anbieter übertragen; beachte
dessen [Datenschutzbestimmungen](https://pollinations.ai/privacy) und
[Nutzungsbedingungen](https://pollinations.ai/terms).
Puter weist auf seine
[Datenschutzbestimmungen](https://puter.com/privacy) und
[Nutzungsbedingungen](https://puter.com/terms) hin.

## Sprache und Chat-Export

Über das Mikrofon kannst du Text diktieren. Die Spracherkennung benötigt eine
Internetverbindung und kann Audio an den Spracherkennungsdienst des Systems
übertragen. Antworten lassen sich über **Vorlesen** mit der Systemstimme
abspielen. **Chat exportieren** speichert den aktuellen Verlauf als Markdown
im Download-Ordner. Der Verlauf wird außerdem lokal im App-Profil gespeichert.

## Windows-Installer

```powershell
npm run build:win
```

Der Installer liegt anschließend unter `dist/`. Diese lokale Build-Variante
enthält noch keinen Update-Kanal. Für automatische Updates muss das Projekt
zuerst in ein öffentliches GitHub-Repository gepusht werden; `GITHUB_REPOSITORY`
(Format `Besitzer/Repository`) muss beim Erstellen gesetzt sein.

## Releases und automatische Updates

Der Workflow `.github/workflows/release.yml` erstellt bei einem Git-Tag wie
`v1.0.4` einen Windows-Installer und veröffentlicht ihn als GitHub Release.
Die veröffentlichten Metadaten werden vom eingebauten Updater verwendet.
Auf Windows werden neue Versionen beim Start und danach alle sechs Stunden
geprüft, automatisch heruntergeladen und beim Beenden installiert.

Für einen Release:

1. `version` in `package.json` erhöhen und den Commit pushen.
2. Ein passendes Tag erstellen und pushen, zum Beispiel:

   ```powershell
   git tag v1.0.4
   git push origin v1.0.4
   ```

3. Im GitHub-Repository unter **Settings → Actions → General** erlauben, dass
   Actions Schreibzugriff auf Releases/Inhalte haben. Der Workflow verwendet
   das integrierte `GITHUB_TOKEN`; Nutzer der App benötigen keinen Token.

Der automatische Update-Kanal kann erst funktionieren, nachdem ein Release
für das echte GitHub-Repository veröffentlicht wurde.
