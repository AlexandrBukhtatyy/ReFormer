/**
 * Ambient-типы для deep-импортов monaco (у ESM-контрибуций нет `.d.ts`).
 * `?worker`-импорты типизируются через `vite/client`.
 */
declare module 'monaco-editor/editor/editor.api' {
  export * from 'monaco-editor';
}
declare module 'monaco-editor/language/json/monaco.contribution' {
  export const jsonDefaults: {
    setDiagnosticsOptions(options: {
      validate?: boolean;
      allowComments?: boolean;
      enableSchemaRequest?: boolean;
      schemas?: Array<{ uri: string; fileMatch?: string[]; schema?: object }>;
    }): void;
  };
  export const getWorker: unknown;
}
