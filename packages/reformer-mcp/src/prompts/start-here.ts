import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const startHerePromptDefinition = {
  name: 'start-here',
  description:
    'START HERE. Entry-point for building a form with ReFormer using ONLY this MCP server. Returns the canonical workflow of the unified form contract (model → one schema → one assembly `createForm` → validation → the one behavior → wizard → draw), a map of which prompt/tool/resource to use at each step, and the reading order. Call this first when asked to build or modify a ReFormer form.',
  arguments: [],
};

export function getStartHerePrompt(): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('start-here', {});
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
