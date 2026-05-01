# Chess AI Coach Arena - Design Specification

## 1. Product Vision

**Chess AI Coach Arena** - современная веб-платформа для игры в шахматы, где каждая партия превращается в тренировку. Игрок может сыграть с другом по ссылке, против AI, локально на одном экране, а после партии получить понятный разбор ключевых ошибок от AI Coach.

Цель продукта - не повторить существующие шахматные сайты, а создать прототип сервиса с высокой возвращаемостью: игрок играет, получает объяснение, видит прогресс, сравнивает себя с другими и хочет вернуться.

### Основная ценность

- Играть быстро: открыть сайт, создать комнату, отправить ссылку другу.
- Учиться без скучных уроков: AI Coach объясняет ошибки простым языком после партии.
- Видеть прогресс: рейтинг, история партий, серии, достижения, статистика.
- Соревноваться социально: лидерборды по городам, сезонам и глобальному рейтингу.
- Персонализировать опыт: темы, скины доски и фигур, Pro-возможности.

### Целевая аудитория

- Новички, которые знают правила, но не понимают, почему проигрывают.
- Средние игроки, которым нужен быстрый разбор партий без сложных шахматных терминов.
- Школьники и студенты, которым нравится соревновательный формат.
- Игроки, которые хотят играть с друзьями по ссылке без сложной регистрации.
- Пользователи, которым важен прогресс, рейтинг и визуально приятный интерфейс.

### Дифференциатор

Главная уникальность - **AI Coach после каждой партии**. Он не просто показывает движковую оценку, а объясняет:

- где игрок сделал неточность, ошибку или грубую ошибку;
- почему позиция стала хуже;
- какой ход был лучше;
- какую идею стоит запомнить на будущее.

Формат объяснений должен быть коротким, человеческим и полезным: "Здесь ферзь ушел в атаку слишком рано, и король остался без защиты. Лучше было развить коня и подготовить рокировку".

## 2. Product Principles

### Быстрый старт важнее сложной настройки

Игрок должен попасть в партию за несколько секунд. Регистрация нужна для сохранения прогресса, но не должна блокировать базовую игру с другом или локальный режим.

### Обучение встроено в игру

Платформа не должна выглядеть как учебник. Обучение появляется естественно: после партии, при просмотре истории, в виде подсказок AI Coach и рекомендаций следующего упражнения.

### Интерфейс показывает продукт, а не маркетинг

Первый экран - рабочее приложение: доска, режимы игры, быстрый старт, панель прогресса. Не нужен отдельный лендинг как первый экран.

### Премиальный, но спокойный визуальный стиль

Дизайн должен ощущаться современным и дорогим, но не перегруженным. Визуальная энергия создается через доску, движения фигур, аккуратную типографику и качественные состояния, а не через случайные градиенты или декоративный шум.

### Mobile-first

Играть с телефона должно быть удобно: доска крупная, кнопки доступны большим пальцем, панели не мешают партии.

## 3. Core User Flows

### 3.1 Быстрый матч с другом по ссылке

1. Пользователь нажимает "Create Room".
2. Система создает комнату и показывает ссылку.
3. Пользователь отправляет ссылку другу.
4. Друг открывает ссылку и автоматически получает свободный цвет.
5. Партия начинается, когда оба игрока подключены.
6. После завершения партия сохраняется, если игроки авторизованы.
7. AI Coach предлагает разбор партии.

Ключевые состояния:

- ожидание второго игрока;
- оба игрока подключены;
- игрок временно потерял соединение;
- игрок вернулся в комнату;
- соперник сдался или вышел;
- партия завершилась матом, патом, временем или сдачей.

### 3.2 Игра против AI

1. Пользователь выбирает "Play vs AI".
2. Выбирает уровень: Beginner, Casual, Competitive, Expert.
3. Выбирает цвет или random.
4. Играет против Stockfish/AI worker.
5. После партии получает AI Coach breakdown.

Уровни AI:

- Beginner: намеренно ограниченная глубина анализа, иногда выбирает неидеальные ходы.
- Casual: играет стабильно, но не слишком сильно.
- Competitive: ищет тактические возможности.
- Expert: максимальная глубина, доступная в браузере без лагов.

### 3.3 Локальная игра на одном экране

1. Пользователь выбирает "Local 2 Players".
2. Два игрока играют на одном устройстве.
3. После каждого хода доска может поворачиваться к текущему игроку.
4. Партия сохраняется локально или в аккаунт, если пользователь авторизован.

### 3.4 История партий

1. Авторизованный пользователь открывает "History".
2. Видит список партий: дата, соперник, результат, режим, длительность.
3. Может открыть replay партии.
4. Может открыть AI Coach разбор.
5. Может поделиться карточкой результата.

### 3.5 Постматчевый AI-анализ

1. После окончания партии появляется экран summary.
2. Система запускает анализ ключевых ходов.
3. AI Coach показывает минимум 3 инсайта:
   - лучший ход игрока;
   - самая дорогая ошибка;
   - главный совет на следующую партию.
4. Pro-пользователь получает расширенный анализ всех критических моментов.

### 3.6 Лидерборд по городам

1. Пользователь указывает город в профиле.
2. Рейтинг обновляется после рейтинговых партий.
3. Лидерборд показывает:
   - global rank;
   - city rank;
   - seasonal rank;
   - wins/losses.
4. Игрок может сравнить себя с городом и друзьями.

### 3.7 Upgrade to Pro и кастомизация

1. Пользователь открывает профиль или экран после анализа.
2. Видит "Upgrade to Pro".
3. Pro unlocks:
   - deep AI analysis;
   - premium board themes;
   - custom piece skins;
   - unlimited game archive;
   - advanced stats;
   - share cards without watermark.

Для MVP достаточно Stripe-ready UI: кнопка, модальное окно тарифов, состояние `isPro`. Полная платежная интеграция может быть вынесена в следующий этап.

## 4. Functional Requirements

### 4.1 Chess Rules

Платформа обязана поддерживать полную шахматную логику:

- легальные ходы всех фигур;
- запрет ходов, оставляющих короля под шахом;
- шах, мат, пат;
- рокировка в обе стороны;
- взятие на проходе;
- превращение пешки;
- ничья по недостаточному материалу;
- ничья по правилу 50 ходов, если библиотека/реализация поддерживает;
- повторение позиции, если библиотека/реализация поддерживает;
- корректное завершение партии.

Правила должны реализовываться через надежную библиотеку, например `chess.js`, а не вручную.

### 4.2 Board Interaction

- Drag-and-drop фигур.
- Click-to-move для desktop и mobile.
- Подсветка выбранной фигуры.
- Подсветка доступных ходов.
- Подсветка последнего хода.
- Подсветка короля под шахом.
- Отмена выбора при клике вне допустимого хода.
- Promotion modal при достижении последней горизонтали.
- Блокировка ходов после завершения партии.

### 4.3 Multiplayer

- Создание комнаты по ссылке.
- Автоматическое назначение цветов.
- Синхронизация ходов в реальном времени.
- Отображение статуса подключения игроков.
- Reconnect с восстановлением FEN/PGN, таймеров и очереди хода.
- Защита от хода не в свой ход.
- Защита от хода игроком не своего цвета.
- Завершение партии при мате, пате, сдаче, истечении времени или выходе соперника.

### 4.4 AI Opponent

- Интеграция Stockfish через WASM или Web Worker.
- Несколько уровней сложности.
- AI ходит только после легального хода игрока.
- UI показывает состояние "AI thinking".
- Время ответа AI должно быть ограничено, чтобы интерфейс не зависал.

### 4.5 AI Coach

AI Coach анализирует партию после завершения и классифицирует ключевые ходы:

- `best move`;
- `good`;
- `inaccuracy`;
- `mistake`;
- `blunder`.

Каждый инсайт должен включать:

- номер хода;
- ход игрока;
- классификацию;
- короткое объяснение;
- лучший альтернативный ход;
- изменение оценки позиции.

Тон объяснений: дружелюбный, ясный, без перегруза нотацией.

### 4.6 Auth & Profiles

- Email/social auth через backend provider.
- Гостевой режим для быстрых партий.
- Профиль игрока:
  - username;
  - avatar;
  - city;
  - rating;
  - wins/losses;
  - current streak;
  - Pro status.

### 4.7 Game History

- Сохранение завершенных партий.
- Хранение PGN и финального FEN.
- Фильтры по режиму, результату, дате.
- Replay ходов.
- Доступ к coach insights.

### 4.8 Themes

- Dark theme.
- Light theme.
- System theme.
- Premium board skins для Pro.
- Выбор набора фигур.

### 4.9 Leaderboards

- Global leaderboard.
- City leaderboard.
- Seasonal leaderboard.
- Отображение рейтинга, побед, поражений, ранга.
- Empty state для города без игроков.

### 4.10 Business Layer

- Видимая кнопка "Upgrade to Pro".
- Pro modal с тарифом и преимуществами.
- Premium skins как демонстрация монетизации.
- В MVP платеж можно оставить как placeholder, но UI должен выглядеть готовым к Stripe.

## 5. UI/UX Design

### 5.1 App Shell

Первый экран должен быть приложением, а не лендингом.

Desktop layout:

- слева: навигация или компактный sidebar;
- центр: шахматная доска;
- справа: панель партии, таймеры, список ходов, coach preview;
- верх: профиль, тема, Upgrade to Pro;
- низ/side actions: resign, draw offer, rematch, copy room link.

Mobile layout:

- доска занимает основную часть экрана;
- таймеры закреплены над и под доской;
- действия доступны через компактный toolbar;
- история ходов, чат/статус, AI Coach и профиль открываются через tabs или bottom sheet;
- элементы не должны перекрывать доску.

### 5.2 Main Screens

#### Home / Play

Содержит:

- шахматную доску или активную партию;
- быстрые режимы: Friend Link, vs AI, Local, Daily Challenge;
- краткий progress card;
- кнопку Upgrade to Pro;
- быстрый доступ к history и leaderboard.

#### Game Room

Содержит:

- доску;
- player cards;
- таймеры;
- список ходов;
- captured pieces;
- game status;
- room link/copy action;
- resign/draw/rematch.

#### AI Coach Report

Содержит:

- итог партии;
- accuracy score;
- 3 ключевых инсайта;
- best move highlight;
- mistake timeline;
- CTA: "Analyze deeper with Pro".

#### Profile

Содержит:

- username/avatar/city;
- rating;
- wins/losses;
- streak;
- recent games;
- favorite skin;
- Pro status.

#### Leaderboard

Содержит:

- tabs: Global, City, Season;
- rank table;
- current user pinned row;
- city selector;
- empty state.

#### Upgrade Modal

Содержит:

- Pro преимущества;
- premium skin preview;
- deep analysis preview;
- Stripe-ready CTA;
- free vs pro comparison.

### 5.3 Component Inventory

- `ChessBoard`
- `BoardSquare`
- `ChessPiece`
- `LegalMoveHint`
- `PromotionModal`
- `MoveList`
- `CapturedPieces`
- `PlayerCard`
- `GameTimer`
- `GameStatusBanner`
- `RoomLinkPanel`
- `CoachInsightCard`
- `CoachReport`
- `LeaderboardTable`
- `ProfileSummary`
- `ThemeSwitcher`
- `UpgradeModal`
- `SkinPicker`
- `DailyChallengeCard`

### 5.4 Visual Style

The visual direction:

- premium digital sports arena;
- clean contrast;
- crisp typography;
- polished microinteractions;
- no imitation of Chess.com or Lichess;
- no decorative clutter.

Recommended palette:

- background dark: near-black graphite;
- surface: deep neutral charcoal;
- light theme background: warm off-white or clean gray;
- accent: emerald/teal for positive actions;
- warning: amber for inaccuracies;
- danger: red/coral for blunders;
- rating/pro: gold accent used sparingly.

Avoid:

- one-color purple/blue gradient UI;
- oversized marketing hero cards;
- unreadable low-contrast board colors;
- tiny mobile controls;
- cards nested inside cards.

### 5.5 Typography

- Use one modern sans-serif family.
- Board coordinates and clocks must be readable.
- Buttons should use concise labels.
- Coach explanations should be short paragraphs, not long essays.
- Do not scale font size purely with viewport width.

### 5.6 Accessibility

- Keyboard navigation for buttons, modals and tabs.
- Visible focus states.
- Sufficient contrast in both themes.
- Board must expose selected square, piece and legal targets where feasible.
- `prefers-reduced-motion` must disable decorative animations.
- Promotion modal must be usable by keyboard.
- Timer information should be visible as text, not only color.

## 6. Animations & Delight

### Required Animations

- Smooth piece movement between squares.
- Subtle legal move hints.
- Last move highlight fade.
- Check pulse on king square.
- Capture feedback.
- Promotion modal scale/fade.
- AI thinking shimmer or dots.
- Coach insight reveal after analysis.
- Skeleton loading for history, leaderboard and analysis.
- Confetti only for win, achievement or rating milestone.

### Animation Rules

- Animations must support the product, not distract from the game.
- Piece movement should feel fast and precise.
- Critical game feedback must be immediate.
- Reduced motion users get instant state changes with no decorative movement.
- No layout shifts during hover, loading or dynamic text.

## 7. Retention Mechanics

### Daily Challenge

Daily tactical puzzle or fixed-position challenge. It should appear as a small entry point, not block the main game.

### Streaks

Track consecutive days with at least one completed game or challenge.

### Rating Progress

After rated games, show:

- rating before/after;
- delta;
- city rank movement;
- next milestone.

### Share Card

After a win or strong performance, generate a visual card:

- result;
- rating change;
- best move;
- city rank;
- watermark for free users;
- no watermark for Pro.

### Achievements

Examples:

- First Checkmate;
- 3-Day Streak;
- Beat AI Casual;
- Top 10 in City;
- Blunder-Free Game.

## 8. Monetization

### Free Plan

- Play local games.
- Play friend link games.
- Limited AI games.
- Basic post-game coach summary.
- Limited game archive.
- Basic themes.

### Pro Plan

- Deep AI analysis.
- Unlimited game archive.
- Advanced performance stats.
- Premium board themes.
- Premium piece skins.
- Share cards without watermark.
- Priority access to new coach features.

### Upgrade Touchpoints

- Header/profile.
- After coach report.
- When opening deep analysis.
- Skin picker.
- Game history archive limit.

Upgrade prompts must be visible but not aggressive.

## 9. Content Tone

The app should sound confident, clear and helpful.

Good examples:

- "You lost control of the center here. Try developing the knight first."
- "Great move: this wins tempo and protects your king."
- "Your city rank improved by 4 places."
- "Deep analysis is available in Pro."

Avoid:

- insulting the player;
- overusing chess jargon;
- long paragraphs in gameplay UI;
- fake motivational noise.

## 10. Success Metrics

Product metrics:

- time to first move;
- created rooms;
- completed games;
- rematch rate;
- AI Coach report views;
- users who return next day;
- Pro modal opens;
- leaderboard interactions.

Quality metrics:

- illegal move rejection works consistently;
- multiplayer room sync does not desync;
- mobile board remains usable;
- analysis completes within acceptable time;
- no major layout shifts during gameplay.

## 11. MVP Definition

MVP should include:

- legal chess board;
- local play;
- friend-link multiplayer;
- basic auth/profile;
- saved game history;
- Stockfish AI opponent;
- basic AI Coach report;
- dark/light theme;
- responsive UI;
- leaderboard prototype;
- Upgrade to Pro UI;
- polished board animations.

Deferred beyond MVP:

- full Stripe checkout;
- complex anti-cheat;
- tournament system;
- real chat moderation;
- advanced coach personalization;
- native mobile app.

## 12. Final Submission Requirements

The final project must prepare:

- working deployed project link;
- GitHub repository link;
- `README.md` with:
  - what was built;
  - who it is for;
  - why it is valuable;
  - key features;
  - tech stack;
  - setup instructions;
  - screenshots or short demo notes.

The README should clearly explain that the project aims for a startup-style prototype, not just a chessboard.
