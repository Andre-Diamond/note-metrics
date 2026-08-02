// ../src/components/HeatmapComponent.ts

export interface HeatmapOptions {
	title?: string;
	periodType: 'weekly' | 'monthly' | 'yearly';
	periodKey: string;
	dates: string[];
	dailyActivity: { [date: string]: number };
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Renders a GitHub-style activity heatmap for daily checkbox completions.
 */
export class HeatmapComponent {
	constructor(container: HTMLElement, options: HeatmapOptions) {
		const wrapper = container.createDiv({ cls: 'heatmap-wrapper' });
		wrapper.createEl('h3', { text: options.title || 'Activity heatmap' });

		const maxCount = Math.max(0, ...Object.values(options.dailyActivity));
		const totalCompletions = Object.values(options.dailyActivity).reduce((sum, n) => sum + n, 0);
		const activeDays = Object.values(options.dailyActivity).filter(n => n > 0).length;

		const summary = wrapper.createDiv({ cls: 'heatmap-summary' });
		summary.createSpan({ text: `${totalCompletions} completions` });
		summary.createSpan({ text: ' · ' });
		summary.createSpan({ text: `${activeDays} active days` });

		const scroll = wrapper.createDiv({ cls: 'heatmap-scroll' });
		const grid = scroll.createDiv({ cls: 'heatmap-grid' });

		if (options.periodType === 'yearly') {
			this.renderYearlyGrid(grid, options, maxCount);
		} else if (options.periodType === 'monthly') {
			this.renderMonthlyGrid(grid, options, maxCount);
		} else {
			this.renderWeeklyGrid(grid, options, maxCount);
		}

		const legend = wrapper.createDiv({ cls: 'heatmap-legend' });
		legend.createSpan({ text: 'Less', cls: 'heatmap-legend-label' });
		for (let level = 0; level <= 4; level++) {
			const cell = legend.createDiv({ cls: `heatmap-cell heatmap-level-${level}` });
			cell.setAttr('aria-hidden', 'true');
		}
		legend.createSpan({ text: 'More', cls: 'heatmap-legend-label' });
	}

	private renderWeeklyGrid(
		grid: HTMLElement,
		options: HeatmapOptions,
		maxCount: number
	) {
		grid.addClass('heatmap-grid-weekly');

		const labelsRow = grid.createDiv({ cls: 'heatmap-day-labels' });
		DAY_LABELS.forEach(label => {
			labelsRow.createDiv({ cls: 'heatmap-day-label', text: label });
		});

		const cellsRow = grid.createDiv({ cls: 'heatmap-cells-row' });
		options.dates.forEach(dateKey => {
			this.createCell(cellsRow, dateKey, options.dailyActivity[dateKey] || 0, maxCount);
		});
	}

	private renderMonthlyGrid(
		grid: HTMLElement,
		options: HeatmapOptions,
		maxCount: number
	) {
		grid.addClass('heatmap-grid-monthly');

		const firstDate = new Date(options.dates[0] + 'T00:00:00');
		// Monday-based index: Mon=0 ... Sun=6
		const startOffset = (firstDate.getDay() + 6) % 7;

		const calendar = grid.createDiv({ cls: 'heatmap-calendar' });

		DAY_LABELS.forEach(label => {
			calendar.createDiv({ cls: 'heatmap-day-label', text: label });
		});

		for (let i = 0; i < startOffset; i++) {
			calendar.createDiv({ cls: 'heatmap-cell heatmap-empty' });
		}

		options.dates.forEach(dateKey => {
			this.createCell(calendar, dateKey, options.dailyActivity[dateKey] || 0, maxCount);
		});
	}

	private renderYearlyGrid(
		grid: HTMLElement,
		options: HeatmapOptions,
		maxCount: number
	) {
		grid.addClass('heatmap-grid-yearly');

		const firstDate = new Date(options.dates[0] + 'T00:00:00');
		const startOffset = (firstDate.getDay() + 6) % 7; // Mon=0

		// Pad so the first column starts on Monday of the week containing Jan 1
		const paddedDates: (string | null)[] = [];
		for (let i = 0; i < startOffset; i++) {
			paddedDates.push(null);
		}
		options.dates.forEach(d => paddedDates.push(d));
		while (paddedDates.length % 7 !== 0) {
			paddedDates.push(null);
		}

		const weekCount = paddedDates.length / 7;

		// Month labels row
		const monthRow = grid.createDiv({ cls: 'heatmap-month-labels' });
		monthRow.createDiv({ cls: 'heatmap-day-label-spacer' });
		let lastMonth = -1;
		for (let week = 0; week < weekCount; week++) {
			const dateInWeek = paddedDates[week * 7 + 0]
				|| paddedDates[week * 7 + 1]
				|| paddedDates[week * 7 + 2]
				|| paddedDates[week * 7 + 3]
				|| paddedDates[week * 7 + 4]
				|| paddedDates[week * 7 + 5]
				|| paddedDates[week * 7 + 6];
			const labelEl = monthRow.createDiv({ cls: 'heatmap-month-label' });
			if (dateInWeek) {
				const month = new Date(dateInWeek + 'T00:00:00').getMonth();
				if (month !== lastMonth) {
					labelEl.setText(MONTH_LABELS[month]);
					lastMonth = month;
				}
			}
		}

		const body = grid.createDiv({ cls: 'heatmap-year-body' });

		// Day labels + week columns
		const dayLabelsCol = body.createDiv({ cls: 'heatmap-day-labels-col' });
		DAY_LABELS.forEach((label, idx) => {
			const el = dayLabelsCol.createDiv({ cls: 'heatmap-day-label' });
			// Show only Mon/Wed/Fri to reduce clutter
			if (idx % 2 === 0) {
				el.setText(label);
			}
		});

		const weeksContainer = body.createDiv({ cls: 'heatmap-weeks' });
		for (let week = 0; week < weekCount; week++) {
			const weekCol = weeksContainer.createDiv({ cls: 'heatmap-week' });
			for (let day = 0; day < 7; day++) {
				const dateKey = paddedDates[week * 7 + day];
				if (!dateKey) {
					weekCol.createDiv({ cls: 'heatmap-cell heatmap-empty' });
				} else {
					this.createCell(weekCol, dateKey, options.dailyActivity[dateKey] || 0, maxCount);
				}
			}
		}
	}

	private createCell(
		parent: HTMLElement,
		dateKey: string,
		count: number,
		maxCount: number
	) {
		const level = this.getIntensityLevel(count, maxCount);
		const cell = parent.createDiv({ cls: `heatmap-cell heatmap-level-${level}` });
		const label = count === 1 ? 'completion' : 'completions';
		cell.setAttr('title', `${dateKey}: ${count} ${label}`);
		cell.setAttr('aria-label', `${dateKey}: ${count} ${label}`);
	}

	private getIntensityLevel(count: number, maxCount: number): number {
		if (count <= 0 || maxCount <= 0) return 0;
		const ratio = count / maxCount;
		if (ratio <= 0.25) return 1;
		if (ratio <= 0.5) return 2;
		if (ratio <= 0.75) return 3;
		return 4;
	}
}
