# MindScribe AI Journal — User-Authenticated Gemini & Firestore Workspace

MindScribe is a privacy-first, full-stack journal and multi-turn reflection workspace powered by Google Gemini 3.8 Flash and Cloud Firestore. Built with zero-password Federated Google Authentication, server-side API proxying, and strict owner-bound database rules.

---

## 🛡️ Threat Model & Security Architecture

| Threat Zone | Threat Scenario & Vector | Countermeasure & Security Mitigation |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious injection payloads, oversized journal prompts, malformed multi-turn arrays. | Strict input schema validation, payload length limits (`size() <= 10000`), server-side JSON deserialization defense. |
| **2. Planning & Reasoning** | System instruction bypass, jailbreak attempts, indirect prompt injection. | Delimited user inputs, system role instructions treating journal entries strictly as passive reflection content. |
| **3. Tool & API Execution** | Server-side SSRF, unhandled rate limits, model failure cascading. | Server-side Gemini API proxy, resilient fallback ladder (`gemini-3.8-flash` &rarr; `gemini-flash-latest` &rarr; `gemini-3.1-flash-lite`), zero client-exposed API keys. |
| **4. Memory & State** | Cross-user data leaks, unauthorized reads/writes in Firestore. | Hardened owner-isolated security rules (`/users/{userId}/interactions/{interactionId}` where `request.auth.uid == userId`), strict verification of `request.auth.token.email_verified`. |
| **5. Inter-System Communication** | Secret leakage, unauthorized API access, client token spoofing. | Google Secret Manager / backend environment variable bindings for `GEMINI_API_KEY`, Firebase Auth JWT context verification. |

---

## 🔒 Cloud Firestore Security Rules

Deploy the following owner-bound isolation rules to protect user journal records, cross-entry insights, and action items:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/insights/{insightId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/actionItems/{actionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

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

### 3. Deploy to Google Cloud Run (Using Dockerfile)

**Option A: Deploy directly from directory (Cloud Build builds the Dockerfile):**
```bash
gcloud run deploy mindscribe-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 8080
```

**Option B: Build Container Image & Push to Artifact Registry:**
```bash
# Build container image with Google Cloud Build
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/mindscribe-journal:latest .

# Deploy container image to Cloud Run
gcloud run deploy mindscribe-journal \
  --image gcr.io/$(gcloud config get-value project)/mindscribe-journal:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 8080
```

### 4. Apply Mandatory Verification Campaign Label
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
| **TC-02** | Mindful Reflection & Gemini AI | 1. Select the **Mindful Reflection** mode.<br>2. Pick a mood (e.g. *Calm* or *Inspired*).<br>3. Type a journal entry into the composer.<br>4. Click **Reflect with Gemini** (or press Ctrl+Enter). | Loading spinner activates; Gemini 3.6 Flash responds with empathetic analysis, Markdown formatting, and auto-generated summary chips. |
| **TC-03** | Multi-Turn Continuation | 1. In an active reflection, type a follow-up inquiry into the bottom textarea.<br>2. Submit the follow-up. | Gemini responds with contextually aware continuous dialogue within the same conversation thread. |
| **TC-04** | Mode Exploration | 1. Start a new entry.<br>2. Switch mode to **Brainstorm Sparks**, **Executive Summary**, **Action Blueprint**, or **Socratic Inquiry**.<br>3. Submit input. | AI persona dynamically adapts tone and structure (e.g. step-by-step action items with timelines for Action Blueprint). |
| **TC-05** | Firestore Data Persistence & Isolation | 1. Complete an entry.<br>2. Refresh the browser.<br>3. Click **Past Entries** in the top navigation. | Entry appears in the Firestore list with timestamp, mode tag, mood badge, and turn count. Only current user's records are visible. |
| **TC-06** | Search & Tag Filtering | 1. Navigate to **Past Entries**.<br>2. Enter a keyword in the search bar or select a mode/tag/date filter. | The list dynamically updates in real-time to display only matching records. |
| **TC-07** | Copy & Export | 1. Open an entry detail view.<br>2. Click **Copy Entry**. | Formatted Markdown representation containing summary, key insights, and dialogue history is copied to clipboard with visual confirmation. |
| **TC-08** | Deletion Safeguard | 1. Click the trash icon on an entry.<br>2. Verify the warning dialog.<br>3. Click **Permanently Delete**. | Document is removed from Firestore and immediately disappears from the UI list. |
| **TC-09** | Security Transparency | 1. Click the shield icon in the navigation bar. | Architecture modal opens displaying the 5 Threat Zones, Firestore security rules snippet, and resilient model fallback ladder. |
| **TC-10** | Reflection Intelligence Analysis | 1. Click **Insights** in top navigation.<br>2. Click **Synthesize New Reflection Intelligence**.<br>3. Observe progress and results. | Backend verifies Firebase auth token, sends only entry summaries to Gemini, extracts overarching themes/growth/action items, and persists to Firestore. |
| **TC-11** | Action Item Tracker | 1. On the **Insights** view, locate the Action Items tracker.<br>2. Toggle action item checkboxes, or add a custom action item.<br>3. Filter by 'Active' or 'Completed'. | Action item completion status immediately updates in Firestore with optimistic UI feedback. |
| **TC-12** | Token-Based Security Verification | 1. Trigger an Insights synthesis or Action extraction.<br>2. Inspect network tab. | Request includes `Authorization: Bearer <token>`. Backend extracts verified `sub` claim and refuses unauthenticated or forged requests. |
