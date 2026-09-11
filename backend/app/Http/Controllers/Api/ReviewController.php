<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Actions\Review\ListReviews;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReviewController extends Controller
{
    public function index(Organization $organization, Request $request, ListReviews $action): AnonymousResourceCollection
    {
        return ReviewResource::collection($action($organization, $request));
    }
}
