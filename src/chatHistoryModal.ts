import { App, SuggestModal } from "obsidian";
import { ChatNoteSummary } from "./chatStore";

declare const window: Window & { moment: (...args: unknown[]) => { fromNow: () => string } };

/** Lets the user pick a previously saved chat conversation to reopen in the panel. */
export class ChatHistoryModal extends SuggestModal<ChatNoteSummary> {
	private notes: ChatNoteSummary[];
	private onChoose: (note: ChatNoteSummary) => void;

	constructor(app: App, notes: ChatNoteSummary[], onChoose: (note: ChatNoteSummary) => void) {
		super(app);
		this.notes = notes;
		this.onChoose = onChoose;
		this.setPlaceholder("Search past conversations…");
		this.emptyStateText = "No saved conversations yet — start chatting and they'll show up here.";
	}

	getSuggestions(query: string): ChatNoteSummary[] {
		const q = query.trim().toLowerCase();
		if (!q) return this.notes;
		return this.notes.filter(
			(n) => n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q)
		);
	}

	renderSuggestion(note: ChatNoteSummary, el: HTMLElement): void {
		el.addClass("agent-swarm-history-item");
		el.createDiv({ text: note.title, cls: "agent-swarm-history-title" });
		const meta = el.createDiv({ cls: "agent-swarm-history-meta" });
		meta.createSpan({ text: window.moment(note.updatedAt).fromNow() });
		if (note.preview) {
			meta.createSpan({ text: ` · ${note.preview}` });
		}
	}

	onChooseSuggestion(note: ChatNoteSummary): void {
		this.onChoose(note);
	}
}
