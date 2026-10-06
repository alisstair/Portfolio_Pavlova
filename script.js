(function(){
  var stage = document.getElementById('stage');
  var track = document.getElementById('track');
  var rail  = document.getElementById('rail');
  var fill  = document.getElementById('fill');
  var count = document.getElementById('count');
  var mark  = document.getElementById('mark');
  var panels = Array.prototype.slice.call(track.querySelectorAll('.panel'));
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // та же граница, что в css: шире 960px и в ландшафте — горизонтальная лента, иначе колонка
  var wide = window.matchMedia('(min-width: 960px) and (orientation: landscape)');

  var pad = function(n){ return (n < 10 ? '0' : '') + n; };
  var each = function(list, fn){ Array.prototype.forEach.call(list, fn); };
  count.textContent = pad(1) + ' / ' + pad(panels.length);

  // ---------- засечки шкалы ----------

  var ticks = panels.map(function(p, i){
    var b = document.createElement('button');
    b.className = 'tick';
    b.type = 'button';
    b.setAttribute('aria-label', 'лист ' + (i + 1) + ', ' + p.dataset.tag);
    b.addEventListener('click', function(){ go(i); });
    rail.appendChild(b);
    return b;
  });

  function layout(){
    ticks.forEach(function(b, i){
      b.style.left = (panels.length === 1 ? 0 : (i / (panels.length - 1)) * 100) + '%';
    });
  }
  layout();

  // ---------- переход к листу ----------

  function edge(){ return parseFloat(getComputedStyle(track).paddingLeft) || 0; }

  // лист шире экрана (кейсы в ленте) — к его началу, остальные — по центру
  function leftFor(p){
    return p.offsetWidth > stage.clientWidth - 2 * edge()
      ? p.offsetLeft - edge()
      : p.offsetLeft - (stage.clientWidth - p.offsetWidth) / 2;
  }

  function go(i, instant){
    wheelStop();
    var p = panels[i];
    var behavior = calm || instant ? 'auto' : 'smooth';
    if (wide.matches){
      stage.scrollTo({ left: leftFor(p), behavior: behavior });
    } else {
      window.scrollTo({ top: p.getBoundingClientRect().top + window.pageYOffset - 16, behavior: behavior });
    }
  }

  // ---------- шкала и счётчик ----------

  // расстояние от середины экрана до листа: 0, если середина попала на лист
  function dist(a, b, mid){ return mid < a ? a - mid : mid > b ? mid - b : 0; }

  var active = -1;
  function paint(){
    var ratio, near = 0, best = Infinity;

    if (wide.matches){
      var max = stage.scrollWidth - stage.clientWidth;
      ratio = max > 0 ? stage.scrollLeft / max : 0;
      var mid = stage.scrollLeft + stage.clientWidth / 2;
      panels.forEach(function(p, i){
        var d = dist(p.offsetLeft, p.offsetLeft + p.offsetWidth, mid);
        if (d < best){ best = d; near = i; }
      });
    } else {
      var maxY = document.documentElement.scrollHeight - window.innerHeight;
      ratio = maxY > 0 ? window.pageYOffset / maxY : 0;
      var midY = window.innerHeight / 2;
      panels.forEach(function(p, i){
        var r = p.getBoundingClientRect();
        var d = dist(r.top, r.bottom, midY);
        if (d < best){ best = d; near = i; }
      });
    }
    // короткий последний лист может так и не дойти до середины экрана
    if (ratio > 0.995) near = panels.length - 1;

    fill.style.width = (Math.min(1, Math.max(0, ratio)) * 100) + '%';
    if (near !== active){
      active = near;
      count.textContent = pad(near + 1) + ' / ' + pad(panels.length);
      ticks.forEach(function(b, i){ b.setAttribute('aria-current', i === near ? 'true' : 'false'); });
      mark.classList.toggle('on', near > 0);
    }
  }
  paint();

  var queued = false;
  function schedule(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(function(){ paint(); queued = false; });
  }
  stage.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function(){ layout(); paint(); });

  // повернули планшет или растянули окно через границу — остаёмся на том же листе
  function onMode(){
    var keep = Math.max(active, 0);
    wheelStop();
    stage.classList.remove('is-dragging');
    down = false;
    // к событию change новые медиазапросы уже применены, кадр ждать не нужно
    setTimeout(function(){ go(keep, true); paint(); }, 0);
  }
  if (wide.addEventListener) wide.addEventListener('change', onMode);
  else wide.addListener(onMode);

  // ---------- колесо мыши: по вертикали двигает ленту, плавно догоняя цель ----------

  var wheelTo = null, wheelPos = 0, wheelRaf = 0;

  function wheelStop(){
    if (wheelRaf) cancelAnimationFrame(wheelRaf);
    wheelRaf = 0; wheelTo = null;
  }

  function wheelStep(){
    var d = wheelTo - wheelPos;
    if (Math.abs(d) < 0.5){
      stage.scrollLeft = wheelTo;
      wheelStop();
      return;
    }
    wheelPos += d * 0.18;
    stage.scrollLeft = wheelPos;
    wheelRaf = requestAnimationFrame(wheelStep);
  }

  stage.addEventListener('wheel', function(e){
    if (!wide.matches) return;                                // в колонке страница листается сама
    if (e.ctrlKey) return;                                    // масштаб страницы
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;     // горизонтальный свайп тачпада — нативно
    e.preventDefault();
    // firefox отдаёт шаг в строках, а не в пикселях
    var unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? stage.clientWidth : 1;
    var max = stage.scrollWidth - stage.clientWidth;
    if (wheelTo === null){ wheelPos = stage.scrollLeft; wheelTo = wheelPos; }
    wheelTo = Math.max(0, Math.min(max, wheelTo + e.deltaY * unit));
    if (calm){ stage.scrollLeft = wheelTo; wheelStop(); return; }
    if (!wheelRaf) wheelRaf = requestAnimationFrame(wheelStep);
  }, { passive: false });

  // ---------- клавиатура: стрелки листают ленту ----------

  stage.addEventListener('keydown', function(e){
    if (!wide.matches) return;
    var i = active;
    if (e.key === 'ArrowRight' || e.key === 'PageDown'){ e.preventDefault(); go(Math.min(i + 1, panels.length - 1)); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp'){ e.preventDefault(); go(Math.max(i - 1, 0)); }
    else if (e.key === 'Home'){ e.preventDefault(); go(0); }
    else if (e.key === 'End'){ e.preventDefault(); go(panels.length - 1); }
  });

  // ---------- перетаскивание ленты мышью ----------

  var down = false, x0 = 0, s0 = 0;
  stage.addEventListener('pointerdown', function(e){
    if (!wide.matches || e.pointerType === 'touch' || e.button !== 0) return;
    if (e.target.closest('a, button')) return;
    wheelStop();
    down = true;
    x0 = e.clientX; s0 = stage.scrollLeft;
    stage.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', function(e){
    if (!down) return;
    stage.scrollLeft = s0 - (e.clientX - x0);
  });
  window.addEventListener('pointerup', function(){
    if (!down) return;
    down = false;
    stage.classList.remove('is-dragging');
  });

  // фокус с клавиатуры подтягивает лист в кадр.
  // внутри длинного листа кейсов браузер сам докручивает до карточки — не мешаем
  panels.forEach(function(p, i){
    p.addEventListener('focusin', function(){
      if (!wide.matches || i === active) return;
      if (p.offsetWidth > stage.clientWidth - 2 * edge()) return;
      go(i);
    });
  });

  // ---------- фильтр кейсов ----------

  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var filters = Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
  var worksCount = document.getElementById('works-count');
  var worksPanel = document.getElementById('works');

  function plural(n, one, few, many){
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function applyFilter(name){
    var shown = 0;
    cards.forEach(function(card){
      var on = name === 'all' || card.dataset.cat.split(' ').indexOf(name) !== -1;
      card.hidden = !on;
      if (on) shown++;
    });
    filters.forEach(function(b){
      b.setAttribute('aria-pressed', b.dataset.filter === name ? 'true' : 'false');
    });
    worksCount.textContent = shown + ' ' + plural(shown, 'работа', 'работы', 'работ');
    // лист кейсов поменял ширину — подравниваем ленту и шкалу
    if (wide.matches) go(panels.indexOf(worksPanel), true);
    layout();
    paint();
  }

  filters.forEach(function(b){
    b.addEventListener('click', function(){ applyFilter(b.dataset.filter); });
  });

  // ---------- копирование почты ----------

  each(document.querySelectorAll('[data-copy]'), function(b){
    var label = b.textContent;
    var timer = 0;

    function done(text){
      b.textContent = text;
      clearTimeout(timer);
      timer = setTimeout(function(){ b.textContent = label; }, 1600);
    }

    // запасной путь для file:// и старых браузеров, где нет clipboard api
    function fallback(value){
      var t = document.createElement('textarea');
      t.value = value;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(t);
      done(ok ? 'скопировано' : 'не вышло');
    }

    b.addEventListener('click', function(){
      var value = b.dataset.copy;
      if (navigator.clipboard && window.isSecureContext){
        navigator.clipboard.writeText(value).then(function(){ done('скопировано'); }, function(){ fallback(value); });
      } else {
        fallback(value);
      }
    });
  });

  // ---------- ссылки-заглушки: адресов пока нет, клик никуда не ведёт ----------

  each(document.querySelectorAll('a[data-stub]'), function(a){
    a.title = 'ссылка появится позже';
    a.addEventListener('click', function(e){ e.preventDefault(); });
  });

  if (wide.matches) stage.focus({ preventScroll: true });
})();
