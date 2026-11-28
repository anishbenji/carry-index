# ADR-0007: One public repository for both apps

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B1 / A1: One public repo, location and name"

## Context

A public repo is a showcase and keeps one schema and one CI. The daily airline checker runs from the existing local folder.

## Decision

One public GitHub repo for both apps, named `carry-index`, built in the existing local folder `~/code/the-carry-index` so the daily airline checker keeps running. Private data never enters the repo.

## Consequences

GitHub `carry-index`, built in the local folder `the-carry-index`, which keeps its name so the scheduled checker keeps running. Private data never enters the repo; fixtures are synthetic. A folder rename may follow Release 1 together with repointing the checker.

## Why

Accepted the recommendation (one schema, one CI, a showcase; the folder stays put for the scheduled job). Repo name matches the umbrella project name. The folder and repo names differ on purpose for now; renaming the folder to `carry-index` may follow after Release 1, together with repointing the airline checker job.
