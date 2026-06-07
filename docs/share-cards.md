# Share Cards

Share URLs are durable database records, not text-derived links.

## Lifecycle

1. Phone final screen calls `create_share_card(sessionId, participantId)`.
2. The SpacetimeDB reducer verifies a `FinalResult` exists.
3. The reducer creates or reuses a `ShareCard` row for that participant/session.
4. The row receives a URL-safe random slug, not a player name or score sentence.
5. The phone opens `/share/:slug` only after the row exists.
6. The share page subscribes to `ShareCard` by slug and calls `increment_share_view(slug)`.

`reset_demo()` preserves share cards. `hard_reset_demo()` removes them for development resets.

## Mermaid

```mermaid
flowchart LR
  Phone[Phone Final Screen] -->|create_share_card| DB[(SpacetimeDB)]
  DB -->|validates| Final[FinalResult]
  DB --> Share[ShareCard slug]
  Phone --> Page[/share/:slug]
  Page -->|subscribe by slug| DB
  Page -->|increment_share_view| DB
```
