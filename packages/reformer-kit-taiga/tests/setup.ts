// Пакеты Angular и Taiga UI в node_modules лежат в частично скомпилированном виде: без сборщика их
// объявления доводит до рабочих JIT-компилятор — он должен быть загружен первым.
import '@angular/compiler';

// Taiga UI следит за размерами и видимостью элементов: в happy-dom части этих API нет.
class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

for (const name of ['ResizeObserver', 'IntersectionObserver']) {
  if (!(name in globalThis)) Object.assign(globalThis, { [name]: ObserverStub });
}

if (!window.matchMedia) {
  Object.assign(window, {
    matchMedia: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }),
  });
}
