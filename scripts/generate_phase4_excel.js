import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

async function generatePhase4Excel() {
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const detailsSheet = workbook.addWorksheet('Details');

    // --- Summary Sheet ---
    summarySheet.columns = [{ width: 40 }, { width: 15 }, { width: 15 }, { width: 15 }];
    summarySheet.addRows([
        ['Phase 4 テストサマリー (ダッシュボード・監査機能)', '', '', ''],
        ['実行日', '2026-01-05', '', ''],
        ['実行者', 'Antigravity (QA Agent)', '', ''],
        [],
        ['カテゴリ', '項目数', 'Pass', 'Fail'],
        ['D-01 ダッシュボード', '1', '1', '0'],
        ['D-02 監査ログ', '2', '2', '0'],
        ['D-03 監査レポート', '1', '1', '0'],
        [],
        ['【合計】', '4', '4', '0'],
        [],
        ['【総合判定】', 'PASS']
    ]);

    // --- Details Sheet ---
    detailsSheet.columns = [
        { header: 'テストID', key: 'id', width: 10 },
        { header: '項目', key: 'item', width: 20 },
        { header: '結果', key: 'result', width: 10 },
        { header: '備考', key: 'memo', width: 40 },
        { header: '証跡画像1', key: 'img1', width: 45 },
        { header: '証跡画像2', key: 'img2', width: 45 }
    ];

    const evidenceDir = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase4\\evidence';

    const testCases = [
        { id: 'D-01', item: 'ダッシュボード', result: 'Pass', memo: '各種統計情報の表示確認。', images: ['phase4_d_01_dashboard.png'] },
        { id: 'D-02', item: '監査ログ', result: 'Pass', memo: '一覧表示およびフィルタリングの動作確認。', images: ['phase4_d_02_log_list.png', 'phase4_d_02_log_filter.png'] },
        { id: 'D-03', item: '監査レポート', result: 'Pass', memo: 'レポート一覧の表示確認。', images: ['phase4_d_03_report_list.png'] }
    ];

    let currentRow = 2;
    for (const tc of testCases) {
        const row = detailsSheet.addRow({ id: tc.id, item: tc.item, result: tc.result, memo: tc.memo });
        row.height = 180;

        for (let i = 0; i < tc.images.length; i++) {
            const imgPath = path.join(evidenceDir, tc.images[i]);
            if (fs.existsSync(imgPath)) {
                const imageId = workbook.addImage({
                    buffer: fs.readFileSync(imgPath),
                    extension: 'png',
                });
                detailsSheet.addImage(imageId, {
                    tl: { col: 4 + i, row: currentRow - 1 },
                    ext: { width: 300, height: 180 }
                });
            }
        }
        currentRow++;
    }

    const outputPath = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase4\\Phase4_TestResult.xlsx';
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Phase 4 Excel report with images generated at: ${outputPath}`);
}

generatePhase4Excel().catch(console.error);
