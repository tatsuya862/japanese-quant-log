# クオンツログ 簡易脆弱性評価記録

## 実施日

2026-05-16

## 対象

クオンツログウェブサイト

## 決済方式

Stripe Payment Link または Stripe Checkout

## 前提

カード情報は自社サイトで保存・処理せず、Stripeで処理する。

現時点の公開導線は静的HTML/CSS/JS中心であり、有料コンテンツ案内は当面メールによる手動運用を前提とする。

## 確認項目

- 秘密情報の公開有無
- 決済導線
- フォーム
- XSSリスク
- SQLインジェクションリスク
- 公開ディレクトリ
- セキュリティ関連ヘッダーまたは安全設定
- 依存関係
- 外部リンク
- 問い合わせ先

## 結果

| 確認項目 | 結果 | 確認内容 |
| --- | --- | --- |
| 秘密情報の公開有無 | 問題なし | 公開対象のHTML/JS/Functionsを検索し、Stripe Secret Key、実APIキー、パスワード平文、銀行口座情報、不要な個人情報が公開HTML内に含まれていないことを確認した。Stripe Secret Keyは環境変数名としてのみ記載されている。 |
| 決済導線 | 問題なし | 自社サイト内にカード番号入力フォームはなく、決済ボタンは `/api/create-checkout-session` へPOSTし、Stripe Checkout SessionのURLへ遷移する構成。成功URLは `/success.html?session_id={CHECKOUT_SESSION_ID}`、キャンセルURLは `/cancel.html` を基本とする。 |
| フォーム | 対応済み | 問い合わせページはmailto導線であり、決済・問い合わせ用の入力フォームは公開していない。公開サンプルLP内に実送信しないフォームが残っていたため、問い合わせページへのリンク表示に変更した。Weather Briefと余白カレンダーの入力欄はプロトタイプ操作用で、カード情報や個人情報を求めない。 |
| XSSリスク | 問題なし | `membership.js` は問い合わせ先や決済エラー表示に `textContent` を使用している。Weather Briefは検索文字列や取得データを直接HTMLとして挿入せず、DOM生成と `textContent` を使用している。余白カレンダーのHTML生成は選択肢・内部定義値・ローカル状態に限定され、外部入力をそのまま公開HTMLへ反映する処理は確認されなかった。 |
| SQLインジェクションリスク | 問題なし | 現在の公開サイトは静的ページ中心。`functions/[[path]].js` にD1/Auth用のSQL処理は存在するが、`prepare(...).bind(...)` によるパラメータバインドを使用しており、ユーザー入力をSQL文字列へ直接連結する処理は確認されなかった。 |
| 公開ディレクトリ | 対応済み | `.env`、`.dev.vars`、秘密鍵ファイル、`*.key`、`*.pem`、`*.p12`、バックアップファイルを検索した。公開サンプルLP内の `style.css.bak` は削除した。 |
| 管理メモの公開範囲 | 今後対応 | `CHAT_ROOM_MEMO.md` がリポジトリ直下に存在する。今回の検索では秘密情報や個人決済情報は検出されなかったが、運用メモは公開対象から外す方針が望ましい。既存の未コミット変更があるため、今回は削除・移動しない。 |
| セキュリティ関連ヘッダーまたは安全設定 | 今後対応 | Cloudflare Pages Functions側のHTMLレスポンスには `x-content-type-options`、`referrer-policy`、`x-frame-options`、`content-security-policy` が設定されている。一方、GitHub Pagesで配信される静的HTMLに対する専用ヘッダー設定はリポジトリ内では確認できなかった。 |
| 依存関係 | 該当なし | `package.json` は確認されなかったため、`npm audit` の対象はない。 |
| 外部リンク・外部スクリプト | 問題なし | 主な外部接続先はGoogle Tag Manager、YouTube、Amazon、Yahoo Finance、Investing.com、気象庁API、Stripe API、mailto問い合わせ先。未知または不審なCDNスクリプトは確認されなかった。 |
| 問い合わせ先 | 問題なし | 問い合わせ先は `quantlog.support@gmail.com` に統一されていることを検索で確認した。 |

## 発見事項

- 公開サンプルLPに、実送信処理のない問い合わせフォームが残っていた。
- 公開サンプルLP配下にバックアップCSSファイル `docs/sumple_LP/css/style.css.bak` が残っていた。
- `CHAT_ROOM_MEMO.md` がリポジトリ直下にあり、公開対象に含まれる可能性がある。
- 認証用Functionsコードは存在するが、現在の有料メンバー導線はStripe Checkoutとメール案内を中心にしている。認証機能を本格利用する場合は、別途レビューが必要。

## 実施した対応

- `docs/sumple_LP/index.html` の実送信しない問い合わせフォームを削除し、問い合わせページへのリンクに変更した。
- `docs/sumple_LP/css/style.css.bak` を削除した。
- 秘密情報、公開ディレクトリ、決済導線、フォーム、XSS、SQL、依存関係、外部リンク、問い合わせ先を確認し、本記録を作成した。

## 残課題

- `CHAT_ROOM_MEMO.md` を公開対象から外すか、非公開運用のメモ置き場へ移動する。
- GitHub Pages側で静的HTMLに適用できるセキュリティヘッダー方針を検討する。必要に応じてCloudflare Pages配信へ寄せる。
- Stripe本番運用前に、Stripe側の商品・価格・Payment LinkまたはCheckout設定、成功URL、キャンセルURL、Customer Portal設定を本番値で確認する。
- 認証機能を有効化する場合は、ログイン、メール認証、パスワード再設定、DB、メール送信を対象にした追加レビューを行う。

## 結論

現時点では、カード情報を自社サイトで保存・処理せず、Stripeの決済ページまたはStripe Checkoutを利用する構成である。サイトは静的ページ中心で、現在の有料メンバー公開導線ではユーザーログイン機能・ファイルアップロード機能を使用していない。公開前に簡易的な脆弱性評価を実施し、発見事項があれば修正する運用とする。

本記録は、侵入テストや専門事業者による脆弱性診断の実施を意味するものではなく、Stripe提出前の簡易的な確認記録である。
