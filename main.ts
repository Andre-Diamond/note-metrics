// main.ts
import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf
} from 'obsidian';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './src/views/DashboardView';

interface NoteMetricsSettings {
	// Setting: list of folders to scan.
	folders: string[];
}

const DEFAULT_SETTINGS: NoteMetricsSettings = {
	// Default folder is the Daily Notes folder.
	folders: ['Daily Notes']
}

export default class NoteMetricsPlugin extends Plugin {
	settings: NoteMetricsSettings;

	async onload() {
		await this.loadSettings();

		const ribbonIconEl = this.addRibbonIcon('bar-chart', 'Daily note dashboard', (evt: MouseEvent) => {
			this.activateDashboardView();
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Register the new Dashboard view.
		this.registerView(
			VIEW_TYPE_DASHBOARD,
			(leaf: WorkspaceLeaf) => new DashboardView(leaf, this)
		);

		// Command to open the Dashboard view.
		this.addCommand({
			id: 'open-dashboard',
			name: 'Open dashboard',
			callback: () => this.activateDashboardView()
		});

		// Add a settings tab for your plugin.
		this.addSettingTab(new NoteMetricsSettingTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateDashboardView() {
		// Check if a dashboard view already exists.
		const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
		if (existingLeaves.length > 0) {
			// If found, simply reveal (and focus) on the first one.
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}
	
		// If no dashboard leaf exists, create a new right sidebar leaf.
		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (rightLeaf) {
			await rightLeaf.setViewState({
				type: VIEW_TYPE_DASHBOARD,
				active: true,
			});
			this.app.workspace.revealLeaf(rightLeaf);
		}
	}	
}

class NoteMetricsSettingTab extends PluginSettingTab {
	plugin: NoteMetricsPlugin;

	constructor(app: App, plugin: NoteMetricsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Settings for folder selection.
		new Setting(containerEl).setName('Folders to scan').setHeading();
		const folderContainer = containerEl.createDiv('folder-container');

		const renderFolderInputs = () => {
			folderContainer.empty();
			this.plugin.settings.folders.forEach((folder, index) => {
				// Create a row for each folder input.
				const folderDiv = folderContainer.createDiv({ cls: 'folder-input-row' });
				// Create an inline container for the text input and remove button.
				const inputContainer = folderDiv.createDiv({ cls: 'input-container' });
				new Setting(inputContainer)
					.setName(
						index === 0
							? 'Default daily note folder'
							: `Folder ${index + 1}`
					)
					.setDesc('Folder to scan for tags and daily habits.')
					.addText((text) =>
						text
							.setPlaceholder('Enter folder name')
							.setValue(folder)
							.onChange(async (value) => {
								this.plugin.settings.folders[index] = value;
								await this.plugin.saveSettings();
							})
					);
				// For additional folders (not the default), add a remove button.
				if (index > 0) {
					const removeBtn = inputContainer.createEl('button', { text: '×' });
					removeBtn.addClass('small-remove-button');
					removeBtn.addEventListener('click', async () => {
						this.plugin.settings.folders.splice(index, 1);
						await this.plugin.saveSettings();
						renderFolderInputs();
					});
				}
			});
		};

		renderFolderInputs();

		containerEl
			.createEl('button', { text: 'Add folder' })
			.addEventListener('click', async () => {
				this.plugin.settings.folders.push('');
				await this.plugin.saveSettings();
				renderFolderInputs();
			});
	}
}
