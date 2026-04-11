#!/bin/bash
# KasmVNC の HTTPS 必須設定を無効化する
# Umbrel は HTTP でアプリを提供するため、HTTPS チェックを無効にする

KASMVNC_CONFIG="/config/.config/kasmvnc/kasmvnc.yaml"

mkdir -p "$(dirname "$KASMVNC_CONFIG")"

if [ -f "$KASMVNC_CONFIG" ]; then
    sed -i 's/require_ssl: true/require_ssl: false/g' "$KASMVNC_CONFIG"
else
    cat > "$KASMVNC_CONFIG" << 'EOF'
network:
  ssl:
    require_ssl: false
EOF
fi

echo "[webtop] KasmVNC HTTPS requirement disabled"
