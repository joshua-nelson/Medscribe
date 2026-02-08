# MedScribe: Medical Transcription & Documentation System

## Project Plan

**Document Version:** 1.0  
**Date:** February 4, 2026  
**Status:** Planning Phase

---

## Executive Summary

MedScribe is an on-premise, real-time medical transcription application designed for physicians to capture patient encounters and automatically generate SOAP-formatted clinical notes. The system will leverage open-source healthcare-focused language models to ensure medical accuracy while maintaining full data privacy through on-site deployment.

**Key Value Propositions:**
- Cost savings through internal resource utilization
- Complete data privacy with on-premise hosting
- Physician-customizable AI behavior and note formatting
- Specialty-specific note templates
- Progressive voice learning for automatic speaker identification

---

## Project Scope

### In Scope

- Real-time audio transcription with multi-speaker diarization
- Automatic SOAP note generation from transcripts
- Intelligent filtering of non-clinical dialogue
- Physician profile system with shareable customization settings
- Specialty-specific note templates and structures
- Progressive voice recognition for provider identification
- Patient name detection from conversation context
- Web-based responsive interface (desktop and mobile)
- Manual export functionality (copy/paste to EMR)
- Multi-user concurrent session support
- On-premise deployment architecture

### Out of Scope (Initial Release)

- Direct EHR integration (HL7/FHIR)
- Automated billing code suggestions
- Voice commands for UI navigation
- Offline/disconnected mode
- Native mobile applications

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Web Browser    │  │  Mobile Browser │  │  Tablet Browser │     │
│  │  (Desktop)      │  │  (iOS/Android)  │  │                 │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
└───────────┼─────────────────────┼─────────────────────┼─────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │ HTTPS/WSS
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Application Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    API Gateway / Load Balancer               │   │
│  │                    (NGINX / Traefik)                         │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────┐  ┌───────┴───────┐  ┌──────────────────────┐    │
│  │ Auth Service │  │  Web Server   │  │  WebSocket Server    │    │
│  │ (JWT/OAuth)  │  │  (Node.js)    │  │  (Real-time Audio)   │    │
│  └──────────────┘  └───────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Processing Layer                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Message Queue                             │   │
│  │                    (Redis / RabbitMQ)                        │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────┐  ┌───────┴───────┐  ┌──────────────────────┐    │
│  │  ASR Engine  │  │ Diarization   │  │  Note Generation     │    │
│  │  (Whisper)   │  │ Service       │  │  Service (LLM)       │    │
│  └──────────────┘  └───────────────┘  └──────────────────────┘    │
│                                                                     │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐    │
│  │ Voice Print  │  │ Medical NER   │  │  Content Filter      │    │
│  │ Service      │  │ Service       │  │  Service             │    │
│  └──────────────┘  └───────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Layer                                    │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐    │
│  │  PostgreSQL  │  │ Vector DB     │  │  File Storage        │    │
│  │  (Primary)   │  │ (Embeddings)  │  │  (Audio/Exports)     │    │
│  └──────────────┘  └───────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Technology Options | Purpose |
|-----------|-------------------|---------|
| Web Server | Node.js + Express / FastAPI | REST API, session management |
| WebSocket Server | Socket.io / FastAPI WebSockets | Real-time audio streaming |
| ASR Engine | Whisper (OpenAI) | Speech-to-text conversion |
| Diarization | pyannote-audio / NeMo | Speaker separation |
| Voice Print | Resemblyzer / SpeechBrain | Provider voice enrollment |
| Medical NER | MedCAT / scispaCy | Entity extraction |
| Note Generation | See Model Recommendations | SOAP note creation |
| Message Queue | Redis / RabbitMQ | Task distribution |
| Primary Database | PostgreSQL | Structured data |
| Vector Database | pgvector / Chroma | Voice embeddings |

---

## AI Model Recommendations

### Speech-to-Text (ASR)

**Primary Recommendation: Whisper (OpenAI)**
- Open-source, runs locally
- Multiple size options (tiny to large)
- Medical vocabulary handling is reasonable
- GPU memory requirements: 1GB (small) to 10GB (large)

**Alternative: Whisper.cpp**
- CPU-optimized variant
- Lower resource requirements
- Slightly reduced accuracy

### Speaker Diarization

**Primary Recommendation: pyannote-audio**
- State-of-the-art performance
- Handles overlapping speech
- GPU: 2-4GB VRAM

### Medical Language Models

For SOAP note generation with medical terminology accuracy:

| Model | Parameters | Strengths | GPU Memory |
|-------|------------|-----------|------------|
| **BioMistral-7B** | 7B | Fine-tuned on medical literature, good balance of size/performance | 14GB |
| **MedAlpaca-13B** | 13B | Strong medical reasoning, instruction-tuned | 26GB |
| **Clinical-Llama-2-7B** | 7B | Trained on clinical notes specifically | 14GB |
| **Meditron-7B** | 7B | Trained on medical guidelines and papers | 14GB |
| **OpenBioLLM-8B** | 8B | Recent model with strong benchmarks | 16GB |

**Recommendation for Limited GPU Resources:**

Given current GPU constraints, start with:
1. **BioMistral-7B** (quantized to 4-bit) — ~4GB VRAM
2. Use **llama.cpp** or **vLLM** for efficient inference
3. Plan for model upgrade path when hardware expands

**Medical Spell-Check & Terminology:**
- **MedSpaCy** — Medical NLP pipeline
- **UMLS Metathesaurus** — Terminology database
- **RxNorm** — Medication names
- **SNOMED CT** — Clinical terms

---

## Feature Specifications

### 1. Real-Time Transcription

**Audio Capture:**
- Browser-based microphone access (WebRTC)
- Continuous streaming via WebSocket
- Audio chunking (100-500ms segments)
- Client-side audio preprocessing (noise reduction optional)

**Processing Pipeline:**
```
Audio Stream → Buffer (2-5 sec) → Whisper ASR → Diarization → Display
```

**Display Requirements:**
- Rolling transcript with speaker labels
- Visual indicators for current speaker
- Timestamp markers every 30 seconds
- Manual speaker label correction interface

### 2. Speaker Identification

**Initial Session Flow:**
1. Provider indicates their role at session start
2. System assigns "Provider" and "Patient" labels
3. Patient name extracted from conversation context

**Voice Learning (Progressive):**
1. After each session, extract voice embeddings for provider
2. Store embeddings in vector database
3. On subsequent sessions, match incoming audio against stored embeddings
4. Confidence threshold: 85% for auto-labeling
5. Below threshold: prompt for confirmation

**Data Model:**
```
VoiceProfile {
  provider_id: UUID
  embeddings: Vector[]
  sample_count: Integer
  last_updated: Timestamp
  confidence_score: Float
}
```

### 3. SOAP Note Generation

**Structured Output:**

```
SUBJECTIVE
- Chief Complaint
- History of Present Illness
- Review of Systems
- Past Medical/Surgical History (if discussed)
- Medications (if discussed)
- Allergies (if discussed)

OBJECTIVE
- Vital Signs (if mentioned)
- Physical Exam Findings
- Lab/Imaging Results (if discussed)

ASSESSMENT
- Diagnoses/Problem List
- Clinical Reasoning

PLAN
- Medications (new/changed)
- Orders (labs, imaging, referrals)
- Patient Education
- Follow-up Instructions
```

**Content Filtering:**
- Remove small talk, greetings, scheduling discussion
- Retain medically relevant patient context (occupation if relevant to condition)
- Flag uncertain content for provider review

### 4. Provider Customization

**Profile Settings:**

| Setting | Options | Description |
|---------|---------|-------------|
| Tone | Formal / Conversational / Terse | Writing style of generated notes |
| Detail Level | Minimal / Standard / Comprehensive | Amount of detail included |
| Specialty | Primary Care / Cardiology / Orthopedics / etc. | Affects note structure |
| Default Sections | Configurable | Which SOAP sections to include |
| Custom Phrases | Text templates | Frequently used phrases |
| Abbreviation Preferences | Expand / Keep / Custom | How to handle abbreviations |
| Review of Systems Format | Pertinent Positives Only / Full | ROS documentation style |

**Shareable Templates:**
- Providers can save configurations as templates
- Templates can be shared with other providers
- Organization-level default templates
- Specialty-specific starter templates

**AI Guidance System:**
- Natural language instructions ("Always include smoking status")
- Exclusion rules ("Never mention patient's job unless relevant")
- Format preferences ("Use bullet points in the Plan section")
- Custom vocabulary ("Use 'SOB' instead of 'shortness of breath'")

### 5. Specialty Modules

**Pre-configured Templates:**

| Specialty | Modified Sections | Additional Fields |
|-----------|-------------------|-------------------|
| Cardiology | Cardiac ROS expanded | Risk stratification, EKG findings |
| Orthopedics | MSK exam detailed | Range of motion, imaging correlations |
| Psychiatry | Mental status exam | Safety assessment, treatment response |
| Pediatrics | Growth/development | Vaccination status, developmental milestones |
| OB/GYN | OB history section | Gestational data, fetal assessment |

---

## User Interface Design

### Main Transcription View

```
┌─────────────────────────────────────────────────────────────────┐
│  MedScribe                          [Dr. Smith ▼] [⚙️] [🚪]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Patient: [Auto-detected: Sarah Johnson    ] [✏️ Edit]         │
│  Session Started: 2:34 PM | Duration: 00:12:34                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Live Transcript                       │   │
│  │                                                         │   │
│  │  [Provider] 2:34 PM                                     │   │
│  │  Good afternoon, Sarah. What brings you in today?       │   │
│  │                                                         │   │
│  │  [Patient] 2:34 PM                                      │   │
│  │  I've been having this persistent headache for about    │   │
│  │  three weeks now. It's mostly on the right side...      │   │
│  │                                                         │   │
│  │  [Provider] 2:35 PM                                     │   │
│  │  Can you describe the pain? Is it throbbing, sharp...   │   │
│  │                                                         │   │
│  │  ▼ Live transcription...                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐     │
│  │ 🎙️ Recording │  │ ⏸️ Pause  │  │ ✅ End & Generate Note   │     │
│  └──────────┘  └──────────┘  └──────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Note Review & Edit View

```
┌─────────────────────────────────────────────────────────────────┐
│  Generated Note - Sarah Johnson | Feb 4, 2026                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │   Transcript        │  │   SOAP Note                     │  │
│  │   (Reference)       │  │   (Editable)                    │  │
│  │                     │  │                                 │  │
│  │   [Click any line   │  │   SUBJECTIVE                    │  │
│  │    to highlight     │  │   ───────────                   │  │
│  │    source in note]  │  │   CC: Headache x 3 weeks        │  │
│  │                     │  │                                 │  │
│  │                     │  │   HPI: 45 y/o female presents   │  │
│  │                     │  │   with right-sided headache...  │  │
│  │                     │  │                                 │  │
│  │                     │  │   [Continue editing...]         │  │
│  │                     │  │                                 │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ 🔄 Regenerate │ │ 📋 Copy All │ │ 💾 Save Draft │ │ ✅ Finalize   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile Responsive Design

- Stacked layout for transcript and note views
- Large touch targets for recording controls
- Swipe gestures for navigation
- Collapsible sections for space efficiency

---

## Data Model

### Core Entities

```
Provider {
  id: UUID (PK)
  email: String (unique)
  name: String
  specialty: String
  created_at: Timestamp
  updated_at: Timestamp
}

ProviderPreferences {
  id: UUID (PK)
  provider_id: UUID (FK)
  tone: Enum ['formal', 'conversational', 'terse']
  detail_level: Enum ['minimal', 'standard', 'comprehensive']
  custom_instructions: Text
  default_template_id: UUID (FK, nullable)
  created_at: Timestamp
  updated_at: Timestamp
}

NoteTemplate {
  id: UUID (PK)
  name: String
  specialty: String
  created_by: UUID (FK)
  is_shared: Boolean
  structure: JSONB
  custom_sections: JSONB
  created_at: Timestamp
  updated_at: Timestamp
}

Encounter {
  id: UUID (PK)
  provider_id: UUID (FK)
  patient_name: String
  started_at: Timestamp
  ended_at: Timestamp
  status: Enum ['in_progress', 'completed', 'archived']
  created_at: Timestamp
}

Transcript {
  id: UUID (PK)
  encounter_id: UUID (FK)
  full_text: Text
  segments: JSONB  // [{speaker, start, end, text}, ...]
  audio_file_path: String (nullable)
  created_at: Timestamp
}

GeneratedNote {
  id: UUID (PK)
  encounter_id: UUID (FK)
  version: Integer
  content: JSONB  // {subjective: {}, objective: {}, ...}
  raw_text: Text
  is_final: Boolean
  created_at: Timestamp
  finalized_at: Timestamp (nullable)
}

VoiceProfile {
  id: UUID (PK)
  provider_id: UUID (FK)
  embeddings: Vector[]
  sample_count: Integer
  confidence_threshold: Float
  created_at: Timestamp
  updated_at: Timestamp
}
```

---

## Security & Compliance

### HIPAA Considerations

| Requirement | Implementation |
|-------------|----------------|
| Access Controls | Role-based access, individual provider accounts |
| Audit Logging | All access and modifications logged with timestamps |
| Encryption at Rest | AES-256 for database, file storage |
| Encryption in Transit | TLS 1.3 for all connections |
| Data Retention | Configurable retention policies |
| Minimum Necessary | Providers only access their own encounters |
| BAA | N/A (on-premise, internal use) |

### Authentication & Authorization

- JWT-based session management
- OAuth 2.0 integration option (internal IdP)
- Session timeout: configurable (default 30 minutes)
- Multi-factor authentication support

### Data Security

- Audio files encrypted at rest
- Transcripts encrypted at rest
- Database encryption (PostgreSQL TDE)
- No PHI in application logs
- Secure key management (HashiCorp Vault recommended)

---

## Infrastructure Requirements

### Minimum Hardware Specifications

**Application Server:**
- CPU: 8 cores (Intel Xeon / AMD EPYC)
- RAM: 32GB
- Storage: 500GB SSD (application + database)
- Network: 1Gbps

**GPU Server (AI Processing):**
- GPU: NVIDIA RTX 3090 / A4000 minimum (24GB VRAM ideal)
- CPU: 8 cores
- RAM: 64GB
- Storage: 1TB NVMe SSD

**Scaling Considerations:**
- Each concurrent transcription session: ~2GB VRAM
- With 24GB GPU: ~8-10 concurrent sessions
- Add GPU servers for horizontal scaling

### Software Stack

| Layer | Technology |
|-------|------------|
| OS | Ubuntu 22.04 LTS |
| Container Runtime | Docker + Docker Compose |
| Orchestration | Docker Swarm / K3s (optional) |
| Web Server | NGINX |
| Backend Runtime | Node.js 20 LTS / Python 3.11 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Model Serving | vLLM / Triton Inference Server |

---

## Development Phases

### Phase 1: Foundation (Weeks 1-4)

**Objectives:** Core infrastructure and basic transcription

**Deliverables:**
- [ ] Development environment setup
- [ ] Database schema and migrations
- [ ] User authentication system
- [ ] Basic web interface scaffolding
- [ ] Audio capture and WebSocket streaming
- [ ] Whisper integration (non-real-time initially)
- [ ] Simple transcript display

**Milestone:** Provider can record audio and see transcript (non-real-time)

---

### Phase 2: Real-Time Processing (Weeks 5-8)

**Objectives:** Live transcription with speaker separation

**Deliverables:**
- [ ] Real-time audio chunking pipeline
- [ ] Streaming Whisper inference
- [ ] Speaker diarization integration
- [ ] Live transcript UI with speaker labels
- [ ] Manual speaker label correction
- [ ] Session management (start/pause/end)

**Milestone:** Provider can conduct a visit with real-time labeled transcript

---

### Phase 3: Note Generation (Weeks 9-12)

**Objectives:** AI-powered SOAP note creation

**Deliverables:**
- [ ] Medical LLM integration (BioMistral)
- [ ] SOAP note generation pipeline
- [ ] Content filtering (non-clinical dialogue removal)
- [ ] Note editor interface
- [ ] Copy/export functionality
- [ ] Medical terminology service integration

**Milestone:** Complete encounter-to-note workflow functional

---

### Phase 4: Customization (Weeks 13-16)

**Objectives:** Provider personalization and specialty support

**Deliverables:**
- [ ] Provider preferences system
- [ ] Custom instruction processing
- [ ] Specialty template framework
- [ ] Template sharing functionality
- [ ] Note regeneration with feedback
- [ ] Tone and style controls

**Milestone:** Providers can customize their note generation experience

---

### Phase 5: Voice Learning (Weeks 17-20)

**Objectives:** Progressive speaker identification

**Deliverables:**
- [ ] Voice embedding extraction
- [ ] Voice profile storage and matching
- [ ] Confidence scoring system
- [ ] Auto-labeling with confirmation
- [ ] Patient name extraction from context
- [ ] Profile management UI

**Milestone:** System recognizes returning providers automatically

---

### Phase 6: Polish & Scale (Weeks 21-24)

**Objectives:** Production readiness and multi-user support

**Deliverables:**
- [ ] Load testing and optimization
- [ ] Concurrent session handling
- [ ] Mobile UI optimization
- [ ] Comprehensive error handling
- [ ] Admin dashboard
- [ ] Usage analytics
- [ ] Documentation and training materials
- [ ] Security audit and hardening

**Milestone:** Production-ready deployment

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GPU resource limitations | High | High | Start with quantized models; plan hardware procurement |
| Transcription accuracy issues | Medium | High | Implement correction interface; provider feedback loop |
| Medical terminology errors | Medium | High | Integrate medical NER; provider review required |
| Speaker diarization failures | Medium | Medium | Manual correction; voice enrollment improvement |
| Real-time latency issues | Medium | Medium | Audio buffer tuning; async processing |
| Concurrent user bottlenecks | Medium | Medium | Load balancing; queue management |
| HIPAA compliance gaps | Low | Critical | Security audit; encryption verification |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Transcription accuracy | >95% WER | Automated comparison with manual review |
| Note generation time | <60 seconds | End of recording to draft available |
| Provider edit rate | <20% of content | Tracking changes before finalization |
| System uptime | 99.5% | Monitoring and alerting |
| Concurrent sessions | 10+ simultaneous | Load testing |
| User satisfaction | >4.0/5.0 | Provider surveys |

---

## Appendix A: Technology Alternatives

### ASR Alternatives

| Option | Pros | Cons |
|--------|------|------|
| Whisper (OpenAI) | High accuracy, open-source | GPU intensive |
| Whisper.cpp | CPU efficient | Slightly lower accuracy |
| Vosk | Lightweight, offline | Lower accuracy |
| DeepSpeech | Fully open | Deprecated, limited updates |

### LLM Alternatives

| Option | Pros | Cons |
|--------|------|------|
| BioMistral-7B | Medical-tuned, efficient | Limited context window |
| MedAlpaca-13B | Strong reasoning | Higher resource needs |
| Llama-3-8B + fine-tune | Latest architecture | Requires fine-tuning |
| Mixtral-8x7B | High quality | 90GB+ for full model |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| ASR | Automatic Speech Recognition |
| Diarization | Process of identifying who spoke when |
| EHR/EMR | Electronic Health/Medical Record |
| SOAP | Subjective, Objective, Assessment, Plan note format |
| WER | Word Error Rate (transcription accuracy metric) |
| VRAM | Video RAM (GPU memory) |
| NER | Named Entity Recognition |
| PHI | Protected Health Information |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 4, 2026 | — | Initial project plan |
