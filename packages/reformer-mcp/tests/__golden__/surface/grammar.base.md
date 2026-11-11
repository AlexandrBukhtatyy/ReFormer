# form.intent.json — grammar

You write only this file; form_build compiles it and writes the module. The form is done when form_build answers ✓. Compact JSON, one record per line. Large form: fields + layoutRoot, then validation, then behavior, form_build after each.

{"formName":"<from the task>","interfaceName":"<TypeName>","target":"renderer-react","fields":[…],"arrays":[…],"layoutRoot":{…},"validation":[…],"behavior":[…],"visibility":[…],"dataSources":[…]}

Samples show syntax only: fields come from the task, texts keep its language.
target — the task's stack, keep it: core | renderer-react | renderer-json. On core you write the markup in index.tsx (<FormField control={bundle.form.price} /> from @reformer/ui-kit), then build again; visibility and node rules go to that JSX too. An unknown key is an error naming the nearest one.

## fields
{"name":"price","type":"number","component":"InputNumber","label":"Price","initialValue":null,"componentProps":{"placeholder":"Enter the price","min":1}}
- Group field: "address.city". type: string | number | boolean | date | array (files).
- component: a field of ## components (inputs, choice).
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

## components — @reformer/ui-kit by purpose: inputs and choice are fields, the rest are layoutRoot containers; parts and props of any: form_build {"grammar":"components:Card,Tabs"}
inputs: Input InputNumber InputSuggest InputPassword InputMask InputOTP Textarea DatePicker DatePickerRange DatePickerMulti Calendar FileUpload FileUploadAvatar FileUploadDropzone FileUploadInput
choice: Select SelectMulti NativeSelect NativeSelectMulti Combobox ComboboxMulti ComboboxTree ComboboxTreeMulti RadioGroup Checkbox Switch Slider Toggle ToggleGroup ToggleGroupMulti
layout: Box Section Card Accordion Tabs Collapsible InputGroup ButtonGroup AspectRatio ScrollArea Resizable Sidebar
display: Icon Label Badge Avatar Progress Skeleton Spinner Table Tree Chart Empty Kbd Marker Alert Separator Carousel
typography: TypographyBlockquote TypographyH1 TypographyH2 TypographyH3 TypographyH4 TypographyInlineCode TypographyLarge TypographyLead TypographyList TypographyMuted TypographyP TypographySmall
actions: Button
overlays: Dialog AlertDialog Sheet Drawer Popover HoverCard Tooltip Command
navigation: DropdownMenu ContextMenu Menubar NavigationMenu Breadcrumb Pagination
chat: Bubble Message MessageScroller Attachment Item
other: AsyncBoundaryEmpty AsyncBoundaryError AsyncBoundaryLoading DataGrid DirectionProvider ExampleCard Field FieldArray FieldArraySection FieldContent FieldDescription FieldError FieldGroup FieldLabel FieldLegend FieldSeparator FieldSet FieldTitle FormWizard FormWizardActions FormWizardProgress InfoHint InputOTPGroup InputOTPSeparator InputOTPSlot ScrollBar StepIndicator Toaster

## More: form_build {"grammar":"<section>"}
behavior (more operators), arrays (rows), wizard (steps), cross (across fields), async, parts (sub-forms), operators (own code), nodes (submit, mount), all.
