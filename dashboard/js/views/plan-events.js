export function isSchoolPlan(event) {
  return /^school plan\s*:/i.test(event.title);
}

export function isOverviewPlan(event) {
  return /^(school|home) plan\s*:/i.test(event.title);
}

export function planTitle(event) {
  return event.title.replace(/^(school|home) plan\s*:\s*/i, '');
}
