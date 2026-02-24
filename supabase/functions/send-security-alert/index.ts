import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// ==============================
// 環境変数
// ==============================
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appUrl = Deno.env.get("APP_URL") || "#";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// ==============================
// 型定義
// ==============================
interface AuditLogRecord {
  action_type: string;
  target_type: string;
  details: string | null;
  occurred_at: string;
  actor_name: string | null;
}

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: AuditLogRecord;
  old_record?: AuditLogRecord | null;
}

// ==============================
// Edge Function
// ==============================
Deno.serve(async (req: Request) => {
  try {
    console.log("Webhook received");

    // JSON取得
    const payload: WebhookPayload = await req.json();
    console.log("Payload:", payload);

    // INSERT以外は無視
    if (payload.type !== "INSERT") {
      console.log("Ignored: not INSERT");
      return new Response("Ignored", { status: 200 });
    }

    // 対象テーブル確認
    if (payload.table !== "audit_logs") {
      console.log("Ignored: not audit_logs table");
      return new Response("Ignored", { status: 200 });
    }

    const { action_type, target_type, details, actor_name, occurred_at } =
      payload.record;

    // セキュリティアラート以外は無視
    if (action_type !== "ANOMALY_DETECTED") {
      console.log("Ignored: not security event");
      return new Response("Ignored", { status: 200 });
    }

    console.log(
      `Security alert detected: ${action_type} by ${actor_name}`
    );

    // ==============================
    // 管理者取得
    // ==============================
    const { data: admins, error: adminError } = await supabase
      .from("employees")
      .select("email")
      .eq("authority", "admin")
      .not("email", "is", null);

    if (adminError) {
      console.error("Failed to fetch admins:", adminError);
      throw adminError;
    }

    if (!admins || admins.length === 0) {
      console.log("No admin emails found.");
      return new Response("No admins found", { status: 200 });
    }

    const adminEmails = admins.map((admin) => admin.email);
    //const adminEmails = ["hokutongfhd@gmail.com"];


    // ==============================
    // メール送信
    // ==============================
    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: "Security Alert <onboarding@resend.dev>",
        to: adminEmails,
        subject: `[Security Alert] 不正検知: ${target_type}`,
        html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: #d32f2f;">⚠️ セキュリティアラート検知</h1>
          <p>以下の異常イベントが記録されました。</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr>
              <td><strong>発生日時</strong></td>
              <td>${new Date(occurred_at).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
              })}</td>
            </tr>
            <tr>
              <td><strong>実行者</strong></td>
              <td>${actor_name ?? "不明"}</td>
            </tr>
            <tr>
              <td><strong>アクション</strong></td>
              <td>${action_type}</td>
            </tr>
            <tr>
              <td><strong>対象</strong></td>
              <td>${target_type}</td>
            </tr>
            <tr>
              <td><strong>詳細</strong></td>
              <td>${details ?? "なし"}</td>
            </tr>
          </table>
          <p style="margin-top:20px;">
            <a href="${appUrl}"
              style="background:#1976d2;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">
              管理画面で確認
            </a>
          </p>
        </div>
      `,
      });

    if (emailError) {
      console.error("Email send error:", emailError);
      throw emailError;
    }

    console.log("Email sent successfully");

    return new Response(JSON.stringify(emailData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});
