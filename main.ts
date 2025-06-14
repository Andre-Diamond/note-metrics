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
	// Setting: list of headings to track checkboxes under
	headings: string[];
	// Setting: whether to ignore heading levels when matching
	ignoreHeadingLevels: boolean;
}

const DEFAULT_SETTINGS: NoteMetricsSettings = {
	// Default folder is the Daily Notes folder.
	folders: ['Daily Notes'],
	// Default heading is Daily Habits
	headings: ['# Daily Habits', '## Work Tasks', '### Evening Routine'],
	// Default to false - match exact heading levels
	ignoreHeadingLevels: false
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

		// Add heading section
		containerEl.createEl('hr');

		new Setting(containerEl)
			.setName('Headings to track')
			.setDesc('Specify the headings under which to track checkboxes')
			.setHeading();

		// Container for all heading inputs
		const headingContainer = containerEl.createDiv('heading-container');

		const renderHeadingInputs = () => {
			headingContainer.empty();
			this.plugin.settings.headings.forEach((heading, index) => {
				const headingDiv = headingContainer.createDiv({ cls: 'heading-input-row' });
				const inputContainer = headingDiv.createDiv({ cls: 'input-container' });

				new Setting(inputContainer)
					.addText((text) =>
						text
							.setPlaceholder(index === 0 ? 'Enter heading with level (e.g. # Main Habits, ## Work Tasks)' : 'Enter heading with level')
							.setValue(heading)
							.onChange(async (value) => {
								this.plugin.settings.headings[index] = value;
								await this.plugin.saveSettings();
							})
					);

				if (index > 0) {
					const removeBtn = inputContainer.createEl('button', { text: '×' });
					removeBtn.addClass('small-remove-button');
					removeBtn.addEventListener('click', async () => {
						this.plugin.settings.headings.splice(index, 1);
						await this.plugin.saveSettings();
						renderHeadingInputs();
					});
				}
			});
		};

		renderHeadingInputs();

		const addHeadingButton = containerEl.createEl('button', { text: 'Add heading' });
		addHeadingButton.addClass('add-heading-button');
		addHeadingButton.addEventListener('click', async () => {
			this.plugin.settings.headings.push('');
			await this.plugin.saveSettings();
			renderHeadingInputs();
		});

		// Add checkbox for ignoring heading levels
		new Setting(containerEl)
			.setName('Ignore heading levels')
			.setDesc('When enabled, will match headings regardless of their level (e.g., # and ## will match the same heading)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.ignoreHeadingLevels)
				.onChange(async (value) => {
					this.plugin.settings.ignoreHeadingLevels = value;
					await this.plugin.saveSettings();
				}));

		// Add donation section
		containerEl.createEl('hr');

		new Setting(containerEl)
			.setName('Support the development')
			.setDesc('If you find this plugin helpful, consider supporting its development')
			.setHeading();

		const donationButtons = containerEl.createDiv('donation-buttons');
		donationButtons.addClass('donation-container');

		const buyMeACoffeeButton = donationButtons.createEl('button', {
			text: '☕ Buy Me a Coffee',
			cls: 'donation-button buymeacoffee small-button'
		});
		buyMeACoffeeButton.addEventListener('click', () => {
			window.open('https://www.buymeacoffee.com/signius');
		});

		const submitIssueButton = donationButtons.createEl('button', {
			text: '🐛 Submit Issue',
			cls: 'donation-button submit-issue small-button'
		});
		submitIssueButton.addEventListener('click', () => {
			window.open('https://github.com/Andre-Diamond/note-metrics/issues/new');
		});
	}
}
