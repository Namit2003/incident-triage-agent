/**
 * Incident Triage Copilot Frontend - Simplified REST API version
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const caseIdEl = document.getElementById("case-id");
const statusBadge = document.getElementById("status-badge");
const severitySection = document.getElementById("severity-section");
const severityBadge = document.getElementById("severity-badge");
const entitiesContent = document.getElementById("entities-content");
const actionsContent = document.getElementById("actions-content");
const timelineContent = document.getElementById("timeline-content");
const exportButton = document.getElementById("export-button");

// State
let caseId = sessionStorage.getItem("caseId") || generateCaseId();
let caseState = null;
let isProcessing = false;

// Initialize
sessionStorage.setItem("caseId", caseId);
caseIdEl.textContent = `ID: ${caseId}`;

function generateCaseId() {
	return `case-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	const textEl = document.createElement("p");
	textEl.textContent = content;
	messageEl.appendChild(textEl);
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
	const message = userInput.value.trim();
	if (message === "" || isProcessing) return;

	// Disable input
	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// Add user message to chat
	addMessageToChat("user", message);

	// Clear input
	userInput.value = "";
	userInput.style.height = "auto";

	// Show typing indicator
	typingIndicator.classList.add("visible");

	try {
		// Send to API
		const response = await fetch(`/api/case/triage?id=${caseId}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message }),
		});

		if (!response.ok) {
			throw new Error("Triage failed");
		}

		const result = await response.json();

		if (result.success && result.state) {
			caseState = result.state;

			// Display assistant messages
			const assistantMessages = result.state.messages.filter(
				(m) => m.role === "assistant"
			);
			assistantMessages.forEach((msg) => {
				if (!document.querySelector(`[data-timestamp="${msg.timestamp}"]`)) {
					const msgEl = document.createElement("div");
					msgEl.className = "message assistant-message";
					msgEl.dataset.timestamp = msg.timestamp;
					const textEl = document.createElement("p");
					textEl.textContent = msg.content;
					msgEl.appendChild(textEl);
					chatMessages.appendChild(msgEl);
				}
			});

			// Update case panel
			updateCasePanel(result.state);

			chatMessages.scrollTop = chatMessages.scrollHeight;
		} else {
			throw new Error(result.error || "Unknown error");
		}
	} catch (error) {
		console.error("Error:", error);
		addMessageToChat(
			"assistant",
			"⚠️ An error occurred. Please try again.",
		);
	} finally {
		typingIndicator.classList.remove("visible");
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

function updateCasePanel(state) {
	// Update status
	statusBadge.textContent = state.status.toUpperCase();
	statusBadge.className = `status-badge status-${state.status}`;

	// Update severity
	if (state.severity) {
		severitySection.style.display = "block";
		severityBadge.textContent = state.severity;
		severityBadge.className = `severity-badge severity-${state.severity}`;
	}

	// Update entities
	updateEntities(state.entities);

	// Update actions
	updateActions(state.actions);

	// Update timeline
	updateTimeline(state.timeline);

	// Enable export
	if (state.severity && state.actions.length > 0) {
		exportButton.disabled = false;
	}
}

function updateEntities(entities) {
	if (
		!entities.service &&
		!entities.region &&
		!entities.customerImpact &&
		!entities.affectedUsers
	) {
		entitiesContent.innerHTML =
			'<div class="empty-state">Awaiting incident information...</div>';
		return;
	}

	let html = "";
	if (entities.service) {
		html += `<div class="entity-item"><span class="entity-label">Service</span><span class="entity-value">${escapeHtml(entities.service)}</span></div>`;
	}
	if (entities.region) {
		html += `<div class="entity-item"><span class="entity-label">Region</span><span class="entity-value">${escapeHtml(entities.region)}</span></div>`;
	}
	if (entities.customerImpact) {
		html += `<div class="entity-item"><span class="entity-label">Impact</span><span class="entity-value">${escapeHtml(entities.customerImpact)}</span></div>`;
	}
	if (entities.affectedUsers) {
		html += `<div class="entity-item"><span class="entity-label">Affected Users</span><span class="entity-value">${escapeHtml(entities.affectedUsers)}</span></div>`;
	}

	entitiesContent.innerHTML = html;
}

function updateActions(actions) {
	if (actions.length === 0) {
		actionsContent.innerHTML =
			'<div class="empty-state">No actions yet</div>';
		return;
	}

	let html = "";
	actions.forEach((action) => {
		const checked = action.status === "completed" ? "checked" : "";
		html += `<div class="action-item"><input type="checkbox" class="action-checkbox" ${checked} disabled /><div class="action-text">${escapeHtml(action.description)}</div></div>`;
	});

	actionsContent.innerHTML = html;
}

function updateTimeline(timeline) {
	if (timeline.length === 0) {
		timelineContent.innerHTML =
			'<div class="empty-state">No events yet</div>';
		return;
	}

	let html = "";
	const recentEvents = timeline.slice(-5).reverse();
	recentEvents.forEach((event) => {
		const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		});
		html += `<div class="timeline-item"><div class="timeline-time">${time}</div><div class="timeline-desc">${escapeHtml(event.description)}</div></div>`;
	});

	timelineContent.innerHTML = html;
}

async function exportIncidentUpdate() {
	if (!caseState) return;

	try {
		const response = await fetch(`/api/case/export?id=${caseId}`);
		if (!response.ok) throw new Error("Export failed");

		const markdown = await response.text();
		await navigator.clipboard.writeText(markdown);

		const originalText = exportButton.textContent;
		exportButton.textContent = "✅ Copied to clipboard!";
		setTimeout(() => {
			exportButton.textContent = originalText;
		}, 2000);
	} catch (error) {
		console.error("Export failed:", error);
		alert("Failed to export update. Please try again.");
	}
}

// Event listeners
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);
exportButton.addEventListener("click", exportIncidentUpdate);

// Add welcome message
addMessageToChat(
	"assistant",
	"👋 Hello! I'm your Incident Triage Copilot. Please describe the incident you're reporting.",
);
