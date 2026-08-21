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

## 抽出の疎通確認

webcomics.jp の HTML 構造が変わると抽出が壊れるため、実ページを取得してパース結果を検証する。

```sh
bun run check
```

20 件未満しか取れない場合は失敗として exit 1 する。

Worker 本体は抽出に失敗したとき、空フィードではなく `⚠️ 抽出に失敗しています (YYYY-MM-DD)` という item を 1 件だけ含むフィードを返す。RSS リーダーに未読記事として届くので、ダッシュボードを見ていなくても気付ける。guid は JST の日付単位（`webcomics-alert-2026-08-21`）なので、フェッチのたびに重複記事が増えることはなく、復旧しない場合は 1 日 1 件だけ届く。

## デプロイ

```sh
bun run deploy
```
