# DEBUG SESSION: ai-game-start-error
**Status:** [OPEN]  
**Session ID:** ai-game-start-error  
**Created:** 2026-09-20  
**Description:** Eroare la pornirea unei partide cu AI (tab-ul Play/vs AI, buton Start joc Bot)

## Symptome
- Utilizatorul accesează /play, selectează tab Bot sau vs AI
- Alege nivel Bot (1-10) și apasă buton start
- La apăsarea butonului Start apare eroare
- Jocul cu Bot nu se creează, redirect către /game/[id] nu se produce sau eroare imediat după creare

## Pași de reproducere (presupuneri)
1. Conectat cu cont autentificat (user logat, token JWT valid)
2. Navigare către `/play`
3. Selectează tab-ul **vs AI** (sau Bot)
4. Selectează nivel (ex: level 5 default)
5. Apasă buton Start joc cu Bot → EROARE

## Environment
- Next.js dev http://localhost:3000
- Socket server http://localhost:3001 (independet)
- MongoDB Mongoose conectat (MONGODB_URI în .env.local)
- Auth cu jose JWT httpOnly cookie

## 3–5 FALSIFIABLE HYPOTHESES (A INSTRUMENTA)
H1: **Eroare POST `/api/games` cu `botMode: true`** — payload incorect / lipsă importuri / validare esuează (ex `botLevel` neconvertit corect, `opponentUserId` = Bot user dar ensureBotUser doar în socket, nu în route)  
H2: **Bot user-ul `Stockfish AI` nu există în Mongo la momentul POST /api/games** — `ensureBotUser()` rulează DOAR în socket-server start (phase6), dar POST /api/games încearcă să caute `Bot-Stockfish` user fără să-l creeze dacă lipsește → `opponentUserId = null` + validare Game schema esuează.  
H3: **Eroare pe client PlayClient — route `/game/[gameId]` se încarcă, dar socket connect/game:join** — Socket emite ceva eroare după redirect (ex. `isBotTurn` apelat dar `_BotUserId` încă nedeterminat, sau bot triggers timing issue).  
H4: **`initialTime` sau `increment` default Bot** — PlayClient trimite valori lipsă pentru partida cu Bot (ex. quick match time controls vs Bot time controls diferite).  
H5: **Eroare autentificare** — Utilizatorul nu e autentificat dar UI afișează buton, deci POST /api/games returnează 401 dar PlayClient nu afișează eroarea corect.

## Evidence Collection Points (instrumentație)
- P1: PlayClient handleCreateGame withBot — PRE + POST fetch call (url, payload, response status/body)
- P2: Route /api/games POST branch `botMode === true` — pre-Game.create values (botUser lookup result, opponentUserId, payload sanitizat) + catch bloc stack
- P3: Socket game:join → ensureBotUser (dacă este apelat prima dată după connect), `_BotUserId` valoare
- P4: GameClient after mount — socket.emit('game:join') ack/err, bot state

## Evidence & FALSIFICARE / CONFIRMARE Hipoteze
- ❌ H1 (payload API): Nu — validări OK.
- ❌ H5 (Bot level payload): Nu — level trimis corect.
- ❌ H3 (PlayClient redirect error): Nu.
- ✅ **H2 (CONFIRMED ROOT CAUSE) — User Bot invalid username.**
  `Bot-Stockfish` are CRATIMĂ dar User schema regex username `/^[a-zA-Z0-9_]+$/` DOAR litere/cifre/underscore. → User.create aruncă `User validation failed: username` → API route catch → 500 Internal error → toast client "Eroare creare".
  Evidence: socket log "Bot user create failed: User validation failed: username: Username can only contain letters, numbers and underscores"
- ✅ **BUG CONFIRMAT #2:** triggerBotMove în game:join DOAR în interiorul blocului `status === waiting' → jocurile create POST API (status playing deja) aveau trigger NONE → Bot nu muta.
- ✅ **BUG CONFIRMAT #3:** Socket standalone (`npm run socket`) NU încarcă `.env.local` (Next.js îl încarcă automat dar Node.js nu). → `process.env.MONGODB_URI` undefined → DB skipped. → ensureBotUser nu rula, _BotUserId null, Bot nici măcar nu era detectat.

## Fix-uri aplicate
1. **(ROOT)** Înlocuire username crățimă Bot_Stockfish (fară `-`):
   - `/app/api/games/route.js` L49+L57: Bot_Stockfish
   - `/server/socket-server.js` ensureBotUser L109+L115: Bot_Stockfish
2. **Bug #1 triggerBotMove:** Socket L1551-1553 adaugat trigger BLOC ADIȚIONAL EXTERIOR `if (gm.data.status === 'playing' && isBotPlayer(gm.data)) { triggerBotMove }` — rulează și pentru jocurile create direct playing (API POST vs-AI).
3. **Bug #2 dotenv load:** Socket L12-L31 adaugat IIFE `loadDotEnvFiles()` care parsează `.env.local` și `.env` din project root, injectează `process.env` (dacă nu există deja) — astfel MONGODB_URI, AUTH_SECRET, NEXT_PUBLIC_APP_URL etc. disponibile în Node.js standalone.

## Post-fix Socket log evidence
```
[Database] Connected to MongoDB OK
[Bot] Bot-Stockfish ready: 6aaf2654...
[Socket] Listening on port 3001
```
