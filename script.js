const STORAGE_KEY = 'eodActivities';
const THEME_KEY = 'eodTheme';
const SETTINGS_KEY = 'eodSettings';
const today = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'full',
    timeStyle: 'long'
}).format(new Date());
let todayArr = today.split(' ');
let selectedHistoryDate = null;
let editingActivityId = null;
let editingActivityDate = null;

// Initializion
initializeTheme();
initializeTime(); 


// Load activities on page load
loadActivities();
loadHistoryDates();

// Form submission
document.getElementById('entryForm').addEventListener('submit', function(e) {
    e.preventDefault();
    addActivity();
});

document.getElementById('editForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveEditedActivity();
});

function initializeTime(){
    // Set today's date as default
    document.getElementById('date').valueAsDate = new Date();

    // Set current start time to today's time
    let currTimeH = todayArr[5].split(":")[0]
    let currTimeM = todayArr[5].split(":")[1]
    currTimeH = (todayArr[6] == "AM") ? currTimeH : parseInt(currTimeH) + 12

    // IF!!! there alr isnt an existing one
    const date = document.getElementById('date').value;
    const activities = getActivities(date);
    if (activities.length > 0){
        // gets last time (-1)
        currTimeH = activities.at(-1).endTime.split(":")[0]
        currTimeM = activities.at(-1).endTime.split(":")[1]
    }

    document.getElementById('startTime').value = `${currTimeH}:${currTimeM}`;
}

// Toast Notification System
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="removeToast(this.parentElement)">×</button>
    `;
    
    container.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }
}

function removeToast(element) {
    element.classList.add('removing');
    setTimeout(() => {
        element.remove();
    }, 300);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateThemeButton();
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    updateThemeButton();
}

function updateThemeButton() {
    const btn = document.querySelector('.theme-toggle');
    const isLight = document.body.classList.contains('light-mode');
    btn.textContent = isLight ? '☀️' : '🌙';
}

function openForms() {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

    if (!settings.empId) {
        showToast('Please configure Settings first', 'error');
        openSettingsModal();
        return;
    }

    const rawDate = document.getElementById('date').value || new Date().toISOString().split('T')[0];
    const [year, month, day] = rawDate.split('-');
    const formattedDate = `${parseInt(month)}/${parseInt(day)}/${year}`;
    const reportText = generateReport(rawDate);

    const formData = {
        empId: settings.empId,
        attendanceStatus: settings.attendanceStatus || 'WFO',
        date: formattedDate,
        report: reportText,
        starRating6: settings.starRating6 || '5',
        starRating7: settings.starRating7 || '5',
        defaultText8: settings.defaultText8 || '',
        defaultText9: settings.defaultText9 || ''
    };

    const encodedData = encodeURIComponent(JSON.stringify(formData));
    const baseUrl = 'https://forms.cloud.microsoft/r/6kHD9TXWaH';

    window.open(baseUrl + '#eodauto=' + encodedData, '_blank');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));

    document.getElementById(tab + 'Tab').classList.add('active');
    event.target.classList.add('active');

    if (tab === 'history') {
        loadHistoryDates();
    }
}

function addActivity() {
    const date = document.getElementById('date').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const activityType = document.getElementById('activityType').value;
    const description = document.getElementById('description').value.trim();

    const errorEl = document.getElementById('formError');
    errorEl.classList.remove('show');

    if (!startTime || !endTime || !activityType || !description) {
        showToast('All fields are required', 'error');
        return;
    }

    if (startTime >= endTime) {
        showToast('End time must be after start time', 'error');
        return;
    }

    const activities = getActivities(date);
    if (hasTimeConflict(startTime, endTime, activities)) {
        showToast('This time slot conflicts with an existing activity', 'error');
        return;
    }

    const activity = {
        id: Date.now(),
        date,
        startTime,
        endTime,
        type: activityType,
        description
    };

    activities.push(activity);
    saveActivities(date, activities);

    document.getElementById('entryForm').reset();
    document.getElementById('date').valueAsDate = new Date();

    showToast('Activity added successfully!', 'success');
    initializeTime(); // re-initialize time to current time
    loadActivities();
    loadHistoryDates();
}

function openEditModal(id, date) {
    editingActivityId = id;
    editingActivityDate = date;
    
    const activities = getActivities(date);
    const activity = activities.find(a => a.id === id);
    
    if (activity) {
        document.getElementById('editDate').value = activity.date;
        document.getElementById('editStartTime').value = activity.startTime;
        document.getElementById('editEndTime').value = activity.endTime;
        document.getElementById('editActivityType').value = activity.type;
        document.getElementById('editDescription').value = activity.description;
        document.getElementById('editModal').classList.add('show');
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    editingActivityId = null;
    editingActivityDate = null;
    document.getElementById('editError').classList.remove('show');
}

function saveEditedActivity() {
    const newDate = document.getElementById('editDate').value;
    const startTime = document.getElementById('editStartTime').value;
    const endTime = document.getElementById('editEndTime').value;
    const activityType = document.getElementById('editActivityType').value;
    const description = document.getElementById('editDescription').value.trim();

    const errorEl = document.getElementById('editError');
    errorEl.classList.remove('show');

    if (!startTime || !endTime || !activityType || !description) {
        showToast('All fields are required', 'error');
        return;
    }

    if (startTime >= endTime) {
        showToast('End time must be after start time', 'error');
        return;
    }

    const activities = getActivities(newDate);
    const otherActivities = activities.filter(a => a.id !== editingActivityId);
    if (hasTimeConflict(startTime, endTime, otherActivities)) {
        showToast('This time slot conflicts with an existing activity', 'error');
        return;
    }

    // If date changed, remove from old date
    if (newDate !== editingActivityDate) {
        const oldActivities = getActivities(editingActivityDate);
        const filtered = oldActivities.filter(a => a.id !== editingActivityId);
        saveActivities(editingActivityDate, filtered);
    }

    // Update or add to new date
    const updated = activities.filter(a => a.id !== editingActivityId);
    updated.push({
        id: editingActivityId,
        date: newDate,
        startTime,
        endTime,
        type: activityType,
        description
    });
    saveActivities(newDate, updated);

    closeEditModal();
    showToast('Activity updated successfully!', 'success');
    loadActivities();
    loadHistoryDates();
}

function hasTimeConflict(startTime, endTime, activities) {
    return activities.some(activity => {
        return (startTime < activity.endTime && endTime > activity.startTime);
    });
}

function saveActivities(date, activities) {
    const allActivities = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    allActivities[date] = activities;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allActivities));
}

function getActivities(date) {
    const allActivities = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return allActivities[date] || [];
}

function getAllDates() {
    const allActivities = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.keys(allActivities).sort().reverse();
}

function loadActivities() {
    const date = document.getElementById('date').value || today;
    const activities = getActivities(date);

    const entriesList = document.getElementById('entriesList');
    
    if (activities.length === 0) {
        entriesList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No activities yet. Add your first activity!</p>';
    } else {
        activities.sort((a, b) => a.startTime.localeCompare(b.startTime));
        entriesList.innerHTML = activities.map(activity => `
            <div class="entry-item ${activity.type}">
                <div class="entry-content">
                    <div class="entry-time">
                        ${formatTime(activity.startTime)} – ${formatTime(activity.endTime)}
                        <span class="entry-type ${activity.type}">${activity.type}</span>
                    </div>
                    <div class="entry-description">${escapeHtml(activity.description)}</div>
                </div>
                <div class="entry-actions">
                    <button class="edit-btn" onclick="openEditModal(${activity.id}, '${date}')"> Edit</button>
                    <button class="delete-btn" onclick="deleteActivity(${activity.id}, '${date}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    updateStats(activities);
}

function loadHistoryDates() {
    const dateList = document.getElementById('dateList');
    const allDates = getAllDates();

    if (allDates.length === 0) {
        dateList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No EOD reports recorded yet.</p>';
    } else {
        dateList.innerHTML = allDates.map(date => {
            const activities = getActivities(date);
            const counts = {
                training: activities.filter(a => a.type === 'training').length,
                meeting: activities.filter(a => a.type === 'meeting').length,
                deployment: activities.filter(a => a.type === 'deployment').length
            };
            return `
                <div class="date-item ${selectedHistoryDate === date ? 'active' : ''}" onclick="selectHistoryDate('${date}')">
                    <div class="date-label">${formatDateDisplay(date)}</div>
                    <div class="date-summary">${counts.training}T • ${counts.meeting}M • ${counts.deployment}D</div>
                </div>
            `;
        }).join('');
    }
}

function selectHistoryDate(date) {
    selectedHistoryDate = date;
    loadHistoryDates();
    displayHistoryReport(date);
}

function displayHistoryReport(date) {
    const reportDisplay = document.getElementById('reportDisplay');
    const activities = getActivities(date);

    if (activities.length === 0) {
        reportDisplay.classList.add('empty');
        reportDisplay.textContent = 'No activities recorded for this date.';
    } else {
        reportDisplay.classList.remove('empty');
        activities.sort((a, b) => a.startTime.localeCompare(b.startTime));

        let report = `EOD REPORT - ${formatDateDisplay(date)}\n`;
        report += '='.repeat(50) + '\n\n';

        activities.forEach(activity => {
            const type = activity.type.charAt(0).toUpperCase() + activity.type.slice(1);
            report += `${formatTime(activity.startTime)} – ${formatTime(activity.endTime)} | ${type}: ${activity.description}\n`;
        });

        reportDisplay.textContent = report;
    }
}

function deleteActivity(id, date) {
    if (confirm('Are you sure you want to delete this activity?')) {
        const activities = getActivities(date);
        const filtered = activities.filter(a => a.id !== id);
        saveActivities(date, filtered);
        showToast('Activity deleted', 'info');
        loadActivities();
        loadHistoryDates();
    }
}

function updateStats(activities) {
    const counts = {
        training: activities.filter(a => a.type === 'training').length,
        meeting: activities.filter(a => a.type === 'meeting').length,
        deployment: activities.filter(a => a.type === 'deployment').length
    };

    document.getElementById('trainingCount').textContent = counts.training;
    document.getElementById('meetingCount').textContent = counts.meeting;
    document.getElementById('deploymentCount').textContent = counts.deployment;
}

function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function formatDateDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateReport(date) {
    const activities = getActivities(date);

    if (activities.length === 0) {
        return 'No activities recorded for this date.';
    }

    activities.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let report = `EOD REPORT - ${formatDateDisplay(date)}\n`;
    report += '='.repeat(50) + '\n\n';

    activities.forEach(activity => {
        const type = activity.type.charAt(0).toUpperCase() + activity.type.slice(1);
        report += `${formatTime(activity.startTime)} – ${formatTime(activity.endTime)} | ${type}: ${activity.description}\n`;
    });

    return report;
}

function exportToText() {
    const date = document.getElementById('date').value;
    const report = generateReport(date);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(report));
    element.setAttribute('download', `EOD_Report_${date}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Report exported!', 'success');
}

function copyToClipboard() {
    const date = document.getElementById('date').value;
    const report = generateReport(date);
    navigator.clipboard.writeText(report).then(() => {
        showToast('Report copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy report', 'error');
    });
}

function exportSelectedReport() {
    if (!selectedHistoryDate) {
        showToast('Please select a date first', 'error');
        return;
    }
    const report = generateReport(selectedHistoryDate);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(report));
    element.setAttribute('download', `EOD_Report_${selectedHistoryDate}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Report exported!', 'success');
}

function copySelectedReport() {
    if (!selectedHistoryDate) {
        showToast('Please select a date first', 'error');
        return;
    }
    const report = generateReport(selectedHistoryDate);
    navigator.clipboard.writeText(report).then(() => {
        showToast('Report copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy report', 'error');
    });
}

document.getElementById('date').addEventListener('change', loadActivities);

// Close modal when clicking outside
window.onclick = function (event) {
    const editModal = document.getElementById('editModal');
    const settingsModal = document.getElementById('settingsModal');
    if (event.target == editModal) {
        closeEditModal();
    }
    if (event.target == settingsModal) {
        closeSettingsModal();
    }
}

// --- Settings Logic ---
function openSettingsModal() {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    document.getElementById('empId').value = settings.empId || '';
    document.getElementById('attendanceStatus').value = settings.attendanceStatus || 'Training';
    document.getElementById('starRating6').value = settings.starRating6 || '5';
    document.getElementById('starRating7').value = settings.starRating7 || '5';
    document.getElementById('defaultText8').value = settings.defaultText8 || '';
    document.getElementById('defaultText9').value = settings.defaultText9 || '';
    document.getElementById('settingsModal').classList.add('show');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('show');
}

document.getElementById('settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const settings = {
        empId: document.getElementById('empId').value,
        attendanceStatus: document.getElementById('attendanceStatus').value,
        starRating6: document.getElementById('starRating6').value,
        starRating7: document.getElementById('starRating7').value,
        defaultText8: document.getElementById('defaultText8').value,
        defaultText9: document.getElementById('defaultText9').value,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    closeSettingsModal();
    showToast('Settings saved!', 'success');
});
