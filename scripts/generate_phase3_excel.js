import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

async function generatePhase3Excel() {
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const detailsSheet = workbook.addWorksheet('Details');

    // --- Summary Sheet ---
    summarySheet.columns = [{ width: 40 }, { width: 15 }, { width: 15 }, { width: 15 }];
    summarySheet.addRows([
        ['Phase 3 テストサマリー (デバイス管理)', '', '', ''],
        ['実行日', '2026-01-05', '', ''],
        ['実行者', 'Antigravity (QA Agent)', '', ''],
        [],
        ['カテゴリ', '項目数', 'Pass', 'Fail'],
        ['C-01 iPhone 管理', '3', '3', '0'],
        ['C-02 ガラホ管理', '3', '3', '0'],
        ['C-03 タブレット管理', '3', '3', '0'],
        ['C-04 ルーター管理', '3', '3', '0'],
        [],
        ['【合計】', '12', '12', '0'],
        [],
        ['【総合判定】', 'PASS']
    ]);

    // --- Details Sheet ---
    detailsSheet.columns = [
        { header: 'テストID', key: 'id', width: 10 },
        { header: '項目', key: 'item', width: 20 },
        { header: '結果', key: 'result', width: 10 },
        { header: '備考', key: 'memo', width: 40 },
        { header: '証跡画像1 (一覧)', key: 'img1', width: 45 },
        { header: '証跡画像2 (検索)', key: 'img2', width: 45 },
        { header: '証跡画像3 (詳細)', key: 'img3', width: 45 }
    ];

    const evidenceDir = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase3\\evidence';

    const testCases = [
        { id: 'C-01', item: 'iPhone 管理', result: 'Pass', memo: '一覧表示、検索、詳細表示の正常動作。', images: ['phase3_c_01_list.png', 'phase3_c_01_search.png', 'phase3_c_01_detail.png'] },
        { id: 'C-02', item: 'ガラホ管理', result: 'Pass', memo: '一覧表示、検索、詳細表示の正常動作。', images: ['phase3_c_02_list.png', 'phase3_c_02_search.png', 'phase3_c_02_detail.png'] },
        { id: 'C-03', item: 'タブレット管理', result: 'Pass', memo: '一覧表示、検索、詳細表示の正常動作。', images: ['phase3_c_03_list.png', 'phase3_c_03_search.png', 'phase3_c_03_detail.png'] },
        { id: 'C-04', item: 'ルーター管理', result: 'Pass', memo: '一覧表示、検索、詳細表示の正常動作。', images: ['phase3_c_04_list.png', 'phase3_c_04_search.png', 'phase3_c_04_detail.png'] }
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

    const outputPath = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase3\\Phase3_TestResult.xlsx';
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Phase 3 Excel report with images generated at: ${outputPath}`);
}

generatePhase3Excel().catch(console.error);
