# MindScribe AI Journal — User-Authenticated Gemini & Firestore Workspace

MindScribe is a privacy-first, full-stack journal and multi-turn reflection workspace powered by Google Gemini and Cloud Firestore. Built with zero-password Federated Google Authentication, server-side API proxying, and strict owner-bound database rules.

---

## 🛡️ Threat Model & Security Architecture

| Threat Zone | Threat Scenario & Vector | Countermeasure & Security Mitigation |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious injection payloads, oversized journal prompts, malformed multi-turn arrays. | Strict input schema validation, payload length limits (`size() <= 10000`), server-side JSON deserialization defense. |
| **2. Planning & Reasoning** | System instruction bypass, jailbreak attempts, indirect prompt injection. | Delimited user inputs, system role instructions treating journal entries strictly as passive reflection content. |
| **3. Tool & API Execution** | Server-side SSRF, unhandled rate limits, model failure cascading. | Server-side Gemini proxy with zero client-exposed API keys; webhook destinations are HTTPS-only, DNS-resolved and rejected if they point at loopback/private/link-local/metadata addresses, with redirects disabled and a 5s timeout; per-user in-memory rate limits on every AI and webhook route; resilient model fallback ladder. |
| **4. Memory & State** | Cross-user data leaks, unauthorized reads/writes in Firestore, privilege escalation. | Owner-bound rules on every `/users/{userId}/**` collection (admins have no read access to other users' journals); `/roles/{uid}` is read-only to its owner and self-bootstrap is pinned to `member`, so self-promotion is impossible; `/audit_logs` is append-only, admin-read, and each entry is pinned to the caller's uid. |
| **5. Inter-System Communication** | Secret leakage, unauthorized API access, client token spoofing. | `GEMINI_API_KEY` bound from Secret Manager at runtime and never inlined into the client bundle; every `/api/*` route verifies the caller's Firebase ID token **signature** through the Admin SDK (`verifyIdToken`), so forged or expired tokens are rejected. |

---

## 🔒 Cloud Firestore Security Rules

The authoritative rules live in [`firestore.rules`](./firestore.rules) and are deployed with
`firebase deploy --only firestore:rules`. The guarantees they enforce:

| Path | Guarantee |
| :--- | :--- |
| `/users/{uid}/interactions`, `/insights`, `/actionItems`, `/webhooks` | Readable and writable **only** by the owning user. Administrators have no access to other people's journals by design. Writes are size- and shape-validated. |
| `/roles/{uid}` | The owner may read their own role but can never write one. First sign-in self-bootstrap is pinned to `member`. Only an admin may change a role; only a superadmin may grant `superadmin`. |
| `/audit_logs/{id}` | Append-only. Readable by admins only. `actorId` must equal the caller's uid, so events cannot be forged onto another user. Updates and deletes are denied outright. |
| everything else | Denied by a catch-all `allow read, write: if false`. |

> **Note on demo mode.** `ALLOW_DEMO_MODE=true` makes the backend accept unsigned
> `demo-token-*` bearer tokens so reviewers can try the app without a Google
> account. It bypasses signature verification by design and must stay off in any
> deployment holding real user data. Demo sessions never touch Firestore — their
> data lives in the browser's `localStorage`.

## 🚀 Step-by-Step Google Cloud Deployment Guide

### Prerequisites
- [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) installed and initialized.
- A Google Cloud project with billing enabled.

### 1. Enable Required Google Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

### 2. Secret Management Setup (Zero Hardcoding)

Store your Gemini API key in Google Secret Manager and grant Cloud Run runtime access:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run compute service account access
export PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

The runtime service account also needs Firestore access, which the backend uses to
verify ID tokens and compute admin metrics:

```bash
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.viewer"
```

### 3. Configure environment

There is **no** committed Firebase config file. Server settings come from
environment variables at runtime; browser settings are inlined by Vite at build
time. Copy `.env.example` to `.env` for local development, and pass the same
values to Cloud Build / Cloud Run for deploys. See `.env.example` for the full,
annotated list.

| Variable | Where | Purpose |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | runtime (Secret Manager) | Gemini access. Never sent to the browser. |
| `FIREBASE_PROJECT_ID` | runtime | Project whose ID tokens are accepted. Auto-set on Cloud Run via `GOOGLE_CLOUD_PROJECT`. |
| `FIRESTORE_DATABASE_ID` | runtime | Named database; blank for `(default)`. |
| `ADMIN_EMAILS` | runtime | Comma-separated emails always treated as superadmin. |
| `ALLOW_DEMO_MODE` | runtime | `true` accepts unsigned demo tokens. Leave off in production. |
| `VITE_FIREBASE_*` | build | Public Firebase client identifiers. |
| `VITE_GOOGLE_MAPS_API_KEY` | build | Maps/Places browser key, referrer-restricted. |

### 4. Deploy to Google Cloud Run

```bash
gcloud run deploy mindscribe-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="ADMIN_EMAILS=you@example.com" \
  --port 8080
```

`--source .` builds the Dockerfile with Cloud Build. Because `VITE_*` values are
inlined at build time, pass them as build args when you build the image yourself:

```bash
gcloud builds submit \
  --tag gcr.io/$(gcloud config get-value project)/mindscribe-journal:latest \
  --substitutions=_API_KEY="$VITE_FIREBASE_API_KEY" .

# or with plain docker:
docker build \
  --build-arg VITE_FIREBASE_API_KEY="..." \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="..." \
  --build-arg VITE_FIREBASE_PROJECT_ID="..." \
  --build-arg VITE_FIREBASE_APP_ID="..." \
  --build-arg VITE_GOOGLE_MAPS_API_KEY="..." \
  -t mindscribe-journal .
```

### 5. Authorize the deployed domain for Google Sign-In

Google sign-in fails with `auth/unauthorized-domain` until the Cloud Run hostname is
allowlisted. The app shows the exact hostname and a copy button when this happens.

1. Firebase Console → **Authentication → Settings → Authorized domains**
2. **Add domain**, paste the Cloud Run hostname, save.

### 6. Apply Mandatory Verification Campaign Label
Register the Cloud Run deployment for automated verification:

```bash
gcloud run services update mindscribe-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 Functional Verification & Walkthrough Test Cases

| Test Case ID | Feature / Flow | Step-by-Step User Interaction | Expected Observable Behavior |
| :--- | :--- | :--- | :--- |
| **TC-01** | Landing & Google Auth | 1. Navigate to the app root.<br>2. Click **Sign In with Google**.<br>3. Select an authenticated Google Account in the popup. | Popup closes smoothly; user profile avatar, display name, and the private reflection editor dashboard render instantly. |
| **TC-02** | Mindful Reflection & Gemini AI | 1. Select the **Mindful Reflection** mode.<br>2. Pick a mood (e.g. *Calm* or *Inspired*).<br>3. Type a journal entry into the composer.<br>4. Click **Reflect with Gemini** (or press Ctrl+Enter). | Loading spinner activates; Gemini responds with empathetic analysis, Markdown formatting, and auto-generated summary chips. |
| **TC-03** | Multi-Turn Continuation | 1. In an active reflection, type a follow-up inquiry into the bottom textarea.<br>2. Submit the follow-up. | Gemini responds with contextually aware continuous dialogue within the same conversation thread. |
| **TC-04** | Mode Exploration | 1. Start a new entry.<br>2. Switch mode to **Brainstorm Sparks**, **Executive Summary**, **Action Blueprint**, or **Socratic Inquiry**.<br>3. Submit input. | AI persona dynamically adapts tone and structure (e.g. step-by-step action items with timelines for Action Blueprint). |
| **TC-05** | Firestore Data Persistence & Isolation | 1. Complete an entry.<br>2. Refresh the browser.<br>3. Click **Past Entries** in the top navigation. | Entry appears in the Firestore list with timestamp, mode tag, mood badge, and turn count. Only current user's records are visible. |
| **TC-06** | Search & Tag Filtering | 1. Navigate to **Past Entries**.<br>2. Enter a keyword in the search bar or select a mode/tag/date filter. | The list dynamically updates in real-time to display only matching records. |
| **TC-07** | Copy & Export | 1. Open an entry detail view.<br>2. Click **Copy Entry**. | Formatted Markdown representation containing summary, key insights, and dialogue history is copied to clipboard with visual confirmation. |
| **TC-08** | Deletion Safeguard | 1. Click the trash icon on an entry.<br>2. Verify the warning dialog.<br>3. Click **Permanently Delete**. | Document is removed from Firestore and immediately disappears from the UI list. |
| **TC-09** | Security Transparency | 1. Click the shield icon in the navigation bar. | Architecture modal opens displaying the 5 Threat Zones, Firestore security rules snippet, and resilient model fallback ladder. |
| **TC-10** | Reflection Intelligence Analysis | 1. Click **Insights** in top navigation.<br>2. Click **Synthesize New Reflection Intelligence**.<br>3. Observe progress and results. | Backend verifies Firebase auth token, sends only entry summaries to Gemini, extracts overarching themes/growth/action items, and persists to Firestore. |
| **TC-11** | Action Item Tracker | 1. On the **Insights** view, locate the Action Items tracker.<br>2. Toggle action item checkboxes, or add a custom action item.<br>3. Filter by 'Active' or 'Completed'. | Action item completion status immediately updates in Firestore with optimistic UI feedback. |
| **TC-12** | Token-Based Security Verification | 1. Trigger any AI action.<br>2. Inspect the network tab.<br>3. Replay the request with a tampered token. | Every `/api/*` request carries `Authorization: Bearer <token>`. The backend verifies the signature via the Firebase Admin SDK, so a tampered, expired or foreign-project token is rejected with 401. |
