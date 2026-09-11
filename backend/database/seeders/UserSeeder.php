<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * The only account in the app — there is no registration.
     */
    public function run(): void
    {
        User::factory()->create([
            'name' => 'Demo',
            'email' => env('SEED_USER_EMAIL', 'demo@example.com'),
            'password' => bcrypt(env('SEED_USER_PASSWORD', 'password')),
        ]);
    }
}
