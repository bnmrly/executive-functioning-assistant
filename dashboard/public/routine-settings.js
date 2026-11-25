(function () {
  'use strict';

  const morningSections = [
    {
      name: RoutinePoints.sectionNames.toilet,
      key: "toilet",
      accent: "water",
      tasks: [
        ["toilet", "Go to the toilet"],
        ["wipe", "Wipe myself"],
        ["wash-hands", "Wash my hands"],
        ["dry-hands", "Dry my hands"],
      ],
    },
    {
      name: RoutinePoints.sectionNames.care,
      key: "care",
      accent: "teeth",
      tasks: [
        ["clean-teeth", "Clean my teeth"],
        ["wash-face", "Wash my face"],
      ],
    },
    {
      name: RoutinePoints.sectionNames.dressed,
      key: "dressed",
      accent: "bag",
      tasks: [
        ["pants", "Put pants on"],
        ["socks", "Put socks on"],
        ["dress-leggings", "Put dress or leggings on"],
        ["top", "Put top on"],
        ["cardigan", "Put cardigan on"],
      ],
    },
    {
      name: RoutinePoints.sectionNames.hair,
      key: "hair",
      accent: "teeth",
      tasks: [["hair", "Get Mummy or Daddy to brush my hair"]],
    },
  ];

  const eveningSections = [
    morningSections[0],
    morningSections[1],
    { name: RoutinePoints.sectionNames.bedtime, key: "bedtime", accent: "bag", tasks: [["pyjamas", "Put on pyjamas"]] },
    { name: RoutinePoints.sectionNames.clean, key: "clean", accent: "teeth", tasks: [["clean-something", "Clean something"]] },
  ];

  const defaults = { morning: morningSections, evening: eveningSections };
  const routineKey = routine => 'dashboard-routine-v1:' + routine;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function sections(routine) {
    const fallback = defaults[routine];
    if (!fallback) return [];
    const saved = read(routineKey(routine), null);
    return structuredClone(Array.isArray(saved) && saved.length ? saved : fallback);
  }

  function saveSections(routine, groups) {
    if (!defaults[routine] || !groups.length || groups.some(group =>
      !group.name.trim() || !group.tasks.length || group.tasks.some(([, title]) => !title.trim())
    )) throw new Error('Each routine needs at least one named section and each section needs a task.');
    localStorage.setItem(routineKey(routine), JSON.stringify(groups));
  }

  // Remove retired Today’s notes while preserving the rest of this origin’s data.
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith('dashboard-plan-note-v1:')) localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in some browser contexts.
  }

  window.DashboardRoutines = {
    routineKey, sections, saveSections,
    isCustom: routine => Array.isArray(read(routineKey(routine), null)),
  };
})();
