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

// The /next/ preview publishes the same tool one level down (getiamai.com/next/
// planner/). A prefix is all that differs, so the name is still written once.
export const TOOL_PATH = (process.env.TOOL_PATH_PREFIX ?? '') + TOOL_NAME
