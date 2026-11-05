# Eve + Zero Token example

Minimal [Eve](https://eve.dev/docs) agent that uses OpenClaw Zero Token web
models (Claude Web, ChatGPT Web, DeepSeek, …) through the bundled
`eve-bridge` plugin.

Eve requires **Node.js 24+**. Keep this example in its own directory — do not
run `npx eve init` at the OpenClaw repo root.

## Prerequisites

1. Onboard a web model in OpenClaw (`openclaw onboard claude-web` or `openclaw webauth`).
2. Start the Gateway (`openclaw gateway`). Default listen address: `http://127.0.0.1:18789`.
3. Export the Gateway token Eve will send as `Authorization: Bearer`:

```bash
export OPENCLAW_GATEWAY_TOKEN="your-gateway-token"
export ZERO_TOKEN_MODEL="claude-web"          # or claude-web/claude-sonnet-4-6
export ZERO_TOKEN_BASE_URL="http://127.0.0.1:18789/zero-token/v1"
```

## Run

```bash
cd examples/eve-zero-token
npm install
npx eve dev
```

See [Eve + Zero Token](../../docs/zero-token/eve.md) for the full contract,
why this is not `/v1/chat/completions`, and how to disable the plugin.
