#!/usr/bin/env python3
"""Generate fully synthetic application data for VERIFY-AI.

Every institution, trust, person, PAN and registration number here is fictional.
Usage:  python tools/generate_data.py
Writes: netlify/functions/_lib/applications.json
"""
import json
import random
import datetime as dt
import pathlib

random.seed(2026)
D = dt.date
fmt = lambda d: d.isoformat()

PREFIX = ["Lakeview", "Northbridge", "Silverline", "Greenfield", "Riverstone", "Eastwind", "Hillcrest",
          "Sunrise Valley", "Meridian", "Crestwood", "Bluehaven", "Oakridge", "Pinnacle", "Harborview",
          "Stonegate", "Maplewood", "Ashford", "Brightwater", "Cedar Point", "Falcon Ridge", "Granite Hill",
          "Ivory Park", "Juniper", "Kingsfield"]
CITIES = [("Hyderabad", "Telangana"), ("Pune", "Maharashtra"), ("Jaipur", "Rajasthan"), ("Lucknow", "Uttar Pradesh"),
          ("Coimbatore", "Tamil Nadu"), ("Bhopal", "Madhya Pradesh"), ("Indore", "Madhya Pradesh"),
          ("Nagpur", "Maharashtra"), ("Vijayawada", "Andhra Pradesh"), ("Mysuru", "Karnataka"), ("Patna", "Bihar"),
          ("Bhubaneswar", "Odisha"), ("Guwahati", "Assam"), ("Raipur", "Chhattisgarh"), ("Dehradun", "Uttarakhand"),
          ("Kochi", "Kerala")]
KIND = ["Institute of Technology", "College of Engineering", "School of Engineering",
        "Institute of Management", "Polytechnic College"]
SURN = ["Rao", "Sharma", "Iyer", "Khan", "Patel", "Das", "Menon", "Verma", "Reddy", "Singh", "Nair", "Joshi"]
FIRST = ["Anil", "Meera", "Rahul", "Sunita", "Karthik", "Fatima", "Deepak", "Lakshmi", "Vikram", "Neha"]
AUTH = ["State Fire Services Dept.", "District Fire Authority", "Municipal Fire Wing"]
SW_OK = ["Scanner Pro 4.2", "Adobe Scan", "Epson Scan 2", "CamScanner"]
SW_BAD = ["Adobe Photoshop 25.1", "Canva", "Online PDF Editor"]
LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"


def fake_pan():
    r = random.choice
    return f"{r(LETTERS)}{r(LETTERS)}{r(LETTERS)}T{r(LETTERS)}{random.randint(1000, 9999)}{r(LETTERS)}"


def meta(issue, bad=False):
    if bad:
        return {"created": fmt(issue), "modified": fmt(issue + dt.timedelta(days=random.randint(40, 200))),
                "software": random.choice(SW_BAD)}
    return {"created": fmt(issue), "modified": fmt(issue), "software": random.choice(SW_OK)}


cases = []
for i in range(24):
    city, state = CITIES[i % len(CITIES)]
    name = f"{PREFIX[i]} {random.choice(KIND)}"
    trust = f"{PREFIX[i]} Education Trust"
    submitted = D(2026, 9, 1) + dt.timedelta(days=random.randint(0, 50))
    intake = random.choice([120, 180, 240, 300, 360])
    built = intake * 9 + random.randint(80, 600)       # illustrative: 9 sqm per seat required
    land_date = D(2023, 1, 1) + dt.timedelta(days=random.randint(0, 500))
    soc_date = land_date - dt.timedelta(days=random.randint(120, 700))
    plan_date = land_date + dt.timedelta(days=random.randint(60, 300))
    noc_issue = submitted - dt.timedelta(days=random.randint(60, 300))
    noc_valid = noc_issue + dt.timedelta(days=365)
    aff_date = submitted - dt.timedelta(days=random.randint(5, 40))
    bank_asof = submitted - dt.timedelta(days=random.randint(3, 25))
    faculty = -(-intake // 20) + random.randint(0, 6)
    owner = random.choice(FIRST) + " " + random.choice(SURN)
    survey = f"{random.randint(11, 980)}/{random.randint(1, 9)}{random.choice('ABC')}"

    docs = {
        "society_reg": {"label": "Trust / Society Registration", "present": True, "source": "verified",
                        "fields": {"trust_name": trust,
                                   "registration_no": f"TR/{state[:2].upper()}/{random.randint(1000, 9999)}/{soc_date.year}",
                                   "registration_date": fmt(soc_date), "pan": fake_pan()},
                        "meta": meta(soc_date)},
        "land": {"label": "Land Document", "present": True, "source": "verified",
                 "fields": {"holder_name": trust, "deed_type": random.choice(["Sale Deed", "Lease Deed"]),
                            "survey_no": survey, "area_sqm": built * 3, "issue_date": fmt(land_date),
                            "lease_years": random.choice([30, 33, 99])},
                 "meta": meta(land_date)},
        "building_plan": {"label": "Approved Building Plan", "present": True, "source": "unavailable" if i in (11, 14, 18, 22) else "verified",
                          "fields": {"applicant_name": trust, "approved_built_up_sqm": built,
                                     "approval_date": fmt(plan_date), "authority": f"{city} Development Authority"},
                          "meta": meta(plan_date)},
        "fire_noc": {"label": "Fire Safety NOC", "present": True, "source": "verified",
                     "fields": {"applicant_name": trust, "built_up_sqm": built, "issue_date": fmt(noc_issue),
                                "valid_until": fmt(noc_valid), "authority": random.choice(AUTH)},
                     "meta": meta(noc_issue)},
        "affidavit": {"label": "Notarised Affidavit", "present": True, "source": "not_applicable",
                      "fields": {"deponent_trust": trust, "declared_intake": intake, "date": fmt(aff_date)},
                      "meta": meta(aff_date)},
        "faculty": {"label": "Faculty Roster", "present": True, "source": "not_applicable",
                    "fields": {"faculty_count": faculty, "proposed_intake": intake},
                    "meta": meta(submitted - dt.timedelta(days=10))},
        "bank": {"label": "Bank / FD Statement", "present": True, "source": "verified",
                 "fields": {"account_holder": trust, "fd_lakh": round(random.uniform(55, 140), 1),
                            "as_of": fmt(bank_asof)},
                 "meta": meta(bank_asof)},
    }
    cases.append({"id": f"APP-{2601 + i}", "institution": name, "city": city, "state": state,
                  "programType": random.choice(["New Institution", "Extension of Approval", "Increase in Intake"]),
                  "submittedOn": fmt(submitted), "proposedIntake": intake, "trust": trust, "owner": owner,
                  "documents": docs})

c = cases
F = lambda k, d: c[k]["documents"][d]["fields"]
sub = lambda k: D.fromisoformat(c[k]["submittedOn"])

# --- plant issues (deterministic, so the demo always has something to find) ---
for k in (1, 13):                                      # expired fire NOC
    F(k, "fire_noc")["valid_until"] = fmt(sub(k) - dt.timedelta(days=random.randint(10, 90)))
c[2]["documents"]["fire_noc"].update(present=False, fields={}, meta=None)          # missing docs
c[9]["documents"]["affidavit"].update(present=False, fields={}, meta=None)
c[9]["documents"]["bank"].update(present=False, fields={}, meta=None)
F(3, "fire_noc")["applicant_name"] = c[3]["trust"].replace("Education Trust", "Educational Society")   # name mismatch
F(3, "affidavit")["deponent_trust"] = "Greenfield Welfare Foundation"
F(11, "land")["holder_name"] = c[11]["trust"] + " (Regd.)"                     # minor variant
F(12, "bank")["account_holder"] = "Sri " + c[12]["trust"].split()[0] + " Charitable Trust"
F(4, "fire_noc")["built_up_sqm"] = int(F(4, "building_plan")["approved_built_up_sqm"] * 0.78)      # area mismatch
F(12, "building_plan")["approved_built_up_sqm"] = int(c[12]["proposedIntake"] * 9 * 0.8)          # area shortfall
F(12, "fire_noc")["built_up_sqm"] = F(12, "building_plan")["approved_built_up_sqm"]
for k, d in ((5, "fire_noc"), (13, "land"), (21, "fire_noc")):                                      # edited files
    base = F(k, d).get("issue_date")
    c[k]["documents"][d]["meta"] = {"created": base, "modified": fmt(sub(k) - dt.timedelta(days=2)),
                                    "software": random.choice(SW_BAD)}
F(6, "fire_noc")["issue_date"] = fmt(sub(6) + dt.timedelta(days=12))                                 # future-dated
F(6, "fire_noc")["valid_until"] = fmt(sub(6) + dt.timedelta(days=377))
F(4, "building_plan")["approval_date"] = fmt(D.fromisoformat(F(4, "land")["issue_date"]) - dt.timedelta(days=90))
F(3, "society_reg")["registration_date"] = fmt(D.fromisoformat(F(3, "land")["issue_date"]) + dt.timedelta(days=45))
F(8, "faculty")["faculty_count"] = int(c[8]["proposedIntake"] / 20 * 0.6)                           # faculty shortfall
F(16, "faculty")["faculty_count"] = c[16]["proposedIntake"] // 20 - 2
F(5, "affidavit")["declared_intake"] = c[5]["proposedIntake"] + 60                                 # intake mismatch
F(17, "bank")["fd_lakh"] = 31.5                                                                      # low FD
F(8, "land")["lease_years"] = 15
F(8, "land")["deed_type"] = "Lease Deed"
F(23, "society_reg")["pan"] = F(0, "society_reg")["pan"]                                             # duplicate PAN
F(16, "land")["survey_no"] = F(13, "land")["survey_no"]                                              # duplicate survey no

out = pathlib.Path(__file__).resolve().parent.parent / "netlify/functions/_lib/applications.json"
out.write_text(json.dumps(cases, indent=1))
print(f"wrote {len(cases)} synthetic applications -> {out}")
