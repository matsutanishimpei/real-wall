# Entity Relationship Diagram (ERD)

現在の Real Wall プロジェクトのデータベース設計（Cloudflare D1）を Mermaid 記法で可視化した図です。

```mermaid
erDiagram
    users {
        text id PK "UUID"
        text name "ユーザー名"
        text email "メールアドレス (Unique)"
        text role "admin | user"
        integer is_active "0=無効, 1=有効"
        integer created_at "Unix Epoch"
        integer updated_at "Unix Epoch"
    }

    base_prompts {
        text id PK "UUID"
        text title "プロンプトのタイトル"
        text category "extraction | report | general"
        text content "プロンプト本文テンプレート"
        integer created_at
        integer updated_at
    }

    constraints {
        text id PK "UUID"
        text main_category "大カテゴリ (例: インフラ)"
        text sub_category "中カテゴリ (例: セキュリティ)"
        text detail_category "詳細カテゴリ (例: 閉域網)"
        text description "制約の説明文"
        integer created_at
        integer updated_at
    }

    output_logs {
        text id PK "UUID"
        text project_id "アプリケーション側プロジェクトID"
        text pdf_hash "生成物検証用ハッシュ (SHA-256)"
        integer created_at
        integer updated_at
    }

    considerations {
        text id PK "UUID"
        text output_log_id FK "References output_logs.id"
        text project_id "所属プロジェクトID"
        text content "設計の意思決定・検討メモ"
        integer created_at
        integer updated_at
    }

    output_logs ||--o{ considerations : "contains"
```

---

## 各テーブルの役割

### 1. `users`
アプリケーションのユーザー管理を行います。`role` によって管理画面へのアクセスを制御し、`is_active` によってログイン可否を即座に反映します。

### 2. `base_prompts`
AIへの指示文（テンプレート）を管理します。2ステップワークフローに合わせて、`extraction`（論点抽出用）と `report`（報告書生成用）のカテゴリに分類されます。

### 3. `constraints`
設計者に突きつける「壁」のマスターデータです。カテゴリ別に整理され、`MainGenerator` のサイドバーに表示されます。

### 4. `output_logs`
生成されたPDFの整合性を検証するためのテーブルです。`pdf_hash` を保持し、管理画面の Verification 機能でハッシュを照合する際に使用されます。

### 5. `considerations`
ユーザーが各ステップで入力した意思決定メモを保存します。`output_logs` とリレーションを持ち、どの PDF 発行時にどのような検討が行われたかを追跡可能です。
