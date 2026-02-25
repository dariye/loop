# Design Adherence

Evaluate whether the implementation matches the agreed-upon design.

## Check for
- Does the implementation match the design that was agreed upon in the issue?
- If there are deviations from the design, are they justified and noted?
- Are the right files modified, and only the right files?
- Does the scope of changes match the design scope (no scope creep, no missing pieces)?

## Severity guidance
- **fail**: Implementation significantly deviates from the design without justification, or missing key pieces that the design specified
- **warning**: Minor deviation from design that should be noted
- **note**: Small difference from design that is arguably an improvement
- **pass**: Implementation faithfully follows the design, or deviations are justified
