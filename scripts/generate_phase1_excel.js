import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

async function generatePhase1Excel() {
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const detailsSheet = workbook.addWorksheet('Details');

    // --- Summary Sheet ---
    summarySheet.columns = [{ width: 30 }, { width: 40 }];
    summarySheet.addRows([
        ['Phase 1 テストサマリー', ''],
        ['実行日', '2026-01-05'],
        ['実行者', 'Antigravity (QA Agent)'],
        [],
        ['カテゴリ', '結果'],
        ['A-01 正常ログイン', 'Pass'],
        ['A-02 ログイン失敗', 'Pass'],
        ['A-03 ログアウト', 'Pass'],
        ['A-04 アクセス制限', 'Pass'],
        ['1-1-4 セッション維持', 'Pass'],
        ['1-2-1 管理者アクセス', 'Pass'],
        ['1-2-2 一般ユーザー制限', 'N/A'],
        [],
        ['【総合判定】', 'PASS']
    ]);

    // --- Details Sheet ---
    detailsSheet.columns = [
        { header: 'テストID', key: 'id', width: 10 },
        { header: '項目', key: 'item', width: 20 },
        { header: '結果', key: 'result', width: 10 },
        { header: '備考', key: 'memo', width: 40 },
        { header: '証跡画像', key: 'image', width: 50 }
    ];

    const evidenceDir = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase1\\evidence';

    const testCases = [
        { id: 'A-01', item: '正常ログイン', result: 'Pass', memo: 'ID・パスワード両表示状態でログイン成功。', images: ['phase1_a_01_input_both_visible_1767592853276.png', 'phase1_a_01_after_login_v3_1767592875386.png'] },
        { id: 'A-02', item: 'ログイン失敗', result: 'Pass', memo: 'ID・誤パスワード表示状態でエラー出力を確認。', images: ['phase1_a_02_input_both_visible_1767592942610.png', 'phase1_a_02_error_result_v3_1767592958796.png'] },
        { id: 'A-03', item: 'ログアウト', result: 'Pass', memo: '正常にログイン画面へ遷移。', images: ['phase1_a_03_after_logout_1767592216539.png'] },
        { id: 'A-04', item: 'アクセス制限', result: 'Pass', memo: '未ログイン時のリダイレクトを確認。', images: ['phase1_a_04_redirect_1767592235776.png'] },
        { id: '1-1-4', item: 'セッション維持', result: 'Pass', memo: 'リロード後の自動ログイン維持を確認。', images: ['phase1_1_1_4_reload_1767592314308.png'] },
        { id: '1-2-1', item: '管理者アクセス', result: 'Pass', memo: '管理者メニューの視認を確認。', images: ['phase1_1_2_1_admin_menu_1767592326888.png'] },
        { id: '1-2-2', item: '一般ユーザー制限', result: 'N/A', memo: '認証情報不足のため実機確認不可。', images: ['phase1_1_2_2_result_1767591694202.png'] }
    ];

    let currentRow = 2; // header is row 1
    for (const tc of testCases) {
        const row = detailsSheet.addRow({ id: tc.id, item: tc.item, result: tc.result, memo: tc.memo });
        row.height = 180; // Make room for images

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
                // Ensure column width for multiple images
                if (detailsSheet.getColumn(5 + i).width < 45) {
                    detailsSheet.getColumn(5 + i).width = 45;
                }
            }
        }
        currentRow++;
    }

    const outputPath = 'C:\\Users\\hokuto-marui\\ledger-system-app\\docs\\test-reports\\phase1\\Phase1_TestResult.xlsx';
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Phase 1 Excel report with images generated at: ${outputPath}`);
}

generatePhase1Excel().catch(console.error);
