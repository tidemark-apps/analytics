<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{{ ucfirst($r['window']->frequency) }} report for {{ $r['site']->domain }}</title></head>
<body style="margin:0;padding:0;background:#f3f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10242b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dde6e8;border-radius:12px;">
<tr><td style="padding:28px 28px 8px;">
  <img src="{{ url('/assets/logo/tidemark-email.png') }}" alt="{{ config('app.name') }}" width="110" height="34" style="display:block;border:0;height:34px;width:110px;margin:0 0 18px;">
  <div style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#4f6b73;">{{ ucfirst($r['window']->frequency) }} report</div>
  <h1 style="margin:6px 0 2px;font-size:24px;line-height:1.25;"><a href="{{ $dashboard }}" style="color:#10242b;text-decoration:none;">{{ $r['site']->domain }}</a></h1>
  <div style="font-size:14px;color:#4f6b73;">{{ $r['window']->label() }}</div>
</td></tr>
<tr><td style="padding:12px 28px 4px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  @foreach (array_chunk($r['metrics'], 3) as $row)
    <tr>
    @foreach ($row as $m)
      @php
        $up = $m['change'] !== null && $m['change'] > 0; $down = $m['change'] !== null && $m['change'] < 0;
        $good = ($up && ! $m['good_when_down']) || ($down && $m['good_when_down']);
        $colour = $m['change'] === null || $m['change'] == 0 ? '#4f6b73' : ($good ? '#1b7f4b' : '#b3361f');
      @endphp
      <td width="33%" valign="top" style="padding:12px 8px 12px 0;">
        <div style="font-size:12px;color:#4f6b73;">{{ $m['label'] }}</div>
        <div style="font-size:22px;font-weight:600;line-height:1.3;">{{ $m['value'] }}</div>
        <div style="font-size:12px;color:{{ $colour }};">{{ $m['change'] === null ? 'no earlier data' : ($up ? '▲ ' : ($down ? '▼ ' : '')).abs($m['change']).'%' }}</div>
      </td>
    @endforeach
    @for ($i = count($row); $i < 3; $i++)<td width="33%"></td>@endfor
    </tr>
  @endforeach
  </table>
  <div style="font-size:12px;color:#4f6b73;padding-bottom:8px;">Changes compare with the period before.</div>
</td></tr>

@foreach ([['Top pages', 'pages', 'Pageviews'], ['Top sources', 'sources', 'Visitors'], ['Top countries', 'countries', 'Visitors']] as [$title, $key, $unit])
  @if (count($r[$key]))
  <tr><td style="padding:16px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:14px;font-weight:600;padding-bottom:6px;border-bottom:1px solid #dde6e8;">{{ $title }}</td><td align="right" style="font-size:12px;color:#4f6b73;padding-bottom:6px;border-bottom:1px solid #dde6e8;">{{ $unit }}</td></tr>
      @foreach ($r[$key] as $row)
        <tr><td style="font-size:14px;padding:7px 12px 7px 0;border-bottom:1px solid #eef3f4;word-break:break-all;">{{ \Illuminate\Support\Str::limit($row['name'], 60) }}</td><td align="right" style="font-size:14px;padding:7px 0;border-bottom:1px solid #eef3f4;">{{ $row['value'] }}</td></tr>
      @endforeach
    </table>
  </td></tr>
  @endif
@endforeach

@if (count($r['goals']))
<tr><td style="padding:16px 28px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:14px;font-weight:600;padding-bottom:6px;border-bottom:1px solid #dde6e8;">Goals</td><td align="right" style="font-size:12px;color:#4f6b73;padding-bottom:6px;border-bottom:1px solid #dde6e8;">Converting visitors</td></tr>
    @foreach ($r['goals'] as $g)
      <tr><td style="font-size:14px;padding:7px 12px 7px 0;border-bottom:1px solid #eef3f4;">{{ $g['name'] }}@isset($g['revenue']) <span style="color:#4f6b73;">· {{ number_format($g['revenue'], 2) }} {{ $g['currency'] }}</span>@endisset</td><td align="right" style="font-size:14px;padding:7px 0;border-bottom:1px solid #eef3f4;">{{ number_format($g['visitors']) }} <span style="color:#4f6b73;font-size:12px;">({{ $g['conversion_rate'] }}%)</span></td></tr>
    @endforeach
  </table>
</td></tr>
@endif

@if (count($r['notes']))
<tr><td style="padding:16px 28px 0;">
  <div style="font-size:14px;font-weight:600;padding-bottom:6px;border-bottom:1px solid #dde6e8;">Notes on the graph</div>
  @foreach ($r['notes'] as $n)
    <div style="font-size:14px;padding:7px 0;border-bottom:1px solid #eef3f4;"><span style="color:#4f6b73;">{{ $n['date'] }}</span> &nbsp;{{ $n['note'] }}</div>
  @endforeach
</td></tr>
@endif

<tr><td style="padding:24px 28px 8px;"><a href="{{ $dashboard }}" style="display:inline-block;background:#0f6f78;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Open the dashboard</a></td></tr>
<tr><td style="padding:16px 28px 28px;font-size:12px;line-height:1.5;color:#4f6b73;">
  You get this because you asked for {{ $r['window']->frequency }} reports of {{ $r['site']->domain }}. There are no tracking pixels or tracked links in this email.<br>
  <a href="{{ $settings }}" style="color:#4f6b73;">Change your reports</a> &nbsp;·&nbsp; <a href="{{ $unsubscribe }}" style="color:#4f6b73;">Unsubscribe</a>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
