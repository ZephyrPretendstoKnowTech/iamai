// Where this tool lives under the domain (prompt 35 §1; owner decision, task
// 015: the hard cut from /rollout/ to /planner/).
//
// getiamai.com/ is the home page for IAMAI as a whole; the planner sits in a
// folder beside any future tool. One constant: if the tool is ever renamed,
// this file changes and nothing else does. vite.config.ts derives the bundle's
// base and outDir from it, scripts/assemble-site.mjs lays out dist/ under it,
// and the home page's links are substituted from it. There is no environment
// variable naming the folder, because a deployment that has to remember to set
// one publishes the wrong path when it forgets.
export const TOOL_NAME = 'planner'

// The published path. There is no preview prefix any more: the retired /next/
// preview left with task 016, so the only path the site publishes is this one
// and the only source it publishes from is `main`.
export const TOOL_PATH = TOOL_NAME
