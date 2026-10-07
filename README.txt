GrInnZoVe — RACCOLTA DATI LCA v7
================================

NOVITÀ v7
- Corretto il calcolo ADG: (peso medio uscita - peso medio ingresso) / giorni trascorsi.
- Un peso vuoto non viene più interpretato come zero.
- Il conteggio dei giorni usa le date calendario in UTC, senza effetti di fuso orario o ora legale.
- Rimossa l'esportazione CSV completa.
- Esportazione Excel (.xlsx) per la singola azienda attiva.
- Excel in formato pulito: campi sulle colonne e record/valori sulle colonne, senza intestazioni colorate né filtri-tabella.
- Ogni foglio riporta Azienda, ID azienda e, quando applicabile, ID record.
- I fogli mantengono la stessa sequenza di campi tra aziende, per facilitare l'aggregazione successiva.
- Schermata "Dati inseriti" per controllare i record già salvati nell'app.

FOGLI EXCEL
Riepilogo, Azienda, Management, Partite, Stalle, Gruppi box, Razioni animali,
Reflui stoccaggi, Spandimenti, Piano colturale, Trattamenti, Irrigazione,
Razione biogas e Documenti.

ARCHITETTURA E PRIVACY
- HTML + CSS + JavaScript puro.
- Il file Excel viene costruito localmente dal browser.
- Dati strutturati: localStorage.
- Allegati: IndexedDB locale.
- Nessun dato viene inviato automaticamente a server esterni.
- Backup JSON disponibile; gli allegati binari non sono inclusi nel backup JSON.

AVVIO WINDOWS
1. Estrarre l'intera cartella.
2. Doppio clic su AVVIA_LCA.bat.
3. Si apre http://127.0.0.1:8000/index.html

EXPORT EXCEL v7
- Ogni foglio usa intestazioni in riga 1 e record nelle righe successive.
- ID azienda derivato dalla ragione sociale (es. AZIENDA_ROSSI).
- ID record semplici per sezione (PAR-001, STA-001, REF-001, ecc.).


IMPORTAZIONE DOCUMENTI
- CSV/TSV/TXT: lettura diretta e mappatura colonne
- XLSX: lettura locale dei fogli e mappatura colonne
- PDF: tentativo di lettura testuale; in alternativa si può copiare/incollare la tabella nel pannello di estrazione
- I dati importati vengono aggiunti ai moduli strutturati e all'Excel aziendale.


V10: importazione documentale integrata. PDF digitali via PDF.js; PDF scannerizzati e foto via OCR Tesseract.js quando connessi a Internet. Profili iniziali: PUA Veneto, Piano Utilizzo/Fascicolo AVEPA, Registro concimazioni, Registro trattamenti. Verifica umana richiesta prima dell’importazione.


v11: OCR PDF migliorato (risoluzione maggiore, orientamento corretto, parser geometrici per PUA/Registro concimazioni e parser tabellare per Registro trattamenti). Per OCR serve connessione Internet al primo utilizzo.
