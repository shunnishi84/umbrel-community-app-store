#!/bin/bash
set -e

# GH_TOKEN / AWS_ACCESS_KEY_ID 等は docker-compose.yml の environment 経由で
# 注入済み（umbrelOSのApp > Settings > Environment variablesで設定した値）。
# tmuxはサーバー起動時点の環境を新規セッションに引き継ぐので、ここで特別な
# 読み込み処理は不要。

# /root/.claude はホストにバインドマウントされ永続化される。CLAUDE.mdは
# 初回起動時（まだ無い場合）のみ雛形を配置し、以降はユーザーの編集を尊重する
mkdir -p /root/.claude
if [ ! -f /root/.claude/CLAUDE.md ]; then
    cp /usr/local/share/claude-code-container/CLAUDE.md.default /root/.claude/CLAUDE.md
fi

# 手動操作用のメインセッション（ブラウザ接続時はここに繋がる）
tmux has-session -t main 2>/dev/null || tmux new-session -d -s main -c /workspace

# Remote Control 自己復旧ループ用セッション（バックグラウンドで独立稼働）
tmux has-session -t claude-rc 2>/dev/null || tmux new-session -d -s claude-rc -c /workspace /usr/local/bin/claude-rc-loop.sh

# ブラウザ用ターミナル。mainセッションにアタッチした状態でフォアグラウンド起動（これがPID1）
# tmux内で Ctrl+b -> s でセッション一覧に切り替えれば claude-rc の様子も覗ける
exec ttyd -W -p 7681 tmux attach-session -t main
