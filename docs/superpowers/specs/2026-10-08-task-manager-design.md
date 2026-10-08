# Task Manager — дизайн-спек

Дата: 2026-10-08
Источник макетов: https://claude.ai/artifact/NAi4Ko1d5atU1JMKCQLs9H (экраны Issue list, Board, Issue detail)

## 1. Цель и рамки

Простой таск-менеджер в стиле Linear, реализующий всё, что есть на макетах: список задач, канбан-доска,
детальная страница задачи, а также разделы сайдбара — Inbox, My issues, Projects, Views, Cycles, несколько команд.

**Входит:**
- Задачи: создание, редактирование, удаление; статус, приоритет, исполнитель, лейблы, проект, цикл,
  дедлайн, оценка (points), описание, подзадачи.
- Комментарии и лента активности по задаче.
- Список (группировка по статусам, вкладки All / Active / Backlog, сворачивание групп, плотность Display).
- Доска с drag&drop между колонками и внутри колонки.
- My issues, Inbox (непрочитанные события по моим задачам), Projects (список + страница проекта),
  Cycles (список циклов команды + задачи цикла), Views (сохранённые фильтры, CRUD).
- Несколько команд с собственным префиксом ID (`DEV-142`, `DES-12`).

**Не входит (заглушки или отсутствует):**
- Авторизация. Вместо неё — переключатель «текущий пользователь» среди сидовых пользователей.
- Search (иконка без действия), Invite people (неактивный пункт).
- Realtime-синхронизация между вкладками, вложения, markdown-редактор (описание — plain textarea, рендер как текст с переносами).

**Критерии успеха:**
- `pnpm install && pnpm db:setup && pnpm dev` поднимает рабочее приложение на локальном Postgres.
- Все три экрана визуально соответствуют макетам (цвета, шрифты, иконки, отступы).
- Все свойства задачи редактируются из UI и сохраняются в БД; изменения видны в activity.
- Тесты API, shared и web проходят (`pnpm test`).

## 2. Архитектура

Монорепа на pnpm workspaces, TypeScript везде (strict).

```
task-manager/
  package.json            скрипты-оркестраторы: dev, build, test, lint, db:*
  pnpm-workspace.yaml
  tsconfig.base.json
  .env.example            DATABASE_URL, DATABASE_URL_TEST, API_PORT
  apps/
    api/                  Fastify + zod + Drizzle ORM
      src/
        db/schema.ts      таблицы Drizzle
        db/client.ts
        db/seed.ts
        routes/*.ts       по ресурсу: issues, comments, teams, users, labels, projects, cycles, views, inbox
        services/*.ts     бизнес-логика (нумерация, activity, фильтры)
        app.ts            сборка Fastify-приложения (для тестов через inject)
        server.ts         запуск
      drizzle/            SQL-миграции (drizzle-kit generate)
      test/
    web/                  React 18 + Vite + TanStack Query + React Router + @dnd-kit
      src/
        api/              типизированный клиент поверх fetch
        components/       Sidebar, IssueRow, IssueCard, BoardColumn, StatusIcon, PriorityIcon,
                          Avatar, LabelChip, PropertyPicker, NewIssueModal, FilterMenu, CommentBox, Toast
        pages/            IssueListPage, BoardPage, IssuePage, MyIssuesPage, InboxPage,
                          ProjectsPage, ProjectPage, CyclesPage, CyclePage, ViewPage, NotFound
        styles/tokens.css CSS-переменные из макета
  packages/
    shared/               zod-схемы, типы, константы статусов/приоритетов
```

Vite проксирует `/api` на Fastify (порт 3001). Web на порту 5173.

## 3. Модель данных (Postgres 17, Drizzle)

Все id — `uuid` (`gen_random_uuid()`), времена — `timestamptz`.

| Таблица | Поля |
|---|---|
| `users` | id, name, initials, color |
| `teams` | id, name, key (unique, `DEV`), color, issue_counter int default 0 |
| `projects` | id, team_id → teams, name, created_at |
| `cycles` | id, team_id → teams, number, starts_on date, ends_on date; unique(team_id, number) |
| `labels` | id, team_id → teams, name, color |
| `issues` | id, team_id, number, title, description text default '', status enum, priority enum, assignee_id → users null, creator_id → users, project_id null, cycle_id null, parent_id → issues null (on delete set null), due_date date null, estimate int null, sort_order double precision, created_at, updated_at; unique(team_id, number) |
| `issue_labels` | issue_id, label_id; PK(issue_id, label_id); cascade |
| `comments` | id, issue_id (cascade), author_id, body, created_at |
| `activity` | id, issue_id (cascade), actor_id, type, payload jsonb, created_at |
| `inbox_reads` | user_id, activity_id; PK(user_id, activity_id); cascade |
| `views` | id, name, team_id null, filters jsonb, created_at |

Enum'ы:
- `issue_status`: `backlog | todo | in_progress | in_review | done`
- `issue_priority`: `none | urgent | high | medium | low`

Порядок статусов в UI: In Progress, In Review, Todo, Backlog, Done (список); Backlog, Todo, In Progress, In Review, Done (доска) — как на макетах.

**Нумерация.** При создании задачи в транзакции: `UPDATE teams SET issue_counter = issue_counter + 1 WHERE id = $1 RETURNING issue_counter` — значение становится `number`. Отображаемый ключ — `${team.key}-${number}`.

**sort_order.** Новая задача получает `max(sort_order в статусе) + 1000`. При drag&drop клиент вычисляет среднее между соседями и шлёт `PATCH { status, sortOrder }`.

**Activity.** Типы: `created`, `status`, `priority`, `assignee`, `title`, `labels`, `project`, `cycle`, `due_date`, `estimate`, `parent`, `comment`. payload — `{ from, to }` (для `comment` — `{ commentId }`). Пишется в той же транзакции, что и изменение; изменения description в activity не пишутся.

**Inbox.** Для пользователя U: события activity по задачам, где U — assignee или creator, у которых actor ≠ U. Прочитанность — наличие строки в `inbox_reads`. Счётчик в сайдбаре — число непрочитанных.

**Views.** `filters` соответствует схеме `IssueFilters` из shared: `{ teamId?, status?[], priority?[], assigneeId?[], labelId?[], projectId?, cycleId? }`.

**Seed.** 4 пользователя из макета (Anna Romanova, Max Kim, Denis Sokolov, Elena Volkova), команды Engineering (`DEV`, #2F7D6D) и Design (`DES`, #B5582F), лейблы Bug/Feature/Mobile/Infra/Design/Docs с цветами макета, проект «Mobile app 2.0», цикл 14 (Oct 6–19), задачи из макетов с их номерами (DEV-151, DEV-142 и т.д.; счётчик команды выставляется в максимум), подзадачи DEV-143..145 у DEV-142, комментарий Max Kim. Seed идемпотентен (truncate + insert).

## 4. API

REST, префикс `/api`, JSON. Текущий пользователь — заголовок `X-User-Id` (uuid); если не передан или не найден — 400 на эндпоинтах, которым он нужен (создание, изменение, комментарии, inbox, `mine=true`).

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/users` | список пользователей |
| GET | `/teams` | команды |
| GET | `/labels?teamId=` | лейблы |
| GET/POST | `/projects`, GET `/projects/:id` | проекты (+ прогресс: done/total) |
| GET | `/cycles?teamId=`, `/cycles/:id` | циклы |
| GET | `/issues` | фильтры: `teamId`, `status`, `priority`, `assigneeId`, `labelId` (повторяемые), `projectId`, `cycleId`, `mine=true`, `parentId` |
| GET | `/issues/:key` | `DEV-142` → задача + labels + assignee + project + cycle + parent + children + comments + activity |
| POST | `/issues` | `{ teamId, title, description?, status?, priority?, assigneeId?, labelIds?, projectId?, cycleId?, parentId?, dueDate?, estimate? }` |
| PATCH | `/issues/:id` | частичное обновление любых полей из POST (кроме teamId) + `sortOrder` |
| DELETE | `/issues/:id` | удаление |
| POST | `/issues/:id/comments` | `{ body }` |
| GET | `/inbox` | события + флаг read + краткие данные задачи; `unreadCount` |
| POST | `/inbox/read` | `{ activityIds: string[] }` или `{ all: true }` |
| GET/POST | `/views`, GET/PATCH/DELETE `/views/:id` | сохранённые фильтры |

Список задач возвращает «плоские» элементы `IssueListItem` (key, title, status, priority, labels, assignee, createdAt, sortOrder, …), сортировка по `sort_order`.

**Ошибки:** `{ error: { code, message, details? } }`. 400 — валидация (zod), 404 — не найдено, 409 — конфликт (например, parent из другой команды или parent = сама задача). Неожиданные — 500 с логированием.

## 5. Фронтенд

**Маршруты:**
- `/` → редирект на `/team/DEV/issues`
- `/team/:teamKey/issues?tab=all|active|backlog` — список
- `/team/:teamKey/board` — доска
- `/team/:teamKey/cycles`, `/cycles/:id`
- `/issue/:issueKey` — деталка
- `/my-issues`, `/inbox`, `/projects`, `/projects/:id`, `/views`, `/views/:id`
- `*` — NotFound

**Раскладка:** как в макете — сайдбар 232px слева, основная область в карточке с рамкой и радиусом 10px. Сайдбар: аватар воркспейса, кнопки Search (заглушка) и New issue, Inbox со счётчиком, My issues, Workspace → Projects, Views, Your teams → команды (раскрываемые) → Issues / Cycles / Projects, внизу Invite people (неактивно) и переключатель текущего пользователя.

**Список:** шапка с хлебными крошками, вкладки, Filter, переключатель List/Board, Display (comfortable 44px / compact 36px строки, хранится в localStorage). Группы по статусу со сворачиванием (Done свёрнута по умолчанию). Строка: приоритет, ID, статус, заголовок (ellipsis), лейблы, дата создания (`Oct 7`), аватар. Клик по иконке статуса/приоритета/аватару открывает PropertyPicker, клик по строке — деталку.

**Доска:** колонки 272px, горизонтальный скролл, заголовок колонки с иконкой статуса, счётчиком и «+» (открывает NewIssueModal с предзаполненным статусом). Карточка: ID, аватар, заголовок, приоритет, лейблы. Drag&drop через `@dnd-kit` (между колонками и сортировка), оптимистично.

**Деталка:** заголовок (inline-редактирование), описание (textarea с автосохранением по blur), блок Sub-issues (с счётчиком done/total и добавлением подзадачи), Activity (события + комментарии, CommentBox), правая панель Properties: Status, Priority, Assignee, Labels, Project, Cycle, Due date, Estimate — каждое через PropertyPicker. Меню «⋯» с удалением (с подтверждением).

**Filter / Views:** FilterMenu позволяет выбрать статусы, приоритеты, исполнителей, лейблы, проект, цикл; фильтры отражаются в URL query. Кнопка «Save as view» создаёт View; страница View показывает список с этими фильтрами, позволяет переименовать и удалить.

**Остальные страницы:** My issues — список, сгруппированный по статусу, `mine=true`. Inbox — лента событий с непрочитанной точкой, клик отмечает прочитанным и ведёт на задачу, «Mark all read». Projects — таблица проектов с прогрессом; страница проекта — список его задач. Cycles — циклы команды с датами и прогрессом; страница цикла — список задач цикла.

**Данные:** TanStack Query, ключи вида `['issues', filters]`, `['issue', key]`. Мутации оптимистичные для PATCH (список, доска, деталка), откат и toast при ошибке, инвалидация связанных запросов после успеха.

**Состояния:** скелетоны строк/карточек при загрузке, пустые состояния с кнопкой создания задачи, NotFound для неизвестных задач/команд/views, toast для ошибок сети.

**Стили:** CSS Modules + `tokens.css`:
- фон `#0B0B0D`, панель `#121215`, рамка панели `#222227`, разделители `#1F1F23`/`#1A1A1E`
- карточка `#161619`, рамка `#26262B`, hover `#17171C`/`#18181C`, активный nav `#1C1C21`
- текст `#E8E8EC`, вторичный `#8E8E97`, тело описания `#D2D2D8`, лейблы `#C9C9D0`
- акцент `#5E63E6`; статусы: todo `#B4B4BC`, in progress `#E2B53E`, in review `#4CB782`, backlog `#8E8E97` (пунктир), done — акцент; urgent `#F2994A`
- шрифты Geist 400/500/600 и Geist Mono (Google Fonts), базовый размер 13px
- иконки статусов и приоритетов — SVG из макета без изменений

Адаптив: на ширине < 760px сайдбар переносится наверх (flex-wrap, как в макете), скрываются лейблы и дата в строках.

## 6. Тестирование

- **packages/shared:** Vitest — схемы (валидные/невалидные payload'ы, парсинг ключа `DEV-142`).
- **apps/api:** Vitest + `app.inject()` на отдельной БД `DATABASE_URL_TEST`; перед прогоном применяются миграции, перед каждым тестом — truncate. Покрытие: нумерация ID (последовательность, параллельные создания не дают дублей), фильтры `/issues`, PATCH пишет activity, комментарии, inbox (видимость и read), views CRUD, коды ошибок 400/404/409.
- **apps/web:** Vitest + Testing Library + MSW — группировка списка и вкладки, PropertyPicker меняет значение и вызывает PATCH, оптимистичный откат при ошибке, NewIssueModal.
- **Смоук:** Playwright вручную по трём основным экранам в конце реализации.

## 7. Разработка и запуск

- `pnpm db:setup` — создаёт БД `taskmanager` и `taskmanager_test` (через `createdb`, если нет), применяет миграции, seed.
- `pnpm dev` — параллельно api (tsx watch) и web (vite).
- `pnpm test`, `pnpm typecheck`, `pnpm lint` (ESLint + Prettier).
