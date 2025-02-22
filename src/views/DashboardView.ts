import { ItemView, WorkspaceLeaf, Plugin } from 'obsidian';
import { ChartComponent } from '../components/ChartComponent';
import { parseDailyNotes } from '../data/dataParser';

export const VIEW_TYPE_DASHBOARD = "dashboard-view";

export class DashboardView extends ItemView {
	plugin: Plugin;
	chartComponent: ChartComponent | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	getDisplayText(): string {
		return "Dashboard";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl('h2', { text: "Daily Notes Dashboard" });

		// Create a container for the chart.
		const chartContainer = container.createDiv({ cls: "chart-container" });

		// Parse Daily Notes (e.g., habit counts, tag counts).
		const chartData = await parseDailyNotes(this.plugin);

		// Prepare data for Chart.js.
		const data = {
			labels: chartData.labels,
			datasets: [
				{
					label: 'Habit Completion',
					data: chartData.habitData,
					backgroundColor: 'rgba(75, 192, 192, 0.6)',
				},
			],
		};

		// Initialize the chart.
		this.chartComponent = new ChartComponent(chartContainer, data, { responsive: true });
	}

	async onClose() {
		// Cleanup logic if needed.
	}
}
