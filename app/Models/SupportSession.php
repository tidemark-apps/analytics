<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** One time someone from the host looked at an account, and why. Shown to the account's owner. */
class SupportSession extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['user_id', 'staff_id', 'staff_name', 'reason', 'ticket', 'started_at', 'expires_at', 'ended_at'];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'expires_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    public function isOpen(): bool
    {
        return $this->ended_at === null && $this->expires_at->isFuture();
    }

    public function end(): void
    {
        if ($this->ended_at === null) {
            $this->forceFill(['ended_at' => now()])->save();
        }
    }

    /** @return array{id:string,staff_name:string,reason:?string,ticket:?string,started_at:string,ends_at:string,open:bool} */
    public function present(): array
    {
        return [
            'id' => $this->id, 'staff_name' => $this->staff_name, 'reason' => $this->reason, 'ticket' => $this->ticket,
            'started_at' => $this->started_at->toIso8601String(),
            'ends_at' => ($this->ended_at ?? $this->expires_at)->toIso8601String(),
            'open' => $this->isOpen(),
        ];
    }
}
