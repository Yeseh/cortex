---
description: Review typescript code related to the memory system design and implementation in Cortex.
name: code-review
---

## Running Eslint

To run eslint on the TypeScript code in the Cortex project, use the following command:

```bash
npx eslint src/**/*.ts
```
This command will analyze all TypeScript files in the `src` directory and its subdirectories, checking for code quality and style issues based on the defined eslint rules. 

You can also input specific files or directories to lint by replacing `src/**/*.ts` with your desired pathe