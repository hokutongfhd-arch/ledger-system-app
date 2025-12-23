# Ledger System 運用ガイド

このドキュメントでは、Ledger System の運用・保守に関する重要な手順と仕様を記載します。

## 1. 環境変数の設定

本番運用にあたり、以下の環境変数を `.env` または Vercel/Supabase の環境変数設定に追加してください。

| 変数名 | 説明 | 必須 | 備考 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role キー | ⚠️ | Cronジョブからのレポート送信(RLS回避)に必要 |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | ⚠️ | 監査アラート・レポート通知に必要 |
| `CRON_SECRET` | Cron 実行保護用シークレット | ✅ | 外部からの不正なCron実行を防ぐため |

## 2. 自動化ジョブ (Cron) の管理

本システムでは、PostgreSQL の拡張機能 `pg_cron` を使用して定期ジョブを実行します。

### ジョブ一覧

| ジョブ名 | スケジュール (UTC) | JST換算 | 実行内容 |
|---|---|---|---|
| `daily-audit-report` | `0 0 * * *` | 毎日 09:00 | 日次監査レポート(`audit_reports`)の作成 |
| `monthly-log-cleanup` | `0 3 1 * *` | 毎月1日 12:00 | **(任意)** 古いログの削除 (デフォルトでは無効化) |

### Cron の設定確認・変更

Cron ジョブの状態は Supabase の SQL Editor で以下のコマンドを実行して確認できます。

```sql
select * from cron.job;
```

**手動実行 (テスト)**:
```sql
-- 日次レポートの手動生成 (昨日の日付で作成)
select generate_daily_audit_report(current_date - interval '1 day');
```

**Slack 通知APIの手動トリガー**:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" <APP_URL>/api/cron/send-daily-report
```

## 3. 監査ログとレポート

### 監査ログ (`audit_logs`)
- ユーザーの操作（ログイン、マスタ更新、削除など）を記録します。
- **異常検知**: 短時間の連続ログイン失敗や時間外アクセスなどは `ANOMALY_DETECTED` として記録され、Slack 通知されます。

### 監査レポート (`audit_reports`)
- 毎日自動集計され、管理画面 (`/audit/reports`) で確認できます。
- **Slack 通知**: 毎朝、前日のサマリが Slack に送信されます。

## 4. データ保全と削除ポリシー

長期運用によるデータ肥大化を防ぐため、`cleanup_old_audit_logs` 関数が用意されています。

- **標準動作**: 指定日数（デフォルト90日）より古いログを削除します。
- **例外**: `ANOMALY_DETECTED` (異常検知) ログは削除されず、永続的に保持されます。
- **実行方法**:
  - `scripts/migration/09_cleanup_logs.sql` の cron設定を有効化する。
  - または、手動で `select cleanup_old_audit_logs(90);` を実行する。

## 5. 権限管理

現在は以下の2種類の権限が存在します。

1. **Admin (管理者)**: 全機能、全マスタの編集・削除、監査ログ閲覧が可能。
2. **User (一般)**: 自身の割り当てデバイスの閲覧、一部マスタの参照のみ。

将来的に `Operator` (運用担当者) などのロールを追加する場合は、`src/lib/types/index.ts` の `Role` 型定義および DB の `profiles` テーブルを拡張してください。
