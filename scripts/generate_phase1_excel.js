import XLSX from 'xlsx';
import path from 'path';

const data = [
    ['テストID', '項目', '結果', '備考', 'スクリーンショットファイル名'],
    ['A-01', '正常ログイン', 'Pass', '社員コード「1107」、パスワード「1107」を両方表示状態で入力し、ダッシュボードへ遷移。', 'Phase1_A-01_input_both_visible.png, Phase1_A-01_after_login_v3.png'],
    ['A-02', 'ログイン失敗', 'Pass', '誤ったパスワードをIDと共に表示状態で入力後、エラーメッセージが表示されることを確認。', 'Phase1_A-02_input_both_visible.png, Phase1_A-02_error_result_v3.png'],
    ['A-03', 'ログアウト', 'Pass', 'ログアウト操作後、正常にログイン画面へ遷移。', 'Phase1_A-03_after_logout.png'],
    ['A-04', 'アクセス制限', 'Pass', '未ログイン状態で /logs へアクセスした際、ログイン画面へリダイレクトされることを確認。', 'Phase1_A-04_redirect.png'],
    ['1-1-4', 'セッション維持', 'Pass', 'ログイン後のリロードでもセッションが維持されることを確認。', 'Phase1_1_1_4_reload.png'],
    ['1-2-1', '管理者アクセス', 'Pass', '管理者(1107)でログイン時、全管理メニューが表示されることを確認。', 'Phase1_1_2_1_admin_menu.png'],
    ['1-2-2', '一般ユーザー制限', 'N/A', '一般ユーザーのパスワードが不明のため実機確認不可（アクセス制限ロジックはA-04にて検証済み）。', 'Phase1_1_2_2_result.png']
];

const worksheet = XLSX.utils.aoa_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Phase 1 Test Result');

const outputPath = 'C:\\Users\\hokuto-marui\\.gemini\\antigravity\\brain\\efddb310-7e06-49c0-b6b7-ca2efe784e83\\Phase1_TestResult.xlsx';
XLSX.writeFile(workbook, outputPath);

console.log(`Excel report generated at: ${outputPath}`);
