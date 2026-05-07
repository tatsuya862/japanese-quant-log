# 10_quant-log-jp チャットルーム用メモ

## プロジェクト概要

- 対象フォルダ: `10_quant-log-jp`
- サイト名: `QUANT LOG by Tatsuya`
- 目的: AI活用、金融マーケット観測、サービス試作、個人プロトタイプをまとめる公式サイト
- 軸: Quant Log思考をもとに、観測・分析・実行・検証を公開できる形に整理する

## 現在の主な導線

- `index.html`: トップページ
- `market.html`: Market Brief
- `register-interest.html`: 仮登録ページ
- `white-space-calendar.html`: 余白カレンダー
- `weather-brief.html`: Weather Brief
- 外部プロトタイプ:
  - Timer: `https://tatsuya862.github.io/timer_app/`
  - Wealth: `https://tatsuya862.github.io/wealth_app/`
  - Drive Study: `https://tatsuya862.github.io/prottype_audio-texts/`

## 主要ファイル

- `README.md`: リポジトリ概要
- `styles.css`: サイト全体のスタイル
- `assets/`: faviconなどの静的アセット
- `docs/`: GitHub Pages公開用コピー
- `WHITE_SPACE_CALENDAR.md`: 余白カレンダー実装メモ
- `weather-brief.js`: Weather Briefの処理
- `white-space-calendar.js`: 余白カレンダーの処理

## 作業時の基本方針

- 変更は依頼された範囲だけに限定する
- 既存の黒・金・セリフ体トーンを維持する
- トップページの導線を変える場合は、`index.html` と `docs/index.html` の同期を意識する
- 公開ページを変える場合は、原則としてルート側ファイルと `docs/` 側コピーの差分を確認する
- Analyticsタグ、favicon、既存リンクは不要に触らない
- 文章は説明過多にせず、サイト上ではサービスやプロトタイプそのものが先に見える構成を優先する

## 注意点

- `docs/` 配下は公開用コピーとして使われているため、ルート側だけを直すと公開版に反映されない可能性がある
- `white-space-calendar.html` と `weather-brief.html` はトップページのPrototype導線から参照されている
- `styles.css` は複数ページで共有されているため、単一ページ向けの変更でも影響範囲を確認する
- Market Snapshotの数値は日付付きの静的表示になっているため、更新時は日付と数値の整合性を確認する

## 次回チャット開始時に確認すること

- 今回の依頼がサイト本体、公開用 `docs/`、プロトタイプ単体、メモ整理のどれに該当するか
- 変更対象ファイルが明示されているか
- 公開反映まで必要か、ローカル編集だけでよいか
- Git操作やコミットまで求められているか
