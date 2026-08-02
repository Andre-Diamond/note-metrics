import { App, TFile } from 'obsidian';
import type { PeriodChartData } from './dataParser';

export type ExportDataType =
	| 'checkbox'
	| 'combo_tag'
	| 'group_tag'
	| 'single_tag'
	| 'emoji_tag'
	| 'daily_activity';

export interface CsvRow {
	period_type: string;
	period: string;
	data_type: ExportDataType;
	heading: string;
	group: string;
	item: string;
	sub_period: string;
	date: string;
	count: number;
}

const CSV_HEADERS: (keyof CsvRow)[] = [
	'period_type',
	'period',
	'data_type',
	'heading',
	'group',
	'item',
	'sub_period',
	'date',
	'count'
];

const EXPORT_FOLDER = 'Note Metrics Exports';

function escapeCsvValue(value: string | number): string {
	const text = String(value ?? '');
	if (/[",\n\r]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

function baseRow(
	periodType: string,
	periodKey: string,
	dataType: ExportDataType
): Omit<CsvRow, 'count'> {
	return {
		period_type: periodType,
		period: periodKey,
		data_type: dataType,
		heading: '',
		group: '',
		item: '',
		sub_period: '',
		date: ''
	};
}

/**
 * Flattens PeriodChartData into one CSV with shared columns.
 * Columns are filled only where they apply to each data type.
 */
export function buildPeriodCsv(
	periodData: PeriodChartData,
	periodType: 'weekly' | 'monthly' | 'yearly',
	periodKey: string
): string {
	const rows: CsvRow[] = [];
	const hierarchical = periodData.hierarchicalData;

	// Checkboxes (prefer per-heading hierarchical breakdown used by charts)
	const headingHierarchical = hierarchical?.headingCheckboxHabits;
	if (headingHierarchical && Object.keys(headingHierarchical).length > 0) {
		for (const [heading, habits] of Object.entries(headingHierarchical)) {
			for (const [habit, subPeriods] of Object.entries(habits)) {
				for (const [subPeriod, count] of Object.entries(subPeriods)) {
					rows.push({
						...baseRow(periodType, periodKey, 'checkbox'),
						heading,
						item: habit,
						sub_period: subPeriod,
						count
					});
				}
			}
		}
	} else {
		const headingTotals = periodData.headingCheckboxHabits || {};
		for (const [heading, habits] of Object.entries(headingTotals)) {
			for (const [habit, count] of Object.entries(habits)) {
				rows.push({
					...baseRow(periodType, periodKey, 'checkbox'),
					heading,
					item: habit,
					count
				});
			}
		}
	}

	// Combo tags (#group/item)
	const tagHierarchical = hierarchical?.tagData;
	if (tagHierarchical && Object.keys(tagHierarchical).length > 0) {
		for (const [group, items] of Object.entries(tagHierarchical)) {
			for (const [item, subPeriods] of Object.entries(items)) {
				for (const [subPeriod, count] of Object.entries(subPeriods)) {
					rows.push({
						...baseRow(periodType, periodKey, 'combo_tag'),
						group,
						item,
						sub_period: subPeriod,
						count
					});
				}
			}
		}
	} else {
		for (const [group, items] of Object.entries(periodData.tagData || {})) {
			for (const [item, count] of Object.entries(items)) {
				rows.push({
					...baseRow(periodType, periodKey, 'combo_tag'),
					group,
					item,
					count
				});
			}
		}
	}

	// Group tags (#group from combo tags)
	const groupHierarchical = hierarchical?.groupTagCounts;
	if (groupHierarchical && Object.keys(groupHierarchical).length > 0) {
		for (const [group, subPeriods] of Object.entries(groupHierarchical)) {
			for (const [subPeriod, count] of Object.entries(subPeriods)) {
				rows.push({
					...baseRow(periodType, periodKey, 'group_tag'),
					group,
					sub_period: subPeriod,
					count
				});
			}
		}
	} else {
		for (const [group, count] of Object.entries(periodData.groupTagCounts || {})) {
			rows.push({
				...baseRow(periodType, periodKey, 'group_tag'),
				group,
				count
			});
		}
	}

	// Single tags
	const singleHierarchical = hierarchical?.singleTags;
	if (singleHierarchical && Object.keys(singleHierarchical).length > 0) {
		for (const [tag, subPeriods] of Object.entries(singleHierarchical)) {
			for (const [subPeriod, count] of Object.entries(subPeriods)) {
				rows.push({
					...baseRow(periodType, periodKey, 'single_tag'),
					item: tag,
					sub_period: subPeriod,
					count
				});
			}
		}
	} else {
		for (const [tag, count] of Object.entries(periodData.singleTags || {})) {
			rows.push({
				...baseRow(periodType, periodKey, 'single_tag'),
				item: tag,
				count
			});
		}
	}

	// Emoji tags
	const emojiHierarchical = hierarchical?.emojiTags;
	if (emojiHierarchical && Object.keys(emojiHierarchical).length > 0) {
		for (const [emoji, subPeriods] of Object.entries(emojiHierarchical)) {
			for (const [subPeriod, count] of Object.entries(subPeriods)) {
				rows.push({
					...baseRow(periodType, periodKey, 'emoji_tag'),
					item: emoji,
					sub_period: subPeriod,
					count
				});
			}
		}
	} else {
		for (const [emoji, count] of Object.entries(periodData.emojiTags || {})) {
			rows.push({
				...baseRow(periodType, periodKey, 'emoji_tag'),
				item: emoji,
				count
			});
		}
	}

	// Daily activity (heatmap)
	for (const [date, count] of Object.entries(periodData.dailyActivity || {})) {
		rows.push({
			...baseRow(periodType, periodKey, 'daily_activity'),
			date,
			count
		});
	}

	const lines = [
		CSV_HEADERS.join(','),
		...rows.map(row =>
			CSV_HEADERS.map(header => escapeCsvValue(row[header])).join(',')
		)
	];

	return lines.join('\n') + '\n';
}

function sanitizeFilenamePart(value: string): string {
	return value.replace(/[\\/:*?"<>|]/g, '-');
}

/**
 * Writes the CSV into the vault under "Note Metrics Exports/".
 * @returns The vault-relative file path.
 */
export async function saveCsvToVault(
	app: App,
	csv: string,
	periodType: 'weekly' | 'monthly' | 'yearly',
	periodKey: string
): Promise<string> {
	if (!app.vault.getAbstractFileByPath(EXPORT_FOLDER)) {
		await app.vault.createFolder(EXPORT_FOLDER);
	}

	const filename = `note-metrics-${sanitizeFilenamePart(periodType)}-${sanitizeFilenamePart(periodKey)}.csv`;
	const path = `${EXPORT_FOLDER}/${filename}`;
	const existing = app.vault.getAbstractFileByPath(path);

	if (existing instanceof TFile) {
		await app.vault.modify(existing, csv);
	} else {
		await app.vault.create(path, csv);
	}

	return path;
}
