# 🚀 SpeedTest Monitor - 自宅サーバ向け回線速度監視ツール

## プロジェクト概要

自宅のUmbrelOSサーバ上で24時間稼働し、インターネットの**アップロード・ダウンロード速度を定期測定**してグラフで可視化するWebアプリ。

---

## 技術スタック

| レイヤー | 採用技術 |
|----------|----------|
| バックエンド | Python 3.11 + FastAPI |
| 測定ライブラリ | `speedtest-cli` (speedtest-cli PyPI package) |
| データベース | SQLite（`/data/speedtest.db`） |
| スケジューラ | APScheduler（FastAPIに組み込み） |
| フロントエンド | Vanilla HTML/CSS/JS（Chart.js使用、外部CDN） |
| コンテナ | Docker + docker-compose |
| デプロイ先 | UmbrelOS（Umbrel App Store形式） |

---

## 機能要件

### 測定
- **測定間隔**: 15分ごとに自動実行（APSchedulerのIntervalTrigger）
- **測定項目**: ダウンロード速度（Mbps）、アップロード速度（Mbps）、ping（ms）
- **保存期間**: 1ヶ月分（31日経過したレコードは自動削除）
- 測定失敗時はエラーをログに記録してスキップ（サーバ停止させない）

### API（FastAPI）

```
GET  /api/results          # 直近の測定結果一覧（クエリパラメータ: hours=24など）
GET  /api/results/latest   # 最新1件
GET  /api/stats            # 平均・最大・最小の統計情報
GET  /health               # ヘルスチェック用
GET  /                     # フロントエンドHTML配信
```

### フロントエンド
- Chart.jsを使った時系列折れ線グラフ（DL・UL・ping を同一画面に表示）
- 表示期間の切り替えUI（過去6時間 / 24時間 / 7日 / 31日）
- 最新の測定値をカード形式で表示
- 自動リフレッシュ（5分ごと）
- レスポンシブデザイン（スマートフォン対応、Android Chromeで見やすく）

---

## ディレクトリ構成

```
shun-speedtest-graph/
├── umbrel-app.yml          # Umbrel App Store用マニフェスト
├── docker-compose.yml      # Umbrel用compose（umbrel-app.ymlから参照）
├── docker-compose.dev.yml  # ローカル開発用compose
├── Dockerfile
├── icon.png
├── app/
│   ├── main.py             # FastAPIエントリポイント、APScheduler初期化
│   ├── scheduler.py        # 測定ジョブの定義
│   ├── database.py         # SQLite接続・マイグレーション・CRUD
│   ├── models.py           # SQLAlchemyモデル or dataclass定義
│   ├── routers/
│   │   └── results.py      # /api/* エンドポイント
│   └── static/
│       ├── index.html
│       ├── style.css
│       └── app.js
├── data/                   # SQLiteファイル置き場（Dockerボリュームマウント）
│   └── .gitkeep
├── requirements.txt
└── README.md
```

---

## Umbrel App Store形式の要件

### `umbrel-app.yml` の必須フィールド

```yaml
manifestVersion: 1
id: shun-speedtest-graph       # App Store ID "shun" を接頭辞に持たせる
name: SpeedTest Monitor
tagline: 回線速度を自動測定・グラフ表示
icon: https://raw.githubusercontent.com/shunnishi84/umbrel-community-app-store/main/shun-speedtest-graph/icon.png
category: networking
version: "1.0.0"
port: 3842                     # Umbrelが外部に公開するポート（他アプリと被らない番号を選ぶ）
description: >
  15分ごとにインターネット速度を自動測定し、
  ダウンロード・アップロード・pingをグラフで可視化します。
developer: shunnishi84
website: https://github.com/shunnishi84/umbrel-community-app-store/tree/main/shun-speedtest-graph
dependencies: []
repo: https://github.com/shunnishi84/umbrel-community-app-store
support: https://github.com/shunnishi84/umbrel-community-app-store/issues
gallery: []
releaseNotes: "初回リリース"
```

### `docker-compose.yml`（Umbrel向け）

```yaml
services:
  app:
    image: ghcr.io/shunnishi84/shun-speedtest-graph:1.0.0
    build: .                      # レジストリ未公開でも Umbrel 上で初回ビルド可能
    restart: unless-stopped
    ports:
      - "${APP_PORT}:8000"          # Umbrelが環境変数でポートを渡す
    volumes:
      - "${APP_DATA_DIR}/data:/data" # Umbrelが永続ボリュームのパスを渡す
    environment:
      - DATABASE_PATH=/data/speedtest.db
      - MEASUREMENT_INTERVAL_MINUTES=15
      - RETENTION_DAYS=31
```

> **Note**: Umbrel環境では `APP_PORT` と `APP_DATA_DIR` は自動的に環境変数として渡される。ハードコードしないこと。

---

## データベーススキーマ

```sql
CREATE TABLE IF NOT EXISTS speed_results (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    measured_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    download_mbps REAL NOT NULL,
    upload_mbps   REAL NOT NULL,
    ping_ms       REAL NOT NULL,
    server_name   TEXT,
    error         TEXT    -- 測定失敗時のメッセージ（NULLなら成功）
);

CREATE INDEX IF NOT EXISTS idx_measured_at ON speed_results(measured_at);
```

---

## 実装の注意点

### speedtest-cli の使い方

```python
import speedtest

def run_speedtest() -> dict:
    st = speedtest.Speedtest()
    st.get_best_server()
    st.download()
    st.upload()
    result = st.results.dict()
    return {
        "download_mbps": result["download"] / 1_000_000,
        "upload_mbps":   result["upload"]   / 1_000_000,
        "ping_ms":       result["ping"],
        "server_name":   result["server"]["name"],
    }
```

### APScheduler の組み込み方

- `lifespan` を使ってFastAPI起動時にスケジューラをスタート・シャットダウン時にストップ
- `IntervalTrigger(minutes=15)` で15分間隔
- 起動直後に1回即時実行する（初回データがすぐ見えるように）

### データの自動削除

- 測定ジョブ実行のたびに `measured_at < now() - 31days` のレコードをDELETE

### Dockerfile

- ベースイメージ: `python:3.11-slim`
- `speedtest-cli` はネットワークアクセスが必要なのでビルド時テストは行わない
- `requirements.txt` で依存を固定（バージョンピン留め必須）

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## ローカル開発・テスト手順

```bash
# 開発用起動（docker-compose.dev.yml使用）
docker compose -f docker-compose.dev.yml up --build

# ブラウザで確認
open http://localhost:8000

# ログ確認
docker compose logs -f
```

---

## 完成イメージ・UI仕様

- **ヘッダー**: アプリ名 + 最終測定時刻
- **カード行**: 最新DL速度 / UL速度 / ping を大きな数字で表示
- **グラフエリア**: Chart.jsの折れ線グラフ、X軸=時刻、Y軸=速度(Mbps) / ping(ms)は右軸
- **期間タブ**: 6h / 24h / 7d / 31d の切り替えボタン
- **カラースキーム**: ダーク系（UmbrelのUIに馴染む黒・紺ベース）

---

## 優先実装順序

1. `database.py` - DBセットアップとCRUD
2. `scheduler.py` - 測定ジョブ（speedtest-cli呼び出し）
3. `main.py` - FastAPI + APScheduler lifespan 組み込み
4. `routers/results.py` - APIエンドポイント
5. `static/` - フロントエンド（HTML/CSS/JS + Chart.js）
6. `Dockerfile` + `docker-compose.yml`
7. `umbrel-app.yml` - Umbrelマニフェスト
8. 動作確認 → README.md 作成

---

## 参考リンク

- [Umbrel App Store 公式ガイド](https://github.com/getumbrel/umbrel-apps)
- [speedtest-cli PyPI](https://pypi.org/project/speedtest-cli/)
- [APScheduler ドキュメント](https://apscheduler.readthedocs.io/)
- [Chart.js ドキュメント](https://www.chartjs.org/docs/)
- [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/)