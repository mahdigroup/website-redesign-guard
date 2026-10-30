# Security

For a potential vulnerability, contact **info@essexwebsitebuilders.co.uk** with the subject “Redesign Guard security report”. Please use a minimal synthetic reproduction and do not post credentials or private website data in a public issue.

Version 1.x is the currently maintained release line. This is a local, read-only HTTP checker, not a hosted arbitrary-URL scanning API. The website demo does not accept URLs for server-side scanning; uploaded snapshots are compared in the visitor's browser.

Do not expose `--allow-private` to untrusted remote users. Treat reports from authenticated/private environments as private. Dependency updates should retain the network boundary and output-escaping tests.
