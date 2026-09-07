import { App, Menu, Notice, setIcon, TFile, TFolder } from "obsidian";
import { NamePromptModal } from "./namePromptModal";

export interface FileTreeCallbacks {
	onOpenFile: (file: TFile) => void;
	/** Called after a folder/file is created so the caller can e.g. show a Notice or refresh selection. */
	onChanged?: () => void;
}

/**
 * A simple recursive file-tree view scoped to a root folder (or the whole vault). Shows every
 * file type — not just code files — since the point is normal project navigation, with the
 * editor itself deciding whether a given file can actually be opened as text.
 */
export class FileTree {
	private container: HTMLElement;
	private app: App;
	private rootPath: string;
	private callbacks: FileTreeCallbacks;
	private expanded = new Set<string>();

	constructor(container: HTMLElement, app: App, rootPath: string, callbacks: FileTreeCallbacks) {
		this.container = container;
		this.app = app;
		this.rootPath = rootPath;
		this.callbacks = callbacks;
	}

	setRoot(rootPath: string): void {
		this.rootPath = rootPath;
		this.expanded.clear();
		this.render();
	}

	render(): void {
		this.container.empty();

		const root =
			this.rootPath === "" ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(this.rootPath);

		if (!(root instanceof TFolder)) {
			this.container.createDiv({
				cls: "agent-swarm-filetree-empty",
				text: `Folder not found: ${this.rootPath}`,
			});
			return;
		}

		this.expanded.add(root.path || "/");
		this.renderFolderChildren(root, this.container, 0);
	}

	private renderFolderChildren(folder: TFolder, parentEl: HTMLElement, depth: number): void {
		const children = [...folder.children].sort((a, b) => {
			const aFolder = a instanceof TFolder;
			const bFolder = b instanceof TFolder;
			if (aFolder !== bFolder) return aFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		for (const child of children) {
			if (child instanceof TFolder) {
				this.renderFolderRow(child, parentEl, depth);
			} else if (child instanceof TFile) {
				this.renderFileRow(child, parentEl, depth);
			}
		}
	}

	private renderFolderRow(folder: TFolder, parentEl: HTMLElement, depth: number): void {
		const isOpen = this.expanded.has(folder.path);

		const row = parentEl.createDiv({ cls: "agent-swarm-filetree-row agent-swarm-filetree-folder" });
		row.style.paddingLeft = `${depth * 14 + 4}px`;

		const chevron = row.createSpan({ cls: "agent-swarm-filetree-chevron" });
		setIcon(chevron, isOpen ? "chevron-down" : "chevron-right");

		const icon = row.createSpan({ cls: "agent-swarm-filetree-icon" });
		setIcon(icon, isOpen ? "folder-open" : "folder");

		row.createSpan({ cls: "agent-swarm-filetree-label", text: folder.name });

		const addBtn = row.createSpan({ cls: "agent-swarm-filetree-add", attr: { "aria-label": "New folder here" } });
		setIcon(addBtn, "folder-plus");
		addBtn.addEventListener("click", (evt) => {
			evt.stopPropagation();
			this.promptNewFolder(folder);
		});

		row.addEventListener("click", () => {
			if (isOpen) this.expanded.delete(folder.path);
			else this.expanded.add(folder.path);
			this.render();
		});

		row.addEventListener("contextmenu", (evt) => {
			evt.preventDefault();
			const menu = new Menu();
			menu.addItem((i) =>
				i
					.setTitle("New folder here")
					.setIcon("folder-plus")
					.onClick(() => this.promptNewFolder(folder))
			);
			menu.showAtMouseEvent(evt);
		});

		if (isOpen) {
			const childrenEl = parentEl.createDiv({ cls: "agent-swarm-filetree-children" });
			this.renderFolderChildren(folder, childrenEl, depth + 1);
		}
	}

	private renderFileRow(file: TFile, parentEl: HTMLElement, depth: number): void {
		const row = parentEl.createDiv({ cls: "agent-swarm-filetree-row agent-swarm-filetree-file" });
		row.style.paddingLeft = `${depth * 14 + 20}px`;

		const icon = row.createSpan({ cls: "agent-swarm-filetree-icon" });
		setIcon(icon, "file");

		row.createSpan({ cls: "agent-swarm-filetree-label", text: file.name });

		row.addEventListener("click", () => this.callbacks.onOpenFile(file));
	}

	private promptNewFolder(parent: TFolder): void {
		new NamePromptModal(this.app, "New folder", "folder-name", async (name) => {
			const path = parent.path ? `${parent.path}/${name}` : name;
			try {
				await this.app.vault.createFolder(path);
				this.expanded.add(parent.path || "/");
				this.render();
				this.callbacks.onChanged?.();
			} catch (err) {
				new Notice(`Could not create folder: ${err instanceof Error ? err.message : String(err)}`);
			}
		}).open();
	}
}
