console.log("Webhook received");
console.log(JSON.stringify(payload));

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface AuditLogRecord {
  action_type: string;
  target_type: string;
  details: string;
  occurred_at: string;
  actor_name: string;
  // その他必要なフィールド
}

interface WebhookPayload {
  type: "INSERT";
  table: "audit_logs";
  record: AuditLogRecord;
  schema: "public";
}

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();

    // 1. INSERTイベント以外は無視
    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Ignored non-insert event' }), { status: 200 });
    }

    const { record } = payload;
    const { action_type, target_type, details, actor_name, occurred_at } = record;

    // 2. セキュリティアラート（異常検知）以外は無視
    // log.service.ts の定義に基づき 'ANOMALY_DETECTED' を対象とします
    if (action_type !== 'ANOMALY_DETECTED') {
      return new Response(JSON.stringify({ message: 'Ignored non-security event' }), { status: 200 });
    }

    console.log(`Security alert detected: ${action_type} by ${actor_name}`);

    // 3. 管理者("admin")のメールアドレスを取得
    // is_admin() 関数などでの定義に基づき、employees テーブルの authority='admin' を参照
    const { data: admins, error: adminError } = await supabase
      .from("employees")
      .select("email")
      .eq("authority", "admin") // authorityカラムを使用
      .not("email", "is", null);

    if (adminError) {
      console.error("Failed to fetch admins:", adminError);
      throw adminError;
    }

    if (!admins || admins.length === 0) {
      console.log("No admin emails found.");
      return new Response(JSON.stringify({ message: "No admins found" }), { status: 200 });
    }

    const adminEmails = admins.map((admin) => admin.email);
    console.log(`Sending email to ${adminEmails.length} admins.`);

    // 4. メール送信 (Resend)
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Security Alert <onboarding@resend.dev>", // 本番運用時は確認済みドメインに変更してください
      to: adminEmails,
      subject: `[Security Alert] 不正検知: ${target_type}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h1 style="color: #d32f2f;">⚠️ セキュリティアラート検知</h1>
          <p>システムにて以下の異常な操作またはイベントが記録されました。</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">発生日時</th>
              <td style="padding: 10px; border: 1px solid #ddd;">${new Date(occurred_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
            </tr>
            <tr>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">実行者</th>
              <td style="padding: 10px; border: 1px solid #ddd;">${actor_name || '不明'}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">アクション</th>
              <td style="padding: 10px; border: 1px solid #ddd;">${action_type}</td>
            </tr>
            <tr>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">対象</th>
              <td style="padding: 10px; border: 1px solid #ddd;">${target_type}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">詳細</th>
              <td style="padding: 10px; border: 1px solid #ddd;">${details}</td>
            </tr>
          </table>
          
          <p style="margin-top: 20px;">
            <a href="${Deno.env.get("APP_URL") || '#'}" style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">管理画面で確認</a>
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Resend API Error:", emailError);
      throw emailError;
    }

    return new Response(JSON.stringify(emailData), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
