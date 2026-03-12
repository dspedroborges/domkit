# domkit

A small browser utility library for reactive signals, DOM manipulation, templating, and fetch pipelines. No build step, no dependencies, no framework.

```html
<script src="domkit.js"></script>
<script>
  const { signal, effect, on, swap } = domkit
</script>
```

---

## Table of contents

- [Signals](#signals)
- [DOM selection](#dom-selection)
- [Events](#events)
- [Class manipulation](#class-manipulation)
- [DOM mutation](#dom-mutation)
- [Navigation](#navigation)

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

## Navigation

### `redirect(url, newTab?)`

```js
redirect("/dashboard")            // same tab
redirect("https://example.com", true)  // new tab
```

---

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
| `redirect(url, newTab?)` | Navigate or open tab |