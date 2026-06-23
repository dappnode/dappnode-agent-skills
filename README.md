# DAppNode Agent Skills

Agent skills for creating and maintaining DAppNode packages.

## Skills

- `create-dappnode-package`: Create, develop, validate, upload, install, and
  debug a DAppNode package with a fast local Docker loop and DAppNode MCP
  validation.

## Install

Install the skill for Codex:

```bash
npx skills add dappnode/dappnode-agent-skills --skill create-dappnode-package -a codex
```

Install it globally for Codex:

```bash
npx skills add dappnode/dappnode-agent-skills --skill create-dappnode-package -a codex -g
```

List available skills without installing:

```bash
npx skills add dappnode/dappnode-agent-skills --list
```

The singular `npx skill` CLI is a separate CodeBuddy-oriented installer. Use
`SKILL_BASE_URL` with this repository:

```bash
SKILL_BASE_URL=https://github.com/dappnode/dappnode-agent-skills/tree/main npx skill skills/create-dappnode-package
```

## Layout

```text
skills/
└── create-dappnode-package/
    ├── SKILL.md
    ├── agents/openai.yaml
    └── assets/templates/
```

## License

GPL-3.0
