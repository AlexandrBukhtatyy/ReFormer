# form.intent.json — grammar

You write only this file; form_build compiles it and writes the module. The form is done when form_build answers ✓. Compact JSON, one record per line. Large form: fields + layoutRoot, then validation, then behavior, form_build after each.

{"formName":"<from the task>","interfaceName":"<TypeName>","target":"renderer-react","fields":[…],"arrays":[…],"layoutRoot":{…},"validation":[…],"behavior":[…],"visibility":[…],"dataSources":[…]}

Samples show syntax only: fields come from the task, texts keep its language.
target — the task's stack, keep it: core | renderer-react | renderer-json. On core you write the markup in index.tsx (<FormField control={bundle.form.price} /> from @reformer/ui-kit), then build again; visibility and node rules go to that JSX too. An unknown key is an error naming the nearest one.

## fields
{"name":"price","type":"number","component":"InputNumber","label":"Price","initialValue":null,"componentProps":{"placeholder":"Enter the price","min":1}}
- Group field: "address.city". type: string | number | boolean | date | array (files).
- component: Calendar Checkbox Combobox ComboboxMulti ComboboxTree ComboboxTreeMulti DatePicker DatePickerMulti DatePickerRange FileUpload FileUploadAvatar FileUploadDropzone FileUploadInput Input InputMask InputNumber InputOTP InputPassword InputSuggest NativeSelect NativeSelectMulti RadioGroup Select SelectMulti Slider Switch Textarea Toggle ToggleGroup ToggleGroupMulti.
- Choices: "optionsSource":"LOAN_TYPES" + a dataSources record, or componentProps.options:[{"value":"a","label":"A"}]; free-input hints: "suggestionsSource".
- Date string: "type":"date", Input, componentProps {"type":"date"}; DatePicker holds a Date. Mask: InputMask, componentProps {"mask":"+7 (999) 999-99-99"}.

## layoutRoot — every field and array stands in it
{"kind":"container","component":"Box","children":["loanType","price",{"kind":"container","component":"Section","selector":"mortgage-section","componentProps":{"title":"Mortgage"},"children":["propertyValue"]}]}
- A string child is a field ref; an array: {"kind":"array","ref":"contacts"}; selector names a node.

## validation — one row per rule, its text in message
{"target":"price","rules":["required({ code: 'price.required' })"],"message":"Enter the price"}
- rules — @reformer/core/validators: required; text and lists: email maxLength(50) minLength(2) pattern(/^[a-zA-Zа-яА-Я]+$/) phone url; numbers: integer isNumber max(100) min(18) multipleOf(0.5) nonNegative nonZero; dates: futureDate isDate maxAge(100) maxDate(new Date()) minAge(18) minDate(new Date()) pastDate; files: fileType('image/*,.pdf') maxFiles(3) maxFileSize(5 * 1024 * 1024) maxTotalFileSize(20 * 1024 * 1024) minFiles(2) minFileSize(1); last argument { code: '…' }.
- message covers every check of the row; a check with its own text needs its own row.
- Condition: "when":"model.loanType === 'mortgage'" in the row.

## behavior — kind: core operator, expr: TypeScript, sources: fields read
{"kind":"compute","target":"total","sources":["price","quantity"],"expr":"(model.price ?? 0) * (model.quantity ?? 0)"}
{"kind":"enableWhen","target":"propertyValue","sources":["loanType"],"expr":"model.loanType === 'mortgage'","options":{"resetOnDisable":true}} — disableWhen: inverse, also for a group.
{"kind":"copyFrom","target":"residenceAddress.city","sources":["registrationAddress.city"],"expr":"model.sameAddress === true"} — expr: when to copy.
{"kind":"onChange","target":"hasContacts","expr":"if (!value) model.contacts.clear();"} — value: new value.
target, sources: leaf fields and arrays; compute must handle null (an empty number).

## visibility, dataSources
{"selector":"mortgage-section","condition":"model.loanType !== 'mortgage'"} — the node is HIDDEN while true.
{"name":"LOAN_TYPES","values":[{"value":"consumer","label":"Consumer"}]}

## More: form_build {"grammar":"<section>"}
behavior (more operators), arrays (rows), wizard (steps), cross (across fields), async, parts (sub-forms), operators (own code), nodes (submit, mount), all.

## behavior — other model operators
{"kind":"computeFrom","target":"vat","sources":["total"],"expr":"Math.round(total * 0.2)"} — expr parameters: sources by their last segment.
{"kind":"disableWhen","target":"residenceAddress","sources":["sameAddress"],"expr":"model.sameAddress === true"} — a whole group.
{"kind":"transformValue","target":"postalCode","expr":"(value ?? '').replace(/\\D/g, '').slice(0, 6)"}
{"kind":"syncFields","target":"login","sources":["email"]} — both ways.
{"kind":"resetWhen","target":"smsCode","sources":["phone"],"expr":"!model.phone","options":{"resetValue":""}} — without resetValue: null.
{"kind":"revalidateWhen","target":"confirm","sources":["password"],"expr":"form.confirm.markAsTouched()"} — expr runs when sources change.
- compute and computeFrom recompute only while "when":"<condition>" holds; a compute target is read-only. A form node (errors, touched): form.<field>.

## arrays — repeating rows
{"name":"contacts","itemInterfaceName":"Contact","initialValue":[],"componentProps":{"title":"Contacts","addButtonLabel":"+ Add","itemLabel":"Contact"},"itemFields":[{"name":"phone","type":"string","component":"Input","label":"Phone","initialValue":""},{"name":"income","type":"number","component":"InputNumber","label":"Income","initialValue":0}]}
- In layoutRoot: {"kind":"array","ref":"contacts"}. Row rule: {"target":"phone","each":"contacts","rules":["required({ code: 'contact.phone.required' })"],"message":"Enter the phone"}
- Row behavior: "each":"contacts", the row in expr is item. {"kind":"exclusiveFlag","target":"primary","each":"contacts"} — true in one row only.
{"kind":"aggregateInto","target":"contacts","expr":"rows.some((row) => row.primary) ? [] : [{ index: 0, patch: { primary: true } }]"} — answer [{ index, patch }].
- A model array is NOT a plain array: length, at(i), map(fn), forEach(fn), toArray(), push(), removeAt(i), clear(); reduce or filter only after map(...) or toArray(). Sum:
{"kind":"compute","target":"income","sources":["contacts","contacts.income"],"expr":"model.contacts.map((row) => row.income).reduce((sum, income) => sum + (income || 0), 0)"}

## wizard — steps
{"kind":"container","component":"FormWizard","selector":"wizard","componentProps":{"submitLabel":"Send"},"children":[{"kind":"step","title":"Loan","selector":"loan","children":["loanType","price"]},{"kind":"step","title":"Applicant","selector":"person","children":["password",{"kind":"array","ref":"contacts"}]}]}
- Every child of FormWizard is a step; a step holds fields, arrays, containers; "icon":"💰".
- The step selector keys the step's validation (default step<N>). Shorthand: "steps":[{"title":"Loan","fields":["loanType","price"]}] instead of layoutRoot.
- Submit: section nodes. On core write the steps in index.tsx (find_recipe wizard).

## cross — across fields, the expression is TRUE when valid
{"target":"confirm","cross":"values.confirm === values.password","code":"mismatch","message":"Passwords do not match"}
- In a row: "each":"contacts", values is the row. "severity":"warning" does not block submit; "params":{"max":"values.income * 10"} fills {max} in message.

## async — null when valid, else { code }
{"target":"smsCode","async":"async (value) => (value === '1' ? null : { code: 'bad' })","code":"bad","message":"Wrong code"}

## parts — one sub-form layout for several groups
"parts":{"address":{"kind":"container","component":"Box","children":["city"]}}, node {"kind":"part","ref":"registrationAddress","part":"address"}; refs in a part are relative to the group.

## operators — own code: name → module
{"postalCodeRu":"./operators","phoneOrEmail":"./operators","roundTo":"./operators","saveDraft":"./operators","submitApplication":"./api"}
- Own rule: "rules":["postalCodeRu({ code: 'postalCode.format' })"] — returns Rule<T> (@reformer/core/validation).
- Own validation operator instead of rules, printed as is: "call":"phoneOrEmail(model.$.phone, model.$.email)"; with each, model is the row.
- Own behavior operator: {"kind":"call","target":"price","expr":"roundTo(model.$.price, 100)"} — on @reformer/core/behaviors or effect + onDispose.
- "./operators" → operators.ts, "./api" → api.ts get a stub; write the bodies (Edit): then the file is yours, type-checked but not rewritten. A project module ("@/shared/x") is imported as is.
- revalidateWhen with your schema: void validateModel(model, schema), the schema in operators.

## nodes — node events by selector, expr has schema; not printed on core
{"kind":"onComponentEvent","selector":"wizard","event":"onSubmit","expr":"await submitApplication(model.get())"} — args: the event arguments; this wires submit.
{"kind":"renderEffect","expr":"schema.node('mortgage-section').getRef<HTMLElement>().current?.focus();"} — the node ref: getRef().
{"kind":"onMount","selector":"wizard","expr":"const t = setInterval(() => saveDraft(model.get()), 30000); return () => clearInterval(t);"} — may return a cleanup. Same shape: "kind":"onInit" (before the first render), "kind":"onUnmount".
