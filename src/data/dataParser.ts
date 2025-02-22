import { Plugin, TFile } from 'obsidian';

interface ChartData {
	labels: string[];
	habitData: number[];
}

export async function parseDailyNotes(plugin: Plugin): Promise<ChartData> {
	const vault = plugin.app.vault;
	// Adjust the folder path as needed.
	const files = vault.getFiles().filter((file: TFile) => file.path.startsWith("Daily Notes/") && file.path.endsWith(".md"));

	const labels: string[] = [];
	const habitData: number[] = [];

	// Loop through each file and extract data.
	for (const file of files) {
		const content = await vault.read(file);
		// Example: Count completed habits in the "Daily Habits" section.
		const habitSectionMatch = content.match(/## Daily Habits([\s\S]*?)(?:\n##|$)/);
		let completedCount = 0;
		if (habitSectionMatch && habitSectionMatch[1]) {
			const habitSection = habitSectionMatch[1];
			const matches = habitSection.match(/- \[x\]/g);
			completedCount = matches ? matches.length : 0;
		}
		labels.push(file.basename);
		habitData.push(completedCount);
	}

	return { labels, habitData };
}
