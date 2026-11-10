<?php

namespace App\Http\Controllers\Api;

use App\Alerts\AlertDispatcher;
use App\Alerts\WebhookUrl;
use App\Http\Controllers\Controller;
use App\Jobs\DeliverWebhook;
use App\Models\AlertRule;
use App\Models\AlertWebhook;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Alert rules and the webhooks they deliver to, for site owners and admins. */
class AlertController extends Controller
{
    public function index(Request $r)
    {
        $site = $r->attributes->get('site');

        return [
            'allowed' => $site->alertsAllowed(),
            'mail' => AuthController::mailConfigured(),
            'private_allowed' => (bool) config('tidemark.webhooks.allow_private'),
            'rules' => AlertRule::where('site_id', $site->id)->orderBy('created_at')->get()->map(fn ($x) => self::rule($x))->values(),
            'webhooks' => AlertWebhook::where('site_id', $site->id)->orderBy('created_at')->get()->map(fn ($x) => self::webhook($x))->values(),
        ];
    }

    private static function rule(AlertRule $x): array
    {
        return ['id' => $x->id, 'type' => $x->type, 'config' => $x->config, 'email' => $x->email, 'webhook_ids' => $x->webhook_ids ?? [], 'quiet_start' => $x->quiet_start, 'quiet_end' => $x->quiet_end, 'enabled' => $x->enabled, 'last_fired_at' => $x->last_fired_at?->utc()->format('Y-m-d H:i:s')];
    }

    private static function webhook(AlertWebhook $x): array
    {
        return ['id' => $x->id, 'name' => $x->name, 'kind' => $x->kind, 'url' => $x->displayUrl(), 'last_status' => $x->last_status, 'last_error' => $x->last_error, 'last_at' => $x->last_at?->utc()->format('Y-m-d H:i:s')];
    }

    /** Alerts come with some plans only; whoever lost access can still switch rules off and delete them. */
    private function requireAlerts(Request $r): void
    {
        abort_unless($r->attributes->get('site')->alertsAllowed(), 403, 'Alerts and webhooks aren’t included in your plan.');
    }

    public function storeRule(Request $r)
    {
        $this->requireAlerts($r);
        $site = $r->attributes->get('site');
        abort_if(AlertRule::where('site_id', $site->id)->count() >= AlertRule::MAX_PER_SITE, 422, 'A site can have up to '.AlertRule::MAX_PER_SITE.' alert rules.');
        $rule = AlertRule::create($this->ruleData($r, $site, requireType: true) + ['site_id' => $site->id]);

        return response()->json(['data' => self::rule($rule)], 201);
    }

    public function updateRule(Request $r, string $site, string $rule)
    {
        $s = $r->attributes->get('site');
        if (! $s->alertsAllowed() && $r->input('enabled') !== false) {
            $this->requireAlerts($r);
        }
        $model = AlertRule::where('site_id', $s->id)->findOrFail($rule);
        $data = $this->ruleData($r, $s, requireType: false, current: $model);
        // a changed condition starts from a clean slate
        if (isset($data['type']) && ($data['type'] !== $model->type || ($data['config'] ?? null) !== $model->config)) {
            $data['state'] = null;
        }
        $model->update($data);

        return ['data' => self::rule($model->refresh())];
    }

    public function destroyRule(Request $r, string $site, string $rule)
    {
        AlertRule::where('site_id', $r->attributes->get('site')->id)->whereKey($rule)->delete();

        return ['ok' => true];
    }

    private function ruleData(Request $r, $site, bool $requireType, ?AlertRule $current = null): array
    {
        $time = ['nullable', 'date_format:H:i'];
        $v = $r->validate([
            'type' => [$requireType ? 'required' : 'sometimes', Rule::in(AlertRule::TYPES)],
            'config' => 'sometimes|array',
            'email' => 'sometimes|boolean',
            'webhook_ids' => 'sometimes|array|max:'.AlertWebhook::MAX_PER_SITE,
            'webhook_ids.*' => 'string',
            'quiet_start' => $time,
            'quiet_end' => $time,
            'enabled' => 'sometimes|boolean',
        ]);
        $type = $v['type'] ?? $current?->type;
        $out = array_intersect_key($v, array_flip(['type', 'email', 'enabled']));

        if (isset($v['config']) || isset($v['type'])) {
            $out['config'] = $this->config($type, $v['config'] ?? [], $site);
        }
        if (isset($v['webhook_ids'])) {
            $ids = array_values(array_unique($v['webhook_ids']));
            if (AlertWebhook::where('site_id', $site->id)->whereIn('id', $ids)->count() !== count($ids)) {
                throw ValidationException::withMessages(['webhook_ids' => 'Choose webhooks that belong to this site.']);
            }
            $out['webhook_ids'] = $ids;
        }
        if ($r->has('quiet_start') || $r->has('quiet_end')) {
            if (($v['quiet_start'] ?? null) xor ($v['quiet_end'] ?? null)) {
                throw ValidationException::withMessages(['quiet_start' => 'Set both the start and the end of the quiet hours, or neither.']);
            }
            $out['quiet_start'] = $v['quiet_start'] ?? null;
            $out['quiet_end'] = $v['quiet_end'] ?? null;
        }
        $email = $out['email'] ?? $current?->email ?? false;
        $hooks = $out['webhook_ids'] ?? $current?->webhook_ids ?? [];
        if (! $email && ! $hooks) {
            throw ValidationException::withMessages(['email' => 'Choose where to send it: email, a webhook, or both.']);
        }
        if (! $current) {
            $out += ['email' => false, 'webhook_ids' => []];
        }

        return $out;
    }

    /** The settings that belong to a rule type, checked and cleaned. */
    private function config(string $type, array $in, $site): array
    {
        $num = fn (string $k, int $min, int $max, int $default) => max($min, min($max, (int) ($in[$k] ?? $default)));
        $goal = function () use ($in, $site) {
            $id = $in['goal_id'] ?? null;
            if (! is_string($id) || ! $site->goals()->whereKey($id)->exists()) {
                throw ValidationException::withMessages(['config.goal_id' => 'Choose one of this site\'s goals.']);
            }

            return $id;
        };

        return match ($type) {
            'traffic_spike' => ['percent' => $num('percent', 10, 1000, 100), 'min_visitors' => $num('min_visitors', 1, 100000, 50)],
            'traffic_drop' => ['percent' => $num('percent', 10, 95, 50), 'min_visitors' => $num('min_visitors', 1, 100000, 50)],
            'goal_milestone' => ['goal_id' => $goal(), 'count' => $num('count', 1, 1000000, 10)],
            'goal_conversions' => ['goal_id' => $goal()],
            'new_top_referrer' => ['min_visitors' => $num('min_visitors', 1, 100000, 20)],
        };
    }

    public function storeWebhook(Request $r)
    {
        $this->requireAlerts($r);
        $site = $r->attributes->get('site');
        abort_if(AlertWebhook::where('site_id', $site->id)->count() >= AlertWebhook::MAX_PER_SITE, 422, 'A site can have up to '.AlertWebhook::MAX_PER_SITE.' webhooks.');
        $v = $r->validate(['name' => 'required|string|max:80', 'kind' => ['required', Rule::in(AlertWebhook::KINDS)], 'url' => 'required|string|max:1000']);
        $this->checkUrl($v['url']);
        $secret = $v['kind'] === 'generic' ? 'whsec_'.Str::random(32) : null;
        $hook = AlertWebhook::create(['site_id' => $site->id, 'name' => trim($v['name']), 'kind' => $v['kind'], 'url' => trim($v['url']), 'secret' => $secret]);

        // the signing secret is shown once, here
        return response()->json(['data' => self::webhook($hook) + ['secret' => $secret]], 201);
    }

    public function updateWebhook(Request $r, string $site, string $webhook)
    {
        $this->requireAlerts($r);
        $hook = AlertWebhook::where('site_id', $r->attributes->get('site')->id)->findOrFail($webhook);
        $v = $r->validate(['name' => 'sometimes|string|max:80', 'url' => 'sometimes|string|max:1000']);
        if (isset($v['url'])) {
            $this->checkUrl($v['url']);
        }
        $hook->update(array_map('trim', $v));

        return ['data' => self::webhook($hook->refresh())];
    }

    public function destroyWebhook(Request $r, string $site, string $webhook)
    {
        $s = $r->attributes->get('site');
        AlertWebhook::where('site_id', $s->id)->whereKey($webhook)->delete();
        // rules stop pointing at it
        foreach (AlertRule::where('site_id', $s->id)->get() as $rule) {
            if (in_array($webhook, $rule->webhook_ids ?? [], true)) {
                $rule->update(['webhook_ids' => array_values(array_diff($rule->webhook_ids, [$webhook]))]);
            }
        }

        return ['ok' => true];
    }

    /** Sends a sample alert right away and reports what the other end answered. */
    public function testWebhook(Request $r, string $site, string $webhook)
    {
        $this->requireAlerts($r);
        $s = $r->attributes->get('site');
        $hook = AlertWebhook::where('site_id', $s->id)->findOrFail($webhook);
        $status = DeliverWebhook::deliver($hook, AlertDispatcher::payload($s, ['event' => 'test', 'summary' => 'This is a test alert from Tidemark for '.$s->domain.'.', 'data' => (object) []]));

        return ['status' => $status, 'ok' => $status >= 200 && $status < 300, 'error' => $hook->refresh()->last_error];
    }

    private function checkUrl(string $url): void
    {
        if ($why = WebhookUrl::problem(trim($url))) {
            throw ValidationException::withMessages(['url' => $why]);
        }
    }
}
