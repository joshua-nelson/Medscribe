# MedScribe: MVP Implementation Plan

**Version:** 1.0  
**Date:** February 4, 2026  
**Approach:** Incremental Feature Delivery

---

## Philosophy

This plan builds MedScribe one working feature at a time. Each step produces a testable, demonstrable increment. You should be able to stop at any step and have something that works—it just won't have all the features yet.

---

## Prerequisites

Before writing any application code, complete these foundational tasks:

### Step 0.1: Development Environment Setup
**Time estimate:** 1-2 days

**Tasks:**
1. Provision development machine with Docker and Docker Compose installed
2. Install NVIDIA drivers and CUDA toolkit (for GPU server)
3. Install Node.js 20 LTS and Python 3.11
4. Set up code repository with branching strategy (main, develop, feature branches)
5. Configure linting, formatting, and pre-commit hooks
6. Create initial Docker Compose file with placeholder services

**Verification:** `docker compose up` runs without errors (services may not do anything yet)

---

### Step 0.2: Database Setup
**Time estimate:** 1 day

**Tasks:**
1. Create PostgreSQL 16 Docker service
2. Create initial database and application user
3. Set up database migration tool (Prisma, Knex, or Alembic depending on backend choice)
4. Create initial migration with Provider table only:
   ```sql
   CREATE TABLE providers (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email VARCHAR(255) UNIQUE NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     name VARCHAR(255) NOT NULL,
     specialty VARCHAR(100),
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```
5. Add Redis service to Docker Compose (for sessions/cache)

**Verification:** Can connect to database and run migrations/c/down

---

## Phase 1: Authentication & Basic UI Shell

### Step 1.1: Backend API Scaffold
**Time estimate:** 2-3 days  
**Implements:** Foundation for TR-11.1, TR-11.4

**Tasks:**
1. Initialize backend project (Node.js/Express or FastAPI)
2. Set up project structure:
   ```
   /src
     /routes
     /controllers
     /services
     /middleware
     /models
   ```
3. Configure environment variable handling (.env)
4. Create health check endpoint: `GET /api/health`
5. Set up request logging middleware
6. Configure CORS for local development

**Verification:** `curl http://localhost:3000/api/health` returns `{"status": "ok"}`

---

### Step 1.2: Provider Authentication
**Time estimate:** 3-4 days  
**Implements:** US-1.1, US-1.2, TR-2.3, TR-2.4, TR-2.5

**Tasks:**
1. Create authentication routes:
   - `POST /api/auth/register` (development only)
   - `POST /api/auth/login`
   - `POST /api/auth/logout`
   - `GET /api/auth/me`
2. Implement password hashing (bcrypt)
3. Implement JWT token generation and validation
4. Create auth middleware for protected routes
5. Configure session timeout (30-minute default, configurable)
6. Store refresh tokens in Redis with TTL
7. Add token refresh endpoint: `POST /api/auth/refresh`

**Verification:** 
- Can register a test provider
- Can log in and receive JWT
- Protected routes reject requests without valid token
- Token expires after configured timeout

---

### Step 1.3: Frontend Shell
**Time estimate:** 2-3 days  
**Implements:** TR-13.1 (foundation)

**Tasks:**
1. Initialize React/Next.js project with TypeScript
2. Set up Tailwind CSS for styling
3. Create basic layout components:
   - `<AppShell>` with header/sidebar/main area
   - `<Header>` with logo and user menu
   - `<Sidebar>` with navigation placeholder
4. Create routing structure:
   - `/login` - Login page
   - `/` - Dashboard (protected)
   - `/encounter/new` - New encounter (protected, placeholder)
5. Implement authentication state management (React Context or Zustand)
6. Create login form with email/password fields
7. Implement protected route wrapper

**Verification:**
- Login page renders
- Successful login redirects to dashboard
- Attempting to access protected route while logged out redirects to login
- User can log out

---

### Step 1.4: Session Timeout UI
**Time estimate:** 1 day  
**Implements:** US-1.2

**Tasks:**
1. Create activity tracker (mouse movement, keyboard input)
2. Show warning modal at 25 minutes of inactivity
3. Auto-logout at 30 minutes with "Session expired" message
4. Implement "Stay logged in" button that refreshes token

**Verification:** Leave app idle for 25 minutes → warning appears; idle 5 more minutes → logged out

---

## Phase 2: Audio Capture & Basic Transcription

### Step 2.1: Audio Capture in Browser
**Time estimate:** 2-3 days  
**Implements:** US-2.1, TR-3.1, TR-3.2

**Tasks:**
1. Create `<AudioRecorder>` component
2. Request microphone permission using `navigator.mediaDevices.getUserMedia`
3. Use MediaRecorder API to capture audio
4. Display recording state indicator (recording/paused/stopped)
5. Create recording controls: Start, Pause, Resume, Stop
6. Show audio level meter (visual feedback that mic is working)
7. Buffer audio chunks client-side
8. Display recording duration timer

**Verification:** 
- Click "Start" → browser requests mic permission
- Audio level meter responds to speech
- Can pause/resume recording
- Can stop recording

---

### Step 2.2: WebSocket Server Setup
**Time estimate:** 2 days  
**Implements:** TR-11.2

**Tasks:**
1. Add Socket.io to backend
2. Create WebSocket authentication middleware (verify JWT on connection)
3. Define event protocol:
   - Client → Server: `audio:chunk` (binary audio data)
   - Client → Server: `session:start`, `session:pause`, `session:resume`, `session:end`
   - Server → Client: `transcript:update` (new transcript segment)
   - Server → Client: `session:status` (acknowledgments)
4. Create connection handling with cleanup on disconnect
5. Implement heartbeat/ping-pong to detect stale connections

**Verification:** Client connects via WebSocket, server logs connection, client can send test messages

---

### Step 2.3: Audio Streaming Pipeline
**Time estimate:** 2-3 days  
**Implements:** US-2.1, TR-3.2

**Tasks:**
1. Configure MediaRecorder to output in chunks (500ms intervals)
2. Convert audio chunks to appropriate format (WAV/WebM)
3. Send chunks over WebSocket with sequence numbers
4. Server receives and buffers chunks
5. Create audio file storage service (local filesystem initially)
6. Save complete audio files after session ends

**Verification:** 
- Record 30 seconds of audio
- Chunks appear on server
- After stopping, complete audio file exists on server

---

### Step 2.4: Whisper Integration (Non-Real-Time)
**Time estimate:** 3-4 days  
**Implements:** TR-4.1, TR-4.2

**Tasks:**
1. Create Python transcription service (separate from main API)
2. Install and configure Whisper (start with `small` model for development)
3. Create endpoint/queue handler for transcription requests
4. Process complete audio files through Whisper
5. Return transcript with timestamps
6. Create database table for transcripts:
   ```sql
   CREATE TABLE transcripts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     encounter_id UUID NOT NULL,
     full_text TEXT,
     segments JSONB, -- [{start: 0.0, end: 2.5, text: "Hello..."}]
     audio_file_path VARCHAR(500),
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```
7. Store transcript in database after processing

**Verification:**
- Upload test audio file
- Receive transcript text back
- Transcript stored in database with timestamps

---

### Step 2.5: Encounter Data Model
**Time estimate:** 1-2 days  
**Implements:** TR-10.4

**Tasks:**
1. Create encounters table:
   ```sql
   CREATE TABLE encounters (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     provider_id UUID REFERENCES providers(id),
     patient_name VARCHAR(255),
     status VARCHAR(50) DEFAULT 'recording', -- recording, processing, draft, finalized
     started_at TIMESTAMP DEFAULT NOW(),
     ended_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```
2. Create encounter API endpoints:
   - `POST /api/encounters` - Create new encounter
   - `GET /api/encounters/:id` - Get encounter details
   - `PATCH /api/encounters/:id` - Update encounter (patient name, status)
   - `GET /api/encounters` - List provider's encounters
3. Link transcripts to encounters via foreign key

**Verification:** Can create encounter, view it, see associated transcript

---

### Step 2.6: Basic Transcript Display
**Time estimate:** 2 days  
**Implements:** US-2.2 (partial), TR-13.2

**Tasks:**
1. Create `<TranscriptView>` component
2. Display transcript text after recording ends
3. Show processing spinner while Whisper runs
4. Display timestamps alongside text segments
5. Show "No transcript yet" state during recording
6. Add polling or WebSocket subscription for transcript status

**Verification:**
- Start recording → "Recording..." indicator
- Stop recording → "Processing..." spinner
- Transcript appears → text displays with timestamps

---

## Phase 3: Real-Time Transcription

### Step 3.1: Streaming Whisper Pipeline
**Time estimate:** 4-5 days  
**Implements:** US-2.2, TR-4.5

**Tasks:**
1. Modify audio pipeline to process chunks as they arrive
2. Implement audio buffer (accumulate 3-5 seconds before processing)
3. Set up Whisper in streaming mode (process buffer, slide window)
4. Handle partial results vs. finalized segments
5. Send incremental transcript updates via WebSocket
6. Implement transcript merging (combine overlapping segments)
7. Optimize for <3 second latency

**Verification:**
- Start recording and speak
- Text appears within 3 seconds of speaking
- Text updates smoothly without duplicates

---

### Step 3.2: Live Transcript UI
**Time estimate:** 2-3 days  
**Implements:** US-2.2, US-2.5

**Tasks:**
1. Update `<TranscriptView>` for live updates
2. Implement auto-scroll (follow new text)
3. Add user scroll detection (stop auto-scroll if user scrolls up)
4. Display timestamp markers every 30 seconds
5. Add visual indicator for "live" text vs. finalized text
6. Handle reconnection gracefully (resync transcript)

**Verification:**
- Text appears in real-time as you speak
- Timestamps appear at 30-second intervals
- Scrolling up stops auto-scroll; new "Jump to live" button appears

---

### Step 3.3: Recording State Management
**Time estimate:** 2 days  
**Implements:** US-2.3

**Tasks:**
1. Implement pause/resume on both client and server
2. Track recording segments with gaps
3. Adjust timestamps to account for paused periods
4. Visual indicator for paused state
5. Prevent accidental stops (confirm dialog)
6. Handle browser tab close/navigation (warn about active recording)

**Verification:**
- Pause recording → audio stops, UI shows paused
- Resume → recording continues, timestamps are correct
- Close tab → browser warns about leaving

---

## Phase 4: Speaker Diarization

### Step 4.1: Diarization Service Setup
**Time estimate:** 3-4 days  
**Implements:** TR-5.1, TR-5.2

**Tasks:**
1. Create diarization Python service
2. Install and configure pyannote-audio
3. Accept HuggingFace license for pyannote models
4. Create pipeline: audio → speaker segments
5. Test with sample two-speaker audio
6. Handle overlapping speech detection
7. Output format: `[{speaker: "SPEAKER_0", start: 0.0, end: 5.2}, ...]`

**Verification:** Process test audio with two speakers → output correctly identifies speaker changes

---

### Step 4.2: Integrate Diarization with Transcription
**Time estimate:** 3-4 days  
**Implements:** US-2.4, TR-5.5

**Tasks:**
1. Run diarization on audio buffer alongside ASR
2. Align diarization output with transcript segments
3. Add speaker labels to transcript segments:
   ```json
   {
     "start": 0.0,
     "end": 2.5,
     "text": "What brings you in today?",
     "speaker": "SPEAKER_0"
   }
   ```
4. Map initial speakers to roles (SPEAKER_0 → Provider, SPEAKER_1 → Patient)
5. Update transcript database schema to include speaker info
6. Handle more than 2 speakers gracefully (rare but possible)

**Verification:** Two-person conversation → transcript shows correct speaker attribution

---

### Step 4.3: Speaker Labels in UI
**Time estimate:** 2-3 days  
**Implements:** US-2.4, US-2.6, TR-13.2

**Tasks:**
1. Update `<TranscriptView>` to display speaker labels
2. Color-code speakers (e.g., blue for Provider, green for Patient)
3. Add "currently speaking" indicator (pulsing dot or highlight)
4. Group consecutive segments from same speaker
5. Create speaker legend/key at top of transcript

**Verification:**
- Transcript shows "Provider:" and "Patient:" labels
- Each speaker has distinct color
- Active speaker is highlighted during live recording

---

### Step 4.4: Manual Speaker Correction
**Time estimate:** 2 days  
**Implements:** US-2.7, TR-5.4

**Tasks:**
1. Make speaker labels clickable
2. Create dropdown/popover to change speaker assignment
3. API endpoint: `PATCH /api/transcripts/:id/segments/:segmentIndex`
4. Update UI immediately on change
5. Allow bulk reassignment ("Change all SPEAKER_0 to Provider")
6. Store corrections for potential voice learning feedback

**Verification:**
- Click wrong label → dropdown appears
- Select correct speaker → label updates
- Change persists after page refresh

---

### Step 4.5: Session Start Speaker Assignment
**Time estimate:** 1-2 days  
**Implements:** US-7.1

**Tasks:**
1. Create "Start Encounter" modal/screen
2. Add "I am the provider" button/indicator
3. Prompt provider to speak first (or speak a calibration phrase)
4. Assign first speaker as Provider automatically
5. Assign second speaker as Patient automatically
6. Store initial assignment in encounter metadata

**Verification:**
- Start encounter → "Please speak first to identify yourself as the provider"
- Speak → first speaker auto-labeled as Provider
- Patient speaks → auto-labeled as Patient

---

## Phase 5: Patient Name Detection

### Step 5.1: Medical NER Service
**Time estimate:** 2-3 days  
**Implements:** TR-8.1, TR-8.2

**Tasks:**
1. Create NER Python service
2. Install MedCAT or scispaCy with clinical models
3. Create endpoint: POST body with text → extracted entities
4. Configure for person name extraction specifically
5. Test with sample clinical dialogues

**Verification:** Send "Nice to meet you, John Smith" → receive `{"persons": ["John Smith"]}`

---

### Step 5.2: Patient Name Extraction
**Time estimate:** 2 days  
**Implements:** US-2.8

**Tasks:**
1. Run NER on transcript periodically (every 30 seconds or on-demand)
2. Extract patient name candidates from Patient speaker segments
3. Apply heuristics:
   - Ignore provider name (already known)
   - Look for introduction patterns ("I'm...", "My name is...")
   - Weight names mentioned multiple times
4. Store detected name in encounter record
5. Handle "no name detected" case gracefully

**Verification:** Conversation includes "Hi, I'm Sarah Johnson" → encounter shows patient_name: "Sarah Johnson"

---

### Step 5.3: Patient Name UI
**Time estimate:** 1-2 days  
**Implements:** US-2.8, US-2.9

**Tasks:**
1. Display detected patient name in encounter header
2. Show confidence indicator if uncertain
3. Make name field editable (inline edit)
4. API: `PATCH /api/encounters/:id` with `patient_name`
5. Show "Patient name not detected" if extraction fails
6. Allow manual entry at any time

**Verification:**
- Patient name appears automatically during encounter
- Can click to edit if wrong
- Can enter manually if not detected

---

## Phase 6: SOAP Note Generation

### Step 6.1: LLM Service Setup
**Time estimate:** 3-4 days  
**Implements:** TR-7.1, TR-7.2, TR-7.3

**Tasks:**
1. Create note generation Python service
2. Install vLLM or llama.cpp
3. Download BioMistral-7B model (4-bit quantized)
4. Create basic inference endpoint
5. Configure GPU memory allocation
6. Test with simple medical prompts
7. Measure inference speed (target: process 1000 words in <30 seconds)

**Verification:** Send medical text → receive coherent medical response

---

### Step 6.2: SOAP Note Prompt Engineering
**Time estimate:** 3-4 days  
**Implements:** US-3.2, TR-14.4

**Tasks:**
1. Design SOAP note generation prompt template
2. Include structured output format instructions:
   ```
   Generate a SOAP note with these sections:
   ## SUBJECTIVE
   ### Chief Complaint
   ### History of Present Illness
   ...
   ```
3. Add few-shot examples of good SOAP notes
4. Test with variety of transcript types (short visit, complex case)
5. Iterate on prompt based on output quality
6. Create prompt versioning system for future improvements

**Verification:** Feed sample transcript → output follows SOAP format correctly

---

### Step 6.3: Content Filtering
**Time estimate:** 2-3 days  
**Implements:** US-3.3, TR-14.1, TR-14.2

**Tasks:**
1. Add filtering instructions to prompt
2. Define non-clinical content categories:
   - Greetings and small talk
   - Scheduling discussions
   - Insurance/billing talk
   - Unrelated personal conversation
3. Instruct model to retain relevant context (occupation if medically relevant)
4. Test filtering with transcripts containing mixed content
5. Verify medical content is preserved

**Verification:** Transcript with "How's your family?" → not in note; "I'm a construction worker with back pain" → occupation included

---

### Step 6.4: Note Generation Pipeline
**Time estimate:** 2-3 days  
**Implements:** US-3.1, US-3.4, TR-7.4

**Tasks:**
1. Create end-to-end pipeline:
   - Encounter ends → trigger note generation
   - Fetch full transcript
   - Send to LLM service
   - Parse structured output
   - Store in database
2. Create generated_notes table:
   ```sql
   CREATE TABLE generated_notes (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     encounter_id UUID REFERENCES encounters(id),
     version INTEGER DEFAULT 1,
     content JSONB, -- {subjective: {...}, objective: {...}, ...}
     raw_text TEXT,
     is_finalized BOOLEAN DEFAULT FALSE,
     generation_time_ms INTEGER,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```
3. Implement generation timeout (90 seconds max)
4. Handle generation failures gracefully
5. Track generation time metrics

**Verification:**
- End encounter → note appears within 60 seconds
- Note contains all SOAP sections
- Generation time logged

---

### Step 6.5: Note Display UI
**Time estimate:** 2-3 days  
**Implements:** US-3.2, US-3.5

**Tasks:**
1. Create `<NoteEditor>` component
2. Display SOAP sections in structured format
3. Make each section editable (rich text or markdown)
4. Show generation timestamp
5. Add "Generating..." state with progress indicator
6. Display error state if generation fails

**Verification:**
- Note displays with clear section headers
- Can click into any section and edit text
- Edits are saved

---

### Step 6.6: Side-by-Side Transcript Reference
**Time estimate:** 2-3 days  
**Implements:** US-3.6, TR-13.4

**Tasks:**
1. Create split-view layout: transcript | note
2. Make layout responsive (stacked on mobile)
3. Sync scroll optionally (scroll transcript → note follows)
4. Add collapse/expand for transcript panel
5. Allow resizing split position

**Verification:**
- Desktop: transcript and note visible side-by-side
- Mobile: can toggle between views
- Can reference original words while editing note

---

### Step 6.7: Note Regeneration
**Time estimate:** 2 days  
**Implements:** US-3.8

**Tasks:**
1. Add "Regenerate Note" button
2. Show confirmation dialog (will lose current edits)
3. Allow feedback input ("Include more detail about medications")
4. Append feedback to generation prompt
5. Store new version (increment version number)
6. Show version history with ability to view previous versions

**Verification:**
- Click regenerate → new note generated
- Can add feedback → note reflects feedback
- Previous version still accessible

---

## Phase 7: Note Export & Finalization

### Step 7.1: Copy to Clipboard
**Time estimate:** 1 day  
**Implements:** US-4.1, US-4.2

**Tasks:**
1. Add "Copy All" button to note view
2. Add "Copy Section" button to each SOAP section
3. Format copied text appropriately (plain text, not HTML)
4. Show "Copied!" feedback toast
5. Handle clipboard permission gracefully

**Verification:** Click copy → text in clipboard → paste into text editor shows formatted note

---

### Step 7.2: Save Draft
**Time estimate:** 1-2 days  
**Implements:** US-4.3

**Tasks:**
1. Auto-save edits every 30 seconds
2. Show "Saving..." / "Saved" indicator
3. Implement debounced save on edit
4. Handle save conflicts (warn if edited elsewhere)
5. Update encounter status to "draft"

**Verification:** Edit note → close browser → reopen → edits preserved

---

### Step 7.3: Finalize Note
**Time estimate:** 2 days  
**Implements:** US-4.4

**Tasks:**
1. Add "Finalize" button with confirmation
2. Finalization requirements check:
   - Patient name present
   - All required sections have content
   - Any flagged items reviewed
3. Set `is_finalized = true` on note
4. Set `status = 'finalized'` on encounter
5. Lock note from further edits (display-only mode)
6. Record finalization timestamp and provider

**Verification:**
- Click finalize → confirmation dialog
- After finalization → note is read-only
- Cannot un-finalize through UI

---

### Step 7.4: Encounter History
**Time estimate:** 2 days  
**Implements:** US-4.5

**Tasks:**
1. Create `/encounters` page (encounter list)
2. Display sortable/filterable table:
   - Date
   - Patient name
   - Status (recording, draft, finalized)
   - Actions (view, continue editing)
3. Add search by patient name
4. Add date range filter
5. Pagination for large lists
6. Click row → navigate to encounter detail

**Verification:** List shows all provider's encounters, can search, can click to view

---

## Phase 8: Provider Preferences

### Step 8.1: Preferences Data Model
**Time estimate:** 1-2 days  
**Implements:** TR-10.2

**Tasks:**
1. Create provider_preferences table:
   ```sql
   CREATE TABLE provider_preferences (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     provider_id UUID UNIQUE REFERENCES providers(id),
     tone VARCHAR(50) DEFAULT 'professional', -- professional, conversational, terse
     detail_level VARCHAR(50) DEFAULT 'standard', -- minimal, standard, comprehensive
     specialty VARCHAR(100),
     sections_config JSONB, -- which sections to include
     custom_phrases JSONB, -- frequently used phrases
     abbreviation_pref VARCHAR(50) DEFAULT 'expand', -- expand, keep, custom
     ros_format VARCHAR(50),
     custom_instructions TEXT, -- natural language instructions
     exclusion_rules TEXT[], -- things to never include
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```
2. Create CRUD API endpoints for preferences
3. Initialize default preferences on provider creation

**Verification:** Can create, read, update provider preferences via API

---

### Step 8.2: Preferences UI
**Time estimate:** 3-4 days  
**Implements:** US-5.1, US-5.2, US-5.3, US-5.4, US-5.6, US-5.7

**Tasks:**
1. Create `/settings/preferences` page
2. Build form sections:
   - Tone selection (radio buttons)
   - Detail level selection (radio buttons)
   - Specialty dropdown
   - SOAP sections checkboxes (which to include)
   - Abbreviation preference (radio buttons)
   - ROS format preference (dropdown)
3. Save button with success feedback
4. Reset to defaults option

**Verification:** Change settings → save → reload page → settings persisted

---

### Step 8.3: Custom Instructions
**Time estimate:** 2 days  
**Implements:** US-5.8, US-5.9

**Tasks:**
1. Add text area for custom instructions
2. Add text area for exclusion rules (one per line)
3. Add common phrases section (add/remove phrases)
4. Preview how instructions affect generation (optional)
5. Store in preferences

**Verification:** Add "Always include smoking status" → generate note → smoking status present

---

### Step 8.4: Apply Preferences to Generation
**Time estimate:** 2-3 days  
**Implements:** US-5.1 through US-5.9

**Tasks:**
1. Fetch provider preferences before note generation
2. Inject preferences into generation prompt:
   - Tone instruction
   - Detail level instruction
   - Specialty context
   - Section inclusion/exclusion
   - Custom instructions verbatim
   - Exclusion rules as constraints
3. Apply abbreviation handling post-generation
4. Test with various preference combinations

**Verification:** Set tone to "terse" → generate note → note is concise; set to "comprehensive" → note is detailed

---

## Phase 9: Templates

### Step 9.1: Template Data Model
**Time estimate:** 1-2 days  
**Implements:** TR-10.3

**Tasks:**
1. Create note_templates table:
   ```sql
   CREATE TABLE note_templates (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name VARCHAR(255) NOT NULL,
     description TEXT,
     owner_id UUID REFERENCES providers(id),
     specialty VARCHAR(100),
     structure JSONB NOT NULL, -- full preference snapshot
     is_public BOOLEAN DEFAULT FALSE,
     is_default BOOLEAN DEFAULT FALSE,
     share_code VARCHAR(50) UNIQUE,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```
2. Create CRUD API endpoints
3. Add template retrieval by share_code

**Verification:** Can create, list, update templates via API

---

### Step 9.2: Save as Template
**Time estimate:** 2 days  
**Implements:** US-6.1

**Tasks:**
1. Add "Save as Template" button in preferences
2. Prompt for template name and description
3. Snapshot current preferences into template structure
4. Show success message with template ID

**Verification:** Configure preferences → save as template → template appears in list

---

### Step 9.3: Apply Template
**Time estimate:** 1-2 days  
**Implements:** US-6.4

**Tasks:**
1. Add template selector dropdown in preferences
2. "Apply Template" button loads template settings
3. Warn before overwriting current preferences
4. Apply all settings from template

**Verification:** Select template → apply → preferences update to match template

---

### Step 9.4: Share Templates
**Time estimate:** 2 days  
**Implements:** US-6.2, US-6.3

**Tasks:**
1. Add "Share" button to templates
2. Generate unique share code
3. Display shareable link/code
4. Create "Import Template" feature
5. Import by entering share code
6. Preview template before importing

**Verification:** Share template → copy code → different provider imports → template available to them

---

### Step 9.5: Specialty Starter Templates
**Time estimate:** 2-3 days  
**Implements:** US-6.4

**Tasks:**
1. Create seed templates for common specialties:
   - Internal Medicine
   - Family Practice
   - Cardiology
   - Orthopedics
   - Psychiatry
   - Pediatrics
   - OB/GYN
2. Mark as system templates (no owner)
3. Display in template gallery
4. Allow "Use as starting point" (copy to own templates)

**Verification:** New provider sees specialty templates → can apply one → preferences configured appropriately

---

## Phase 10: Medical Terminology Enhancement

### Step 10.1: Medical NLP Integration
**Time estimate:** 2-3 days  
**Implements:** TR-7.6, US-3.9

**Tasks:**
1. Integrate MedSpaCy into note generation pipeline
2. Run terminology validation on generated notes
3. Highlight potentially incorrect medical terms
4. Suggest corrections from medical dictionaries

**Verification:** Generate note with typo "diabeties" → flagged with suggestion "diabetes"

---

### Step 10.2: Uncertainty Flagging
**Time estimate:** 2 days  
**Implements:** US-3.10, TR-14.3

**Tasks:**
1. Identify low-confidence sections in transcription
2. Track sections where ASR confidence is below threshold
3. Pass uncertainty indicators to LLM
4. Flag uncertain content in generated note (highlight or marker)
5. UI: show review required indicator
6. Allow provider to mark as reviewed

**Verification:** Mumbled medication name → appears with warning icon → provider can verify/correct

---

### Step 10.3: Transcript-Note Linking (Optional Enhancement)
**Time estimate:** 3-4 days  
**Implements:** US-3.7

**Tasks:**
1. Track which transcript segments informed which note sections
2. Store mapping in note metadata
3. UI: Click transcript line → highlight related note content
4. UI: Click note section → show source transcript segments
5. Visual connection lines or synchronized highlighting

**Verification:** Click "Patient reports headache for 3 days" in transcript → "HPI: 3-day history of headaches" highlights in note

---

## Phase 11: Voice Learning (Progressive Enhancement)

### Step 11.1: Voice Embedding Extraction
**Time estimate:** 2-3 days  
**Implements:** TR-6.1

**Tasks:**
1. Install Resemblyzer or SpeechBrain
2. Create voice embedding service
3. Extract embeddings from provider's audio segments
4. Normalize and validate embeddings
5. Test embedding similarity for same vs different speakers

**Verification:** Process two audio clips from same person → high similarity score; different people → low score

---

### Step 11.2: Voice Profile Storage
**Time estimate:** 2 days  
**Implements:** TR-6.2, TR-10.7

**Tasks:**
1. Add pgvector extension to PostgreSQL (or set up Chroma)
2. Create voice_profiles table:
   ```sql
   CREATE TABLE voice_profiles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     provider_id UUID REFERENCES providers(id),
     embeddings vector(256)[], -- array of embedding vectors
     sample_count INTEGER DEFAULT 0,
     confidence_score FLOAT DEFAULT 0.0,
     last_updated TIMESTAMP DEFAULT NOW()
   );
   ```
3. Store embeddings after each encounter
4. Update profile with new samples (rolling average or append)

**Verification:** Complete 3 encounters → voice profile has 3+ samples stored

---

### Step 11.3: Automatic Provider Recognition
**Time estimate:** 3-4 days  
**Implements:** US-7.2, TR-6.3, TR-6.4

**Tasks:**
1. At session start, capture initial audio sample
2. Extract embedding from sample
3. Compare against stored voice profiles
4. If match > 85% confidence → auto-assign as provider
5. If match < 85% → prompt for confirmation
6. Fall back to manual assignment if no match
7. Update profile with confirmed sample

**Verification:** Provider with established profile starts new encounter → automatically recognized without prompt

---

### Step 11.4: Voice Profile Management UI
**Time estimate:** 2 days  
**Implements:** US-7.4, US-7.5

**Tasks:**
1. Create `/settings/voice-profile` page
2. Display profile status (sample count, confidence)
3. Show recognition history (how often auto-recognized)
4. Add "Re-train" option to clear and rebuild profile
5. Add "Delete Profile" option
6. Show tips for improving recognition

**Verification:** View profile → see 15 samples collected, 92% average confidence; click retrain → profile resets

---

## Phase 12: Mobile & Responsive Polish

### Step 12.1: Responsive Layout Audit
**Time estimate:** 2 days  
**Implements:** TR-13.1

**Tasks:**
1. Test all screens at mobile (375px), tablet (768px), desktop (1200px+) breakpoints
2. Identify and fix layout issues
3. Ensure touch targets are minimum 44x44px
4. Verify text is readable without zooming
5. Test with actual mobile devices (not just browser simulation)

**Verification:** All screens usable at all breakpoints without horizontal scrolling

---

### Step 12.2: Touch-Optimized Recording Controls
**Time estimate:** 2 days  
**Implements:** US-9.1, TR-13.5

**Tasks:**
1. Increase recording button sizes on mobile
2. Add touch feedback (haptic if available, visual ripple)
3. Prevent accidental double-taps
4. Ensure controls are thumb-reachable
5. Add swipe-to-pause gesture option

**Verification:** Can reliably start/stop/pause recording with one thumb on phone

---

### Step 12.3: Mobile Note Viewing
**Time estimate:** 2 days  
**Implements:** US-9.2, US-9.4

**Tasks:**
1. Stack transcript and note vertically on mobile
2. Add tab or toggle to switch views
3. Make SOAP sections collapsible
4. Ensure keyboard doesn't obscure editing area
5. Test virtual keyboard interactions

**Verification:** Can view and edit note on phone without layout issues

---

### Step 12.4: Swipe Navigation
**Time estimate:** 1-2 days  
**Implements:** US-9.3, TR-13.6

**Tasks:**
1. Add swipe gesture library (or native touch handlers)
2. Swipe left/right to navigate between transcript and note
3. Visual indicators for swipe affordance
4. Make swipe optional (can disable in settings)

**Verification:** Swipe left on transcript → note view slides in

---

## Phase 13: Administration Features

### Step 13.1: Admin Role & Access
**Time estimate:** 2 days  
**Implements:** US-1.4

**Tasks:**
1. Add `role` column to providers (provider, admin)
2. Create admin middleware for protected routes
3. Create admin-only API endpoints namespace `/api/admin/*`
4. Seed initial admin account

**Verification:** Admin can access admin routes; regular provider gets 403

---

### Step 13.2: User Management
**Time estimate:** 2-3 days  
**Implements:** US-1.4

**Tasks:**
1. Create admin provider list page
2. Display all providers with status
3. Add create provider form
4. Add edit provider capability
5. Add deactivate/reactivate provider
6. Add password reset (generate temp password)

**Verification:** Admin can create new provider account, provider can log in

---

### Step 13.3: Audit Logging
**Time estimate:** 2-3 days  
**Implements:** US-1.5, TR-2.7

**Tasks:**
1. Create audit_logs table:
   ```sql
   CREATE TABLE audit_logs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     actor_id UUID REFERENCES providers(id),
     action VARCHAR(100) NOT NULL,
     resource_type VARCHAR(100),
     resource_id UUID,
     details JSONB,
     ip_address INET,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```
2. Create audit logging middleware
3. Log: logins, logouts, encounter access, note finalization, admin actions
4. Create audit log viewer for admins
5. Add filtering by action type, date range, user

**Verification:** Provider logs in → audit log entry created → admin can view it

---

### Step 13.4: Usage Dashboard
**Time estimate:** 3-4 days  
**Implements:** US-10.1, US-10.2, US-10.4

**Tasks:**
1. Create admin dashboard page
2. Display metrics:
   - Total encounters (today, week, month)
   - Active providers
   - Current active sessions
   - Average note generation time
3. Add charts for trends
4. Per-provider usage breakdown
5. Auto-refresh for real-time stats

**Verification:** Dashboard shows accurate counts matching database queries

---

### Step 13.5: Organization Defaults
**Time estimate:** 2 days  
**Implements:** US-6.5

**Tasks:**
1. Create organization_settings table
2. Add default template selection
3. Apply organization template to new providers automatically
4. Allow admin to set mandatory settings (e.g., minimum detail level)

**Verification:** Admin sets default template → new provider inherits settings

---

## Phase 14: Security Hardening

### Step 14.1: Multi-Factor Authentication
**Time estimate:** 3-4 days  
**Implements:** US-1.3

**Tasks:**
1. Add TOTP (Time-based One-Time Password) support
2. Create MFA setup flow:
   - Generate secret
   - Display QR code for authenticator app
   - Verify code to confirm setup
3. Require MFA code on login (if enabled)
4. Add recovery codes
5. Allow admin to require MFA for all users

**Verification:** Enable MFA → next login requires code from authenticator app

---

### Step 14.2: Data Encryption
**Time estimate:** 2-3 days  
**Implements:** TR-2.8, TR-9.3

**Tasks:**
1. Enable PostgreSQL TDE (Transparent Data Encryption)
2. Implement audio file encryption at rest (AES-256)
3. Create encryption key management (rotate keys periodically)
4. Verify no PHI in application logs
5. Add encryption status to admin dashboard

**Verification:** Audio files on disk are encrypted; cannot read without key

---

### Step 14.3: Security Audit Preparation
**Time estimate:** 2-3 days  
**Implements:** Phase 6 security deliverables

**Tasks:**
1. Run OWASP ZAP scan on application
2. Fix any identified vulnerabilities
3. Review and test all authentication flows
4. Verify session handling is secure
5. Document security controls for audit

**Verification:** Security scan shows no high/critical vulnerabilities

---

## Phase 15: Performance & Scaling

### Step 15.1: Load Testing
**Time estimate:** 3-4 days  
**Implements:** TR-12.1, TR-12.2

**Tasks:**
1. Set up load testing tool (k6, Locust, or Artillery)
2. Create test scenarios:
   - 10 concurrent recording sessions
   - 20 concurrent note generations
   - 50 concurrent API requests
3. Identify bottlenecks
4. Document performance baselines
5. Create performance monitoring dashboard

**Verification:** System handles 10 concurrent transcription sessions without degradation

---

### Step 15.2: Optimization
**Time estimate:** 3-4 days  
**Implements:** TR-12.3, TR-12.4

**Tasks:**
1. Implement database query optimization (indexes, query plans)
2. Add Redis caching for frequently accessed data
3. Optimize WebSocket message handling
4. Implement connection pooling
5. Add rate limiting to prevent abuse
6. Configure GPU memory allocation for concurrent sessions

**Verification:** Response times improved, system stable under load

---

### Step 15.3: Monitoring & Alerting
**Time estimate:** 2-3 days  
**Implements:** TR-12.3

**Tasks:**
1. Set up application monitoring (Prometheus + Grafana or similar)
2. Add health check endpoints for all services
3. Configure alerting thresholds:
   - Response time > 3s
   - Error rate > 1%
   - GPU memory > 90%
   - CPU > 80% sustained
4. Create runbook for common issues

**Verification:** Intentionally cause high load → alert fires → can see issue in dashboard

---

## Final Deliverables Checklist

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guide for providers
- [ ] Administrator guide
- [ ] Deployment guide
- [ ] Troubleshooting guide

### Training Materials
- [ ] Provider onboarding video/walkthrough
- [ ] Admin training materials
- [ ] FAQ document

### Operational Readiness
- [ ] Backup and restore procedures tested
- [ ] Disaster recovery plan documented
- [ ] Support escalation procedures defined
- [ ] SLA defined and monitoring in place

---

## Summary: MVP Definition

The **Minimum Viable Product** is complete after **Phase 7** (approximately 12-14 weeks). At that point, providers can:

1. ✅ Log in securely with session timeout
2. ✅ Record patient encounters through the browser
3. ✅ See real-time transcription with speaker labels
4. ✅ Manually correct speaker labels
5. ✅ Have patient name auto-detected (or enter manually)
6. ✅ Generate SOAP notes automatically
7. ✅ Edit notes before finalizing
8. ✅ Copy notes to clipboard for EMR
9. ✅ View encounter history
10. ✅ Finalize notes as official records

**Post-MVP phases** add valuable enhancements but are not required for initial deployment:
- Phase 8-9: Customization & templates (better experience)
- Phase 10: Medical terminology (better quality)
- Phase 11: Voice learning (reduced friction)
- Phase 12: Mobile polish (broader device support)
- Phase 13: Administration (organizational control)
- Phase 14-15: Security & performance (production hardening)

---

*Document generated from MedScribe Requirements v1.0 and Project Plan v1.0*
