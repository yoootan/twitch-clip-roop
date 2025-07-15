# Twitch Clip Loop

お気に入りの配信者のTwitchクリップをループ再生できるウェブアプリケーションです。

## 機能

- 配信者IDで検索してクリップを取得
- 複数のフィルター機能（時間順、視聴回数順、期間指定）
- クリップの自動ループ再生
- 独自実装の一時停止・音量調整機能
- 日本語・英語の言語切り替え
- Google Analytics統合

## 技術スタック

- React 19 + TypeScript
- Vite
- Styled Components
- Axios
- Twitch API

## 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build
```

## 環境変数

以下の環境変数を設定してください：

```
VITE_TWITCH_CLIENT_ID=your_twitch_client_id
VITE_TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

## ライセンス

MIT License
