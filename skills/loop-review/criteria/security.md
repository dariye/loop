# Security

Evaluate the PR for security concerns.

## Check for
- Injection vulnerabilities (SQL, command, XSS)
- Authentication or authorization bypass
- Data exposure (logging secrets, leaking PII)
- Unsafe deserialization
- Secrets, tokens, or credentials in code or config

## Severity guidance
- **fail**: Any exploitable vulnerability or credential in code
- **warning**: Missing input validation at system boundaries
- **note**: Theoretical concern with low exploitability
- **pass**: N/A — no security-sensitive changes, or all concerns addressed
