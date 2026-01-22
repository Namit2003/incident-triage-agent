/**
 * Type definitions for the Incident Triage Copilot.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: Ai;

	/**
	 * Binding for static assets.
	 */
	ASSETS: { fetch: (request: Request) => Promise<Response> };

	/**
	 * Binding for the IncidentCase Durable Object.
	 */
	INCIDENT_CASE: DurableObjectNamespace;
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
	timestamp?: number;
}

/**
 * Complete incident case state.
 */
export interface IncidentState {
	caseId: string;
	messages: ChatMessage[];
	entities: IncidentEntities;
	severity?: SeverityLevel;
	summary?: string;
	actions: Action[];
	timeline: TimelineEvent[];
	status: CaseStatus;
	createdAt: number;
	updatedAt: number;
}

/**
 * Extracted incident entities.
 */
export interface IncidentEntities {
	service?: string;
	region?: string;
	customerImpact?: string;
	affectedUsers?: string;
}

/**
 * Severity levels for incident classification.
 */
export type SeverityLevel = "P0" | "P1" | "P2" | "P3" | "P4";

/**
 * Case workflow status.
 */
export type CaseStatus = "intake" | "clarifying" | "triaged" | "closed";

/**
 * Action item in the incident response.
 */
export interface Action {
	id: string;
	description: string;
	owner?: string;
	status: ActionStatus;
	createdAt: number;
}

export type ActionStatus = "proposed" | "assigned" | "completed";

/**
 * Timeline event for incident history.
 */
export interface TimelineEvent {
	timestamp: number;
	type: TimelineEventType;
	description: string;
	metadata?: Record<string, unknown>;
}

export type TimelineEventType =
	| "created"
	| "message"
	| "severity_set"
	| "action_added"
	| "status_update"
	| "entities_extracted";

/**
 * Workflow steps for deterministic triage.
 */
export enum WorkflowStep {
	INTAKE = "intake",
	EXTRACT_ENTITIES = "extract_entities",
	CLARIFY = "clarify",
	CLASSIFY_SEVERITY = "classify_severity",
	PROPOSE_ACTIONS = "propose_actions",
	GENERATE_UPDATE = "generate_update",
	COMPLETE = "complete",
}

/**
 * WebSocket message types.
 */
export interface WSMessage {
	type: "chat" | "state_update" | "error";
	data: unknown;
}

/**
 * LLM extraction result.
 */
export interface ExtractionResult {
	service?: string;
	region?: string;
	customerImpact?: string;
	affectedUsers?: string;
	needsClarification: string[];
}
