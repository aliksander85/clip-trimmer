# SPEC — Clip Trimmer

## 1. Цель

Небольшой проект под стек вакансии Senior Full Stack (Clideo): Nuxt + TypeScript, Canvas, Web Workers, WebCodecs, mp4box.js, внимание к памяти и производительности.

Читатель — техлид, у которого на проект минут пять. Ему нужно: открыть демо, загрузить видео, увидеть быстрый таймлайн, обрезать, скачать. Потом открыть 2–3 ключевых файла и README.

Срок: два вечера. Сдача: публичный репозиторий + демо на GitHub Pages + README.

## 2. Что умеет (scope)

**Входит**
1. Выбор MP4-файла (кнопка и drag-and-drop), лимит 500 МБ.
2. Проверка поддержки: нет WebCodecs → экран «браузер не поддерживается, откройте в Chrome или Edge».
3. Превью в `<video>` с play/pause.
4. Таймлайн на Canvas: полоса миниатюр, затемнение вне выбранного отрезка, две ручки (in и out), плейхед, метки времени.
5. Ручки и плейхед тянутся мышью и пальцем (pointer events). Клик по таймлайну — перемотка.
6. Воспроизведение только внутри отрезка: дошли до out — пауза и возврат на in.
7. Экспорт отрезка в MP4 с прогрессом и отменой, потом скачивание.
8. Миниатюры появляются постепенно, по мере декодирования.

**Не входит** (перечислить в README как «что дальше»): бэкенд, несколько разрезов, текст поверх видео, аудио-волна, WebGL-эффекты, Firefox и Safari, файлы больше 500 МБ, HEVC и VP9.

## 3. Пользовательский сценарий

1. Пустой экран: зона «перетащите MP4 или выберите файл».
2. Файл выбран → сразу видео в превью, длительность и разрешение. Таймлайн рисуется с серыми плейсхолдерами, миниатюры заполняют слоты по мере готовности.
3. По умолчанию in = 0, out = длительность.
4. Пользователь тянет ручки, жмёт play, смотрит отрезок.
5. «Экспорт» → прогресс в процентах, кнопка «Отмена» → готово → «Скачать» (`<имя>_trim.mp4`).
6. «Другой файл» → всё состояние и ресурсы освобождаются, возврат на шаг 1.

## 4. Архитектура

```
 главный поток                                   воркеры
┌───────────────────────────────┐   File    ┌──────────────────────────┐
│ FilePicker → editor store     │──────────▶│ media.worker             │
│                               │           │  mp4box: moov, сэмплы     │
│ VideoPreview (<video>)        │◀──────────│  VideoDecoder: ключевые   │
│   currentTime ↔ store         │ meta,     │  кадры → ImageBitmap      │
│                               │ thumbs    │  (transferable)           │
│ TimelineCanvas                │           └──────────────────────────┘
│   geometry.ts + renderer.ts   │
│   rAF + dirty flag            │   File,   ┌──────────────────────────┐
│                               │   in/out  │ export.worker             │
│ ExportPanel                   │──────────▶│  Mediabunny Conversion    │
│                               │◀──────────│  trim → BufferTarget      │
└───────────────────────────────┘ progress, └──────────────────────────┘
                                   Blob
```

Почему два MP4-инструмента: миниатюры — ручной конвейер на mp4box.js и сыром `VideoDecoder`, чтобы показать работу с WebCodecs напрямую. Экспорт (перекодирование, аудио, мультиплексирование) — Mediabunny, потому что писать муксер за вечер нереалистично. Это решение явно описать в README.

`File` передаётся в воркер через `postMessage`: копируется ссылка, а не содержимое.

## 5. Модули и интерфейсы

### 5.1 Состояние (`app/stores/editor.ts`)

```ts
type Phase = 'empty' | 'loading' | 'ready' | 'exporting' | 'exported' | 'error'

interface VideoMeta {
  durationSec: number
  width: number
  height: number
  codec: string        // строка кодека из mp4box, напр. 'avc1.64001f'
  fps: number | null
}

interface EditorState {
  phase: Phase
  file: File | null
  meta: VideoMeta | null
  inSec: number
  outSec: number
  currentSec: number
  isPlaying: boolean
  thumbs: (ImageBitmap | null)[]   // по слотам; null — ещё не готов
  exportProgress: number           // 0..1
  exportUrl: string | null         // object URL; revoke при сбросе
  error: string | null
}
```

Экшены: `loadFile`, `setMeta`, `setThumb(index, bitmap)`, `setTrim(inSec, outSec)`, `seek(sec)`, `reset()`. `reset()` закрывает все `ImageBitmap`, делает `URL.revokeObjectURL`, завершает воркеры.

Миниатюры (`ImageBitmap`) хранить в `shallowRef` или `markRaw` — Vue не должен делать их реактивными.

### 5.2 Геометрия (`lib/timeline/geometry.ts`)

Чистые функции, 100% покрытие тестами.

```ts
interface Viewport { widthPx: number; durationSec: number; paddingPx: number }

timeToX(sec: number, vp: Viewport): number
xToTime(x: number, vp: Viewport): number          // с клампом в [0, duration]
clampTrim(inSec: number, outSec: number, durationSec: number, minLenSec: number):
  { inSec: number; outSec: number }               // in < out, длина ≥ minLen (0.1 с)
moveHandle(handle: 'in' | 'out', sec: number, trim, durationSec, minLenSec): trim
hitTest(x: number, trim, vp, tolerancePx: number): 'in' | 'out' | 'playhead' | 'track' | null
thumbSlots(widthPx: number, thumbWidthPx: number): number   // сколько миниатюр влезает
slotTimes(count: number, durationSec: number): number[]     // центры слотов в секундах
```

Порядок в `hitTest`: ручки важнее плейхеда, плейхед важнее дорожки.

### 5.3 Отрисовка (`lib/timeline/renderer.ts`)

```ts
interface RenderState {
  vp: Viewport
  thumbs: (ImageBitmap | null)[]
  inSec: number; outSec: number; currentSec: number
  hover: 'in' | 'out' | 'playhead' | null
  dpr: number
}
drawTimeline(ctx: CanvasRenderingContext2D, s: RenderState): void
```

Слои по порядку: фон → миниатюры (плейсхолдер для `null`) → затемнение вне [in, out] → рамка отрезка → ручки (подсветка при hover) → плейхед → метки времени (`mm:ss.s`).

`useTimelineRenderer` держит canvas, `ResizeObserver`, `dpr` и цикл `requestAnimationFrame`. Цикл рисует только если стоит флаг `dirty`. Флаг ставят изменения стора и наведение. Во время воспроизведения флаг ставится каждый кадр.

### 5.4 Протокол воркеров (`lib/media/protocol.ts`)

```ts
// главный поток → media.worker
type MediaRequest =
  | { type: 'open'; requestId: number; file: File; thumbTimesSec: number[]; thumbHeightPx: number }
  | { type: 'cancel'; requestId: number }

// media.worker → главный поток
type MediaResponse =
  | { type: 'meta'; requestId: number; meta: VideoMeta }
  | { type: 'thumb'; requestId: number; index: number; bitmap: ImageBitmap }   // transfer: [bitmap]
  | { type: 'done'; requestId: number }
  | { type: 'error'; requestId: number; message: string }

// export.worker
type ExportRequest =
  | { type: 'export'; requestId: number; file: File; inSec: number; outSec: number }
  | { type: 'cancel'; requestId: number }
type ExportResponse =
  | { type: 'progress'; requestId: number; value: number }
  | { type: 'done'; requestId: number; blob: Blob }
  | { type: 'error'; requestId: number; message: string }
```

Ответы с устаревшим `requestId` главный поток игнорирует, полученные в них `ImageBitmap` сразу закрывает.

### 5.5 Конвейер миниатюр (`media.worker.ts`, `lib/media/thumbnails.ts`)

1. Читать `File` кусками по 4 МБ (`file.slice().arrayBuffer()`), отдавать в mp4box через `appendBuffer` с `fileStart`. После последнего куска — `flush()`.
2. `onReady(info)`: взять первую видеодорожку → `meta` → отправить на главный поток.
3. Конфиг декодера: `codec` из дорожки, `codedWidth/Height`, `description` — байты `avcC` из `stsd`. Проверить `VideoDecoder.isConfigSupported`. Не поддерживается → `error` «кодек не поддерживается».
4. Получить все сэмплы дорожки (`setExtractionOptions` + `start()`), собрать список ключевых кадров (`is_sync`) с временем `cts / timescale`.
5. `pickKeyframes(slotTimes, keyframeTimes)` в `thumbnails.ts`: для каждого слота ближайший ключевой кадр **не позже** времени слота. Дубли объединяются (один кадр на несколько слотов). Чистая функция, покрыть тестами.
6. Декодировать только выбранные ключевые кадры: `EncodedVideoChunk` (`type: 'key'`) → `decode`, в конце `flush()`.
7. В `output(frame)`: `createImageBitmap(frame, { resizeHeight: thumbHeightPx, resizeQuality: 'low' })` → **`frame.close()`** → отправить `thumb` для каждого слота этого кадра с передачей bitmap. Для второго и дальнейших слотов того же кадра — отдельный `createImageBitmap(bitmap)`, потому что переданный bitmap становится detached.
8. `releaseUsedSamples` после сбора сэмплов. `decoder.close()` при `done`, `cancel` или ошибке.

Компромисс: миниатюра — ближайший ключевой кадр, а не точный кадр слота. Это на порядок быстрее, потому что не нужно декодировать GOP целиком. Описать в README.

### 5.6 Превью и воспроизведение

- `<video>` получает `URL.createObjectURL(file)`. URL отзывается при сбросе.
- Время в стор: во время воспроизведения через `requestVideoFrameCallback` (если нет — `timeupdate`).
- Перемотка: `video.currentTime = sec` из стора с защитой от петли «стор → видео → стор».
- Ограничение отрезка: если `currentTime ≥ outSec` — пауза и `currentTime = inSec`. Play при `currentTime` вне [in, out] начинает с in.

### 5.7 Экспорт (`export.worker.ts`)

```ts
const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
const conversion = await Conversion.init({ input, output, trim: { start: inSec, end: outSec } })
if (!conversion.isValid) → error с причинами из conversion.discardedTracks
conversion.onProgress = (p) => postMessage({ type: 'progress', ... })
await conversion.execute()
blob = new Blob([output.target.buffer], { type: 'video/mp4' })
```

Отмена — `conversion.cancel()`. API сверить с mediabunny.dev перед реализацией. Главный поток делает `URL.createObjectURL(blob)` для кнопки «Скачать».

## 6. Ошибки и крайние случаи

| Случай | Поведение |
|---|---|
| Нет `VideoDecoder` или `VideoEncoder` | Экран UnsupportedBrowser |
| Не MP4 или mp4box не разобрал | «Не удалось прочитать файл, нужен MP4 (H.264)» |
| Кодек не поддерживается | «Кодек <codec> не поддерживается, нужен H.264» |
| Файл > 500 МБ | Отказ до чтения |
| Нет видеодорожки | Ошибка, как для нечитаемого файла |
| Новый файл во время загрузки или экспорта | `cancel`, закрыть ресурсы, начать заново |
| Ручки сведены вплотную | Минимальная длина 0,1 с (`clampTrim`) |
| Ширина окна изменилась | Пересчёт слотов. Новые миниатюры не запрашивать, если число слотов изменилось меньше чем на 20% — растянуть имеющиеся |

## 7. Производительность и память

- Декодирование и кодирование только в воркерах. На главном потоке нет долгих задач (> 50 мс) — проверить в Performance-панели и описать в README.
- Каждый `VideoFrame` закрыт. Число активных `ImageBitmap` = числу уникальных миниатюр. При сбросе закрыты все.
- `ImageBitmap` передаются через transferable, без копирования.
- Миниатюры не реактивны (`markRaw` или `shallowRef`).
- Canvas перерисовывается только при dirty-флаге.
- Проверка утечек: загрузить три файла подряд → в Memory-панели число `ImageBitmap` не растёт. Скриншот или короткую заметку положить в README.

## 8. Тесты

- Vitest для `lib/timeline/geometry.ts` и `lib/media/thumbnails.ts`: границы, кламп, минимальная длина, приоритет hit-test, дубли ключевых кадров, слот раньше первого ключевого кадра.
- Воркеры и Canvas юнит-тестами не покрываем. Ручной чек-лист из раздела 10 и запись в README.

## 9. Деплой

- `nuxt.config.ts`: `ssr: false`, `app.baseURL` из `NUXT_APP_BASE_URL`.
- GitHub Actions: `npm ci` → lint → typecheck → test → `nuxt generate` → GitHub Pages.
- В репо положить тестовое видео (≤ 5 МБ, H.264, своё или с открытой лицензией) и кнопку «Попробовать на примере», чтобы техлиду не искать свой MP4.

## 10. Задачи

Каждая задача: план → подтверждение → код → `lint`, `typecheck`, `test` → ручная проверка по критериям → ревью диффа и коммит человеком.

### Вечер 1 — каркас, разбор, таймлайн

**T1. Каркас проекта**
Nuxt 4, TS strict, Pinia, ESLint, Vitest, `ssr: false`, структура из CLAUDE.md, скрипты npm.
*Готово, когда:* `npm run dev` показывает пустую страницу, `lint`, `typecheck`, `test` (один пустой тест) и `generate` проходят.

**T2. Геометрия таймлайна** — разд. 5.2, 8
`geometry.ts` и тесты.
*Готово, когда:* все функции из 5.2 реализованы, тесты покрывают крайние случаи из раздела 8.

**T3. Стор, выбор файла, превью, проверка поддержки** — разд. 3, 5.1, 5.6, 6
FilePicker (кнопка и drag-and-drop), UnsupportedBrowser, VideoPreview, стор.
*Готово, когда:* MP4 играет в превью; файл > 500 МБ отклонён; без WebCodecs — экран-заглушка; «Другой файл» сбрасывает состояние и отзывает object URL.

**T4. Протокол и media.worker: метаданные** — разд. 5.4, 5.5 (п. 1–3)
`protocol.ts`, воркер с mp4box, `useMediaWorker`.
*Готово, когда:* после выбора файла в UI видны длительность, разрешение и кодек из воркера; нечитаемый файл и неподдерживаемый кодек дают понятные ошибки; устаревший `requestId` игнорируется.

**T5. Миниатюры через VideoDecoder** — разд. 5.5 (п. 4–8), 7
`pickKeyframes` с тестами, декодирование, отправка bitmap.
*Готово, когда:* для видео 1–2 минуты все миниатюры приходят за ≤ 2 с в Chrome; каждый `VideoFrame` закрыт (поставить счётчик в dev-режиме и вывести в консоль); повторная загрузка не наращивает число bitmap.

**T6. Canvas-таймлайн: отрисовка** — разд. 5.3, 7
`renderer.ts`, `useTimelineRenderer`, TimelineCanvas.
*Готово, когда:* миниатюры, затемнение, ручки, плейхед и метки отрисованы чётко на retina; при изменении ширины окна перерисовка без растяжения; в покое rAF ничего не рисует (проверить в Performance).

**Контрольная точка вечера 1:** загрузил файл → видишь таймлайн с миниатюрами. Если T5 не взлетел к концу вечера — запасной путь: миниатюры через скрытый `<video>` + `seeked` + `drawImage` в воркер-независимом composable. В README тогда честно написать, что WebCodecs-конвейер не доделан.

### Вечер 2 — взаимодействие, экспорт, упаковка

**T7. Взаимодействие с таймлайном** — разд. 2 (п. 5–6), 5.2, 5.6
Pointer events с `setPointerCapture`, hover-курсоры, перемотка, ограничение воспроизведения отрезком.
*Готово, когда:* ручки тянутся мышью и на тач-экране, не пересекаются и не сходятся ближе 0,1 с; клик по дорожке перематывает; play играет только [in, out] и останавливается на out.

**T8. Экспорт в воркере** — разд. 5.7, 6
`export.worker.ts`, `useExportWorker`, ExportPanel.
*Готово, когда:* экспорт отрезка 10 с из видео 1–2 минуты работает; файл открывается в плеере, длительность = out − in ± 0,1 с, звук на месте; прогресс идёт; отмена останавливает работу и возвращает в `ready`; UI не подвисает во время экспорта.

**T9. Пример и полировка UI**
Тестовое видео в `public/`, кнопка «Попробовать на примере», горячие клавиши (пробел — play/pause, `I` и `O` — поставить ручку на плейхед), аккуратная вёрстка, состояния загрузки.
*Готово, когда:* путь от открытия страницы до скачанного файла занимает меньше минуты без своего видео.

**T10. Деплой** — разд. 9
GitHub Actions и Pages.
*Готово, когда:* демо открывается по HTTPS-ссылке и весь сценарий работает в Chrome.

**T11. README**
Разделы: что это и ссылка на демо, гифка 10–15 с, как запустить, архитектура (схема из раздела 4), решения и компромиссы (ключевые кадры для миниатюр, два MP4-инструмента, память и `close()`, dirty-флаг), как проверял производительность и утечки, что дальше (бэкенд на Laravel: API проектов, монтажный лист в JSON-колонке, экспорт через ffmpeg в очереди; несколько разрезов; текст поверх видео; поддержка Safari и Firefox), строка «сделано с Claude Code по моей спецификации, с ревью каждого диффа».
*Готово, когда:* README читается за 2–3 минуты, все ссылки рабочие.

**T12. Финальная проверка**
Ручной чек-лист: сценарий из раздела 3; все строки таблицы из раздела 6; проверка утечек из раздела 7; CI зелёный.
*Готово, когда:* все пункты пройдены, найденные баги исправлены или записаны в README как известные ограничения.

## 11. Риски

| Риск | Что делаем |
|---|---|
| API mp4box 2.x отличается от старых примеров | Сверять с README пакета, типы из пакета |
| Mediabunny при trim перекодирует видео медленно | Для демо хватает. Время экспорта указать в README. Режим copy — в «что дальше» |
| Не успели T8 | Отправлять без экспорта нельзя: перенести T9 в «что дальше», но экспорт доделать |
| Не успели T9–T11 | Минимум для отправки: демо + README из трёх абзацев |
