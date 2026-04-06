# Workflow Rules

## Branch / change policy
- `main` stays as the stable baseline.
- Feature implementation for this task must be committed on `developing`.
- Keep commits scoped and readable; avoid mixing bootstrap noise with unrelated changes.

## How agents should work
- Read task packet first.
- Stay within scope.
- Report risks explicitly.
- Do not widen task silently.
- Preserve APARU visual language and architecture rules.
- Use provided APARU Maps documentation artifacts instead of inventing map contracts.

## Review policy
- smart

## Done criteria defaults
- Code compiles.
- Relevant checks pass.
- No unrelated changes.
- Output summary included.
- Branch `developing` contains the committed implementation.
