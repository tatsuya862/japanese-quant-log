# 余白カレンダー / White Space Calendar 実装メモ

## 追加ページ

- `white-space-calendar.html`
- 公開用コピー: `docs/white-space-calendar.html`

## 主要ファイル

- `white-space-calendar.html`: 余白カレンダーの画面構成
- `white-space-calendar.js`: 時間計算、バリデーション、localStorage保存、自動配置、GAイベント
- `styles.css`: 既存の黒・金・セリフ体トーンに合わせたカレンダーUI

## プロトタイプ導線

- `index.html` の `Prototype Lab` に `余白カレンダー` のリンクを追加
- `index.html` の `Prototype` セクションに `White Space Calendar` カードを追加
- `docs/index.html` は `index.html` と同内容に同期

## 実装した主な機能

- 月曜から日曜までの週間カレンダー表示
- 30分単位の時間グリッド
- 固定予定、余白ボックス、自由予定ボックスの追加・削除
- 固定予定、余白、自由予定の重複チェック
- 起床・就寝時刻の範囲チェック
- 余白ボックスの2時間必須チェック
- 1日最大3ボックス制限
- 自由予定は1日最大2つまで
- 余白未確保日の警告
- 余白の自動配置
- 週次サマリー
- カテゴリ別の自由予定時間集計
- 初期状態に戻す
- localStorage保存
- GA互換イベント送信

## localStorage

- 保存キー: `quant_log_white_space_calendar_v1`
- 保存対象:
  - 固定予定ボックス
  - 余白ボックス
  - 自由予定ボックス
  - 起床時刻
  - 就寝時刻

## 制約仕様

- `余白ボックス + 自由予定ボックス = 1日最大3つ`
- 固定予定は最大3ボックス制限の対象外
- 固定予定を対象外にした理由は、会社・通勤・睡眠などをユーザーが自由に増やす予定ではなく、生活上の拘束時間として扱うため
- 余白ボックスは必ず連続2時間
- 余白ボックスは起床から就寝までの範囲内にのみ配置可能
- 余白ボックスと自由予定は、固定予定を含む既存ボックスと重複不可
- 余白がない日は未完成の日として警告表示

## 計測イベント

- `white_space_calendar_view`
- `fixed_block_add`
- `white_space_add`
- `free_block_add`
- `auto_place_white_space_click`
- `reset_white_space_calendar_click`
- `delete_block_click`
- `prototype_link_click`

## 今後の改善候補

- 月間ログ保存
- 余白スコア表示
- 副業時間の累計
- 休息時間の累計
- 週次レビューのMarkdown出力
- 詰め込みすぎ警告の高度化
- 過去ログ比較
- 月500円版への接続検証
- ライブ配信テーマ別の流入計測
- プロトタイプ別の利用率比較
