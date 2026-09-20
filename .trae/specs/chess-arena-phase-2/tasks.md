# Chess Arena — PHASE 2: Implementation Plan

Ordinea task-urilor: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 (T6 și T7 pot fi paralele dacă nu se ating aceleași fișiere; în general sunt dependente de T1–T5 terminat).

---

## Task 1: Infrastructură Socket.IO server (Auth, Global Clock, Persist GM, User Online)
- **Status**: `pending`
- **Priority**: `high`
- **Depends On**: None
- **Description**:
  - **1.1** Socket handshake JWT validation: în `io.on('connection')` înainte de a seta `userId`, citește cookie `auth-token` din `socket.handshake.headers.cookie` sau `socket.handshake.auth.token`. Folosește `import('jose').jwtVerify` în modul CommonJS (dynamic import async). Dacă valid → citește `_id` din payload, verifică User există în Mongo. Dacă invalid → `socket.disconnect(true)`.
  - **1.2** `connectMongo()` apelat automat la `start()` din socket-server și în `require.main===module` block.
  - **1.3** User online: connect valid → `User.updateOne({_id:userId}, {isOnline:true, lastSeen:new Date()})`. Disconnect → `User.updateOne({_id:userId}, {isOnline:false, lastSeen:new Date()})` în 10s debounce (pt reconectare scurtă).
  - **1.4** Global Clock tick: `setInterval(() => tickAllGames(), 1000)` definit în afara `io.on('connection')`, pornește după Mongo connect. `tickAllGames()` iterează `gameManagers.entries()`, pt fiecare status `playing`: `gm.consumeTime()`; dacă `gm.data[color]Time <= 0` → `gm.finishByTimeout(color)` → `io.to(game:*).emit('game:state'…)` + `game:finished` + `gm.save()` + `updateEloAfterGame(gm)`. La fiecare tick: emite `game:clock` către room (doar dacă timpul s-a schimbat cu >= 1s pentru a nu face spam).
  - **1.5** `GameManager.save()` real: folosește `mongoose.models.Game` → `Game.findOneAndUpdate({gameId: this.data.gameId}, {$set: pickFields(this.data)}, {upsert:false, new:true})`. Salvează: `whitePlayer, blackPlayer, whiteUsername… rating, ratingCategory, initialTime/increment, whiteTime/blackTime, lastMoveAt, fen, turn, moves[], status, result, termination, drawOfferedBy, rematchOfferedBy, startedAt, finishedAt`.
  - **1.6** `GameManager.restoreFromMongo(gameId)` static: dacă `gameManagers` nu are intrare, citește `Game.findOne({gameId})` → creează `new GameManager(doc)` cu `doc.moves` și `doc.fen`; refă instance `Chess(doc.fen)` + aplică `.moves[]` ca să refacă starea internă chess.js (pentru `isCheckmate()` etc corecte).
  - **1.7** Quick Match queues structură inițială: `Map<categoryKey, Array<{userId, socketId, rating, enqueuedAt, ratingRange}>>`.
- **Acceptance Criteria Addressed**: AC-2, AC-3 (baza), AC-4 (clock tick + timeout), AC-11 (security auth socket)
- **Test Requirements**:
  - `rule` TR-1.1: Socket cu JWT invalid → `socket.on('disconnect')` după < 2s. Evidence: `node server/socket-server.js` loguri `[Socket] Client rejected: invalid token`.
  - `rule` TR-1.2: User A conectat → Mongo `User.findOne({username:'A'}).isOnline === true`, apoi `Ctrl+C` socket client → după 15s `isOnline === false`. Evidence: `mongosh` query + socket server `[Socket] Client disconnected` log.
  - `rule` TR-1.3: Pornesc joc cu `initialTime:10` (10s), alb mută un g6 și așteaptă 15s → log `[Game] Game X finished: black (timeout)` + Mongo `result:'black', termination:'timeout'`. Evidence: log + document Mongo.
  - `rubric` TR-1.4: Logging clarity (Game/Socket/Database). Scale 1-5. 1 = logs fără timestamp / context; 3 = timestamp dar erori nestackate; 5 = `[HH:MM:SS] [Module] Mesaj + error stack dacă`. Threshold >= 4. Evidence: terminal output socket 30 secunde test.
- **Notes**: În PHASE 2 totul e CommonJS în socket-server.js (folosește `module.exports` / `require`). Pentru `jose` folosește `import('jose')` async cu `.then()` / `await` într-un IIFE înainte de port listen.

---

## Task 2: Game API routes — creare, listare, join, get state
- **Status**: `pending`
- **Priority**: `high`
- **Depends On**: T1 (Mongo connect + Game model deja există)
- **Description**:
  - **2.1** `app/api/games/route.js` → `POST` cu `auth`:
    - Body: `{initialTime, increment, isPrivate?, colorPreference: 'white'|'black'|'random', opponentUserId?}`.
    - Validări: `validateTimeControl(body)` (initialTime 60..1800, increment 0..30), `isPrivate boolean`, `color enum`.
    - Creează document cu `Game.create(lib/chess::createNewGame({...}))` + setează `whitePlayer`/`blackPlayer` în funcție de `colorPreference` și `user._id`.
    - Returnează `{ok:true, gameId, inviteCode, ratingCategory, status}`.
  - **2.2** `app/api/games/route.js` → `GET`:
    - Query: `status` (CSV: `waiting,playing,finished`), `limit` (default 50, max 200).
    - Agregare simplă: `Game.find(filters).sort({createdAt:-1}).limit(n)`. Populate doar `whitePlayer: 'username avatar rating'` + `blackPlayer: 'username avatar rating'` (lightweight, nu și email).
    - Response: `{ok:true, games:[…]}`, unde fiecare joc include doar câmpuri public (fără `moves[]` complet — doar `movesCount: moves.length`).
  - **2.3** `app/api/games/[id]/route.js` → `GET`:
    - `{id} = gameId`. Citește `Game.findOne({gameId})` → dacă nu există 404. Populate players light. Dacă user autentificat și e participant: include `moves[]`. Dacă spectator: include doar ultimele 3 mutări + FEN.
    - Response: `{ok:true, game:{…}}`.
  - **2.4** `app/api/games/[id]/join/route.js` → `POST`:
    - Body: `{color? 'white'|'black'|null, inviteCode? string}`.
    - Verifică: user autentificat, game există, `status === 'waiting'`.
    - Dacă `isPrivate === true` → verifică `inviteCode === game.inviteCode` (sau user e deja unul dintre jucători).
    - Dacă slotul cerut liber → ocupă. Dacă `color === null` → ocupă primul liber. Dacă user e deja white/black → ok, return. Dacă ambele ocupate → return `{ok:false, error:'Game full'}`.
    - După ocupare: dacă ambii jucători prezenti → set `status = 'playing'`, `startedAt = new Date()`. În **paralel** trebuie să notific Socket room (fără server → socket direct HTTP POST către Socket.IO REST notificare — în PHASE 2 facem un simplu `io.inlineNotify`? Mai ușor: socket-server primește `POST /notify/game-started?gameId=` intern pe portul 3001 sau mai simplu: **până la T4 când se face `socket.emit('game:join')`**, dacă `game.status === 'waiting'` și ambii jucători sunt în room → serverul schimbă status. **Să alegem varianta 2** — T2 nu face notificări, doar DB; actualizarea status la T4 când ambii sunt online.)
- **Acceptance Criteria Addressed**: AC-1 (create), AC-6 (list lobby), AC-8 (fără rute 404), baza pentru AC-3, AC-5 (server preia game)
- **Test Requirements**:
  - `rule` TR-2.1: `curl -X POST http://localhost:3000/api/games --cookie auth-token=$TOKEN -H 'Content-Type: application/json' -d '{"initialTime":300,"increment":3}' → HTTP 201, gameId `g_*`, Mongo document. Evidence: curl stdout + `db.games.countDocuments({gameId:'…'})`.
  - `rule` TR-2.2: `curl /api/games?status=waiting,playing` → JSON array, fiecare element are `whiteUsername, blackRating, initialTime, increment, status, movesCount`. Evidence: JSON parse `Array.isArray(res.games) && res.games[0].movesCount === 0` pt joc nou.
  - `rule` TR-2.3: POST join cu user B, user A deja white → `game.blackPlayer === userB._id`, status playing, startedAt setat. Evidence: Mongo.
  - `rubric` TR-2.4: Input validation resilience. Scale 1-5. 1 = accepts `initialTime: 0` / `{bad json}` → 500; 3 = validează dar mesaje eroare generice; 5 = returnează `{ok:false, error:'Initial time must be between 60..1800 seconds'}` clar. Threshold >= 4. Evidence: teste curl cu bad inputs.
- **Notes**: Validări: `utils/validation.js` + `validateTimeControl()` (dacă nu există → adaugă).

---

## Task 3: Componente `components/chess/*` și `hooks/useGame.js`
- **Status**: `pending`
- **Priority**: `high`
- **Depends On**: T2 (creează API-ul de baza; componentele sunt UI și nu depind direct de API dar le construim după ce știm ce props avem)
- **Description**:
  - **3.1** `components/chess/ChessBoard.jsx` ('use client'):
    - Props: `fen: string`, `onMove: (from, to, promotion?) => void`, `orientation: 'white' | 'black'` (white = alb jos; default 'white'), `lastMove?: {from, to}`, `isCheck?: boolean`, `legalMoves?: Array<{from, to, san, piece, captured?}>`, `selectedSquare?: string` (opțional), `onSquarePress?: (square) => void`, `disabled?: boolean`.
    - Layout: 8x8 grid CSS, pătrat `aspect-square`, width controlat prin Tailwind (se potrivește în container). Piese = Unicode chars din PHASE 1. Culori light = `bg-[#f0d9b5]`, dark = `bg-[#b58863]` (ca în placeholder); dar adaugă variants `chess-light`/`chess-dark` în Tailwind config (3.2).
    - Click squares: click piesă → **calculează mutări legale** folosind `utils/chess::getLegalMoves(fen, square)` (e deja făcut!) → afișează punct mic verde centrat pe square (`after:` pseudo sau div mic). Click destinație → `onMove(from,to)`.
    - Pentru pawn ajunge pe ultima linie (8 pentru white, 1 pentru black) → afișează mini modal cu piesele Q/R/B/N și userul click pentru a selecta promotion → `onMove(from, to, promotion)`.
    - Last move: highlight cu un border subtile galben (clasă `ring-2 ring-yellow-400/70`) pe squareurile from și to.
    - Check: dacă regele jucătorului cu mutare e în `isCheck` → pătratul cu regele are un `ring-2 ring-red-500 animate-pulse`.
    - File/rânduri label: stânga (1-8) și deasupra (a-h) text gray-400, font mono, text-xs.
  - **3.2** `tailwind.config.js` — adaugă culorile (dacă nu există deja): `chess-light: '#f0d9b5'`, `chess-dark: '#b58863'`, `chess-highlight: '#f6f669'`, `check-red: '#ef4444'`.
  - **3.3** `components/chess/ChessClock.jsx` ('use client'):
    - Props: `time: number (secunde)`, `active?: boolean`, `lowTimeThreshold = 30`, `label?: 'White' | 'Black' | string`.
    - Class: `font-mono font-bold text-xl sm:text-2xl px-4 py-2 rounded-xl border`. Dacă `active` → `border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700`. Dacă `time <= lowTimeThreshold` → `text-red-600 dark:text-red-400 animate-pulse`. Dacă `time <= 10` → plus `font-black`.
    - Folosește `formatTime(time)` din utils/time.
  - **3.4** `components/chess/MoveList.jsx` ('use client'):
    - Props: `moves: Array<{san:string, lan:string, timeSpent?}>`. Împerechează: rândul 1 = moves[0] white, moves[1] black; număr move pair 1-based. Scroll vertical max h-[300px] (desktop) / h-[180px] (mobil). Click rând → optional highlight. Fără navigation în PHASE 2 (doar afișare).
  - **3.5** `hooks/useGame.js` ('use client'):
    - Export: `useGame(gameId, {userId?}) → { state, isConnected, reconnecting, lastError, makeMove(from,to,promotion?), resign(), offerDraw(), acceptDraw(), declineDraw(), offerRematch(), sendChatMessage(text) }`.
    - Interior: folosește `useSocket()` cu `on('game:state', …)`, `on('game:clock', …)`, `on('game:finished', …)`, `on('game:draw-offered', …)`, `on('game:draw-declined', …)`, `on('game:rematch-offered', …)`, `on('chat:message', …)`.
    - Stare internă `state = { fen, turn, whiteTime, blackTime, moves, status, result, termination, orientation, opponent, me, drawOfferedBy, rematchOfferedBy, chatHistory:[] }`.
    - Inițial: dacă `state.status === undefined`, în `useEffect` după socket connected → `emit('game:join', {gameId})` → primește `game:state`.
    - `makeMove(f,t,p)` → `emit('game:move', {gameId,from:f,to:t,promotion:p}, (ack)=> if(!ack.ok) setLastError(ack.error))`.
- **Acceptance Criteria Addressed**: AC-9 (UX responsive), AC-10 (modularitate), bază pentru AC-3 (mutări)
- **Test Requirements**:
  - `rule` TR-3.1: ChessBoard cu start FEN, click e2 → squares e4 are indicator → click e4 → onMove('e2','e4') apelat. Evidence: console.log onMove args.
  - `rule` TR-3.2: ChessClock `time=5, active=true` → text roșu pulsează. `formatTime` returnează `0:05`. Evidence: devtools DOM + text.
  - `rule` TR-3.3: MoveList cu 6 moves (3 perechi) → afișează 3 rânduri: 1. e4 e5  2. Nf3 Nc6  3. Bc4 d6. Evidence: text afișat.
  - `rubric` TR-3.4: Responsive Board sizing. Scale 1-5. 1 = 400px fix; 3 = max-width dar pătrat pe unele ecrane; 5 = `w-full max-w-[640px] aspect-square mx-auto`, pe mobil 320px, pe 4K 720px. Threshold >= 4. Evidence: devtools toggle device toolbar (mobile/tablet/desktop) screenshots.
  - `rubric` TR-3.5: Code modularity. Scale 1-5. 1 = toate logicele mutărilor în page.jsx; 3 = componente dar props nespecificate; 5 = fiecare fișier are responsabilitate unică, JSDoc comments în engleză pe exporturi, minim magic constants. Threshold >= 4. Evidence: citesc capetele fișierelor + exports.
- **Notes**: Folosește Unicode chars ca în PHASE 1 — nu SVG piese; pentru că e mai ușor și arată decent. Promotion modal apare doar când pawn ajunge pe ultimul rank — chess.js move cu promotion null arunca, deci pe client trebuie să detectăm înainte și să cerem userului piesa.

---

## Task 4: Refactor complet `app/game/[gameId]/page.jsx` — conectare live
- **Status**: `pending`
- **Priority**: `high`
- **Depends On**: T1, T2, T3 (folosește ChessBoard + useGame + API get state)
- **Description**:
  - **4.1** Server Component extern (doar rutează): `page.jsx` poate fi 'use client' complet? — DA, pentru că avem nevoie de hooks socket. Dar pentru SEO: păstrăm Server Component doar pentru metadata export, apoi îl randează în `<GameClient gameId=params.gameId/>` (fișier separat `game/[id]/GameClient.jsx`).
  - **4.2** GameClient:
    - 1) Fetch inițial: `await fetch('/api/games/' + gameId, {cache:'no-store', credentials:'include'})` în useEffect pt date inițiale (participanți, startedAt, rating).
    - 2) `const {state, makeMove, resign, offerDraw, acceptDraw, declineDraw, offerRematch, sendChatMessage} = useGame(gameId, {userId: user?._id})` din T3.5.
    - 3) Orientation: dacă user === whitePlayer → 'white' (alb jos), altfel 'black' (negru jos = table răsturnată).
    - 4) Componente afișate: (a) Opponent Card cu avatar, username, rating, side badge, ChessClock (T3.3) → (b) ChessBoard (T3.1) → (c) Me Card cu ChessClock → (d) sub tabla: GameControls (Resign, Offer Draw, Rematch) — cu Buttons existente din Button.jsx (variants danger/ghost/outline).
    - 5) Layout: desktop grid `lg:grid-cols-[1fr_380px]` gap-6: stânga = (Op / Board / Me) — în coloană; dreapta = VideoPanel (placeholder ca PHASE 1) apoi Chat apoi Controls audio/video (UI doar; functionalitatea e WebRTC PHASE 6). Mobil: 1 col: Op → clock → Board → clock → Me → Controls → Chat → VideoPanel.
    - 6) MoveList: afișat între Me și Controls (sau în dreapta, deasupra Chat) — pe baza `state.moves` din useGame.
    - 7) Draw offered: overlay mic card pe centru cu „Oponentul a oferit remiză” + butoane Accept (success) / Decline (danger).
    - 8) Finished: Modal (din components/ui/Modal.jsx) cu titlu: „🏆 Alb câștigă — Șah mat” / „⚠ Remiză — Dead position” / „⏱ Alb pierde — Timeout”. Subtitlu termination in engleza. Butoane: „Offer Rematch”, „Back to Lobby”, „Review Game” (toate cu href/onClick corespunzătoare).
    - 9) Reconnecting: banner de sus (toast + alert) `[Socket] Conexiune pierdută … reconectez` — din `socket.reconnecting` al lui useSocket.
    - 10) Chat: use `useGame().sendChatMessage` + afișează `state.chatHistory` în listă scrollabilă. Trimite pe Enter sau click Send. UI identic cu PHASE 1 dar cu real data.
  - **4.3** Adaugă `SOCKET_EVENTS` noi dacă lipsesc: `quick_match:*`, `lobby:*`.
  - **4.4** Când socketul join un joc: dacă în DB ambii jucători sunt prezenți și status e încă waiting → socket schimbă status în playing, setează startedAt, emite game:state + clock.
- **Acceptance Criteria Addressed**: AC-2 (not your turn respins cu toast via lastError), AC-3 (mutări), AC-5 (reconnect refresh), AC-9 (UX), FR-6 (draw/resign/rematch UI)
- **Test Requirements**:
  - `rule` TR-4.1: 2 browsere, 2 conturi (Alb:userA, Negru:userB). UserA trimite move la tura lui userB → Toast roșu „Not your turn”. Evidence: Toast afișat.
  - `rule` TR-4.2: Alb click e2 → e4 → după 200ms tabla în Browser B afișează piesa pe e4. Move list arată „1. e4”. Evidence: Screenshots ambii browsere.
  - `rule` TR-4.3: Click Resign → modal afișat „Negru a abandonat — Alb câștigă”. Mongo `termination:'resignation'`. Evidence: Modal + Mongo.
  - `rule` TR-4.4: Refresh pe tab joc → 3 secunde tabla afișează poziția curentă. Move list are toate mutările. Evidence: Refresh → screenshot după 5s.
  - `rubric` TR-4.5: Layout pe mobil 375px. Scale 1-5. 1 = tabla ieșește din ecran; 3 = se vede dar butoanele se suprapun; 5 = toate elementele au max-w 100%, board scroll horizontal opțional dar înălțime OK, chat input mobil functional. Threshold >= 4. Evidence: devtools mobil + screenshot.
- **Notes**: Pentru a avea 2 conturi: înregistrează userA + userB. Browser 1 = normal; Browser 2 = Incognito pentru a avea cookies separate. Sau folosește 2 browsere diferite (Chrome + Edge).

---

## Task 5: Chat real cu `Message` persist și istoric 30 la join
- **Status**: `pending`
- **Priority**: `medium`
- **Depends On**: T1 (Message model + socket auth), T4 (UI trimis)
- **Description**:
  - **5.1** `socket-server.js`: în handler `chat:message`, după sanitize + rate limit → `Message.create({gameId, senderId: userId, username: socket.handshake.auth?.username || (await User.findById(userId).select('username -_id')?.username || 'Player'), message: clean, type:'chat', createdAt: new Date()})` și apoi broadcast.
  - **5.2** În handler `game:join` după ce am trimis `game:state` → `const history = await Message.find({gameId}).sort({createdAt:1}).limit(30)` → `socket.emit('chat:history', history)`.
  - **5.3** `useGame.js`: adaugă listener `on('chat:history', arr => setChatHistory(arr))` **push la început** (nu la sfârșit; înlocuiește history). Șterge duplicatele pe `_id` dacă există.
- **Acceptance Criteria Addressed**: FR-9
- **Test Requirements**:
  - `rule` TR-5.1: Trimite `Hello <b>test</b><img src=x onerror=alert(1)>` → Mongo `Message.message` conține doar „Hello test” (HTML stripped). Evidence: Mongo Message.
  - `rule` TR-5.2: Refresh joc cu 4 mesaje trimise → se afișează toate 4 după 1s. Evidence: Refresh + chat afișat.
  - `rubric` TR-5.3: Chat rate limit resilience. Scale 1-5. 1 = pot trimite 100 msg/s; 3 = eroare dar mai persistă în UI; 5 = trimite 1 msg/s maxim, a 2-a în 500ms afișează toast „Așteaptă 1 secundă între mesaje”, Mongo nu are duplicate. Threshold >= 4. Evidence: testare tastare rapidă.
- **Notes**: Message model există; dacă `username` lipsește din handshake → query User.findById(userId) cu `.select('username -_id')`. Cache per socket ca să nu întrebăm la fiecare mesaj.

---

## Task 6: Lobby & Play pages reale (creare + coadă Quick Match)
- **Status**: `pending`
- **Priority**: `high`
- **Depends On**: T1 (online users), T2 (games list/join), T4 (redirect merge)
- **Description**:
  - **6.1** `app/lobby/page.jsx` refactor complet (devine Server Component initial + 'use client' pentru realtime):
    - Outer: Server Component — `await dbConnect()`, `await Game.find({status:{$in:['waiting','playing']}}).sort({createdAt:-1}).limit(25)`, `await User.find({isOnline:true}).sort({lastSeen:-1}).limit(30)` (folosește fallback ca în PHASE 1 dacă DB down).
    - Inner: `<LobbyClient initialGames={…} initialOnline={…} />` ('use client') — folosește `useSocket()` cu listeners: `game:created / game:started / game:finished` (dacă nu există, T1.1 trebuie să emită `io.emit('lobby:new-game', slimGame)` când un joc nou este creat, `lobby:game-status-changed` când status se schimbă).
    - UI Waiting Room card: username / rating / TC / buton verde Join → `POST /api/games/:id/join` → redirect `/game/:id`.
    - UI Live Games: username vs username / TC / badge LIVE → buton Spectate → redirect `/game/:id`.
    - UI Online Players: Avatar grid + name + rating + status. Click un player → Dropdown Invite to Game.
  - **6.2** `app/play/page.jsx` refactor:
    - Tab 1 — Quick Match: TC selector (ca în PHASE 1), culoare preferată (random/white/black), rating range slider (1000 - 2200, buton Find Match). Click: `socket.emit('quick_match:enqueue', {initialTime, increment, color, ratingMin, ratingMax})` → UI așteaptă cu „Caut adversar… XXs”. Dacă primește `quick_match:matched {gameId}` → `router.push('/game/' + gameId)`. Dacă user dă Cancel → `quick_match:dequeue`.
    - Tab 2 — Custom: formular cu TC, culoare, adversar oricare, privat on/off. Submit → `POST /api/games` (T2.1) → redirect. Dacă privat → afișează card cu `inviteCode` + copy link.
    - Tab 3 — Invite Friend: Input username → search User.findOne → dacă există → button „Trimite Invitație” (simplu: creează joc privat, trimite `socket.to('user:'+targetId).emit('user:invite', {fromUserId, fromUsername, gameId})` + toast user target).
  - **6.3** socket-server: `quick_match:enqueue` / dequeue + matching loop; lobby emits.
- **Acceptance Criteria Addressed**: AC-6 (Lobby afișare + join/spectate), FR-2 (Quick Match), FR-1 (Custom/Private)
- **Test Requirements**:
  - `rule` TR-6.1: Contul A creează joc waiting Custom (5+0, white) → Lobby refresh afișează cardul. Contul B (browser incognito) Join → ambii sunt redirectați la joc cu status playing. Evidence: 2 screenshots + Mongo status.
  - `rule` TR-6.2: Cont A Quick Match 5+0 + Cont B Quick Match 5+0 (la < 10s distanță) → ambii primesc redirect către același gameId. Evidence: ambii URLs au `/game/g_same`.
  - `rule` TR-6.3: Lobby online users afișează A + B (online) când cei doi sunt conectați. Evidence: Lobby page cards.
  - `rubric` TR-6.4: Flowuri intuitive. Scale 1-5. 1 = nu știi să creezi joc fără ghid; 3 = merge dar UI cluttered; 5 = Quick 1-click, Custom clar, Lobby cards with distinct visual (waiting=green accent, live=red pulse), 10 secunde ca user nou să găsești „Play”. Threshold >= 4. Evidence: walkthrough ca utilizator nou, cronometru.
- **Notes**: În PHASE 2 Quick Match se potrivesc oricare doi indiferent de rating dacă nu există 2 cu ±100 — timeout 30s → match cu oricine.

---

## Task 7: Elo update + stats increment după finish
- **Status**: `pending`
- **Priority**: `high`
- **Depends On**: T1 (updateEloAfterGame(gm) se cheamă în finish), T2 (User model, ratingCategory), T4 (status finished)
- **Description**:
  - **7.1** `lib/rating.js` (dacă există — dacă nu muti / extinde) → `async function updateGameRatingAndStats(gameDoc)`:
    - Citește `whiteDoc = User.findById(whitePlayer)`, `blackDoc = User.findById(blackPlayer)` cu `.select('rating blitzRating rapidRating classicalRating gamesPlayed gamesWon gamesDraw gamesLost')`.
    - `const category = gameDoc.ratingCategory; // 'blitzRating' etc.`
    - `const {winnerRating, loserRating, wasDraw} = map result`
    - Calculează K=32: `{winnerNew, loserNew} = calculateEloRating(wRating, lRating, wasDraw, 32)`.
    - Dacă draw → ambii primesc `draw = true`.
    - `bulkWrite`: update White (ratingCategory + media general rating + inc gamesPlayed/Won/Draw/Lost), update Black (la fel).
    - `gameDoc.ratingBeforeWhite = whiteDoc[category]`, `gameDoc.ratingAfterWhite = …`, `gameDoc.ratingDeltaWhite = …` (salvează delta în Game ca să afișăm în UI un badge „+12” după joc — PHASE 3).
    - Log `[Rating] Game ${gameId}: White ${deltaW}, Black ${deltaB} (${category})`.
  - **7.2** În `GameManager.finish()` — după ce setează status finished — dacă `mongoose` și `result != null` → `await updateGameRatingAndStats(this.data)` (dinamic import în socket-server).
  - **7.3** `app/leaderboard/page.jsx` — acum citeste top 10 users Mongo sortat dupa rating -1 (fara fallback). Afișează podium 1/2/3 cu medals gold/silver/bronze (Badge variants deja există).
- **Acceptance Criteria Addressed**: AC-7 (Elo update), AC-8 (leaderboard merge cu DB real)
- **Test Requirements**:
  - `rule` TR-7.1: Alb 1500 rapid, Negru 1500 rapid → White wins → White.rapidRating ∈ [1514, 1518], Black.rapidRating ∈ [1482, 1486]. gamesPlayed+1 amândoi, gamesWon alb+1, gamesLost negru+1. Evidence: Mongo before/after.
  - `rule` TR-7.2: Draw → ambii gamesDraw +=1. ratings +- 0–2 pt egal. Evidence: Mongo.
  - `rule` TR-7.3: Leaderboard refresh → top 3 afișează cei mai buni jucători (rating general). Evidence: UI cu badge gold.
  - `rubric` TR-7.4: Performance Elo write. Scale 1-5. 1 = 2 secunde per finish (3 queries seriale); 3 = 500ms dar cu blocking; 5 = <100ms cu bulkWrite, log clar category + deltele. Threshold >= 4. Evidence: socket log timestamps.
- **Notes**: Dacă `calculateEloRating` returnează doar winnerNew/loserNew — pt draw, apelăm `calculateEloRating(A,B, true, K)` → ambii primesc ~ egal (winnerNew = A + K*(0.5 - Ea)).

---

## Task 8: Build clean + testare manuală + remediere erori
- **Status**: `pending`
- **Priority**: `high`
- **Depends On**: T1–T7 complet
- **Description**:
  - **8.1** Rulează `Remove-Item -Recurse -Force .next` + `npm run build`.
  - **8.2** Fixează orice eroare RSC serialization (fără `as={Link}` pattern) / CSS parse / undeclared vars.
  - **8.3** Rulează manual: 2 terminale — `npm run dev`, apoi `npm run socket`.
  - **8.4** Testare end-to-end: înregistrează user1+user2 → user1 Custom joc → user2 Lobby Join → joc 3 mutări → user1 Resign → verif rating actualizat → Quick Match ambii → match → timeout (cu TC 10s) → verif termination='timeout' → Leaderboard afișează cei 2 → Lobby show Live Games → refresh pe tab game → reconectare.
  - **8.5** Edge cases: (a) spectator join → nu poate muta (toast „Not a participant”). (b) joc privat — user fără invite code primește 401 din join. (c) mutare ilegală client → server returnează invalid + nu persistă.
  - **8.6** Dark mode toggle pe toate paginile noi — ChessBoard colors, Chat, MoveList — se comportă corect (culorile pieselor au contrast bun).
  - **8.7** Rulează `npm run lint` dacă există; fixează warnings.
- **Acceptance Criteria Addressed**: AC-8 (build 0 exit), toate AC-urile 1..7 sunt verificate manual în acest task
- **Test Requirements**:
  - `rule` TR-8.1: Build exit 0. Evidence: terminal output.
  - `rule` TR-8.2: E2E flow din 8.4 executat cu succes (fără refresh manual, cu excepția pașului reconnect unde dăm refresh intentionat). Evidence: 8 screenshots (fiecare pas).
  - `rubric` TR-8.3: E2E robustesse. Scale 1-5. 1 = crash pe 3 din 10 pași; 3 = merge cu 2 mici workarounduri; 5 = 10 pași consecutiv fără eroare, toate toast-uri informative, UI responsive, 0 crashes în Node server în 5 minute de joc. Threshold >= 4. Evidence: 5 min terminal socket log cu nimic roșu în afară de disconnected normal.
- **Notes**: Dacă apare vreo eroare nedepistată — creează Issue subtask în tasks.md cu ID I-#, îl rezolv înainte de a finaliza T8.
