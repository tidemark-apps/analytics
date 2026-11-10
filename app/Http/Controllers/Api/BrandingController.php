<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** A site's own name, color and logo for its public dashboard and shared links. The Tidemark footer link always stays. */
class BrandingController extends Controller
{
    private const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

    public function update(Request $request): JsonResponse
    {
        $site = $this->site($request);
        if ($denied = $this->denyUnlessAllowed($site)) {
            return $denied;
        }
        $data = $request->validate([
            'brand_name' => 'sometimes|nullable|string|max:60',
            'brand_hide_name' => 'sometimes|boolean',
            'brand_color' => ['sometimes', 'nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ], ['brand_color.regex' => 'Use a color like #0e7c86.']);
        $site->update(array_map(fn ($v) => $v === '' ? null : $v, $data));
        $this->forget($site);

        return response()->json(['data' => (new SiteController)->present($site->fresh(), $request->user(), $request->attributes->get('role'))]);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $site = $this->site($request);
        if ($denied = $this->denyUnlessAllowed($site)) {
            return $denied;
        }
        $request->validate(['logo' => 'required|file|max:100|mimes:png,jpg,jpeg,webp,svg'], ['logo.max' => 'The logo can be up to 100 KB.', 'logo.mimes' => 'Use a PNG, JPEG, WebP or SVG image.']);
        $file = $request->file('logo');
        $mime = $file->getMimeType();
        if (! in_array($mime, self::LOGO_TYPES, true)) {
            return response()->json(['message' => 'Use a PNG, JPEG, WebP or SVG image.', 'errors' => ['logo' => ['Use a PNG, JPEG, WebP or SVG image.']]], 422);
        }
        $site->forceFill(['brand_logo' => base64_encode((string) file_get_contents($file->getRealPath())), 'brand_logo_mime' => $mime])->save();
        $this->forget($site);

        return response()->json(['data' => (new SiteController)->present($site->fresh(), $request->user(), $request->attributes->get('role'))]);
    }

    public function deleteLogo(Request $request): JsonResponse
    {
        $site = $this->site($request);
        $site->forceFill(['brand_logo' => null, 'brand_logo_mime' => null])->save();
        $this->forget($site);

        return response()->json(['data' => (new SiteController)->present($site->fresh(), $request->user(), $request->attributes->get('role'))]);
    }

    private function site(Request $request): Site
    {
        return $request->attributes->get('site');
    }

    private function forget(Site $site): void
    {
        Cache::forget('tdm:site:'.$site->domain);
    }

    private function denyUnlessAllowed(Site $site): ?JsonResponse
    {
        if ($site->brandingAllowed()) {
            return null;
        }

        return response()->json(['error' => 'branding_unavailable', 'message' => 'Custom branding isn’t included in your plan.'], 403);
    }
}
