# Ledger System Application Guide

このプロジェクトは、社内の台帳管理、機器管理、マスタ管理を行うためのWebアプリケーションです。

## プロジェクト構造と主要ファイル

システムを理解するための地図として、主要なディレクトリとファイルの役割を以下にまとめました。

### 1. アプリケーションの全体像
*   **`src/App.tsx`**:
    *   **役割**: アプリケーションのルーティング（画面遷移）定義ファイルです。
    *   **見方**: どのURLがどのコンポーネントを表示するかを確認したい場合はここを見ます。`ProtectedRoute`などもここで設定されています。
*   **`src/main.tsx`**:
    *   **役割**: アプリケーションのエントリーポイント。ReactをDOMにマウントしています。
*   **`tailwind.config.js`**:
    *   **役割**: デザインシステム（色、フォント、スペーシング）の設定ファイル。
    *   **見方**: アプリ全体で使用できる色（`bg-paper`, `text-ink`など）やフォント定義を確認できます。

### 2. 画面・ページ (`src/app`)
各画面のメインコンポーネントはここにあります。

*   **`src/app/devices/`**: **機器一覧画面**
    *   `IPhoneList.tsx`, `TabletList.tsx` など、各デバイスごとの一覧画面です。
*   **`src/app/masters/`**: **マスタ管理画面**
    *   `EmployeeList.tsx` (社員), `AreaList.tsx` (エリア), `AddressList.tsx` (住所) の一覧・管理画面です。
*   **`src/app/DeviceManualList.tsx`**: **機器一覧（マニュアル）画面**
    *   マニュアルファイルのアップロード・ダウンロード機能を持つ画面です。
*   **`src/app/LogList.tsx`**: **ログ管理画面**
    *   システム操作ログの閲覧画面です。アーカイブ機能や期間フィルタがあります。
*   **`src/app/Dashboard.tsx`**: **管理者ダッシュボード**
*   **`src/app/UserDashboard.tsx`**: **一般ユーザー向けダッシュボード**

### 3. ビジネスロジック・機能 (`src/features`)
画面表示以外のロジックや、特定の機能に紐づくコンポーネントです。

*   **`src/features/context/`**: **状態管理**
    *   `AuthContext.tsx`: ログインユーザー情報や認証状態を管理します。
    *   `DataContext.tsx`: 社員データ、機器データなどのマスタデータを一元管理し、CRUD操作（追加・更新・削除）の関数を提供します。データの流れを追う場合はここが重要です。
*   **`src/features/forms/`**: **入力フォーム**
    *   `EmployeeForm.tsx` や `TabletForm.tsx` など、モーダル内で表示される登録・編集用フォームです。
*   **`src/features/components/`**: **機能固有コンポーネント**
    *   `AddressDeviceList.tsx`: 住所詳細画面で表示される、その住所に紐づく機器リストなど、特定の機能で使う部品です。

### 4. 共通UIコンポーネント (`src/components`)
アプリ全体で使い回される汎用的な部品です。

*   **`src/components/ui/`**:
    *   `Table.tsx`: 一覧画面で使われる共通テーブルコンポーネント。
    *   `Modal.tsx`: ポップアップモーダルの共通枠。
    *   `PageHeader.tsx`: 各画面のタイトル部分。
    *   `ActionButton.tsx`: 共通のボタンスタイル。
*   **`src/components/layout/`**:
    *   `Layout.tsx`: サイドバーやヘッダーを含む、ログイン後のアプリ全体のレイアウト枠です。

### 5. インフラ・型定義 (`src/lib`)
*   **`src/lib/supabaseClient.ts`**: Supabase（バックエンドDB/Auth）との接続設定。
*   **`src/lib/types.ts`**: Employee, Item などのTypeScript型定義。データ構造を知りたい場合はここを見ます。

## コマンド
*   `npm run start`: 開発サーバーを起動
*   `npm run build`: 本番用ビルド
*   `npm run lint`: コードチェック
