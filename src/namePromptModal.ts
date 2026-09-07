import { App, Modal, Setting } from "obsidian";

export class NamePromptModal extends Modal {
	private value = "";
	private onSubmit: (value: string) => void;

	constructor(app: App, title: string, placeholder: string, onSubmit: (value: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.setTitle(title);

		this.placeholder = placeholder;
	}

	private placeholder: string;

	onOpen(): void {
		const { contentEl } = this;

		let inputEl: HTMLInputElement;
		new Setting(contentEl).addText((t) => {
			t.setPlaceholder(this.placeholder).onChange((v) => (this.value = v));
			inputEl = t.inputEl;
			inputEl.focus();
			inputEl.addEventListener("keydown", (evt) => {
				if (evt.key === "Enter") {
					evt.preventDefault();
					this.submit();
				}
			});
		});

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText("Create")
				.setCta()
				.onClick(() => this.submit())
		);
	}

	private submit(): void {
		const trimmed = this.value.trim();
		if (!trimmed) return;
		this.close();
		this.onSubmit(trimmed);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
