# DAppNode Agent Skills

Agent skills for creating, maintaining and testing DAppNode packages.

## Skills

- `create-dappnode-package`: Create, develop, validate, upload, install, and
  debug a DAppNode package with a fast local Docker loop and DAppNode MCP
  validation.
- `dappnode-e2e-test`: Deeply test a change to DAPPMANAGER or a core package on
  a real test node, through the admin UI and on the host, and report whether it
  is safe to merge or publish.

## Install

Install a skill for Codex (replace `create-dappnode-package` with the skill you
want):

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
├── create-dappnode-package/
│   ├── SKILL.md
│   ├── agents/openai.yaml
│   ├── assets/templates/
│   └── references/
└── dappnode-e2e-test/
    ├── SKILL.md
    ├── agents/openai.yaml
    ├── references/
    └── scripts/
```

## License

GPL-3.0
