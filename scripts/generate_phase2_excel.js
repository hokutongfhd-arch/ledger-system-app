import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

async function generatePhase2Excel() {
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const detailsSheet = workbook.addWorksheet('Details');

    // --- Summary Sheet ---
    summarySheet.columns = [{ width: 40 }, { width: 15 }, { width: 15 }, { width: 15 }];
    summarySheet.addRows([
        ['Phase 2 テストサマリー (マスタ管理)', '', '', ''],
        ['実行日', '2026-01-05', '', ''],
        ['実行者', 'Antigravity (QA Agent)', '', ''],
        [],
        ['カテゴリ', '項目数', 'Pass', 'Fail'],
        ['B-01 社員マスタ', '3', '3', '0'],
        ['B-02 拠点マスタ', '3', '3', '0'],
        ['B-03 住所マスタ', '3', '3', '0'],
        [],
        ['【合計】', '9', '9', '0'],
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
        { header: '証跡画像2', key: 'img2', width: 45 },
        { header: '証跡画像3', key: 'img3', width: 45 }
    ];

    const evidenceDir = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase2\\evidence';

    const testCases = [
        { id: 'B-01', item: '社員マスタ', result: 'Pass', memo: '一覧、検索、詳細表示の正常動作。', images: ['Phase2_B-01_list_1767593796271.png', 'Phase2_B-01_search_1767593942971.png', 'Phase2_B-01_detail_1767593963562.png'] },
        { id: 'B-02', item: '拠点マスタ', result: 'Pass', memo: '一覧、検索、詳細表示の正常動作。', images: ['Phase2_B-02_list_1767594025460.png', 'Phase2_B-02_search_1767594066229.png', 'Phase2_B-02_detail_1767594113642.png'] },
        { id: 'B-03', item: '住所マスタ', result: 'Pass', memo: '一覧、検索、詳細表示の正常動作。', images: ['Phase2_B-03_list_1767594214345.png', 'Phase2_B-03_search_1767594258794.png', 'Phase2_B-03_detail_1767594288908.png'] }
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

    const outputPath = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase2\\Phase2_TestResult.xlsx';
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Phase 2 Excel report with images generated at: ${outputPath}`);
}

generatePhase2Excel().catch(console.error);
