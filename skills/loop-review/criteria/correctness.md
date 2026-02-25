# Correctness

Evaluate the PR for functional correctness against the issue requirements.

## Check for
- Does the code do what the issue requires?
- Logic errors, off-by-one mistakes, race conditions, or unhandled edge cases
- Error cases and invalid inputs handled appropriately
- Boundary conditions considered
- Return values and error propagation correct

## Severity guidance
- **fail**: Code does not fulfill the issue requirements, or contains a logic error that would cause incorrect behavior
- **warning**: Edge case not handled that could cause issues in rare scenarios
- **note**: Minor robustness improvement possible but current code is functional
- **pass**: Implementation correctly satisfies all issue requirements
