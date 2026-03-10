/**
 * インポート完了後に呼び出して、件数分のDBトリガーログを削除し
 * 「N件 インポート」という1件のまとめログを作成する。
 *
 * @param tableName DBのテーブル名 (例: 'employees', 'areas', 'addresses', 'iphones' 等)
 * @param startTime インポート処理開始時刻の ISO 文字列
 * @param successCount 成功件数
 * @param actorName 実行者名
 * @param actorCode 実行者の社員コード
 */
export async function recordImportSummaryLog(
    tableName: string,
    startTime: string,
    successCount: number,
    actorName?: string,
    actorCode?: string
): Promise<void> {
    try {
        await fetch('/api/admin/logs/import-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableName, startTime, successCount, actorName, actorCode }),
        });
    } catch (e) {
        // ログ処理の失敗はサイレントに扱う（インポート本体の処理には影響させない）
        console.warn('Failed to record import summary log:', e);
    }
}
