# MindScribe Project Directives & Custom Instructions

## 1. Google Maps Directive (Location-Aware Entries)
- **API Key Security**: The Google Maps Platform API key is declared as `VITE_GOOGLE_MAPS_API_KEY` in `.env.example`. In production, the key MUST be restricted by HTTP referrer origin to the application URL and scoped strictly to the **Maps JavaScript API** and **Places API (New)**.
- **Client-Side Initialization**: Google Maps libraries (`places`, `marker`) are initialized via `@vis.gl/react-google-maps` `APIProvider` at the app root level.
- **Privacy & Zero Auto-Tracking**: Never invoke automatic browser geolocation (`navigator.geolocation.getCurrentPosition`) without direct user intent. Location attachment is strictly user-initiated via debounced autocomplete search.
- **Data Retention & Removal**: Location metadata (`name`, `placeId`, `formattedAddress`, `latitude`, `longitude`) is saved only within the authenticated user's isolated Firestore document (`/users/{userId}/interactions/{interactionId}`). Users retain the right to inspect location details via map modal and delete location pins at any time.

## 2. Admin Roles & Role-Based Access Control (RBAC) Directive
- **Role Hierarchy**: Define discrete roles: `member`, `admin`, and `superadmin`.
- **Role Storage & Security Validation**: Roles are persisted in Cloud Firestore under `/roles/{userId}`.
- **Firestore Security Rules Enforcement**:
  - Regular users can read their own role document (`/roles/{request.auth.uid}`).
  - Elevated admin endpoints and collections (system analytics, audit logs, role assignments) require role validation: `get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role in ['admin', 'superadmin']`.
- **Admin Dashboard Capabilities**:
  - System Overview & KPI metrics (total reflection counts, active user engagement, AI model utilization).
  - Role management (promoting/demoting users, permission matrix).
  - Real-time Security & Audit Log monitoring (auth events, webhook dispatches, role elevations).

## 3. External Notifications & Webhooks Directive (Slack / Discord / Custom Webhooks)
- **Server-Side Dispatch Proxy**: Webhook deliveries MUST be proxied through the backend server (`/api/notifications/dispatch` and `/api/notifications/test`) to prevent browser CORS restrictions and keep target destination endpoints safe from arbitrary client-side tampering.
- **Payload Formatting & Adaptability**:
  - **Slack**: Formatted using Slack Block Kit (Header blocks, Section blocks with markdown, Context blocks for mood/location/tags, and Action Item checklists).
  - **Discord**: Formatted as Discord Rich Embeds with color-coding mapped to reflection moods (e.g. green for productive, blue for calm, purple for deep inquiry, amber for brainstorm).
  - **Custom Webhook / HTTP Endpoint**: Formatted as JSON with `event`, `timestamp`, `reflection`, `insights`, and `actionItems`.
- **Trigger Conditions**: Users can filter notifications to trigger on:
  - All saved reflections
  - Only when concrete action items / goals are extracted
  - Specific reflection modes (e.g., `action_plan`, `deep_inquiry`)
- **Error Handling**: Graceful fallback and timeout handling (5-second timeout, status feedback, logging to security audit).
