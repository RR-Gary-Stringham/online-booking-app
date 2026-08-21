# Booking Page and URL Contract

## Canonical application URL

`APP_URL` is the single canonical base URL for application routes, generated iframe URLs, and the Google OAuth callback. It must be an absolute URL and should include the Webflow Cloud mount path, for example `https://revrebel-rebuild.webflow.io/app`.

When the application moves to another domain, update `APP_URL` and register `${APP_URL}/api/auth/google/callback` as an authorized redirect URI in Google Cloud. Application code must not hardcode a deployment hostname or independently configure another application base URL.

## Webflow CMS collection

The booking-page collection ID is `6a88cd437008cead90d60fd1`. Configure it through `WEBFLOW_BOOKING_COLLECTION_ID`. The app-specific Webflow credential is `BOOKING_CALENDAR_API_KEY`; do not expose it to browser code.

Use application-specific secret names instead of a shared generic token name. This keeps each Webflow API credential traceable to the application that owns it when several applications run on the same Webflow site.

The collection template route is `/calendar/{slug}`. Its shared embed passes the CMS `meeting-template` value to the application as the calendar lookup key. The application database remains the source of truth for providers, templates, assignments, availability, and bookings.

### User page fields

- `slug`: URL-safe `firstname-lastname`, with a deterministic suffix if the value already exists.
- `meeting-template`: the same value as `slug`.
- `first-name`: the provider's first name.
- `last-name`: the provider's last name.
- `template-name`: `Book a Meeting with {first name}`.

Example: Gary Stringham maps to `gary-stringham`, with the template name `Book a Meeting with Gary`.

### Meeting-template page fields

- `slug`: the URL-safe template name, such as `partners`.
- `meeting-template`: the same value as `slug`.
- `first-name`: empty.
- `last-name`: empty.
- `template-name`: `Book a Meeting with REVREBEL`.

Webflow CMS items are public routing and presentation records. Provider and meeting-template changes originate in the application and synchronize to Webflow through server-only API routes.
