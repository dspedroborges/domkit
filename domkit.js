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

  // Global batch state — signals check this before notifying subscribers
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
            // defer all notifications until batch() flushes
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

  // batch() — runs fn(), holds all signal notifications, flushes at the end.
  // Without batch(), setting 3 signals triggers 3 separate re-renders.
  // With batch(), all 3 fire after fn() returns — one re-render.
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
  // TEMPLATING
  // ─────────────────────────────────────────────────────────────────

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
  // ACTION
  // Fetch pipeline: trigger → fetch → render targets
  // URL :placeholders are resolved from the current page's query string.
  // ─────────────────────────────────────────────────────────────────

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

    // Replace :param placeholders using the page's current query string.
    // e.g. url: "/users/:id/posts" + ?id=42 → "/users/42/posts"
    const resolveVars = (rawUrl) => {
      const urlParams = new URLSearchParams(window.location.search);
      return rawUrl.replace(/:(\w+)/g, (match, key) => {
        const value = urlParams.get(key);
        return value != null ? encodeURIComponent(value) : match;
      });
    };

    const execute = async () => {
      if (loadingEl) loadingEl.style.display = "";

      try {
        const formData = {};
        if (el.tagName === "FORM") {
          new FormData(el).forEach((v, k) => { formData[k] = v; });
        } else if (el.name) {
          formData[el.name] = el.value;
        }

        const finalUrl = resolveVars(url);
        const isGet = method.toUpperCase() === "GET";

        let fetchUrl = finalUrl;
        if (isGet) {
          const params = new URLSearchParams(formData).toString();
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
          body: !isGet ? JSON.stringify(formData) : null,
        });

        if (!res.ok) throw new Error("Status: " + res.status);

        const result = await res.json();

        if (cache) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              expire: Date.now() + cache,
              data: result,
            }));
          } catch {}
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

  // ─────────────────────────────────────────────────────────────────
  // DECLARATIVE ACTIONS
  // Elements with action-url attributes are auto-wired on load.
  // Multi-value attributes (targets, templates, keys) are
  // comma-separated: action-targets="#a, #b"
  // ─────────────────────────────────────────────────────────────────

  // Track which elements have already been wired to avoid double-binding
  const wired = new WeakSet();

  function parseList(str) {
    if (!str) return [];
    return str.split(",").map(s => s.trim()).filter(Boolean);
  }

  function wireElement(el) {
    if (wired.has(el)) return;
    if (!el.hasAttribute("action-url")) return;
    wired.add(el);

    const targets   = parseList(el.getAttribute("action-targets"));
    const templates = parseList(el.getAttribute("action-templates"));
    const keys      = parseList(el.getAttribute("action-keys"));

    const successExpr = el.getAttribute("action-success");
    const errorExpr   = el.getAttribute("action-error");

    action(el, {
      url:             el.getAttribute("action-url"),
      method:          el.getAttribute("action-method")  || "POST",
      on:              el.getAttribute("action-on")      || "submit",
      loading:         el.getAttribute("action-loading") || "",
      cache:           Number(el.getAttribute("action-cache"))  || 0,
      auth:            el.getAttribute("action-auth")    || null,
      refetchInterval: Number(el.getAttribute("action-refetch")) || 0,
      targets,
      templates,
      keys,
      onSuccess: successExpr
        ? (data) => { try { eval(successExpr); } catch(e) { console.error("action-success:", e); } }
        : () => {},
      onError: errorExpr
        ? (err)  => { try { eval(errorExpr);   } catch(e) { console.error("action-error:", e);   } }
        : () => {},
    });
  }

  function initActions(root) {
    const ctx = root instanceof Element ? root : document;
    ctx.querySelectorAll("[action-url]").forEach(wireElement);
  }

  // Auto-init on DOMContentLoaded (or immediately if DOM is already ready)
  if (typeof window !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => initActions());
    } else {
      initActions();
    }

    // Watch for elements added dynamically after page load
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          // wire the node itself if it has action-url
          wireElement(node);
          // wire any descendants
          node.querySelectorAll("[action-url]").forEach(wireElement);
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────

  return {
    // reactivity
    signal,
    computed,
    effect,
    once,
    batch,
    combine,
    // DOM
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
    // templating
    render,
    // navigation
    redirect,
    // fetch
    action,
    initActions,
  };
});