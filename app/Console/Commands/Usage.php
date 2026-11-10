<?php

namespace App\Console\Commands;

use App\Models\Site;
use App\Support\MonthlyEvents;
use App\Support\PlanFile;
use Illuminate\Console\Command;

class Usage extends Command
{
    protected $signature = 'tidemark:usage {--json : print the numbers as JSON}';

    protected $description = 'Show this month\'s events and the sites against the plan, for a host that meters or bills the install';

    public function handle(): int
    {
        $usage = [
            'plan' => PlanFile::name(),
            'suspended' => PlanFile::suspended(),
            'period_start' => MonthlyEvents::periodStart(),
            'events' => MonthlyEvents::countFromDatabase(),
            'events_included' => PlanFile::eventsPerMonth(),
            'hard_limit' => PlanFile::hardLimit(),
            'sites' => Site::real()->count(),
            'sites_included' => PlanFile::sites(),
        ];

        if ($this->option('json')) {
            $this->line(json_encode($usage, JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        }

        $this->table(['', ''], collect($usage)->map(fn ($value, $key) => [str_replace('_', ' ', $key), is_bool($value) ? ($value ? 'yes' : 'no') : $value])->values()->all());

        return self::SUCCESS;
    }
}
