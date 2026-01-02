// ../src/data/dataParser.ts
import { Plugin, TFile } from 'obsidian';
import type { NoteMetricsSettings } from '../../main';

// Type for a plugin with NoteMetricsSettings
interface PluginWithSettings extends Plugin {
	settings?: NoteMetricsSettings;
}

export interface PeriodChartData {
	// For checkboxes: keys are habit names and values are counts.
	checkboxHabits: { [habit: string]: number };
	// For tags: keys are group names (e.g. habit, goal, work), with each value mapping tag item → count.
	tagData: { [group: string]: { [tagItem: string]: number } };
	// New: Aggregate counts for group tags (plain and combo)
	groupTagCounts: { [group: string]: number };
	// New: Single emoji tags (e.g., #, #💪, #🎯)
	emojiTags: { [emoji: string]: number };
	// New: Single tags without categories (e.g., #important, #urgent)
	singleTags: { [tag: string]: number };
	// New: Hierarchical data for monthly and yearly views
	hierarchicalData?: {
		checkboxHabits: { [habit: string]: { [subPeriod: string]: number } };
		tagData: { [group: string]: { [tagItem: string]: { [subPeriod: string]: number } } };
		groupTagCounts: { [group: string]: { [subPeriod: string]: number } };
		emojiTags: { [emoji: string]: { [subPeriod: string]: number } };
		singleTags: { [tag: string]: { [subPeriod: string]: number } };
		// New: Per-heading hierarchical checkbox counts
		headingCheckboxHabits: { [heading: string]: { [habit: string]: { [subPeriod: string]: number } } };
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
 * Determines if a hash symbol is likely not a tag by checking the surrounding context.
 * @param content The full content of the file
 * @param hashIndex The index where the hash symbol was found
 * @param tagText The text after the hash symbol
 * @returns true if this is likely NOT a tag, false if it likely IS a tag
 */
function isLikelyNotATag(content: string, hashIndex: number, tagText: string): boolean {
	// Get some context around the hash symbol
	const beforeContext = content.slice(Math.max(0, hashIndex - 50), hashIndex);
	const afterContext = content.slice(hashIndex + 1 + tagText.length, Math.min(content.length, hashIndex + 1 + tagText.length + 50));

	// Check if this looks like a URL (common patterns before hash)
	const urlPatterns = [
		/\bhttps?:\/\//i,           // http:// or https://
		/\bwww\./i,                 // www.
		/\bftp:\/\//i,              // ftp://
		/\bmailto:/i,               // mailto:
		/\b[^\s]+\.(com|org|net|edu|gov|mil|io|co|uk|de|fr|jp|cn|ru|br|in|au|ca|mx|kr|it|es|nl|se|no|dk|fi|pl|ch|at|be|pt|gr|cz|hu|ro|bg|hr|si|sk|lt|ee|lv|mt|cy|lu|mc|sm|va|ad|li|ch|at|be|pt|gr|cz|hu|ro|bg|hr|si|sk|lt|ee|lv|mt|cy|lu|mc|sm|va|ad|li)\b/i  // common TLDs
	];

	// Check if the tag text itself looks like a URL fragment or system ID
	const urlFragmentPatterns = [
		/^(slide|heading|id|h)\.[a-zA-Z0-9_-]+\)?$/,  // slide=id.xxx, heading=h.xxx
		/^[a-zA-Z0-9_-]+=id\.[a-zA-Z0-9_-]+\)?$/,    // xxx=id.xxx
		/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\)?$/,       // xxx.xxx)
		/^[a-zA-Z0-9_-]+\)$/,                         // xxx)
		/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\)?$/, // xxx.xxx.xxx
		/^[0-9]+\]\(https?:?$/,                       // 14](https: - partial markdown links
		/^[0-9]+\]\([a-zA-Z]+$/,                      // 14](https - partial markdown links
		/^[0-9]+\]\($/,                               // 14]( - partial markdown links
		/^[0-9]+\]/,                                  // 14] - partial markdown links
	];

	for (const pattern of urlPatterns) {
		if (pattern.test(beforeContext)) {
			return true; // This is likely a URL fragment
		}
	}

	// Check if the tag text itself looks like a URL fragment or system ID
	for (const pattern of urlFragmentPatterns) {
		if (pattern.test(tagText)) {
			return true; // This looks like a URL fragment or system ID
		}
	}

	// Check if this looks like code (common patterns around hash)
	const codePatterns = [
		/\b(const|let|var|function|class|if|for|while|switch|case|return|import|export|from|require)\b/,  // programming keywords
		/\b[0-9a-fA-F]{6,}\b/,  // hex colors or hashes
		/\b[0-9a-fA-F]{32,}\b/, // long hex strings (MD5, SHA, etc.)
		/\b[A-Za-z0-9+/]{20,}={0,2}\b/, // base64 encoded strings
		/\b[0-9a-fA-F]{40,}\b/, // SHA-1 hashes
		/\b[0-9a-fA-F]{64,}\b/, // SHA-256 hashes
	];

	for (const pattern of codePatterns) {
		if (pattern.test(tagText)) {
			return true; // This looks like code/hash
		}
	}

	// Check if surrounded by code-like context
	const codeContextPatterns = [
		/\b(console\.|debugger|break|continue|throw|try|catch|finally|with|delete|typeof|instanceof|void|new|in|of|yield|await|async)\b/,  // more programming keywords
		/\b(=>|<=|>=|==|!=|===|!==|\+\+|--|\+=|-=|\*=|\\=|%=|\*\*=|<<=|>>=|>>>=|&=|\|=|\^=)\b/,  // operators
	];

	for (const pattern of codeContextPatterns) {
		if (pattern.test(beforeContext) || pattern.test(afterContext)) {
			return true; // This is in code context
		}
	}

	// Check if this looks like a file path or command
	if (tagText.includes('\\') || tagText.includes('~') || tagText.startsWith('.')) {
		return true;
	}

	// Check if this looks like a URL parameter or query string fragment
	if (tagText.includes('=') || tagText.includes('?') || tagText.includes('&')) {
		return true;
	}

	// Check if surrounded by markdown code blocks or inline code
	const codeBlockPattern = /```[\s\S]*?```/g;
	const inlineCodePattern = /`[^`]+`/g;

	// Check if hash is inside a code block
	let codeBlockMatch;
	while ((codeBlockMatch = codeBlockPattern.exec(content)) !== null) {
		if (hashIndex >= codeBlockMatch.index && hashIndex < codeBlockMatch.index + codeBlockMatch[0].length) {
			return true; // Hash is inside a code block
		}
	}

	// Check if hash is inside inline code
	let inlineCodeMatch;
	while ((inlineCodeMatch = inlineCodePattern.exec(content)) !== null) {
		if (hashIndex >= inlineCodeMatch.index && hashIndex < inlineCodeMatch.index + inlineCodeMatch[0].length) {
			return true; // Hash is inside inline code
		}
	}

	// If none of the above patterns match, it's likely a legitimate tag
	return false;
}

/**
 * Aggregates daily note data for a given period.
 * @param plugin The plugin instance.
 * @param periodType 'weekly', 'monthly', or 'yearly'
 * @param periodKey For weekly: a Monday date string ("YYYY-MM-DD"); for monthly: "YYYY-MM"; for yearly: "YYYY"
 * @returns PeriodChartData with aggregated checkbox habit counts and tag counts.
 */
export async function parsePeriodNotes(
	plugin: PluginWithSettings,
	periodType: 'weekly' | 'monthly' | 'yearly',
	periodKey: string
): Promise<PeriodChartData> {
	const vault = plugin.app.vault;
	const folders: string[] = plugin.settings?.folders || ['Daily Notes'];
	const headings: string[] = plugin.settings?.headings || ['## Daily Habits'];
	const scanAllFolders: boolean = plugin.settings?.scanAllFolders || false;

	let files: TFile[];
	if (scanAllFolders) {
		// Scan all markdown files in the vault
		files = vault.getFiles().filter((file: TFile) => file.path.endsWith(".md"));
	} else {
		// Only scan files from specified folders
		files = vault.getFiles().filter((file: TFile) =>
			folders.some(folder => file.path.startsWith(`${folder}/`)) && file.path.endsWith(".md")
		);
	}

	const checkboxHabits: { [habit: string]: number } = {};
	const tagData: { [group: string]: { [tagItem: string]: number } } = {};
	const groupTagCounts: { [group: string]: number } = {};
	// New: Single emoji tags
	const emojiTags: { [emoji: string]: number } = {};
	// New: Single tags without categories (e.g., #important, #urgent)
	const singleTags: { [tag: string]: number } = {};
	// New: Map heading to its habits and their counts
	const headingCheckboxHabits: { [heading: string]: { [habit: string]: number } } = {};

	// New: Hierarchical data structures
	const hierarchicalData = {
		checkboxHabits: {} as { [habit: string]: { [subPeriod: string]: number } },
		tagData: {} as { [group: string]: { [tagItem: string]: { [subPeriod: string]: number } } },
		groupTagCounts: {} as { [group: string]: { [subPeriod: string]: number } },
		emojiTags: {} as { [emoji: string]: { [subPeriod: string]: number } },
		singleTags: {} as { [tag: string]: { [subPeriod: string]: number } },
		headingCheckboxHabits: {} as { [heading: string]: { [habit: string]: { [subPeriod: string]: number } } }
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
			const ignoreLevels = plugin.settings?.ignoreHeadingLevels || false;
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

							// Update per-heading hierarchical counts
							if (!hierarchicalData.headingCheckboxHabits[heading]) {
								hierarchicalData.headingCheckboxHabits[heading] = {};
							}
							if (!hierarchicalData.headingCheckboxHabits[heading][habitName]) {
								hierarchicalData.headingCheckboxHabits[heading][habitName] = {};
							}
							hierarchicalData.headingCheckboxHabits[heading][habitName][subPeriod] =
								(hierarchicalData.headingCheckboxHabits[heading][habitName][subPeriod] || 0) + 1;
						}
					}
				}
			}
		}

		// Parse tags with intelligent filtering to avoid capturing URLs and other non-tag uses
		const tagRegex = /#([^\s#/]+)(?:\/([^\s#/]+))?/g;
		let tagMatch;

		while ((tagMatch = tagRegex.exec(content)) !== null) {
			const group = tagMatch[1];
			const item = tagMatch[2];

			// Skip if this looks like a URL fragment or code
			if (isLikelyNotATag(content, tagMatch.index, group)) {
				continue;
			}

			if (item) {
				// This is a combo tag (group/item format)
				// Update total counts for group tags only
				groupTagCounts[group] = (groupTagCounts[group] || 0) + 1;

				if (!tagData[group]) {
					tagData[group] = {};
				}
				tagData[group][item] = (tagData[group][item] || 0) + 1;

				// Update hierarchical data if needed
				if (subPeriod) {
					if (!hierarchicalData.groupTagCounts[group]) {
						hierarchicalData.groupTagCounts[group] = {};
					}
					hierarchicalData.groupTagCounts[group][subPeriod] =
						(hierarchicalData.groupTagCounts[group][subPeriod] || 0) + 1;

					if (!hierarchicalData.tagData[group]) {
						hierarchicalData.tagData[group] = {};
					}
					if (!hierarchicalData.tagData[group][item]) {
						hierarchicalData.tagData[group][item] = {};
					}
					hierarchicalData.tagData[group][item][subPeriod] =
						(hierarchicalData.tagData[group][item][subPeriod] || 0) + 1;
				}
			} else {
				// This is a single tag (no item)
				// Check if it's an emoji tag first
				// Enhanced emoji detection - covers more emoji ranges
				const hasEmoji = /[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F030}-\u{1F09F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F650}-\u{1F67F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FAB0}-\u{1FABF}]|[\u{1FAC0}-\u{1FAFF}]|[\u{1FAD0}-\u{1FAFF}]|[\u{1FAE0}-\u{1FAFF}]|[\u{1FAF0}-\u{1FAFF}]|[\u{2300}-\u{23FF}]|[\u{2B00}-\u{2BFF}]|[\u{2B50}]|[\u{2934}-\u{2935}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{FE00}-\u{FE0F}]|[\u{FE30}-\u{FE4F}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F201}-\u{1F202}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F300}-\u{1F321}]|[\u{1F324}-\u{1F393}]|[\u{1F396}-\u{1F397}]|[\u{1F399}-\u{1F39B}]|[\u{1F39E}-\u{1F3F0}]|[\u{1F3F3}-\u{1F3F5}]|[\u{1F3F7}-\u{1F3FA}]|[\u{1F400}-\u{1F4FD}]|[\u{1F4FF}-\u{1F53D}]|[\u{1F549}-\u{1F54E}]|[\u{1F550}-\u{1F567}]|[\u{1F56F}-\u{1F570}]|[\u{1F573}-\u{1F57A}]|[\u{1F587}]|[\u{1F58A}-\u{1F58D}]|[\u{1F590}]|[\u{1F595}-\u{1F596}]|[\u{1F5A4}-\u{1F5A5}]|[\u{1F5A8}]|[\u{1F5B1}-\u{1F5B2}]|[\u{1F5BC}]|[\u{1F5C2}-\u{1F5C4}]|[\u{1F5D1}-\u{1F5D3}]|[\u{1F5DC}-\u{1F5DE}]|[\u{1F5E1}]|[\u{1F5E3}]|[\u{1F5E8}]|[\u{1F5EF}]|[\u{1F5F3}]|[\u{1F5FA}-\u{1F64F}]|[\u{1F680}-\u{1F6C5}]|[\u{1F6CB}-\u{1F6D2}]|[\u{1F6E0}-\u{1F6E5}]|[\u{1F6E9}]|[\u{1F6EB}-\u{1F6EC}]|[\u{1F6F0}]|[\u{1F6F3}-\u{1F6F9}]|[\u{1F910}-\u{1F93A}]|[\u{1F93C}-\u{1F93E}]|[\u{1F940}-\u{1F945}]|[\u{1F947}-\u{1F970}]|[\u{1F973}-\u{1F976}]|[\u{1F97A}]|[\u{1F97C}-\u{1F9A2}]|[\u{1F9B0}-\u{1F9B9}]|[\u{1F9C0}-\u{1F9C2}]|[\u{1F9D0}-\u{1F9FF}]/u.test(group);

				if (hasEmoji) {
					// This is an emoji tag
					emojiTags[group] = (emojiTags[group] || 0) + 1;

					// Update hierarchical data if needed
					if (subPeriod) {
						if (!hierarchicalData.emojiTags[group]) {
							hierarchicalData.emojiTags[group] = {};
						}
						hierarchicalData.emojiTags[group][subPeriod] =
							(hierarchicalData.emojiTags[group][subPeriod] || 0) + 1;
					}
				} else {
					// This is a regular single tag
					singleTags[group] = (singleTags[group] || 0) + 1;

					// Update hierarchical data if needed
					if (subPeriod) {
						if (!hierarchicalData.singleTags[group]) {
							hierarchicalData.singleTags[group] = {};
						}
						hierarchicalData.singleTags[group][subPeriod] =
							(hierarchicalData.singleTags[group][subPeriod] || 0) + 1;
					}
				}
			}
		}
	}

	// Debug output for overall parsing results

	return {
		checkboxHabits,
		tagData,
		groupTagCounts,
		emojiTags,
		singleTags, // Always include singleTags
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
	plugin: PluginWithSettings,
	periodType: 'weekly' | 'monthly' | 'yearly'
): Promise<string[]> {
	const vault = plugin.app.vault;
	const folders: string[] = plugin.settings?.folders || ['Daily Notes'];
	const scanAllFolders: boolean = plugin.settings?.scanAllFolders || false;

	let files: TFile[];
	if (scanAllFolders) {
		// Scan all markdown files in the vault
		files = vault.getFiles().filter((file: TFile) => file.path.endsWith(".md"));
	} else {
		// Only scan files from specified folders
		files = vault.getFiles().filter((file: TFile) =>
			folders.some(folder => file.path.startsWith(`${folder}/`)) && file.path.endsWith(".md")
		);
	}
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
