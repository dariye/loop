# Code Quality

Evaluate the PR for code style, clarity, and maintainability.

## Check for
- Does the code follow the project's existing style, conventions, and patterns?
- Are names clear and consistent with the codebase?
- Unnecessary complexity, dead code, or duplication
- Clean imports, exports, and module boundaries
- Appropriate level of abstraction (not over-engineered, not under-structured)

## Severity guidance
- **fail**: Code is fundamentally unclear, introduces significant duplication, or violates core project conventions in a way that will cause maintenance problems
- **warning**: Inconsistent naming or style that should be cleaned up
- **note**: Minor style preference or suggestion for improvement
- **pass**: Code is clean, idiomatic, and consistent with the codebase
