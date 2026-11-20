(function () {
  'use strict';

  var PROFILE_LABELS = {
    general: 'Многопрофильная',
    dental: 'Стоматология'
  };

  var ROLE_LABELS = {
    operator: 'Оператор',
    doctor: 'Врач'
  };

  var roles = Object.keys(ROLE_LABELS);
  var profiles = Object.keys(PROFILE_LABELS);

  var state = { role: 'operator', profile: 'dental' };

  function parseHash() {
    var raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) return null;
    var parts = raw.split('/');
    var role = parts[0];
    var profile = parts[1];
    if (!roles.includes(role) || !profiles.includes(profile)) return null;
    return { role: role, profile: profile };
  }

  function parseQuery() {
    var params = new URLSearchParams(window.location.search);
    var role = params.get('role');
    var profile = params.get('profile');
    if (roles.includes(role) && profiles.includes(profile)) {
      return { role: role, profile: profile };
    }
    return null;
  }

  function setPressed() {
    document.querySelectorAll('[data-role]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-role') === state.role));
    });
    document.querySelectorAll('[data-profile]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-profile') === state.profile));
    });
  }

  function setVisibility() {
    document.querySelectorAll('[data-roles], [data-profiles]').forEach(function (element) {
      var rolesAttr = element.getAttribute('data-roles');
      var profilesAttr = element.getAttribute('data-profiles');
      var elementRoles = rolesAttr ? rolesAttr.split(/\s+/) : roles;
      var elementProfiles = profilesAttr ? profilesAttr.split(/\s+/) : profiles;
      var visible = elementRoles.includes(state.role) && elementProfiles.includes(state.profile);
      element.hidden = !visible;
    });
  }

  function setHash() {
    var next = '#' + state.role + '/' + state.profile;
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next);
    }
  }

  function updateTitle() {
    document.title = 'Анкеты пациентов — ' + ROLE_LABELS[state.role] + ', ' + PROFILE_LABELS[state.profile];
  }

  function updateToc() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a')).filter(function (link) {
      return !link.hidden;
    });

    var offset = parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue('--manual-anchor-offset')
    ) + 8;
    var items = links.map(function (link) {
      var id = link.getAttribute('href').replace(/^#/, '');
      var target = document.getElementById(id);
      if (!target) return null;

      // Для сценария внутри большого раздела подсвечиваем пункт с начала
      // самого раздела, а не только когда доскроллили до его середины.
      var anchor = target.classList.contains('profile-block')
        ? target.closest('.panel') || target
        : target;

      return { link: link, anchor: anchor };
    }).filter(Boolean);

    if (!items.length) return;

    var current = items[0].link;
    items.forEach(function (item) {
      if (item.anchor.getBoundingClientRect().top <= offset) current = item.link;
    });

    // Последний раздел может не дойти до верхней линии: у конца страницы
    // подсвечиваем его, иначе оглавление остаётся на предыдущем пункте.
    var atBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 2;
    if (atBottom) current = items[items.length - 1].link;

    links.forEach(function (link) {
      link.classList.toggle('is-active', link === current);
    });
  }

  function apply() {
    setPressed();
    setVisibility();
    updateTitle();
    setHash();
    window.requestAnimationFrame(updateToc);
  }

  function init() {
    var fromHash = parseHash();
    var fromQuery = parseQuery();
    var initial = fromHash || fromQuery;
    if (initial) {
      state.role = initial.role;
      state.profile = initial.profile;
    }

    document.querySelectorAll('[data-role]').forEach(function (button) {
      button.addEventListener('click', function () {
        var role = button.getAttribute('data-role');
        if (!roles.includes(role)) return;
        state.role = role;
        apply();
      });
    });

    document.querySelectorAll('[data-profile]').forEach(function (button) {
      button.addEventListener('click', function () {
        var profile = button.getAttribute('data-profile');
        if (!profiles.includes(profile)) return;
        state.profile = profile;
        apply();
      });
    });

    document.querySelectorAll('.toc a').forEach(function (link) {
      link.addEventListener('click', function () {
        window.setTimeout(updateToc, 80);
      });
    });

    window.addEventListener('scroll', function () {
      window.requestAnimationFrame(updateToc);
    }, { passive: true });

    window.addEventListener('hashchange', function () {
      var next = parseHash();
      if (!next) return;
      if (next.role === state.role && next.profile === state.profile) return;
      state.role = next.role;
      state.profile = next.profile;
      apply();
    });

    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
