# Copilot Instructions

## このリポジトリについて

このリポジトリは [Umbrel](https://umbrel.com/) のコミュニティアプリストアです。
各ディレクトリが1つのアプリに対応しており、`umbrel-app.yml` と `docker-compose.yml` を中心に構成されています。

## レビュー言語

コードレビューおよびコメントは **日本語** で行うこと。

## レビュー観点

### 1. UmbrelOS アプリとして動作するか確認する

以下の点を必ずチェックすること。

- `docker-compose.yml` に `app_proxy` サービスが定義されており、`APP_HOST` と `APP_PORT` が正しく設定されているか
  - `APP_HOST` の形式: `<app-id>_<service-name>_1`
- `ports:` による直接ポートマッピングを使用していないか（Umbrel は `app_proxy` 経由でルーティングする）
- `umbrel-app.yml` の必須フィールド（`id`, `name`, `version`, `port`, `category` など）がすべて埋まっているか
- `icon` の URL が正しく公開されているか
- `volumes` のパスが `${APP_DATA_DIR}` を使って正しくマウントされているか
- イメージがパブリックなコンテナレジストリ（GHCR, Docker Hub など）に存在するか

### 2. ポートの重複がないか確認する

**他のアプリディレクトリの `umbrel-app.yml` と比較して、`port` の値が重複していないことを確認すること。**

現在使用中のポート一覧:

| アプリ ID | ポート |
|---|---|
| sparkles-hello-world | 4000 |
| shun-speedtest-graph | 3842 |

> 新しいアプリを追加する際は、上記テーブルを更新し、既存のすべてのアプリと被らないポート番号を選ぶこと。
