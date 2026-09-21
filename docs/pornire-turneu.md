# Cum pornește un turneu la data stabilită

Turneul **nu** are un buton „Start” pe pagina publică. Data din câmpul **Start** (`startAt`) este verificată de **socket server**. Când ora a trecut și sunt destui jucători, statusul trece singur din `registration` în `live`.

## Ce trebuie să ruleze

În două terminale (sau deja pornite în producție):

```bash
npm run dev
npm run socket
```

Fără `npm run socket`, data de start **nu este verificată**. Next.js doar afișează turneul; cronologia e în `server/socket-server.js`.

Verificarea rulează la fiecare **5 secunde**.

## Cum setezi data

1. Creezi turneul din `/tournaments` (Create Tournament) sau din `/admin` (Create official tournament).
2. Completezi **Start** (`datetime-local`) — ora locală a browserului, salvată ca ISO în Mongo.
3. Jucătorii se înscriu cât timp statusul e `registration`.

Poți schimba data după aceea din `/admin` → Tournaments → **Edit** → Start.

## Când pornește automat

Turneul trece pe `live` dacă e încă `registration` și se îndeplinește **una** din:

| Condiție | Detaliu |
|---|---|
| Ora `startAt` a trecut **și** sunt cel puțin **2** înscriși | Cazul normal, „la data stabilită” |
| S-a umplut `maxPlayers` (și tot ≥ 2) | Poate porni **înainte** de `startAt` |

Dacă la `startAt` e **0 sau 1** jucător, rămâne în `registration`. Nu pornește gol. Când apare al doilea jucător *după* oră, următorul tick (max ~5s) îl pornește.

După start:

- jucătorii înscriși primesc notificare `tournament_started`
- la **Arena**, pairing-ul de partide rulează la fiecare 10s
- turneul se închide (`finished`) după `durationMs` de la `startAt` (dacă lipsește, socket-ul folosește **2 ore**)

## Pornire manuală (admin)

Dacă vrei să-l pornești **acum**, indiferent de oră:

1. `/admin` → Official tournaments
2. **Edit** pe turneu
3. Status → **live** → Save changes

Sau pune **Start** în trecut (sau peste 1 minut) și asigură-te că sunt ≥ 2 înscriși + `npm run socket`.

## Checklist înainte de oră

- [ ] `npm run socket` e pornit (și vede Mongo — `MONGODB_URI` în `.env.local`)
- [ ] Turneul e `registration`, nu `cancelled`
- [ ] `startAt` e ora corectă (vezi cardul **Starts** pe pagina turneului)
- [ ] Cel puțin 2 jucători înscriși (sau ești gata să-i ai până la oră)
- [ ] Pentru Arena: după `live`, pairing-ul pornește singur la 10s

## Dacă nu pornește

1. **Socket oprit** — cel mai des. Pornește `npm run socket` și uită-te în log după  
   `Tournament <nume> started (startAt reached)`.
2. **Un singur jucător** — așteaptă al doilea sau înscrie un cont de test.
3. **Ora greșită** — timezone: `datetime-local` e ora PC-ului. Verifică **Starts** pe `/tournaments/<id>`.
4. **Status cancelled / finished** — din admin pune-l înapoi pe `registration` sau `live`.
5. **Mongo / env** — socket-ul trebuie să aibă același `MONGODB_URI` ca Next.js.

## Unde e logica

```913:944:server/socket-server.js
async function checkTournamentStartFinish() {
  // ...
  // 1) maxPlayers atins → live
  // 2) now >= startAt && count >= 2 → live
}
```

Intervalul: **5s** (`checkTournamentStartFinish`), pairing Arena: **10s** (`tournamentArenaPairer`).
