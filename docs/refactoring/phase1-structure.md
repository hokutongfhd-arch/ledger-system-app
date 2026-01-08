# フォルダ構成整理 Phase 1 仕様書: 機能単位への集約

## 目的
本システム内のフォルダ構成を整理し、保守性と可読性を向上させる。「機能（Feature）ごと」のディレクトリ構成を徹底し、散乱しているコンポーネント、フォーム、フックを適切な機能ディレクトリ配下に配置する。

## 現状の課題
- `src/features/forms` に全機能のフォームが混在している。
- `src/features/components` に特定機能に依存するコンポーネントが混在している。
- `src/components/features` という `src/features` と似た役割のディレクトリが存在し、役割分担が曖昧である。
- `src/features/hooks` に特定機能のフックが混在している。

## 変更内容
以下の通り、ファイルを移動する。システム等の論理的な変更は行わず、ファイルパスの変更とそれに伴うimportパスの修正のみを行う。

### 1. フォームの移動 (`src/features/forms` -> `src/features/*/components`)

| 移動元ファイル | 移動先ファイル | 備考 |
|:---|:---|:---|
| `src/features/forms/AddressForm.tsx` | `src/features/addresses/components/AddressForm.tsx` | |
| `src/features/forms/AreaForm.tsx` | `src/features/areas/components/AreaForm.tsx` | |
| `src/features/forms/EmployeeForm.tsx` | `src/features/employees/components/EmployeeForm.tsx` | |
| `src/features/forms/FeaturePhoneForm.tsx` | `src/features/devices/components/FeaturePhoneForm.tsx` | |
| `src/features/forms/IPhoneForm.tsx` | `src/features/devices/components/IPhoneForm.tsx` | |
| `src/features/forms/RouterForm.tsx` | `src/features/devices/components/RouterForm.tsx` | |
| `src/features/forms/TabletForm.tsx` | `src/features/devices/components/TabletForm.tsx` | |

### 2. 機能コンポーネントの移動 (`src/features/components` -> `src/features/*/components`)

| 移動元ファイル | 移動先ファイル | 備考 |
|:---|:---|:---|
| `src/features/components/AddressDeviceList.tsx` | `src/features/addresses/components/AddressDeviceList.tsx` | |
| `src/features/components/MemoPad.tsx` | `src/features/dashboard/components/MemoPad.tsx` | ダッシュボード機能の一部として配置 |
| `src/features/components/UserDeviceList.tsx` | `src/features/employees/components/UserDeviceList.tsx` | 従業員に関連するデバイス一覧のため |
| `src/features/components/UserProfileCard.tsx` | `src/features/employees/components/UserProfileCard.tsx` | 従業員情報の表示のため |

### 3. グローバルコンポーネントの移動 (`src/components/features` -> `src/features/*/components`)

| 移動元ファイル | 移動先ファイル | 備考 |
|:---|:---|:---|
| `src/components/features/audit/ReportGenerationModal.tsx` | `src/features/audit/components/ReportGenerationModal.tsx` | |
| `src/components/features/logs/AnomalyResponseModal.tsx` | `src/features/logs/components/AnomalyResponseModal.tsx` | |
| `src/components/features/logs/LogDetailModal.tsx` | `src/features/logs/components/LogDetailModal.tsx` | |
| `src/components/features/logs/LogFilter.tsx` | `src/features/logs/components/LogFilter.tsx` | |
| `src/components/features/logs/OperationLogDetailModal.tsx` | `src/features/logs/components/OperationLogDetailModal.tsx` | |
| `src/components/features/logs/OperationLogFilter.tsx` | `src/features/logs/components/OperationLogFilter.tsx` | |

### 4. フックの移動 (`src/features/hooks` -> `src/features/*/hooks`)

| 移動元ファイル | 移動先ファイル | 備考 |
|:---|:---|:---|
| `src/features/hooks/useMemos.ts` | `src/features/dashboard/hooks/useMemos.ts` | |
| `src/features/hooks/useSystemAlerts.ts` | `src/features/notifications/hooks/useSystemAlerts.ts` | 通知・アラート機能の一部として配置 |

### 5. ディレクトリの削除
移動完了後、以下の空になったディレクトリを削除する。
- `src/features/forms`
- `src/features/components`
- `src/components/features`
- `src/features/hooks`

## 影響範囲とリスク
- **Importパスの変更**: 多くのファイルで `import ... from ...` のパス修正が必要となる。
- **リスク**: パス修正漏れによるビルドエラー。
- **対策**: 移動後、ビルドコマンド (`npm run build`) を実行し、全ファイルのエラーチェックを行う。また、主要画面（マスタ管理、デバイス管理、ダッシュボード、ログ）の表示確認を行う。

## 手順
1. 仕様書の確認と承認
2. ファイルの移動実施
3. 参照箇所のパス一括置換・修正
4. `npm run build` による検証
5. `npm run dev` による動作確認
6. Phase 1 完了報告
