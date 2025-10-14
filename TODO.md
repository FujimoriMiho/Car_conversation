# 車内会話促進AIアプリ

## このWebアプリの使い方

1. Webサイトを開き、以下のユーザー情報を1人ずつ、複数人分、入力します。

- ユーザー名
- 最近ハマっていること
- 最近苦労したこと
- いま行ってみたいところ

2. 「会話を始める」ボタンをクリックします。
3. AIが音声で乗客に話しかけ、会話を盛り上げます

## アプリの技術スタック

- 小規模なアプリなので、データベースは使用しない
  - ユーザー情報はlocalStorageに保存する
- TypeScriptを使う
- AIは「OpenAIのRealtime API」を使う
  - Web RTCでクライアントとOpenAIサーバーが直接通信する
- フロントエンドはフレームワークを使わず、シンプルなHTML/CSS/JavaScriptで実装する
- バックエンドはNode.jsで実装する

## 参考サイト

- https://platform.openai.com/docs/guides/realtime-webrtc
- https://platform.openai.com/docs/guides/realtime-models-prompting
- https://platform.openai.com/docs/guides/realtime-conversations
