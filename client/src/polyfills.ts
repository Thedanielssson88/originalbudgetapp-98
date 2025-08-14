// Polyfills for Node.js globals in browser environment

// Polyfill for process
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = {
    env: import.meta.env || {},
    browser: true,
    version: '',
    platform: 'browser',
    nextTick: (callback: () => void) => Promise.resolve().then(callback),
    exit: () => {},
    cwd: () => '/',
    argv: [],
  };
}

// Polyfill for global
if (typeof window !== 'undefined' && !(window as any).global) {
  (window as any).global = window;
}

export {};