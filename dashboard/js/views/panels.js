// Mount each panel only when its tab is selected.
['morning', 'evening'].forEach(function (name) {
  function show(el) {
    if (App.current !== name) return;
    var template = el.querySelector('template');
    if (template) template.replaceWith(template.content.cloneNode(true));
  }

  App.register(name, { show: show, resume: show });
});
