<?php

declare(strict_types=1);

namespace App\Http\Requests\Organization;

use App\Rules\ValidBusinessUrl;
use Illuminate\Foundation\Http\FormRequest;

class StoreOrganizationRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'url' => ['required', 'string', 'max:2048', new ValidBusinessUrl],
        ];
    }
}
