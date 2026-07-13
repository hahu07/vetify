# mono.co API Response Reference

## lookup_mashup — Key Response Fields

```json
{
  "status": "successful",
  "data": {
    "nin": { "verified": true, "firstName": "...", "lastName": "...", "middleName": "..." },
    "bvn": { "verified": true, "firstName": "...", "lastName": "..." },
    "match": { "name": true }
  }
}
```

- `data.match.name: true` → NIN and BVN names are consistent — report this as
  `nameMatch` in the evidence JSON; it's the real cross-check that NIN and BVN
  belong to the same person, scored separately from ninVerified/bvnVerified
- If `data.nin.verified: false` → NIN is invalid or not found
- No date-of-birth cross-check exists here — nothing in the onboarding flow
  collects a director's DOB to compare against

---

## lookup_cac — Key Response Fields

```json
{
  "status": "successful",
  "data": {
    "companyName": "...",
    "rcNumber": "RC123456",
    "companyStatus": "Active",
    "companyType": "Private Company Limited by Shares",
    "dateOfRegistration": "YYYY-MM-DD",
    "directors": [{ "name": "...", "nin": "..." }]
  }
}
```

- `data.companyStatus` values: `"Active"`, `"Inactive"`, `"Struck Off"`, `"Pending"`
- Compare `data.companyName` against `BusinessProfile.name` for name consistency

---

## lookup_tin — Key Response Fields

```json
{
  "status": "successful",
  "data": {
    "tin": "...",
    "taxpayerName": "...",
    "taxOffice": "...",
    "channel": "cac"
  }
}
```

- `data.tin` should cross-match `BusinessKyc.taxId`
- `data.taxpayerName` should match `BusinessProfile.name`

---

## Common Error Codes

| HTTP Status | Meaning | Action |
|---|---|---|
| 200 | Success | Proceed normally |
| 400 | Bad request (malformed NIN/BVN) | Score 0 for that check, Flag |
| 401 | Invalid API key | Alert — do not proceed |
| 404 | Record not found | Score 0 for that check |
| 429 | Rate limited | Wait and retry once, then Flag |
| 5xx | Server error | Flag for manual review, do not Reject |
