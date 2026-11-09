<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Sign-in code · {{ config('app.name') }}</title></head>
<body style="margin:0;padding:0;background:#f3f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10242b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dde6e8;border-radius:12px;">
<tr><td style="padding:28px 28px 8px;">
  <img src="{{ url('/assets/logo/tidemark-email.png') }}" alt="{{ config('app.name') }}" width="130" height="33" style="display:block;border:0;height:33px;width:130px;margin:0 0 18px;">
  <h1 style="margin:8px 0 0;font-size:20px;line-height:1.4;">Your sign-in code</h1>
  <p style="margin:12px 0 0;font-size:15px;line-height:1.5;">Enter this code to finish signing in to {{ config('app.name') }}.</p>
</td></tr>
<tr><td style="padding:16px 28px 8px;"><div style="display:inline-block;background:#eef4f5;border-radius:8px;padding:12px 20px;font-size:28px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">{{ $code }}</div></td></tr>
<tr><td style="padding:16px 28px 28px;font-size:12px;line-height:1.5;color:#4f6b73;">
  It works once and expires in {{ $minutes }} minutes. If you did not just try to sign in, someone may know your password: change it, and do not share this code with anyone.
</td></tr>
</table></td></tr></table>
</body></html>
