# 🚀 SpeedTest Monitor

自宅サーバ（UmbrelOS）向けの回線速度監視Webアプリ。15分ごとにインターネットのDL/UL/pingを自動測定し、Chart.jsでグラフ表示します。

## 機能

- 15分ごとに`speedtest-cli`で自動測定（APScheduler）
- SQLiteに保存（31日で自動削除）
- FastAPI製のREST API
- Chart.jsによる時系列グラフ（6h / 24h / 7d / 31d 切替）
- ダークテーマ、スマホ対応

## ローカル開発

```bash
docker compose -f docker-compose.dev.yml up --build
open http://localhost:8000
```

## API

| Method | Path | 説明 |
|---|---|---|
| GET | `/` | フロントエンドHTML |
| GET | `/health` | ヘルスチェック |
| GET | `/api/results?hours=24` | 指定時間分の測定結果 |
| GET | `/api/results/latest` | 最新1件 |
| GET | `/api/stats?hours=24` | 平均・最大・最小の統計 |

## 環境変数

| 変数 | デフォルト | 説明 |
|---|---|---|
| `DATABASE_PATH` | `/data/speedtest.db` | SQLiteファイルパス |
| `MEASUREMENT_INTERVAL_MINUTES` | `15` | 測定間隔（分） |
| `RETENTION_DAYS` | `31` | データ保持日数 |

## UmbrelOSへのデプロイ

1. このリポジトリを Community App Store として Umbrel に追加
2. `shun-speedtest-graph` をインストール
3. 初回起動時は `docker-compose.yml` の `build: .` によりローカルビルド、将来的に `ghcr.io/shunnishi84/shun-speedtest-graph:1.0.0` を publish すれば pull 運用も可能

Umbrelは `APP_PORT` と `APP_DATA_DIR` を環境変数で渡してくるので、`docker-compose.yml` 側ではハードコードしていません。アイコンは [icon.png](icon.png) を GitHub raw URL で参照します。

## ディレクトリ構成

```
shun-speedtest-graph/
├── umbrel-app.yml
├── docker-compose.yml
├── docker-compose.dev.yml
├── Dockerfile
├── icon.png
├── requirements.txt
├── app/
│   ├── main.py
│   ├── scheduler.py
│   ├── database.py
│   ├── models.py
│   ├── routers/results.py
│   └── static/{index.html,style.css,app.js}
└── data/
```
