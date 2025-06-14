// ../src/views/DashboardView.ts
import { ItemView, WorkspaceLeaf, Plugin, Notice } from 'obsidian';
import { ChartComponent } from '../components/ChartComponent';
import { getAvailablePeriods, parsePeriodNotes } from '../data/dataParser';
import { TooltipItem } from 'chart.js';

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

			// Render checkbox charts in the order of headings from settings
			const headingCheckboxHabits = periodData.headingCheckboxHabits || {};
			const settingsHeadings: string[] = (this.plugin as any).settings?.headings || [];
			for (const heading of settingsHeadings) {
				const habits = Object.keys(headingCheckboxHabits[heading] || {}).sort((a, b) => a.localeCompare(b));
				if (habits.length === 0) continue;
				checkboxChartContainer.createEl('h3', { text: heading.replace(/^#+\s*/, '') });

				if (periodType === 'weekly') {
					const subPeriods = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
					const datasets = subPeriods.map((subPeriod) => ({
						label: subPeriod,
						data: habits.map(habit => {
							const value = periodData.hierarchicalData?.checkboxHabits[habit]?.[subPeriod];
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
					new ChartComponent(checkboxChartContainer, checkboxChartData, {
						responsive: true,
						scales: {
							x: { stacked: true },
							y: { stacked: true }
						},
						plugins: {
							legend: { display: false },
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) total += data;
										});
										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
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
						data: habits.map(habit => periodData.hierarchicalData?.checkboxHabits[habit]?.[subPeriod] || 0),
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
					new ChartComponent(checkboxChartContainer, checkboxChartData, {
						responsive: true,
						scales: {
							x: { stacked: true },
							y: { stacked: true }
						},
						plugins: {
							legend: { display: false },
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) total += data;
										});
										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
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
						data: habits.map(habit => periodData.hierarchicalData?.checkboxHabits[habit]?.[subPeriod] || 0),
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
					new ChartComponent(checkboxChartContainer, checkboxChartData, {
						responsive: true,
						scales: {
							x: { stacked: true },
							y: { stacked: true }
						},
						plugins: {
							legend: { display: false },
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) total += data;
										});
										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
										return `${context.dataset.label}: ${context.raw}`;
									}
								}
							}
						},
						barPercentage: 0.6
					});
				}
			}

			// Create a chart for each tag group (for combo tags).
			for (const group in periodData.tagData) {
				const groupData = periodData.tagData[group];
				const groupChartDiv = tagChartsContainer.createDiv({ cls: "chart-container" });
				groupChartDiv.createEl('h3', { text: `${group} tags` });
				const items = Object.keys(groupData).sort((a, b) => a.localeCompare(b));

				if (periodType === 'weekly') {
					// Stacked bar chart for weekly view showing daily data
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
							legend: {
								display: false
							},
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;

										// Get the total across all sub-periods for this label
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) {
												total += data;
											}
										});

										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
										return `${context.dataset.label}: ${context.raw}`;
									}
								}
							}
						},
						barPercentage: 0.6
					});
				} else if (periodType === 'yearly') {
					// Stacked bar chart for yearly view
					const subPeriods = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
					const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

					const datasets = subPeriods.map((subPeriod, index) => ({
						label: monthNames[index],
						data: items.map(item =>
							periodData.hierarchicalData?.tagData[group]?.[item]?.[subPeriod] || 0
						),
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
							legend: {
								display: false
							},
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;

										// Get the total across all sub-periods for this label
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) {
												total += data;
											}
										});

										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
										return `${context.dataset.label}: ${context.raw}`;
									}
								}
							}
						},
						barPercentage: 0.6
					});
				} else {
					// Stacked bar chart for monthly/yearly view
					const subPeriods = periodType === 'monthly'
						? ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']
						: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

					const datasets = subPeriods.map((subPeriod, index) => ({
						label: subPeriod,
						data: items.map(item =>
							periodData.hierarchicalData?.tagData[group]?.[item]?.[subPeriod] || 0
						),
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
							legend: {
								display: false
							},
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;

										// Get the total across all sub-periods for this label
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) {
												total += data;
											}
										});

										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
										return `${context.dataset.label}: ${context.raw}`;
									}
								}
							}
						},
						barPercentage: 0.6
					});
				}
			}

			// Group Tags Chart
			if (Object.keys(periodData.groupTagCounts).length > 0) {
				groupChartContainer.createEl('h3', { text: "Group tags" });
				const groups = Object.keys(periodData.groupTagCounts).sort((a, b) => a.localeCompare(b));

				if (periodType === 'weekly') {
					// Stacked bar chart for weekly view showing daily data
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
					new ChartComponent(groupChartContainer, groupChartData, {
						responsive: true,
						scales: {
							x: { stacked: true },
							y: { stacked: true }
						},
						plugins: {
							legend: {
								display: false
							},
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;

										// Get the total across all sub-periods for this label
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) {
												total += data;
											}
										});

										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
										return `${context.dataset.label}: ${context.raw}`;
									}
								}
							}
						},
						barPercentage: 0.6
					});
				} else if (periodType === 'yearly') {
					// Stacked bar chart for yearly view
					const subPeriods = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
					const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

					const datasets = subPeriods.map((subPeriod, index) => ({
						label: monthNames[index],
						data: groups.map(group =>
							periodData.hierarchicalData?.groupTagCounts[group]?.[subPeriod] || 0
						),
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
					new ChartComponent(groupChartContainer, groupChartData, {
						responsive: true,
						scales: {
							x: { stacked: true },
							y: { stacked: true }
						},
						plugins: {
							legend: {
								display: false
							},
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;

										// Get the total across all sub-periods for this label
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) {
												total += data;
											}
										});

										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
										return `${context.dataset.label}: ${context.raw}`;
									}
								}
							}
						},
						barPercentage: 0.6
					});
				} else {
					// Stacked bar chart for monthly/yearly view
					const subPeriods = periodType === 'monthly'
						? ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']
						: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

					const datasets = subPeriods.map((subPeriod, index) => ({
						label: subPeriod,
						data: groups.map(group =>
							periodData.hierarchicalData?.groupTagCounts[group]?.[subPeriod] || 0
						),
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
					new ChartComponent(groupChartContainer, groupChartData, {
						responsive: true,
						scales: {
							x: { stacked: true },
							y: { stacked: true }
						},
						plugins: {
							legend: {
								display: false
							},
							tooltip: {
								callbacks: {
									title: function (context: TooltipItem<'bar'>[]) {
										const index = context[0].dataIndex;
										const labelName = context[0].chart.data.labels?.[index] as string;

										// Get the total across all sub-periods for this label
										let total = 0;
										context[0].chart.data.datasets.forEach(dataset => {
											const data = dataset.data[index] as number;
											if (data) {
												total += data;
											}
										});

										return [`${labelName} (Total: ${total})`];
									},
									label: function (context: TooltipItem<'bar'>) {
										return `${context.dataset.label}: ${context.raw}`;
									}
								}
							}
						},
						barPercentage: 0.6
					});
				}
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
