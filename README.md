# domkit

A tiny, zero-dependency DOM utility library. Works in the browser as a global or as a CommonJS module.

---

## Installation

Just drop `domkit.js` into your project and include it with a script tag.

```html
<script src="domkit.js"></script>
```

Or use it as a CommonJS module:

```js
const domkit = require('./domkit');
```

---

## API

### `signal(initialValue)`

Creates a reactive value. When `.set()` is called with a new value, all subscribers are notified.

```js
const count = signal(0);

count.subscribe(function(newValue, prevValue) {
  console.log('changed from', prevValue, 'to', newValue);
});

count.set(1);   // logs: changed from 0 to 1
count.get();    // 1
```

`.subscribe()` returns an unsubscribe function:

```js
const unsub = count.subscribe(fn);
unsub(); // stops listening
```

---

### `select(selector, context?)`

Returns the first matching element. Optionally scoped to a context element.

```js
const btn = select('#submit');
const input = select('input', myForm);
```

---

### `selectAll(selector, context?)`

Returns an array of all matching elements.

```js
const items = selectAll('.item');
items.forEach(el => console.log(el.textContent));
```

---

### `on(target, event, handler, options?)`

Adds an event listener. Accepts a selector string or an Element. Returns a cleanup function.

```js
const off = on('#btn', 'click', function() {
  console.log('clicked');
});

off(); // remove the listener
```

One-time listener pattern:

```js
var off = on('#btn', 'click', function() {
  console.log('only fires once');
  off();
});
```

---

### `off(target, event, handler, options?)`

Removes an event listener. The handler reference must be the same one passed to `on`.

```js
function handleClick() {
  console.log('clicked');
}

on('#btn', 'click', handleClick);
off('#btn', 'click', handleClick); // removed
```

---

### `addClass(target, ...classes)`

Adds one or more classes. Accepts a selector string or Element.

```js
addClass('#box', 'active');
addClass('#box', 'active', 'visible');
```

---

### `removeClass(target, ...classes)`

Removes one or more classes.

```js
removeClass('#box', 'active');
```

---

### `toggleClass(target, className, force?)`

Toggles a class. Pass `true` or `false` as the third argument to force it on or off.

```js
toggleClass('#box', 'active');
toggleClass('#box', 'active', true);   // always add
toggleClass('#box', 'active', false);  // always remove
```

---

### `append(target, html)`

Inserts HTML at the end of an element's content.

```js
append('#list', '<li>Last item</li>');
```

---

### `prepend(target, html)`

Inserts HTML at the beginning of an element's content.

```js
prepend('#list', '<li>First item</li>');
```

---

### `swap(target, html)`

Replaces the entire inner content of an element.

```js
swap('#container', '<p>New content</p>');
```

---

### `remove(target)`

Removes element(s) from the DOM.

```js
remove('#old-banner');
remove(someElement);
```

---

### `render(tpl, data)`

Interpolates a template string using `{{ }}` placeholders. Supports dot and bracket notation for nested paths. If `data` is an array, renders the template for each item and returns the joined result.

```js
// single object
render('<p>{{ name }} is {{ age }}</p>', { name: 'Alice', age: 30 });
// '<p>Alice is 30</p>'

// array
render('<li>{{ title }}</li>', [
  { title: 'Home' },
  { title: 'About' },
]);
// '<li>Home</li><li>About</li>'

// nested path
render('<span>{{ user.address.city }}</span>', { user: { address: { city: 'Fortaleza' } } });
// '<span>Fortaleza</span>'

// bracket notation
render('<span>{{ items[0] }}</span>', { items: ['first', 'second'] });
// '<span>first</span>'
```

Combine with `append`, `prepend`, or `swap` to render into the DOM:

```js
var tpl = '<li>{{ name }}</li>';
var users = [{ name: 'Alice' }, { name: 'Bob' }];

swap('#user-list', render(tpl, users));
```

---

### `redirect(url, newTab?)`

Navigates to a URL. Pass `true` as the second argument to open in a new tab.

```js
redirect('/dashboard');
redirect('https://example.com', true);
```

---

## Full example

```html
<!DOCTYPE html>
<html>
<body>
  <p>Count: <span id="count">0</span></p>
  <button id="inc">+1</button>
  <button id="reset">Reset</button>

  <script src="domkit.js"></script>
  <script>
    const { signal, select, on } = domkit;

    const count = signal(0);

    count.subscribe(function(value) {
      select('#count').textContent = value;
    });

    on('#inc', 'click', function() {
      count.set(count.get() + 1);
    });

    on('#reset', 'click', function() {
      count.set(0);
    });
  </script>
</body>
</html>
```

---

## License

MIT