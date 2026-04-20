# webcomics-rss

[Webマンガアンテナ](https://webcomics.jp/ranking/new-recent) の新着ランキングを RSS フィードとして配信する Cloudflare Worker。

## 機能

- サムネイル画像付きの RSS フィード生成
- フィードのリンクは webcomics.jp の詳細ページ（「詳細・更新情報」）に遷移

## 開発

```sh
bun install
bun run dev
```

## デプロイ

```sh
bun run deploy
```
