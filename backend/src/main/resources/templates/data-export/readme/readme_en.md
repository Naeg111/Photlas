# Photlas Export Data

User: {{username}}
Exported at: {{exportedAt}}

This archive contains the data Photlas holds about you. It is provided as the
fulfillment of the right to data portability under Article 20 of the GDPR.

## File layout

| File / directory             | Description |
|------------------------------|-------------|
| `README.md`                  | This file (archive layout and field descriptions) |
| `user.json`                  | Profile information (username, email, language, etc.) |
| `profile_image.*`            | Profile picture, if one is set |
| `photos.json`                | Metadata for the photos you uploaded |
| `photos/`                    | Original photo files (`{photoId}.{ext}`) |
| `favorites.json`             | Photos you favorited |
| `sns_links.json`             | SNS links shown on your profile |
| `oauth.json`                 | OAuth connections (Google / LINE) |
| `reports.json`               | Reports you submitted |
| `sanctions.json`             | Account sanctions (admin free-text reasons removed) |
| `violations.json`            | Content violations (admin free-text reasons removed) |
| `location_suggestions.json`  | Location corrections you suggested on others' photos |
| `spots.json`                 | Photo spots you created |
| `errors.json`                | Errors encountered while building this archive (empty if none) |
| `_complete.flag`             | Archive completeness marker (presence = complete) |

## Notable fields

### `photos.json` — `moderationStatus`
- `1001` = PENDING_REVIEW
- `1002` = PUBLISHED
- `1003` = QUARANTINED
- `1004` = REMOVED — the image file itself is intentionally not included

### Date format
- All timestamps in the JSON files are **UTC** ISO 8601 (ending with `Z`, e.g. `2026-03-10T05:30:00Z`).
- Only this file and the notification email show times in the local time zone derived from your registered language.

## Important notes

- This archive contains personal data (email, photo coordinates, device info, etc.). Be careful when sharing it with anyone else.
- If `_complete.flag` is missing from the archive, the download may have been interrupted. Please request the export again.
- Photos with REMOVED status appear only as metadata; the image bytes are not redistributed.
- For questions or additional disclosure requests, contact support@photlas.jp.
