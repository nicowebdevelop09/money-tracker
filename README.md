# Money Tracker

App offline al 100% per gestione finanziaria personale: spese/entrate, crediti e
debiti tra persone ("chi deve a chi"), e dashboard con grafici. Nessun server
backend, nessuna dipendenza cloud — tutti i dati vivono solo sul dispositivo
(`localStorage` nella WebView).

## Moduli
1. **Cash Flow** — transazioni con importo, categoria, conto, data, note.
2. **Crediti/Debiti** — contatti manuali, registro prestiti/debiti/restituzioni,
   promemoria data (visivo, senza notifica push nella versione base).
3. **Dashboard** — saldo totale, riepilogo mensile, grafico a torta per categoria,
   grafico a barre sull'andamento del cash flow (Recharts).

Include anche: blocco app con PIN locale, export/import backup in JSON, export
transazioni in CSV, tema chiaro/scuro/automatico.

## Sviluppo locale

```bash
npm install
npm run dev
```

## Build APK Android (senza installare nulla in locale)

Tutta la compilazione avviene nel cloud tramite GitHub Actions:

1. **Una sola volta**: Actions → "Generate Keystore" → Run workflow. Scarica
   l'artifact, copia il contenuto di `money-tracker.keystore.base64` e salvalo
   come secret del repository `DEBUG_KEYSTORE_BASE64`
   (Settings → Secrets and variables → Actions).
2. **Ad ogni aggiornamento**: Actions → "Build APK (Capacitor)" → Run workflow.
   A build completata, scarica l'artifact `money-tracker-apk` (contiene
   `app-debug.apk`) e installalo sul telefono — stessa firma, stessi dati
   mantenuti.

## Versione web (opzionale)

Il workflow `deploy.yml` pubblica la build su GitHub Pages ad ogni push su
`main`, oltre che manualmente da Actions.

## Struttura del progetto

Vedi `CHANGELOG.md` per lo storico versioni.
