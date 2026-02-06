# 認証・社員管理アーキテクチャ設計書

## 1. 現状仕様の評価

**評価: 概ね適切だが、一部に重要なクリーンアップ作業が残存**

現在の実装は、要求された「Supabase Auth への完全委譲」と「社員コードによる独自ログイン」の両立を実現できています。
特に、以下の点がアーキテクチャとして適切です：

*   **Auth / Business Dataの分離**: `employees` テーブルを純粋な業務データとして扱い、認証情報は `auth_id` でリンクする設計。
*   **Lookup Login**: ログイン時に「社員コード → 実際のEmail」を解決する層（`getLoginEmailAction`）を設けたことで、メールアドレスの実在性と社員コード運用を両立できている。
*   **Security**: Server Action + Service Role を用いた特権操作（登録・削除）と、Client Side での RLS バイパス（Profile Fetch）が適切に使い分けられている。

**課題点:**
*   **不要カラム**: `employees.password` が DB 定義上に残っている（使用はされていないが、紛らわしくセキュリティリスクの誤認を招く）。
*   **一貫性**: 過去のデータで「社員コード@ledger-system.local」形式で登録された Auth User と、新規の「実Email」を持つ Auth User が混在する。これ自体は今回の Lookup 機構で吸収できているが、運用上の留意点となる。

## 2. 認証・社員登録フロー

### A. 社員登録フロー (Admin)
Supabase Auth と DB の整合性を保つため、**必ず Auth User を先に作成**します。

1.  **入力**: 管理者がフォームにて「社員コード」「氏名」「メールアドレス」「初期パスワード」等を入力。
2.  **Auth User 作成 (Server Action)**:
    *   Supabase Admin API を使用。
    *   Email: 入力されたメールアドレス（なければ `${Code}@ledger-system.local`）。
    *   Password: 入力された初期パスワード。
    *   Metadata: `employee_code` を保存。
3.  **DB Record 作成**:
    *   `employees` テーブルに Insert/Upsert。
    *   `auth_id`: 作成した Auth User の UUID。
    *   `password`: **保存しない**。
4.  **補償トランザクション**:
    *   DB 作成に失敗した場合、作成直後の Auth User を即座に削除する（ゴミデータを残さない）。

### B. 認証（ログイン）フロー (User)
「社員コード」でのログインを実現するため、Identity Resolution パターンを採用。

1.  **入力**: ユーザーが「社員コード」「パスワード」を入力。
2.  **Identity Resolution (Server Action)**:
    *   社員コードをキーに `employees` テーブルを検索 (Service Role)。
    *   登録されている `email` を取得。
3.  **認証 (Client SDK)**:
    *   取得した `email` と入力された `password` で `supabase.auth.signInWithPassword` を実行。
4.  **セッション確立**: Supabase が JWT を発行。
5.  **プロファイル取得**:
    *   ログイン成功後、`fetch('/api/auth/profile')` をコール。
    *   API は Session User の `sub` (UUID) に一致する `employees` レコードを返却。

## 3. 新規登録 / インポート時の処理手順

### 手順詳細
Excel インポート等の `bulk-upsert` も以下の原子的なロジック（`upsertEmployeeLogic`）に従います。

```mermaid
graph TD
    A[登録リクエスト] --> B{Auth User存在確認};
    B -- Yes --> C[Auth User再利用];
    B -- No --> D[Auth User新規作成];
    C --> E[Auth情報更新<br>Email/Metadata];
    D --> E;
    E --> F[DB employees Upsert];
    F -- 成功 --> G[完了];
    F -- 失敗 --> H{新規作成だった?};
    H -- Yes --> I[Auth User削除<br>(Rollback)];
    H -- No --> J[エラー返却];
    I --> J;
```

## 4. 独自ログイン画面の実装方針

### Frontend (`login/page.tsx`, `AuthContext.tsx`)
*   **Form**: 社員コード (text) / パスワード (password) のみ。
*   **Logic**:
    *   `getLoginEmailAction(code)` を呼び出し、実際の Email を取得。
    *   取得した Email で `supabase.auth.signInWithPassword`。
*   **Error Handling**:
    *   Code が見つからない場合 → 汎用的な「IDまたはパスワードが違います」を表示。
    *   Auth 認証失敗 → 同上。

### Backend (`actions/auth.ts`, `api/auth/profile`)
*   **Security**: `use server` で隠蔽された Action で Email を解決。Client には Email を露出させず、内部的に利用する。
*   **Profile API**: RLS に依存せず、確実に自身の社員情報を取得するための特権 API エンドポイント。ログインコードと Auth User の紐付け整合性チェックもここで行う。

## 5. 修正が必要な点の一覧

アーキテクチャを完全な状態にするために、以下のタスクを実施してください。

1.  **[必須] DBスキーマ変更**: `employees` テーブルから `password` カラムを削除（Drop Column）。
2.  **[推奨] バリデーション強化**: 登録時に同一メールアドレスが既に別社員コードで使われていないかの事前チェック（Auth 側でエラーになるが、UX向上のため）。
3.  **[推奨] パスワード漏洩防止**: `Employee` 型定義 (`src/lib/types/index.ts`) からも `password` フィールドを削除し、登録APIへのDTO (Data Transfer Object) として別の型を定義する。これによりフロントエンドでの誤送信を防ぐ。

## 6. 将来的に拡張しやすい設計上の注意点

*   **SSO導入**: Auth User の Email を実アドレスにしておけば、将来的に Google/AzureAD 連携 (SAML/OIDC) を導入する際、`Verify Email` だけで既存アカウントとリンク可能になります。
*   **MFA (多要素認証)**: Supabase Auth 標準の MFA を利用可能です。独自画面に TOTP 入力ステップを追加するだけで対応できます。
*   **監査ログ**: 現在 `AuthContext` に実装されているログ送信 (`logger.log`) は維持してください。Supabase の `auth.audit_log_entries` テーブルとは別に、業務ログとしてのログイン履歴は重要です。
