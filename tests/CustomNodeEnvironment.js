const { TestEnvironment: NodeEnvironment } = require('jest-environment-node');

class CustomNodeEnvironment extends NodeEnvironment {
  constructor(config, context) {
    patchStorage('localStorage');
    patchStorage('sessionStorage');
    super(config, context);
  }
}

function patchStorage(name) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  if (!descriptor || descriptor.value) {
    // Already patched or missing
    return;
  }

  const store = new Map();
  const storage = {
    clear: () => store.clear(),
    getItem: key => (store.has(key) ? store.get(key) : null),
    key: index => Array.from(store.keys())[index] ?? null,
    removeItem: key => store.delete(key),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    get length() {
      return store.size;
    }
  };

  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: storage
  });
}

module.exports = CustomNodeEnvironment;
