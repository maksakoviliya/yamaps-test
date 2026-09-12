<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Actions\Organization\ConnectOrganization;
use App\Actions\Organization\ListOrganizations;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organization\StoreOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Http\Resources\OrganizationSnapshotResource;
use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrganizationController extends Controller
{
    public function index(Request $request, ListOrganizations $action): AnonymousResourceCollection
    {
        return OrganizationResource::collection($action($request));
    }

    public function store(StoreOrganizationRequest $request, ConnectOrganization $action): OrganizationResource
    {
        return new OrganizationResource(
	        $action($request->user(), $request->validated('url'))
        );
    }

    public function show(Organization $organization): OrganizationResource
    {
        return new OrganizationResource($organization);
    }

    public function snapshots(Organization $organization): AnonymousResourceCollection
    {
        return OrganizationSnapshotResource::collection(
            $organization->snapshots()->orderByDesc('captured_at')->orderByDesc('id')->get()
        );
    }
}
