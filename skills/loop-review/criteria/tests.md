# Tests

Evaluate the PR's test coverage and test quality.

## Check for
- Are there tests for the new or changed behavior?
- Do the tests cover meaningful cases, not just the happy path?
- Are existing tests still valid, or do any need updating for the new behavior?
- If the design specified a test plan, is it fulfilled?
- Are test names descriptive and test assertions meaningful?

## Severity guidance
- **fail**: No tests for new behavior that clearly needs them, or existing tests broken by the change
- **warning**: Tests exist but miss important edge cases or are superficial
- **note**: Suggestion for additional test coverage that would be nice to have
- **pass**: Adequate test coverage for the changes, existing tests unaffected or properly updated
