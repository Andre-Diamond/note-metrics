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

		// Add the heading using Setting
		new Setting(containerEl)
			.setName('Folders to scan')
			.setDesc('Select folders to scan for tags and daily habits')
			.setHeading();

		// Container for all folder inputs
		const folderContainer = containerEl.createDiv('folder-container');

		const renderFolderInputs = () => {
			folderContainer.empty();
			this.plugin.settings.folders.forEach((folder, index) => {
				const folderDiv = folderContainer.createDiv({ cls: 'folder-input-row' });
				const inputContainer = folderDiv.createDiv({ cls: 'input-container' });

				new Setting(inputContainer)
					.addText((text) =>
						text
							.setPlaceholder(index === 0 ? 'Default daily note folder' : 'Enter folder name')
							.setValue(folder)
							.onChange(async (value) => {
								this.plugin.settings.folders[index] = value;
								await this.plugin.saveSettings();
							})
					);

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

		const addButton = containerEl.createEl('button', { text: 'Add folder' });
		addButton.addClass('add-folder-button');
		addButton.addEventListener('click', async () => {
			this.plugin.settings.folders.push('');
			await this.plugin.saveSettings();
			renderFolderInputs();
		});

		// Add donation section
		containerEl.createEl('hr');

		new Setting(containerEl)
			.setName('Support the development')
			.setDesc('If you find this plugin helpful, consider supporting its development')
			.setHeading();

		const donationButtons = containerEl.createDiv('donation-buttons');
		donationButtons.addClass('donation-container');

		const githubButton = donationButtons.createEl('button', {
			text: 'GitHub Sponsors',
			cls: 'donation-button github-sponsor'
		});
		githubButton.addEventListener('click', () => {
			window.open('https://github.com/sponsors/Andre-Diamond');
		});

		const buyMeACoffeeButton = donationButtons.createEl('button', {
			text: 'Buy Me a Coffee',
			cls: 'donation-button buymeacoffee'
		});
		buyMeACoffeeButton.addEventListener('click', () => {
			window.open('https://www.buymeacoffee.com/signius');
		});
	}
}
