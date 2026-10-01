# Changelog

## v1.7 — 2026-10-01
Restituzioni collegate al movimento originale e allegati aperti dentro l'app.

- **Restituzioni collegate**: quando registri una "Restituzione ricevuta" o una
  "Restituzione effettuata" puoi collegarla a un prestito erogato/debito contratto
  già esistente con quel contatto (il menu mostra data, importo e quanto resta su
  ciascuno). Nella scheda del contatto ogni movimento originale mostra sotto di sé
  le restituzioni collegate, con il rimanente aggiornato automaticamente o "Saldato
  per intero" quando arriva a zero. Il collegamento resta facoltativo: le
  restituzioni senza un movimento collegato restano in una sezione "Altre
  restituzioni" come prima. Eliminando un movimento originale, le sue restituzioni
  collegate non vengono cancellate: restano come movimenti a sé.
- **Allegati aperti dentro l'app**: toccando una prova ora si apre un visualizzatore
  a schermo intero nell'app stessa, con il file già interamente caricato (niente
  passaggio a un'app esterna) — immagini a piena vista, PDF incorporato, file di
  testo mostrati direttamente. Solo per i tipi che il telefono non può mostrare
  in-app resta, come scelta esplicita, il pulsante "Scarica / apri con un'altra
  app".

## v1.6 — 2026-09-30
Fix: finestra di sblocco impronta in italiano anche se il telefono è in inglese.

- La richiesta di impronta/Face ID su Android (es. Samsung) mostrava il titolo di
  sistema in inglese ("Fingerprint authentication") quando la lingua del telefono
  era impostata in inglese, perché non specificavamo un titolo esplicito e Android
  usava il proprio default di sistema. Ora il titolo e il sottotitolo della finestra
  sono impostati esplicitamente in italiano ("Sblocca Money Tracker" / "Verifica la
  tua identità per continuare"), indipendentemente dalla lingua del telefono.

## v1.5 — 2026-09-30
Fix: la welcome page non si ripresenta più a chi ha già l'app con dati esistenti.

- Chi ha già transazioni, contatti, movimenti di credito/debito o un profilo
  salvato viene considerato "già registrato" e non vede più la welcome page,
  anche quando aggiorna da una versione precedente alla v1.2 (dove l'onboarding
  non esisteva ancora e quindi manca il segnale interno che la dà per completata).
  La welcome page compare solo su un'installazione davvero nuova, oppure su un
  aggiornamento in cui non era mai stato completato l'accesso iniziale.

## v1.4 — 2026-09-28
Prove sui crediti/debiti, obiettivi di risparmio, impronta digitale e sezione Analisi.

- **Prove sui crediti/debiti**: su ogni movimento (prestito, debito, restituzione) si
  possono allegare file di qualsiasi tipo come prova (foto, PDF, ricevute...), sia al
  momento della creazione sia in un secondo momento dal pulsante "Aggiungi prova"
  sotto ogni movimento. Anteprima per le immagini, icona generica per gli altri file;
  tap per aprire/scaricare, limite di 4 MB per file. Salvati direttamente nel
  movimento (nessun upload esterno, restano solo sul dispositivo).
- **Obiettivi di risparmio**: nuova sezione nella Dashboard. Si crea un obiettivo con
  nome, importo target e data facoltativa; il progresso parte dal saldo al momento
  della creazione e si aggiorna da solo mano a mano che il saldo cresce, con barra di
  avanzamento e giorni rimanenti.
- **Impronta digitale / Face ID**: nelle Impostazioni, con il blocco app già attivo,
  si può abilitare lo sblocco biometrico (richiede una verifica riuscita per
  attivarlo). Alla riapertura dell'app parte automaticamente la richiesta di
  impronta/Face ID, con il PIN sempre disponibile come alternativa. Funziona solo
  nell'APK nativo (plugin `@aparajita/capacitor-biometric-auth`); nell'anteprima web
  compare una nota che lo segnala.
- **Sezione Analisi**: nuova scheda nella barra in basso con vista Giorno, Settimana,
  Mese o Anno, navigazione avanti/indietro nel periodo, totali entrate/uscite/saldo,
  grafico dell'andamento (per ora nel giorno, per giorno nella settimana/mese, per
  mese nell'anno), grafico a torta delle spese per categoria e l'elenco dei movimenti
  del periodo selezionato.
- Il backup JSON (ora versione 3) include anche gli obiettivi di risparmio.

## v1.3 — 2026-09-28
Sezione Profilo, selettore colore interno e notifiche di riscossione configurabili.

- **Nuova scheda Profilo** (barra in basso): modifica in qualsiasi momento i dati
  chiesti all'avvio — nome, anno di nascita, patrimonio di partenza e stipendio
  mensile. Il patrimonio aggiorna il saldo iniziale del Conto Corrente.
- **Categorie modificabili dal Profilo** (spese ed entrate): cambia nome e colore,
  aggiungi nuove categorie o eliminale. Ogni transazione salva nome, colore e icona
  della categoria al momento della creazione, quindi eliminare una categoria non
  rovina lo storico (movimenti, grafici ed export CSV restano corretti).
- **Selettore colore `SwatchPicker`** fatto in casa (niente `<input type="color">`
  nativo): cerchio col colore attuale -> pannello con slider Tonalità (0-360°) e
  Saturazione (0-100%), Valore fisso al 100%. Anteprima al centro, Annulla a sinistra
  e Conferma a destra: il colore cambia solo dopo la conferma. Salvataggio in
  esadecimale (es. `#FF0000`). Il selettore di una nuova categoria riparte da rosso
  puro (`PURE_RED`) dopo ogni creazione. Usato anche nell'onboarding (passo 2).
  Nuove funzioni `hsvToHex`, `hexToHueSat` e stile `.dt-hs-slider`.
- **Notifiche di riscossione**: interruttore on/off nel Profilo (spegnendolo annulla
  i promemoria già pianificati, riaccendendolo rischedula quelli futuri), stato del
  permesso di sistema con pulsante per concederlo e orario configurabile del
  promemoria (prima la notifica scattava alle 00:00 UTC). Sui movimenti compare 🔔
  con la data del promemoria. Eliminando un contatto vengono annullati anche i suoi
  promemoria. La sezione "Notifiche" delle Impostazioni si è spostata nel Profilo.
- Il backup JSON (ora versione 2) include anche profilo, categorie e conti, e
  l'import li ripristina.

## v1.2 — 2026-09-27
Welcome page (onboarding) e notifiche reali per i promemoria crediti.

- Nuova schermata di benvenuto al primo avvio, in 3 passaggi con indicatore di
  avanzamento e pulsante "Salta" (dal passo 2 in poi):
  1. **Profilo e privacy** — nome (obbligatorio), anno di nascita, patrimonio
     attuale e stipendio mensile (opzionali), più l'informativa privacy con
     accettazione obbligatoria per proseguire.
  2. **Categorie di spesa** — le categorie predefinite (nome e colore) già
     pronte, modificabili o eliminabili inline, con possibilità di aggiungerne
     di nuove scegliendo un colore dalla palette.
  3. **Contatti** — aggiunta rapida delle persone con cui si hanno crediti/debiti
     in sospeso, passaggio facoltativo.
  - Il patrimonio inserito imposta il saldo iniziale del conto "Conto Corrente";
    lo stipendio inserito genera automaticamente una prima transazione di
    entrata.
- **Notifiche locali reali** per i promemoria di riscossione crediti (prestiti
  erogati con data di promemoria): usa `@capacitor/local-notifications` su
  Android/iOS nativi, con fallback alla Web Notification API in versione
  browser. Nuova sezione "Notifiche" nelle Impostazioni per abilitare il
  permesso manualmente.
- Il nome inserito in onboarding compare come saluto in cima alla Dashboard.

## v1.1 — 2026-09-27
Aggiornamento ai workflow GitHub Actions (versioni personalizzate).

- `build-apk.yml`: aggiunto `android-actions/setup-android` per il setup esplicito
  dell'SDK Android; icone generate automaticamente da `public/icon-512.png`
  tramite `@capacitor/assets` invece di gestirle a mano; firma dell'APK ora
  iniettata direttamente ai flag di Gradle (`-Pandroid.injected.signing.*`),
  eliminando il patch manuale di `build.gradle`; aggiornate le versioni delle
  action (`checkout@v5`, `setup-node@v5`, `upload-artifact@v6`).
- `generate-keystore.yml`: il keystore ora si chiama `debug.keystore` con alias
  `androiddebugkey` e password `android` (coerente con le convenzioni Android
  standard), stampato anche in chiaro nel log oltre che come artifact di backup.
- `deploy.yml`: aggiornate le versioni delle action (`checkout@v7`,
  `setup-node@v6`), `cancel-in-progress` ora `true` per Pages.

## v1.0 — 2026-09-27
Prima versione.

- Modulo Cash Flow: aggiunta rapida transazioni (entrate/uscite), categorie con
  icona e colore, conti (Contanti, Conto Corrente, Carta), note.
- Modulo Crediti/Debiti: contatti manuali, registro prestiti/debiti/restituzioni,
  saldo netto per contatto, promemoria data opzionale.
- Dashboard: saldo totale disponibile, riepilogo entrate/uscite del mese, totale
  crediti/debiti, grafico a torta spese per categoria, grafico a barre andamento
  cash flow ultimi 6 mesi.
- Impostazioni: tema chiaro/scuro/automatico, blocco app con PIN locale,
  export backup completo (JSON), export transazioni (CSV), import backup (JSON).
- Setup iniziale build APK via GitHub Actions (keystore fisso + build Capacitor).
