// Каталог живых форм из батча 20261121T003557Z-5d82 — пишет
// стенд замеров MCP (mcp-examples-docs.mjs), руками не править.
import type { McpExampleCatalog } from '../example-types';

export const MCP_EXAMPLES: McpExampleCatalog = {
  "registration": {
    scenario: "registration-create",
    stacks: {
      "core": {
        run: {"batch":"20261121T003557Z-5d82","run":"registration-create.core.mcp-dsl.sonnet.r1","model":"sonnet","repeat":1,"repeats":3,"pass":true,"score":1,"minutes":0.44,"cost":0.088,"turns":7,"calls":6},
        load: () => import('./registration/core/entry'),
      },
      "renderer-react": {
        run: {"batch":"20261121T003557Z-5d82","run":"registration-create.renderer-react.mcp-dsl.sonnet.r1","model":"sonnet","repeat":1,"repeats":3,"pass":true,"score":1,"minutes":0.36,"cost":0.046,"turns":5,"calls":4},
        load: () => import('./registration/renderer-react/entry'),
      },
      "renderer-json": {
        run: {"batch":"20261121T003557Z-5d82","run":"registration-create.renderer-json.mcp-dsl.sonnet.r1","model":"sonnet","repeat":1,"repeats":3,"pass":true,"score":1,"minutes":0.42,"cost":0.063,"turns":7,"calls":6},
        load: () => import('./registration/renderer-json/entry'),
      },
    },
  },
  "order": {
    scenario: "order-create",
    stacks: {
      "core": {
        run: {"batch":"20261121T003557Z-5d82","run":"order-create.core.mcp-dsl.sonnet.r1","model":"sonnet","repeat":1,"repeats":3,"pass":true,"score":1,"minutes":0.95,"cost":0.235,"turns":12,"calls":10},
        load: () => import('./order/core/entry'),
      },
      "renderer-react": {
        run: {"batch":"20261121T003557Z-5d82","run":"order-create.renderer-react.mcp-dsl.sonnet.r2","model":"sonnet","repeat":2,"repeats":3,"pass":true,"score":1,"minutes":0.98,"cost":0.278,"turns":14,"calls":10},
        load: () => import('./order/renderer-react/entry'),
      },
      "renderer-json": {
        run: {"batch":"20261121T003557Z-5d82","run":"order-create.renderer-json.mcp-dsl.sonnet.r1","model":"sonnet","repeat":1,"repeats":3,"pass":true,"score":1,"minutes":0.9,"cost":0.235,"turns":12,"calls":10},
        load: () => import('./order/renderer-json/entry'),
      },
    },
  },
  "wizard": {
    scenario: "wizard-create",
    stacks: {
      "core": {
        run: {"batch":"20261121T003557Z-5d82","run":"wizard-create.core.mcp-dsl.sonnet.r3","model":"sonnet","repeat":3,"repeats":3,"pass":true,"score":1,"minutes":1.07,"cost":0.253,"turns":15,"calls":13},
        load: () => import('./wizard/core/entry'),
      },
      "renderer-react": {
        run: {"batch":"20261121T003557Z-5d82","run":"wizard-create.renderer-react.mcp-dsl.sonnet.r1","model":"sonnet","repeat":1,"repeats":3,"pass":true,"score":1,"minutes":1.05,"cost":0.26,"turns":13,"calls":11},
        load: () => import('./wizard/renderer-react/entry'),
      },
      "renderer-json": {
        run: {"batch":"20261121T003557Z-5d82","run":"wizard-create.renderer-json.mcp-dsl.sonnet.r1","model":"sonnet","repeat":1,"repeats":3,"pass":true,"score":1,"minutes":0.81,"cost":0.224,"turns":10,"calls":8},
        load: () => import('./wizard/renderer-json/entry'),
      },
    },
  },
};
