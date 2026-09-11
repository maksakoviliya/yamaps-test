<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginUser
{
	/**
	 * @param array{email: string, password: string} $credentials
	 * @throws ValidationException
	 */
    public function __invoke(Request $request, array $credentials): Authenticatable
    {
        if (! Auth::guard('web')->attempt($credentials, remember: true)) {
            throw ValidationException::withMessages([
                'email' => [__('auth.failed')],
            ]);
        }

        $request->session()->regenerate();

        return Auth::guard('web')->user();
    }
}
