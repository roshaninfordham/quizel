.PHONY: online online-public online-cloudflare online-ngrok reset seed test typecheck build spacetime-build

online:
	pnpm online

online-public:
	TUNNEL_PROVIDER=auto pnpm online

online-cloudflare:
	TUNNEL_PROVIDER=cloudflare pnpm online

online-ngrok:
	TUNNEL_PROVIDER=ngrok pnpm online

reset:
	pnpm reset:demo

seed:
	pnpm seed:demo

test:
	pnpm test

typecheck:
	pnpm typecheck

build:
	pnpm build

spacetime-build:
	pnpm spacetime:build
