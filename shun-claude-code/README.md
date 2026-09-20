# 🤖 Claude Code

ブラウザから使える [Claude Code](https://www.anthropic.com/claude-code)。umbrelOS上のコンテナで常時起動し、[ttyd](https://github.com/tsl0922/ttyd) 経由でターミナルとして操作します。tmuxセッション上で動くため、ブラウザを閉じても作業中のセッションは維持され、スマホのClaudeアプリからも同じセッションにRemote Control接続できます。

## 機能

- ブラウザから直接ターミナル操作（ttyd + tmux）
- `main` セッション（手動操作用）と `claude-rc` セッション（Remote Control自己復旧ループ）を分離
- コンテナ再起動時も `claude remote-control --continue` で元のセッションに復帰（約4時間以内）
- Python3 / Go / TypeScript（ts-node）に加え、GitHub CLI (`gh`) と AWS CLI v2 を同梱
- `/workspace` と `~/.claude` はホスト側に永続化

## 初回セットアップ

1. アプリを開くとブラウザにターミナル（`main`セッション）が表示されるので、`claude` を実行してログイン（claude.aiアカウントでのOAuth対応）
2. `Ctrl+b` → `s` でセッション一覧を開き、`claude-rc` セッションに切り替える
3. `claude-rc` セッション内で `claude remote-control` の初回確認（ワークスペースの信頼確認 / Remote Control有効化のy/n）を一度だけ手動で通す
4. 以降は自動で再接続・再起動される

## gh / aws cli を使う場合

umbrelOS 2.0以降であれば、アプリを開いた状態で `App > Settings > Environment variables` から以下を直接入力できます（umbrelOS 1.xでは入力欄が出ないため利用不可）。

| 変数 | 用途 |
|---|---|
| `GH_TOKEN` | `gh` コマンドの認証 |
| `AWS_ACCESS_KEY_ID` | `aws` コマンドの認証 |
| `AWS_SECRET_ACCESS_KEY` | `aws` コマンドの認証 |
| `AWS_DEFAULT_REGION` | 未設定時は `ap-northeast-1` |

入力後にアプリを再起動すると、コンテナ内に環境変数として反映されます。

## CLAUDE.md（グローバル指示）

初回起動時のみ `CLAUDE.md.default` の雛形が `~/.claude/CLAUDE.md` にコピーされます（永続化されるので、以降はコンテナ内で直接編集すれば設定が保持されます）。複数プロジェクト共通のコーディング規約やClaudeへの指示を書いておく場所です。

## 永続化データ

`docker-compose.yml` で以下をホスト側にバインドマウントしています。

| コンテナ内パス | 用途 |
|---|---|
| `/root/.claude` | ログイン情報・設定・CLAUDE.md |
| `/root/.claude.json.d` | Claude Code の設定 |
| `/workspace` | 作業用ディレクトリ（コードを置く場所） |
| `/root/go` | `go get` / `go install` のパッケージキャッシュ |

## ローカルでのビルド確認

```bash
docker build -t shun-claude-code:test .
```

## ディレクトリ構成

```
shun-claude-code/
├── umbrel-app.yml       # umbrelOS向けのアプリ定義（説明文・バージョン等）
├── docker-compose.yml   # サービス定義・永続化ボリューム・環境変数
├── Dockerfile           # ttyd / gh / aws cli / go / Claude Code CLI を導入
├── entrypoint.sh         # tmuxセッション起動・CLAUDE.md雛形の配置
├── claude-rc-loop.sh    # claude remote-control の自己復旧ループ
└── CLAUDE.md.default    # ~/.claude/CLAUDE.md の初期雛形
```

## UmbrelOSへのデプロイ

1. このリポジトリをCommunity App StoreとしてUmbrelに追加
2. `shun-claude-code` をインストール
3. `docker-compose.yml` の `build: .` によりローカルビルドされます
