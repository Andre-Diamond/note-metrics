// ../src/data/dataParser.ts
import { Plugin, TFile } from 'obsidian';

export interface PeriodChartData {
	// For checkboxes: keys are habit names and values are counts.
	checkboxHabits: { [habit: string]: number };
	// For tags: keys are group names (e.g. habit, goal, work), with each value mapping tag item → count.
	tagData: { [group: string]: { [tagItem: string]: number } };
	// New: Aggregate counts for group tags (plain and combo)
	groupTagCounts: { [group: string]: number };
	// New: Hierarchical data for monthly and yearly views
	hierarchicalData?: {
		checkboxHabits: { [habit: string]: { [subPeriod: string]: number } };
		tagData: { [group: string]: { [tagItem: string]: { [subPeriod: string]: number } } };
		groupTagCounts: { [group: string]: { [subPeriod: string]: number } };
	};
	// New: Map heading to its habits and their counts
	headingCheckboxHabits?: { [heading: string]: { [habit: string]: number } };
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
	const folders: string[] = (plugin as any).settings?.folders || ['Daily Notes'];
	const headings: string[] = (plugin as any).settings?.headings || ['## Daily Habits'];

	const files = vault.getFiles().filter((file: TFile) =>
		folders.some(folder => file.path.startsWith(`${folder}/`)) && file.path.endsWith(".md")
	);

	const checkboxHabits: { [habit: string]: number } = {};
	const tagData: { [group: string]: { [tagItem: string]: number } } = {};
	const groupTagCounts: { [group: string]: number } = {};
	// New: Map heading to its habits and their counts
	const headingCheckboxHabits: { [heading: string]: { [habit: string]: number } } = {};

	// New: Hierarchical data structures
	const hierarchicalData = {
		checkboxHabits: {} as { [habit: string]: { [subPeriod: string]: number } },
		tagData: {} as { [group: string]: { [tagItem: string]: { [subPeriod: string]: number } } },
		groupTagCounts: {} as { [group: string]: { [subPeriod: string]: number } }
	};

	for (const file of files) {
		const fileDate = getFileDate(file);
		if (!fileDate) continue;

		let include = false;
		let subPeriod: string | null = null;

		if (periodType === 'weekly') {
			const monday = new Date(periodKey);
			const sunday = new Date(monday);
			sunday.setDate(monday.getDate() + 6);
			include = fileDate >= monday && fileDate <= sunday;
			if (include) {
				// Get the day of week (0-6, where 0 is Sunday)
				const dayOfWeek = fileDate.getDay();
				// Convert to Monday-based (0-6, where 0 is Monday)
				subPeriod = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][(dayOfWeek + 6) % 7];
			}
		} else if (periodType === 'monthly') {
			const fileMonth = fileDate.toISOString().slice(0, 7);
			include = fileMonth === periodKey;
			if (include) {
				// Get the week number within the month (1-5)
				const firstDay = new Date(fileDate.getFullYear(), fileDate.getMonth(), 1);
				const weekNumber = Math.ceil((fileDate.getDate() + firstDay.getDay()) / 7);
				subPeriod = `Week ${weekNumber}`;
			}
		} else if (periodType === 'yearly') {
			const fileYear = fileDate.getFullYear().toString();
			include = fileYear === periodKey;
			if (include) {
				subPeriod = fileDate.toISOString().slice(5, 7); // "MM"
			}
		}

		if (!include) continue;

		const content = await vault.read(file);

		// Parse checkbox habits for each heading
		for (const heading of headings) {
			const headingText = heading.replace(/^#+\s*/, '');
			const ignoreLevels = (plugin as any).settings?.ignoreHeadingLevels || false;
			let headingPattern;
			if (!heading.trim().startsWith('#')) {
				// If no #, always match any heading level
				headingPattern = new RegExp(`^#{1,6}\\s*${headingText}\\s*$`, 'm');
			} else {
				// If #, use toggle logic
				headingPattern = ignoreLevels
					? new RegExp(`^#{1,6}\\s*${headingText}\\s*$`, 'm')
					: new RegExp(`^${heading}\\s*$`, 'm');
			}

			const headingMatch = content.match(headingPattern);
			if (headingMatch && headingMatch.index !== undefined) {
				const headingEndIndex = headingMatch.index + headingMatch[0].length;
				const contentAfterHeading = content.slice(headingEndIndex);
				const nextHeadingMatch = contentAfterHeading.match(/^#{1,6}\s/m);
				const sectionEndIndex = nextHeadingMatch ? nextHeadingMatch.index : contentAfterHeading.length;
				const habitSection = contentAfterHeading.slice(0, sectionEndIndex);
				const lines = habitSection.split('\n');
				for (const line of lines) {
					const match = line.match(/- \[x\]\s*(.+)/);
					if (match) {
						let habitName = match[1].trim();
						const taskMatch = habitName.match(/^(.*\bTask)\s+\d+$/i);
						if (taskMatch) {
							habitName = taskMatch[1].trim();
						}

						// Update total counts
						checkboxHabits[habitName] = (checkboxHabits[habitName] || 0) + 1;

						// Update heading-specific counts
						if (!headingCheckboxHabits[heading]) headingCheckboxHabits[heading] = {};
						headingCheckboxHabits[heading][habitName] = (headingCheckboxHabits[heading][habitName] || 0) + 1;

						// Update hierarchical data if needed
						if (subPeriod) {
							if (!hierarchicalData.checkboxHabits[habitName]) {
								hierarchicalData.checkboxHabits[habitName] = {};
							}
							hierarchicalData.checkboxHabits[habitName][subPeriod] =
								(hierarchicalData.checkboxHabits[habitName][subPeriod] || 0) + 1;
						}
					}
				}
			}
		}

		// Parse tags
		const tagRegex = /#([\w-]+)(?:\/([\w-]+))?/g;
		let tagMatch;
		while ((tagMatch = tagRegex.exec(content)) !== null) {
			const group = tagMatch[1];
			const item = tagMatch[2];

			// Update total counts
			groupTagCounts[group] = (groupTagCounts[group] || 0) + 1;

			if (item) {
				if (!tagData[group]) {
					tagData[group] = {};
				}
				tagData[group][item] = (tagData[group][item] || 0) + 1;
			}

			// Update hierarchical data if needed
			if (subPeriod) {
				if (!hierarchicalData.groupTagCounts[group]) {
					hierarchicalData.groupTagCounts[group] = {};
				}
				hierarchicalData.groupTagCounts[group][subPeriod] =
					(hierarchicalData.groupTagCounts[group][subPeriod] || 0) + 1;

				if (item) {
					if (!hierarchicalData.tagData[group]) {
						hierarchicalData.tagData[group] = {};
					}
					if (!hierarchicalData.tagData[group][item]) {
						hierarchicalData.tagData[group][item] = {};
					}
					hierarchicalData.tagData[group][item][subPeriod] =
						(hierarchicalData.tagData[group][item][subPeriod] || 0) + 1;
				}
			}
		}
	}

	return {
		checkboxHabits,
		tagData,
		groupTagCounts,
		hierarchicalData: hierarchicalData, // Always include hierarchical data
		headingCheckboxHabits
	};
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
