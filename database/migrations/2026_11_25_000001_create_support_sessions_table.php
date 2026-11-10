<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id'); // the account that was looked at
            $table->string('staff_id', 64);
            $table->string('staff_name', 120); // kept as text, the staff member is not an account here
            $table->string('reason', 255)->nullable();
            $table->string('ticket', 120)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('expires_at');
            $table->timestamp('ended_at')->nullable();

            $table->index(['user_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_sessions');
    }
};
