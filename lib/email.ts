import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = `Bayan CRM <${process.env.RESEND_FROM_EMAIL || "crm@bayaninvestment.com"}>`;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });
    return { success: true, id: result.data?.id };
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message ?? "Unknown error")
        : "Unknown error";
    console.error("Email send error:", err);
    return { success: false, error: message };
  }
}

export function buildDailyDigestHtml({
  firstName,
  contactsMade,
  siteVisits,
  followUps,
  openLeads,
  pipelineValue,
  streakDays,
}: {
  firstName: string;
  contactsMade: number;
  siteVisits: number;
  followUps: number;
  openLeads: number;
  pipelineValue: number;
  streakDays: number;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily Digest — Bayan CRM</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#810c3c;border-radius:12px;padding:24px;margin-bottom:16px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:700;">Bayan CRM</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Daily Digest</p>
    </div>

    <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px;">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0A0A0A;">
        Good morning, ${firstName} ☀️
      </h2>
      ${
        streakDays > 1
          ? '<p style="margin:0;color:#810c3c;font-weight:600;">🔥 ' +
            `${streakDays}` +
            " day streak — keep it up!</p>"
          : ""
      }
    </div>

    <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 16px;font-size:16px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Yesterday's Activity</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:#FDF2F6;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#810c3c;">${contactsMade}</div>
          <div style="font-size:13px;color:#737373;margin-top:4px;">Contacts Made</div>
        </div>
        <div style="background:#FDF2F6;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#810c3c;">${siteVisits}</div>
          <div style="font-size:13px;color:#737373;margin-top:4px;">Site Visits</div>
        </div>
        <div style="background:#FDF2F6;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#810c3c;">${followUps}</div>
          <div style="font-size:13px;color:#737373;margin-top:4px;">Follow Ups</div>
        </div>
        <div style="background:#FDF2F6;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#810c3c;">${openLeads}</div>
          <div style="font-size:13px;color:#737373;margin-top:4px;">Open Leads</div>
        </div>
      </div>
    </div>

    <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 8px;font-size:16px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Pipeline Value</h3>
      <div style="font-size:36px;font-weight:700;color:#0A0A0A;">
        OMR ${pipelineValue.toLocaleString("en-US", { minimumFractionDigits: 3 })}
      </div>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bayan-crm.vercel.app"}/dashboard" 
        style="display:inline-block;background:#810c3c;color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:600;font-size:15px;">
        Open My Dashboard →
      </a>
    </div>

    <p style="text-align:center;color:#A3A3A3;font-size:12px;margin:0;">
      Bayan Investment · Muscat, Oman<br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bayan-crm.vercel.app"}" style="color:#810c3c;">${
    process.env.NEXT_PUBLIC_APP_URL || "bayan-crm.vercel.app"
  }</a>
    </p>
  </div>
</body>
</html>
  `;
}

export function buildWeeklyReportHtml({
  weekStart,
  weekEnd,
  teamStats,
  totalDealsWon,
  totalWonValue,
  totalActivities,
  topPerformer,
}: {
  weekStart: string;
  weekEnd: string;
  teamStats: Array<{
    name: string;
    role: string;
    contactsMade: number;
    siteVisits: number;
    followUps: number;
    dealsWon: number;
    wonValue: number;
    activitiesTotal: number;
  }>;
  totalDealsWon: number;
  totalWonValue: number;
  totalActivities: number;
  topPerformer: string;
}): string {
  const rows = teamStats
    .map(
      (m) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;font-weight:500;">${m.name}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;text-align:center;">${m.contactsMade}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;text-align:center;">${m.siteVisits}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;text-align:center;">${m.followUps}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;text-align:center;font-weight:600;color:#810c3c;">${m.dealsWon}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E5E5;text-align:right;font-family:monospace;">
        ${
          m.wonValue > 0
            ? `OMR ${m.wonValue.toLocaleString("en-US", { minimumFractionDigits: 3 })}`
            : "—"
        }
      </td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:700px;margin:0 auto;padding:24px 16px;">
    <div style="background:#810c3c;border-radius:12px;padding:24px;margin-bottom:16px;">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:700;">Weekly Report</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${weekStart} — ${weekEnd}</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
      <div style="background:white;border-radius:12px;padding:20px;text-align:center;">
        <div style="font-size:36px;font-weight:700;color:#810c3c;">${totalDealsWon}</div>
        <div style="font-size:13px;color:#737373;margin-top:4px;">Deals Won</div>
      </div>
      <div style="background:white;border-radius:12px;padding:20px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#810c3c;font-family:monospace;">
          ${
            totalWonValue > 0
              ? totalWonValue.toLocaleString("en-US", { minimumFractionDigits: 0 })
              : "0"
          }
        </div>
        <div style="font-size:13px;color:#737373;margin-top:4px;">OMR Won</div>
      </div>
      <div style="background:white;border-radius:12px;padding:20px;text-align:center;">
        <div style="font-size:36px;font-weight:700;color:#810c3c;">${totalActivities}</div>
        <div style="font-size:13px;color:#737373;margin-top:4px;">Activities</div>
      </div>
    </div>

    ${
      topPerformer
        ? `<div style="background:#FDF2F6;border:1px solid #f4b8d0;border-radius:12px;padding:16px;margin-bottom:16px;">
      <p style="margin:0;color:#810c3c;font-weight:600;">🏆 Top Performer: ${topPerformer}</p>
    </div>`
        : ""
    }

    <div style="background:white;border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="padding:16px 16px 12px;border-bottom:2px solid #810c3c;">
        <h3 style="margin:0;font-size:16px;font-weight:600;">Team Performance</h3>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F5F5F5;">
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;">Rep</th>
            <th style="padding:10px 16px;text-align:center;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;">Calls</th>
            <th style="padding:10px 16px;text-align:center;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;">Visits</th>
            <th style="padding:10px 16px;text-align:center;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;">Follow Ups</th>
            <th style="padding:10px 16px;text-align:center;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;">Won</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;">Value</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bayan-crm.vercel.app"}/reports" 
        style="display:inline-block;background:#810c3c;color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:600;font-size:15px;">
        View Full Reports →
      </a>
    </div>

    <p style="text-align:center;color:#A3A3A3;font-size:12px;margin:0;">
      Bayan Investment · Muscat, Oman
    </p>
  </div>
</body>
</html>
  `;
}
