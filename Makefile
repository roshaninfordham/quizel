.PHONY: online online-public online-cloudflare online-localhostrun online-ngrok reset seed test typecheck build spacetime-build load load-smoke capacity-report

online:
	pnpm online

online-public:
	TUNNEL_PROVIDER=auto pnpm online

online-cloudflare:
	TUNNEL_PROVIDER=cloudflare pnpm online

online-localhostrun:
	TUNNEL_PROVIDER=localhostrun pnpm online

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

load:
	USERS=$(or $(USERS),100) TOPICS=$(or $(TOPICS),10) pnpm load:prod

load-smoke:
	USERS=10 TOPICS=3 STATIC_REQUESTS=10 CONNECT_CONCURRENCY=10 JOIN_CONCURRENCY=10 ANSWER_CONCURRENCY=25 pnpm load:prod

capacity-report:
	USERS=$(or $(USERS),100) TOPICS=$(or $(TOPICS),10) pnpm load:prod
