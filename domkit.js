(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    global.domkit = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  // ─────────────────────────────────────────────────────────────────
  // SIGNALS
  // ─────────────────────────────────────────────────────────────────

  let isBatching = false;
  const batchQueue = new Set();

  function signal(initialValue) {
    let value = initialValue;
    const subscribers = new Set();

    return {
      get() {
        return value;
      },
      set(newValue) {
        if (newValue !== value) {
          value = newValue;
          if (isBatching) {
            subscribers.forEach(fn => batchQueue.add(() => fn(value)));
          } else {
            subscribers.forEach(fn => fn(value));
          }
        }
        return this;
      },
      subscribe(fn) {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
    };
  }

  function computed(fn, deps) {
    const s = signal(fn());
    deps.forEach(d => d.subscribe(() => s.set(fn())));
    return { get: s.get.bind(s), subscribe: s.subscribe.bind(s) };
  }

  function effect(fn, deps) {
    deps.forEach(d => d.subscribe(fn));
    fn();
  }

  function once(sig, fn) {
    const unsub = sig.subscribe((v, p) => {
      fn(v, p);
      unsub();
    });
  }

  function batch(fn) {
    isBatching = true;
    try {
      fn();
    } finally {
      isBatching = false;
      batchQueue.forEach(notify => notify());
      batchQueue.clear();
    }
  }

  function combine(signals, fn) {
    const s = signal(fn(...signals.map(sig => sig.get())));
    signals.forEach(sig =>
      sig.subscribe(() => s.set(fn(...signals.map(s2 => s2.get()))))
    );
    return { get: s.get.bind(s), subscribe: s.subscribe.bind(s) };
  }

  // ─────────────────────────────────────────────────────────────────
  // DOM SELECTION
  // ─────────────────────────────────────────────────────────────────

  function select(selector, context) {
    const root = context instanceof Node ? context : document;
    return root.querySelector(selector);
  }

  function selectAll(selector, context) {
    const root = context instanceof Node ? context : document;
    return Array.from(root.querySelectorAll(selector));
  }

  // ─────────────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────────────

  function on(target, event, handler, options) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return () => {};
    el.addEventListener(event, handler, options);
    return () => el.removeEventListener(event, handler, options);
  }

  function off(target, event, handler, options) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;
    el.removeEventListener(event, handler, options);
  }

  // ─────────────────────────────────────────────────────────────────
  // CLASS MANIPULATION
  // ─────────────────────────────────────────────────────────────────

  function addClass(target, ...classes) {
    const els = typeof target === "string" ? document.querySelectorAll(target) : [target];
    els.forEach(el => el.classList.add(...classes));
  }

  function removeClass(target, ...classes) {
    const els = typeof target === "string" ? document.querySelectorAll(target) : [target];
    els.forEach(el => el.classList.remove(...classes));
  }

  function toggleClass(target, className, force) {
    const els = typeof target === "string" ? document.querySelectorAll(target) : [target];
    els.forEach(el => el.classList.toggle(className, force));
  }

  // ─────────────────────────────────────────────────────────────────
  // DOM MUTATION
  // ─────────────────────────────────────────────────────────────────

  function remove(target) {
    const els = typeof target === "string" ? document.querySelectorAll(target) : [target];
    els.forEach(el => el.remove());
  }

  function append(target, html) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el.insertAdjacentHTML("beforeend", html);
  }

  function prepend(target, html) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el.insertAdjacentHTML("afterbegin", html);
  }

  function swap(target, html) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el.innerHTML = html;
  }

  function shift(target) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el.firstElementChild?.remove();
  }

  function pop(target) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el.lastElementChild?.remove();
  }

  // ─────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────

  function redirect(url, newTab) {
    if (newTab) {
      window.open(url, "_blank");
    } else {
      window.location.href = url;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────

  return {
    signal,
    computed,
    effect,
    once,
    batch,
    combine,
    select,
    selectAll,
    on,
    off,
    addClass,
    removeClass,
    toggleClass,
    remove,
    append,
    prepend,
    swap,
    shift,
    pop,
    redirect,
  };
});