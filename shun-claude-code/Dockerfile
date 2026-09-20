FROM node:22-bookworm-slim

# ビルド時点の最新安定版は https://go.dev/dl/ で確認して、必要ならここを書き換える
ARG GO_VERSION=1.26.1

# 一部の環境ではAWS/GitHub等の外部ダウンロード中にTLS接続がまれに
# "Connection reset by peer" で切れることがあるため、curlは自動リトライさせる
ENV CURL_RETRY_OPTS="--retry 5 --retry-all-errors --retry-delay 3"

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        openssh-client \
        tmux \
        vim \
        less \
        python3 \
        python3-pip \
        python3-venv \
        build-essential \
        unzip \
        gnupg \
    && rm -rf /var/lib/apt/lists/*

# ttyd はDebianの公式リポジトリに存在しないため、公式GitHub Releasesの
# 静的バイナリ（amd64）を直接導入する
ARG TTYD_VERSION=1.7.7
RUN curl -fsSL $CURL_RETRY_OPTS "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64" -o /usr/local/bin/ttyd \
    && chmod +x /usr/local/bin/ttyd

# GitHub CLI (gh) を公式aptリポジトリから導入
RUN curl -fsSL $CURL_RETRY_OPTS https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# AWS CLI v2 を公式インストーラーから導入（N100はamd64なのでこの版でOK）
RUN curl -fsSL $CURL_RETRY_OPTS "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip \
    && unzip -q /tmp/awscliv2.zip -d /tmp \
    && /tmp/aws/install \
    && rm -rf /tmp/awscliv2.zip /tmp/aws

# Go を公式tarballから導入
RUN curl -fsSL $CURL_RETRY_OPTS "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -o /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz
ENV PATH="/usr/local/go/bin:/root/go/bin:${PATH}"

# Claude Code CLI と TypeScript ツールチェーン
RUN npm install -g @anthropic-ai/claude-code typescript ts-node

WORKDIR /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY claude-rc-loop.sh /usr/local/bin/claude-rc-loop.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/claude-rc-loop.sh

# /root/.claude はホストにバインドマウントされ永続化されるため、ここに直接
# COPYしても初回起動後は無効になる。entrypoint.sh側で「まだ無ければ配置する」
# 処理をするための雛形として、マウントの影響を受けない場所に置いておく
COPY CLAUDE.md.default /usr/local/share/claude-code-container/CLAUDE.md.default

EXPOSE 7681

CMD ["/usr/local/bin/entrypoint.sh"]
