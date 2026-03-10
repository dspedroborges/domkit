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
    deps.forEach(d => d.subscribe(() => s.set(fn())));
    return { get: s.get, subscribe: s.subscribe };
  }

  function effect(fn, deps) {
    deps.forEach(d => d.subscribe(fn));
    fn();
  }

  function once(signal, fn) {
    const unsub = signal.subscribe((v, p) => {
      fn(v, p);
      unsub();
    });
  }

  function batch(fn) {
    let batching = true;
    const queue = new Set();
    fn();
    batching = false;
    queue.forEach(fn => fn());
    queue.clear();
  }

  function combine(signals, fn) {
    const s = signal(fn(...signals.map(sig => sig.get())));
    signals.forEach(sig => sig.subscribe(() => s.set(fn(...signals.map(sig => sig.get())))));
    return { get: s.get, subscribe: s.subscribe };
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
    const resolve = (obj, path) =>
      path
        .replace(/\[(\w+)\]/g, ".$1")
        .split(".")
        .reduce((acc, key) => {
          if (acc == null || typeof acc !== "object") return "";
          return acc[key];
        }, obj);

    const parse = (template, obj) =>
      template.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
        const value = resolve(obj, expr.trim());
        return value == null || typeof value === "object" ? "" : value;
      });

    if (Array.isArray(data)) return data.map(item => parse(tpl, item)).join("");
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

  function action(selector, config = {}) {
    const {
      on: event = "submit",
      url,
      method = "POST",
      targets = [],
      templates = [],
      keys = [],
      loading = "",
      cache = 0,
      auth = null,
      // "input" (default) — find <input name="var"> in the form/DOM
      // "query"           — read from current URL search params
      varSource = "input",
      refetchInterval = 0,
      onSuccess = () => {},
      onError = () => {},
    } = config;

    const el = select(selector);
    if (!el) return;

    const hasRender = targets.length && templates.length;
    const loadingEl = loading ? select(loading) : null;

    const resolvePath = (obj, path) => {
      if (!path) return obj;
      return path
        .replace(/\[(\w+)\]/g, ".$1")
        .split(".")
        .reduce((acc, key) => acc?.[key], obj);
    };

    const applyRender = (data) => {
      if (!hasRender) return;
      targets.forEach((target, i) => {
        const template = templates[i];
        if (!template) return;
        const content = resolvePath(data, keys[i]);
        swap(target, render(template, content));
      });
    };

    const getToken = () => {
      if (!auth) return null;
      try { return eval(auth); } catch { return auth; }
    };

    const resolveVars = (rawUrl, formData) => {
      const urlParams = new URLSearchParams(window.location.search);
      const bodyData = { ...formData };
      let finalUrl = rawUrl;

      const placeholders = [...rawUrl.matchAll(/:(\w+)/g)].map(m => m[1]);
      for (const key of placeholders) {
        const value = varSource === "query"
          ? urlParams.get(key)
          : (formData[key] ?? select(`[name="${key}"]`)?.value);

        if (value != null) {
          finalUrl = finalUrl.replace(":" + key, encodeURIComponent(value));
          delete bodyData[key];
        }
      }
      return { finalUrl, bodyData };
    };

    const execute = async () => {
      if (loadingEl) loadingEl.style.display = "";

      try {
        const formData = {};
        if (el.tagName === "FORM") {
          new FormData(el).forEach((v, k) => { formData[k] = v; });
        } else {
          formData[el.name || "value"] = el.value;
        }

        const { finalUrl, bodyData } = resolveVars(url, formData);
        const isGet = method.toUpperCase() === "GET";

        let fetchUrl = finalUrl;
        if (isGet) {
          const params = new URLSearchParams(bodyData).toString();
          if (params) fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + params;
        }

        const cacheKey = "actionCache:" + fetchUrl;
        if (cache) {
          try {
            const stored = localStorage.getItem(cacheKey);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Date.now() < parsed.expire) {
                applyRender(parsed.data);
                if (loadingEl) loadingEl.style.display = "none";
                onSuccess(parsed.data);
                return;
              }
              localStorage.removeItem(cacheKey);
            }
          } catch {}
        }

        const headers = {};
        if (!isGet) headers["Content-Type"] = "application/json";
        const token = getToken();
        if (token) headers["Authorization"] = "Bearer " + token;

        const res = await fetch(fetchUrl, {
          method: method.toUpperCase(),
          headers,
          body: !isGet ? JSON.stringify(bodyData) : null,
        });

        if (!res.ok) throw new Error("Status: " + res.status);
        const result = await res.json();

        if (cache) {
          localStorage.setItem(cacheKey, JSON.stringify({
            expire: Date.now() + cache,
            data: result,
          }));
        }

        applyRender(result);
        if (loadingEl) loadingEl.style.display = "none";
        onSuccess(result);
      } catch (err) {
        if (loadingEl) loadingEl.style.display = "none";
        onError(err);
      }
    };

    on(el, event, (e) => {
      if (event === "submit") e.preventDefault();
      execute();
    });

    if (refetchInterval > 0) setInterval(execute, refetchInterval);
  }

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
    render,
    redirect,
    action,
  };
});