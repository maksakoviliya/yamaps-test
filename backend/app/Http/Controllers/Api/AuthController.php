<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Actions\Auth\LoginUser;
use App\Actions\Auth\LogoutUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * @throws ValidationException
     */
    public function login(LoginRequest $request, LoginUser $action): UserResource
    {
        return new UserResource($action($request, $request->validated()));
    }

    public function logout(Request $request, LogoutUser $action): JsonResponse
    {
        $action($request);

        return response()->json(['message' => __('auth.logged_out')]);
    }

    public function user(Request $request): UserResource
    {
        return new UserResource($request->user('web'));
    }
}
