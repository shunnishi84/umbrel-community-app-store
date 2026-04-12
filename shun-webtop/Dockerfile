FROM lscr.io/linuxserver/webtop:ubuntu-mate

# KasmVNC の JavaScript を直接パッチして HTTP アクセスを許可する
#
# Umbrel は HTTP でアプリを提供するが、KasmVNC の JavaScript は
# window.isSecureContext (HTTPS でのみ true) をチェックしてエラーを表示する。
# ビルド時にこのチェック箇所を書き換えることで HTTP でも動作させる。

RUN set -x \
    # isSecureContext を含む JS ファイルを検索してパッチ
    && JS_FILES=$(find /usr /opt /app -name "*.js" 2>/dev/null \
        | xargs grep -l "isSecureContext" 2>/dev/null) \
    && if [ -n "$JS_FILES" ]; then \
        echo "--- Patching JS files ---"; \
        echo "$JS_FILES" | while read f; do \
            sed -i 's/window\.isSecureContext/true/g' "$f" \
            && echo "Patched: $f"; \
        done; \
    else \
        echo "WARNING: isSecureContext not found in /usr /opt /app"; \
        echo "Searching entire filesystem..."; \
        find / -name "*.js" -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null \
            | xargs grep -l "isSecureContext" 2>/dev/null \
            | while read f; do \
                sed -i 's/window\.isSecureContext/true/g' "$f" \
                && echo "Patched: $f"; \
            done; \
    fi \
    # kasmvnc.yaml のデフォルト設定も require_ssl: false にする
    && mkdir -p /defaults/.config/kasmvnc \
    && printf 'network:\n  ssl:\n    require_ssl: false\n' \
        > /defaults/.config/kasmvnc/kasmvnc.yaml
