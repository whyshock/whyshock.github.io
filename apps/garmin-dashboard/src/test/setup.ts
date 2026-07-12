import '@testing-library/jest-dom';
import { webcrypto } from 'crypto';

// Polyfill Web Crypto API for jsdom test environment
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
  });
}

// In Node 26+ with jsdom, localStorage is not available by default.
// Provide a simple in-memory polyfill for tests.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store: Record<string, string> = {};
  const localStorageMock: Storage = {
    get length() {
      return Object.keys(store).length;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
}

// Mock window.matchMedia for tests (jsdom does not implement it)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
