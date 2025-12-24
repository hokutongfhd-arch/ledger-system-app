-- 毎週の日曜 00:00 に、先週以前のログを自動的にアーカイブに移行する設定
-- pg_cron エクステンションを使用します。

-- [1] 自動アーカイブ用関数の作成
CREATE OR REPLACE FUNCTION archive_past_weeks_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cutoff_time timestamptz;
BEGIN
    -- 今週の日曜日 00:00:00 を計算（この時間より前のものをアーカイブ）
    -- extract(dow from now()) は日曜日なら 0、土曜日なら 6
    cutoff_time := date_trunc('day', now() - interval '1 day' * extract(dow from now()));
    
    -- 監査ログのアーカイブ処理（ANOMALY_DETECTED は除外するか、含めるかは運用次第ですが、ここでは一括で対象にします）
    UPDATE audit_logs
    SET is_archived = true, archived_at = now()
    WHERE is_archived = false
      AND occurred_at < cutoff_time;

    -- 操作ログ（logsテーブル）のアーカイブ処理
    UPDATE logs
    SET is_archived = true, archived_at = now()
    WHERE is_archived = false
      AND occurred_at < cutoff_time;

    RAISE NOTICE 'Log archiving completed. Cutoff was %', cutoff_time;
END;
$$;

-- [2] スケジュール設定 (pg_cron)
-- ※ 'CREATE EXTENSION pg_cron' はダッシュボードの「Extensions」画面から有効化してください。
-- ※ SQLエディタからの実行でエラーが出る場合は、以下のスケジュール登録だけを行います。

-- 既存の同名ジョブがあれば削除して再登録
SELECT cron.unschedule('weekly-log-archive') FROM cron.job WHERE jobname = 'weekly-log-archive';

-- '0 0 * * 0' は毎週日曜日の 0時0分（土曜から日曜に切り替わった瞬間）
SELECT cron.schedule('weekly-log-archive', '0 0 * * 0', 'SELECT archive_past_weeks_logs()');

-- 即時確認したい場合は以下を実行：
-- SELECT archive_past_weeks_logs();
