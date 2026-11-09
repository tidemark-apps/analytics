<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Ownership offer · {{ $organization->name }}</title></head>
<body style="margin:0;padding:0;background:#f3f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10242b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dde6e8;border-radius:12px;">
<tr><td style="padding:28px 28px 8px;">
  <img src="{{ url('/assets/logo/tidemark-email.png') }}" alt="{{ config('app.name') }}" width="110" height="34" style="display:block;border:0;height:34px;width:110px;margin:0 0 18px;">
  <h1 style="margin:8px 0 0;font-size:20px;line-height:1.4;">{{ $previousOwner->name }} wants to make you the owner of {{ $organization->name }}</h1>
  <p style="margin:12px 0 0;font-size:15px;line-height:1.5;">As owner you would hold its plan and billing and decide who its admins are; {{ $previousOwner->name }} would stay on as an admin. Nothing changes unless you accept.</p>
</td></tr>
<tr><td style="padding:16px 28px 8px;"><a href="{{ $url }}" style="display:inline-block;background:#0f6f78;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Review the offer</a></td></tr>
<tr><td style="padding:16px 28px 28px;font-size:12px;line-height:1.5;color:#4f6b73;">
  The offer expires in {{ $hours }} hours. If you were not expecting this, ignore this email: nothing changes unless you accept.
</td></tr>
</table></td></tr></table>
</body></html>
