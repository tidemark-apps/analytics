<?php

namespace App\Support;

use App\Analytics\Support\Sql;
use App\Models\Site;
use Illuminate\Support\Facades\Cache;

/** Counts the events recorded in the current calendar month (UTC), across every site. Fast enough for every request: one cache increment. */
class MonthlyEvents
{
    public static function periodStart(): string
    {
        return gmdate('Y-m-01 00:00:00');
    }

    /** The exact count from the database: slow, for reports and for seeding the counter, never per event. */
    public static function countFromDatabase(): int
    {
        return (int) Sql::connection()->table('events')
            ->where('interactive', true)
            ->whereIn('site_id', Site::real()->pluck('id'))
            ->where('created_at', '>=', self::periodStart())
            ->count();
    }

    private static function key(): string
    {
        return 'plan:events:'.gmdate('Y-m');
    }

    /** Count one more event and return the month's total. */
    public static function hit(): int
    {
        if (Cache::get(self::key()) === null) {
            Cache::add(self::key(), self::countFromDatabase(), now()->addDays(40));
        }

        return (int) Cache::increment(self::key());
    }

    /** Take back the count of an event that was refused, so refused events never inflate the total. */
    public static function undo(): void
    {
        Cache::decrement(self::key());
    }

    public static function current(): int
    {
        $value = Cache::get(self::key());

        return $value === null ? self::countFromDatabase() : (int) $value;
    }
}
