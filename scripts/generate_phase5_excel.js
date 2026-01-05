import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

async function generatePhase5Excel() {
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const detailsSheet = workbook.addWorksheet('Details');

    // --- Summary Sheet ---
    summarySheet.columns = [{ width: 40 }, { width: 15 }, { width: 15 }, { width: 15 }];
    summarySheet.addRows([
        ['Phase 5 テストサマリー (追加機能)', '', '', ''],
        ['実行日', '2026-01-05', '', ''],
        ['実行者', 'Antigravity (QA Agent)', '', ''],
        [],
        ['カテゴリ', '項目数', 'Pass', 'Fail'],
        ['E-01 マニュアル管理', '1', '1', '0'],
        ['E-02 マイページ', '1', '1', '0'],
        ['E-03 異常検知ルール', '1', '1', '0'],
        [],
        ['【合計】', '3', '3', '0'],
        [],
        ['【総合判定】', 'PASS']
    ]);

    // --- Details Sheet ---
    detailsSheet.columns = [
        { header: 'テストID', key: 'id', width: 10 },
        { header: '項目', key: 'item', width: 20 },
        { header: '結果', key: 'result', width: 10 },
        { header: '備考', key: 'memo', width: 40 },
        { header: '証跡画像1', key: 'img1', width: 60 }
    ];

    const evidenceDir = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase5\\evidence';

    const testCases = [
        { id: 'E-01', item: 'マニュアル管理', result: 'Pass', memo: 'マニュアル一覧の正常表示。', images: ['phase5_e_01_manuals.png'] },
        { id: 'E-02', item: 'マイページ', result: 'Pass', memo: 'ユーザー情報および貸与デバイス一覧の正常表示。', images: ['phase5_e_02_mypage.png'] },
        { id: 'E-03', item: '異常検知ルール', result: 'Pass', memo: '不正検知ルール設定の正常表示。', images: ['phase5_e_03_anomaly_rules.png'] }
    ];

    let currentRow = 2;
    for (const tc of testCases) {
        const row = detailsSheet.addRow({ id: tc.id, item: tc.item, result: tc.result, memo: tc.memo });
        row.height = 250;

        for (let i = 0; i < tc.images.length; i++) {
            const imgPath = path.join(evidenceDir, tc.images[i]);
            if (fs.existsSync(imgPath)) {
                const imageId = workbook.addImage({
                    buffer: fs.readFileSync(imgPath),
                    extension: 'png',
                });
                detailsSheet.addImage(imageId, {
                    tl: { col: 4 + i, row: currentRow - 1 },
                    ext: { width: 444, height: 250 }
                });
            }
        }
        currentRow++;
    }

    const outputPath = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase5\\Phase5_TestResult.xlsx';
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Phase 5 Excel report with images generated at: ${outputPath}`);
}

generatePhase5Excel().catch(console.error);
