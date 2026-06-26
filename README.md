# QueueStorm Investigator — bKash CRM Ticket Classifier

A robust, high-performance web service that automatically classifies customer support tickets for digital finance platforms. It supports **English**, **Bengali script**, and **Banglish** (romanized Bengali), uses Google Gemini 2.5 Flash as the primary LLM with a full offline rules-based fallback, and enforces strict safety guardrails on every response.

---

## Quick Start (Copy-Paste Runbook)

> A stranger should be able to run this service in under 2 minutes using the steps below.

### Prerequisites
- Node.js **v20.x** or higher
- npm **v10.x** or higher
- A **Gemini API Key** (free at [aistudio.google.com](https://aistudio.google.com))

### Step 1 — Clone the Repository
```bash
git clone https://github.com/SUSMITA-GOSH/QueueStorm-Investigator-.git
cd QueueStorm-Investigator-
```

### Step 2 — Install Dependencies
```bash
npm install
```

### Step 3 — Configure Environment
```bash
cp .env.example .env
```
Open `.env` and fill in your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```
> **Note**: If no API key is provided, the service automatically falls back to the offline rules-based classifier. All endpoints remain fully functional.

### Step 4 — Start the Server
```bash
npm start
```
You should see:
```
Server running on port 3000
```

### Step 5 — Verify the Endpoints
In a **new terminal window**, run:

**Health Check:**
```bash
curl http://localhost:3000/health
```
Expected response:
```json
{"status":"ok"}
```

**Analyze a Ticket:**
```bash
curl -X POST http://localhost:3000/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TKT-001",
    "complaint": "I sent 5000 taka to a wrong number around 2pm today",
    "language": "en",
    "channel": "in_app_chat",
    "user_type": "customer",
    "campaign_context": "boishakh_bonanza_day_1",
    "transaction_history": [
      {
        "transaction_id": "TXN-9101",
        "timestamp": "2026-04-14T14:08:22Z",
        "type": "transfer",
        "amount": 5000,
        "counterparty": "+8801719876543",
        "status": "completed"
      }
    ]
  }'
```

---

## API Contract

### `GET /health`
Returns service readiness status.
```json
{"status": "ok"}
```

### `POST /analyze-ticket`
Analyzes a customer support ticket and returns a structured classification response.

**Request Schema:**
```json
{
  "ticket_id": "TKT-001",
  "complaint": "Customer complaint text in English, Bangla, or Banglish",
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "campaign_context": "boishakh_bonanza_day_1",
  "transaction_history": [...]
}
```

**Response Schema:**
```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending 5000 BDT to wrong number via TXN-9101.",
  "recommended_next_action": "Verify TXN-9101 and initiate recovery process.",
  "customer_reply": "We have received your dispute. Any eligible amount will be returned through official channels.",
  "human_review_required": true,
  "confidence": 0.9,
  "reason_codes": ["wrong_transfer", "transaction_match"]
}
```

**HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| `200` | Successful analysis |
| `400` | Missing required fields (`ticket_id` or `complaint`) |
| `422` | Semantically invalid input (e.g. empty complaint) |
| `500` | Internal server error (no sensitive info exposed) |

---

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js v20+ |
| Framework | Express |
| Primary LLM | Google Gemini 2.5 Flash (via REST API) |
| Fallback | Offline rule-based classifier |
| Environment | dotenv |

---

## MODELS

| Model | Host | Why Chosen |
|---|---|---|
| **gemini-2.5-flash** | Google Generative Language API | ~2–5s latency, native JSON schema outputs, strong multilingual support, very low cost |
| **Rules Classifier** | Local CPU (zero cost) | 100% uptime fallback — handles rate limits, timeouts, and missing API keys seamlessly |

---

## AI Approach — Hybrid Architecture

1. **Primary (LLM)**: Calls `gemini-2.5-flash` with a strict **8-second timeout** and a native `responseSchema` ensuring absolute JSON compliance.
2. **Fallback (Rules)**: If the LLM times out, returns a 429/500 error, or no API key is configured, the service instantly falls back to `rulesClassifier.js` — an offline keyword/regex engine supporting English, Bangla script, and Banglish.

---

## Safety Guardrails

All responses pass through a post-processing safety engine that:
1. **Blocks credential requests** — Never asks for PIN, OTP, password, or card number in any output field.
2. **Prevents unauthorized commitments** — Rewrites any "we will refund you" phrasing to conditional official language.
3. **Sanitizes third-party contacts** — Removes phone numbers and external URLs from customer-facing replies.
4. **Resists prompt injection** — System prompt instructs the model to ignore instructions embedded in complaint text.

---

## Running the Test Suite
```bash
node scratch/test_classifier.js
```
Covers 13 test cases across English, Bengali script, and Banglish. All 13 pass ✅.

---

## Known Limitations
- Without an API key, the rules classifier handles all tickets using keyword matching — high accuracy for common finance flows but less nuanced than LLM analysis.
- Gemini free tier may rate-limit under very high concurrent load; the fallback classifier ensures zero downtime.
