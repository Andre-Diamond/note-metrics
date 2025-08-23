// ../src/views/DashboardView.ts
import { ItemView, WorkspaceLeaf, Plugin, Notice } from 'obsidian';
import { ChartComponent } from '../components/ChartComponent';
import { getAvailablePeriods, parsePeriodNotes } from '../data/dataParser';

export const VIEW_TYPE_DASHBOARD = "dashboard-view";

export class DashboardView extends ItemView {
	plugin: any; // NoteMetricsPlugin instance

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	getIcon(): string {
		return "bar-chart";
	}

	getDisplayText(): string {
		return "Daily note dashboard";
	}

	async onOpen() {
		// Assuming containerEl.children[1] is the main content container.
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl('h2', { text: "Daily note dashboard" });

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
		const refreshButton = container.createEl('button', { text: 'Refresh data' });
		refreshButton.addClass('refresh-button');
		refreshButton.addEventListener('click', async () => {
			await updateCharts();
			new Notice('Dashboard refreshed!');
		});

		// Single container for all charts that will be ordered
		const chartsContainer = container.createDiv({ cls: "charts-container" });

		// Function to update charts based on the selected period.
		const updateCharts = async () => {
			chartsContainer.empty();

			const periodType = periodTypeSelector.value as 'weekly' | 'monthly' | 'yearly';
			const periodKey = periodSelector.value;
			const periodData = await parsePeriodNotes(this.plugin, periodType, periodKey);



			// Define chart types with their render functions and order
			const pluginSettings = this.plugin.settings;

			const chartTypes = [
				{
					id: 'checkbox',
					order: pluginSettings?.checkboxChartsOrder || 1,
					enabled: pluginSettings?.showCheckboxCharts !== false, // Default to true if not explicitly disabled
					render: () => renderCheckboxCharts(periodData, periodType, chartsContainer, this.plugin)
				},
				{
					id: 'tag',
					order: pluginSettings?.tagChartsOrder || 2,
					enabled: pluginSettings?.showTagCharts !== false, // Default to true if not explicitly disabled
					render: () => renderTagCharts(periodData, periodType, chartsContainer)
				},
				{
					id: 'group',
					order: pluginSettings?.groupTagsChartOrder || 3,
					enabled: pluginSettings?.showGroupTagsChart !== false, // Default to true if not explicitly disabled
					render: () => renderGroupTagsChart(periodData, periodType, chartsContainer)
				},
				{
					id: 'emoji',
					order: pluginSettings?.emojiTagsChartOrder || 4,
					enabled: pluginSettings?.showEmojiTagsChart !== false, // Default to true if not explicitly disabled
					render: () => renderEmojiTagsChart(periodData, periodType, chartsContainer)
				},
				{
					id: 'single',
					order: pluginSettings?.singleTagsChartOrder || 5,
					enabled: pluginSettings?.showSingleTagsChart !== false, // Default to true if not explicitly disabled
					render: () => renderSingleTagsChart(periodData, periodType, chartsContainer)
				}
			];



			// Sort charts by order and render enabled ones
			const enabledCharts = chartTypes.filter(chart => chart.enabled);

			// Sort by order first, then by original array position to maintain consistent ordering for same-order charts
			const sortedCharts = enabledCharts.sort((a, b) => {
				if (a.order !== b.order) {
					return a.order - b.order;
				}
				// If orders are the same, maintain the original order from the chartTypes array
				return chartTypes.indexOf(a) - chartTypes.indexOf(b);
			});



			sortedCharts.forEach(chart => {
				chart.render();
			});
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

// Chart rendering functions
function renderCheckboxCharts(periodData: any, periodType: string, container: HTMLElement, plugin: any) {
	const headingCheckboxHabits = periodData.headingCheckboxHabits || {};
	const settingsHeadings: string[] = plugin?.settings?.headings || [];

	for (const heading of settingsHeadings) {
		const habits = Object.keys(headingCheckboxHabits[heading] || {}).sort((a, b) => a.localeCompare(b));
		if (habits.length === 0) continue;

		const chartDiv = container.createDiv({ cls: "chart-container checkbox-chart-container" });
		chartDiv.createEl('h3', { text: heading.replace(/^#+\s*/, '') });

		if (periodType === 'weekly') {
			const subPeriods = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
			const datasets = subPeriods.map((subPeriod) => ({
				label: subPeriod,
				data: habits.map(habit => {
					const value = periodData.hierarchicalData?.headingCheckboxHabits?.[heading]?.[habit]?.[subPeriod];
					return value !== undefined ? value : 0;
				}),
				backgroundColor: 'rgba(147, 112, 219, 0.8)',
				borderColor: 'rgba(147, 112, 219, 1)',
				borderWidth: 2,
				borderRadius: 4,
				barThickness: 20
			}));
			const checkboxChartData = {
				labels: habits,
				datasets: datasets,
			};
			new ChartComponent(chartDiv, checkboxChartData, {
				responsive: true,
				scales: {
					x: { stacked: true },
					y: { stacked: true }
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							title: function (context: any[]) {
								const index = context[0].dataIndex;
								const labelName = context[0].chart.data.labels?.[index] as string;
								let total = 0;
								context[0].chart.data.datasets.forEach((dataset: any) => {
									const data = dataset.data[index] as number;
									if (data) total += data;
								});
								return [`${labelName} (Total: ${total})`];
							},
							label: function (context: any) {
								return `${context.dataset.label}: ${context.raw}`;
							}
						}
					}
				},
				barPercentage: 0.6
			});
		} else if (periodType === 'yearly') {
			const subPeriods = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const datasets = subPeriods.map((subPeriod, index) => ({
				label: monthNames[index],
				data: habits.map(habit => periodData.hierarchicalData?.headingCheckboxHabits?.[heading]?.[habit]?.[subPeriod] || 0),
				backgroundColor: 'rgba(147, 112, 219, 0.8)',
				borderColor: 'rgba(147, 112, 219, 1)',
				borderWidth: 2,
				borderRadius: 4,
				barThickness: 20
			}));
			const checkboxChartData = {
				labels: habits,
				datasets: datasets,
			};
			new ChartComponent(chartDiv, checkboxChartData, {
				responsive: true,
				scales: {
					x: { stacked: true },
					y: { stacked: true }
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							title: function (context: any[]) {
								const index = context[0].dataIndex;
								const labelName = context[0].chart.data.labels?.[index] as string;
								let total = 0;
								context[0].chart.data.datasets.forEach((dataset: any) => {
									const data = dataset.data[index] as number;
									if (data) total += data;
								});
								return [`${labelName} (Total: ${total})`];
							},
							label: function (context: any) {
								return `${context.dataset.label}: ${context.raw}`;
							}
						}
					}
				},
				barPercentage: 0.6
			});
		} else if (periodType === 'monthly') {
			const subPeriods = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
			const datasets = subPeriods.map((subPeriod) => ({
				label: subPeriod,
				data: habits.map(habit => periodData.hierarchicalData?.headingCheckboxHabits?.[heading]?.[habit]?.[subPeriod] || 0),
				backgroundColor: 'rgba(147, 112, 219, 0.8)',
				borderColor: 'rgba(147, 112, 219, 1)',
				borderWidth: 2,
				borderRadius: 4,
				barThickness: 20
			}));
			const checkboxChartData = {
				labels: habits,
				datasets: datasets,
			};
			new ChartComponent(chartDiv, checkboxChartData, {
				responsive: true,
				scales: {
					x: { stacked: true },
					y: { stacked: true }
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							title: function (context: any[]) {
								const index = context[0].dataIndex;
								const labelName = context[0].chart.data.labels?.[index] as string;
								let total = 0;
								context[0].chart.data.datasets.forEach((dataset: any) => {
									const data = dataset.data[index] as number;
									if (data) total += data;
								});
								return [`${labelName} (Total: ${total})`];
							},
							label: function (context: any) {
								return `${context.dataset.label}: ${context.raw}`;
							}
						}
					}
				},
				barPercentage: 0.6
			});
		}
	}
}

function renderTagCharts(periodData: any, periodType: string, container: HTMLElement) {
	for (const group in periodData.tagData) {
		const groupData = periodData.tagData[group];
		const groupChartDiv = container.createDiv({ cls: "chart-container tag-charts-container" });
		groupChartDiv.createEl('h3', { text: `${group} tags` });
		const items = Object.keys(groupData).sort((a, b) => a.localeCompare(b));

		if (periodType === 'weekly') {
			const subPeriods = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
			const datasets = subPeriods.map((subPeriod) => ({
				label: subPeriod,
				data: items.map(item => {
					const value = periodData.hierarchicalData?.tagData[group]?.[item]?.[subPeriod];
					return value !== undefined ? value : 0;
				}),
				backgroundColor: 'rgba(64, 224, 208, 0.8)',
				borderColor: 'rgba(64, 224, 208, 1)',
				borderWidth: 2,
				borderRadius: 4,
				barThickness: 20
			}));

			const tagChartData = {
				labels: items,
				datasets: datasets,
			};
			new ChartComponent(groupChartDiv, tagChartData, {
				responsive: true,
				scales: {
					x: { stacked: true },
					y: { stacked: true }
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							title: function (context: any[]) {
								const index = context[0].dataIndex;
								const labelName = context[0].chart.data.labels?.[index] as string;
								let total = 0;
								context[0].chart.data.datasets.forEach((dataset: any) => {
									const data = dataset.data[index] as number;
									if (data) total += data;
								});
								return [`${labelName} (Total: ${total})`];
							},
							label: function (context: any) {
								return `${context.dataset.label}: ${context.raw}`;
							}
						}
					}
				},
				barPercentage: 0.6
			});
		} else if (periodType === 'yearly') {
			const subPeriods = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const datasets = subPeriods.map((subPeriod, index) => ({
				label: monthNames[index],
				data: items.map(item => periodData.hierarchicalData?.tagData[group]?.[item]?.[subPeriod] || 0),
				backgroundColor: 'rgba(64, 224, 208, 0.8)',
				borderColor: 'rgba(64, 224, 208, 1)',
				borderWidth: 2,
				borderRadius: 4,
				barThickness: 20
			}));

			const tagChartData = {
				labels: items,
				datasets: datasets,
			};
			new ChartComponent(groupChartDiv, tagChartData, {
				responsive: true,
				scales: {
					x: { stacked: true },
					y: { stacked: true }
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							title: function (context: any[]) {
								const index = context[0].dataIndex;
								const labelName = context[0].chart.data.labels?.[index] as string;
								let total = 0;
								context[0].chart.data.datasets.forEach((dataset: any) => {
									const data = dataset.data[index] as number;
									if (data) total += data;
								});
								return [`${labelName} (Total: ${total})`];
							},
							label: function (context: any) {
								return `${context.dataset.label}: ${context.raw}`;
							}
						}
					}
				},
				barPercentage: 0.6
			});
		} else if (periodType === 'monthly') {
			const subPeriods = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
			const datasets = subPeriods.map((subPeriod) => ({
				label: subPeriod,
				data: items.map(item => periodData.hierarchicalData?.tagData[group]?.[item]?.[subPeriod] || 0),
				backgroundColor: 'rgba(64, 224, 208, 0.8)',
				borderColor: 'rgba(64, 224, 208, 1)',
				borderWidth: 2,
				borderRadius: 4,
				barThickness: 20
			}));

			const tagChartData = {
				labels: items,
				datasets: datasets,
			};
			new ChartComponent(groupChartDiv, tagChartData, {
				responsive: true,
				scales: {
					x: { stacked: true },
					y: { stacked: true }
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							title: function (context: any[]) {
								const index = context[0].dataIndex;
								const labelName = context[0].chart.data.labels?.[index] as string;
								let total = 0;
								context[0].chart.data.datasets.forEach((dataset: any) => {
									const data = dataset.data[index] as number;
									if (data) total += data;
								});
								return [`${labelName} (Total: ${total})`];
							},
							label: function (context: any) {
								return `${context.dataset.label}: ${context.raw}`;
							}
						}
					}
				},
				barPercentage: 0.6
			});
		}
	}
}

function renderGroupTagsChart(periodData: any, periodType: string, container: HTMLElement) {
	if (Object.keys(periodData.groupTagCounts).length === 0) return;

	const chartDiv = container.createDiv({ cls: "chart-container group-chart-container" });
	chartDiv.createEl('h3', { text: "Group tags" });
	const groups = Object.keys(periodData.groupTagCounts).sort((a, b) => a.localeCompare(b));

	if (periodType === 'weekly') {
		const subPeriods = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
		const datasets = subPeriods.map((subPeriod) => ({
			label: subPeriod,
			data: groups.map(group => {
				const value = periodData.hierarchicalData?.groupTagCounts[group]?.[subPeriod];
				return value !== undefined ? value : 0;
			}),
			backgroundColor: 'rgba(147, 112, 219, 0.8)',
			borderColor: 'rgba(147, 112, 219, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const groupChartData = {
			labels: groups,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, groupChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	} else if (periodType === 'yearly') {
		const subPeriods = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
		const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const datasets = subPeriods.map((subPeriod, index) => ({
			label: monthNames[index],
			data: groups.map(group => periodData.hierarchicalData?.groupTagCounts[group]?.[subPeriod] || 0),
			backgroundColor: 'rgba(147, 112, 219, 0.8)',
			borderColor: 'rgba(147, 112, 219, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const groupChartData = {
			labels: groups,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, groupChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	} else if (periodType === 'monthly') {
		const subPeriods = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
		const datasets = subPeriods.map((subPeriod) => ({
			label: subPeriod,
			data: groups.map(group => periodData.hierarchicalData?.groupTagCounts[group]?.[subPeriod] || 0),
			backgroundColor: 'rgba(147, 112, 219, 0.8)',
			borderColor: 'rgba(147, 112, 219, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const groupChartData = {
			labels: groups,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, groupChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	}
}

function renderSingleTagsChart(periodData: any, periodType: string, container: HTMLElement) {
	if (Object.keys(periodData.singleTags).length === 0) {
		return;
	}

	const chartDiv = container.createDiv({ cls: "chart-container single-tags-container" });
	chartDiv.createEl('h3', { text: "Single tags" });
	const tags = Object.keys(periodData.singleTags).sort((a, b) => a.localeCompare(b));

	if (periodType === 'weekly') {
		const subPeriods = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
		const datasets = subPeriods.map((subPeriod) => ({
			label: subPeriod,
			data: tags.map(tag => {
				const value = periodData.hierarchicalData?.singleTags[tag]?.[subPeriod];
				return value !== undefined ? value : 0;
			}),
			backgroundColor: 'rgba(255, 99, 132, 0.8)',
			borderColor: 'rgba(255, 99, 132, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const singleTagsChartData = {
			labels: tags,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, singleTagsChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	} else if (periodType === 'yearly') {
		const subPeriods = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
		const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const datasets = subPeriods.map((subPeriod, index) => ({
			label: monthNames[index],
			data: tags.map(tag => periodData.hierarchicalData?.singleTags[tag]?.[subPeriod] || 0),
			backgroundColor: 'rgba(255, 99, 132, 0.8)',
			borderColor: 'rgba(255, 99, 132, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const singleTagsChartData = {
			labels: tags,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, singleTagsChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	} else if (periodType === 'monthly') {
		const subPeriods = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
		const datasets = subPeriods.map((subPeriod) => ({
			label: subPeriod,
			data: tags.map(tag => periodData.hierarchicalData?.singleTags[tag]?.[subPeriod] || 0),
			backgroundColor: 'rgba(255, 99, 132, 0.8)',
			borderColor: 'rgba(255, 99, 132, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const singleTagsChartData = {
			labels: tags,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, singleTagsChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	}
}

function renderEmojiTagsChart(periodData: any, periodType: string, container: HTMLElement) {
	if (Object.keys(periodData.emojiTags).length === 0) {
		return;
	}

	const chartDiv = container.createDiv({ cls: "chart-container emoji-tags-container" });
	chartDiv.createEl('h3', { text: "Emoji tags" });

	const emojis = Object.keys(periodData.emojiTags).sort((a, b) => a.localeCompare(b));

	if (periodType === 'weekly') {
		const subPeriods = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
		const datasets = subPeriods.map((subPeriod) => ({
			label: subPeriod,
			data: emojis.map(emoji => {
				const value = periodData.hierarchicalData?.emojiTags[emoji]?.[subPeriod];
				return value !== undefined ? value : 0;
			}),
			backgroundColor: 'rgba(54, 162, 235, 0.8)',
			borderColor: 'rgba(54, 162, 235, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const emojiTagsChartData = {
			labels: emojis,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, emojiTagsChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	} else if (periodType === 'yearly') {
		const subPeriods = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
		const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const datasets = subPeriods.map((subPeriod, index) => ({
			label: monthNames[index],
			data: emojis.map(emoji => periodData.hierarchicalData?.emojiTags[emoji]?.[subPeriod] || 0),
			backgroundColor: 'rgba(54, 162, 235, 0.8)',
			borderColor: 'rgba(54, 162, 235, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const emojiTagsChartData = {
			labels: emojis,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, emojiTagsChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	} else if (periodType === 'monthly') {
		const subPeriods = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
		const datasets = subPeriods.map((subPeriod) => ({
			label: subPeriod,
			data: emojis.map(emoji => periodData.hierarchicalData?.emojiTags[emoji]?.[subPeriod] || 0),
			backgroundColor: 'rgba(54, 162, 235, 0.8)',
			borderColor: 'rgba(54, 162, 235, 1)',
			borderWidth: 2,
			borderRadius: 4,
			barThickness: 20
		}));

		const emojiTagsChartData = {
			labels: emojis,
			datasets: datasets,
		};
		new ChartComponent(chartDiv, emojiTagsChartData, {
			responsive: true,
			scales: {
				x: { stacked: true },
				y: { stacked: true }
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: function (context: any[]) {
							const index = context[0].dataIndex;
							const labelName = context[0].chart.data.labels?.[index] as string;
							let total = 0;
							context[0].chart.data.datasets.forEach((dataset: any) => {
								const data = dataset.data[index] as number;
								if (data) total += data;
							});
							return [`${labelName} (Total: ${total})`];
						},
						label: function (context: any) {
							return `${context.dataset.label}: ${context.raw}`;
						}
					}
				}
			},
			barPercentage: 0.6
		});
	}
}
