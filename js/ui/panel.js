// Panel 2 helpers: the stopwatch, the solution move list and the results table.

const $ = (id) => document.getElementById(id);

export function formatTime(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// A stopwatch that redraws itself every frame while it runs
export function createTimer() {
  const el = $('timer');
  const tpsEl = $('stat-tps');
  const movesEl = $('stat-moves');
  let start = 0;
  let elapsed = 0;
  let running = false;
  let moves = 0;

  function draw() {
    const now = running ? performance.now() - start : elapsed;
    el.textContent = formatTime(now);
    tpsEl.textContent = now > 0 ? (moves / (now / 1000)).toFixed(1) : '0.0';
    movesEl.textContent = moves;
    if (running) requestAnimationFrame(draw);
  }

  return {
    start() {
      start = performance.now();
      moves = 0;
      running = true;
      el.classList.add('running');
      el.classList.remove('done');
      draw();
    },
    stop(success = true) {
      if (!running) return elapsed;
      elapsed = performance.now() - start;
      running = false;
      el.classList.remove('running');
      if (success) {
        el.classList.remove('done');
        void el.offsetWidth; // restart the "pop" animation
        el.classList.add('done');
      }
      draw();
      return elapsed;
    },
    reset() {
      running = false;
      elapsed = 0;
      moves = 0;
      el.classList.remove('running', 'done');
      draw();
    },
    addMove() { moves += 1; if (!running) draw(); },
    isRunning: () => running,
    getMoves: () => moves,
  };
}

// The solution, grouped by step, with the current move lit up
export function showSolution(steps) {
  const box = $('moves');
  box.innerHTML = '';
  const chips = [];
  for (const step of steps) {
    const group = document.createElement('div');
    group.className = 'step-group';
    const name = document.createElement('div');
    name.className = 'step-name';
    name.textContent = `${step.name} · ${step.moves.length}`;
    group.appendChild(name);
    for (const move of step.moves) {
      const chip = document.createElement('span');
      chip.className = 'mv';
      chip.textContent = move;
      group.appendChild(chip);
      chips.push({ chip, step: step.name });
    }
    box.appendChild(group);
  }
  if (!chips.length) box.innerHTML = '<p class="muted">Already solved: nothing to do.</p>';

  return {
    count: chips.length,
    highlight(i) {
      chips.forEach(({ chip }, k) => {
        chip.classList.toggle('done', k < i);
        chip.classList.toggle('now', k === i);
      });
      if (chips[i]) {
        chips[i].chip.scrollIntoView({ block: 'nearest' });
        $('step-label').textContent = chips[i].step;
      }
    },
  };
}

export function clearSolution(message = 'The solving moves will appear here.') {
  $('moves').innerHTML = `<p class="muted">${message}</p>`;
  $('step-label').textContent = ' ';
}

export function addResult({ who, moves, ms, thinkMs, speed }) {
  const body = $('results');
  body.querySelector('.empty')?.remove();
  const row = document.createElement('tr');
  row.className = 'new';
  const cells = [who, String(moves), formatTime(ms), thinkMs == null ? '–' : `${Math.round(thinkMs)} ms`, speed];
  for (const text of cells) {
    const td = document.createElement('td');
    td.textContent = text;
    row.appendChild(td);
  }
  body.prepend(row);
}
