# Amendment to ADR-0004: a publish is reviewed inside Kit Watch before it is pushed

- **Status:** Accepted (user, 2026-11-26)
- **Amends:** [ADR-0004](../0004-combined-system.md), "opens a pull request the owner reviews", and the brief's
  "Every publish is a pull request. You read the diff, merge it".
- **Source:** the director's `proposals/privacy-wall-design.md`, question 7, option A; see
  [ADR-0049](../0049-privacy-wall-seal.md)

## Decision

The owner reviews a publish inside Kit Watch before its branch is pushed to the public repository. The pull
request stays, as a second look.

## Consequences

- A branch on a public repository is public as soon as it is pushed, before anyone reads it. Reviewing first
  closes that window. No schema can tell that a published paragraph holds an address; the owner's review is the
  guard for free text.
- The publish flow is not in Release 1 (ADR-0011). This record is written now so the flow is built this way from
  milestone 5.
