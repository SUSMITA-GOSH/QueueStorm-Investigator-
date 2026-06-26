# QueueStorm Investigator - bKash CRM Ticket Classifier

A robust, high-performance web service built with Node.js and Express to automatically classify customer support tickets for digital finance platforms (bKash). It classifies tickets, identifies routing departments, assigns severity, evaluates transaction consistency, drafts safe replies, and determines human review necessity.

---

## 1. Tech Stack
* **Runtime Environment**: Node.js (v20.x or higher)
* **Web Framework**: Express
* **LLM Integration**: Google Gemini REST API (v1beta) using `fetch`
* **Local Test Suite**: Node.js standard runtime

---

## 2. AI Approach & Hybrid Architecture

This application employs a **Hybrid Classifier Architecture** designed for high throughput, absolute resilience, and strict runtime compliance:

1. **LLM Classifier (Primary)**: Uses **Gemini 2.5 Flash** as the primary classifier. We enforce structured JSON responses directly at the model level via a JSON Schema configuration (`responseSchema`), preventing format syntax errors.
2. **Strict Time Budgeting**: The LLM API call is wrapped in a strict **8-second timeout**. If the API call exceeds 8 seconds, rate-limits, or fails due to an invalid key, the service immediately falls back.
3. **Optimized Rules-Based Fallback**: Seamlessly falls back to an offline rule-based classifier (`rulesClassifier.js`). The fallback engine uses keyword heuristics, regexes, and distance matching for English, Bangla script, and phonetic Banglish (e.g., "vul number e taka gese").

---

## 3. MODELS Section

| Model Name | Host | Cost Profile | Why Chosen? |
| :--- | :--- | :--- | :--- |
| **gemini-2.5-flash** | Google Cloud (Generative Language API) | Extremely low ($0.075 / 1M input tokens) | High speed (~1.7s response latency), full support for native JSON schemas, robust reasoning, and strong multilingual capabilities. |
| **Rules Classifier** | Local CPU (In-memory execution) | $0.00 (Offline, zero cost) | Provides 100% service uptime. Serves as a latency-free fallback when API keys are missing, invalid, or rate-limited. |

---

## 4. Safety Logic & Guardrails

We implement a multi-layered post-processing safety engine (`applySafetyGuardrails`) to satisfy operational rules:

1. **Secret Credentials Safeguard**: Checks the drafted replies and summaries. If any phrase requests critical details (PIN, OTP, password, card numbers), the text is censored and replaced with a standard warning message.
2. **Authority-less Commitments Filter**: Scans responses for definitive phrases like "we will refund you". Any promise is rewritten to conditional official language (e.g., "any eligible amount will be returned through official channels after review").
3. **Suspicious Contact Blocker**: Dynamically sanitizes phone numbers and URLs from the output replies to prevent directing customers to fake numbers or phishing web portals.

---

## 5. Setup & Runbook

### Step 1: Install Dependencies
Navigate to the project directory and run:
```bash
npm install
```

### Step 2: Configure Environment
Copy the example environment file and open `.env` to insert your Gemini API Key:
```bash
cp .env.example .env
```
Ensure it contains:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

### Step 3: Run the Application
Start the server locally:
```bash
npm start
```
The server will bind to port `3000`.

---

## 6. Verification and Testing

### Automated Test Suite
Run the localized test suite checking English, Bengali script, and Banglish test cases:
```bash
node scratch/test_classifier.js
```

### Manual Testing
* **Health Check**:
  ```bash
  curl -s http://localhost:3000/health
  # Returns: {"status":"ok"}
  ```

* **Ticket Analysis**:
  ```bash
  curl -s -X POST http://localhost:3000/analyze-ticket \
    -H "Content-Type: application/json" \
    -d '{
      "ticket_id": "TKT-001",
      "complaint": "bhul number e taka send money hoye gese, recover help koren"
    }'
  ```

---

## 7. Assumptions & Known Limitations
* **Assumptions**: The system assumes the incoming request body has at least a string `ticket_id` and a string `complaint`. Language, channel, user type, and transaction history are optional.
* **Limitations**: When running completely without API keys, the rules classifier matches keywords and regex patterns. While highly accurate for common finance flows, it cannot parse complex contextual nuances as well as the LLM.
