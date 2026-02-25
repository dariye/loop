# Copy and UX

Evaluate user-facing text and UX patterns in the PR.

## Check for
- If the change includes user-facing text (error messages, labels, documentation), is it clear, correct, and consistent with existing copy?
- If it adds UI changes, are they accessible and consistent with existing UX patterns?
- Are error messages helpful and actionable?
- Is documentation accurate and up to date?

## Severity guidance
- **fail**: User-facing text is misleading, incorrect, or inaccessible in a way that would confuse or block users
- **warning**: Unclear or inconsistent messaging that should be improved
- **note**: Minor wording suggestion or style preference
- **pass**: N/A — no user-facing changes, or all user-facing text is clear and consistent
