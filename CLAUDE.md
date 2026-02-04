# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedScribe is an **on-premise, real-time medical transcription system** that captures patient encounters and generates SOAP-formatted clinical notes using open-source AI models. All data stays on-premise for HIPAA compliance. The project is in the **pre-development planning phase** with comprehensive specifications complete but no application code written yet.

## Architecture

Multi-service system with four layers:

- **Client Layer**: React/Next.js (TypeScript, Tailwind CSS) web app communicating over HTTPS/WSS
- **Application Layer**: Node.js/Express (or FastAPI) REST API + Socket.io WebSocket server for real-time audio streaming, behind Nginx/Traefik reverse proxy
- **Processing Layer**: Python AI services communicating via Redis/RabbitMQ message queue:
  - **ASR**: Whisper (OpenAI) for speech-to-text
  - **Diarization**: pyannote-audio for speaker separation
  - **Note Generation**: BioMistral-7B (4-bit quantized via vLLM/llama.cpp) for SOAP notes
  - **Voice Print**: Resemblyzer/SpeechBrain for provider voice recognition
  - **Medical NER**: MedCAT/scispaCy for entity extraction and terminology
- **Data Layer**: PostgreSQL 16 (with pgvector for voice embeddings), Redis 7 (sessions/cache), local filesystem (audio files)

All services are containerized with Docker and orchestrated via Docker Compose.

## Planned Project Structure

```
/src
  /routes          # API route definitions
  /controllers     # Request handling logic
  /services        # Business logic
  /middleware       # Auth, logging, audit middleware
  /models          # Database models
```

Frontend and Python AI services are separate projects within the Docker Compose setup.

## Key Technical Decisions

| Area | Choice | Notes |
|------|--------|-------|
| Backend runtime | Node.js 20 LTS or Python 3.11 | Not yet decided |
| Database migrations | Prisma, Knex, or Alembic | Depends on backend choice |
| Auth | JWT with Redis-stored refresh tokens | 30-min configurable session timeout |
| Audio streaming | Socket.io with 500ms chunk intervals | Binary audio over WebSocket |
| LLM inference | vLLM or llama.cpp | BioMistral-7B quantized to 4-bit (~4GB VRAM) |
| Vector storage | pgvector extension or Chroma | For voice embeddings |

## Development Phases

MVP is complete after Phase 7. Phases 8-15 are post-MVP enhancements.

| Phase | Feature | Key References |
|-------|---------|----------------|
| 0 | Dev environment + DB setup | Docker Compose, PostgreSQL 16, Redis |
| 1 | Auth + UI shell | JWT, React routing, session timeout |
| 2 | Audio capture + basic transcription | MediaRecorder API, WebSocket, Whisper |
| 3 | Real-time transcription | Streaming Whisper, <3s latency target |
| 4 | Speaker diarization | pyannote-audio, speaker label UI |
| 5 | Patient name detection | Medical NER, name extraction heuristics |
| 6 | SOAP note generation | BioMistral-7B, prompt engineering, content filtering |
| 7 | Note export + finalization | Clipboard, auto-save, encounter history |
| 8 | Provider preferences | Tone, detail level, custom instructions |
| 9 | Templates | Shareable preference snapshots, specialty starters |
| 10 | Medical terminology | MedSpaCy validation, uncertainty flagging |
| 11 | Voice learning | Voice embeddings, progressive recognition |
| 12 | Mobile/responsive polish | Touch optimization, swipe navigation |
| 13 | Admin features | User management, audit logs, usage dashboard |
| 14 | Security hardening | MFA (TOTP), encryption at rest, OWASP scan |
| 15 | Performance + scaling | Load testing, optimization, Prometheus/Grafana |

## Database Schema (Core Tables)

- `providers` - User accounts (email, password_hash, name, specialty)
- `encounters` - Patient encounters (provider_id, patient_name, status, timestamps)
- `transcripts` - Transcription results (encounter_id, full_text, segments JSONB, audio_file_path)
- `generated_notes` - SOAP notes (encounter_id, version, content JSONB, is_finalized)
- `provider_preferences` - Customization settings (tone, detail_level, custom_instructions)
- `note_templates` - Shareable preference snapshots (structure JSONB, share_code)
- `voice_profiles` - Voice embeddings (provider_id, embeddings vector[], confidence_score)
- `audit_logs` - Access/action logging (actor_id, action, resource_type, details JSONB)

All IDs are UUIDs. Timestamps use `DEFAULT NOW()`.

## HIPAA/Security Constraints

- **No external data transmission** - everything on-premise
- **AES-256** encryption at rest, **TLS 1.3** in transit
- **No PHI in application logs**
- Role-based access: providers see only their own encounters
- All access logged to audit_logs with timestamps and IP
- Configurable data retention policies

## API Conventions

- Health check: `GET /api/health`
- Auth: `POST /api/auth/{register,login,logout,refresh}`, `GET /api/auth/me`
- Encounters: `POST /api/encounters`, `GET /api/encounters`, `GET /api/encounters/:id`, `PATCH /api/encounters/:id`
- Transcripts: `PATCH /api/transcripts/:id/segments/:segmentIndex` (speaker correction)
- Admin routes under `/api/admin/*` namespace
- WebSocket events: `audio:chunk`, `session:{start,pause,resume,end}`, `transcript:update`, `session:status`

## Planning Documents

- `MedScribe_Project_Plan.md` - Architecture, model recommendations, feature specs, infrastructure requirements, development roadmap
- `MedScribe_Requirements.md` - 10 user story epics (70+ stories), 14 technical requirement categories (88+ requirements) with traceability matrix
- `MedScribe_MVP_Implementation_Plan.md` - 15 phases with step-by-step tasks, SQL migrations, verification criteria

## Hardware Requirements

- **App server**: 8 cores, 32GB RAM, 500GB SSD
- **GPU server**: NVIDIA RTX 3090/A4000 (24GB VRAM), 8 cores, 64GB RAM, 1TB NVMe
- **OS**: Ubuntu 22.04 LTS
- **Network**: 1Gbps minimum
