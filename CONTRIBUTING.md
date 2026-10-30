# Contributing

Small, tested improvements are welcome. Open an issue describing the website problem, expected result and a minimal fictional example before proposing a large feature.

Run `npm ci`, `npm test` and `npm run build`. If you change comparison rules, add a deliberately broken fixture and a repaired case. Explain the source and limits of a check; do not add invented ranking or AI-visibility scores.

Use synthetic data. Do not include credentials, private staging reports, visitor messages, customer details or unapproved client screenshots. Scan only sites you control or have permission to assess. The default checker must remain read-only and must not require an EWB backlink from users' websites.

Network/security changes need explicit tests for private addresses, redirects, limits and failure behaviour. Do not disable TLS verification or relax the default private-network protections.
