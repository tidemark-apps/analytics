<?php

namespace App\Console\Commands;

use App\Analytics\Support\Sql;
use App\Models\Site;
use App\Models\User;
use App\Support\MonthlyEvents;
use App\Support\PlanFile;
use App\Updates\Updater;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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
            'users' => User::count(),
            'last_event_at' => $this->lastEventAt(),
            'database_bytes' => $this->databaseBytes(),
            'version' => (new Updater)->version(),
        ];

        if ($this->option('json')) {
            $this->line(json_encode($usage, JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        }

        $this->table(['', ''], collect($usage)->map(fn ($value, $key) => [str_replace('_', ' ', $key), is_bool($value) ? ($value ? 'yes' : 'no') : $value])->values()->all());

        return self::SUCCESS;
    }

    /** When the newest event arrived (UTC, ISO 8601), or null if nothing was recorded yet. */
    private function lastEventAt(): ?string
    {
        $at = Sql::connection()->table('events')->max('created_at');

        return $at ? Carbon::parse($at, 'UTC')->toIso8601String() : null;
    }

    /** Size of the SQLite database file; null on other databases, where the host measures the server instead. */
    private function databaseBytes(): ?int
    {
        $db = DB::connection();
        if ($db->getDriverName() !== 'sqlite') {
            return null;
        }
        $path = $db->getDatabaseName();

        return is_file($path) ? (int) filesize($path) : null;
    }
}
