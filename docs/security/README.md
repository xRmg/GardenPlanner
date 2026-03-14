# Garden Planner — Security Audit

**Audit date**: 2026-03-14  
**Scope**: Deployed application (Docker containers, Express backend, React SPA, nginx, SQLite)  
**Deployment context**: Public internet (alienlabs.eu) + local development, single-user  
**Classification**: Advisory only — no code modifications made  

---

## Documents

| File | Description |
|------|-------------|
| [findings.md](findings.md) | All verified findings, ordered by severity (CRITICAL → LOW) |
| [remediation.md](remediation.md) | Prioritised remediation roadmap with recommended fixes |

---

## Summary

**23 distinct findings** across 6 audit domains:

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 5 | Immediate action required |
| HIGH | 9 | Urgent — address within 1 week |
| MEDIUM | 6 | Important — address within 2–4 weeks |
| LOW | 3 | Opportunistic improvement |

### Key Risk Areas

1. **Zero authentication** — All 8 API endpoints are world-readable/writable via wildcard CORS
2. **Destructive unvalidated sync** — `POST /garden/sync` replaces all data without schema validation
3. **API key exposure** — OpenRouter key stored as plaintext JSON in SQLite
4. **Cost escalation** — No rate limiting + attacker-controllable AI model selection
5. **Data loss bugs** — Schema fields silently dropped during sync; non-atomic migration

### Positive Findings

- Prepared statements used consistently (no SQL injection via queries)
- Multi-stage Docker build strips dev dependencies
- Zod validation on most input endpoints (settings, AI key, AI chat)
- API key never exposed to frontend responses
- React auto-escapes rendered text (no stored XSS via UI)
