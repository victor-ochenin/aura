import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap,
} from "@codemirror/view";

import { StateEffect, StateField } from "@codemirror/state";

import { fetcher } from "./fetcher";

// StateEffect: способ отправки "сообщений" для обновления состояния.
// Мы определяем один тип эффекта для настройки текста предложения.
const setSuggestionEffect = StateEffect.define<string | null>();

// StateField: Сохраняет наше предполагаемое состояние в редакторе.
// - create(): Возвращает начальное значение при загрузке редактора
// - update(): Вызывается при каждой транзакции (нажатии клавиши и т.д.) Для потенциального обновления значения
const suggestionState = StateField.define<string | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    // Проверяем каждый эффект в этой транзакции
    // Если мы находим наш setSuggestionEffect, возвращаем его новое значение
    // В противном случае сохраняем текущее значение без изменений
    for (const effect of transaction.effects) {
      if (effect.is(setSuggestionEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

// WidgetType: создает пользовательские элементы DOM для отображения в редакторе.
// toDOM() вызывается CodeMirror для создания фактического HTML-элемента.
class SuggestionWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.text;
    span.style.opacity = "0.4"; // Появление призрачного текста
    span.style.pointerEvents = "none"; // Не мешаем щелчкам
    return span;
  }
}

let debounceTimer: number | null = null;
let isWaitingForSuggestion = false;
const DEBOUNCE_DELAY = 300;
let currentAbortController: AbortController | null = null;

const generatePayload = (view: EditorView, fileName: string) => {
  const code = view.state.doc.toString();
  if (!code || code.trim().length === 0) return null;

  const cursorPosition = view.state.selection.main.head;
  const currentLine = view.state.doc.lineAt(cursorPosition);
  const cursorInLine = cursorPosition - currentLine.from;

  const previousLines: string[] = [];
  const previousLinesToFetch = Math.min(5, currentLine.number - 1);
  for (let i = previousLinesToFetch; i >= 1; i--) {
    previousLines.push(view.state.doc.line(currentLine.number - i).text);
  }

  const nextLines: string[] = [];
  const totalLines = view.state.doc.lines;
  const linesToFetch = Math.min(5, totalLines - currentLine.number);
  for (let i = 1; i <= linesToFetch; i++) {
    nextLines.push(view.state.doc.line(currentLine.number + i).text);
  }

  return {
    fileName,
    code,
    currentLine: currentLine.text,
    previousLines: previousLines.join("\n"),
    textBeforeCursor: currentLine.text.slice(0, cursorInLine),
    textAfterCursor: currentLine.text.slice(cursorInLine),
    nextLines: nextLines.join("\n"),
    lineNumber: currentLine.number,
  }
}

const createDebouncePlugin = (fileName: string) => {
    return ViewPlugin.fromClass(
        class {
            constructor(view: EditorView) {
                this.triggerSuggestion(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.selectionSet) {
                this.triggerSuggestion(update.view);
                }
            }

            triggerSuggestion(view: EditorView) {
                if (debounceTimer !== null) {
                clearTimeout(debounceTimer);
                }

                isWaitingForSuggestion = true;

                debounceTimer = window.setTimeout(async () => {
                    const payload = generatePayload(view, fileName);
                    if (!payload) {
                        isWaitingForSuggestion = false;
                        view.dispatch({ effects: setSuggestionEffect.of(null) });
                        return;
                    }
                    currentAbortController = new AbortController();
                    const suggestion = await fetcher(
                        payload,
                        currentAbortController.signal
                    );

                    isWaitingForSuggestion = false;

                    view.dispatch({
                        effects: setSuggestionEffect.of(
                            suggestion
                        )
                    });
                }, DEBOUNCE_DELAY)
            }

            destroy() {
                if (debounceTimer !== null) {
                clearTimeout(debounceTimer);
                }
           }
        }
    )
}

const renderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      // Перестроить оформление, если документ изменен, курсор перемещен или предложение изменено
      const suggestionChanged = update.transactions.some((transaction) => {
        return transaction.effects.some((effect) => {
          return effect.is(setSuggestionEffect);
        });
      });

      // Перестроить оформление, если документ изменен, курсор перемещен или предложение изменено
      const shouldRebuild =
        update.docChanged || update.selectionSet || suggestionChanged;

      if (shouldRebuild) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView) {
      if (isWaitingForSuggestion) {
        return Decoration.none;
      }

      // Получить текущее предложение от состояния
      const suggestion = view.state.field(suggestionState);
      if (!suggestion) {
        return Decoration.none;
      }

      // Создайте оформление виджета в положении курсора
      const cursor = view.state.selection.main.head;
      return Decoration.set([
        Decoration.widget({
          widget: new SuggestionWidget(suggestion),
          side: 1, // Рендеринг после курсора (сторона: 1), а не до (сторона: -1)
        }).range(cursor),
      ]);
    }
  },
  { decorations: (plugin) => plugin.decorations } // Говорим CodeMirror, чтобы он использовал наши декорации
);

const acceptSuggestionKeymap = keymap.of([
  {
    key: "Tab",
    run: (view) => {
      const suggestion = view.state.field(suggestionState);
      if (!suggestion) {
        return false; // Никаких предложений? Пусть табуляция работает как обычно (отступ)
      }

      const cursor = view.state.selection.main.head;
      view.dispatch({
        changes: { from: cursor, insert: suggestion }, // Вставьте текст предложения
        selection: { anchor: cursor + suggestion.length }, // Переместить курсор до конца
        effects: setSuggestionEffect.of(null), // Чистим предложение
      });
      return true; // Мы разобрались с табуляцией, не делаем отступов
    },
  },
]);

export const suggestion = (fileName: string) => [
    suggestionState, // Наше хранилище состояний
    createDebouncePlugin(fileName), // Запускает предложения по вводу текста
    renderPlugin, // Отображает призрачный текст
    acceptSuggestionKeymap, // Вкладка для принятия
];