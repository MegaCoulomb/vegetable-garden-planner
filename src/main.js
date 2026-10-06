import './style.css'
import { createIcons, Sprout, LayoutDashboard, CalendarDays, Camera, Plus, Bell, BellOff, Droplets, FlaskConical, ArrowRight, Trash2, Check, X, Leaf, Sun, Pencil, Upload, Download, Printer, Clock3 } from 'lucide'
import { daysBetween, stagesFor, harvestDate, stageAt, nextCareDate, plannedCycles, suggestedPlan, careDatesFor, growComparison, weeklyChecklist } from './schedule.js'
import { makeBackup, readBackup } from './backup.js'

const icons = { Sprout, LayoutDashboard, CalendarDays, Camera, Plus, Bell, BellOff, Droplets, FlaskConical, ArrowRight, Trash2, Check, X, Leaf, Sun, Pencil, Upload, Download, Printer, Clock3 }
const key = 'fieldnotes-garden-v1'
const crops = ['Tomatoes', 'Peppers', 'Lettuce', 'Cucumbers', 'Squash', 'Beans', 'Peas', 'Broccoli', 'Potatoes', 'Calendula', 'Other']
const reference = [
  ['Jan - Mar', 'Start indoors', 'Onions, leeks, peppers, tomatoes, early brassicas'],
  ['Mar - Apr', 'Cool-season beds', 'Peas, lettuce, potatoes, broccoli, cabbage'],
  ['May - Jun', 'Warm-season planting', 'Beans, corn, cucumbers, squash, tomatoes, peppers'],
  ['Jul - Aug', 'Succession & care', 'Beans, lettuce, carrots, beets; monitor irrigation'],
  ['Sep - Nov', 'Fall harvest & planting', 'Fall brassicas, greens, garlic and bulbs'],
]

function todayLocal() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const today = todayLocal()
let grows
try { grows = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(grows)) grows = [] } catch { grows = [] }
let selectedId = grows[0]?.id || null
let view = 'overview'
let toastTimer

const safe = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const icon = (name, size = 18) => `<i data-lucide="${name}" style="width:${size}px;height:${size}px" aria-hidden="true"></i>`
const dateLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const selected = () => grows.find((grow) => grow.id === selectedId) || grows[0]
const notificationSupport = () => 'Notification' in window && window.isSecureContext

function message(text) {
  const element = document.querySelector('#toast')
  element.textContent = text
  element.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => element.classList.remove('visible'), 4000)
}

function persist() {
  try { localStorage.setItem(key, JSON.stringify(grows)); return true }
  catch { message('Storage is full. Remove an old photo and try again.'); return false }
}

function careTasks(grow) {
  if (grow.harvested) return []
  const tasks = ['water', 'feed'].map((kind) => ({ kind, due: nextCareDate(grow, kind, todayLocal()), grow }))
    .filter((task) => task.due && todayLocal() >= grow.startDate)
  tasks.push({ kind: 'harvest', due: harvestDate(grow), grow })
  return tasks
}

function render() {
  const active = selected()
  const tasks = grows.flatMap(careTasks).sort((first, second) => first.due.localeCompare(second.due))
  const due = tasks.filter((task) => task.due <= todayLocal())
  const upcoming = tasks.filter((task) => task.due > todayLocal()).slice(0, 4)
  const startYear = Number(todayLocal().slice(0, 4)) + (Number(todayLocal().slice(5, 7)) >= 10 ? 1 : 0)
  document.querySelector('#app').innerHTML = `
    <div class="shell"><aside class="sidebar">
      <div class="brand">${icon('sprout', 25)} <span>FIELD<span class="brand-light">NOTES</span><small>THE GROW JOURNAL</small></span></div>
      <div class="side-label">WORKSPACE</div><nav aria-label="Main navigation">
      ${[['overview', 'layout-dashboard', 'Overview'], ['planner', 'calendar-days', 'Cycle planner'], ['photos', 'camera', 'Photo journal']].map(([id, symbol, label]) => `<button class="nav-item ${view === id ? 'active' : ''}" data-view="${id}">${icon(symbol)} ${label}</button>`).join('')}</nav>
      <div class="side-bottom"><div class="side-sun">${icon('sun', 21)}</div><strong>Grow with observation.</strong><p>Dates prompt a closer look. Your plants and conditions make the final call.</p><span>WILLAMETTE VALLEY · OR</span></div>
    </aside><div class="main-area"><header class="topbar"><div class="breadcrumb">MY GARDEN <span>/</span> ${view === 'overview' ? 'OVERVIEW' : view === 'planner' ? 'CYCLE PLANNER' : 'PHOTO JOURNAL'}</div><div class="top-actions"><span class="today-label">${icon('calendar-days', 16)} ${dateLabel(todayLocal())}</span><button class="icon-button" id="notifications" title="Reminders while the app is open" aria-label="Enable reminders while the app is open">${icon(notificationSupport() && Notification.permission === 'granted' ? 'bell' : 'bell-off')}</button><div class="avatar">G</div></div></header>
    <main class="content">${view === 'overview' ? overview(due, upcoming, startYear) : view === 'planner' ? planner(active) : photos(active)}</main></div></div>
    <dialog id="grow-dialog"></dialog><div id="toast" role="status" aria-live="polite"></div>`
  const backupActions = document.createElement('span')
  backupActions.className = 'backup-actions'
  backupActions.innerHTML = `<button class="icon-button" id="export-backup" title="Download garden backup" aria-label="Download garden backup">${icon('download', 17)}</button><button class="icon-button" id="restore-backup" title="Restore garden backup" aria-label="Restore garden backup">${icon('upload', 17)}</button><input type="file" id="restore-file" accept="application/json,.json" hidden>`
  document.querySelector('.top-actions').prepend(backupActions)
  createIcons({ icons, attrs: { 'stroke-width': 1.8 } })
  const photoForm = document.querySelector('#photo-form')
  if (photoForm) {
    photoForm.closest('.upload-panel').querySelector('p').textContent = 'Photos stay in this browser unless you choose to send one for AI review.'
    photoForm.closest('section').querySelector('.analysis-note p').textContent = 'AI review describes visible features and can decline unclear images. It cannot verify ripeness or food safety. Only the selected photo is sent for review.'
    const choice = document.createElement('label')
    choice.className = 'vision-choice'
    choice.innerHTML = '<input type="checkbox" id="vision-opt-in"><span>Send this photo for AI visual review<small>Uses an external vision service; requires a configured API key.</small></span>'
    photoForm.querySelector('[type="submit"]').before(choice)
    const activePhotos = [...(active.photos || [])].reverse()
    document.querySelectorAll('.photo-entry').forEach((entry, index) => {
      const review = activePhotos[index]?.review
      if (!review) return
      const details = document.createElement('div')
      details.className = 'review-details'
      for (const [label, text] of [['Image quality', review.imageQuality], ['Visible cues', review.visibleCues], ['Assessment', review.assessment], ['Next check', review.nextCheck]]) {
        const line = document.createElement('p')
        const strong = document.createElement('strong')
        strong.textContent = `${label}: `
        line.append(strong, document.createTextNode(text || 'Not recorded'))
        details.append(line)
      }
      entry.querySelector('strong:not(.photo-entry-head strong)')?.replaceWith(details)
    })
  }
  if (view === 'planner' && active) {
    document.querySelector('.care-grid')?.insertAdjacentHTML('afterend', careCalendar(active))
    const harvestButton = document.querySelector('#toggle-harvest')
    const comparison = growComparison(active)
    const harvestForm = document.createElement('form')
    harvestForm.id = 'harvest-form'
    harvestForm.innerHTML = `<label class="field-label" for="actual-harvest">Actual harvest date</label><div class="harvest-form-controls"><input id="actual-harvest" type="date" required min="${safe(active.startDate)}" max="${todayLocal()}" value="${safe(active.harvestedAt || todayLocal())}"><button class="button outline small" type="submit" ${active.startDate > todayLocal() ? 'disabled' : ''}>${comparison ? 'Update date' : 'Record harvest'}</button>${comparison ? '<button class="button outline small" type="button" id="reopen-grow">Reopen grow</button>' : ''}</div>`
    harvestButton.replaceWith(harvestForm)
    if (comparison) {
      const summary = document.createElement('div')
      summary.className = 'grow-comparison'
      summary.innerHTML = `<span>THEORETICAL <strong>${comparison.plannedDays} days</strong> · ${dateLabel(comparison.planned)}</span><span>OBSERVED <strong>${comparison.actualDays} days</strong> · ${dateLabel(comparison.actual)}</span><span class="${comparison.differenceDays > 0 ? 'late' : ''}">${comparison.differenceDays === 0 ? 'On the estimated date' : `${Math.abs(comparison.differenceDays)} days ${comparison.differenceDays > 0 ? 'later' : 'earlier'}`}</span>`
      harvestForm.after(summary)
    }
  }
}

function overview(due, upcoming, startYear) {
  const today = todayLocal()
  const inProgress = grows.filter((grow) => !grow.harvested && grow.startDate <= today).length
  const harvestSoon = grows.filter((grow) => !grow.harvested && daysBetween(today, harvestDate(grow)) <= 30 && daysBetween(today, harvestDate(grow)) >= 0).length
  return `<div class="page-heading"><div><div class="eyebrow">YOUR GARDEN, IN SEASON</div><h1>Garden at a glance<span class="period">.</span></h1><p>A clear view of what needs attention, and what comes next.</p></div><button class="button primary" id="add-grow">${icon('plus', 17)} Add a grow</button></div>
    <section class="feature"><div class="feature-copy"><span class="feature-kicker">SEASONAL PLANNING / OREGON</span><h2>Every good harvest<br>starts with a plan.</h2><p>Map each crop from seed to harvest. Keep the schedule flexible as your garden changes.</p><button class="text-link" data-view="planner">Open cycle planner ${icon('arrow-right', 17)}</button></div><div class="feature-image" role="img" aria-label="Garden tools and soil ready for planting"></div></section>
    <section class="stats" aria-label="Garden summary"><div><span>ACTIVE GROWS</span><strong>${inProgress}</strong><small>currently growing</small></div><div><span>NEEDS ATTENTION</span><strong>${due.length}</strong><small>care and harvest checks</small></div><div><span>HARVEST CHECKS</span><strong>${harvestSoon}</strong><small>within 30 days</small></div><div><span>TOTAL CYCLES</span><strong>${grows.length}</strong><small>planned and tracked</small></div></section>
    <div class="dashboard-grid"><section class="section-block"><div class="section-heading"><div><span class="eyebrow">YOUR SCHEDULE</span><h2>Growing cycles</h2></div><button class="subtle-link" data-view="planner">View planner ${icon('arrow-right', 16)}</button></div>
    ${grows.length ? `<div class="grow-list">${[...grows].sort((first, second) => first.startDate.localeCompare(second.startDate)).map(growRow).join('')}</div>` : `<div class="empty-state">${icon('sprout', 28)}<h3>Your garden starts here</h3><p>Add your first crop or create four editable annual cycles.</p><button class="button outline" id="add-grow-empty">${icon('plus', 16)} Add a grow</button></div>`}
    </section><section class="section-block attention"><div class="section-heading"><div><span class="eyebrow">STAY ON TRACK</span><h2>What needs a look</h2></div>${icon('clock-3', 19)}</div>
    ${due.length ? `<div class="task-list">${due.slice(0, 5).map(taskRow).join('')}</div>` : `<div class="quiet-state">${icon('check', 22)}<strong>All clear for now</strong><p>No checks are due today.</p></div>`}
    ${upcoming.length ? `<div class="upcoming-title">COMING UP</div><div class="task-list compact">${upcoming.map(taskRow).join('')}</div>` : ''}</section></div>
    <section class="reference"><div><span class="eyebrow">FROM YOUR GARDEN CALENDAR</span><h2>Seasonal guide</h2><p>Willamette Valley reference windows. Frost, soil, weather and cultivar always take precedence.</p></div><div class="reference-list">${reference.map(([window, title, detail]) => `<div><span>${window}</span><strong>${title}</strong><small>${detail}</small></div>`).join('')}</div></section>
    <div class="starter"><div><strong>Plan your year in one click</strong><p>Create a four-crop vegetable season for ${startYear}: peppers and tomatoes started indoors, spring lettuce and summer beans outdoors. Adjust every date to your garden.</p></div><div class="starter-controls"><label for="plan-year">Year</label><input type="number" id="plan-year" min="2020" max="2100" value="${startYear}"><button class="button outline" id="plan-year-button">${icon('plus', 16)} Plan a season</button></div></div>`
}

function growRow(grow) {
  const total = grow.durations.reduce((sum, days) => sum + Number(days), 0)
  const progress = Math.max(0, Math.min(100, Math.round(daysBetween(grow.startDate, todayLocal()) / total * 100)))
  return `<button class="grow-row" data-select="${safe(grow.id)}"><span class="crop-mark ${grow.location === 'Outdoor' ? 'outdoor' : ''}">${icon(grow.location === 'Outdoor' ? 'sun' : 'leaf', 19)}</span><span class="grow-name"><strong>${safe(grow.name)}</strong><small>${safe(grow.crop)}${grow.variety ? ` · ${safe(grow.variety)}` : ''} · ${safe(grow.location)}</small></span><span class="row-progress"><span class="progress-bar"><i style="width:${progress}%"></i></span><small>${grow.harvested ? 'Harvested' : stageAt(grow, todayLocal())}</small></span><span class="row-date"><small>HARVEST CHECK</small>${dateLabel(harvestDate(grow))}</span>${icon('arrow-right', 17)}</button>`
}

function taskRow(task) {
  const overdue = daysBetween(task.due, todayLocal())
  const label = overdue > 0 ? `${overdue}d overdue` : overdue === 0 ? 'Today' : dateLabel(task.due)
  const title = task.kind === 'water' ? 'Water check' : task.kind === 'feed' ? 'Feed check' : 'Harvest inspection'
  return `<button class="task-row" data-select="${safe(task.grow.id)}"><span class="task-symbol ${task.kind}">${icon(task.kind === 'water' ? 'droplets' : task.kind === 'feed' ? 'flask-conical' : 'sprout', 18)}</span><span><strong>${title}</strong><small>${safe(task.grow.name)} · ${safe(task.grow.crop)}</small></span><em class="${overdue >= 0 ? 'due' : ''}">${label}</em></button>`
}

function picker(active) {
  return `<label class="picker-label" for="grow-picker">SELECT CYCLE</label><select id="grow-picker">${grows.map((grow) => `<option value="${safe(grow.id)}" ${grow.id === active?.id ? 'selected' : ''}>${safe(grow.name)} · ${safe(grow.crop)}</option>`).join('')}</select>`
}

function printChecklist(grow) {
  const weeks = weeklyChecklist(grow)
  const comparison = growComparison(grow)
  document.querySelector('#print-sheet')?.remove()
  const sheet = document.createElement('section')
  sheet.id = 'print-sheet'
  sheet.innerHTML = `<header class="print-header"><span>FIELDNOTES / WEEKLY GROW CHECKLIST</span><h1>${safe(grow.name)}</h1><p>${safe(grow.crop)}${grow.variety ? ` · ${safe(grow.variety)}` : ''} · ${safe(grow.location)}</p><div class="print-meta"><span>Started <strong>${dateLabel(grow.startDate)}</strong></span><span>Estimated harvest check <strong>${dateLabel(harvestDate(grow))}</strong></span>${comparison ? `<span>Actual harvest <strong>${dateLabel(comparison.actual)} (${comparison.actualDays} days)</strong></span>` : ''}</div>${grow.notes ? `<p class="print-notes">Grow notes: ${safe(grow.notes)}</p>` : ''}<p class="print-caveat">These dates are planning prompts. Check the plant, growing medium, and conditions before watering, feeding, or harvesting.</p></header>
    ${weeks.map((week, index) => `<section class="print-week"><div class="print-week-header"><h2>Week ${index + 1}</h2><span>${dateLabel(week.start)} - ${dateLabel(week.end)}</span></div><table><thead><tr><th>Date</th><th>Stage</th><th>Checks and observations</th></tr></thead><tbody>${week.days.map((entry) => `<tr><td>${dateLabel(entry.date)}</td><td>${safe(entry.stage)}</td><td>${entry.tasks.length ? entry.tasks.map((task) => `<div class="print-task"><span class="print-check"></span>${safe(task)}</div>`).join('') : '<span class="print-blank">Observation: ____________________________________</span>'}</td></tr>`).join('')}</tbody></table><div class="print-week-notes">Week notes: ___________________________________________________________________________</div></section>`).join('')}`
  document.body.append(sheet)
  window.print()
}

function careCalendar(grow) {
  const start = todayLocal() > grow.startDate ? todayLocal() : grow.startDate
  const events = ['water', 'feed'].flatMap((kind) => careDatesFor(grow, kind, start, 200).map((date) => ({ kind, date })))
    .sort((first, second) => first.date.localeCompare(second.date) || first.kind.localeCompare(second.kind))
  return `<section class="care-calendar"><div class="section-heading"><div><span class="eyebrow">AUTOMATICALLY PLANNED</span><h2>Care check dates</h2></div><span class="muted">From ${dateLabel(start)}</span></div>
    ${events.length ? `<div class="care-event-list">${events.slice(0, 8).map((event) => `<div><time>${dateLabel(event.date)}</time><strong>${event.kind === 'water' ? 'Check water needs' : 'Review feeding needs'}</strong><span>${stageAt(grow, event.date)}</span></div>`).join('')}</div>${events.length > 8 ? `<details><summary>Show ${events.length} scheduled checks</summary><div class="care-event-list">${events.map((event) => `<div><time>${dateLabel(event.date)}</time><strong>${event.kind === 'water' ? 'Check water needs' : 'Review feeding needs'}</strong><span>${stageAt(grow, event.date)}</span></div>`).join('')}</div></details>` : ''}` : '<p>No future care checks scheduled for this cycle.</p>'}
    <p class="table-note">Check the growing medium and plant before watering or feeding. These dates are prompts, not fixed doses.</p></section>`
}

function planner(active) {
  return `<div class="page-heading"><div><div class="eyebrow">PLAN & ADAPT</div><h1>Cycle planner<span class="period">.</span></h1><p>Your growing timeline, care rhythm and harvest inspection.</p></div><button class="button primary" id="add-grow">${icon('plus', 17)} Add a grow</button></div>
    ${!active ? `<div class="empty-state spacious">${icon('calendar-days', 30)}<h3>No cycles yet</h3><p>Add a plant to build its lifecycle table.</p><button class="button outline" id="add-grow-empty">Add a grow</button></div>` : `
    <div class="planner-toolbar">${picker(active)}<span class="pill">${icon(active.location === 'Outdoor' ? 'sun' : 'leaf', 15)} ${safe(active.location)}</span><button class="button outline small" id="print-grow">${icon('printer', 15)} Print weekly checklist</button><button class="button outline small" id="edit-grow">${icon('pencil', 15)} Edit cycle</button><button class="icon-button danger" id="delete-grow" title="Delete cycle" aria-label="Delete cycle">${icon('trash-2', 17)}</button></div>
    <div class="cycle-heading"><div><span class="eyebrow">${safe(active.crop).toUpperCase()} ${active.variety ? '/ ' + safe(active.variety).toUpperCase() : ''}</span><h2>${safe(active.name)}</h2><p>${safe(active.notes) || 'Keep notes on your cultivar, conditions and observations.'}</p></div><div class="harvest-callout"><span>ESTIMATED HARVEST CHECK</span><strong>${dateLabel(harvestDate(active))}</strong><small>Inspection date, not a maturity guarantee</small></div></div>
    <section class="timeline-section"><div class="section-heading"><div><span class="eyebrow">SEED TO HARVEST</span><h2>Lifecycle table</h2></div><span class="muted">Change stage lengths via Edit cycle</span></div><div class="timeline-table"><div class="table-head"><span>STAGE</span><span>START</span><span>END / NEXT STAGE</span><span>DURATION</span><span>STATUS</span></div>${stagesFor(active).map((stage, index) => `<div class="table-row"><span><b class="stage-number">0${index + 1}</b><strong>${stage.label}</strong></span><span>${dateLabel(stage.start)}</span><span>${dateLabel(stage.end)}</span><span>${stage.days} days</span><span class="${!active.harvested && stageAt(active, todayLocal()) === stage.label ? 'stage-current' : 'muted'}">${!active.harvested && stageAt(active, todayLocal()) === stage.label ? 'Current' : stage.end <= todayLocal() ? 'Passed' : 'Upcoming'}</span></div>`).join('')}</div><p class="table-note">Estimated dates are your editable planning assumptions. Inspect plant and conditions before harvest.</p></section>
    <div class="care-grid"><section class="care-panel"><span class="eyebrow">RECURRING CARE</span><h2>Water & feed</h2><div class="care-line"><span class="task-symbol water">${icon('droplets', 18)}</span><div><strong>Water check</strong><small>${active.harvested ? 'Finished' : active.waterEvery ? `Every ${active.waterEvery} days · next ${dateLabel(nextCareDate(active, 'water', todayLocal()))}` : 'Not scheduled'}</small></div><button class="button outline small" data-complete="water" ${active.harvested || !active.waterEvery ? 'disabled' : ''}>Done today</button></div><div class="care-line"><span class="task-symbol feed">${icon('flask-conical', 18)}</span><div><strong>Feed check</strong><small>${active.harvested ? 'Finished' : active.feedEvery ? `Every ${active.feedEvery} days · next ${dateLabel(nextCareDate(active, 'feed', todayLocal()))}` : 'Not scheduled'}</small></div><button class="button outline small" data-complete="feed" ${active.harvested || !active.feedEvery ? 'disabled' : ''}>Done today</button></div><p class="table-note">Intervals are reminders to check needs, not automatic watering or feeding instructions.</p></section><section class="care-panel"><span class="eyebrow">HARVEST LOG</span><h2>Close the loop</h2><p>Record when you actually harvested. Your estimated date stays visible for comparison.</p><button class="button ${active.harvested ? 'outline' : 'dark'}" id="toggle-harvest">${icon('check', 16)} ${active.harvested ? 'Mark as growing' : 'Mark harvested'}</button><button class="text-link photo-cta" data-view="photos">View photo journal ${icon('arrow-right', 16)}</button></section></div>`}`
}

function photos(active) {
  return `<div class="page-heading"><div><div class="eyebrow">VISUAL HISTORY</div><h1>Photo journal<span class="period">.</span></h1><p>Keep a visual record alongside your growing schedule.</p></div></div>
    ${!active ? `<div class="empty-state spacious">${icon('camera', 30)}<h3>No plants to photograph yet</h3><p>Add a grow first, then record its progress.</p><button class="button outline" id="add-grow-empty">Add a grow</button></div>` : `<div class="photo-toolbar">${picker(active)}<span class="pill">${safe(active.crop)}</span></div>
    <div class="photo-layout"><section><div class="upload-panel"><div class="upload-icon">${icon('upload', 26)}</div><h2>Add an observation</h2><p>Choose a clear, well-lit photo. Images stay in this browser; they are not sent to a server.</p><form id="photo-form"><label class="file-drop" for="photo-file">${icon('camera', 19)} Choose photo<input id="photo-file" name="photo" type="file" accept="image/*" required></label><span id="file-name"></span><label class="field-label" for="photo-note">What do you notice?</label><textarea id="photo-note" name="note" placeholder="Color, growth, weather, or anything worth remembering..." rows="3"></textarea><button type="submit" class="button primary">${['Tomatoes', 'Peppers'].includes(active.crop) ? 'Check color & save' : 'Save photo'} ${icon('arrow-right', 16)}</button></form></div><div class="analysis-note"><strong>About photo feedback</strong><p>For tomatoes and peppers, the app measures visible red/orange versus green pixels as a color cue. For other plants, it records the image but cannot infer maturity. Lighting, cultivar and what is in frame can change the result. No food-safety assessment is provided.</p></div></section><section><div class="section-heading"><div><span class="eyebrow">FIELD RECORD</span><h2>${safe(active.name)} observations</h2></div><span class="muted">${(active.photos || []).length} ${(active.photos || []).length === 1 ? 'photo' : 'photos'}</span></div>${(active.photos || []).length ? `<div class="photo-list">${[...active.photos].reverse().map((photo) => `<article class="photo-entry"><img src="${photo.image}" alt="Garden observation for ${safe(active.name)}"><div><div class="photo-entry-head"><span>${dateLabel(photo.added)}</span><button class="icon-button danger" data-delete-photo="${safe(photo.id)}" aria-label="Delete photo" title="Delete photo">${icon('trash-2', 16)}</button></div><strong>${safe(photo.analysis)}</strong><p>${safe(photo.note || 'No observation added.')}</p></div></article>`).join('')}</div>` : `<div class="empty-state photo-empty">${icon('camera', 28)}<h3>No photos yet</h3><p>Your observations will appear here.</p></div>`}</section></div>`}`
}

function openForm(grow) {
  const dialog = document.querySelector('#grow-dialog')
  const editing = Boolean(grow)
  const data = grow || { name: '', crop: 'Tomatoes', variety: '', location: 'Outdoor', startDate: todayLocal(), ...suggestedPlan('Tomatoes', 'Outdoor'), notes: '' }
  dialog.innerHTML = `<form id="grow-form"><div class="dialog-header"><div><span class="eyebrow">${editing ? 'UPDATE CYCLE' : 'NEW CYCLE'}</span><h2>${editing ? 'Edit your grow' : 'Add a grow'}</h2></div><button type="button" class="icon-button" id="close-dialog" aria-label="Close">${icon('x', 20)}</button></div><div class="form-grid"><label class="wide">Cycle name<input name="name" required maxlength="60" placeholder="e.g. Spring tomatoes" value="${safe(data.name)}"></label><label>Crop<select name="crop">${crops.map((crop) => `<option ${data.crop === crop ? 'selected' : ''}>${crop}</option>`).join('')}</select></label><label>Variety / cultivar<input name="variety" maxlength="60" placeholder="Optional" value="${safe(data.variety)}"></label><label>Location<select name="location"><option ${data.location === 'Indoor' ? 'selected' : ''}>Indoor</option><option ${data.location === 'Outdoor' ? 'selected' : ''}>Outdoor</option></select></label><label>Seed / start date<input name="startDate" type="date" required value="${safe(data.startDate)}"></label></div><div class="form-subheading">STAGE LENGTHS <span>Days · editable estimates</span></div><div class="form-grid four">${['Establish', 'Grow', 'Flower / fruit', 'Finish'].map((label, index) => `<label>${label}<input name="stage${index}" type="number" min="1" max="365" required value="${Number(data.durations[index])}"></label>`).join('')}</div><div class="form-subheading">CARE CHECKS <span>0 = off</span></div><div class="form-grid"><label>Water check every (days)<input name="waterEvery" type="number" min="0" max="365" value="${Number(data.waterEvery)}"></label><label>Feed check every (days)<input name="feedEvery" type="number" min="0" max="365" value="${Number(data.feedEvery)}"></label><label class="wide">Notes<textarea name="notes" rows="2" maxlength="500" placeholder="Conditions, observations, cultivar details...">${safe(data.notes)}</textarea></label></div><div class="dialog-actions"><button type="button" class="button outline" id="cancel-dialog">Cancel</button><button type="submit" class="button primary">${editing ? 'Save changes' : 'Add cycle'}</button></div></form>`
  const nameInput = dialog.querySelector('[name="name"]')
  nameInput.required = false
  nameInput.placeholder = 'Optional; uses variety if blank'
  nameInput.closest('label').firstChild.textContent = 'Cycle name (optional)'
  const generate = document.createElement('div')
  generate.className = 'generate-controls'
  generate.innerHTML = '<button type="button" class="button outline small" id="generate-plan">Recalculate suggested schedule</button><small>Estimates depend on crop and location. Check your seed packet for days to maturity.</small>'
  dialog.querySelector('.form-subheading').after(generate)
  const applySuggestion = () => {
    const plan = suggestedPlan(dialog.querySelector('[name="crop"]').value, dialog.querySelector('[name="location"]').value)
    plan.durations.forEach((length, index) => { dialog.querySelector(`[name="stage${index}"]`).value = length })
    dialog.querySelector('[name="waterEvery"]').value = plan.waterEvery
    dialog.querySelector('[name="feedEvery"]').value = plan.feedEvery
  }
  dialog.querySelector('#generate-plan').addEventListener('click', applySuggestion)
  createIcons({ icons, attrs: { 'stroke-width': 1.8 } })
  dialog.showModal()
  dialog.querySelector('[name="crop"]').addEventListener('change', () => { if (!editing) applySuggestion() })
  dialog.querySelector('[name="location"]').addEventListener('change', () => { if (!editing) applySuggestion() })
  dialog.querySelector('#grow-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const form = new FormData(event.target)
    const updated = { ...data, id: data.id || crypto.randomUUID(), name: form.get('name').trim() || form.get('variety').trim() || `${form.get('crop')} grow`, crop: form.get('crop'), variety: form.get('variety').trim(), location: form.get('location'), startDate: form.get('startDate'), durations: [0, 1, 2, 3].map((index) => Number(form.get(`stage${index}`))), waterEvery: Number(form.get('waterEvery')), feedEvery: Number(form.get('feedEvery')), notes: form.get('notes').trim(), photos: data.photos || [], harvested: data.harvested || false }
    if (editing) grows = grows.map((item) => item.id === grow.id ? updated : item)
    else grows.push(updated)
    selectedId = updated.id
    if (persist()) { dialog.close(); view = 'planner'; render(); message(editing ? 'Cycle updated.' : 'Cycle added.') }
  })
  dialog.querySelector('#close-dialog').onclick = () => dialog.close()
  dialog.querySelector('#cancel-dialog').onclick = () => dialog.close()
}

async function processPhoto(file, crop) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a photo smaller than 15 MB.')
  const image = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 720 / Math.max(image.width, image.height))
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  let analysis = 'Photo saved. Compare visible changes over time; this app cannot determine maturity for this crop.'
  if (['Tomatoes', 'Peppers'].includes(crop)) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let warm = 0; let green = 0
    for (let index = 0; index < pixels.length; index += 16) {
      const red = pixels[index]; const mid = pixels[index + 1]; const blue = pixels[index + 2]
      if (red > 65 && red > mid * 1.2 && red > blue * 1.4) warm++
      if (mid > 50 && mid > red * 1.15 && mid > blue * 1.1) green++
    }
    analysis = warm > green * 1.4 && warm > pixels.length / 160 ? 'Warm red/orange tones are prominent in the image. Confirm on the fruit itself.' : green > warm * 1.4 && green > pixels.length / 160 ? 'Green tones are prominent in the image. Check fruit directly before harvesting.' : 'Mixed or unclear color in this image. Check the fruit directly.'
  }
  return { image: canvas.toDataURL('image/jpeg', 0.68), analysis }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button')
  if (!button) return
  if (button.dataset.view) { view = button.dataset.view; render(); return }
  if (button.dataset.select) { selectedId = button.dataset.select; view = 'planner'; render(); return }
  if (button.id === 'export-backup') {
    const url = URL.createObjectURL(new Blob([makeBackup(grows)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `fieldnotes-garden-${todayLocal()}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    message('Garden backup downloaded, including photos and observations.')
    return
  }
  if (button.id === 'restore-backup') { document.querySelector('#restore-file').click(); return }
  if (button.id === 'add-grow' || button.id === 'add-grow-empty') { openForm(); return }
  if (button.id === 'print-grow') { printChecklist(selected()); return }
  if (button.id === 'edit-grow') { openForm(selected()); return }
  if (button.id === 'delete-grow') {
    if (!confirm(`Delete ${selected().name} and its photos?`)) return
    grows = grows.filter((grow) => grow.id !== selectedId)
    selectedId = grows[0]?.id || null
    if (persist()) { render(); message('Cycle deleted.') }
    return
  }
  if (button.id === 'plan-year-button') {
    const year = Number(document.querySelector('#plan-year').value)
    if (!Number.isInteger(year) || year < 2020 || year > 2100) { message('Choose a year between 2020 and 2100.'); return }
    if (grows.some((grow) => grow.templateYear === year)) { message(`A ${year} starter plan already exists.`); return }
    const cycles = plannedCycles(year).map((cycle) => ({ ...cycle, id: crypto.randomUUID(), templateYear: year }))
    grows.push(...cycles); selectedId = cycles[0].id
    if (persist()) { view = 'planner'; render(); message('Four editable crops added.') }
    return
  }
  if (button.dataset.complete) {
    const grow = selected()
    if (button.dataset.complete === 'water') grow.lastWatered = todayLocal()
    else grow.lastFed = todayLocal()
    if (persist()) { render(); message('Check recorded. Next reminder updated.') }
    return
  }
  if (button.id === 'toggle-harvest') { selected().harvested = !selected().harvested; if (persist()) render(); return }
  if (button.id === 'reopen-grow') {
    const grow = selected()
    grow.harvested = false
    grow.harvestedAt = ''
    grow.harvestedPlanDate = ''
    if (persist()) { render(); message('Grow reopened.') }
    return
  }
  if (button.dataset.deletePhoto) {
    const grow = selected()
    grow.photos = grow.photos.filter((photo) => photo.id !== button.dataset.deletePhoto)
    if (persist()) { render(); message('Photo removed.') }
    return
  }
  if (button.id === 'notifications') {
    if (!notificationSupport()) { message('Notifications require a supported browser on localhost or HTTPS.'); return }
    const permission = await Notification.requestPermission()
    render()
    if (permission === 'granted') { message('Reminders are on while this app is open.'); notifyDue() }
    else message('Notifications were not enabled.')
  }
})

document.addEventListener('change', (event) => {
  if (event.target.id === 'grow-picker') { selectedId = event.target.value; render() }
  if (event.target.id === 'photo-file') document.querySelector('#file-name').textContent = event.target.files[0]?.name || ''
  if (event.target.id === 'restore-file' && event.target.files[0]) {
    const file = event.target.files[0]
    file.text().then((text) => {
      const restored = readBackup(text)
      if (!confirm(`Replace the current garden with ${restored.length} backed-up cycles? Download a backup first if needed.`)) return
      const current = grows
      grows = restored
      if (!persist()) { grows = current; return }
      selectedId = grows[0]?.id || null
      view = 'overview'
      render()
      message('Garden restored from backup.')
    }).catch((error) => message(error.message || 'Could not restore this backup.'))
  }
})

document.addEventListener('submit', async (event) => {
  if (event.target.id === 'harvest-form') {
    event.preventDefault()
    const grow = selected()
    const actual = event.target.querySelector('#actual-harvest').value
    if (!/^\d{4}-\d{2}-\d{2}$/.test(actual) || actual < grow.startDate || actual > todayLocal()) { message('Choose a harvest date between the start date and today.'); return }
    grow.harvestedPlanDate ||= harvestDate(grow)
    grow.harvestedAt = actual
    grow.harvested = true
    if (persist()) { render(); message('Actual harvest date recorded.') }
    return
  }
  if (event.target.id !== 'photo-form') return
  event.preventDefault()
  const grow = selected()
  const file = event.target.querySelector('#photo-file').files[0]
  if (!file) return
  const review = event.target.querySelector('#vision-opt-in').checked
  const submit = event.target.querySelector('[type="submit"]')
  submit.disabled = true; submit.textContent = review ? 'Reviewing photo...' : 'Saving photo...'
  try {
    const result = await processPhoto(file, grow.crop)
    let reviewError = ''
    if (review) {
      try {
        const response = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crop: grow.crop, image: result.image }),
        })
        const report = await response.json()
        if (!response.ok) throw new Error(report.error || 'Vision review unavailable.')
        result.review = { ...report, reviewedAt: todayLocal(), model: 'OpenAI' }
        result.analysis = `${report.imageQuality === 'insufficient' ? 'Unable to assess from this photo.' : 'AI visual observation, not a harvest verdict.'}\nVisible: ${report.visibleCues}\nAssessment: ${report.assessment}\nNext check: ${report.nextCheck}`
      } catch (error) { reviewError = error.message || 'Vision review unavailable.' }
    }
    grow.photos ||= []
    grow.photos.push({ ...result, id: crypto.randomUUID(), added: todayLocal(), note: event.target.querySelector('#photo-note').value.trim() })
    if (persist()) { render(); message(reviewError ? `${reviewError} Photo saved locally without AI review.` : review ? 'Visual review and photo saved.' : 'Photo observation saved.') }
    else grow.photos.pop()
  } catch (error) { message(error.message || 'Could not read this photo. Try another image.'); submit.disabled = false; submit.textContent = 'Save photo' }
})

function notifyDue() {
  if (!notificationSupport() || Notification.permission !== 'granted') return
  const due = grows.flatMap(careTasks).filter((task) => task.due <= todayLocal())
  if (!due.length || localStorage.getItem(`${key}-notified`) === todayLocal()) return
  new Notification('Fieldnotes · garden checks due', { body: `${due.length} care or harvest ${due.length === 1 ? 'check needs' : 'checks need'} your attention.` })
  localStorage.setItem(`${key}-notified`, todayLocal())
}

render()
notifyDue()
setInterval(notifyDue, 60000)