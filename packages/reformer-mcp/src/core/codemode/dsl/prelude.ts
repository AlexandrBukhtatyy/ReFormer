/**
 * Прелюдия и эпилог конструктора форм — JavaScript, который песочница исполняет до и после скрипта
 * модели в профиле `code-guided-dsl`.
 *
 * Конструктор живёт в песочнице: функции через границу песочницы не проходят (хост получает
 * аргумент через `dump`), поэтому лямбды уходят на хост исходным текстом `{ $lambda, $scope }`, а
 * разбирает их хост деревом TypeScript (`lambda.ts`). Цепочки синхронны и только записывают правки —
 * те же объекты `{op, …}`, что принимает `form_edit`; `save()` отправляет их одним вызовом. У каждой
 * правки — `$via`, текст цепочки: ответ показывает ✓ и ✗ против неё (`host.ts`).
 *
 * Неизвестный метод не роняет скрипт: `Proxy` записывает ошибку с подсказкой («может, `.pattern`?»),
 * и цепочка идёт дальше; частые имена чужих библиотек (`.regex`, `.nonempty`) читаются как свои.
 *
 * Код прелюдии — ES5 с `Proxy` и промисами: без шаблонных строк, чтобы `${…}` и обратные слэши здесь
 * не путались с исходником TypeScript.
 *
 * @module reformer-mcp/core/codemode/dsl/prelude
 */

import { methodNames } from './methods.js';

const SOURCE = String.raw`(function () {
  var host = globalThis.reformer;
  var METHODS = __METHODS__;
  var ALIASES = {
    regex: 'pattern', regexp: 'pattern', matches: 'pattern',
    nonempty: 'required', notEmpty: 'required', isRequired: 'required',
    nullable: 'optional', notRequired: 'optional',
    len: 'length', size: 'length',
    gte: 'min', lte: 'max', minimum: 'min', maximum: 'max',
    defaultValue: 'initial', initialValue: 'initial', value: 'initial',
    choices: 'options', items: 'options', enum: 'options',
    showIf: 'showWhen', visibleWhen: 'showWhen', visibleIf: 'showWhen', hideIf: 'hideWhen',
    equals: 'sameAs', equalTo: 'sameAs', mustMatch: 'sameAs',
    computed: 'compute', formula: 'compute', calc: 'compute',
    validate: 'check', refine: 'check', asyncValidate: 'asyncCheck',
    addField: 'add', newField: 'add', getField: 'field',
    commit: 'save', apply: 'save', done: 'save',
    readOnly: 'readonly', disabledWhen: 'disableWhen', enabledWhen: 'enableWhen',
    inStep: 'toStep', moveTo: 'toStep', placeIn: 'toStep',
    columns: 'column', addColumn: 'column'
  };
  var forms = {};
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };

  function clip(text, n) { return text.length > n ? text.slice(0, n - 1) + '…' : text; }
  function shown(value) {
    if (typeof value === 'function') return clip(String(value).replace(/\s+/g, ' '), 60);
    if (value instanceof RegExp) return String(value);
    var text;
    try { text = JSON.stringify(value); } catch (e) { text = String(value); }
    return clip(text === undefined ? String(value) : text, 40);
  }
  function listed(args) { return Array.prototype.slice.call(args).map(shown).join(', '); }
  // Стрелка строкой (собранная шаблоном) — тоже лямбда: её разберёт сервер, как функцию.
  var ARROW = /^\s*(?:async\s+)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>|^\s*(?:async\s+)?function\b/;
  function lambda(value, scope) {
    if (typeof value === 'function' || (typeof value === 'string' && ARROW.test(value)))
      return { $lambda: String(value), $scope: scope };
    return value;
  }
  function regex(value) {
    return value instanceof RegExp ? '/' + value.source + '/' + value.flags : value;
  }
  function distance(a, b) {
    var row = [];
    for (var j = 0; j <= b.length; j++) row.push(j);
    for (var i = 1; i <= a.length; i++) {
      var prev = row[0];
      row[0] = i;
      for (var k = 1; k <= b.length; k++) {
        var keep = row[k];
        row[k] = Math.min(row[k] + 1, row[k - 1] + 1, prev + (a[i - 1] === b[k - 1] ? 0 : 1));
        prev = keep;
      }
    }
    return row[b.length];
  }
  function near(name, list) {
    var best = null;
    var score = 3;
    for (var i = 0; i < list.length; i++) {
      var d = distance(name.toLowerCase(), list[i].toLowerCase());
      if (d < score) { score = d; best = list[i]; }
    }
    return best;
  }

  function makeForm(dir) {
    var items = [];
    function push(chain, edit) { items.push({ chain: chain, edit: edit }); return edit; }
    function fail(chain, error) { items.push({ chain: chain, error: error }); }
    function note(chain, name, args) { chain.via += '.' + name + '(' + listed(args) + ')'; }

    function guard(target, kind, chainFor) {
      var proxy = new Proxy(target, {
        get: function (t, key) {
          if (typeof key === 'symbol' || key === 'then' || key === 'toJSON' || key === 'constructor') {
            return undefined;
          }
          if (own(t, key)) return t[key];
          if (own(ALIASES, key) && own(t, ALIASES[key])) return t[ALIASES[key]];
          return function () {
            var chain = chainFor();
            note(chain, String(key), arguments);
            var hint = near(String(key), METHODS[kind]);
            fail(chain, 'no method .' + String(key) + ' on ' + kind +
              (hint ? ' — did you mean .' + hint + '?' : '') +
              ' Methods of ' + kind + ': ' + METHODS[kind].join(', '));
            return proxy;
          };
        }
      });
      return proxy;
    }

    function makeField(chain, name, array, added) {
      var t = {};
      var proxy = guard(t, 'Field', function () { return chain; });
      var state = { group: null, rules: [], when: undefined, set: null };
      var path = array ? array + '.' + name : name;
      function props() {
        if (added) return added;
        if (!state.set) {
          state.set = array
            ? push(chain, { op: 'set_field', array: array, name: name })
            : push(chain, { op: 'set_field', name: name });
        }
        return state.set;
      }
      function rule() {
        var edit = { op: 'add_rule', field: name };
        if (array) edit.array = array;
        if (state.when !== undefined) edit.when = state.when;
        push(chain, edit);
        state.rules.push(edit);
        return edit;
      }
      function check(key, value, message) {
        var group = state.group;
        if (!group || own(group, key)) { group = rule(); state.group = group; }
        group[key] = value;
        if (message !== undefined) { group.message = message; state.group = null; }
        return proxy;
      }
      function close(message) {
        if (state.group && message !== undefined) { state.group.message = message; state.group = null; }
        return proxy;
      }
      function single(fields, message) {
        var edit = rule();
        for (var key in fields) edit[key] = fields[key];
        if (message !== undefined) edit.message = message;
        state.group = null;
        return proxy;
      }
      function behavior(kind, expr, extra) {
        var edit = { op: 'add_behavior', kind: kind, target: name };
        if (expr !== undefined) edit.expr = expr;
        if (array) edit.array = array;
        for (var key in (extra || {})) if (extra[key] !== undefined) edit[key] = extra[key];
        push(chain, edit);
        return proxy;
      }
      function prop(method, key, map) {
        t[method] = function (value) {
          note(chain, method, arguments);
          props()[key] = map ? map(value) : value;
          return proxy;
        };
      }
      prop('label', 'label');
      prop('type', 'type');
      prop('options', 'options');
      prop('mask', 'mask');
      prop('placeholder', 'placeholder');
      prop('initial', 'initialValue');
      prop('component', 'component');
      t.readonly = function () { note(chain, 'readonly', arguments); props().readonly = true; return proxy; };
      t.toStep = function (step) {
        note(chain, 'toStep', arguments);
        if (added) added.step = step;
        else push(chain, { op: 'place', name: path, step: step });
        return proxy;
      };
      t.required = function (message) { note(chain, 'required', arguments); return check('required', true, message); };
      t.optional = function () { note(chain, 'optional', arguments); return single({ required: false }); };
      t.email = function (message) { note(chain, 'email', arguments); return check('email', true, message); };
      t.min = function (n, message) { note(chain, 'min', arguments); return check('min', n, message); };
      t.max = function (n, message) { note(chain, 'max', arguments); return check('max', n, message); };
      t.minLength = function (n, message) { note(chain, 'minLength', arguments); return check('minLength', n, message); };
      t.maxLength = function (n, message) { note(chain, 'maxLength', arguments); return check('maxLength', n, message); };
      t.length = function (min, max, message) {
        note(chain, 'length', arguments);
        if (typeof max === 'string' && message === undefined) { message = max; max = undefined; }
        check('minLength', min);
        return max === undefined ? close(message) : check('maxLength', max, message);
      };
      t.pattern = function (re, message) { note(chain, 'pattern', arguments); return check('pattern', regex(re), message); };
      t.digit = function (message) { note(chain, 'digit', arguments); return check('pattern', '\\d', message); };
      t.rule = function (call, message) { note(chain, 'rule', arguments); return single({ rule: call }, message); };
      t.sameAs = function (other, message) { note(chain, 'sameAs', arguments); return single({ equals: other }, message); };
      t.check = function (test, message) { note(chain, 'check', arguments); return single({ cross: lambda(test, 'values') }, message); };
      t.warning = function (test, message) { note(chain, 'warning', arguments); return single({ cross: lambda(test, 'values'), warning: true }, message); };
      t.future = function (message) { note(chain, 'future', arguments); return single({ rule: 'futureDate()' }, message); };
      t.transform = function (fn) { note(chain, 'transform', arguments); return behavior('transformValue', lambda(fn, 'value')); };
      t.sync = function (other) {
        note(chain, 'sync', arguments);
        return behavior('syncFields', undefined, { sources: [other] });
      };
      // Флажок строки «ровно у одной»: exclusiveFlag снимает его в остальных строках, aggregateInto
      // отдаёт его первой строке, когда не отмечен ни у кого (ReFormer-f2fs.36).
      t.exclusive = function (options) {
        note(chain, 'exclusive', arguments);
        if (!array) {
          fail(chain, '.exclusive() is for a yes/no column of rows: f.array("recipients").column("primary").exclusive()');
          return proxy;
        }
        behavior('exclusiveFlag');
        if (!(options && options.first === false)) {
          push(chain, {
            op: 'add_behavior', kind: 'aggregateInto', target: array, array: array,
            expr: 'rows.length === 0 || rows.some((row) => row.' + name + ') ? [] : [{ index: 0, patch: { ' + name + ': true } }]'
          });
        }
        return proxy;
      };
      // Реакция на смену другого поля: onChange на нём, тело — «если условие, то это поле = значение».
      t.setOnChange = function (source, condition, value) {
        note(chain, 'setOnChange', arguments);
        var expr = typeof condition === 'function'
          ? { $lambda: String(condition), $scope: 'model', $assign: { field: path, value: value } }
          : 'if (' + String(condition) + ') model.' + path + ' = ' + JSON.stringify(value) + ';';
        push(chain, { op: 'add_behavior', kind: 'onChange', target: source, expr: expr });
        return proxy;
      };
      t.asyncCheck = function (test, options, message) {
        note(chain, 'asyncCheck', arguments);
        // Позиционно, как у чужих библиотек: (fn, 300, "текст") или (fn, "текст").
        var o = options !== null && typeof options === 'object' ? options : {};
        if (typeof options === 'number') o = { delay: options, message: message };
        if (typeof options === 'string') o = { message: options };
        var fields = { async: lambda(test, 'value') };
        if (o.delay !== undefined) fields.delay = o.delay;
        return single(fields, o.message);
      };
      t.when = function (condition) {
        note(chain, 'when', arguments);
        state.when = lambda(condition, 'model');
        for (var i = 0; i < state.rules.length; i++) state.rules[i].when = state.when;
        return proxy;
      };
      t.showWhen = function (condition) {
        note(chain, 'showWhen', arguments);
        push(chain, { op: 'add_visibility', field: path, showWhen: lambda(condition, 'model') });
        return proxy;
      };
      t.hideWhen = function (condition) {
        note(chain, 'hideWhen', arguments);
        push(chain, { op: 'add_visibility', field: path, hideWhen: lambda(condition, 'model') });
        return proxy;
      };
      t.enableWhen = function (condition, options) {
        note(chain, 'enableWhen', arguments);
        return behavior('enableWhen', lambda(condition, 'model'), { resetOnDisable: options && options.resetOnDisable });
      };
      t.disableWhen = function (condition, options) {
        note(chain, 'disableWhen', arguments);
        return behavior('disableWhen', lambda(condition, 'model'), { resetOnDisable: options && options.resetOnDisable });
      };
      t.resetWhen = function (condition) { note(chain, 'resetWhen', arguments); return behavior('resetWhen', lambda(condition, 'model')); };
      t.compute = function (formula) {
        note(chain, 'compute', arguments);
        return behavior('compute', lambda(formula, array ? 'item' : 'model'));
      };
      t.copyFrom = function (source, condition) {
        note(chain, 'copyFrom', arguments);
        return behavior('copyFrom', condition === undefined ? 'true' : lambda(condition, 'model'), { sources: [source] });
      };
      t.rename = function (to, label) {
        note(chain, 'rename', arguments);
        var edit = { op: 'rename_field', name: path, to: to };
        if (label !== undefined) edit.label = label;
        push(chain, edit);
        return proxy;
      };
      t.remove = function () { note(chain, 'remove', arguments); push(chain, { op: 'remove_field', name: path }); return proxy; };
      t.removeRule = function (name) {
        note(chain, 'removeRule', arguments);
        var edit = { op: 'remove_rule', field: path };
        if (name !== undefined) edit.rule = name;
        push(chain, edit);
        return proxy;
      };
      t.removeBehavior = function (kind) {
        note(chain, 'removeBehavior', arguments);
        var edit = { op: 'remove_behavior', target: path };
        if (kind !== undefined) edit.kind = kind;
        push(chain, edit);
        return proxy;
      };
      return proxy;
    }

    var self = {};
    var form = guard(self, 'Form', function () { return { via: 'f' }; });
    var at = function (start) { return { via: start }; };

    self.add = function (name, label) {
      var chain = at('f.add(' + listed(arguments) + ')');
      return makeField(chain, name, undefined, push(chain, { op: 'add_field', name: name, label: label }));
    };
    self.field = function (name) {
      return makeField(at('f.field(' + listed(arguments) + ')'), name, undefined, null);
    };
    self.array = function (name, label, rows) {
      var chain = at('f.array(' + listed(arguments) + ')');
      // Границы без подписи — тоже правка массива: f.array("items", undefined, { min: 1 }) терял их.
      if (label !== undefined || (rows && typeof rows === 'object')) {
        var edit = { op: 'add_array', name: name };
        if (label !== undefined) edit.label = label;
        var r = rows || {};
        if (r.min !== undefined) edit.minItems = r.min;
        if (r.max !== undefined) edit.maxItems = r.max;
        if (r.step !== undefined) edit.step = r.step;
        push(chain, edit);
      }
      var t = {};
      var proxy = guard(t, 'Rows', function () { return chain; });
      // Проверки самого массива: число строк.
      function rowsRule(method, key, n, message, args) {
        note(chain, method, args);
        var rule = { op: 'add_rule', field: name };
        rule[key] = n;
        if (message !== undefined) rule.message = message;
        push(chain, rule);
        return proxy;
      }
      t.min = function (n, message) { return rowsRule('min', 'minLength', n, message, arguments); };
      t.max = function (n, message) { return rowsRule('max', 'maxLength', n, message, arguments); };
      t.required = function (message) { return rowsRule('required', 'minLength', 1, message, arguments); };
      // Значения стартовых строк — после колонок: до них сверять ключи строк не с чем (ReFormer-f2fs.36).
      t.startRows = function (values) {
        note(chain, 'startRows', arguments);
        push(chain, { op: 'add_array', name: name, startRows: values });
        return proxy;
      };
      t.column = function (column, columnLabel) {
        var sub = at(chain.via + '.column(' + listed(arguments) + ')');
        var added = columnLabel === undefined
          ? null
          : push(sub, { op: 'add_item_field', array: name, name: column, label: columnLabel });
        return makeField(sub, column, name, added);
      };
      return proxy;
    };
    self.step = function (title) {
      var chain = at('f.step(' + listed(arguments) + ')');
      var t = {};
      var proxy = guard(t, 'Step', function () { return chain; });
      var added = null;
      t.fields = function () {
        note(chain, 'fields', arguments);
        var names = [];
        for (var i = 0; i < arguments.length; i++) names = names.concat(arguments[i]);
        added = push(chain, { op: 'add_step', title: title, fields: names });
        return proxy;
      };
      // Место шага: у шага этой цепочки (.fields) — ключ его правки; без .fields — шаг формы
      // переезжает (add_step с пустым списком полей).
      function placeStep(key, name, args) {
        note(chain, name, args);
        if (!added) added = push(chain, { op: 'add_step', title: title, fields: [] });
        delete added.after;
        delete added.before;
        added[key] = String(args[0]);
        return proxy;
      }
      t.after = function () { return placeStep('after', 'after', arguments); };
      t.before = function () { return placeStep('before', 'before', arguments); };
      t.rename = function (to) { note(chain, 'rename', arguments); push(chain, { op: 'rename_step', title: title, to: to }); return proxy; };
      t.remove = function () { note(chain, 'remove', arguments); push(chain, { op: 'remove_step', title: title }); return proxy; };
      return proxy;
    };
    self.title = function (text) { push(at('f.title(' + listed(arguments) + ')'), { op: 'set_form', formName: text }); return form; };
    self.submit = function (label, handler) {
      var edit = { op: 'submit', label: label };
      if (handler !== undefined) edit.handler = handler;
      push(at('f.submit(' + listed(arguments) + ')'), edit);
      return form;
    };
    self.markup = function () { push(at('f.markup()'), { op: 'markup' }); return form; };
    self.edit = function (edit) {
      var chain = at('f.edit(' + listed(arguments) + ')');
      if (!edit || typeof edit !== 'object' || Array.isArray(edit)) fail(chain, 'f.edit takes one edit object: { op: "…", … }');
      else push(chain, Object.assign({}, edit));
      return form;
    };

    function send() {
      var batch = items.splice(0, items.length);
      var edits = batch.map(function (item) {
        return item.error !== undefined
          ? { $error: item.error, $via: item.chain.via }
          : Object.assign({}, item.edit, { $via: item.chain.via });
      });
      return host.formEdit({ dir: dir, edits: edits });
    }
    function flushThen(next) {
      if (items.length === 0) return next();
      return send().then(function (saved) {
        return next().then(function (answer) { return saved + '\n\n' + answer; });
      });
    }
    self.save = function () { return send(); };
    self.status = function () { return flushThen(function () { return host.formStatus({ dir: dir }); }); };
    self.confirm = function (stage) { return flushThen(function () { return host.formStatus({ dir: dir, confirm: stage }); }); };
    self.skip = function (stage) { return flushThen(function () { return host.formStatus({ dir: dir, skip: stage }); }); };
    self.addStage = function (stage) { return flushThen(function () { return host.formStatus({ dir: dir, add: stage }); }); };
    self.build = function () { return flushThen(function () { return host.formBuild({ dir: dir }); }); };

    return { form: form, items: items, send: send };
  }

  host.form = function (args) {
    var dir = args && typeof args.dir === 'string' && args.dir ? args.dir : 'form';
    if (!own(forms, dir)) forms[dir] = makeForm(dir);
    return forms[dir].form;
  };

  globalThis.__reformer_dsl__ = {
    unsaved: function () {
      var n = 0;
      for (var dir in forms) n += forms[dir].items.length;
      return n;
    },
    saveAll: function () {
      var out = [];
      var queue = Promise.resolve();
      Object.keys(forms).forEach(function (dir) {
        queue = queue.then(function () {
          if (forms[dir].items.length === 0) return undefined;
          return forms[dir].send().then(function (text) { out.push(text); });
        });
      });
      return queue.then(function () { return out.join('\n\n'); });
    }
  };
})();`;

/** Прелюдия `execute`: глобальный `reformer.form()` поверх функций хоста. */
export const DSL_PRELUDE = SOURCE.replace(
  '__METHODS__',
  JSON.stringify({
    Form: methodNames('Form'),
    Field: methodNames('Field'),
    Rows: methodNames('Rows'),
    Step: methodNames('Step'),
  })
);

/**
 * Эпилог `execute` — функция одного аргумента: скрипт упал (`true`) или дошёл до конца. Правки,
 * записанные и не сохранённые, после чистого конца сохраняются, после ошибки — нет: половина
 * задуманного легла бы молча.
 */
export const DSL_EPILOGUE = String.raw`async function (failed) {
  var dsl = globalThis.__reformer_dsl__;
  if (!dsl) return;
  var n = dsl.unsaved();
  if (n === 0) return;
  if (failed) {
    console.log('(' + n + ' recorded change' + (n === 1 ? ' was' : 's were') +
      ' not saved: the script failed before its end — fix it and run the whole script again)');
    return;
  }
  console.log('(unsaved changes saved at the end of the script)');
  console.log(await dsl.saveAll());
}`;
