# domkit

A small browser utility library for reactive signals, DOM manipulation, templating, and fetch pipelines. No build step, no dependencies, no framework.

```html
<script src="domkit.js"></script>
<script>
  const { signal, effect, on, swap, render, action } = domkit
</script>
```

---

## Table of contents

- [Signals](#signals)
- [DOM selection](#dom-selection)
- [Events](#events)
- [Class manipulation](#class-manipulation)
- [DOM mutation](#dom-mutation)
- [Templating](#templating)
- [Navigation](#navigation)
- [Action](#action)

---

## Signals

A lightweight reactivity system. Signals hold a value and notify subscribers when it changes.

### `signal(initialValue)`

Creates a reactive value.

```js
const count = signal(0)

count.get()       // 0
count.set(1)      // notifies subscribers
count.get()       // 1
```

`set()` is chainable and only fires subscribers if the value actually changed (`!==`).

```js
count.set(2).set(3)
```

**Subscribing manually:**

```js
const unsub = count.subscribe((value) => {
  console.log("count changed to", value)
})

count.set(5)  // logs "count changed to 5"
unsub()       // stop listening
```

---

### `computed(fn, deps)`

Creates a read-only signal derived from other signals. Re-evaluates automatically when any dependency changes.

```js
const a = signal(2)
const b = signal(3)

const sum = computed(() => a.get() + b.get(), [a, b])

sum.get()  // 5
a.set(10)
sum.get()  // 13
```

`computed` returns `{ get, subscribe }` — you can read it and react to it, but not set it directly.

---

### `effect(fn, deps)`

Runs `fn` immediately and re-runs it whenever any dependency changes.

```js
const name = signal("Alice")

effect(() => {
  document.title = `Hello, ${name.get()}`
}, [name])

// title is set to "Hello, Alice" immediately
name.set("Bob")
// title updates to "Hello, Bob"
```

---

### `once(signal, fn)`

Runs `fn` the next time the signal changes, then automatically unsubscribes.

```js
const ready = signal(false)

once(ready, (value) => {
  console.log("fired once:", value)
})

ready.set(true)   // logs "fired once: true"
ready.set(false)  // nothing — already unsubscribed
```

---

### `batch(fn)`

Groups multiple signal updates into a single notification pass. Without `batch`, each `set()` fires all subscribers immediately. With `batch`, subscribers are deferred until the function completes — useful when updating several signals that drive the same render.

```js
const x = signal(0)
const y = signal(0)

effect(() => {
  console.log(x.get(), y.get())
}, [x, y])
// logs "0 0" immediately

// without batch: logs twice ("1 0", then "1 1")
x.set(1)
y.set(1)

// with batch: logs once ("2 2")
batch(() => {
  x.set(2)
  y.set(2)
})
```

---

### `combine(signals, fn)`

Creates a derived signal that maps over multiple signals at once. Similar to `computed` but takes an explicit array of source signals and a combining function.

```js
const firstName = signal("Ada")
const lastName  = signal("Lovelace")

const fullName = combine([firstName, lastName], (f, l) => `${f} ${l}`)

fullName.get()      // "Ada Lovelace"
lastName.set("Byron")
fullName.get()      // "Ada Byron"
```

---

## DOM selection

### `select(selector, context?)`

Returns the first matching element. `context` defaults to `document`.

```js
const btn    = select("#submit")
const input  = select("input[name='email']")
const nested = select(".item", someParentEl)
```

### `selectAll(selector, context?)`

Returns an array (not a NodeList) of all matching elements.

```js
const items = selectAll(".card")
items.forEach(el => el.style.opacity = "0.5")
```

---

## Events

### `on(target, event, handler, options?)`

Adds an event listener. `target` can be a DOM element or a CSS selector string. Returns an unsubscribe function.

```js
const off = on("#btn", "click", () => console.log("clicked"))

off()  // removes the listener
```

```js
on(document, "keydown", (e) => {
  if (e.key === "Escape") closeModal()
})
```

If the selector doesn't match anything, `on` returns a no-op function and does nothing — no error thrown.

---

### `off(target, event, handler, options?)`

Removes an event listener directly.

```js
const handler = () => console.log("clicked")
on("#btn", "click", handler)
off("#btn", "click", handler)
```

Prefer the unsub function returned by `on` over calling `off` manually — it's less error-prone.

---

## Class manipulation

All three functions accept either a DOM element or a CSS selector string. Selector strings match all elements on the page (like `querySelectorAll`).

### `addClass(target, ...classes)`

```js
addClass("#menu", "open", "visible")
addClass(el, "active")
```

### `removeClass(target, ...classes)`

```js
removeClass("#menu", "open")
```

### `toggleClass(target, className, force?)`

Toggles a class. Pass `true` or `false` as `force` to add or remove unconditionally.

```js
toggleClass("#menu", "open")          // toggle
toggleClass("#menu", "open", true)    // always add
toggleClass("#menu", "open", false)   // always remove
toggleClass(".item", "selected", isSelected)  // conditional
```

---

## DOM mutation

### `append(target, html)`

Inserts HTML at the end of the target element.

```js
append("#list", "<li>New item</li>")
```

### `prepend(target, html)`

Inserts HTML at the beginning of the target element.

```js
prepend("#list", "<li>First item</li>")
```

### `swap(target, html)`

Replaces the entire inner content of the target element.

```js
swap("#content", "<p>Loaded.</p>")
swap("#content", "")  // clear it
```

### `shift(target)`

Removes the first child element.

```js
shift("#list")  // removes the first <li>
```

### `pop(target)`

Removes the last child element.

```js
pop("#list")  // removes the last <li>
```

### `remove(target)`

Removes the element(s) from the DOM entirely. Accepts a selector (removes all matches) or a single element.

```js
remove("#toast")
remove(".stale-item")  // removes all matches
remove(el)
```

---

## Templating

### `render(template, data)`

Fills `{{placeholder}}` tokens in a template string with values from `data`. Supports dot-paths and bracket notation for nested access.

**Object data:**

```js
const html = render(
  "<li>{{name}} — {{role}}</li>",
  { name: "Alice", role: "Admin" }
)
// "<li>Alice — Admin</li>"
```

**Nested paths:**

```js
render("{{user.name}} ({{user.address.city}})", {
  user: { name: "Bob", address: { city: "Oslo" } }
})
// "Bob (Oslo)"
```

**Array notation:**

```js
render("{{items[0].label}}", { items: [{ label: "First" }] })
// "First"
```

**Array data — renders one copy per item, joined:**

```js
const html = render(
  "<li class='item'>{{name}}</li>",
  [
    { name: "Alice" },
    { name: "Bob" },
    { name: "Carol" },
  ]
)
// "<li class='item'>Alice</li><li class='item'>Bob</li><li class='item'>Carol</li>"
```

Missing or `null` values render as empty string. Object values render as empty string.

---

## Navigation

### `redirect(url, newTab?)`

```js
redirect("/dashboard")            // same tab
redirect("https://example.com", true)  // new tab
```

---

## Declarative actions

Any element with an `action-url` attribute is automatically wired up when the page loads — no JavaScript required. This is the same `action()` function under the hood, driven by HTML attributes instead of a config object.

```html
<form
  action-url="/api/search"
  action-method="GET"
  action-on="submit"
  action-targets="#results"
  action-templates="<li>{{title}}</li>"
  action-keys="items"
  action-loading="#spinner"
>
  <input name="q" placeholder="Search…" />
  <button>Go</button>
</form>

<div id="spinner" style="display:none">Loading…</div>
<ul id="results"></ul>
```

Import domkit and it just works — no init call needed.

### Attributes

| Attribute | Equivalent config key | Notes |
|---|---|---|
| `action-url` | `url` | Required. Triggers auto-wiring. |
| `action-method` | `method` | Default: `POST` |
| `action-on` | `on` | Default: `submit` |
| `action-targets` | `targets` | Comma-separated selectors |
| `action-templates` | `templates` | Comma-separated templates |
| `action-keys` | `keys` | Comma-separated dot-paths |
| `action-loading` | `loading` | Selector of loading element |
| `action-cache` | `cache` | Duration in ms |
| `action-auth` | `auth` | Token string or JS expression |
| `action-refetch` | `refetchInterval` | Interval in ms |
| `action-success` | `onSuccess` | JS expression, `data` is in scope |
| `action-error` | `onError` | JS expression, `err` is in scope |

### Multi-value attributes

`action-targets`, `action-templates`, and `action-keys` are comma-separated when you need multiple targets:

```html
<button
  action-url="/api/users"
  action-method="GET"
  action-on="click"
  action-targets="#count,        #list"
  action-templates="{{total}} users, <li>{{name}}</li>"
  action-keys="meta,             items"
>Load</button>
```

### Callbacks via expressions

`action-success` and `action-error` are JavaScript expressions evaluated when the request completes. `data` and `err` are in scope respectively:

```html
<form
  action-url="/api/login"
  action-success="redirect('/dashboard')"
  action-error="swap('#msg', '<p>Login failed: ' + err.message + '</p>')"
>
  <input name="email" />
  <input name="password" type="password" />
  <button>Sign in</button>
</form>
```

```html
<button
  action-url="/api/item/:id"
  action-method="DELETE"
  action-on="click"
  action-success="remove('#item-' + data.id)"
>Delete</button>
```

### Dynamic content

Elements added to the DOM after page load (e.g. via `swap()` or `append()`) are also picked up automatically — a `MutationObserver` watches for new `[action-url]` elements and wires them immediately.

```js
// This newly inserted element will be auto-wired, no extra call needed
append("#container", `
  <button
    action-url="/api/posts"
    action-method="GET"
    action-on="click"
    action-targets="#posts"
    action-templates="<li>{{title}}</li>"
    action-keys="posts"
  >Load posts</button>
`)
```

### `initActions(root?)`

Manually re-scan for unwired `[action-url]` elements. Useful after a large DOM replacement that bypasses the MutationObserver (e.g. setting `innerHTML` directly on a container). Pass a root element to limit the scan, or call with no argument to scan the whole document.

```js
swap("#app", newHtml)
initActions(select("#app"))  // wire anything new inside #app
```

Elements already wired are skipped — safe to call multiple times.

---

## Action

### `action(selector, config)`

Binds a fetch pipeline to an element. When the element triggers `event`, domkit collects data, fetches `url`, and renders the response into target elements. Designed for progressive enhancement — forms, buttons, or any element.

```js
action("#search-form", {
  on:        "submit",
  url:       "/api/search",
  method:    "GET",
  targets:   ["#results"],
  templates: ["<li>{{title}} — {{author}}</li>"],
  keys:      ["items"],
})
```

### Config options

| Option | Default | Description |
|---|---|---|
| `on` | `"submit"` | Event that triggers the fetch |
| `url` | — | Fetch URL. Supports `:param` placeholders (see below) |
| `method` | `"POST"` | HTTP method |
| `targets` | `[]` | CSS selectors of elements to update after fetch |
| `templates` | `[]` | Template string per target (uses `render()` syntax) |
| `keys` | `[]` | Dot-path into the response per target (e.g. `"data.items"`) |
| `loading` | `""` | Selector of an element to show during fetch, hide after |
| `cache` | `0` | Cache duration in ms. `0` = disabled |
| `auth` | `null` | Bearer token string or JS expression that returns one |
| `refetchInterval` | `0` | Auto re-fetch interval in ms. `0` = disabled |
| `onSuccess` | `() => {}` | Callback fired with the parsed response on success |
| `onError` | `() => {}` | Callback fired with the error on failure |

### URL placeholders

`:param` tokens in the URL are replaced with matching values from the **current page's query string**.

```
Page URL:  /reports?userId=42&month=3
Action URL: /api/users/:userId/reports/:month
Resolved:  /api/users/42/reports/3
```

```js
action("#load-btn", {
  on:     "click",
  url:    "/api/users/:userId/posts",
  method: "GET",
  targets:   ["#posts"],
  templates: ["<div>{{title}}</div>"],
  keys:      ["posts"],
})
```

Placeholders that have no matching query param are left as-is in the URL.

### Rendering targets

Each item in `targets`, `templates`, and `keys` corresponds by index. The response is first narrowed by `keys[i]` (dot-path into the JSON), then passed to `render(templates[i], narrowedData)`, then injected into `targets[i]` via `swap`.

```js
// Response: { meta: { total: 120 }, items: [{ name: "Alice" }, ...] }

action("#load", {
  url:       "/api/users",
  method:    "GET",
  targets:   ["#count",          "#list"],
  templates: ["{{total}} users", "<li>{{name}}</li>"],
  keys:      ["meta",            "items"],
})
// #count → "120 users"
// #list  → "<li>Alice</li><li>Bob</li>..."
```

### Loading state

```html
<div id="spinner" style="display:none">Loading…</div>
```

```js
action("#btn", {
  url:     "/api/data",
  loading: "#spinner",
  // spinner is shown at fetch start, hidden on success or error
})
```

### Caching

Responses are cached in `localStorage` by URL. `cache` is a duration in milliseconds.

```js
action("#btn", {
  url:    "/api/config",
  method: "GET",
  cache:  60_000,  // cache for 1 minute
})
```

### Auth

Pass a bearer token directly or as a JS expression (evaluated at request time, useful for reading from localStorage or a global variable).

```js
action("#save", {
  url:  "/api/save",
  auth: "localStorage.getItem('token')",
})

// or a literal token
action("#save", {
  url:  "/api/save",
  auth: "my-static-token",
})
```

### Auto-refresh

```js
action("#live-feed", {
  on:             "click",  // initial trigger
  url:            "/api/feed",
  method:         "GET",
  targets:        ["#feed"],
  templates:      ["<div>{{message}}</div>"],
  refetchInterval: 5000,   // then re-fetch every 5 seconds
})
```

### Callbacks

```js
action("#form", {
  url:       "/api/submit",
  onSuccess: (data) => {
    console.log("saved:", data)
    swap("#status", "<p>Saved!</p>")
  },
  onError: (err) => {
    console.error(err)
    swap("#status", "<p>Something went wrong.</p>")
  },
})
```

---

## Full example

A filtered list that reacts to a search signal and updates from the server:

```html
<input id="search" type="text" placeholder="Search…" />
<div id="spinner" style="display:none">Loading…</div>
<ul id="results"></ul>

<script src="domkit.js"></script>
<script>
  const { signal, effect, on, swap, render, action } = domkit

  const query = signal("")

  // keep signal in sync with input
  on("#search", "input", (e) => query.set(e.target.value))

  // re-run search whenever query changes
  effect(() => {
    if (!query.get()) {
      swap("#results", "")
      return
    }

    action("#search", {
      on:        "input",
      url:       "/api/search",
      method:    "GET",
      targets:   ["#results"],
      templates: ["<li>{{title}}</li>"],
      keys:      ["results"],
      loading:   "#spinner",
    })
  }, [query])
</script>
```

A real-time dashboard widget that polls every 10 seconds:

```html
<button id="start">Start feed</button>
<ul id="feed"></ul>

<script>
  action("#start", {
    on:              "click",
    url:             "/api/events",
    method:          "GET",
    targets:         ["#feed"],
    templates:       ["<li>{{timestamp}} — {{message}}</li>"],
    keys:            ["events"],
    refetchInterval: 10_000,
  })
</script>
```

---

## API reference

| Function | Description |
|---|---|
| `signal(value)` | Create a reactive value |
| `computed(fn, deps)` | Derive a read-only signal from others |
| `effect(fn, deps)` | Run a side effect when signals change |
| `once(signal, fn)` | React to the next change only |
| `batch(fn)` | Group signal updates, notify once |
| `combine(signals, fn)` | Map multiple signals into one |
| `select(sel, ctx?)` | `querySelector` wrapper → element or null |
| `selectAll(sel, ctx?)` | `querySelectorAll` wrapper → array |
| `on(target, event, handler)` | Add listener, returns unsub fn |
| `off(target, event, handler)` | Remove listener |
| `addClass(target, ...cls)` | Add classes |
| `removeClass(target, ...cls)` | Remove classes |
| `toggleClass(target, cls, force?)` | Toggle a class |
| `append(target, html)` | Insert HTML at end |
| `prepend(target, html)` | Insert HTML at start |
| `swap(target, html)` | Replace inner HTML |
| `shift(target)` | Remove first child |
| `pop(target)` | Remove last child |
| `remove(target)` | Remove element(s) from DOM |
| `render(tpl, data)` | Fill `{{placeholder}}` template |
| `redirect(url, newTab?)` | Navigate or open tab |
| `action(selector, config)` | Bind fetch pipeline to element |
| `initActions(root?)` | Re-scan DOM for unwired `[action-url]` elements |