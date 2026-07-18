"""
Core schema for VC Brain (MVP).

Scope decisions locked in with the team:
- Founder <-> Company kept 1:1 for the hackathon (multi-company founder history is a
  future-improvement, not MVP).
- SQLite, single-file, no migrations framework — fine for hackathon iteration speed.
- `axis` values on Score are never averaged into one number by any downstream code.
  Enforce that convention in the scoring layer, not the schema.

String "enum-like" fields (source, type, axis, trend, section) are plain strings with
allowed values documented inline, rather than DB-level enums — keeps this easy to extend
mid-hackathon without a migration.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Founder(Base):
    """A person. Persists across applications — this is what the Founder Score lives on."""

    __tablename__ = "founders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_url: Mapped[str | None] = mapped_column(String, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String, nullable=True)
    website_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Persistent Founder Score (FAQ Q6: distinct from the per-opportunity Founder axis).
    # Recomputed, not replaced, whenever a new application/signal links to this founder.
    founder_score: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )

    score_history: Mapped[list["FounderScoreHistory"]] = relationship(
        back_populates="founder", cascade="all, delete-orphan"
    )
    applications: Mapped[list["Application"]] = relationship(back_populates="founder")
    signals: Mapped[list["Signal"]] = relationship(back_populates="founder")


class FounderScoreHistory(Base):
    """One row per Founder Score update — lets the dashboard show the trend, not just the latest value."""

    __tablename__ = "founder_score_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    founder_id: Mapped[int] = mapped_column(ForeignKey("founders.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    founder: Mapped["Founder"] = relationship(back_populates="score_history")


class Company(Base):
    """The idea/company being evaluated. 1:1 with a Founder for the MVP."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[str | None] = mapped_column(String, nullable=True)
    stage: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. idea, pre-seed
    snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)  # "in a nutshell" paragraph

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    applications: Mapped[list["Application"]] = relationship(back_populates="company")
    signals: Mapped[list["Signal"]] = relationship(back_populates="company")


class Application(Base):
    """One inbound submission, or one outbound lead that converted — both feed the same funnel."""

    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    founder_id: Mapped[int] = mapped_column(ForeignKey("founders.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    source: Mapped[str] = mapped_column(String, nullable=False)  # "inbound" | "outbound"
    status: Mapped[str] = mapped_column(
        String, default="screening"
    )  # screening | diligence | decided | rejected

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    founder: Mapped["Founder"] = relationship(back_populates="applications")
    company: Mapped["Company"] = relationship(back_populates="applications")
    scores: Mapped[list["Score"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    claims: Mapped[list["Claim"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    memo_sections: Mapped[list["MemoSection"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class Signal(Base):
    """Raw ingested evidence. Nothing discarded. This is the traceability spine — every
    Claim points back to one of these."""

    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    founder_id: Mapped[int | None] = mapped_column(ForeignKey("founders.id"), nullable=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)

    # commit | hn_post | arxiv_paper | deck_slide | interview | linkedin | twitter | other
    type: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    founder: Mapped["Founder | None"] = relationship(back_populates="signals")
    company: Mapped["Company | None"] = relationship(back_populates="signals")
    claims: Mapped[list["Claim"]] = relationship(back_populates="signal")


class Score(Base):
    """One row per axis per application. Founder / Market / Idea-vs-Market — never
    averaged into a single number anywhere downstream."""

    __tablename__ = "scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id"), nullable=False
    )

    axis: Mapped[str] = mapped_column(String, nullable=False)  # founder | market | idea_vs_market
    value: Mapped[float] = mapped_column(Float, nullable=False)
    trend: Mapped[str] = mapped_column(String, default="stable")  # improving | declining | stable
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Marks whether this score was produced under cold-start scoring (sparse signals) —
    # surfaced explicitly in the UI rather than silently blended in.
    cold_start: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    application: Mapped["Application"] = relationship(back_populates="scores")


class Claim(Base):
    """One atomic assertion in a memo (e.g. "$50K ARR"). Carries its own Trust Score and
    points back to the Signal that supports it. If unsupported, must be flagged as a gap
    (e.g. "Cap table: not disclosed") rather than silently omitted."""

    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id"), nullable=False
    )
    signal_id: Mapped[int | None] = mapped_column(ForeignKey("signals.id"), nullable=True)

    text: Mapped[str] = mapped_column(Text, nullable=False)
    trust_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_gap: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    application: Mapped["Application"] = relationship(back_populates="claims")
    signal: Mapped["Signal | None"] = relationship(back_populates="claims")


class ThesisConfig(Base):
    """The investor's fund lens. Single active row for the MVP (one investor). Editable
    from the dashboard, not hardcoded — every recommendation is filtered/scored through
    whatever is here."""

    __tablename__ = "thesis_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sectors: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma-separated for MVP
    stage: Mapped[str | None] = mapped_column(String, nullable=True)
    geography: Mapped[str | None] = mapped_column(String, nullable=True)
    check_size_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    check_size_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    ownership_target: Mapped[float | None] = mapped_column(Float, nullable=True)  # % target
    risk_appetite: Mapped[str | None] = mapped_column(String, nullable=True)  # low | medium | high

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )


class MemoSection(Base):
    """One section of a generated investment memo. Required sections per Appendix 1:
    company_snapshot, investment_hypotheses, swot, problem_product, traction_kpis.
    Optional: team_history, technology_defensibility, market_sizing, competition,
    financials_round, cap_table, due_diligence_log, exit_perspective."""

    __tablename__ = "memo_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id"), nullable=False
    )

    section: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_gap: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    application: Mapped["Application"] = relationship(back_populates="memo_sections")
