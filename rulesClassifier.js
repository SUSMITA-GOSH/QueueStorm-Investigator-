/**
 * QueueStorm Investigator Rules-Based Classifier
 * Supports English, Bangla, and Banglish (Romanized Bangla).
 */

const banglaToEnglishDigits = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

function normalizeText(text) {
  if (!text) return "";
  let normalized = text.toLowerCase();
  
  // Convert Bangla digits to English digits
  for (const [bangla, english] of Object.entries(banglaToEnglishDigits)) {
    normalized = normalized.split(bangla).join(english);
  }
  return normalized;
}

function extractNumbers(text) {
  const normalized = normalizeText(text);
  // Match 3 to 7 digit numbers (representing BDT amounts)
  const matches = normalized.match(/\b\d{3,7}\b/g) || [];
  return matches.map(Number);
}

function extractPhoneNumbers(text) {
  const normalized = normalizeText(text);
  // Match sequences of digits that look like phone numbers (9 to 14 digits)
  const matches = normalized.match(/\+?\d{9,14}\b/g) || [];
  return matches.map(num => normalizeCounterparty(num)).filter(Boolean);
}

function normalizeCounterparty(cp) {
  if (!cp) return "";
  const cleaned = cp.replace(/[+\-\s]/g, "");
  // Keep only digits if it looks like a phone number, returning last 10 digits
  if (/^\d{10,14}$/.test(cleaned)) {
    return cleaned.slice(-10);
  }
  return cleaned.toLowerCase();
}

function matchTransaction(complaint, history = []) {
  if (!history || history.length === 0) {
    return null;
  }

  const normalizedComplaint = normalizeText(complaint);
  const complaintNumbers = extractNumbers(normalizedComplaint);
  const complaintPhones = extractPhoneNumbers(normalizedComplaint);

  let bestTx = null;
  let bestScore = -1;

  for (const tx of history) {
    let score = 0;
    const txId = tx.transaction_id ? tx.transaction_id.toLowerCase() : "";
    const cleanTxId = txId.replace(/[^a-z0-9]/g, "");

    // 1. Transaction ID match (exact or substring)
    if (txId && normalizedComplaint.includes(txId)) {
      score += 100;
    } else if (cleanTxId && normalizedComplaint.replace(/[^a-z0-9]/g, "").includes(cleanTxId)) {
      score += 90;
    } else {
      // Check if last few digits of ID match
      const suffix = txId.replace(/[^0-9]/g, "");
      if (suffix && suffix.length >= 3 && normalizedComplaint.includes(suffix)) {
        score += 50;
      }
    }

    // 2. Amount match
    if (tx.amount && complaintNumbers.includes(Number(tx.amount))) {
      score += 30;
    }

    // 3. Counterparty match
    if (tx.counterparty) {
      const normTxCp = normalizeCounterparty(tx.counterparty);
      if (normTxCp && complaintPhones.includes(normTxCp)) {
        score += 30;
      }
    }

    // 4. Type match based on complaint context
    const txType = tx.type ? tx.type.toLowerCase() : "";
    if (txType === "transfer" && (normalizedComplaint.includes("transfer") || normalizedComplaint.includes("sent") || normalizedComplaint.includes("send") || normalizedComplaint.includes("bhul") || normalizedComplaint.includes("vul"))) {
      score += 5;
    } else if (txType === "payment" && (normalizedComplaint.includes("pay") || normalizedComplaint.includes("bill") || normalizedComplaint.includes("charge"))) {
      score += 5;
    } else if (txType === "cash_in" && (normalizedComplaint.includes("cash in") || normalizedComplaint.includes("cashin") || normalizedComplaint.includes("deposit"))) {
      score += 5;
    } else if (txType === "settlement" && (normalizedComplaint.includes("settlement") || normalizedComplaint.includes("settle"))) {
      score += 5;
    } else if (txType === "refund" && (normalizedComplaint.includes("refund") || normalizedComplaint.includes("ferot") || normalizedComplaint.includes("return"))) {
      score += 5;
    }

    if (score > 0 && score > bestScore) {
      bestScore = score;
      bestTx = tx;
    }
  }

  return bestTx;
}

function classifyTicket(ticket_id, complaint, transaction_history = [], language = "en", channel = "in_app_chat", user_type = "customer", campaign_context = null, metadata = null) {
  const cleanMsg = normalizeText(complaint);

  // 1. Phishing & Social Engineering Keywords
  const phishingKeywords = [
    "otp", "pin", "password", "pincode", "pass code", "verification code", "security code",
    "scam", "scammer", "fraud", "fake call", "scam call", "fake sms", "asking my pin",
    "asking for pin", "asking otp", "asking for otp", "shared pin", "shared otp",
    "bkash agent call", "hacked", "cyber fraud", "scam sms", "agent call",
    "protarok", "heker", "hacker", "vua call", "vua phn", "vua phone", "agent seje",
    "ওটিপি", "পিন নম্বর", "পিন নাম্বার", "পাসওয়ার্ড", "হ্যাকার", "প্রতারণা", "প্রতারক",
    "ফেক কল", "ভুয়া কল", "ভুয়া ফোন", "পিন চাচ্ছে", "ওটিপি চাচ্ছে", "পিন নাম্বার চাচ্ছে",
    "এজেন্ট সেজে", "পাসওয়ার্ড চাচ্ছে", "পিন দিন", "পিন দিননি", "পাসকোড"
  ];

  // 2. Wrong Transfer Keywords
  const wrongTransferKeywords = [
    "wrong number", "wrong numbers", "wrong mobile", "wrong recipient", "wrong transfer",
    "wrong person", "wrong sent", "wrongly sent", "wrong send", "send money wrong",
    "sent money wrong", "wrong no", "transferred wrong", "transferred to wrong",
    "wrong account", "wrong acc", "send wrong", "sent wrong", "wrong trans",
    "bhul number", "bhul numbere", "bhul mobile", "bhul account", "bhul acc",
    "bhul tk", "bhul taka", "bhul sen", "bhul send", "bhul transfer", "bhul pay",
    "vul number", "vul numbere", "vul mobile", "vul account", "vul acc",
    "vul tk", "vul taka", "vul sen", "vul send", "vul transfer", "vul pay",
    "ভুল নম্বর", "ভুল নাম্বার", "ভুল নাম্বারে", "ভুল নম্বরে", "ভুল একাউন্টে", "ভুল একাউন্ট",
    "ভুল মোবাইল", "ভুল করে", "ভুল টাকা", "ভুল পাঠানো", "ভুল সেন্ড", "অন্য নম্বরে",
    "অন্য নাম্বারে", "ভুল ট্রান্সফার"
  ];

  // 3. Payment Failed Keywords
  const paymentFailedKeywords = [
    "payment failed", "failed payment", "transaction failed", "money deducted",
    "failed transaction", "balance deducted", "taka ketese", "taka kete",
    "failed mid transaction", "unsuccessful payment", "didn't receive",
    "failed but deducted", "deducted but not", "fail payment", "failed pay",
    "payment unsuccessful", "unsuccessful trans", "failed trans",
    "taka ketese", "taka kete", "balance ketese", "balance kete", "failed hoise",
    "fail hoise", "success hoy ni", "unsuccessful hoise", "taka kete nilo",
    "পেমেন্ট ফেইল", "পেমেন্ট ব্যর্থ", "টাকা কেটেছে", "ব্যালেন্স কেটেছে", "লেনদেন ব্যর্থ",
    "পেমেন্ট হয়নি", "টাকা কেটেছে কিন্তু", "টাকা কেটে নিল", "টাকা কেটে নিয়ে",
    "পেমেন্ট সফল হয়নি", "ব্যালেন্স কেটে নিয়েছে"
  ];

  // 4. Refund Request Keywords
  const refundKeywords = [
    "refund", "refund request", "money back", "return money", "cancel transaction",
    "changed mind", "please refund", "want refund", "taka ferot", "ferot chai",
    "money return", "get back money", "claim refund", "request refund",
    "ferot den", "taka return", "return den", "refund chai",
    "রিফান্ড", "টাকা ফেরত", "ফেরত চাই", "টাকা ব্যাক", "ব্যাক চাই", "লেনদেন বাতিল",
    "রিফান্ড দিন", "টাকা ফেরত দিন"
  ];

  // 5. Duplicate Payment Keywords
  const duplicateKeywords = [
    "charged twice", "double payment", "double charge", "double debited", "paid twice", 
    "charged multiple", "duplicate charge", "duplicate payment", "two times", "2 times", 
    "duplikat", "dui bar", "double ketese", "double payment", "ডাবল কেটেছে", "দুইবার কেটেছে"
  ];

  // 6. Merchant Settlement Delay Keywords
  const settlementKeywords = [
    "merchant settlement", "settlement delay", "settlement not received", "settlement pending", 
    "merchant payment not settled", "not settled", "settle hoy ni", "settlement taka",
    "মার্চেন্ট সেটেলমেন্ট", "সেটেলমেন্ট পাইনি", "সেটেলমেন্ট হয়নি", "সেটেলমেন্ট দেরি"
  ];

  // 7. Agent Cash In Issue Keywords
  const cashInKeywords = [
    "agent cash in", "cash in failed", "cash in not received", "agent deposit", "cash in issue", 
    "agent didn't add", "agent cashin", "cashin", "এজেন্ট ক্যাশ ইন", "ক্যাশ ইন হয়নি", "ক্যাশ ইন পাইনি"
  ];

  const containsAny = (keywords) => {
    return keywords.some(keyword => cleanMsg.includes(keyword));
  };

  // Determine Case Type (Priority: Phishing > Wrong Transfer > Agent Cash In > Duplicate Payment > Settlement Delay > Payment Failed > Refund > Other)
  let case_type = "other";
  let severity = "low";
  let department = "customer_support";
  let confidence = 0.70;

  if (containsAny(phishingKeywords)) {
    case_type = "phishing_or_social_engineering";
    severity = "critical";
    department = "fraud_risk";
    confidence = 0.95;
  } else if (containsAny(wrongTransferKeywords)) {
    case_type = "wrong_transfer";
    severity = "high";
    department = "dispute_resolution";
    confidence = 0.90;
  } else if (containsAny(cashInKeywords)) {
    case_type = "agent_cash_in_issue";
    severity = "high";
    department = "agent_operations";
    confidence = 0.85;
  } else if (containsAny(duplicateKeywords)) {
    case_type = "duplicate_payment";
    severity = "medium";
    department = "payments_ops";
    confidence = 0.85;
  } else if (containsAny(settlementKeywords)) {
    case_type = "merchant_settlement_delay";
    severity = "medium";
    department = "merchant_operations";
    confidence = 0.85;
  } else if (containsAny(paymentFailedKeywords)) {
    case_type = "payment_failed";
    severity = "high";
    department = "payments_ops";
    confidence = 0.90;
  } else if (containsAny(refundKeywords)) {
    case_type = "refund_request";
    severity = "low";
    department = "customer_support";
    confidence = 0.85;
  } else {
    case_type = "other";
    severity = "low";
    department = "customer_support";
    confidence = 0.60;
  }

  // Investigate Transaction History
  const matchedTx = matchTransaction(complaint, transaction_history);
  const relevant_transaction_id = matchedTx ? matchedTx.transaction_id : null;

  let evidence_verdict = "insufficient_data";
  if (matchedTx) {
    const status = matchedTx.status ? matchedTx.status.toLowerCase() : "";
    const type = matchedTx.type ? matchedTx.type.toLowerCase() : "";

    if (case_type === "wrong_transfer") {
      if (status === "completed") {
        evidence_verdict = "consistent";
      } else if (status === "failed" || status === "reversed") {
        evidence_verdict = "inconsistent";
      } else {
        evidence_verdict = "insufficient_data";
      }
    } else if (case_type === "payment_failed") {
      if (status === "failed" || status === "reversed") {
        evidence_verdict = "consistent";
      } else if (status === "completed") {
        evidence_verdict = "inconsistent"; // payment did not fail on our ledger
      } else {
        evidence_verdict = "insufficient_data";
      }
    } else if (case_type === "refund_request") {
      if (status === "completed") {
        evidence_verdict = "consistent";
      } else if (status === "failed" || status === "reversed") {
        evidence_verdict = "inconsistent"; // cannot refund a failed/reversed payment
      } else {
        evidence_verdict = "insufficient_data";
      }
    } else if (case_type === "duplicate_payment") {
      // Check if there are other identical transactions in the history
      const identicalTxs = transaction_history.filter(t => 
        t.transaction_id !== matchedTx.transaction_id &&
        Number(t.amount) === Number(matchedTx.amount) &&
        normalizeCounterparty(t.counterparty) === normalizeCounterparty(matchedTx.counterparty)
      );
      if (identicalTxs.length > 0) {
        evidence_verdict = "consistent";
      } else {
        evidence_verdict = "inconsistent"; // only one transaction exists in history
      }
    } else if (case_type === "merchant_settlement_delay") {
      if (status === "pending" || status === "failed") {
        evidence_verdict = "consistent";
      } else if (status === "completed") {
        evidence_verdict = "inconsistent";
      } else {
        evidence_verdict = "insufficient_data";
      }
    } else if (case_type === "agent_cash_in_issue") {
      if (status === "failed" || status === "pending") {
        evidence_verdict = "consistent";
      } else if (status === "completed") {
        evidence_verdict = "inconsistent"; // ledger shows it completed successfully
      } else {
        evidence_verdict = "insufficient_data";
      }
    } else {
      evidence_verdict = "consistent";
    }
  } else {
    evidence_verdict = "insufficient_data";
  }

  // Adjust routing/severity if verdict is inconsistent
  if (evidence_verdict === "inconsistent") {
    // If ledger contradicts customer complaint, it is high risk / needs dispute resolution or support review
    if (department === "payments_ops" || department === "merchant_operations" || department === "agent_operations") {
      department = "dispute_resolution";
    }
    severity = "high";
  }

  // Setup summary and actions
  const amountVal = matchedTx ? `${matchedTx.amount} BDT` : "the reported amount";
  const txnIdVal = relevant_transaction_id || "the transaction";
  const counterpartyVal = matchedTx ? matchedTx.counterparty : "the counterparty";

  let agent_summary = "";
  let recommended_next_action = "";
  let customer_reply = "";

  if (case_type === "phishing_or_social_engineering") {
    agent_summary = "Customer reports a suspicious call, SMS, or scam asking for credentials (PIN/OTP/password).";
    recommended_next_action = "Advise the customer to secure their account. Flag the account for suspicious activity monitoring.";
    customer_reply = "We have noted your report. Please be assured that we will never ask you for your PIN, OTP, or password. Do not share these credentials with anyone. If you suspect fraud, contact our official support immediately.";
  } else if (case_type === "wrong_transfer") {
    agent_summary = `Customer reports sending ${amountVal} to wrong number ${counterpartyVal} via transaction ${txnIdVal} and requests recovery.`;
    recommended_next_action = `Verify transaction details for ${txnIdVal}. Check the status of recipient's wallet and hold disputed funds if eligible.`;
    customer_reply = `We have received your dispute request regarding transaction ${txnIdVal} for ${amountVal}. We are reviewing the details, and any eligible amount will be returned through official channels.`;
  } else if (case_type === "payment_failed") {
    if (evidence_verdict === "consistent") {
      agent_summary = `Customer reports failed payment of ${amountVal} to ${counterpartyVal} via transaction ${txnIdVal}. Ledger shows transaction status is failed.`;
      recommended_next_action = `Initiate auto-reversal flow for transaction ${txnIdVal} if the balance was deducted.`;
      customer_reply = `We apologize for the inconvenience. Our system confirms that the payment of ${amountVal} via transaction ${txnIdVal} failed. Any deducted amount will be returned through official channels.`;
    } else {
      agent_summary = `Customer reports failed payment of ${amountVal} via transaction ${txnIdVal}, but ledger shows the transaction was completed.`;
      recommended_next_action = `Check merchant integration delivery log for transaction ${txnIdVal}. Escalate to Dispute Resolution.`;
      customer_reply = `We are investigating your request regarding transaction ${txnIdVal} for ${amountVal}. Our records indicate it completed successfully. We will follow up once merchant logs are verified.`;
    }
  } else if (case_type === "refund_request") {
    agent_summary = `Customer requests a refund of ${amountVal} for transaction ${txnIdVal} with merchant ${counterpartyVal}.`;
    recommended_next_action = `Verify merchant refund status for ${txnIdVal}. Contact merchant operations if refund is approved by merchant but pending.`;
    customer_reply = `We have received your refund request for transaction ${txnIdVal}. Any eligible refund amount will be returned through official channels once processed by the merchant.`;
  } else if (case_type === "duplicate_payment") {
    agent_summary = `Customer reports duplicate charges for amount ${amountVal} to ${counterpartyVal} via transaction ${txnIdVal}.`;
    recommended_next_action = `Compare transaction list for duplicates of transaction ${txnIdVal}. Check for dual settlement entries.`;
    customer_reply = `We have received your complaint regarding multiple charges. Our team is investigating, and any eligible duplicate amount will be returned through official channels.`;
  } else if (case_type === "merchant_settlement_delay") {
    agent_summary = `Merchant reports settlement delay for transaction ${txnIdVal} of ${amountVal}.`;
    recommended_next_action = `Check gateway batch settlement logs for transaction ${txnIdVal} and execute manual settlement push if needed.`;
    customer_reply = `We have received your report regarding settlement delay for transaction ${txnIdVal}. Any eligible settlement will be processed through official channels after batch verification.`;
  } else if (case_type === "agent_cash_in_issue") {
    agent_summary = `Customer reports cash deposit of ${amountVal} via agent ${counterpartyVal} is not reflected in balance. Matched txn: ${txnIdVal}.`;
    recommended_next_action = `Verify cash-in ledger logs for agent ${counterpartyVal} and check if transaction ${txnIdVal} failed or pending.`;
    customer_reply = `We are looking into the cash-in issue of ${amountVal}. Any eligible credit will be updated in your wallet through official channels after validation with the agent.`;
  } else {
    agent_summary = "Customer reports general inquiry or system issues requiring agent support.";
    recommended_next_action = "Review customer details and route to general support queue.";
    customer_reply = "Thank you for contacting us. We have received your query, and our support team will get back to you shortly.";
  }

  // Force human_review_required calculation
  // True for disputes (wrong_transfer), phishing, high value/severity, or ambiguous/inconsistent evidence
  const human_review_required = 
    severity === "critical" || 
    severity === "high" ||
    case_type === "wrong_transfer" || 
    case_type === "phishing_or_social_engineering" || 
    evidence_verdict === "inconsistent" || 
    evidence_verdict === "insufficient_data";

  return {
    ticket_id,
    relevant_transaction_id,
    evidence_verdict,
    case_type,
    severity,
    department,
    agent_summary,
    recommended_next_action,
    customer_reply,
    human_review_required,
    confidence,
    reason_codes: [case_type, `verdict_${evidence_verdict}`]
  };
}

module.exports = {
  classifyTicket
};
