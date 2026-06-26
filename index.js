require("dotenv").config();
const express = require("express");
const { analyzeTicket } = require("./classifier");

const app = express();
app.use(express.json());

// ─── GET /health ────────────────────────────────────────────────────────────
// Returns exactly {"status":"ok"}
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ─── POST /analyze-ticket ───────────────────────────────────────────────────
app.post("/analyze-ticket", async (req, res) => {
  const {
    ticket_id,
    complaint,
    language,
    channel,
    user_type,
    campaign_context,
    transaction_history,
    metadata
  } = req.body;

  // Validation: 400 for missing required fields or malformed schema
  if (ticket_id === undefined || complaint === undefined) {
    return res.status(400).json({ error: "ticket_id and complaint are required fields" });
  }

  if (typeof ticket_id !== "string" || typeof complaint !== "string") {
    return res.status(400).json({ error: "ticket_id and complaint must be strings" });
  }

  // Validation: 422 for semantically invalid input (e.g. empty complaint)
  if (complaint.trim() === "") {
    return res.status(422).json({ error: "complaint is semantically invalid (cannot be empty)" });
  }

  try {
    const result = await analyzeTicket(
      ticket_id,
      complaint,
      transaction_history || [],
      language || "en",
      channel || "in_app_chat",
      user_type || "customer",
      campaign_context || null,
      metadata || null
    );

    return res.json({
      ticket_id: result.ticket_id,
      relevant_transaction_id: result.relevant_transaction_id,
      evidence_verdict: result.evidence_verdict,
      case_type: result.case_type,
      severity: result.severity,
      department: result.department,
      agent_summary: result.agent_summary,
      recommended_next_action: result.recommended_next_action,
      customer_reply: result.customer_reply,
      human_review_required: result.human_review_required,
      confidence: result.confidence,
      reason_codes: result.reason_codes || []
    });
  } catch (err) {
    console.error("Endpoint handling error:", err.message);
    // Safe fallback response that doesn't expose any sensitive information
    return res.status(500).json({
      error: "An internal server error occurred while processing the request."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
