# MindScribe Project Directives & Custom Instructions

## 1. Google Maps Directive (Location-Aware Entries)
- **API Key Security**: The Google Maps Platform API key is declared as `VITE_GOOGLE_MAPS_API_KEY` in `.env.example` and passed to the Docker build as a build arg (Vite inlines `VITE_*` at build time). In production, the key MUST be restricted by HTTP referrer origin to the application URL and scoped strictly to the **Maps JavaScript API** and **Places API (New)**.
- **Client-Side Initialization**: Google Maps libraries (`places`, `marker`) are initialized via `@vis.gl/react-google-maps` `APIProvider` at the app root level.
- **Privacy & Zero Auto-Tracking**: Never invoke automatic browser geolocation (`navigator.geolocation.getCurrentPosition`) without direct user intent. Location attachment is strictly user-initiated via debounced autocomplete search.
- **Data Retention & Removal**: Location metadata (`name`, `placeId`, `formattedAddress`, `latitude`, `longitude`) is saved only within the authenticated user's isolated Firestore document (`/users/{userId}/interactions/{interactionId}`). Users retain the right to inspect location details via map modal and delete location pins at any time.

## 2. Admin Roles & Role-Based Access Control (RBAC) Directive
- **Role Hierarchy**: Define discrete roles: `member`, `admin`, and `superadmin`.
- **Role Storage & Security Validation**: Roles are persisted in Cloud Firestore under `/roles/{userId}`.
- **Firestore Security Rules Enforcement**:
  - Users may READ their own role document but may never WRITE any role document. Self-bootstrap on first sign-in is pinned to `role == 'member'`, so a user cannot promote themselves.
  - Role changes require `get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role in ['admin', 'superadmin']`; granting `superadmin` additionally requires the caller to already be `superadmin`.
  - New accounts default to `member`. Elevation is a deliberate admin action, and a failed role lookup fails closed to `member` rather than granting access.
  - Admins do NOT get read access to other users' journal data. `/users/{uid}/**` stays strictly owner-bound.
- **Admin Dashboard Capabilities**:
  - System Overview & KPI metrics (total reflection counts, active user engagement, AI model utilization).
  - Role management (promoting/demoting users, permission matrix).
  - Real-time Security & Audit Log monitoring (auth events, webhook dispatches, role elevations).

## 3. External Notifications & Webhooks Directive (Slack / Discord / Custom Webhooks)
- **Server-Side Dispatch Proxy**: Webhook deliveries MUST be proxied through the backend server (`/api/notifications/dispatch` and `/api/notifications/test`) to prevent browser CORS restrictions and keep target destination endpoints safe from arbitrary client-side tampering.
- **Authentication**: Both endpoints require a verified Firebase ID token. They are never open relays.
- **SSRF Defence**: destination URLs must be HTTPS, must not carry credentials, and are rejected when the host is `localhost`, a `.internal`/`.local` name, a metadata endpoint, or resolves (via DNS) to a loopback, private, CGNAT, link-local, unique-local or IPv4-mapped-private address. Redirects are not followed (`redirect: 'manual'`), so a 302 cannot be used to reach an internal host.
- **Payload Formatting & Adaptability**:
  - **Slack**: Formatted using Slack Block Kit (Header blocks, Section blocks with markdown, Context blocks for mood/location/tags, and Action Item checklists).
  - **Discord**: Formatted as Discord Rich Embeds with color-coding mapped to reflection moods (e.g. green for productive, blue for calm, purple for deep inquiry, amber for brainstorm).
  - **Custom Webhook / HTTP Endpoint**: Formatted as JSON with `event`, `timestamp`, `reflection`, `insights`, and `actionItems`.
- **Trigger Conditions**: Users can filter notifications to trigger on:
  - All saved reflections
  - Only when concrete action items / goals are extracted
  - Specific reflection modes (e.g., `action_plan`, `deep_inquiry`)
- **Error Handling**: 5-second `AbortController` timeout on every delivery, response bodies truncated to 200 characters before being surfaced, per-user rate limits (10/min for tests, 30/min for dispatches), status feedback in the editor, and logging to the security audit trail. Failed deliveries are counted and reported to the user rather than silently swallowed.
