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
	mySetting: string;
}

const DEFAULT_SETTINGS: NoteMetricsSettings = {
	mySetting: 'default'
}

export default class NoteMetricsPlugin extends Plugin {
	settings: NoteMetricsSettings;

	async onload() {
		await this.loadSettings();

		const ribbonIconEl = this.addRibbonIcon('dice', 'Daily Note Dashboard', (evt: MouseEvent) => {
			this.activateDashboardView();
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Sample status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

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

		// Sample global DOM event.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// Sample interval registration.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		// Detach the dashboard view if open.
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_DASHBOARD);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateDashboardView() {
		// Detach existing dashboard leaves.
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_DASHBOARD);
		// Create a new right sidebar leaf for the dashboard.
		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (rightLeaf) {
			await rightLeaf.setViewState({
				type: VIEW_TYPE_DASHBOARD,
				active: true,
			});
		}
		// Reveal the dashboard.
		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0]
		);
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

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
