import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export class ChartComponent {
	private chart: Chart | null = null;
	private canvas: HTMLCanvasElement;

	constructor(container: HTMLElement, data: any, options?: any) {
		// Create and append a canvas element for the chart.
		this.canvas = document.createElement('canvas');
		container.appendChild(this.canvas);
		this.initializeChart(data, options);
	}

	private initializeChart(data: any, options: any) {
		const ctx = this.canvas.getContext('2d');
		if (ctx) {
			this.chart = new Chart(ctx, {
				type: 'bar', // Example: bar chart
				data: data,
				options: options || {},
			});
		}
	}

	public updateData(data: any) {
		if (this.chart) {
			this.chart.data = data;
			this.chart.update();
		}
	}
}
