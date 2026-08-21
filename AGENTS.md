# AGENTS.md

## このリポジトリについて

[Webマンガアンテナ](https://webcomics.jp/ranking/new-recent) の新着ランキングを RSS フィードとして配信する Cloudflare Worker。

- `src/index.ts`: Worker 本体。HTMLRewriter で webcomics.jp の HTML を解析し、RSS を組み立てる。
- `src/check.ts`: 実ページを取得してパース結果を検証するスクリプト。ネットワークアクセスを伴う。

## 言語ルール

**ドキュメント、コード中のコメント、コミットメッセージ、PR、issue はすべて日本語で書く。**
識別子・ログ出力・エラーメッセージは英語のままでよい。

## コマンド

ランタイム・パッケージマネージャは bun（バージョンは `mise.toml` で管理）。

```sh
bun install        # 依存のインストール
bun run dev        # wrangler のローカル開発サーバ
bun run typecheck  # tsc --noEmit による型チェック
bun run lint       # Biome によるフォーマット検査 + 静的解析
bun run format     # Biome による自動整形
bun run check      # webcomics.jp を実際に取得して抽出結果を検証
bun run deploy     # Cloudflare へデプロイ
```

`bun run check` は外部サイトへアクセスするため CI では実行していない。手元で疎通を確認したいときに使う。

## 変更前に知っておくこと

- **bun は型チェックをしない。** TypeScript の型を捨ててトランスパイルするだけなので、`bun run` が通っても型エラーは残り得る。変更後は必ず `bun run typecheck` を実行する。
- CI（`.github/workflows/ci.yml`）は `jdx/mise-action` で `mise.toml` どおりのツールを入れてから `biome ci` と `bun run typecheck` を実行する。手元と CI でツールのバージョン指定元が `mise.toml` に一本化されている。push する前に手元で `bun run lint` と `bun run typecheck` を通しておく。

### tsconfig.json

bun の推奨設定をベースに、bun が既定で無効にしている厳格フラグ（`noUnusedLocals` / `noUnusedParameters` / `noPropertyAccessFromIndexSignature`）も有効にしてある。

推奨設定から意図的に外している点が 1 つある。`types` は `["bun"]` ではなく `["@cloudflare/workers-types"]` にしている。デプロイ先は Workers であり、両方を同時に読み込むと `fetch` や `Response` などのグローバルが衝突するおそれがあるため。bun で動かすのは `src/check.ts` だけで、bun 固有 API は使っていない。必要になった時点で `@types/bun` の追加を再検討する。

### biome.json

lint ルールは `preset: "recommended"`。整形はスペース 2、シングルクォート、1 行 100 文字。整形対象は `src/**` とルートの `*.json`（`bun.lock` は除外）。

`bun run lint`（`biome check`）は静的解析だけでなく整形崩れも検出する。CI では `--write` を持たない `biome ci` を使い、ファイルを書き換えられない形で同じ検査をかけている。`--reporter=github` により指摘は PR の該当行に注釈として表示される。

## コメントの書き方

コードを読めばわかることは書かない。そのコードだけを見ても予測できない背景（外部仕様の落とし穴、過去の不具合への対策、壊してはいけない不変条件）がある場合にのみ、1〜2 行で書く。
