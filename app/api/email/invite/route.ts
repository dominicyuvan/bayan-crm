import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, email, role, invitedBy } = await req.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: "Missing name or email" },
        { status: 400 }
      );
    }

    const firstName = name.split(" ")[0];
    const roleLabel =
      role === "admin"
        ? "Admin"
        : role === "manager"
        ? "Manager"
        : "Sales Executive";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    
    <div style="background:#810c3c;border-radius:12px;padding:32px;margin-bottom:16px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">Bayan CRM</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:15px;">You've been invited!</p>
    </div>

    <div style="background:white;border-radius:12px;padding:32px;margin-bottom:16px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#0A0A0A;">
        Welcome to Bayan CRM, ${firstName}! 👋
      </h2>
      <p style="color:#737373;margin:0 0 16px;line-height:1.6;">
        ${invitedBy} has added you to the Bayan Investment House LLC sales team on Bayan CRM.
        You've been set up as a <strong style="color:#810c3c;">${roleLabel}</strong>.
      </p>
      <p style="color:#737373;margin:0 0 24px;line-height:1.6;">
        Sign in with your <strong>${email}</strong> account to get started.
      </p>

      <div style="background:#FDF2F6;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#810c3c;font-weight:600;">Getting started checklist:</p>
        <ul style="margin:8px 0 0;padding-left:20px;color:#737373;font-size:13px;line-height:1.8;">
          <li>Sign in at crm.bayan.one</li>
          <li>Add your first contact</li>
          <li>Create your first lead</li>
          <li>Log your first activity</li>
        </ul>
      </div>

      <div style="text-align:center;">
        <a href="https://crm.bayan.one/login" 
          style="display:inline-block;background:#810c3c;color:white;padding:16px 40px;border-radius:50px;text-decoration:none;font-weight:600;font-size:16px;">
          Sign In to Bayan CRM →
        </a>
      </div>
    </div>

    <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:15px;color:#0A0A0A;">Your login details:</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#737373;font-size:14px;width:40%;">Email</td>
          <td style="padding:8px 0;font-weight:600;font-size:14px;">${email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#737373;font-size:14px;">Role</td>
          <td style="padding:8px 0;font-weight:600;font-size:14px;color:#810c3c;">${roleLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#737373;font-size:14px;">Login URL</td>
          <td style="padding:8px 0;font-size:14px;">
            <a href="https://crm.bayan.one/login" style="color:#810c3c;">crm.bayan.one</a>
          </td>
        </tr>
      </table>
    </div>

    <p style="text-align:center;color:#A3A3A3;font-size:12px;margin:0;">
      Bayan Investment House LLC · Muscat, Oman<br>
      If you weren't expecting this email please ignore it.
    </p>
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: email,
      subject: `You've been invited to Bayan CRM 🎉`,
      html,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message ?? "Unknown error")
        : "Unknown error";
    console.error("Invite email error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

