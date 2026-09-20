# Chess Arena — PHASE 2: Chess Engine, Socket.IO Live Game, Elo Rating

## Overview
- **Summary**: PHASE 2 transformă placeholder-ul de joc dintr-o partidă de șah *live*, complet funcțională: creare joc, alăturare jucători, mutări validate strict pe server prin `chess.js`, ceas controlat de server cu timeout, rejoin după refresh, chat real persistent, resign/offer draw/accept/decline/rematch, actualizare Elo pe categorii (blitz/rapid/classical) în baza de date, lobby cu jocuri live+waiting.
- **Purpose**: PHASE 1 a livrat infrastructura și UI-uri; PHASE 2 oferă *prima experiență de joc reală* — un utilizator nou se poate înregistra, își creează o partidă custom sau se alătură prin Quick Match, joacă împotriva unui adversar real, iar scorul său Elo se actualizează automat în funcție de rezultat și categorie de timp.
- **Target Users**: Orice jucator înregistrat pe Chess Arena, testatori manuali în 2 sesiuni browser diferite.

## Goals
1. ✔ Mutări valide validate **doar pe server** (clientul afișează doar ce primește).
2. ✔ Ceasul rulează pe server; 0 secunde = finish prin timeout.
3. ✔ Persistență MongoDB completă: mutări, stări, rezultate, chat, ratinguri.
4. ✔ Rejoin funcțional după refresh / reconectare socket; partida nu se pierde.
5. ✔ Creare joc (custom / privat cu invite link) + Quick Match (coadă).
6. ✔ Lobby afișează jocuri waiting + live cu info (oponenți, ceas, status).
7. ✔ Actualizare Elo (3 categorii separate: blitz < 3min / rapid 3–10min / classical > 10min) și statistici (gamesPlayed/Won/Draw/Lost) după fiecare terminare.
8. ✔ Păstrarea tuturor cerințelor PHASE 1: JavaScript pur (fără TS), Next.js App Router, Tailwind dark/light mode, design premium, `npm run build` exit 0.

## Non-Goals (excluse din PHASE 2)
- ❌ WebRTC audio/video peer-to-peer real (păstrăm doar signaling passthrough și UI — PHASE 6).
- ❌ Algoritmi de turneu (pairing, round-robin, swiss, bracket KO) — PHASE 5.
- ❌ Stockfish engine / bot / analysis — PHASE 7.
- ❌ Redis pub/sub / multi-instanta socket — PHASE 7.
- ❌ Anti-cheat detection — PHASE 7.
- ❌ Modificări arhitecturale majore (ex: trecere la Pages Router, TypeScript, Redux) — interzis per reguli generale.

## Background & Context
- Proiectul se află în `d:\NextAI\chessarena`, repo gol inițial, PHASE 1 a trecut `npm run build` cu exit 0, cu 5 modele Mongoose (`User`, `Game`, `Tournament`, `TournamentPlayer`, `Message`), 4 rute API auth (`/api/auth/{register,login,logout,me}`), 11 pagini, Socket.IO server standalone cu `GameManager` (partial) + `chess.js` validare, dar fără persistență Mongo reală, fără Quick Match, fără Elo update.
- Vezi [README.md](file:///d:/NextAI/chessarena/README.md), [socket-server.js](file:///d:/NextAI/chessarena/server/socket-server.js), [app/game/[gameId]/page.jsx](file:///d:/NextAI/chessarena/app/game/%5BgameId%5D/page.jsx), [Game model](file:///d:/NextAI/chessarena/models/Game.js).

## Functional Requirements

### FR-1 — Creare joc nou (custom / privat)
- Utilizator autentificat accesează `/play` → Custom tab → setează time control (1+0 … 30+0), culoare (white / black / random), adversar (orice / specific user / privat).
- `POST /api/games` creează document `Game` în Mongo cu `status: 'waiting'` și returnează `{gameId, inviteCode?, status}`.
- Dacă `isPrivate === true`, se generează `inviteCode` (6 caractere) și link-ul `https://app/play?invite=CODE`.
- Redirecționare către `/game/:id` imediat după creare.

### FR-2 — Quick Match (coadă pe Socket)
- În `/play` → Quick Match: user selectează time control și (opțional) rating range, dă click „Find Match”.
- Clientul emite `quick_match:enqueue {timeControl, ratingRange?}`.
- Serverul păstrează `quickMatchQueues` map (chei = `{initialTime}_{increment}_{ratingCategory}`). Când 2 jucători compatibili (±100 rating default) sunt în aceeași coadă → `new GameManager`, salvează Game în Mongo, ambii primesc `quick_match:matched {gameId}` și redirect `/game/:id`.
- Dacă userul iese din pagina Quick Match → emite `quick_match:dequeue` și șterge din coadă.

### FR-3 — Join / Join ca spectator
- `POST /api/games/:id/join` cu body `{color?, inviteCode?}` → dacă există slot liber (`whitePlayer === null` sau `blackPlayer === null`) și jucătorul nu e deja în partid → îl atasează, marchează `startedAt` dacă ambii sunt prezenți, returnează `{ok:true, game}`.
- Orice alt user autentificat (fără slot) poate spectator (se alătură în room `game:*` dar nu poate emite mutări / resign etc — serverul verifică `side === null` → returnează `Not a participant`).

### FR-4 — Mutări validate strict pe server
- Clientul afișează mutări legale (din `utils/chess.js::getLegalMoves`) doar pentru UX highlighting (**clientul nu decide validitatea**).
- La mutare: client emite `game:move {gameId, from, to, promotion?}` cu un `ack` callback.
- Serverul în `GameManager.makeMove(playerId, …)`:
  1. Verifică `status === 'playing'`.
  2. Identifică side (w/b) după `playerId`; respinge spectatorii.
  3. Verifică `side === turn`.
  4. `consumeTime()` calculat pe `lastMoveAt`.
  5. Dacă timpul unui jucător ajunge la 0 → `finishByTimeout`.
  6. Apel `chess.move()`. Returnează eroare dacă move e invalid.
  7. Adaugă `increment` la jucătorul care a mutat.
  8. Populează `moves[]` cu `{from,to,san,lan,piece,captured,promotion,flags,timeSpent,whiteTime,blackTime,fenBefore,fenAfter}`.
  9. Verifică terminare: `isCheckmate / isStalemate / isThreefoldRepetition / isInsufficientMaterial`.
  10. Trimite `game:state` + `game:clock` către toți în `room game:*`.
  11. Salvează documentul în Mongo prin `await gm.save()`.

### FR-5 — Ceas pe server, timeout finish
- Un global `setInterval(1000)` în `socket-server.js` iterează `gameManagers` unde `status === 'playing'`. Pentru fiecare: calculează `elapsed = floor((now - lastMoveAt)/1000)`, scade `elapsed` din timpul jucătorului curent, apoi setează `lastMoveAt = now`. Emite `game:clock {whiteTime, blackTime, turn}` către room.
- Dacă `whiteTime <= 0` sau `blackTime <= 0` → `gm.finishByTimeout(loserSide)` → `termination: 'timeout'`, salvează, emite `game:finished` și actualizează Elo.

### FR-6 — Resign / Draw / Rematch
- `game:resign {gameId}` — valid doar dacă `side != null` și status playing → finish `resignation`.
- `game:offer-draw {gameId}` → broadcast `game:draw-offered {offeredBy}` către room.
- `game:accept-draw {gameId}` → finish `draw_agreement`.
- `game:decline-draw {gameId}` → broadcast `game:draw-declined`.
- `game:rematch {gameId}` dacă status finished → trimite `game:rematch-offered {offeredBy}`; dacă și celălalt emite rematch în 60s → creează `new Game` cu culori inversate și trimite `game:rematch-matched {newGameId}`.

### FR-7 — Reconectare
- La `connect` + `socket.on('connect')`, dacă pagina de joc detectează că există `gameId` în URL → emite `game:reconnect {gameId}`.
- `gameManagers.get(gameId)` dacă există → rejoin room și trimite `game:state` complet.
- Dacă GM nu există în memorie (server restart) → citește din Mongo `Game.findOne({gameId})` → re-construiește `new GameManager(doc)` → rejoin.
- Stare „Reconnecting …” afișată cu toast și overlay când `socket.reconnecting === true`.

### FR-8 — Lobby cu jocuri live / waiting
- `GET /api/games?status=waiting,playing&limit=50` returnează lista jocurilor (fără FEN complet, doar public data: `{gameId,whiteUsername,whiteRating,blackUsername,blackRating,initialTime,increment,ratingCategory,status,result,startedAt,movesCount}`).
- `/lobby` Server Component afișează: (A) Waiting Rooms (buton Join dacă locuri libere + spectator link), (B) Live Games (badge „Spectate”), (C) Online Players (User.find({isOnline:true}) cu limit 30).
- Live updates: socket evenimente `lobby:game-created`, `lobby:game-started`, `lobby:game-finished` → reface lista pe client.

### FR-9 — Chat real cu persistență
- `chat:message {gameId, message}` pe server:
  1. Verifică `userId` autentificat (socket handshake auth).
  2. Rate limit: `canChat(userId)` din socket-server (1/s, 20/min).
  3. `sanitizeText(message, 500)` — elimină HTML, script, evenimente inline.
  4. Creează document `Message` în Mongo cu `{gameId, senderId, username, message, type:'chat', createdAt}`.
  5. Broadcast către `game:*`.
  6. Returnează `ack {ok:true, _id, createdAt}`.
- La `game:join`, socket primește și ultimele 30 de mesaje (populate cu `Message.find({gameId}).sort({createdAt:1}).limit(30)`) pentru a încărca istoricul chat.

### FR-10 — Elo Rating + Statistici actualizate
- După fiecare `gm.finish({result, termination})` (când `data.status` trece în `finished`):
  1. Determine rating category din `data.ratingCategory` (blitzRating / rapidRating / classicalRating, derivat din `initialTime` la creare — vezi `lib/rating.js::getRatingCategory`).
  2. Dacă `result === 'white'` → castigator `whitePlayer`. `'black'` → castigator `blackPlayer`. `'draw'` → ambii scor 0.5.
  3. `{whiteNew, blackNew} = calculateEloRating(whiteRating, blackRating, result==='draw' ? true : false, K=32)`.
  4. `User.bulkWrite([ {updateOne: {_id: whitePlayer, $set: {[ratingCategory]: whiteNew, rating: (whiteNew+rapid+blitz)/3…}}, $inc: {gamesPlayed:1, gamesWon: whiteWon?1:0, gamesDraw: draw?1:0, gamesLost: whiteLost?1:0}} }, …])`.
  5. Câmpul `rating` general = medie ponderată sau maximul? Conform specificațiilor PHASE 1: `rating` e un câmp separat; în PHASE 2 îl setăm egal cu `Math.round((blitzRating + rapidRating + classicalRating) / 3)` pe fiecare user după actualizare.
- Rezultatele se reflectă imediat în `/leaderboard` (care citește Mongo, nu fallback).

## Non-Functional Requirements

### NFR-1 — Securitate
- Orice mutare, resign, draw accept, rematch **trece printr-un check `playerId === whitePlayer || playerId === blackPlayer`** pe server.
- Socket `handshake.auth.userId` **nu poate fi falsificat ușor** — în PHASE 2 validăm `jwtVerify` pe cookie și verificăm că userul există în Mongo la conectare.
- Chat: sanitizare strictă (HTML stripped, JS event handlers removed).
- Rate limiting: login (10/15min), chat (1/s, 20/min), mutări (max 2/s per user per joc).

### NFR-2 — Performanță & UX
- Timpul între click pe piesă și apariția mutării pe tabla adversarului < 300ms pe același host (Socket.IO pe localhost).
- Lobby refresh la creare/finish joc < 1s.
- UI responsive: tabla de șah, ceas, move list, chat — aranjate vertical pe mobil, orizontal pe desktop (ca in PHASE 1 UI).

### NFR-3 — Build Clean
- `npm run build` → exit code **0**.
- Fără warning-uri Mongoose duplicate index (rezolvat în PHASE 1; verif).
- Fără warnings Tailwind CSS unknown selectors.
- Fără console.log nepotrivite în production (folosim `log()` cu prefix).

### NFR-4 — Dark/Light Mode
- Toate componentele noi (ChessBoard, ChessClock, MoveList, Lobby tabs) trebuie să funcționeze corect în ambele teme (folosesc culorile Tailwind `text-slate-900 dark:text-slate-100` etc).

### NFR-5 — Modularitate
- Componente `components/chess/` separate (nu tot codul în game page).
- Game API routes separate în `app/api/games/*` cu route handlers.
- Logica serverului Socket separată în `socket-server.js` cu metode clare pe `GameManager`.

## Constraints
- **Tehnice**: JavaScript pur, Zero TypeScript. Next.js App Router. Tailwind CSS. MongoDB local sau Atlas prin `MONGODB_URI`. Socket.IO pe PORT separat (3001). Server Components unde se poate; Client Components doar unde e nevoie de hooks/interacțiune.
- **Afacere**: Fără feature-uri plătite / freemium în PHASE 2. Toate conturile au acces complet.
- **Dependențe**: Nu adăugăm pachete noi. Avem deja: `chess.js`, `socket.io`, `socket.io-client`, `mongoose`, `jose`, `bcryptjs`, `lucide-react`, `clsx`. Piesele de șah: Unicode chars (ca in PHASE 1) — nu @react-chessboard.

## Assumptions
1. PHASE 2 rulează cu **un singur proces Socket.IO** (fără Redis / horizontal scaling).
2. Utilizatorii folosesc același hostname `NEXT_PUBLIC_SOCKET_URL`.
3. Partidele în curs sunt ținute în memorie (`gameManagers` Map) și persistență Mongo. Restart server recreează GameManager-uri din Mongo la primul `game:join`.
4. Elo K-factor = 32 pentru toți jucătorii noi (fără diferențiere 1200 vs 2400).
5. 2 browsere separate = 2 conexiuni Socket separate cu userId diferit. Test manual cu doua conturi (sau unul + „anonim” — spectator).

## Open Questions
*(Nicio întrebare deschisă; toate deciziile luate în asumările de mai sus dacă userul nu spune contrariu)*

---

## Acceptance Criteria

### AC-1 — Create Game POST /api/games salvează în Mongo și returnează gameId
- **Type**: `rule`
- **Given**: Utilizator autentificat, MONGODB_URI setat.
- **When**: Trimite `curl -X POST /api/games -H "Cookie: auth-token=…" --json '{initialTime:300, increment:3, isPrivate:false}'`
- **Then**: (1) HTTP 201, `{ok:true, gameId: 'g_…'}` (2) `Game.countDocuments({gameId}) === 1` cu `status='waiting'`, `whiteTime=300`, `blackTime=300`, `fen = start pos`, `ratingCategory = 'rapidRating'`.
- **Pass Condition**: HTTP status + document existent cu toate câmpurile.
- **Evidence**: `curl` output + `mongosh` / `db.games.find({gameId}).pretty()`.

### AC-2 — game:move invalid (not your turn) este respins cu ok:false
- **Type**: `rule`
- **Given**: Partidă în status playing cu user A = white, user B = black, turn white.
- **When**: B emite `game:move {gameId, from:'e7', to:'e5'}` (mutare din partea neagră înainte de alb).
- **Then**: Ack returnează `{ok:false, error:'Not your turn'}` și FEN-ul nu se schimbă în Mongo.
- **Pass Condition**: Ack error corect; FEN la fel; moves[] ne modificat.
- **Evidence**: Console browser ack returnat + Mongo Game moves[] length același.

### AC-3 — game:move valid este aplicat, trimis ambilor jucători, salvat în moves[]
- **Type**: `rule`
- **Given**: Partidă playing, turn white, alb face e4 (valid).
- **When**: White trimite `game:move {gameId, from:'e2', to:'e4'}`.
- **Then**: Ambii jucători primesc `game:state` cu `fen = rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR …`, `moves[]` length 1 cu `san: 'e4'`. În Mongo moves[0].lan = 'e2e4'.
- **Pass Condition**: Ambii sockets primesc event, moves[] length 1, FEN corect.
- **Evidence**: Browser console `socket.on('game:state')` loguri + Mongo moves[0].lan.

### AC-4 — Timeout 0 pe server → finish prin termination='timeout'
- **Type**: `rule`
- **Given**: Partidă cu `initialTime: 10` (10 secunde) pentru test, alb la mutare.
- **When**: Aștept 12s fără nicio mutare.
- **Then**: Serverul emite `game:finished {result:'black', termination:'timeout'}`, status Mongo `finished`, Elo actualizat pe ambii.
- **Pass Condition**: Status finished, termination timeout, ratingCategory actualizat.
- **Evidence**: Server log `[Game] Game X finished: black (timeout)` + Mongo ratings before/after.

### AC-5 — Reconectare după refresh → FEN + moves + rating current recepționate
- **Type**: `rule`
- **Given**: Partidă cu 5 mutări efectuate.
- **When**: Un jucător dă refresh browser.
- **Then**: Dupa reconectare socket, clientul primește `game:state {fen: …, moves: [5 entries], whiteTime, blackTime, turn}`. Tabla arată corect poziția curentă; move-list afișează 5 mutări.
- **Pass Condition**: FEN / moves.length match cu documentul Mongo.
- **Evidence**: Screenshot / console.log state după refresh + Mongo doc moves length.

### AC-6 — Lobby afișează jocurile waiting + live cu info corectă
- **Type**: `rule`
- **Given**: 1 joc waiting (alb present, negru liber), 1 joc live (3 mutări).
- **When**: Navighez pe `/lobby`.
- **Then**: Card „Waiting Rooms” afișează jocul cu buton verde „Join Room” activ; Card „Live Games” afișează jocul cu badge LIVE + buton „Spectate”. Click Join → `/game/:id` → status playing după ce ambii sunt conectați.
- **Pass Condition**: 2 carduri distincte, info (username, rating, TC label) corecte, butoane funcționale.
- **Evidence**: Screenshot lobby + redirect funcțional.

### AC-7 — Elo se actualizează corect (3 categorii) după checkmate
- **Type**: `rule`
- **Given**: 2 useri: White rating 1500 rapid, Black rating 1400 rapid. Partidă rapid (5+0).
- **When**: White câștigă prin checkmate (server emite `game:finished {result:white, termination:checkmate}`).
- **Then**: White.rapidRating ≈ 1508, Black.rapidRating ≈ 1392. White.gamesWon += 1, Black.gamesLost += 1. Ambii gamesPlayed += 1.
- **Pass Condition**: Diff aproximativ K*(1 - E), E = 1/(1+10^((Rb-Ra)/400)) ≈ 0.64 pentru +100 rating advantage → câștigătorul primește ~ 32*(1-0.64)=~11.5; 1500 → ~1512, 1400 → ~1388. Acceptăm întreaga 1505–1515 și 1385–1395.
- **Evidence**: Mongo User rapidRating before vs after + games counters incremented.

### AC-8 — npm run build → exit 0, Fără warnings grave
- **Type**: `rule`
- **Given**: Codul implementat.
- **When**: Rulez `cd chessarena && npm run build`.
- **Then**: Exit code 0. Rutele: `/`, `/login`, `/register`, `/lobby`, `/play`, `/game/:id`, `/tournaments`, `/tournaments/:id`, `/leaderboard`, `/profile`, `/api/auth/*`, `/api/games/*` generate. Fără erori de serialization RSC.
- **Pass Condition**: Exit code 0.
- **Evidence**: Terminal output build.

### AC-9 — UX general pe game page (responsive + interacțiuni intuitive)
- **Type**: `rubric`
- **Dimension**: UX & UI Coerente Responsive
- **Scale**: 1–5
- **Anchors**:
  - 1 = tabla nu este pătrată, mutările nu pot fi făcute cu click, mobil nu se vede
  - 3 = tabla pătrată, 1 metodă de mutare, mobil rearanjat dar incomod
  - 5 = tabla pătrată cu piese mari, click piesă → highlight mutări legale → click destinație, last move highlight, check alert vizual roșu, move list scrollabilă cu perechi 1.e4 e5, layout desktop (stânga board+ceasuri, dreapta video+chat) vs mobil (vertical: oponent → clock → board → clock → eu → controls → chat → video)
- **Pass Threshold**: >= 4
- **Evidence**: Screenshots desktop (1920), tableta (768), mobil (390) + demo mutare e4.

### AC-10 — Modularitate & lizibilitate cod
- **Type**: `rubric`
- **Dimension**: Code Quality (modular, extensibil, fără "magic strings" hardcoded)
- **Scale**: 1–5
- **Anchors**:
  - 1 = totul într-un singur fișier game/page.jsx de 2000 linii, hardcode 300s peste tot
  - 3 = componente separate dar props nespecificate, comentarii lipsă, time-uri ca stringuri "5:00"
  - 5 = `components/chess/ChessBoard.jsx` (props: fen, onMove, orientation, legalMoves? …), `ChessClock.jsx` (props: time, active?), `MoveList.jsx` (props: moves san pairs), `hooks/useGame.js` centralizează game:* listeners, `lib/chess.js` expune helpers, `GameManager` clasă cu metode clar separate, logs cu `[Game] [Socket] [Database]`
- **Pass Threshold**: >= 4
- **Evidence**: Examinez structura `components/chess/`, `hooks/useGame.js`, `server/socket-server.js` metodele GM.

### AC-11 — Securitate (serverul decide tot, clientul doar raportează)
- **Type**: `rubric`
- **Dimension**: Security Posture PHASE 2
- **Scale**: 1–5
- **Anchors**:
  - 1 = client decide resultatele (trimite "game:win" → server acceptă)
  - 3 = server validează move dar clienții își pot trimite manual `socket.emit('game:state', fakeFen)` și nimeni nu verifică
  - 5 = toate mutările / terminările / ratingurile sunt calculate DOAR în GameManager de pe server, socket handshake validat cu JWT Mongo, rate limits, chat sanitized, câmpurile whiteTime/blackTime nu pot fi modificate din client.
- **Pass Threshold**: >= 4
- **Evidence**: Audit manual: `game:move` code path, `game:resign`, `calculateEloRating` — toate server-side.
