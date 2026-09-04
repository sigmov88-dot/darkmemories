/**
 * Headless-заглушки DOM для тестов: canvas-текстуры и HUD работают без браузера.
 * Выполняется до импортов тестовых файлов (setupFiles).
 */
type Fn = (...args: never[]) => unknown;
const noop: Fn = () => undefined;

function fakeContext(): unknown {
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
          return () => ({ addColorStop: noop });
        }
        if (prop === 'measureText') return () => ({ width: 0 });
        return noop;
      },
      set: () => true
    }
  );
}

function fakeCanvas(): unknown {
  return { width: 0, height: 0, getContext: () => fakeContext() };
}

const keyHandlers: Record<string, Array<(e: { code: string }) => void>> = {};

const g = globalThis as Record<string, unknown>;
g.document = {
  createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas() : {}),
  getElementById: () => null,
  body: {
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false }
  }
};
g.window = {
  addEventListener: (type: string, fn: (e: { code: string }) => void) => {
    (keyHandlers[type] ??= []).push(fn);
  },
  removeEventListener: noop,
  // тестовый хук: нажать клавишу
  __press: (code: string) => {
    for (const fn of keyHandlers['keydown'] ?? []) fn({ code });
  }
};
