
SuperCollider – Definitive Architecture and Operational Documentation

1. Introduction
SuperCollider is a single-user AI orchestration system designed to automate the execution of complex projects across multiple modalities, including:
Text (articles, reports, code documentation)


Code (program generation, edits, testing)


Image (illustrations, diagrams, renderings)


Audio (soundtracks, narration, effects)


Video (composite sequences, animations)


Primary objectives:
Enable the user to submit a high-level project prompt and have it decomposed automatically into granular, executable tasks.


Allow parallel, multi-agent execution while respecting dependencies and priorities.


Minimize human intervention, requesting input only for approvals, clarifications, or failures that require user decisions.


Maximize token efficiency and reduce redundancy in AI calls.




2. System Overview
SuperCollider is composed of the following functional layers:
Layer
Purpose
Configuration Layer
Loads credentials, sets defaults, defines agent capabilities and project types
Input Layer
Accepts user project prompts and converts them to structured atomic tasks
Prompt Analysis & Clarification Layer
Evaluates prompt completeness, generates clarifying questions, may halt downstream queue
Shredder
Decomposes project into atomic tasks, determines dependencies and chains
Task Queue & Scheduler
Orders tasks, distributes across agents, enforces priorities, token limits, and overrides
Agent Pool
Executes tasks based on capabilities (code, text, image, sound, video)
Context Pool
Stores outputs and metadata for relevant reinjection into downstream tasks
Approval Layer
Allows user approvals or automatic continuation depending on mode
Error Handling
Detects failures, decides correction, generates user prompts if needed
Reintegration/Composer
Merges multi-modal outputs into final deliverables
Notification System
Sends actionable updates to the user


Iterative Clarification & Goal Validation (cross-cutting)
Continuously reassesses whether sliced inputs and intermediate outputs are sufficient to reach the user’s stated goal. Generates questions when sufficiency fails, pauses or reprioritizes tasks, and updates the plan.


Data flows:
User submits high-level prompt → Input Layer.


2.1. Pre-Shredder Prompt Evaluation
Purpose:
Evaluate completeness and specificity of the user prompt before any task shredding occurs. Prevent downstream task generation when critical information is missing.


Logic:
Parse the prompt.


Identify missing key dimensions based on project type (e.g., code modules, data sources, modalities, formats).


Score prompt clarity against atomic task requirements using configurable thresholds.


Generate a concise, enumerated clarifying question set if critical information is missing.


Set halt_queue to true when clarifications are required to ensure no downstream tasks are generated prematurely.


Output format example:
{
  "clarity_score": 0.6,
  "missing_elements": ["module definitions", "output format", "input constraints"],
  "generated_questions": [
    "Please specify the expected modules and dependencies for this project.",
    "Which output formats are required for code, text, and media?",
    "What are the input sources or datasets that must be integrated?"
  ],
  "halt_queue": true
}


User interaction:
The UI presents generated questions in a concise, enumerated format. User responses are injected into the Context Pool and associated with the current project/session.


Integration with Task Shredding:
If halt_queue is true, the system pauses before the Shredder. After the user provides clarifications, the Shredder uses the enriched context to confidently create atomic tasks with predefined capabilities and priorities.


Optional enhancements:
Prompt templates per project type pre-define expected elements.


Vagueness detector flags prompts under a clarity threshold.


Iterative clarification allows follow-up questions when answers remain vague.


Revised high-level flow:


User submits high-level prompt → Input Layer → Prompt Analysis & Clarification Layer (may set halt_queue)


If halt_queue: UI Q&A → Context Pool updated → proceed → Shredder.


If not halted: proceed directly → Shredder.


Initial Agent formats into structured atomic tasks → Shredder.


Shredder generates tasks → Task Queue & Scheduler.


Scheduler dispatches tasks → Agent Pool (with Context Pool injections).


Agents produce outputs → Context Pool.
Reintegration Layer combines outputs.


Approval Layer intercepts as required → Notification System.


Errors are captured → Error Handling Agent → re-injected into queue.




3. Configuration Layer
Responsibilities:
Load user-provided API keys, credentials, and tool paths.


Define agent capabilities, default token limits, approval modes.


Provide global project and task defaults.


Dynamic Agent & Endpoint Registry (configuration facets):
Persistence backend (file/db), allowed capability tags, default timeouts/retries, health check policy, request/response template validators, per-agent percentage allocations.


Sample Configuration Structure (JSON/YAML):
{
  "agents": {
    "ClaudeCode": {"capabilities": ["code"], "token_limit": 1500},
    "GPTText": {"capabilities": ["text"], "token_limit": 1200},
    "ImageGen": {"capabilities": ["image"], "token_limit": 800}
  },
  "approval_mode": "dynamic",
  "daily_token_limit": 50000,
  "default_project_types": ["coding_project", "presentation", "report", "video"]
  ,
  "agent_registry": {
    "persistence": "file | db",
    "default_timeouts_ms": 30000,
    "default_retries": 2,
    "allowed_capabilities": ["code", "text", "image", "sound", "video"],
    "validators": {
      "request_template_required": true,
      "response_schema": {"output": "string"}
    }
  }
}

Notes:
Users can manually input credentials.


All limits, distributions, and modes are configurable here.




4. Project Types
Project types predefine atomic task sets and default task priorities.
Sample Project Types:
Project Type
Description
Default Task Flow
Coding Project
Software with multiple modules
Code gen → Testing → Documentation → Packaging
Presentation
Slides with text & graphics
Slide layout → Text content → Graphics/Images → Review
Report
Research or data compilation
Text generation → Charts/Tables → Review → Formatting
Video
Multi-modal video
Scene generation → Audio → Video composition → Review
Custom
Fully user-defined
Defined per user

Behavior:
Each queued project is tagged with its type.


Default atomic tasks and priorities are pre-populated based on type.


Users can override defaults.




Project Type Templates (required elements):
coding_project:
- required: modules/interfaces, language/runtime, build/test strategy, acceptance_criteria
- default flow: code_gen → unit_tests → docs → package

presentation:
- required: slide_count, audience, theme, key_points

report:
- required: data_sources, outline, figures/tables, citation_style

video:
- required: storyboard, resolution, duration, audio_plan
5. Atomic Task Specification
Atomic tasks (ATs) are the fundamental unit of execution.
Fields:
{
  "task_id": "string_unique",
  "description": "human-readable explanation",
  "capability": "code | text | image | sound | video",
  "dependencies": ["task_id_prev1", "task_id_prev2"],
  "input_chain": ["task_id_prev1", "task_id_prev2"],
  "metadata": {"user_notes": "optional"},
  "preamble": "instructions/context for agent",
  "token_limit": 1500,
  "manual_agent_override": "ClaudeCode",
  "priority_override": 10
}
Field Explanations:
task_id – unique identifier for referencing dependencies and chaining.


capability – determines agent selection.


dependencies – tasks that must complete first.


input_chain – merges outputs from multiple upstream tasks.


metadata – notes or optional flags.


preamble – instructions injected into agent call.


token_limit – enforces AI request size.


manual_agent_override – forces a specific agent, ignoring distribution percentages.


priority_override – user-defined priority for queue ordering.




6. Task Queue & Scheduler
Responsibilities:
Maintain execution order respecting dependencies.


Apply agent distribution percentages for multi-capable tasks.


Apply priority sorting.


Enforce token limits and input slicing.


Handle manual overrides.


Manage parallel execution where possible.


Task Routing Logic:
Identify agents capable of handling the task.


If manual_agent_override exists → assign task.


Otherwise, distribute according to agent percentage allocation.


Sort tasks by priority_override > default priority.


Ensure dependencies complete before dispatch.


Token Efficiency:
Input chains are truncated or summarized to respect agent token limits.


System optimizes input distribution to minimize redundant tokens.


Dynamic runtime agent selection:
- Query the Agent Registry for all agents matching the task's capability tag(s)
- Filter by project/user scope, health, and quota
- Apply percentage allocations unless manual override provided
- Respect per-agent timeouts and retry policies
- Fallback to next compatible agent on error, subject to Error Handling policy


Slicing Sufficiency & Question Generation:
- For each task, assess whether the sliced input (post-context truncation/summarization) preserves required constraints and acceptance criteria
- If insufficient, generate targeted clarifying questions and set halt_queue for the affected task chain
- Re-insert a Clarification Task for the RequestGenAgent and pause dependent tasks until resolved


7. Agent Pool
Agents and Roles:
Agent
Capabilities
Notes
CodeGenAgent
code
Generates, edits, refactors code
TextGenAgent
text
Summarizes, formats, generates structured text
ImageGenAgent
image
Generates images or modifies assets
SoundGenAgent
sound
Generates audio, narration, or effects
VideoGenAgent
video
Combines assets, animates sequences
EvalAgent
any
Validates outputs: compilation, testing, schema adherence
ErrorCorrectionAgent
any
Decides retries, escalations, or user prompts
RequestGenAgent
any
Generates clarifying questions for users


7.1 Dynamic Agent Interface
A standard execution contract that any provider (including user-registered endpoints) must implement:


AgentInterface:
- capability_tags: ["text" | "code" | "image" | "sound" | "video"]
- execute(task_input, token_limit, context) -> task_output
- validate_config(config) -> bool


Request/Response template (per agent):
request_template example:
{
  "url": "https://api.example.com/v1/complete",
  "method": "POST",
  "headers": {"Authorization": "Bearer {{auth_token}}"},
  "body": {"prompt": "{{input}}", "max_tokens": {{token_limit}}}
}


response_mapping example:
{"output_path": "data.result"}


Strict Output Contract (default, required):
All agents MUST return strict JSON. If unsupported, adapters must transform responses before returning.
{
  "output": "string (required)",
  "tokens_used": 0,
  "finish_reason": "stop | length | error",
  "metadata": {}
}


Schema enforcement:
- Responses failing schema are treated as failure_type: "schema_mismatch"
- Mapping via response_mapping is optional and considered an advanced feature; default behavior requires the strict contract
Allowed placeholders in request_template: {{input}}, {{token_limit}}, {{auth_token}}; additional placeholders are ignored.
7.2 Dynamic Agent & Endpoint Registry
Users can register custom endpoints through the UI. The registry persists agent definitions and makes them discoverable to the Scheduler.


Registration schema example:
{
  "agent_name": "CustomTextAI",
  "capabilities": ["text"],
  "endpoint_url": "https://api.customai.com/v1",
  "auth": {"type": "bearer", "token": "..."},
  "request_template": "{prompt:{{input}}, token_limit:{{token_limit}}}",
  "response_mapping": {"output_path": "choices.0.text"},
  "timeouts_ms": 30000,
  "retries": 2,
  "percentage_allocation": 50
}


Validation & health checks:
- Verify capability tags are allowed
- Perform connectivity check and schema validation
- Enforce token and payload limits
- Store secrets securely


External Process Agents (optional):
- Instead of HTTP, an agent may be defined as a local process to be executed with arguments (e.g., a CLI wrapper around a model)
- Process execution is disabled by default and requires explicit allowlisting in config


7.3 Clarification Task Type
Purpose: Ask targeted questions when slicing or specification is insufficient.
Fields:
{
  "task_id": "clarify:uuid",
  "capability": "any",
  "preamble": "Ask only what is necessary to proceed",
  "questions": ["question1", "question2"],
  "dependencies": ["blocked_task_id"],
  "token_limit": 300,
  "priority_override": 100
}

8. Context Management
Stores completed outputs and metadata.


Provides relevant context injection per agent based on capability.


Maintains input chains for chained task execution.


Truncates or summarizes outputs to fit token constraints.


Context Object Example:
{
  "task_id": "current_task",
  "relevant_context": {
    "completed_tasks": ["task1", "task2"],
    "previous_outputs": {"task1": "output1", "task2": "output2"}
  },
  "task_input": "task-specific prompt"
}


Goal specification & acceptance criteria:
Store explicit goal and acceptance criteria derived from the prompt analysis and user clarifications. Use these for sufficiency checks and evaluation.
{
  "goal_spec": {
    "objective": "Implement feature X with Y behavior",
    "acceptance_criteria": [
      "Unit tests pass for scenarios A/B/C",
      "API returns schema S",
      "Performance under T ms"
    ]
  }
}



9. Approval Layer
Modes:
Automatic – all tasks proceed without user intervention.


Manual – user approves or rejects each task.


Dynamic – system decides if approval is necessary based on error likelihood or complexity.


User can configure per-project or global defaults.


Notifications alert users for approvals, failures, or clarifications.




10. Error Handling & Request Generation
Error Object Example:
{
  "failed_task_id": "task_id",
  "failure_type": "syntax_error | evaluation_failed | user_rejection",
  "original_input": "...",
  "task_output": "...",
  "context": {...},
  "decision": "request_user_input | self_correct",
  "generated_question": "optional"
}

ErrorCorrectionAgent decides:


Retry automatically if correctable.


Request user clarification if necessary.


If user input is required, downstream tasks can be paused until resolution.



Insufficient context/slicing:
- When a task lacks sufficient context due to truncation or missing details, raise failure_type: "insufficient_context"
- Auto-generate a Clarification Task with targeted questions
- Set halt_queue for dependent chain until answers are received


Silent mode and context strategy:
- If config.silent_mode is true and a failure occurs, the system continues without prompting
- On first failure in silent mode, switch context strategy to full-context for the affected chain (disable summarization/truncation where feasible)
- Log the deviation and proceed; if acceptance criteria cannot be met, escalate at project summary


11. Reintegration & Composer
Combines multi-modal outputs deterministically.


Uses deterministic tools for final output: FFmpeg, Blender CLI, Pandoc.


Maintains artifact metadata:


{
  "task_id": "task_id",
  "artifact_type": "image | audio | video | text",
  "file_path": "/path/to/file",
  "metadata": {"resolution": "1920x1080", "duration_sec": 12}
}

Artifact detection and naming:
- Text: write to artifacts/text/{task_id}.txt
- Code edits: write to workspace, then copy changed files list to artifacts/code/manifest.json
- Images: artifacts/image/{task_id}.png (or provided extension)
- Audio: artifacts/audio/{task_id}.wav (or provided format)
- Video: artifacts/video/{task_id}.mp4 (or provided format)



12. Notifications
Users are notified for:


Required approvals.


Task failures.


Escalations.


Milestone completions.


Notification system is integrated with UI for actionable responses.


Agent & Endpoint Registry events:
- New agent registered (pending validation)
- Agent validated/failed validation
- Agent health degraded/recovered
- Secret expiring/expired


Windows notifications (local):
- Toast notifications for approvals, failures, clarifications, and completions
- Click-through opens the desktop app to the relevant project/task
- Respect Do Not Disturb and user preferences
 - Implemented via Tauri notification API (or OS-specific plugin)


13. Token & Speed Management
Per-agent token limits.


Daily project token budgets.


Adjustable batch size and concurrency for agent calls.


Scheduler respects limits while maximizing throughput.




14. Task Chaining & Distribution
Supports multiple chained inputs per task.


Distribution logic:


Percentage allocation first.


Priority ordering second.


Manual overrides take precedence.


Goal: maximize token efficiency, minimize redundant AI calls.




15. User Controls
Project-Level: project type, overall priority, token budget.


Task-Level: manual agent selection, priority override, token limit.


Global: daily token limit, concurrency/speed.


Agent Registry UI (Desktop, No Network Listeners):
- Register local or remote agents (remote disabled by default)
- Capabilities, optional auth, request template, response mapping (advanced)
- Scope agents to user or project
- Set priorities per capability (percentages optional, future)
- Test via IPC adapter; remote connectivity checks only when explicitly enabled


Security & Validation:
- Secrets management (vault or OS keychain)
- Allowlist of outbound domains (optional)
- Response schema validation and size limits
- Timeouts, retries, and circuit breakers


16. Data Flow Example
[User Prompt] 
   ↓
[Initial Agent] → [Shredder] → [Task Queue & Scheduler] 
   ↓                         ↘
[Agent Pool] ←→ [Context Pool] 
   ↓
[Reintegration/Composer] → [Output Artifact]
   ↓
[Approval Layer / Notifications]
   ↓
[Error Handling → Queue Re-entry if needed]

Represents deterministic flow from user input → multi-agent execution → output.


Supports parallel execution and chained task dependencies.


Iterative loopbacks (goal validation and sufficiency):
At multiple stages (Prompt Analysis, Shredder, Scheduler, EvalAgent), the system may:
1) Generate Clarification Task(s) → UI Q&A → Context update
2) Re-slice inputs with updated context
3) Re-plan or reprioritize tasks
This continues until acceptance criteria are met or the user halts.
17. Summary
SuperCollider is a top-down, deterministic, configurable, automated AI orchestration system.
Converts high-level project prompts into atomic tasks.


Handles multi-agent execution across modalities.


Provides fine-grained control via task overrides, token limits, priorities.


Allows chained inputs/outputs and efficient token usage.


Minimizes human intervention, requesting input only for critical decisions.


This documentation provides a comprehensive blueprint for anyone, regardless of prior knowledge, to understand, reconstruct, and implement the SuperCollider system.


Appendix A: End-to-End Software Delivery Lifecycle
Phases orchestrated by SuperCollider for software projects:
1) Architecture & Planning: define goal_spec and acceptance_criteria, produce initial module map and interfaces
2) Implementation: generate/edit code by module with tests-first or tests-parallel
3) Evaluation: compile/build, run tests, static analysis, and benchmarks
4) Review & Clarification: when gaps detected, generate targeted questions and update plan
5) Integration: merge modules, verify contracts, regenerate docs
6) Packaging & Delivery: produce artifacts (binaries, containers, release notes)
7) Post-run Report: summarize results against acceptance criteria and provide follow-up tasks


Appendix B: Implementation Specifications (MVP to Production)
Scope: Desktop-only, locally downloadable application with simple UI, dynamic agent registry, and deterministic orchestration. No webserver; no reliance on the public web.
MVP modalities: text and code enabled by default; image/sound/video are feature-flagged off by default.


B1. Local UI + Runtime Architecture (No Webserver)
- Desktop app via Tauri
- Internal runtime service embedded in the app process (Rust backend)
- Communication via Tauri Commands (IPC)
- No HTTP endpoints exposed
- Outbound requests optional and user-controlled; secrets stored locally


B1.1 User-Driven Queueing (Windows-first UX)
- User enqueues prompts/projects; nothing runs until the user starts the queue or enables auto_start_queue
- Windows notifications (Toast) on approvals, failures, completions, and clarifications
- First-run flow: enter API keys → set agent priorities by capability → configure batching/approval → start queue
- Queue controls: start, pause, resume, cancel project, reorder


Core Tauri Commands (IPC):
agents.register(payload)
agents.test(name)
agents.list()
agents.enable(name, enabled)
agents.delete(name)
run.start(project_payload)
projects.list()
projects.cancel(project_id)
projects.delete(project_id)
clarify.submit(project_id, answers)
projects.status(project_id)
projects.logs(project_id)
config.update(partial_config)
queue.start()
queue.pause()
queue.resume()
queue.cancel(project_id)
queue.reorder(project_id, position)
notifications.test()
terminal.exec(cmd, args, stdin?)
tasks.create(project_id, task)
tasks.update(project_id, task_id, partial)
tasks.delete(project_id, task_id)
tasks.list(project_id)
templates.list()
templates.get(name)
templates.save(template)
templates.delete(name)


IPC Payload Schemas (JSON)
agents.register
request: { "agent": { name, capabilities[], endpoint_url?, auth?, request_template?, response_mapping?, enabled?, priority? } }
response: { ok: true, agent: { ... } } | { ok: false, error }

agents.enable
request: { name, enabled }
response: { ok: true }

agents.delete
request: { name }
response: { ok: true }

agents.test
request: { name }
response: { ok: true, latency_ms, health } | { ok: false, error }

agents.list
request: {}
response: { ok: true, agents: [ { ... }, ... ] }

run.start
request: { project: { type, prompt, config_override? } }
response: { ok: true, project_id } | { ok: false, error }

projects.list
request: {}
response: { ok: true, projects: [ { id, type, status, created_at } ] }

projects.cancel
request: { project_id }
response: { ok: true }

projects.delete
request: { project_id }
response: { ok: true }

clarify.submit
request: { project_id, answers: ["..."] }
response: { ok: true }

projects.status
request: { project_id }
response: { ok: true, status, tasks_summary }

projects.logs
request: { project_id, tail?: 200 }
response: { ok: true, lines: ["NDJSON..."] }

config.update
request: { partial: { ...subset of config... } }
response: { ok: true, config }

queue.start | queue.pause | queue.resume
request: {}
response: { ok: true }

queue.cancel
request: { project_id }
response: { ok: true }

queue.reorder
request: { project_id, position }
response: { ok: true, queue: [project_id...] }

notifications.test
request: {}
response: { ok: true }

terminal.exec
request: { cmd, args: ["..."], stdin?: "..." }
response: { ok: true, stdout: "...", stderr: "...", exit_code: 0 } | { ok: false, error }

tasks.create
request: { project_id, task: <Task schema> }
response: { ok: true, task_id }

tasks.update
request: { project_id, task_id, partial: <partial Task> }
response: { ok: true }

tasks.delete
request: { project_id, task_id }
response: { ok: true }

tasks.list
request: { project_id }
response: { ok: true, tasks: [<Task>] }

templates.list
request: {}
response: { ok: true, templates: [ { name, type: "atomic|preamble" } ] }

templates.get
request: { name }
response: { ok: true, template: { name, type, content } }

templates.save
request: { template: { name, type: "atomic|preamble", content } }
response: { ok: true }

templates.delete
request: { name }
response: { ok: true }


B2. Data Models (JSON file persistence)
project: { id, type, prompt, config_ref, status, created_at, offline_only: true }
task: { id, project_id, type, capability, status, deps[], input, output, error, retries, approval_required: bool, paused: bool, cancelled: bool }
agent: { name, capabilities[], endpoint_url?, auth?, request_template?, response_mapping?, enabled, priority, health, local: true }
config: { batching: { enabled, batch_size, concurrency }, priorities: { capability → integer }, allowlist[], defaults, auto_start_queue: false, approval_mode: "automatic|manual|dynamic", silent_mode: false, failure_strategy: "halt|continue" }
context: { project_id, goal_spec, acceptance_criteria[], kv }
B2.1 JSON Storage Layout (Windows)
Base directory: %APPDATA%/SuperCollider/
files:
- config.json
- agents.json
- templates/
- templates/atomic/
- templates/preambles/
- projects/{project_id}/project.json
- projects/{project_id}/tasks.jsonl (NDJSON)
- projects/{project_id}/context.json
- projects/{project_id}/workspace/   (working directory for process agents and builds)
- projects/{project_id}/artifacts/   (final outputs; composer writes here)
- logs/system.log.ndjson
- logs/projects/{project_id}.log.ndjson
All timestamps: ISO8601 UTC with trailing Z (e.g., 2025-01-30T12:34:56Z)


B3. Task State Machine
states: queued → running → completed | failed | blocked | waiting_clarification
events: dispatch, success, error(code), need_clarification, clarified
error codes: schema_mismatch, timeout, http_error, insufficient_context, evaluation_failed


B4. Scheduler Algorithm (deterministic)
- Select ready tasks (deps completed, not blocked)
- For each task, choose agent: manual override else highest priority matching capability
- Respect batching and concurrency limits
- Insert Clarification Task and mark dependents waiting_clarification on insufficient_context


B5. Batching
config: { enabled: bool, batch_size: int, concurrency: int }
- If enabled, group homogeneous tasks by capability and agent
- Submit in batches; collect outputs; maintain per-task results


B6. Security
- Secrets in local encrypted store (file + optional passphrase)
- Outbound domain allowlist; deny by default; remote calls disabled by default
- Timeouts, retries (global defaults), response size limits
- No network listeners; IPC-only via Tauri Commands
Fairness & limits:
- Per-agent concurrency limit: config.priorities can be extended with limits { max_concurrency_per_agent }
- Basic fairness: round-robin among ready tasks per capability when multiple agents have equal priority

Terminal/process execution (guarded):
- Disabled by default; enable via config.limits.process_execution.enabled = true
- Allowlist of commands: config.limits.process_execution.allowlist = ["claude-code-cli", "python"]
- Max runtime per process and output size enforced; no network unless needs_network true and allowlisted


B7. Logging/Observability
- Structured logs (NDJSON) per project and system
- Task span logs with input hashes, token counts, timings
- Minimal PII; redact secrets
 - Rotation: when logs/system.log.ndjson > 50MB, rotate to system.log.ndjson.1 (keep 3)
 - Backup/restore: copy %APPDATA%/SuperCollider to backup; restore by replacing directory while app closed


B8. Testing & Evaluation
- Unit tests for slicing, scheduler, schema enforcement
- Integration tests: agent adapter loopback, clarification flow, end-to-end coding project
- Acceptance gates: all acceptance_criteria met; tests green


B9. Install/Run (Offline-First, Tauri)
- Prereqs: Rust (stable), Node 20+, Git, Tauri CLI (optional)
- Steps:
  1) clone repo
  2) npm install (or pnpm/yarn) for UI
  3) cargo build (handled by Tauri during build)
  4) npm run tauri build (produces Windows installer/exe)
- First run wizard prompts for keys, agent priorities, batching/approval settings
- Defaults: batching disabled; outbound allowlist empty; remote agents disabled
- All features available offline except remote agent calls (which are disabled by default)


Appendix C: Repository Structure (Tauri + React/TypeScript)
root/
  README.md
  src-ui/                    (React/TypeScript frontend)
    src/
      main.tsx
      App.tsx
      components/
        TaskBuilder/
          TaskBuilder.tsx
          TaskForm.tsx
          validators.ts
      pages/
      ipc/
        commands.ts          (TS types + invoke wrappers)
    package.json
  src-tauri/                 (Rust backend)
    src/
      main.rs                (tauri::Builder, command registration)
      commands/
        agents.rs
        projects.rs
        queue.rs
        config.rs
        clarify.rs
        logs.rs
      services/
        scheduler.rs
        storage.rs           (JSON file persistence)
        notifications.rs
        security.rs          (DPAPI/passphrase)
        slicing.rs
        evaluation.rs
      models/
        project.rs
        task.rs
        agent.rs
        config.rs
        context.rs
      utils/
        json_schema.rs
        ids.rs
        time.rs
    Cargo.toml
    tauri.conf.json


Appendix D: Tauri Command Signatures (Rust + TS)
Rust command signatures:
#[tauri::command]
fn agents_register(payload: AgentRegisterRequest) -> Result<AgentRegisterResponse, String>

#[tauri::command]
fn agents_test(name: String) -> Result<AgentTestResponse, String>

#[tauri::command]
fn agents_list() -> Result<AgentsListResponse, String>

#[tauri::command]
fn agents_enable(name: String, enabled: bool) -> Result<OkResponse, String>

#[tauri::command]
fn agents_delete(name: String) -> Result<OkResponse, String>

#[tauri::command]
fn run_start(project: ProjectStartRequest) -> Result<ProjectStartResponse, String>

#[tauri::command]
fn projects_list() -> Result<serde_json::Value, String>

#[tauri::command]
fn projects_cancel(project_id: String) -> Result<OkResponse, String>

#[tauri::command]
fn projects_delete(project_id: String) -> Result<OkResponse, String>

#[tauri::command]
fn clarify_submit(project_id: String, answers: Vec<String>) -> Result<OkResponse, String>

#[tauri::command]
fn projects_status(project_id: String) -> Result<ProjectStatusResponse, String>

#[tauri::command]
fn projects_logs(project_id: String, tail: Option<u32>) -> Result<ProjectLogsResponse, String>

#[tauri::command]
fn config_update(partial_config: serde_json::Value) -> Result<ConfigUpdateResponse, String>

#[tauri::command]
fn queue_start() -> Result<OkResponse, String>

#[tauri::command]
fn queue_pause() -> Result<OkResponse, String>

#[tauri::command]
fn queue_resume() -> Result<OkResponse, String>

#[tauri::command]
fn queue_cancel(project_id: String) -> Result<OkResponse, String>

#[tauri::command]
fn queue_reorder(project_id: String, position: u32) -> Result<QueueReorderResponse, String>

#[tauri::command]
fn notifications_test() -> Result<OkResponse, String>

#[tauri::command]
fn terminal_exec(cmd: String, args: Vec<String>, stdin: Option<String>) -> Result<serde_json::Value, String>

#[tauri::command]
fn tasks_create(project_id: String, task: serde_json::Value) -> Result<serde_json::Value, String>

#[tauri::command]
fn tasks_update(project_id: String, task_id: String, partial: serde_json::Value) -> Result<OkResponse, String>

#[tauri::command]
fn tasks_delete(project_id: String, task_id: String) -> Result<OkResponse, String>

#[tauri::command]
fn tasks_list(project_id: String) -> Result<serde_json::Value, String>
#[tauri::command]
fn templates_list() -> Result<serde_json::Value, String>

#[tauri::command]
fn templates_get(name: String) -> Result<serde_json::Value, String>

#[tauri::command]
fn templates_save(template: serde_json::Value) -> Result<OkResponse, String>

#[tauri::command]
fn templates_delete(name: String) -> Result<OkResponse, String>


TypeScript IPC wrappers (examples):
import { invoke } from "@tauri-apps/api/tauri";

export async function agentsRegister(req: AgentRegisterRequest): Promise<AgentRegisterResponse> {
  return invoke("agents_register", { payload: req });
}

export async function runStart(req: ProjectStartRequest): Promise<ProjectStartResponse> {
  return invoke("run_start", { project: req.project });
}


Appendix E: JSON Schemas (draft-07)
Core: $id fields omitted for brevity; use draft-07.

Project schema:
{
  "type": "object",
  "required": ["id", "type", "prompt", "status", "created_at", "offline_only"],
  "properties": {
    "id": {"type": "string"},
    "type": {"type": "string", "enum": ["coding_project", "presentation", "report", "video", "custom"]},
    "prompt": {"type": "string"},
    "config_ref": {"type": ["string", "null"]},
    "status": {"type": "string", "enum": ["queued", "running", "completed", "failed", "blocked", "waiting_clarification", "paused", "cancelled"]},
    "created_at": {"type": "string"},
    "offline_only": {"type": "boolean"}
  }
}

Task schema:
{
  "type": "object",
  "required": ["id", "project_id", "type", "capability", "status", "deps", "input", "retries", "approval_required"],
  "properties": {
    "id": {"type": "string"},
    "project_id": {"type": "string"},
    "type": {"type": "string"},
    "capability": {"type": "string", "enum": ["code", "text", "image", "sound", "video", "any"]},
    "status": {"type": "string", "enum": ["queued", "running", "completed", "failed", "blocked", "waiting_clarification", "paused", "cancelled"]},
    "deps": {"type": "array", "items": {"type": "string"}},
    "input_chain": {"type": "array", "items": {"type": "string"}},
    "input": {},
    "clarity_prompt": {"type": ["string", "null"]},
    "output": {},
    "error": {"type": ["object", "null"]},
    "retries": {"type": "integer", "minimum": 0},
    "approval_required": {"type": "boolean"},
    "preamble": {"type": ["string", "null"]},
    "token_limit": {"type": ["integer", "null"], "minimum": 1},
    "manual_agent_override": {"type": ["string", "null"]},
    "priority_override": {"type": ["integer", "null"]},
    "metadata": {"type": ["object", "null"]},
    "paused": {"type": ["boolean", "null"]},
    "cancelled": {"type": ["boolean", "null"]}
  }
}

Agent schema:
{
  "type": "object",
  "required": ["name", "capabilities", "enabled", "priority", "health", "local"],
  "properties": {
    "name": {"type": "string"},
    "capabilities": {"type": "array", "items": {"type": "string", "enum": ["code", "text", "image", "sound", "video"]}},
    "endpoint_url": {"type": ["string", "null"]},
    "auth": {"type": ["object", "null"]},
    "request_template": {"type": ["string", "null"]},
    "response_mapping": {"type": ["object", "null"]},
    "process": {"type": ["object", "null"], "properties": {"cmd": {"type": "string"}, "args": {"type": "array", "items": {"type": "string"}}, "stdin_template": {"type": ["string", "null"]}, "timeout_ms": {"type": ["integer", "null"]}}},
    "needs_network": {"type": ["boolean", "null"]},
    "enabled": {"type": "boolean"},
    "priority": {"type": "integer"},
    "health": {"type": "string", "enum": ["unknown", "healthy", "degraded", "unreachable"]},
    "local": {"type": "boolean"}
  }
}

Config schema:
{
  "type": "object",
  "required": ["batching", "priorities", "allowlist", "defaults", "auto_start_queue", "approval_mode", "silent_mode", "failure_strategy"],
  "properties": {
    "batching": {
      "type": "object",
      "required": ["enabled", "batch_size", "concurrency"],
      "properties": {
        "enabled": {"type": "boolean"},
        "batch_size": {"type": "integer", "minimum": 1},
        "concurrency": {"type": "integer", "minimum": 1}
      }
    },
    "priorities": {"type": "object", "additionalProperties": {"type": "integer"}},
    "allowlist": {"type": "array", "items": {"type": "string"}},
    "defaults": {
      "type": "object",
      "properties": {
        "clarity": {
          "type": "object",
          "properties": {
            "pre_shredder_threshold": {"type": "number", "minimum": 0, "maximum": 1},
            "per_task_threshold": {"type": "number", "minimum": 0, "maximum": 1}
          }
        }
      }
    },
    "auto_start_queue": {"type": "boolean"},
    "approval_mode": {"type": "string", "enum": ["automatic", "manual", "dynamic"]},
    "silent_mode": {"type": "boolean"},
    "failure_strategy": {"type": "string", "enum": ["halt", "continue"]},
    "limits": {
      "type": "object",
      "properties": {
        "max_concurrency_per_agent": {"type": "integer", "minimum": 1},
        "notification": {
          "type": "object",
          "properties": {
            "max_per_minute": {"type": "integer", "minimum": 1},
            "dedupe_window_sec": {"type": "integer", "minimum": 1}
          }
        },
        "process_execution": {
          "type": "object",
          "properties": {
            "enabled": {"type": "boolean"},
            "allowlist": {"type": "array", "items": {"type": "string"}},
            "stdout_max_bytes": {"type": "integer", "minimum": 1024},
            "cwd_policy": {"type": "string", "enum": ["project_workspace", "app_data"]}
          }
        }
      }
    }
  }
}

Strict agent output schema:
{
  "type": "object",
  "required": ["output", "tokens_used", "finish_reason", "metadata"],
  "properties": {
    "output": {"type": "string"},
    "tokens_used": {"type": "integer", "minimum": 0},
    "finish_reason": {"type": "string", "enum": ["stop", "length", "error"]},
    "metadata": {"type": "object"}
  }
}


Appendix F: Task State Transitions
Allowed transitions:
queued → running → completed
queued → running → failed
queued → running → waiting_clarification → queued
queued → blocked → queued (when deps complete)
queued → paused → queued | cancelled
running → paused → queued | cancelled
Any → failed (on unrecoverable error)

Rules:
- Only queued tasks with all deps completed may run (except Clarification Tasks)
- waiting_clarification blocks dependents until clarify_submit
- failed propagates to project failed if acceptance criteria cannot be met and failure_strategy == "halt"
- paused is user-initiated; cancelled tasks are terminal and removed from scheduling


Appendix G: Scheduler Pseudocode
ready = tasks.filter(t => t.status == queued && deps_completed(t))
sort ready by priority_override desc, default_priority desc, created_at asc
for task in ready.take(concurrency_limit):
  agent = select_agent(task)
  if insufficient_slicing(task):
    enqueue_clarification(task)
    continue
  dispatch(task, agent)

select_agent(task):
  if manual_agent_override: return override
  candidates = agents.matching(task.capability).filter(healthy && enabled)
  return highest_priority(candidates)

insufficient_slicing(task):
  return clarity_score(task.input, goal_spec) < threshold || missing_required_elements(task.input)

Per-project concurrency:
- concurrency_limit = min(config.batching.concurrency, project_specific_limit or Infinity)
- If project has waiting_clarification, deprioritize unrelated projects only if approval_mode != automatic


Appendix H: Clarity Scoring & Slicing Sufficiency
Clarity score (0..1):
score = 0.35*has_required_elements + 0.25*constraint_specificity + 0.25*acceptance_criteria_present - 0.15*ambiguity
Thresholds: pre-shredder 0.7; per-task 0.6 (configurable in config.defaults)
Required elements by project type are enumerated in templates; missing items reduce score.
Slicing sufficiency: verify that truncated/summarized context retains all required fields for the task; if any key field lost, mark insufficient.

Task-level clarity check:
- If task.clarity_prompt is provided, EvalAgent validates the produced output against clarity_prompt using available context (chunked first)
- On failure, re-run the task once with the elaborated prompt (post-elaboration, pre-shredding) injected to give full scope
- Optionally include outputs from sibling branches listed in input_chain
- If still failing, raise failure_type: "clarity_check_failed" and queue clarification or escalate per failure_strategy


Appendix I: First-Run Wizard (Windows)
Step 1: Welcome → explain offline/local
Step 2: Enter API keys (optional) → validate format
Step 3: Register default local agents → set priorities per capability
Step 4: Configure batching and approval/silent mode
Step 5: Test notifications → store config.json
Exit: Land on Queue screen


Appendix J: Windows Notification Payloads
Approval needed:
{ "type": "approval", "project_id": "...", "task_id": "...", "title": "Approval required", "body": "Task needs approval" }

Failure:
{ "type": "failure", "project_id": "...", "task_id": "...", "title": "Task failed", "body": "Click to review" }

Clarification:
{ "type": "clarify", "project_id": "...", "title": "Clarification needed", "body": "N questions pending" }

Completion:
{ "type": "complete", "project_id": "...", "title": "Project completed", "body": "All tasks done" }


Appendix K: Secrets Storage & Rotation
- Default: Windows DPAPI-protected file at %APPDATA%/SuperCollider/secret.bin
- Optional passphrase layer; prompt on first run
- Rotation: create new blob; re-encrypt secrets; old blob kept for rollback (single previous)
- No secrets in logs; redact on render


Appendix L: Code Edit Artifact Schema
Represents code-generation outputs for deterministic application:
{
  "type": "object",
  "required": ["artifact_type", "entries"],
  "properties": {
    "artifact_type": {"type": "string", "enum": ["code_edits"]},
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "content", "mode"],
        "properties": {
          "path": {"type": "string"},
          "mode": {"type": "string", "enum": ["create", "update", "delete"]},
          "content": {"type": ["string", "null"]}
        }
      }
    }
  }
}


Appendix M: IPC Type Definitions (Rust and TypeScript)
Rust types (serde-ready):
// requests
#[derive(serde::Deserialize)]
struct AgentRegisterRequest { agent: Agent };

#[derive(serde::Deserialize)]
struct ProjectStartRequest { project: ProjectStartPayload };

#[derive(serde::Deserialize)]
struct ProjectStartPayload { r#type: String, prompt: String, config_override: Option<serde_json::Value> };

// responses
#[derive(serde::Serialize)]
struct OkResponse { ok: bool }

#[derive(serde::Serialize)]
struct AgentRegisterResponse { ok: bool, agent: Option<Agent>, error: Option<String> }

#[derive(serde::Serialize)]
struct AgentTestResponse { ok: bool, latency_ms: Option<u64>, health: Option<String>, error: Option<String> }

#[derive(serde::Serialize)]
struct AgentsListResponse { ok: bool, agents: Vec<Agent> }

#[derive(serde::Serialize)]
struct ProjectStartResponse { ok: bool, project_id: Option<String>, error: Option<String> }

#[derive(serde::Serialize)]
struct ProjectStatusResponse { ok: bool, status: String, tasks_summary: serde_json::Value }

#[derive(serde::Serialize)]
struct ProjectLogsResponse { ok: bool, lines: Vec<String> }

#[derive(serde::Serialize)]
struct ConfigUpdateResponse { ok: bool, config: serde_json::Value }

#[derive(serde::Serialize)]
struct QueueReorderResponse { ok: bool, queue: Vec<String> }

TypeScript types (frontend):
export interface Agent { name: string; capabilities: ("code"|"text"|"image"|"sound"|"video")[]; endpoint_url?: string; auth?: Record<string, unknown>; request_template?: string; response_mapping?: Record<string, unknown>; enabled: boolean; priority: number; health: "unknown"|"healthy"|"degraded"|"unreachable"; local: boolean }

export interface AgentRegisterRequest { agent: Agent }
export interface AgentRegisterResponse { ok: boolean; agent?: Agent; error?: string }
export interface AgentTestResponse { ok: boolean; latency_ms?: number; health?: string; error?: string }
export interface AgentsListResponse { ok: boolean; agents: Agent[] }
export interface ProjectStartRequest { project: { type: string; prompt: string; config_override?: Record<string, unknown> } }
export interface ProjectStartResponse { ok: boolean; project_id?: string; error?: string }
export interface OkResponse { ok: true }
export interface ProjectStatusResponse { ok: boolean; status: string; tasks_summary: Record<string, unknown> }
export interface ProjectLogsResponse { ok: boolean; lines: string[] }
export interface ConfigUpdateResponse { ok: boolean; config: Record<string, unknown> }
export interface QueueReorderResponse { ok: boolean; queue: string[] }


Appendix N: Error Codes and Remediation
- schema_mismatch: response failed strict schema → fix adapter or agent response mapping; retry after correction
- timeout: request exceeded timeout → increase timeout or reduce token_limit/batch_size
- http_error: non-2xx or connection failure → verify allowlist, endpoint, auth; agent health may be set degraded
- insufficient_context: slicing removed required fields → answer clarification or switch to full-context mode for chain
- evaluation_failed: compile/tests/static checks failed → re-run EvalAgent with expanded logs; generate fix tasks
- user_rejection: user declined approval → cancel task or adjust parameters; log rationale
- quota_exceeded: token/daily limits reached → wait or adjust limits; scheduler pauses new dispatch
- permission_denied: operation not allowed by config/security → enable explicitly in config; log denial
- clarity_check_failed: output did not satisfy task.clarity_prompt after chunked and full-scope retries → clarify requirements or relax prompt; consider increasing token_limit


Appendix O: Persistence, Locking, and Recovery
- Atomic writes: write file.tmp then fsync + rename to target
- File locks: single-instance runtime; per-file advisory lock during write
- Tasks log as NDJSON append-only; each entry has monotonic seq
- Recovery on startup:
  - Any task with status running → set to queued
  - Validate JSON via schema; move corrupt files to *.corrupt with timestamp
  - Rebuild in-memory queue from tasks.jsonl order
- Versioning: store schema_version in config.json; migrate forward if needed


Appendix P: Default Configuration Examples
config.json (defaults):
{
  "batching": { "enabled": false, "batch_size": 4, "concurrency": 1 },
  "priorities": { "text": 100, "code": 100, "image": 50, "sound": 50, "video": 50 },
  "allowlist": [],
  "defaults": {},
  "auto_start_queue": false,
  "approval_mode": "dynamic",
  "silent_mode": false,
  "failure_strategy": "halt"
}

agents.json (empty baseline):
[]

agents.json (with LocalTextAgent):
[
  {
    "name": "LocalTextAgent",
    "capabilities": ["text"],
    "enabled": true,
    "priority": 100,
    "health": "healthy",
    "local": true
  }
]


Appendix Q: UI Screens and Flows
- First Run Wizard: keys → agent priorities → batching/approval → notifications test
- Dashboard: queue list, controls (start/pause/resume), add project
- Agents: list/register/test, priorities per capability, enable/disable
- Project Detail: tasks timeline, logs, approvals/clarifications
- Settings: config editor, notification preferences, storage path
- Atomic Task Builder: create/edit tasks with templates and live validation
Flows:
1) User enqueues projects; starts queue or enables auto_start_queue
2) Prompt Analysis → Clarification if needed → Shredder
3) Scheduler dispatches tasks per priorities; notifications on key events
4) Eval/Composer; completion summary vs acceptance criteria


Appendix R: Local Agent Adapter Example (Rust pseudocode)
pub fn execute_local_text(input: &str, token_limit: u32, _ctx: &serde_json::Value) -> serde_json::Value {
  let truncated = truncate_chars(input, (token_limit as usize) * 4);
  serde_json::json!({
    "output": truncated,
    "tokens_used": truncated.len() / 4,
    "finish_reason": "stop",
    "metadata": {"adapter": "LocalTextAgent"}
  })
}

// External Process Agent (Claude Code CLI example pseudocode)
pub fn execute_process_agent(cmd: &str, args: &[String], stdin_payload: &str, timeout_ms: u64) -> anyhow::Result<serde_json::Value> {
  // Validate cmd is allowlisted and resolvable via 'which'
  // Spawn with stdin, capture stdout/stderr, enforce timeout and size limits
  // Expect strict JSON on stdout matching the agent output schema
  // Return parsed JSON or map to schema_mismatch/error
  unimplemented!()
}


Appendix S: Token and Truncation Strategy
- Token approximation: tokens ≈ chars / 4 (fallback when tokenizer unavailable)
- Per-task char_limit = token_limit * 4
- Truncation order: keep preamble → keep constraints/acceptance → keep most recent context → drop oldest overflow
- Summarization fallback: if critical fields would be dropped, summarize non-critical context instead
- Full-context on first failure (silent mode): disable truncation for affected chain when feasible


Appendix T: Notification Preferences and Tauri Config Highlights
notification_prefs.json example:
{
  "enabled": true,
  "types": { "approval": true, "failure": true, "clarify": true, "complete": true },
  "dnd_respect": true,
  "throttle": { "max_per_minute": 3, "dedupe_window_sec": 30 }
}

tauri.conf.json highlights:
{
  "build": { "beforeBuildCommand": "", "beforeDevCommand": "" },
  "tauri": {
    "allowlist": { "all": false, "notification": true, "shell": { "all": false } },
    "security": { "csp": "default-src 'self'" },
    "windows": [{ "title": "SuperCollider", "resizable": true }],
    "updater": { "active": false },
    "bundle": { "targets": ["msi"], "windows": { "wix": { "language": "en-US" } } }
  }
}


Appendix U: Dependencies and Versions
Rust (Cargo.toml):
- tauri = "^1.5"
- serde = { version = "^1.0", features = ["derive"] }
- serde_json = "^1.0"
- anyhow = "^1.0"
- thiserror = "^1.0"
- parking_lot = "^0.12"
- tokio = { version = "^1", features = ["rt-multi-thread", "macros", "fs"] }
- notify-rust = "^4" (optional; platform-specific)
- dirs = "^5"
- which = "^6"  // resolve allowed commands

Node (src-ui/package.json):
- react = "^18"
- react-dom = "^18"
- typescript = "^5"
- vite = "^5"
- @tauri-apps/api = "^1"
- zod = "^3" (optional schema validation)
 - axios = "^1" (optional HTTP client for adapters)


Appendix V: Single-Instance and Dev Commands
Single-instance:
- Use tauri::Builder::setup to enforce a single running instance (or tauri-plugin-single-instance if used)
- If a second instance is launched, focus the existing window and pass args via IPC

Dev commands:
- npm run tauri dev (hot-reload UI, dev backend)
- npm run tauri build (release build)

Windows prerequisites:
- Visual Studio Build Tools (for Rust/Tauri), Windows 10+, Node 20+, Rust stable toolchain


Appendix W: Sample Prompts by Project Type
coding_project:
- "Build a CLI todo app in Rust with add/list/delete, unit tests, and a release binary. Target Windows, include README and packaging instructions."

presentation:
- "Create a 10-slide deck explaining the benefits of local-first AI orchestration, with title, agenda, 3 key benefits, implementation overview, and summary."

report:
- "Write a technical report comparing Electron and Tauri for offline desktop apps, including performance, security, and packaging tradeoffs. Include figures and a summary table."

video:
- "Storyboard a 60-second product intro video at 1080p with 4 scenes, narration script, and background music cues."


Appendix X: Atomic Task Templates & Preamble Guidelines
Purpose: Provide ready-to-use templates for creating atomic tasks and writing effective preambles.

X1. Atomic Task Template (JSON)
{
  "id": "task-uuid",
  "project_id": "project-uuid",
  "type": "code|text|image|sound|video|clarify|eval",
  "capability": "code|text|image|sound|video|any",
  "status": "queued",
  "deps": [],
  "input_chain": [],
  "input": {},
  "preamble": "",
  "token_limit": 1500,
  "manual_agent_override": null,
  "priority_override": null,
  "metadata": {},
  "approval_required": false,
  "retries": 0
}

X2. Preamble Writing Guidelines
- Be concise and explicit about the task objective and constraints
- Include acceptance criteria and output format requirements (strict JSON where possible)
- Provide only the minimal necessary context; link upstream outputs via input_chain
- For code: specify language, toolchain, style, tests to satisfy
- For text: specify tone, structure, and word/section limits

UI Builder fields (with validation):
- type (select): code|text|image|sound|video|clarify|eval (required)
- capability (select): code|text|image|sound|video|any (required)
- deps (multi-select from project tasks)
- input_chain (multi-select)
- preamble (textarea; recommended 1-5 sentences)
- token_limit (number; min 1)
- manual_agent_override (select from agents)
- priority_override (number)
- approval_required (checkbox)
- metadata (JSON editor)
- live clarity score and sufficiency hints
 - clarity_prompt (textarea; optional). Used by EvalAgent to validate outputs; on failure, system retries with full elaborated prompt and optional sibling outputs.

X3. Example Preambles
Code (unit-tested function):
"Implement the function as specified. Use Rust 1.75 stable. Ensure tests in tests/math.rs pass. Output must compile with cargo test. Keep function pure."

Text (structured summary):
"Write a 150-word executive summary with 3 bullet points and a concluding sentence. Use neutral tone. Return output as plain text in the 'output' field."

X4. Example Atomic Tasks
Text summarization:
{
  "type": "text",
  "capability": "text",
  "deps": [],
  "input": {"content": "<long text>"},
  "preamble": "Summarize to 150 words with 3 bullets and conclusion.",
  "token_limit": 800,
  "approval_required": false
}

Code implementation:
{
  "type": "code",
  "capability": "code",
  "deps": ["spec-task"],
  "input_chain": ["spec-task"],
  "input": {"module": "math", "function": "sum", "signature": "fn sum(a:i32,b:i32)->i32"},
  "preamble": "Implement in Rust 1.75. Make tests in tests/math.rs pass.",
  "token_limit": 1200,
  "approval_required": true
}

