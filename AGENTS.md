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
bun run typecheck  # bun check による型チェック
bun run lint       # bun fmt によるフォーマット検査 + Biome による静的解析
bun run format     # bun fmt による自動整形
bun run check      # webcomics.jp を実際に取得して抽出結果を検証
bun run deploy     # Cloudflare へデプロイ
```

`bun run check` は外部サイトへアクセスするため CI では実行していない。手元で疎通を確認したいときに使う。

## 変更前に知っておくこと

- **`bun run` は型チェックをしない。** TypeScript の型を捨ててトランスパイルするだけなので、`bun run` が通っても型エラーは残り得る。変更後は必ず `bun run typecheck` を実行する。
- **`bun check` と打つと型チェックではなく `check` スクリプト（疎通確認）が走る。** bun は組み込みコマンドより同名の `package.json` スクリプトを優先する。組み込みの型チェックは `bun run typecheck`（中身は `bun check --no-script`）で呼ぶ。
- 型チェックは bun の組み込みなので `typescript` パッケージは入れていない。
- CI（`.github/workflows/ci.yml`）は `jdx/mise-action` で `mise.toml` どおりのツールを入れてから `bun fmt --check`、`biome ci`、`bun run typecheck` を実行する。手元と CI でツールのバージョン指定元が `mise.toml` に一本化されている。push する前に手元で `bun run lint` と `bun run typecheck` を通しておく。

### tsconfig.json

bun の推奨設定をベースに、bun が既定で無効にしている厳格フラグ（`noUnusedLocals` / `noUnusedParameters` / `noPropertyAccessFromIndexSignature`）も有効にしてある。

推奨設定から意図的に外している点が 1 つある。`types` は `["bun"]` ではなく `["@cloudflare/workers-types"]` にしている。デプロイ先は Workers であり、両方を同時に読み込むと `fetch` や `Response` などのグローバルが衝突するおそれがあるため。bun で動かすのは `src/check.ts` だけで、bun 固有 API は使っていない。必要になった時点で `@types/bun` の追加を再検討する。

### bunfig.toml

`[fmt]` が `bun fmt` の整形設定。書式は `bun fmt` のデフォルト（Prettier 相当）のままにする。デフォルトから変えているのは import の並べ替え（`sortImports`）だけで、既定では無効なので有効にしてある。整形対象は `.gitignore` に載っていない全ファイルで、Markdown・YAML・TOML も含む。

### .git-blame-ignore-revs

整形だけのコミットを `git blame` から外すための一覧。GitHub の blame 表示は自動でこのファイルを読む。手元では次の設定を 1 度だけ行う。

```sh
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

一括整形をしたら、そのコミットの SHA をここに足す。SHA が変わると効かなくなるため、整形コミットを含む PR はスカッシュやリベースではなくマージコミットで取り込む。

### biome.json

Biome は静的解析だけに使う。bun に組み込みの lint がまだないため。整形と import の並べ替えは `bun fmt` と二重にならないよう無効にしてある。lint ルールは `preset: "recommended"`、対象は `src/**`。

`bun run lint` は整形崩れ（`bun fmt --check`）と静的解析（`biome lint`）の両方を検出する。CI の `biome ci` は `--reporter=github` により、指摘を PR の該当行に注釈として表示する。`bun fmt --check` は整形が崩れたファイル名を出すだけで、行注釈は出ない。

## コメントの書き方

コードを読めばわかることは書かない。そのコードだけを見ても予測できない背景（外部仕様の落とし穴、過去の不具合への対策、壊してはいけない不変条件）がある場合にのみ、1〜2 行で書く。
