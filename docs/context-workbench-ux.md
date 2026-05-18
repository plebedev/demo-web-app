# Context Workbench UX

Context Workbench is a contextual decision-support surface. It should help a
user understand what the system believes, why it believes it, what evidence
supports it, and what should happen next.

## Information hierarchy

Perspective sections render in this order:

1. decision summary
2. why it matters
3. supporting evidence
4. additional signals

The UI should not expose extraction internals as the default reading path.
Artifacts, chunks, and provenance remain available for verification, but the
primary view is synthesized.

## Synthesis and evidence

`ViewSection.content` is treated as ordered synthesis. The first content line is
the section conclusion. Additional lines become secondary signals.

`EvidenceLink` records are grouped by artifact, chunk or label, note, and
excerpt. The first grouped sources are shown by default, with an expansion
control for the longer provenance trail.

## Confidence

Confidence is coarse:

- `High confidence`
- `Medium confidence`
- `Low confidence`

The frontend does not invent percentages. Current labels reflect source depth
and explicit-vs-inferred evidence, because the backend rule-based extractors do
not emit calibrated model scores.

## Explicit vs inferred

Evidence notes and section metadata distinguish explicit evidence from inferred
signals. Explicit evidence should read as source-backed fact. Inferred signals
should read as analysis that depends on the available source material.

## Actionable items

Actionable items are grouped by readiness:

- `ready_for_agent`
- `needs_decision`
- `needs_human_clarification`
- `needs_source_material`
- `needs_review`
- `blocked`

Each item should show why it exists, its supporting evidence, and whether it is
human-owned or potentially agent-suitable after review. The workbench does not
execute agents.

## Reuse boundary

The rendering primitives are generic over `PerspectiveView`, `ViewSection`,
`EvidenceLink`, and `ActionableItem`. Perspective-specific question text lives
inside the Context Workbench experience, not shared frontend infrastructure or
Context Engine core.
