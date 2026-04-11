#!/bin/bash
# KasmVNC の HTTPS チェックをバイパスする
#
# 問題: KasmVNC の JavaScript が window.isSecureContext を確認し、
#       HTTP アクセス時にエラーを表示する。これはブラウザのセキュリティ機能で
#       サーバー設定だけでは回避できない。
# 解決: JavaScript ファイルの isSecureContext チェックを直接パッチする。
#       このスクリプトはコンテナ起動ごとに実行される。

echo "[webtop] HTTP アクセス用の設定を適用中..."

# --- Method 1: kasmvnc.yaml の SSL 設定を無効化 ---
for config in \
    "/config/.config/kasmvnc/kasmvnc.yaml" \
    "/etc/kasmvnc/kasmvnc.yaml" \
    "/defaults/.config/kasmvnc/kasmvnc.yaml"
do
    if [ -f "$config" ]; then
        sed -i 's/require_ssl: true/require_ssl: false/g' "$config"
        echo "[webtop] config パッチ適用: $config"
    fi
done

# ユーザー設定ファイルが存在しない場合は作成
KASMVNC_CONFIG="/config/.config/kasmvnc/kasmvnc.yaml"
if [ ! -f "$KASMVNC_CONFIG" ]; then
    mkdir -p "$(dirname "$KASMVNC_CONFIG")"
    printf 'network:\n  ssl:\n    require_ssl: false\n' > "$KASMVNC_CONFIG"
    echo "[webtop] config 作成: $KASMVNC_CONFIG"
fi

# --- Method 2: KasmVNC の JavaScript を直接パッチ ---
# "secure connection" という文字列を含む JS ファイルを検索してパッチする
# これにより window.isSecureContext のチェックを無効化できる

echo "[webtop] JavaScript ファイルを検索中..."
JS_FILES=$(find /usr /opt /app /srv /var 2>/dev/null -name "*.js" \
    | xargs grep -l "isSecureContext" 2>/dev/null)

if [ -n "$JS_FILES" ]; then
    for js_file in $JS_FILES; do
        sed -i 's/window\.isSecureContext/true/g' "$js_file"
        echo "[webtop] JS パッチ適用: $js_file"
    done
else
    echo "[webtop] WARNING: isSecureContext を含む JS ファイルが見つかりませんでした"
    echo "[webtop] 検索パス: /usr /opt /app /srv /var"
fi

echo "[webtop] 設定完了"
