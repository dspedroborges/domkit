# domkit

A lightweight, dependency-free DOM utility library with signals-based reactivity, templating, and data fetching — all in one small file.

- **Signals** — reactive state with subscriptions, computed values, and effects
- **DOM helpers** — selection, manipulation, classes, events
- **Templates** — `{{placeholder}}` rendering from objects or arrays
- **`action`** — declarative fetch → render pipeline with caching, auth, and polling

---

## Install

**`domkit.min.js`** — 5.1kb · 2.0kb gzipped

### Browser (UMD)

```html
<script src="domkit.min.js"></script>
<script>
  const { signal, action, render } = domkit;
</script>
```

### Node / Bundler

```js
const domkit = require("./domkit");
// or
import domkit from "./domkit.js";
```

---

## Signals & Reactivity

### `signal(initialValue)`

Creates a reactive value with get/set/subscribe.

```js
const count = domkit.signal(0);

count.get();                          // 0
count.set(5);                         // update
count.subscribe((next, prev) => {     // react to changes
  console.log(prev, "→", next);
});
```

---

### `computed(fn, deps)`

Derives a read-only signal from other signals.

```js
const count  = domkit.signal(4);
const double = domkit.computed(() => count.get() * 2, [count]);

double.get(); // 8
count.set(10);
double.get(); // 20
```

---

### `effect(fn, deps)`

Runs a side effect immediately and again whenever a dependency changes.

```js
const name = domkit.signal("Alice");

domkit.effect(() => {
  document.title = `Hello, ${name.get()}`;
}, [name]);
```

---

### `once(signal, fn)`

Fires a callback exactly once on the next change, then unsubscribes.

```js
domkit.once(count, (next, prev) => {
  console.log("changed once:", prev, "→", next);
});
```

---

### `batch(fn)`

Groups multiple signal updates so subscribers are only notified once.

```js
domkit.batch(() => {
  firstName.set("Jane");
  lastName.set("Doe");
});
// subscribers notified once, after both updates
```

---

### `combine(signals, fn)`

Creates a derived signal from multiple signals using a combiner function.

```js
const a   = domkit.signal(3);
const b   = domkit.signal(4);
const sum = domkit.combine([a, b], (x, y) => x + y);

sum.get(); // 7
```

---

## DOM

### `select(selector, context?)`
### `selectAll(selector, context?)`

Query the DOM, optionally scoped to a parent element.

```js
const el   = domkit.select(".card");
const list = domkit.selectAll("li", myList); // scoped
```

---

### `on(target, event, handler, options?)`

Adds an event listener. Returns an unsubscribe function.

```js
const off = domkit.on("#btn", "click", () => console.log("clicked"));
off(); // removes the listener
```

---

### `off(target, event, handler, options?)`

Removes an event listener directly.

```js
domkit.off("#btn", "click", myHandler);
```

---

### `addClass(target, ...classes)`
### `removeClass(target, ...classes)`
### `toggleClass(target, className, force?)`

Manipulate classes. `target` can be a selector string or an element.

```js
domkit.addClass("#el", "active", "visible");
domkit.removeClass(".card", "hidden");
domkit.toggleClass("#menu", "open");         // toggle
domkit.toggleClass("#menu", "open", true);   // force on
domkit.toggleClass("#menu", "open", false);  // force off
```

---

### `append(target, html)`
### `prepend(target, html)`
### `swap(target, html)`
### `pop(target)`
### `shift(target)`
### `remove(target)`

Insert, replace, or remove DOM content.

```js
domkit.append("#list", "<li>Last</li>");   // add to end
domkit.pop("#list");                        // remove last child
domkit.prepend("#list", "<li>First</li>"); // add to start
domkit.shift("#list");                      // remove first child
domkit.swap("#box", "<p>New content</p>");  // replaces innerHTML
domkit.remove("#old");                      // removes element
domkit.remove(".temp");                     // removes all matches
```

---

## Templates

### `render(template, data)`

Fills `{{placeholder}}` tokens in a template string from an object or array. Supports dot-notation for nested paths.

```js
const tpl = "<li>{{name}} — {{role}}</li>";

// Object
domkit.render(tpl, { name: "Alice", role: "Admin" });
// → "<li>Alice — Admin</li>"

// Array — concatenates all results
domkit.render(tpl, [
  { name: "Alice", role: "Admin" },
  { name: "Bob",   role: "Editor" },
]);
// → "<li>Alice — Admin</li><li>Bob — Editor</li>"

// Nested paths
domkit.render("<p>{{address.city}}</p>", {
  address: { city: "New York" }
});
// → "<p>New York</p>"

// Array index access
domkit.render("<p>{{tags[0]}}</p>", { tags: ["js", "dom"] });
// → "<p>js</p>"
```

---

## action

Binds a DOM element to a fetch request and automatically renders the response. Works with any event — `submit`, `click`, `change`, etc.

```js
domkit.action(selector, config)
```

### Config options

| Option | Type | Default | Description |
|---|---|---|---|
| `on` | `string` | `"submit"` | DOM event that triggers the request |
| `url` | `string` | — | Fetch URL; supports `:var` placeholders |
| `method` | `string` | `"POST"` | HTTP method |
| `targets` | `string[]` | `[]` | CSS selectors of elements to update |
| `templates` | `string[]` | `[]` | Template string per target |
| `keys` | `string[]` | `[]` | Dot-path into response per target (`""` = root) |
| `loading` | `string` | `""` | Selector of element to show/hide while pending |
| `cache` | `number` | `0` | Cache duration in ms (`0` = disabled) |
| `auth` | `string\|null` | `null` | Bearer token or JS expression evaluated at runtime |
| `varSource` | `"input"\|"query"` | `"input"` | Source for `:var` URL placeholder values |
| `refetchInterval` | `number` | `0` | Auto re-fetch every N ms (`0` = disabled) |
| `onSuccess` | `function` | `() => {}` | Called with parsed JSON response |
| `onError` | `function` | `() => {}` | Called with the caught error |

---

### Basic form POST

```html
<form id="contact-form">
  <input name="email" />
  <input name="message" />
  <button type="submit">Send</button>
</form>
<div id="result"></div>
```

```js
domkit.action("#contact-form", {
  url: "/api/contact",
  method: "POST",
  targets:   ["#result"],
  templates: ["<p>{{status}}</p>"],
  onSuccess: (data) => console.log("sent", data),
  onError:   (err)  => console.error(err),
});
```

---

### GET search with input vars

`:q` is resolved from `<input name="q">` inside the form.

```html
<form id="search">
  <input name="q" placeholder="Search…" />
  <button type="submit">Go</button>
</form>
<ul id="results"></ul>
```

```js
domkit.action("#search", {
  url: "/api/search?query=:q",
  method: "GET",
  varSource: "input",
  targets:   ["#results"],
  templates: ["<li>{{title}}</li>"],
  keys:      ["items"],   // renders response.items
});
```

---

### GET with URL query string vars

`:id` is read from `?id=42` in the current page URL.

```js
domkit.action("#load-btn", {
  on: "click",
  url: "/api/item/:id",
  method: "GET",
  varSource: "query",
  targets:   ["#detail"],
  templates: ["<h2>{{name}}</h2><p>{{description}}</p>"],
});
```

---

### Multiple targets from one response

```js
domkit.action("#dashboard-load", {
  on: "click",
  url: "/api/dashboard",
  method: "GET",
  targets:   ["#chart-list", "#summary-box"],
  templates: [
    "<li>{{label}}: {{value}}</li>",
    "<p>Total: {{total}}</p>",
  ],
  keys: ["dataPoints", ""],  // "" renders from the response root
});
```

---

### Auth, loading, caching, and polling

```js
domkit.action("#stats", {
  on: "click",
  url: "/api/stats",
  method: "GET",
  auth: "localStorage.getItem('token')",  // evaluated at request time
  loading: "#spinner",                    // hidden after fetch
  cache: 30_000,                          // reuse result for 30s
  refetchInterval: 60_000,               // re-fetch every 60s automatically
  targets:   ["#stats-list"],
  templates: ["<li>{{metric}}: {{value}}</li>"],
  keys:      ["stats"],
});
```

---

## redirect

```js
domkit.redirect("/dashboard");                    // same tab
domkit.redirect("https://example.com", true);     // new tab
```

---

## Full example

```html
<!DOCTYPE html>
<html>
<body>
  <input id="search-input" name="q" placeholder="Search…" />
  <button id="search-btn">Search</button>
  <div id="loading" style="display:none">Loading…</div>
  <ul id="results"></ul>

  <script src="domkit.js"></script>
  <script>
    const { signal, effect, action } = domkit;

    // Reactive query display
    const query = signal("");
    effect(() => {
      console.log("query:", query.get());
    }, [query]);

    domkit.on("#search-input", "input", (e) => query.set(e.target.value));

    // Fetch on button click
    action("#search-btn", {
      on: "click",
      url: "/api/search?q=:q",
      method: "GET",
      varSource: "input",
      loading: "#loading",
      targets: ["#results"],
      templates: ["<li><strong>{{title}}</strong> — {{summary}}</li>"],
      keys: ["hits"],
      onError: (err) => domkit.swap("#results", `<li>Error: ${err.message}</li>`),
    });
  </script>
</body>
</html>
```

---

## License

MIT