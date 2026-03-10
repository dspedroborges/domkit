(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    global.domkit = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  function signal(initialValue) {
    let value = initialValue;
    const subscribers = new Set();

    return {
      get() {
        return value;
      },
      set(newValue) {
        if (newValue !== value) {
          const prev = value;
          value = newValue;
          subscribers.forEach((fn) => fn(value, prev));
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

    const update = () => {
      s.set(fn());
    };

    deps.forEach(d => d.subscribe(update));

    return {
      get: s.get,
      subscribe: s.subscribe
    };
  }

  function effect(fn, deps) {
    const run = () => fn()
    deps.forEach(d => d.subscribe(run))
    run()
  }

  function once(signal, fn) {
    const unsub = signal.subscribe((v, p) => {
      fn(v, p)
      unsub()
    })
  }

  let batching = false
  const queue = new Set()

  function batch(fn) {
    batching = true
    fn()
    batching = false
    queue.forEach(fn => fn())
    queue.clear()
  }

  function combine(signals, fn) {
    const s = signal(fn(...signals.map(sig => sig.get())))

    const update = () => {
      s.set(fn(...signals.map(sig => sig.get())))
    }

    signals.forEach(sig => sig.subscribe(update))

    return {
      get: s.get,
      subscribe: s.subscribe
    }
  }

  function select(selector, context) {
    const root = context instanceof Element ? context : document;
    return root.querySelector(selector);
  }

  function selectAll(selector, context) {
    const root = context instanceof Element ? context : document;
    return Array.from(root.querySelectorAll(selector));
  }

  function on(target, event, handler, options) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el.addEventListener(event, handler, options);
    return () => el.removeEventListener(event, handler, options);
  }

  function off(target, event, handler, options) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el.removeEventListener(event, handler, options);
  }

  function addClass(target, ...classes) {
    const els = typeof target === "string" ? document.querySelectorAll(target) : [target];
    els.forEach((el) => el.classList.add(...classes));
  }

  function removeClass(target, ...classes) {
    const els = typeof target === "string" ? document.querySelectorAll(target) : [target];
    els.forEach((el) => el.classList.remove(...classes));
  }

  function toggleClass(target, className, force) {
    const els = typeof target === "string" ? document.querySelectorAll(target) : [target];
    els.forEach((el) => el.classList.toggle(className, force));
  }

  function remove(target) {
    const els = typeof target === "string" ? document.querySelectorAll(target) : [target];
    els.forEach((el) => el.remove());
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

  function render(tpl, data) {
    var resolve = function(obj, path) {
      return path
        .replace(/\[(\w+)\]/g, ".$1")
        .split(".")
        .reduce(function(acc, key) {
          if (acc == null || typeof acc !== "object") return "";
          return acc[key];
        }, obj);
    };

    var parse = function(template, obj) {
      return template.replace(/\{\{([^}]+)\}\}/g, function(_, expr) {
        var value = resolve(obj, expr.trim());
        return value == null || typeof value === "object" ? "" : value;
      });
    };

    if (Array.isArray(data)) return data.map(function(item) { return parse(tpl, item); }).join("");
    if (typeof data === "object" && data !== null) return parse(tpl, data);
    return tpl;
  }

  function redirect(url, newTab) {
    if (newTab) {
      window.open(url, "_blank");
    } else {
      window.location.href = url;
    }
  }

  return {
    signal,
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
    render,
    redirect,
  };
});