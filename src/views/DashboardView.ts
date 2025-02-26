// ../src/views/DashboardView.ts
import { ItemView, WorkspaceLeaf, Plugin, Notice } from 'obsidian';
import { ChartComponent } from '../components/ChartComponent';
import { getAvailablePeriods, parsePeriodNotes } from '../data/dataParser';

export const VIEW_TYPE_DASHBOARD = "dashboard-view";

export class DashboardView extends ItemView {
	plugin: Plugin;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	getDisplayText(): string {
		return "Daily Note Dashboard";
	}

	async onOpen() {
		// Assuming containerEl.children[1] is the main content container.
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl('h2', { text: "Daily Note Dashboard" });

		// Create a dropdown for period type selection.
		const periodTypeSelector = container.createEl('select', { cls: 'period-type-selector' });
		(['weekly', 'monthly', 'yearly'] as const).forEach(type => {
			const option = periodTypeSelector.createEl('option', { text: type });
			option.value = type;
		});
		periodTypeSelector.value = 'weekly';

		// Create a second dropdown for selecting the specific period.
		const periodSelector = container.createEl('select', { cls: 'period-selector' });

		// Populate periodSelector based on the selected period type.
		const populatePeriodSelector = async () => {
			periodSelector.empty();
			const periodType = periodTypeSelector.value as 'weekly' | 'monthly' | 'yearly';
			const availablePeriods = await getAvailablePeriods(this.plugin, periodType);
			availablePeriods.forEach(period => {
				const option = periodSelector.createEl('option', { text: period });
				option.value = period;
			});
			if (availablePeriods.length > 0) {
				periodSelector.value = availablePeriods[availablePeriods.length - 1];
			}
		};

		await populatePeriodSelector();

		// **** Refresh Button ****
		const refreshButton = container.createEl('button', { text: 'Refresh Data' });
		refreshButton.addClass('refresh-button');
		refreshButton.addEventListener('click', async () => {
			await updateCharts();
			new Notice('Dashboard refreshed!');
		});

		// Containers for the charts.
		const checkboxChartContainer = container.createDiv({ cls: "checkbox-chart-container" });
		const tagChartsContainer = container.createDiv({ cls: "tag-charts-container" });
		const groupChartContainer = container.createDiv({ cls: "group-chart-container" });

		// Function to update charts based on the selected period.
		const updateCharts = async () => {
			checkboxChartContainer.empty();
			tagChartsContainer.empty();
			groupChartContainer.empty();

			const periodType = periodTypeSelector.value as 'weekly' | 'monthly' | 'yearly';
			const periodKey = periodSelector.value;
			const periodData = await parsePeriodNotes(this.plugin, periodType, periodKey);

			// Checkbox Habit Chart: Grouped by habit (only if data exists).
			const habits = Object.keys(periodData.checkboxHabits).sort((a, b) => a.localeCompare(b));
			if (habits.length > 0) {
				const counts = habits.map(habit => periodData.checkboxHabits[habit]);
				const checkboxChartData = {
					labels: habits,
					datasets: [{
						label: 'Checkbox Habit Completions',
						data: counts,
						backgroundColor: 'rgba(153, 102, 255, 0.6)',
					}],
				};
				new ChartComponent(checkboxChartContainer, checkboxChartData, { responsive: true });
			}

			// Create a chart for each tag group (for combo tags).
			for (const group in periodData.tagData) {
				const groupData = periodData.tagData[group];
				const groupChartDiv = tagChartsContainer.createDiv({ cls: "chart-container" });
				groupChartDiv.createEl('h3', { text: `${group} tags` });
				const items = Object.keys(groupData).sort((a, b) => a.localeCompare(b));
				const itemCounts = items.map(item => groupData[item]);
				const tagChartData = {
					labels: items,
					datasets: [{
						label: `${group} Tag Counts`,
						data: itemCounts,
						backgroundColor: 'rgba(75, 192, 192, 0.6)',
					}],
				};
				new ChartComponent(groupChartDiv, tagChartData, { responsive: true });
			}

			// **New Group Tags Chart**: Aggregate plain and combo tags.
			if (Object.keys(periodData.groupTagCounts).length > 0) {
				groupChartContainer.createEl('h3', { text: "Group Tags" });
				const groups = Object.keys(periodData.groupTagCounts).sort((a, b) => a.localeCompare(b));
				const groupCounts = groups.map(group => periodData.groupTagCounts[group]);
				const groupChartData = {
					labels: groups,
					datasets: [{
						label: 'Group Tag Counts',
						data: groupCounts,
						backgroundColor: 'rgba(255, 159, 64, 0.6)',
					}],
				};
				new ChartComponent(groupChartContainer, groupChartData, { responsive: true });
			}
		};

		// Initial chart load.
		await updateCharts();

		// Update charts when either dropdown changes.
		periodTypeSelector.addEventListener('change', async () => {
			await populatePeriodSelector();
			await updateCharts();
		});
		periodSelector.addEventListener('change', async () => {
			await updateCharts();
		});
	}

	async onClose() {
		// Cleanup if needed.
	}
}
