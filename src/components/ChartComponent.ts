// ../components/ChartComponent.ts
import { Chart, registerables, ChartData, ChartOptions, ChartType } from 'chart.js';
Chart.register(...registerables);

export class ChartComponent {
	private chart: Chart | null = null;
	private canvas: HTMLCanvasElement;

	constructor(container: HTMLElement, data: ChartData, options?: ChartOptions, chartType: ChartType = 'bar') {
		// Create and append a canvas element for the chart.
		this.canvas = document.createElement('canvas');
		container.appendChild(this.canvas);
		this.initializeChart(data, options, chartType);
	}

	private initializeChart(data: ChartData, options: ChartOptions | undefined, chartType: ChartType) {
		const ctx = this.canvas.getContext('2d');
		if (ctx) {
			this.chart = new Chart(ctx, {
				type: chartType,
				data: data,
				options: options || {},
			});
		}
	}

	public updateData(data: ChartData) {
		if (this.chart) {
			this.chart.data = data;
			this.chart.update();
		}
	}
}
