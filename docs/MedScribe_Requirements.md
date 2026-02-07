# MedScribe: User Stories & Technical Requirements

**Version:** 1.0  
**Date:** February 4, 2026  
**Source Document:** MedScribe Project Plan v1.0

---

## User Stories

### Epic 1: User Authentication & Account Management

**US-1.1** As a physician, I want to log in with my credentials so that I can access my transcription sessions securely.

**US-1.2** As a physician, I want my session to automatically expire after inactivity so that patient data is protected if I step away.

**US-1.3** As a physician, I want to use multi-factor authentication so that my account has an additional layer of security.

**US-1.4** As an administrator, I want to create and manage provider accounts so that I can control system access.

**US-1.5** As an administrator, I want to view audit logs of all system access so that I can monitor for unauthorized activity.

---

### Epic 2: Real-Time Transcription

**US-2.1** As a physician, I want to record patient encounters through my browser so that I don't need to install additional software.

**US-2.2** As a physician, I want to see a live transcript as I speak with my patient so that I can verify the system is capturing the conversation.

**US-2.3** As a physician, I want to pause and resume recording during an encounter so that I can exclude irrelevant portions of the conversation.

**US-2.4** As a physician, I want the transcript to display speaker labels (Provider/Patient) so that I can distinguish who said what.

**US-2.5** As a physician, I want to see timestamp markers in the transcript so that I can reference specific moments in the conversation.

**US-2.6** As a physician, I want visual indicators showing who is currently speaking so that I can follow the live conversation flow.

**US-2.7** As a physician, I want to manually correct speaker labels if the system misidentifies a speaker so that the transcript remains accurate.

**US-2.8** As a physician, I want the system to automatically detect and display the patient's name from the conversation so that I don't need to enter it manually.

**US-2.9** As a physician, I want to edit the patient name if it's detected incorrectly so that records are accurate.

---

### Epic 3: SOAP Note Generation

**US-3.1** As a physician, I want to generate a SOAP note automatically when I end a recording session so that documentation is created without manual writing.

**US-3.2** As a physician, I want the generated note to follow standard SOAP format (Subjective, Objective, Assessment, Plan) so that it matches clinical documentation standards.

**US-3.3** As a physician, I want non-clinical dialogue (greetings, small talk, scheduling) filtered out of the note so that only medically relevant information is included.

**US-3.4** As a physician, I want the note to be generated within 60 seconds of ending the recording so that I can review it while the encounter is fresh.

**US-3.5** As a physician, I want to edit the generated note before finalizing so that I can add context or correct errors.

**US-3.6** As a physician, I want to view the original transcript alongside the generated note so that I can verify information and trace content to its source.

**US-3.7** As a physician, I want to click on a line in the transcript to highlight related content in the note so that I can understand where information came from.

**US-3.8** As a physician, I want to regenerate the note with different parameters so that I can get a better draft if the first attempt isn't satisfactory.

**US-3.9** As a physician, I want the system to use accurate medical terminology in the generated notes so that documentation is professionally appropriate.

**US-3.10** As a physician, I want uncertain or potentially misheard content flagged for my review so that I can verify critical medical information.

---

### Epic 4: Note Export & Finalization

**US-4.1** As a physician, I want to copy the entire note to my clipboard so that I can paste it into my EMR system.

**US-4.2** As a physician, I want to copy individual sections of the note so that I can paste only the parts I need.

**US-4.3** As a physician, I want to save draft notes so that I can return to them later.

**US-4.4** As a physician, I want to finalize a note so that it becomes the official version of record.

**US-4.5** As a physician, I want to view a history of all my encounters and notes so that I can reference past documentation.

---

### Epic 5: Provider Customization

**US-5.1** As a physician, I want to select my preferred writing tone (formal/conversational/terse) so that notes match my documentation style.

**US-5.2** As a physician, I want to choose the level of detail (minimal/standard/comprehensive) so that notes match my documentation preferences.

**US-5.3** As a physician, I want to specify my medical specialty so that note structures are appropriate for my practice.

**US-5.4** As a physician, I want to configure which SOAP sections to include by default so that notes match my typical workflow.

**US-5.5** As a physician, I want to save custom phrases I frequently use so that they can be automatically incorporated.

**US-5.6** As a physician, I want to set my abbreviation preferences (expand/keep/custom) so that notes use my preferred terminology.

**US-5.7** As a physician, I want to choose my Review of Systems format preference so that documentation matches my style.

**US-5.8** As a physician, I want to provide natural language instructions to guide note generation so that I can express preferences conversationally (e.g., "Always include smoking status").

**US-5.9** As a physician, I want to specify exclusion rules so that certain content is never included in notes (e.g., "Never mention patient's job unless relevant").

---

### Epic 6: Templates & Sharing

**US-6.1** As a physician, I want to save my current settings as a named template so that I can reuse them.

**US-6.2** As a physician, I want to share my templates with colleagues so that they can benefit from my configurations.

**US-6.3** As a physician, I want to import templates shared by other providers so that I can learn from their approaches.

**US-6.4** As a physician, I want to access specialty-specific starter templates so that I have a good starting point for my practice area.

**US-6.5** As an administrator, I want to set organization-level default templates so that new providers have consistent starting configurations.

---

### Epic 7: Voice Recognition & Progressive Learning

**US-7.1** As a physician, I want to indicate that I am the provider at the start of a session so that the system can properly label speakers.

**US-7.2** As a physician, I want the system to learn my voice over time so that future sessions automatically recognize me.

**US-7.3** As a physician, I want the system to ask for confirmation when it's uncertain about speaker identification so that accuracy is maintained.

**US-7.4** As a physician, I want to view and manage my voice profile so that I can see how well the system recognizes me.

**US-7.5** As a physician, I want the option to re-train my voice profile if recognition degrades so that identification improves.

---

### Epic 8: Specialty-Specific Features

**US-8.1** As a cardiologist, I want expanded cardiac ROS sections and EKG findings fields so that my notes capture specialty-specific information.

**US-8.2** As an orthopedist, I want detailed MSK exam templates with range of motion fields so that my notes capture relevant physical findings.

**US-8.3** As a psychiatrist, I want mental status exam templates with safety assessment sections so that my notes meet specialty requirements.

**US-8.4** As a pediatrician, I want growth/development sections with vaccination status fields so that my notes capture age-appropriate information.

**US-8.5** As an OB/GYN, I want OB history sections with gestational data fields so that my notes capture pregnancy-specific information.

---

### Epic 9: Mobile & Responsive Experience

**US-9.1** As a physician using a tablet, I want a touch-optimized interface with large recording controls so that I can use the system bedside.

**US-9.2** As a physician using a mobile phone, I want a stacked layout so that I can view transcripts and notes on a smaller screen.

**US-9.3** As a physician using a mobile device, I want swipe gestures for navigation so that I can move through the interface quickly.

**US-9.4** As a physician using a mobile device, I want collapsible sections so that I can focus on relevant information.

---

### Epic 10: Administration & Analytics

**US-10.1** As an administrator, I want to view a dashboard of system usage so that I can understand adoption patterns.

**US-10.2** As an administrator, I want to see how many concurrent sessions are running so that I can monitor system capacity.

**US-10.3** As an administrator, I want to configure data retention policies so that I can comply with organizational requirements.

**US-10.4** As an administrator, I want to access usage analytics per provider so that I can identify training needs.

---

## Technical Requirements

### TR-1: Infrastructure & Deployment

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-1.1 | System must be deployable entirely on-premise with no external data transmission | Critical |
| TR-1.2 | Application server must support minimum 8-core CPU, 32GB RAM, 500GB SSD | Critical |
| TR-1.3 | GPU server must support NVIDIA RTX 3090/A4000 or equivalent (24GB VRAM ideal) | Critical |
| TR-1.4 | System must run on Ubuntu 22.04 LTS | High |
| TR-1.5 | All services must be containerized using Docker | High |
| TR-1.6 | System must support orchestration via Docker Swarm or K3s | Medium |
| TR-1.7 | Network must support 1Gbps minimum throughput | High |

---

### TR-2: Security & Compliance

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-2.1 | All data at rest must be encrypted using AES-256 | Critical |
| TR-2.2 | All data in transit must be encrypted using TLS 1.3 | Critical |
| TR-2.3 | Authentication must use JWT-based session management | Critical |
| TR-2.4 | System must support OAuth 2.0 integration with internal identity providers | High |
| TR-2.5 | Session timeout must be configurable (default 30 minutes) | High |
| TR-2.6 | Multi-factor authentication must be supported | High |
| TR-2.7 | All access and modifications must be logged with timestamps for audit | Critical |
| TR-2.8 | Role-based access control must restrict providers to their own encounters | Critical |
| TR-2.9 | No PHI may appear in application logs | Critical |
| TR-2.10 | System must support configurable data retention policies | High |
| TR-2.11 | Secret management must use HashiCorp Vault or equivalent | High |
| TR-2.12 | Database must use PostgreSQL Transparent Data Encryption (TDE) | High |

---

### TR-3: Audio Capture & Processing

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-3.1 | Audio capture must use browser-based WebRTC | Critical |
| TR-3.2 | Audio must stream continuously via WebSocket connections | Critical |
| TR-3.3 | Audio chunking must support 100-500ms segments | High |
| TR-3.4 | Client-side noise reduction must be optional | Medium |
| TR-3.5 | Audio buffering must support 2-5 second windows | High |
| TR-3.6 | System must support HTTPS/WSS protocols only | Critical |

---

### TR-4: Speech Recognition (ASR)

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-4.1 | ASR must use Whisper (OpenAI) as the primary engine | Critical |
| TR-4.2 | System must support multiple Whisper model sizes (tiny to large) | High |
| TR-4.3 | Whisper.cpp must be available as a CPU fallback option | Medium |
| TR-4.4 | Transcription accuracy must achieve >95% Word Error Rate (WER) | Critical |
| TR-4.5 | Real-time transcription latency must not exceed 3 seconds | High |
| TR-4.6 | ASR must handle medical vocabulary appropriately | High |

---

### TR-5: Speaker Diarization

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-5.1 | Diarization must use pyannote-audio as the primary engine | High |
| TR-5.2 | System must handle overlapping speech | High |
| TR-5.3 | GPU memory allocation must support 2-4GB VRAM for diarization | High |
| TR-5.4 | System must support manual speaker label correction | Critical |
| TR-5.5 | Initial sessions must support Provider/Patient role assignment | Critical |

---

### TR-6: Voice Recognition & Profiles

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-6.1 | Voice embeddings must be extracted using Resemblyzer or SpeechBrain | High |
| TR-6.2 | Embeddings must be stored in a vector database (pgvector or Chroma) | High |
| TR-6.3 | Auto-labeling confidence threshold must be 85% minimum | High |
| TR-6.4 | Below-threshold identifications must prompt for confirmation | High |
| TR-6.5 | Voice profiles must track sample count and confidence score | Medium |

---

### TR-7: Medical Language Model (LLM)

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-7.1 | Primary LLM must be BioMistral-7B or equivalent medical-tuned model | Critical |
| TR-7.2 | Model must support 4-bit quantization for reduced VRAM (~4GB) | High |
| TR-7.3 | Inference must use llama.cpp or vLLM for efficient serving | High |
| TR-7.4 | Note generation must complete within 60 seconds | Critical |
| TR-7.5 | Model serving must use vLLM or Triton Inference Server | High |
| TR-7.6 | System must integrate MedSpaCy for medical NLP | High |
| TR-7.7 | System must support UMLS Metathesaurus for terminology | Medium |
| TR-7.8 | System must support RxNorm for medication names | Medium |
| TR-7.9 | System must support SNOMED CT for clinical terms | Medium |

---

### TR-8: Named Entity Recognition (NER)

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-8.1 | Medical NER must use MedCAT or scispaCy | High |
| TR-8.2 | System must extract patient names from conversation context | High |
| TR-8.3 | System must identify and extract medical entities (conditions, medications, procedures) | High |

---

### TR-9: Data Storage

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-9.1 | Primary database must be PostgreSQL 16 | Critical |
| TR-9.2 | Vector database must support voice embedding storage | High |
| TR-9.3 | File storage must support encrypted audio and export files | Critical |
| TR-9.4 | Message queue must use Redis or RabbitMQ | High |
| TR-9.5 | Cache layer must use Redis 7 | High |

---

### TR-10: Data Model Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-10.1 | Provider entity must store id, email, name, specialty, timestamps | Critical |
| TR-10.2 | ProviderPreferences must store tone, detail_level, custom_instructions | Critical |
| TR-10.3 | NoteTemplate must store structure as JSONB with sharing capability | High |
| TR-10.4 | Encounter must store provider_id, patient_name, status, timestamps | Critical |
| TR-10.5 | Transcript must store full_text, segments (JSONB), audio_file_path | Critical |
| TR-10.6 | GeneratedNote must store versioned content as JSONB with finalization tracking | Critical |
| TR-10.7 | VoiceProfile must store embeddings as vectors with confidence scoring | High |

---

### TR-11: API & Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-11.1 | REST API must be implemented using Node.js/Express or FastAPI | Critical |
| TR-11.2 | WebSocket server must support real-time audio streaming | Critical |
| TR-11.3 | API Gateway must use NGINX or Traefik for load balancing | High |
| TR-11.4 | Backend runtime must support Node.js 20 LTS or Python 3.11 | Critical |

---

### TR-12: Performance & Scalability

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-12.1 | System must support 10+ concurrent transcription sessions | Critical |
| TR-12.2 | Each concurrent session must allocate ~2GB VRAM | High |
| TR-12.3 | System uptime must achieve 99.5% availability | Critical |
| TR-12.4 | Architecture must support horizontal scaling via additional GPU servers | High |
| TR-12.5 | Message queue must distribute AI processing tasks efficiently | High |

---

### TR-13: User Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-13.1 | Web interface must be responsive across desktop, tablet, and mobile | Critical |
| TR-13.2 | Transcript view must display rolling text with speaker labels | Critical |
| TR-13.3 | Timestamp markers must appear every 30 seconds | Medium |
| TR-13.4 | Note editor must support side-by-side transcript reference | High |
| TR-13.5 | Mobile interface must use stacked layouts and large touch targets | High |
| TR-13.6 | Interface must support swipe gestures on mobile devices | Medium |

---

### TR-14: Content Processing

| ID | Requirement | Priority |
|----|-------------|----------|
| TR-14.1 | System must filter non-clinical dialogue from generated notes | High |
| TR-14.2 | System must retain medically relevant context (e.g., occupation if relevant) | High |
| TR-14.3 | Uncertain content must be flagged for provider review | High |
| TR-14.4 | SOAP structure must include all standard sections (Subjective, Objective, Assessment, Plan) | Critical |

---

## Acceptance Criteria Summary

| Metric | Target |
|--------|--------|
| Transcription Accuracy | >95% WER |
| Note Generation Time | <60 seconds |
| Provider Edit Rate | <20% of content |
| System Uptime | 99.5% |
| Concurrent Sessions | 10+ simultaneous |
| User Satisfaction | >4.0/5.0 |

---

## Traceability Matrix

| User Story | Technical Requirements |
|------------|----------------------|
| US-1.1, US-1.2, US-1.3 | TR-2.3, TR-2.4, TR-2.5, TR-2.6 |
| US-2.1, US-2.2 | TR-3.1, TR-3.2, TR-4.1, TR-4.5 |
| US-2.3 | TR-3.2, TR-11.2 |
| US-2.4, US-2.7 | TR-5.1, TR-5.4, TR-5.5 |
| US-2.5, US-2.6 | TR-13.2, TR-13.3 |
| US-2.8, US-2.9 | TR-8.1, TR-8.2 |
| US-3.1, US-3.4 | TR-7.1, TR-7.4 |
| US-3.2 | TR-14.4 |
| US-3.3 | TR-14.1, TR-14.2 |
| US-3.9, US-3.10 | TR-7.6, TR-7.7, TR-7.8, TR-7.9, TR-14.3 |
| US-5.1 - US-5.9 | TR-10.2 |
| US-6.1 - US-6.5 | TR-10.3 |
| US-7.1 - US-7.5 | TR-6.1, TR-6.2, TR-6.3, TR-6.4, TR-6.5, TR-10.7 |
| US-9.1 - US-9.4 | TR-13.1, TR-13.5, TR-13.6 |
| US-10.1 - US-10.4 | TR-2.7, TR-2.10 |

---

*Document generated from MedScribe Project Plan v1.0*
