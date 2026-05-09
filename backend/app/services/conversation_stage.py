"""Conversation stage detector and negotiation/frustration signal extractor.

Classifies where in the sales funnel a conversation is:
- early: Just started. Collect name + interest only.
- mid: Some context exists. Ask about budget, location, preferences.
- late: High intent or sensitive stage. Ask for email, docs, payment.

Also detects negotiation and frustration signals from message text.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.db.models import Lead


# ---------------------------------------------------------------------------
# Stage detection
# ---------------------------------------------------------------------------

@dataclass
class ConversationStage:
    stage: str  # "early" | "mid" | "late"
    collect_fields: list[str] = field(default_factory=list)
    stage_reason: str = ""

    @property
    def system_prompt_instructions(self) -> str:
        """Return stage-specific instructions to inject into the AI system prompt."""
        if self.stage == "early":
            return (
                "CONVERSATION STAGE: Early.\n"
                "Your only goal right now is to learn the customer's NAME and what they are INTERESTED IN.\n"
                "Do NOT ask for email, phone, address, budget, or payment details yet.\n"
                "Keep it warm, short, and conversational."
            )
        if self.stage == "mid":
            return (
                "CONVERSATION STAGE: Mid.\n"
                "You already know the customer's name or interest. "
                "Now gently explore their BUDGET, LOCATION, and specific PREFERENCES.\n"
                "Do NOT ask for email, documents, or payment information yet."
            )
        # late
        return (
            "CONVERSATION STAGE: Late.\n"
            "The customer has strong intent. "
            "It is appropriate to ask for their EMAIL, any required DOCUMENTS, or guide them toward PAYMENT steps.\n"
            "Remain professional and do not pressure them."
        )


def detect_conversation_stage(
    lead: "Lead | None",
    message_count: int = 0,
) -> ConversationStage:
    """Classify the conversation stage based on the lead state and message count.

    Args:
        lead: Current Lead object (may be None for brand new conversations).
        message_count: Total number of messages in the conversation so far.

    Returns:
        ConversationStage with a stage label and field guidance.
    """
    # If no lead exists yet, it is definitely early
    if lead is None:
        return ConversationStage(
            stage="early",
            collect_fields=["name", "interest"],
            stage_reason="no_lead",
        )

    has_name = bool(lead.company_name and lead.company_name.strip())
    has_budget = lead.budget_min is not None or lead.budget_max is not None
    has_email = bool(lead.email and lead.email.strip())
    intent = (lead.intent or "").lower()
    trust = (lead.trust_level or "").lower()

    # Late stage: email collected, or high intent, or trust is high, or many messages
    if has_email or intent == "serious" or trust == "high" or message_count >= 12:
        return ConversationStage(
            stage="late",
            collect_fields=["email", "documents", "payment_info"],
            stage_reason="high_intent_or_email_exists",
        )

    # Mid stage: name exists, or budget found, or moderate message count
    if has_name or has_budget or intent in {"comparing"} or message_count >= 5:
        return ConversationStage(
            stage="mid",
            collect_fields=["budget", "location", "preferences"],
            stage_reason="name_or_budget_known",
        )

    # Default: early
    return ConversationStage(
        stage="early",
        collect_fields=["name", "interest"],
        stage_reason="no_name_no_budget",
    )


# ---------------------------------------------------------------------------
# Negotiation & frustration detection
# ---------------------------------------------------------------------------

NEGOTIATION_PATTERNS = [
    r"\blast price\b",
    r"\bfinal price\b",
    r"\bbest price\b",
    r"\bcan you (?:reduce|lower|cut|drop|discount)\b",
    r"\bany discount\b",
    r"\bgive me discount\b",
    r"\bnegotiate\b",
    r"\bcheaper\b",
    r"\btoo expensive\b",
    r"\bprice reduction\b",
    r"\bkoi kom hobe\b",  # Bangla transliterated
    r"\bkm hobe\b",
    r"\bdaam kom\b",
]

FRUSTRATION_PATTERNS = [
    r"\bconfus(?:ed|ing)\b",
    r"\bnot (?:happy|satisfied|working)\b",
    r"\bfrustrat(?:ed|ing)\b",
    r"\bwaste of time\b",
    r"\bterrible\b",
    r"\bawful\b",
    r"\bworst\b",
    r"\bthis is bad\b",
    r"\bunacceptable\b",
    r"\bno response\b",
    r"\bstill waiting\b",
    r"\bwhere is\b.*\bmy\b",
    r"\bcomplaints?\b",
    r"\bscam\b",
]

HIGH_INTENT_PATTERNS = [
    r"\bi want to (?:buy|purchase|proceed|order|book)\b",
    r"\bsend (?:me )?(?:payment|invoice|link|details)\b",
    r"\bhow (?:do|can) i pay\b",
    r"\bready to (?:buy|proceed|order)\b",
    r"\blet['']?s (?:do|proceed|finalize)\b",
    r"\bwhere (?:do|can) i (?:pay|send)\b",
    r"\bi['']?m (?:in|interested|ready)\b",
]

DROP_OFF_PATTERNS = [
    r"\bmaybe later\b",
    r"\bnot now\b",
    r"\bwill think\b",
    r"\bthink about it\b",
    r"\bget back to you\b",
    r"\bnever mind\b",
    r"\bforget it\b",
    r"\bnot interested\b",
    r"\bcancel\b",
]


@dataclass
class MessageSignals:
    is_negotiation: bool = False
    is_frustration: bool = False
    is_high_intent: bool = False
    is_drop_off_risk: bool = False
    matched_patterns: list[str] = field(default_factory=list)

    @property
    def alert_type(self) -> str | None:
        """Return the primary alert type if any signal was detected."""
        if self.is_high_intent:
            return "hot_lead"
        if self.is_negotiation:
            return "negotiation"
        if self.is_frustration:
            return "frustration"
        if self.is_drop_off_risk:
            return "drop_off_risk"
        return None

    @property
    def severity(self) -> str:
        if self.is_high_intent or self.is_frustration:
            return "high"
        if self.is_negotiation:
            return "medium"
        if self.is_drop_off_risk:
            return "low"
        return "low"


def analyze_message_signals(text: str | None) -> MessageSignals:
    """Analyze a customer message for negotiation, frustration, high intent, and drop-off signals.

    Args:
        text: Raw customer message text.

    Returns:
        MessageSignals dataclass with boolean flags and matched patterns.
    """
    signals = MessageSignals()
    if not text:
        return signals

    lowered = text.lower()

    for pattern in NEGOTIATION_PATTERNS:
        if re.search(pattern, lowered):
            signals.is_negotiation = True
            signals.matched_patterns.append(f"negotiation:{pattern}")

    for pattern in FRUSTRATION_PATTERNS:
        if re.search(pattern, lowered):
            signals.is_frustration = True
            signals.matched_patterns.append(f"frustration:{pattern}")

    for pattern in HIGH_INTENT_PATTERNS:
        if re.search(pattern, lowered):
            signals.is_high_intent = True
            signals.matched_patterns.append(f"high_intent:{pattern}")

    for pattern in DROP_OFF_PATTERNS:
        if re.search(pattern, lowered):
            signals.is_drop_off_risk = True
            signals.matched_patterns.append(f"drop_off:{pattern}")

    return signals
