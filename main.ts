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

		const ribbonIconEl = this.addRibbonIcon('bar-chart', 'Daily Note Dashboard', (evt: MouseEvent) => {
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
			name: 'Open Dashboard',
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
		// Detach existing dashboard leaves before activating a new one.
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_DASHBOARD);
		// Create a new right sidebar leaf for the dashboard.
		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (rightLeaf) {
			await rightLeaf.setViewState({
				type: VIEW_TYPE_DASHBOARD,
				active: true,
			});
		}
		// Reveal the dashboard if it exists.
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
		if (leaves.length > 0) {
			this.app.workspace.revealLeaf(leaves[0]);
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
		containerEl.createEl('h2', { text: 'Folders to Scan' });
		const folderContainer = containerEl.createDiv('folder-container');

		const renderFolderInputs = () => {
			folderContainer.empty();
			this.plugin.settings.folders.forEach((folder, index) => {
				const folderDiv = folderContainer.createDiv({ cls: 'folder-input-row' });
				new Setting(folderDiv)
					.setName(index === 0 ? 'Default Daily Note Folder' : `Folder ${index + 1}`)
					.setDesc('Folder to scan for tags and daily habits.')
					.addText(text => text
						.setPlaceholder('Enter folder name')
						.setValue(folder)
						.onChange(async (value) => {
							this.plugin.settings.folders[index] = value;
							await this.plugin.saveSettings();
						}));
				// Allow removal of additional folders (but not the default one)
				if (index > 0) {
					folderDiv.createEl('button', { text: 'Remove' })
						.addEventListener('click', async () => {
							this.plugin.settings.folders.splice(index, 1);
							await this.plugin.saveSettings();
							renderFolderInputs();
						});
				}
			});
		};

		renderFolderInputs();

		containerEl.createEl('button', { text: 'Add Folder' })
			.addEventListener('click', async () => {
				this.plugin.settings.folders.push('');
				await this.plugin.saveSettings();
				renderFolderInputs();
			});
	}
}
