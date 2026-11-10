# CLAUDE.md — Clip Trimmer

Браузерный обрезчик видео: загрузил MP4 → таймлайн с миниатюрами на Canvas → выбрал отрезок → скачал новый MP4. Всё на клиенте, без бэкенда. Полное описание и задачи — в `SPEC.md`. Перед задачей читай только те разделы SPEC, на которые она ссылается.

## Стек

- Nuxt 4 (`ssr: false`, статическая сборка через `nuxt generate`), Vue 3, TypeScript strict
- Pinia (`@pinia/nuxt`) — только состояние редактора
- mp4box.js 2.x — разбор MP4 в воркере
- WebCodecs (`VideoDecoder`) — кадры для миниатюр, вручную, без обёрток
- Mediabunny — только экспорт (обрезка + сборка MP4), в отдельном воркере
- Vitest — юнит-тесты чистых модулей
- ESLint (`@nuxt/eslint`)
- npm

## Команды

```bash
npm run dev        # dev-сервер
npm run lint       # ESLint
npm run typecheck  # nuxi typecheck
npm test           # vitest run
npm run generate   # статическая сборка в .output/public
```

## Структура

```
app/
  pages/index.vue            # единственная страница, редактор в <ClientOnly>
  components/                # FilePicker, VideoPreview, TimelineCanvas, ExportPanel, UnsupportedBrowser
  composables/               # useMediaWorker, useExportWorker, useTimelineRenderer
  stores/editor.ts           # Pinia: файл, метаданные, in/out, currentTime, статусы
lib/                         # чистый TS, без Vue и без DOM (кроме renderer.ts, которому передают ctx)
  timeline/geometry.ts       # время ↔ пиксели, ограничения ручек, hit-test
  timeline/renderer.ts       # drawTimeline(ctx, state) — чистая функция отрисовки
  media/protocol.ts          # типы сообщений воркеров (discriminated unions)
  media/thumbnails.ts        # выбор ключевых кадров под слоты миниатюр
workers/
  media.worker.ts            # mp4box + VideoDecoder → ImageBitmap
  export.worker.ts           # Mediabunny Conversion с trim
tests/                       # *.test.ts для lib/
```

## Правила кода

- TypeScript strict, без `any` и без `as` для обхода типов. Для внешних библиотек без типов — узкий `.d.ts`.
- `lib/` не импортирует Vue, Pinia и Nuxt. Логику можно тестировать без браузера.
- Компоненты тонкие: обработка событий и вызов `lib/` или composables. Математика таймлайна только в `geometry.ts`.
- Сообщения воркеров — только типы из `lib/media/protocol.ts`, у каждого запроса `requestId`.
- **Ресурсы:** каждый `VideoFrame` закрывается через `close()` сразу после использования. `ImageBitmap` закрывается при замене файла и при размонтировании. Декодер и воркер закрываются при новом файле. Нарушение — баг, а не стиль.
- Тяжёлое — только в воркерах. Главный поток не декодирует и не кодирует.
- Перерисовка Canvas только через `requestAnimationFrame` и только при изменении состояния (флаг dirty). Никаких `setInterval`.
- Canvas учитывает `devicePixelRatio` и размер через `ResizeObserver`.
- Новые зависимости — только из списка в стеке. Нужно что-то ещё — сначала спроси.
- Комментарии и идентификаторы на английском. Комментарий объясняет «почему», а не «что».

## Порядок работы над задачей

1. Прочитай задачу в SPEC.md и указанные разделы.
2. Короткий план: какие файлы меняются и зачем. Дождись подтверждения.
3. Код. Не выходи за рамки задачи и не делай «заодно».
4. `npm run lint && npm run typecheck && npm test` — всё зелёное. Для задач с UI ещё `npm run dev` и ручная проверка по критериям приёмки.
5. Коротко: что сделано, что проверено, что осталось. Коммит делает человек после ревью диффа.

## Вне рамок

Бэкенд, авторизация, несколько разрезов, текст поверх видео, аудио-дорожки, WebGL, поддержка Firefox и Safari сверх сообщения «браузер не поддерживается». Если задача тянет туда — остановись и спроси.
