import { App, Modal, Setting } from "obsidian";

export class ConfirmModal extends Modal {
	private onConfirm: () => void;
	private message: string;
	private confirmText: string;

	constructor(app: App, title: string, message: string, confirmText: string, onConfirm: () => void) {
		super(app);
		this.setTitle(title);
		this.message = message;
		this.confirmText = confirmText;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.message });

		new Setting(contentEl)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(this.confirmText)
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
