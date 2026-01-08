# コンポーネントリファクタリング Phase 2 仕様書: UIコンポーネントの共通化と標準化

## 目的
各機能（Features）のフォームや画面で散在・重複しているUI実装を共通コンポーネントとして切り出し、`src/components/ui` 配下に集約する。
これにより、UIの一貫性を担保し、コードの記述量を削減するとともに、将来的なデザイン変更への耐性を高める。

## 現状の課題
- 各フォーム（`AddressForm`, `EmployeeForm`, `DeviceForms`等）で、`<input>`, `<select>`, `<textarea>` タグに毎回同じ Tailwind CSS クラス（`w-full px-3 py-2 border...`）を記述しており、保守性が低い。
- エラーメッセージの表示やラベルのスタイルが微妙に異なる箇所がある。
- `AddressForm` には独自の `AddressInputField` が定義されているが、他では使われていない。

## 変更内容

### 1. 共通UIコンポーネントの作成 (`src/components/ui`)
以下のコンポーネントを新規作成する。

| コンポーネント名 | ファイルパス | 役割 |
|:---|:---|:---|
| `Input` | `src/components/ui/Input.tsx` | 標準テキスト入力（`ref`対応、エラー状態スタイル） |
| `Select` | `src/components/ui/Select.tsx` | 標準セレクトボックス |
| `TextArea` | `src/components/ui/TextArea.tsx` | 標準テキストエリア |
| `FormLabel` | `src/components/ui/Form.tsx` | フォーム項目のラベル |
| `FormError` | `src/components/ui/Form.tsx` | 入力エラーメッセージ |
| `SectionHeader` | `src/components/ui/Section.tsx` | フォーム内のセクション見出し |

### 2. 既存フォームのリファクタリング
作成した共通コンポーネントを使用するように、以下のファイルを修正する。

- `src/features/addresses/components/AddressForm.tsx`
- `src/features/employees/components/EmployeeForm.tsx`
- `src/features/devices/components/IPhoneForm.tsx`
- `src/features/devices/components/FeaturePhoneForm.tsx`
- `src/features/devices/components/TabletForm.tsx`
- `src/features/devices/components/RouterForm.tsx`
- `src/features/areas/components/AreaForm.tsx`

### 実装イメージ

**Before:**
```tsx
<div>
    <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
    <input
        type="text"
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        value={value}
        onChange={onChange}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
</div>
```

**After:**
```tsx
<div className="space-y-1">
    <FormLabel>氏名</FormLabel>
    <Input value={value} onChange={onChange} error={!!error} />
    {error && <FormError>{error}</FormError>}
</div>
```

## 影響範囲とリスク
- **影響範囲**: 全てのマスタ登録・編集画面。
- **リスク**: スタイルの微細な変化により、レイアウト崩れが発生する可能性がある。
- **対策**:
    - コンポーネント作成時に既存のスタイルを忠実に再現する。
    - 変更後、各フォームの表示確認を行い、入力・バリデーション表示が正常か確認する。

## 手順
1. `src/components/ui` に共通コンポーネントを作成
2. 1つ目のフォーム（例: `AddressForm`）をリファクタリングして検証
3. 残りのフォームを順次リファクタリング
4. `npm run lint` およびビルドチェック
5. 動作確認
