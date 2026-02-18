# Snake Shared Leaderboard Worker

## Deploy

1. Login:

```bash
npx wrangler login
```

2. Create KV namespace:

```bash
npx wrangler kv namespace create LEADERBOARD
```

3. Copy the returned `id` into `wrangler.toml` for:

```toml
[[kv_namespaces]]
binding = "LEADERBOARD"
id = "REPLACE_WITH_KV_NAMESPACE_ID"
```

4. Deploy:

```bash
npx wrangler deploy
```

5. Use the deployed URL in your game:

```html
<script>
  window.SNAKE_SHARED_LEADERBOARD_URL = "https://snake-leaderboard.<subdomain>.workers.dev";
</script>
```

