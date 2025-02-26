# Daily Note Dashboard Plugin

The Daily Note Dashboard Plugin aggregates and visualizes your daily note data, allowing you to track your habits and tags over time. It reads checkbox completions from a designated section in your Daily Notes and organizes tag data (e.g., `#habit/running` or `#work/documentation`) into interactive charts.

## Features

- **Dashboard View:** Interactive dashboard that displays charts representing your daily habit checkboxes and tag usage.
- **Period Selection:** Filter your data by weekly, monthly, or yearly periods.
- **Dynamic Charts:** Automatically update charts based on your Daily Note entries.
- **Refresh Button:** Manually refresh the dashboard data with a single click.
- **Flexible Habit Tracking:**
  - **Checkbox Habits:** Track habits with checkboxes. The plugin now groups similar tasks by normalizing entries that end with "Task" followed by a number (e.g., "Community Task 3" is grouped with all "Community Task" entries).
  - **Tag-based Habits:** Alternatively, track your habits by adding tags to your notes (e.g., `#habit/running`).
- **Comprehensive Tag Capture:**
  - **Single and Combo Tags:** Captures both single tags (e.g., `#work`) and combo tags (e.g., `#work/documentation`).
  - **Group Tags Chart:** Aggregates both plain and combo tags into a group chart for a comprehensive overview.

## Installation

1. Browse Obsidian plugins for Daily Note Metrics.
2. Enable the plugin from Obsidian's Settings under the "Community Plugins" section.
3. Open the Dashboard view via the command palette or by clicking the designated icon in the ribbon.

## Usage

- **Dashboard:** Once activated, the dashboard displays your aggregated data.
- **Period Dropdowns:** Use the dropdown menus to select the period type (weekly, monthly, yearly) and the specific period you want to view.
- **Refresh Data:** Click the **Refresh Data** button to update the charts with the latest data from your Daily Notes.

## Daily Habit Checkboxes Example

Below is an example of how you might structure your Daily Habit checkboxes in a Daily Note template:

~~~markdown
## Daily Habits
- [ ] Run 3km
- [ ] Meditate for 10 minutes
- [ ] Read a book chapter
- [ ] Community Task 1
- [ ] Community Task 2
~~~

*Note:* Using checkboxes for habit tracking is optional. You can also track your habits by simply adding tags to your notes (for example, `#habit/running`).

## Customization

You can easily modify the CSS styles for elements like the refresh button by editing the plugin's CSS file or adding custom styles to your Obsidian theme.

## Contributing

Contributions are welcome! Feel free to submit pull requests or report issues on the plugin's GitHub repository.

## License

This plugin is released under the MIT License.

This plugin uses [Chart.js](https://www.chartjs.org/) (licensed under the MIT License) for rendering interactive charts.
