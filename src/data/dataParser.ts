// ../src/data/dataParser.ts
import { Plugin, TFile } from 'obsidian';

export interface PeriodChartData {
	// For checkboxes: keys are habit names and values are counts.
	checkboxHabits: { [habit: string]: number };
	// For tags: keys are group names (e.g. habit, goal, work), with each value mapping tag item → count.
	tagData: { [group: string]: { [tagItem: string]: number } };
	// New: Aggregate counts for group tags (plain and combo)
	groupTagCounts: { [group: string]: number };
}

// Helper: parse a date from a filename assuming "YYYY-MM-DD" at the beginning.
function parseDateFromFilename(filename: string): Date | null {
	const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
	if (match) {
		const date = new Date(match[1]);
		if (!isNaN(date.getTime())) {
			return date;
		}
	}
	return null;
}

/**
 * Gets the file date by first checking the filename; if not found, uses the file's creation time.
 * @param file The TFile object.
 * @returns A Date representing either the parsed date from the filename or the file's creation date.
 */
function getFileDate(file: TFile): Date {
	const parsedDate = parseDateFromFilename(file.basename);
	return parsedDate || new Date(file.stat.ctime);
}

/**
 * Aggregates daily note data for a given period.
 * @param plugin The plugin instance.
 * @param periodType 'weekly', 'monthly', or 'yearly'
 * @param periodKey For weekly: a Monday date string ("YYYY-MM-DD"); for monthly: "YYYY-MM"; for yearly: "YYYY"
 * @returns PeriodChartData with aggregated checkbox habit counts and tag counts.
 */
export async function parsePeriodNotes(
	plugin: Plugin,
	periodType: 'weekly' | 'monthly' | 'yearly',
	periodKey: string
): Promise<PeriodChartData> {
	const vault = plugin.app.vault;
	// Retrieve folders from the plugin settings (fallback to Daily Notes if not set)
	const folders: string[] = (plugin as any).settings?.folders || ['Daily Notes'];

	// Filter files that are in one of the specified folders and end with ".md"
	const files = vault.getFiles().filter((file: TFile) =>
		folders.some(folder => file.path.startsWith(`${folder}/`)) && file.path.endsWith(".md")
	);

	const checkboxHabits: { [habit: string]: number } = {};
	const tagData: { [group: string]: { [tagItem: string]: number } } = {};
	const groupTagCounts: { [group: string]: number } = {};

	for (const file of files) {
		// Use getFileDate to get the file's date (either from filename or creation time)
		const fileDate = getFileDate(file);
		if (!fileDate) continue;

		let include = false;
		if (periodType === 'weekly') {
			// periodKey is a Monday string.
			const monday = new Date(periodKey);
			const sunday = new Date(monday);
			sunday.setDate(monday.getDate() + 6);
			include = fileDate >= monday && fileDate <= sunday;
		} else if (periodType === 'monthly') {
			// periodKey is "YYYY-MM"
			const fileMonth = fileDate.toISOString().slice(0, 7);
			include = fileMonth === periodKey;
		} else if (periodType === 'yearly') {
			// periodKey is "YYYY"
			const fileYear = fileDate.getFullYear().toString();
			include = fileYear === periodKey;
		}

		if (!include) continue;

		const content = await vault.read(file);

		// Parse checkbox habits from the "## Daily Habits" section.
		const habitSectionMatch = content.match(/## Daily Habits([\s\S]*?)(?:\n##|$)/);
		if (habitSectionMatch && habitSectionMatch[1]) {
			const habitSection = habitSectionMatch[1];
			const lines = habitSection.split('\n');
			for (const line of lines) {
				const match = line.match(/- \[x\]\s*(.+)/);
				if (match) {
					let habitName = match[1].trim();
					// Normalize habit names ending with 'Task' followed by a number
					const taskMatch = habitName.match(/^(.*\bTask)\s+\d+$/i);
					if (taskMatch) {
						habitName = taskMatch[1].trim();
					}
					checkboxHabits[habitName] = (checkboxHabits[habitName] || 0) + 1;
				}
			}
		}

		// Parse tags: supports both plain tags (#work) and combo tags (#work/documentation).
		const tagRegex = /#([\w-]+)(?:\/([\w-]+))?/g;
		let tagMatch;
		while ((tagMatch = tagRegex.exec(content)) !== null) {
			const group = tagMatch[1];
			const item = tagMatch[2]; // Will be undefined for plain tags

			// Increment the group tag count (for both plain and combo tags)
			groupTagCounts[group] = (groupTagCounts[group] || 0) + 1;

			// If a combo tag exists, record it in tagData.
			if (item) {
				if (!tagData[group]) {
					tagData[group] = {};
				}
				tagData[group][item] = (tagData[group][item] || 0) + 1;
			}
		}
	}

	return { checkboxHabits, tagData, groupTagCounts };
}

/**
 * Scans available daily note files and returns a sorted array of period keys.
 * @param periodType 'weekly' returns Monday dates ("YYYY-MM-DD"),
 *                   'monthly' returns "YYYY-MM",
 *                   'yearly' returns "YYYY".
 */
export async function getAvailablePeriods(
	plugin: Plugin,
	periodType: 'weekly' | 'monthly' | 'yearly'
): Promise<string[]> {
	const vault = plugin.app.vault;
	const folders: string[] = (plugin as any).settings?.folders || ['Daily Notes'];

	const files = vault.getFiles().filter((file: TFile) =>
		folders.some(folder => file.path.startsWith(`${folder}/`)) && file.path.endsWith(".md")
	);
	const periodSet = new Set<string>();

	for (const file of files) {
		const fileDate = getFileDate(file);
		if (!fileDate) continue;

		if (periodType === 'weekly') {
			// Adjust to the Monday of that week.
			const jsDay = fileDate.getDay();
			const diff = (jsDay === 0) ? -6 : (1 - jsDay);
			const monday = new Date(fileDate);
			monday.setDate(fileDate.getDate() + diff);
			const mondayStr = monday.toISOString().slice(0, 10);
			periodSet.add(mondayStr);
		} else if (periodType === 'monthly') {
			const monthStr = fileDate.toISOString().slice(0, 7); // "YYYY-MM"
			periodSet.add(monthStr);
		} else if (periodType === 'yearly') {
			const yearStr = fileDate.getFullYear().toString();
			periodSet.add(yearStr);
		}
	}
	return Array.from(periodSet).sort();
}
