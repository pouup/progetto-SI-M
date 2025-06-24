# Prova Pratica – Esame di Sicurezza dell’Informazione M

Questo progetto rappresenta la prova pratica per l’esame di **Sicurezza dell’Informazione**. L’obiettivo è realizzare un sistema sicuro per la condivisione e la raccolta di messaggi cifrati, sfruttando tecniche di crittografia moderna e la suddivisione di un segreto tramite lo Shamir’s Secret Sharing.

Una demo del progetto è disponibile su [GitHub Pages](https://pouup.github.io/progetto-SI-M/) (è consigliato l'uso di uno smartphone).

## Idea e Funzionamento

1. **Cifratura del Messaggio**
   - L’utente inserisce un messaggio che viene cifrato con AES-GCM utilizzando una chiave segreta generata casualmente.

2. **Suddivisione della Chiave**
   - La chiave viene suddivisa in _n_ quote, di cui almeno _k_ (threshold) sono necessarie per ricostruirla.
   - Ogni quota viene firmata digitalmente con Ed25519 per garantirne l’autenticità.

3. **Distribuzione tramite QR Code**
   - Sia il messaggio cifrato che le singole quote vengono convertiti in QR code.
   - I QR code possono essere stampati o condivisi digitalmente.

4. **Raccolta e Ricostruzione**
   - Tramite l’interfaccia web, è possibile scansionare i QR code delle quote.
   - Quando vengono raccolte almeno _k_ quote valide, il sistema ricostruisce la chiave segreta e decifra il messaggio.

## Componenti del Progetto

- **qrgen.py**: Script Python per generare il messaggio cifrato, suddividere la chiave e creare i QR code.
- **www/**: Interfaccia web per la raccolta dei QR code, la verifica delle firme e la ricostruzione del messaggio.
- **sss.ipynb**: Notebook Jupyter che dimostra lo Shamir’s Secret Sharing.
- **testdata/**: Cartella contenente i QR code generati per il messaggio cifrato e le quote.

## Requisiti

- Python 3 con le librerie `cryptography`, `qrcode`.
- Browser moderno(?).
