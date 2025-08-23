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
	// Setting: whether to scan all folders instead of just specified folders
	scanAllFolders: boolean;
	// Setting: which charts to display
	showCheckboxCharts: boolean;
	showTagCharts: boolean;
	showGroupTagsChart: boolean;
	showEmojiTagsChart: boolean;
	showSingleTagsChart: boolean;
	// Setting: chart display order (lower numbers appear first)
	checkboxChartsOrder: number;
	tagChartsOrder: number;
	groupTagsChartOrder: number;
	emojiTagsChartOrder: number;
	singleTagsChartOrder: number;
}

const DEFAULT_SETTINGS: NoteMetricsSettings = {
	// Default folder is the Daily Notes folder.
	folders: ['Daily Notes'],
	// Default heading is Daily Habits
	headings: ['# Work Tasks', '## Daily Habits', '### Evening Routine'],
	// Default to false - match exact heading levels
	ignoreHeadingLevels: false,
	// Default to false - only scan specified folders
	scanAllFolders: false,
	// Default to show all charts
	showCheckboxCharts: true,
	showTagCharts: true,
	showGroupTagsChart: true,
	showEmojiTagsChart: true,
	showSingleTagsChart: true,
	// Default chart orders
	checkboxChartsOrder: 1,
	tagChartsOrder: 2,
	groupTagsChartOrder: 3,
	emojiTagsChartOrder: 4,
	singleTagsChartOrder: 5
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

			// Only show folder inputs if "Scan all folders" is disabled
			if (this.plugin.settings.scanAllFolders) {
				folderContainer.style.display = 'none';
				return;
			}

			folderContainer.style.display = 'block';
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

		// Update add button visibility based on scan all folders setting
		const updateAddButtonVisibility = () => {
			addButton.style.display = this.plugin.settings.scanAllFolders ? 'none' : 'block';
		};

		const addButton = containerEl.createEl('button', { text: 'Add folder' });
		addButton.addClass('add-folder-button');
		addButton.addEventListener('click', async () => {
			this.plugin.settings.folders.push('');
			await this.plugin.saveSettings();
			renderFolderInputs();
		});

		updateAddButtonVisibility();

		// Add checkbox for scanning all folders
		new Setting(containerEl)
			.setName('Scan all folders')
			.setDesc('When enabled, will scan all folders for daily habits and tags, not just the specified folders')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.scanAllFolders)
				.onChange(async (value) => {
					this.plugin.settings.scanAllFolders = value;
					await this.plugin.saveSettings();
					renderFolderInputs(); // Re-render to show/hide folder inputs
					updateAddButtonVisibility(); // Update add button visibility
				}));

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

		// Add chart visibility section
		containerEl.createEl('hr');

		new Setting(containerEl)
			.setName('Chart Visibility')
			.setDesc('Select which charts to display in the dashboard')
			.setHeading();

		// Container for chart visibility settings
		const chartVisibilityContainer = containerEl.createDiv('chart-visibility-container');

		// Checkbox charts setting
		const checkboxSetting = new Setting(chartVisibilityContainer)
			.setName('Show Checkbox Charts')
			.setDesc('Display charts for habits and tasks under tracked headings')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCheckboxCharts)
				.onChange(async (value) => {
					this.plugin.settings.showCheckboxCharts = value;
					await this.plugin.saveSettings();
				}));
		checkboxSetting.settingEl.addClass('chart-visibility-setting');

		// Combo Tag charts setting
		const tagSetting = new Setting(chartVisibilityContainer)
			.setName('Show Combo Tag Charts')
			.setDesc('Display charts for each category of combo tags (e.g., #work/urgent will fall under a chart for #work)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showTagCharts)
				.onChange(async (value) => {
					this.plugin.settings.showTagCharts = value;
					await this.plugin.saveSettings();
				}));
		tagSetting.settingEl.addClass('chart-visibility-setting');

		// Primary Combo Tags setting
		const groupSetting = new Setting(chartVisibilityContainer)
			.setName('Show Combo Tag Category Summary')
			.setDesc('Display chart showing total counts for each combo tag category (e.g., total #work, #personal)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showGroupTagsChart)
				.onChange(async (value) => {
					this.plugin.settings.showGroupTagsChart = value;
					await this.plugin.saveSettings();
				}));
		groupSetting.settingEl.addClass('chart-visibility-setting');

		// Emoji tags setting
		const emojiSetting = new Setting(chartVisibilityContainer)
			.setName('Show Emoji Tags Chart')
			.setDesc('Display chart for emoji tag usage (e.g., 🚀, 📚)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showEmojiTagsChart)
				.onChange(async (value) => {
					this.plugin.settings.showEmojiTagsChart = value;
					await this.plugin.saveSettings();
				}));
		emojiSetting.settingEl.addClass('chart-visibility-setting');

		// Single tags setting
		const singleTagSetting = new Setting(chartVisibilityContainer)
			.setName('Show Single Tags Chart')
			.setDesc('Display chart for single tags without categories (e.g., #important, #urgent)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showSingleTagsChart)
				.onChange(async (value) => {
					this.plugin.settings.showSingleTagsChart = value;
					await this.plugin.saveSettings();
				}));
		singleTagSetting.settingEl.addClass('chart-visibility-setting');

		// Add chart order section
		containerEl.createEl('hr');

		new Setting(containerEl)
			.setName('Chart Display Order')
			.setDesc('Control the order in which charts appear in the dashboard (lower numbers appear first)')
			.setHeading();

		// Container for chart order settings
		const chartOrderContainer = containerEl.createDiv('chart-order-container');

		// Checkbox charts order setting
		new Setting(chartOrderContainer)
			.setName('Checkbox Charts Order')
			.setDesc('Display order for checkbox charts (currently: ' + this.plugin.settings.checkboxChartsOrder + ')')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(this.plugin.settings.checkboxChartsOrder.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value) || 1;
					this.plugin.settings.checkboxChartsOrder = numValue;
					await this.plugin.saveSettings();
				}));

		// Tag charts order setting
		new Setting(chartOrderContainer)
			.setName('Combo Tag Charts Order')
			.setDesc('Display order for combo tag charts (currently: ' + this.plugin.settings.tagChartsOrder + ')')
			.addText(text => text
				.setPlaceholder('2')
				.setValue(this.plugin.settings.tagChartsOrder.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value) || 2;
					this.plugin.settings.tagChartsOrder = numValue;
					await this.plugin.saveSettings();
				}));

		// Group tags chart order setting
		new Setting(chartOrderContainer)
			.setName('Group Tags Summary Order')
			.setDesc('Display order for group tags summary chart (currently: ' + this.plugin.settings.groupTagsChartOrder + ')')
			.addText(text => text
				.setPlaceholder('3')
				.setValue(this.plugin.settings.groupTagsChartOrder.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value) || 3;
					this.plugin.settings.groupTagsChartOrder = numValue;
					await this.plugin.saveSettings();
				}));

		// Emoji tags chart order setting
		new Setting(chartOrderContainer)
			.setName('Emoji Tags Chart Order')
			.setDesc('Display order for emoji tags chart (currently: ' + this.plugin.settings.emojiTagsChartOrder + ')')
			.addText(text => text
				.setPlaceholder('4')
				.setValue(this.plugin.settings.emojiTagsChartOrder.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value) || 4;
					this.plugin.settings.emojiTagsChartOrder = numValue;
					await this.plugin.saveSettings();
				}));

		// Single tags chart order setting
		new Setting(chartOrderContainer)
			.setName('Single Tags Chart Order')
			.setDesc('Display order for single tags chart (currently: ' + this.plugin.settings.singleTagsChartOrder + ')')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(this.plugin.settings.singleTagsChartOrder.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value) || 5;
					this.plugin.settings.singleTagsChartOrder = numValue;
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
