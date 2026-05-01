# Product Differentiation Roadmap

## Goal

Выделить Mahiru Arena как шахматную платформу с персональным AI-тренером и городским социальным слоем, а не просто как приложение с доской. Фокус roadmap: показать, что продукт помогает игроку учиться на собственных ошибках, соревноваться локально и выглядит как прототип реального сервиса.

## Feature 1: Stronger AI Coach

### User Value

Игрок после партии должен быстро понять не только факт ошибки, но и что нужно было сыграть вместо этого. Это превращает игру в короткий тренировочный цикл: сыграл, увидел ключевую ошибку, понял лучший ход, вернулся к практике.

### UI/UX Changes

- Переработать карточки AI Coach в три понятных блока: `Mistake`, `Better move`, `Why`.
- Для хороших ходов использовать те же блоки, но с позитивной формулировкой: `Move`, `Engine idea`, `Why it worked`.
- Визуально выделять `mistake` и `blunder` сильнее, чем `good` и `best move`.
- Показывать изменение оценки рядом с ходом: например `+0.4 -> -1.2`.

### Technical Notes

- Использовать существующий `CoachInsight`.
- `classification` подходит для блока `Mistake`.
- `bestMove` подходит для блока `Better move`.
- `explanation` подходит для блока `Why`.
- `evalBefore` и `evalAfter` уже позволяют показать swing без изменения схемы БД.

### Acceptance Criteria

- После завершения партии AI Coach показывает минимум одну карточку с блоками `Mistake`, `Better move`, `Why`.
- Для `mistake` и `blunder` карточка визуально отличается от нейтральных insights.
- Если engine fallback сработал, UI всё равно показывает понятные coach-карточки.
- Текст карточек читается на mobile и desktop без наложений.

### Checklist

- [ ] Обновить разметку AI Coach в `ArenaApp`.
- [ ] Добавить helper для форматирования оценки.
- [ ] Добавить component test на `Mistake / Better move / Why`.
- [ ] Проверить внешний вид на desktop.
- [ ] Проверить внешний вид на mobile.

## Feature 2: City Leaderboard

### User Value

Городской лидерборд даёт социальную мотивацию: игрок соревнуется не только глобально, но и с людьми из своего города. Это делает продукт более локальным и запоминающимся.

### UI/UX Changes

- Добавить фильтр leaderboard: `Global` и город пользователя.
- Если у пользователя указан город, показывать бейдж вроде `#3 in Almaty`.
- В списке leaderboard показывать город рядом с именем игрока.
- Для гостя показывать нейтральный фильтр `Global`, а city-фильтр делать доступным после входа или заполнения профиля.

### Technical Notes

- Использовать существующий `profiles.listLeaderboard(city?)`.
- В `ArenaApp` уже есть `profileDraft.city` и `profile?.city`.
- Ранг уже есть в `LeaderboardEntry.rank`.
- Новая миграция не нужна для v1.

### Acceptance Criteria

- Пользователь может переключить leaderboard между `Global` и своим городом.
- При выборе города вызывается `listLeaderboard(city)`.
- Бейдж ранга показывается, если текущий пользователь найден в leaderboard.
- Если в городе нет данных, показывается empty state без ошибки.

### Checklist

- [ ] Добавить state для активного leaderboard-фильтра.
- [ ] Добавить переключатель `Global / City`.
- [ ] Показать city rank badge.
- [ ] Добавить component test на фильтрацию.
- [ ] Добавить component test на rank badge.

## Feature 3: Practice From Mistake

### User Value

Игроку мало прочитать совет. Сильнее работает возможность сразу переиграть ошибочную позицию. Это делает AI Coach интерактивным и повышает возвращаемость.

### UI/UX Changes

- Добавить кнопку `Practice this position` на coach-карточках с ошибками.
- Альтернативный текст для истории партии: `Replay from mistake`.
- После нажатия доска загружается в позицию до ошибочного хода.
- Статус игры меняется на тренировочный: например `Practice mode: find the better move`.
- Показывать подсказку с recommended move только после попытки или как раскрываемый hint.

### Technical Notes

- Для полноценной v1 нужно знать FEN позиции до хода.
- Сейчас `CoachInsight` не хранит `beforeFen`, но engine coach внутри уже вычисляет `ReplayPoint.beforeFen`.
- Минимальный путь: расширить `CoachInsight` полем `practiceFen?: string`.
- Для device/local режима можно хранить это только в runtime, без миграции.
- Для Supabase сохранения можно либо не сохранять `practiceFen` в v1, либо добавить позже отдельной миграцией.

### Acceptance Criteria

- На ошибочной coach-карточке есть `Practice this position`.
- Нажатие переводит доску в позицию до ошибки.
- Игрок может сделать ход из этой позиции.
- `New` возвращает обычную новую партию.
- Фича работает без Supabase-миграции в локальном runtime.

### Checklist

- [ ] Решить runtime-формат для `practiceFen`.
- [ ] Расширить coach insight creation, чтобы сохранять FEN до ошибки.
- [ ] Добавить handler `startPracticeFromInsight`.
- [ ] Добавить статус practice mode.
- [ ] Добавить unit/component test на смену позиции.

## Feature 4: README Pitch

### User Value

README должен продавать проект как продукт. Проверяющий должен за 30 секунд понять: для кого сервис, почему он отличается и какие фичи доказывают уровень выше обычной шахматной доски.

### UI/UX Changes

- Это не UI-фича, но README должен иметь структуру питча.
- В начало добавить короткий product statement.
- Отдельно выделить `Why it stands out`.
- Добавить секцию `Startup angle`: AI Coach, city competition, Pro path.
- Обновить список фич только после фактической реализации.

### Technical Notes

- README уже содержит сильную базу.
- После реализации новых фич обновить формулировки про AI Coach, city leaderboard и practice mode.
- Не обещать Stripe или полноценную монетизацию, если есть только Pro modal.

### Acceptance Criteria

- README объясняет аудиторию, ценность и отличие продукта.
- README честно совпадает с реализованными фичами.
- Есть короткий список проверок и команд запуска.
- Есть ссылки на актуальные screenshots.

### Checklist

- [ ] Обновить intro.
- [ ] Добавить `Why it stands out`.
- [ ] Добавить `Product loop`.
- [ ] Обновить feature list.
- [ ] Проверить, что README не обещает нереализованные фичи.

## Feature 5: README Screenshots

### User Value

Хорошие скриншоты помогают быстро показать уровень продукта: адаптивность, визуальную идентичность, AI Coach и социальные элементы.

### UI/UX Changes

- Подготовить desktop screenshot с видимой доской, AI Coach и leaderboard.
- Подготовить mobile screenshot с playable board и компактным layout.
- В README добавить секцию `Screenshots` с двумя изображениями.

### Technical Notes

- Использовать Playwright для стабильных скриншотов.
- Сохранить файлы как `desktop-product.png` и `mobile-product.png` или похожие понятные имена.
- Перед скриншотом проверить, что canvas не пустой и текст не накладывается.
- Если нужны coach-карточки на скриншоте, сначала подготовить состояние завершённой партии.

### Acceptance Criteria

- Есть минимум два актуальных screenshot-файла.
- Desktop screenshot показывает продуктовую ценность, а не пустую доску.
- Mobile screenshot показывает, что приложением удобно пользоваться с телефона.
- README содержит ссылки на эти изображения.

### Checklist

- [ ] Запустить локальный dev server.
- [ ] Сделать desktop screenshot.
- [ ] Сделать mobile screenshot.
- [ ] Проверить изображения визуально.
- [ ] Добавить ссылки в README после финального выбора файлов.

## Suggested Delivery Order

1. Stronger AI Coach.
2. Practice From Mistake.
3. City Leaderboard.
4. README Pitch.
5. README Screenshots.

## Final Test Plan

- [ ] `npm test`
- [ ] `npm run lint -- --quiet`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Manual desktop visual check.
- [ ] Manual mobile visual check.

## Assumptions

- Этот roadmap не реализует сами фичи, а фиксирует следующий product plan.
- Новая БД-миграция не нужна для v1.
- README обновляется после реализации, чтобы описание не обещало будущий функционал как готовый.
- Скриншоты делаются после визуальной проверки, чтобы они выглядели как submission assets.
