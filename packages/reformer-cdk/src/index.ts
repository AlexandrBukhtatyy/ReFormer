// ============================================================================
// AsyncBoundary - Headless compound component for data-loading UI states
// ============================================================================
export {
  AsyncBoundary,
  AsyncBoundaryRoot,
  AsyncBoundaryIdle,
  AsyncBoundaryLoading,
  AsyncBoundaryContent,
  AsyncBoundaryEmpty,
  AsyncBoundaryError,
  AsyncBoundaryRetry,
  useAsyncBoundary,
  useAsyncResource,
  asyncResourceReducer,
  initialAsyncResourceState,
  defaultToError,
  AsyncBoundaryContext,
  useAsyncBoundaryContext,
} from './components/async-boundary';

export type {
  AsyncStatus,
  AsyncBoundaryHandle,
  AsyncBoundaryRootProps,
  AsyncBoundarySlotProps,
  AsyncBoundaryContentProps,
  AsyncBoundaryEmptyProps,
  AsyncBoundaryErrorProps,
  AsyncBoundaryErrorRenderProps,
  AsyncBoundaryRetryProps,
  AsyncBoundaryContextValue,
  AsyncBoundaryIds,
  UseAsyncBoundaryOptions,
  UseAsyncBoundaryReturn,
  AsyncBoundaryRootPropGetters,
  AsyncBoundaryLoadingPropGetters,
  AsyncBoundaryErrorPropGetters,
  UseAsyncResourceOptions,
  UseAsyncResourceReturn,
  AsyncResourceState,
  AsyncResourceAction,
} from './components/async-boundary';

// ============================================================================
// FieldArray - Headless compound component for managing form arrays
// ============================================================================
export {
  FieldArray,
  FieldArrayList,
  FieldArrayAddButton,
  FieldArrayRemoveButton,
  FieldArrayEmpty,
  FieldArrayCount,
  FieldArrayItemIndex,
  useFieldArray,
  FieldArrayContext,
  FieldArrayItemContext,
  useFieldArrayContext,
  useFieldArrayItemContext,
} from './components/field-array';

export type {
  FieldArrayHandle,
  FieldArrayItem,
  UseFieldArrayReturn,
  FieldArrayRootProps,
  FieldArrayListProps,
  FieldArrayItemRenderProps,
  FieldArrayAddButtonProps,
  FieldArrayRemoveButtonProps,
  FieldArrayEmptyProps,
  FieldArrayCountProps,
  FieldArrayItemIndexProps,
  FieldArrayContextValue,
  FieldArrayItemContextValue,
} from './components/field-array';

// ============================================================================
// List - Headless compound component for display-iterating a model array
// ============================================================================
export {
  List,
  useList,
  ListContext,
  ListItemContext,
  useListContext,
  useListItemContext,
} from './components/list';

export type {
  UseListReturn,
  ListControl,
  ListItem,
  ListRootProps,
  ListItemsProps,
  ListEmptyProps,
  ListContextValue,
  ListItemContextValue,
} from './components/list';

// ============================================================================
// FormField - Headless compound component for accessible form field anatomy
// ============================================================================
export {
  FormField,
  FormFieldRoot,
  FormFieldLabel,
  FormFieldControl,
  FormFieldError,
  FormFieldDescription,
  useFormField,
  FormFieldContext,
  useFormFieldContext,
} from './components/form-field';

export type {
  FormFieldIds,
  FormFieldContextValue,
  FormFieldRootProps,
  FormFieldLabelProps,
  FormFieldControlProps,
  FormFieldErrorProps,
  FormFieldDescriptionProps,
  UseFormFieldReturn,
  UseFormFieldState,
  UseFormFieldLabelProps,
  UseFormFieldControlProps,
  UseFormFieldErrorProps,
  UseFormFieldDescriptionProps,
} from './components/form-field';

// ============================================================================
// FileUpload - Headless compound component for file selection and upload
// ============================================================================
export {
  FileUpload,
  FileUploadRoot,
  FileUploadTrigger,
  FileUploadDropzone,
  FileUploadItemGroup,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemName,
  FileUploadItemSize,
  FileUploadItemProgress,
  FileUploadItemDeleteTrigger,
  FileUploadItemRetryTrigger,
  FileUploadClearTrigger,
  useFileUpload,
  FileUploadContext,
  useFileUploadContext,
  FileUploadItemContext,
  useFileUploadItemContext,
  fileUploadReducer,
  initialFileUploadState,
  selectFiles,
  projectValue,
  reconcileItems,
  fileItemKey,
  formatFileSize,
  makeFileError,
} from './components/file-upload';

export type {
  FileUploadComponent,
  FileUploadRootProps,
  FileUploadTriggerProps,
  FileUploadDropzoneProps,
  FileUploadItemGroupProps,
  FileUploadItemProps,
  FileUploadItemPreviewProps,
  FileUploadItemNameProps,
  FileUploadItemSizeProps,
  FileUploadItemProgressProps,
  FileUploadItemDeleteTriggerProps,
  FileUploadItemRetryTriggerProps,
  FileUploadClearTriggerProps,
  FileUploadContextValue,
  FileUploadItemContextValue,
  FileUploadState,
  FileUploadAction,
  SelectFilesOptions,
  SelectFilesResult,
  RemoteFileRef,
  FileError,
  FileRejection,
  FileUploadItemData,
  FileUploadValue,
  FileUploadUploader,
  UseFileUploadOptions,
  FileUploadHandle,
  UseFileUploadReturn,
  FileUploadIds,
  FileUploadRootPropGetters,
  FileUploadDropzonePropGetters,
} from './components/file-upload';

// ============================================================================
// Option source - async options loading shared by list fields (Select, Autocomplete)
// ============================================================================
export {
  resolveStrategyFlags,
  normalizeItems,
  mergeOptions,
  filterClient,
  resourceReducer,
  initialResourceState,
  hasMore,
  isNearBottom,
  useResourceOptions,
} from './components/option-source';

export type {
  ResourceLoadParams,
  ResourceItem,
  ResourceResult,
  ResourceStrategy,
  ResourceConfig,
  NormalizedOption,
  StrategyFlags,
  ResourceState,
  ResourceAction,
  UseResourceOptionsResult,
} from './components/option-source';

// ============================================================================
// Autocomplete - Headless free-text input with suggestions
// ============================================================================
export {
  Autocomplete,
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteListbox,
  AutocompleteOption,
  AutocompleteLoading,
  useAutocomplete,
  AutocompleteContext,
  useAutocompleteContext,
  autocompleteReducer,
  initialAutocompleteState,
  isSuggestionResource,
  normalizeSuggestions,
  matchSuggestions,
} from './components/autocomplete';

export type {
  AutocompleteComponent,
  AutocompleteRootProps,
  AutocompleteInputProps,
  AutocompleteListboxProps,
  AutocompleteOptionProps,
  AutocompleteLoadingProps,
  UseAutocompleteOptions,
  UseAutocompleteReturn,
  AutocompleteIds,
  AutocompleteContextValue,
  AutocompleteState,
  AutocompleteAction,
  AutocompleteSuggestionItem,
  AutocompleteSuggestionList,
  AutocompleteSuggestions,
  AutocompleteFilter,
  MatchSuggestionsOptions,
} from './components/autocomplete';

// ============================================================================
// Validation messages - issue text for field display (code → text): form dictionary over locale
// ============================================================================
export { ValidationMessagesProvider, useIssueMessageResolver } from './validation/error-resolver';

export type {
  IssueMessageResolver,
  ValidationMessagesProviderProps,
} from './validation/error-resolver';

// ============================================================================
// FormWizard - Headless compound component for multi-step form wizards
// ============================================================================
export {
  FormWizard,
  FormWizardStep,
  FormWizardIndicator,
  FormWizardActions,
  FormWizardProgress,
  useFormWizard,
  FormWizardContext,
  defineSteps,
} from './components/form-wizard';

export type {
  FormWizardHandle,
  FormWizardProps,
  FormWizardConfig,
  DefineStepsConfig,
  WizardStepsConfig,
  FormWizardStepProps,
  FormWizardContextValue,
  FormWizardIndicatorProps,
  FormWizardIndicatorStep,
  FormWizardIndicatorStepWithState,
  FormWizardIndicatorRenderProps,
  FormWizardActionsProps,
  FormWizardActionsRenderProps,
  FormWizardButtonProps,
  FormWizardSubmitProps,
  FormWizardProgressProps,
  FormWizardProgressRenderProps,
} from './components/form-wizard';
