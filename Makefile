.PHONY: online reset seed test typecheck build spacetime-build

online:
	pnpm online

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
