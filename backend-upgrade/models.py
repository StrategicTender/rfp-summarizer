from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class Contact(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""

class Budget(BaseModel):
    currency: str = "CAD"
    min: Optional[float] = None
    max: Optional[float] = None
    notes: str = ""

class ContractTerm(BaseModel):
    start: str = ""
    end: str = ""
    options: str = ""

class Location(BaseModel):
    country: str = "CA"
    province: str = ""
    city: str = ""

class KeyDate(BaseModel):
    label: str
    date: str

class Attachment(BaseModel):
    filename: str
    url: str = ""

class Meta(BaseModel):
    source: str
    processed_at: str
    language: str = "en"

class Facts(BaseModel):
    title: str = ""
    buyer: str = ""
    solicitation_id: str = ""
    procurement_method: str = ""
    closing_date: str = ""
    contact: Contact = Contact()
    budget: Budget = Budget()
    contract_term: ContractTerm = ContractTerm()
    location: Location = Location()
    key_dates: List[KeyDate] = []
    attachments: List[Attachment] = []
    keywords: List[str] = []

class Requirements(BaseModel):
    scope_summary: str = ""
    deliverables: List[str] = []
    eligibility: List[str] = []
    mandatory_requirements: List[str] = []
    rated_criteria: List[str] = []
    submission_instructions: List[str] = []

class RiskAndCompliance(BaseModel):
    risk_flags: List[str] = []
    compliance_flags: List[str] = []
    notes: str = ""

class FitScore(BaseModel):
    score: int = 0
    rationale: str = ""

class Summary(BaseModel):
    executive: str = ""
    why_it_matters: str = ""
    fit_score: FitScore = FitScore()

class SummarizeResponse(BaseModel):
    meta: Meta
    facts: Facts
    requirements: Requirements
    risk_and_compliance: RiskAndCompliance
    summary: Summary
