import { App, Modal, Setting, TFolder } from "obsidian";

export class FolderPickerModal extends Modal {
	private onPick: (path: string) => void;

	constructor(app: App, currentPath: string, onPick: (path: string) => void) {
		super(app);
		this.onPick = onPick;
		this.setTitle("Open project folder");
		this.currentPath = currentPath;
	}

	private currentPath: string;

	onOpen(): void {
		const { contentEl } = this;

		contentEl.createEl("p", {
			text: "Pick an existing folder to use as the Code editor's project root, or type a new path to create one.",
			cls: "setting-item-description",
		});

		new Setting(contentEl)
			.setName("Vault root")
			.setDesc("Browse the entire vault (no folder restriction).")
			.addButton((b) =>
				b.setButtonText("Use vault root").onClick(() => {
					this.close();
					this.onPick("");
				})
			);

		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && f.path !== "/")
			.sort((a, b) => a.path.localeCompare(b.path));

		if (folders.length > 0) {
			contentEl.createEl("div", { text: "Existing folders", cls: "agent-swarm-modal-subheading" });
			const list = contentEl.createDiv({ cls: "agent-swarm-folder-list" });
			for (const folder of folders) {
				const item = list.createDiv({ cls: "agent-swarm-folder-list-item", text: folder.path });
				item.addEventListener("click", () => {
					this.close();
					this.onPick(folder.path);
				});
			}
		}

		contentEl.createEl("div", { text: "Or create a new folder", cls: "agent-swarm-modal-subheading" });
		let newPath = this.currentPath;
		new Setting(contentEl)
			.addText((t) =>
				t
					.setPlaceholder("e.g. Projects/my-app")
					.setValue(this.currentPath)
					.onChange((v) => (newPath = v.trim()))
			)
			.addButton((b) =>
				b
					.setButtonText("Create & use")
					.setCta()
					.onClick(async () => {
						if (!newPath) return;
						const existing = this.app.vault.getAbstractFileByPath(newPath);
						if (!existing) {
							try {
								await this.app.vault.createFolder(newPath);
							} catch (err) {
								// If it already exists as a race, ignore; otherwise surface nothing fancy here.
							}
						}
						this.close();
						this.onPick(newPath);
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
