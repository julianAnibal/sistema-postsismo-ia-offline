# Proof of Life

Demonstration performed on 2026-08-15 (America/Bogota).

## Result

The local OpenSymphony control plane, operator client, isolated workspace hook,
and authenticated Codex runtime all completed their smoke tests. The only
unavailable step is OpenSymphony's own authenticated Linear polling because no
personal `LINEAR_API_KEY` has been provided to the local process.

## Evidence

### Static validation

`scripts/validate.sh` completed with:

```text
Validacion del harness: OK
```

`opensymphony doctor` parsed the configuration and workflow, rendered the
5,907-character agent prompt, prepared the workspace root, and recognized three
active plus three terminal Linear states.

### Live control plane

The daemon ran on `127.0.0.1:2468`. The operator TUI connected and received live
snapshots while its sequence counter advanced. The sample worker moved through:

```text
worker_started -> running -> retry_queued -> completed
```

The TUI smoke test exited normally with status 0. The daemon was then stopped
cleanly with `Ctrl-C`.

### Isolated issue workspace

The configured `after_create` behavior was reproduced for issue `DNA-58` using
a fresh non-local shallow clone. The resulting repository was clean at:

```text
69001e7 chore: bootstrap postsismo OpenSymphony harness
```

### Real Codex model call

Codex CLI 0.142.5 launched the authenticated OpenAI `gpt-5.5` model inside the
isolated workspace with a read-only sandbox. It read `README.md` and
`WORKFLOW.md` without changing files and returned:

```text
HARNESS_OK | project=Sistema Postsismo IA Offline | route=codex_app_server | safety_rules=8
```

The model process exited normally with status 0, and the workspace remained
clean.

### Authentication boundary

A dry run using an intentionally invalid Linear credential reached Linear's
GraphQL service and was rejected as expected:

```text
AUTHENTICATION_ERROR: Authentication required, not authenticated
exit_code=1
```

This confirms that the remaining boundary is a valid personal Linear API key,
not the OpenSymphony installation, workflow parser, local control plane,
workspace hook, or Codex runtime.

## Reproduce

With a personal Linear key exported only in the terminal:

```bash
source ~/.zshrc
export LINEAR_API_KEY='lin_api_...'
./scripts/doctor.sh
./scripts/run.sh
```

In a second terminal:

```bash
./scripts/tui.sh
```

OpenSymphony runs agents with broad host access. Use only on a trusted machine
and keep high-risk decisions under human review.
