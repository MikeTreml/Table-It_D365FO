# Chrome Web Store Submission Checklist

Last verified against Chrome Web Store documentation: June 3, 2026

## Package

- Build command: `npm.cmd run build`
- Upload source: ZIP the contents of `dist/`, not the repository root.
- Latest measured production build:
  - Uncompressed `dist/`: 31.92 MB
  - ZIP package: 2.53 MB
  - Chrome Web Store package limit: 2 GB
- Manifest version: 3
- Manifest name: `Table It D365FO`
- Manifest description: `Browse tables and data entities for Microsoft Dynamics 365 Finance & Operations.`

## Required Store Listing Assets

- Store icon: 128x128 PNG
  - Existing package icon: `public/icon128.png`
- Screenshots: at least 1, up to 5 total
  - Required dimensions: 1280x800 or 640x400
  - Use square corners, no padding, full bleed
  - Prefer screenshots of the actual extension pages: Popup, Tables, Entities, OData Builder, Entity Data, Relations
- Small promotional image: 440x280 PNG or JPEG
  - Required for the listing
  - Should communicate the brand/product, not just be a screenshot
  - Avoid dense text because the image may be shown at smaller sizes
- Marquee promotional image: 1400x560 PNG or JPEG
  - Optional, but useful for better store presentation
- Promo video:
  - The dashboard supports a YouTube video URL
  - Treat as optional unless the dashboard requires it for the selected listing flow

## Privacy Tab Text

Single purpose description:

```text
Table It D365FO helps users browse Microsoft Dynamics 365 Finance & Operations tables, data entities, metadata, relations, and OData query results from environments they configure.
```

Remote code declaration:

```text
No, this extension does not execute remotely hosted code.
```

Data use summary:

```text
The extension stores user-configured Dynamics 365 environment settings, company/language preferences, theme preferences, and favorites in Chrome storage. It sends HTTPS requests to the user's configured Dynamics 365 Finance & Operations environment to display metadata and data in the extension UI. The publisher does not receive, sell, or use this data for advertising.
```

Privacy policy URL:

```text
https://miketreml.github.io/Table-It_D365FO/privacy-policy.html
```

## Permission Justifications

`storage`:

```text
Used to save user-configured Dynamics 365 environment profiles, company and language preferences, theme settings, and favorites.
```

`tabs`:

```text
Used to open extension pages and focus an existing Table It D365FO tab when users invoke extension shortcuts or navigation actions.
```

`https://*.dynamics.com/*`:

```text
Used to request metadata, entity lists, field metadata, and OData records from Microsoft Dynamics 365 Finance & Operations environments selected by the user.
```

## Review Notes

- The extension uses Manifest V3.
- The service worker is not split into shared chunks, which is required for reliable MV3 service worker loading.
- The host permission is limited to Dynamics 365 domains rather than broad patterns such as `<all_urls>`.
- The production build currently includes large bundled metadata JSON files. This is not a Chrome Web Store upload blocker, but it may be worth optimizing later for startup performance.

## Pre-Submit Commands

Run these before creating the final ZIP:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd run build
```

Create the upload ZIP from PowerShell:

```powershell
$zip = Join-Path (Get-Location) 'table-it-d365fo-upload.zip'
if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -Path .\dist\* -DestinationPath $zip -CompressionLevel Optimal
```
