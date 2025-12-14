# TODO: Implement Shift-Based Data Filtering

## Overview
Ensure that when an employee ends a shift and starts a new one, the previous shift's analysis is not shown in analysis.html and end_shift_report.html. This involves filtering data by shift times instead of just date.

## Steps

### 1. Update Server API (/api/todays-report-summary) ✅
- Modify the endpoint to accept `shiftStartTime` and `shiftEndTime` query parameters.
- Filter `extraData` and `retailCreditData` by the provided shift times in addition to date.

### 2. Update analysis.html ✅
- Modify `fetchData` function to fetch the employee's active shift (shiftEndTime null, shiftStartTime today).
- Pass the active shift's `shiftStartTime` to API calls for filtering data from that time onward.
- Add error handling if no active shift is found.

### 3. Update end_shift_report.html ✅
- Modify `fetchData` function to accept optional `shiftStartTime` and `shiftEndTime` parameters.
- Update `renderPage` to determine the last ended shift's times and pass them to `fetchData` and `fetchTodayReportSummary`.
- Ensure `fetchTodayReportSummary` accepts and passes shift times to the API.

### 4. Add Data Activity Report to end_shift_report.html ✅
- Add new API endpoint `/api/data-activity-summary` in server.js to return counts of deleted, edited, and inputed data.
- Add a new section "Data Activity Report" in end_shift_report.html with placeholders for the counts.
- Update CSS to style the new section.
- Add JavaScript function `fetchDataActivitySummary` to fetch the data.
- Update `renderPage` to call `fetchDataActivitySummary` and display the counts.

## Dependent Files
- server.js: Update /api/todays-report-summary, add /api/data-activity-summary
- analysis.html: Update fetchData and view functions
- end_shift_report.html: Update fetchData, renderPage, fetchTodayReportSummary, add data activity report section

## Followup Steps
- Test the changes by simulating shift transitions.
- Verify that analysis.html shows only current shift data.
- Verify that end_shift_report.html shows only the ended shift's data.
- Test the new data activity report section to ensure it displays the correct counts.
