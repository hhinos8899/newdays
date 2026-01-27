/**
 * 最终要求：
 * 1) 套入24手阶段：不预测（不显示P/B、不显示百分比），只提示“当前要命中哪组三连”
 * 2) 套完24手后：进入门槛PBP（虚拟25/26/27），必须连续3手走完再判定
 * 3) 门槛三手里至少中1手 -> 才开始后面一个一个顺序预测
 * 4) 过门槛后从 BBP 开始，按组三连循环：BBP -> PPB -> PBP -> BBP -> PPB -> PBP -> PBB -> PBP -> ...
 * 5) 显示：第真实手数(虚拟手数)；虚拟24发生在“套完那一手”
 */

const GROUPS = ["PBP","BBP","PPB","PBP","BBP","PPB","PBP","PBB"];
const LOOP_GROUPS = GROUPS.slice(1).concat(GROUPS.slice(0,1)); // 从BBP开始循环

let gameHistory = [];
let waiting = false;

// phase: 0套入，1门槛，2预测
let phase = 0;

// phase0
let matchIdx = 0;
let completedAtRealHand = 0; // 套完24发生在真实第N手

// phase1 门槛
let gateStep = 0; // 0..2
let gateHits = 0;
let lastGateLine = "";

// phase2 预测
let loopGroupIdx = 0;
let loopPos = 0;
let phase2StartRealHand = 0;

function byId(id){ return document.getElementById(id); }
function $(sel){ return document.querySelector(sel); }

function setButtonsDisabled(disabled){
  const p = $('.player-btn');
  const b = $('.banker-btn');
  const back = $('.back-btn');
  const reset = $('.reset-btn');
  if(p) p.disabled = disabled;
  if(b) b.disabled = disabled;
  if(back) back.disabled = disabled;
  if(reset) reset.disabled = disabled;
}

function setLabelAI(){
  const label = byId('resultLabel');
  if(label){
    label.textContent = 'AI';
    label.classList.remove('player','banker');
  }
}
function setLabelSide(side){
  const label = byId('resultLabel');
  if(!label) return;
  label.textContent = side;
  label.classList.remove('player','banker');
  label.classList.add(side === 'B' ? 'banker' : 'player');
}

function showTextOnly(msg){
  setLabelAI();
  const pctEl = byId('resultPct');
  const text = byId('predictionText');
  if(pctEl) pctEl.textContent = '';
  if(text) text.textContent = msg;
}

function renderHistory(){
  const recordDisplay = byId('recordDisplay');
  if(!recordDisplay) return;
  recordDisplay.innerHTML = '';
  gameHistory.forEach(type => {
    const item = document.createElement('div');
    item.className = `record-item ${type.toLowerCase()}`;
    item.textContent = type;
    recordDisplay.appendChild(item);
  });
}

function last3(){
  if(gameHistory.length < 3) return null;
  return gameHistory.slice(-3).join('');
}

// 虚拟手数显示：
// - 门槛阶段：固定显示25/26/27（每轮都这样显示）
// - 预测阶段：下一手=虚拟28，随真实递增
function virtualHandFor(realHand){
  if(!completedAtRealHand) return null;

  if(phase === 1){
    return 25 + gateStep;
  }
  if(phase === 2){
    if(!phase2StartRealHand) return null;
    return 28 + (realHand - phase2StartRealHand);
  }
  return null;
}
function fmtHand(realHand){
  const v = virtualHandFor(realHand);
  if(v === null) return `第${realHand}手`;
  return `第${realHand}手(${v}手)`;
}

// 预测字母（只有phase1/phase2才真正需要）
function nextPredLetter(){
  if(phase === 1){
    return "PBP"[gateStep];
  }
  const g = LOOP_GROUPS[loopGroupIdx % LOOP_GROUPS.length];
  return g[loopPos];
}

function advanceAfterInput(actual){
  // 阶段0：套入（顺序命中8组；滑动窗口命中才推进）
  if(phase === 0){
    const s = last3();
    if(!s) return;

    const need = GROUPS[matchIdx];
    if(s === need){
      matchIdx++;
      if(matchIdx >= GROUPS.length){
        matchIdx = 0;
        completedAtRealHand = gameHistory.length; // 当前真实手=虚拟24
        phase = 1;

        gateStep = 0;
        gateHits = 0;
        lastGateLine = `✅ 第${completedAtRealHand}手(24手)已套完\n开始门槛：下一手是(25手)`;

        // 预设预测阶段参数
        loopGroupIdx = 0; // BBP
        loopPos = 0;
        phase2StartRealHand = 0;
      }
    }
    return;
  }

  // 阶段1：门槛PBP，必须走满3手再判定
  if(phase === 1){
    const pred = "PBP"[gateStep];
    const hit = (actual === pred);
    if(hit) gateHits++;

    const realHand = gameHistory.length;
    lastGateLine =
      `门槛阶段：${fmtHand(realHand)}\n` +
      `本手结果=${actual}｜本手门槛预测=${pred}\n` +
      `进度：${gateStep + 1}/3｜累计命中：${gateHits}/3\n` +
      `（必须走满3手，三手里至少中1手才开始后面逐手预测）`;

    gateStep++;

    // 未满3手：绝不进入预测阶段
    if(gateStep < 3) return;

    // 满3手统一判定
    if(gateHits >= 1){
      phase = 2;
      phase2StartRealHand = gameHistory.length + 1; // 下一手=虚拟28
      loopGroupIdx = 0; // BBP
      loopPos = 0;
    } else {
      // 三手全不中：下一组三手继续当作25/26/27
      phase = 1;
      gateStep = 0;
      gateHits = 0;
    }
    return;
  }

  // 阶段2：依次预测推进
  if(phase === 2){
    loopPos++;
    if(loopPos >= 3){
      loopPos = 0;
      loopGroupIdx = (loopGroupIdx + 1) % LOOP_GROUPS.length;
    }
  }
}

function updateView(){
  const upcomingReal = gameHistory.length + 1;

  if(phase === 0){
    const need = GROUPS[matchIdx];
    showTextOnly(
      `套入24手中：当前需要命中 ${need}\n` +
      `（套入阶段不预测，只输入BP，直到完全套完24手）`
    );
    return;
  }

  if(phase === 1){
    // 门槛阶段：显示预测字母，但不允许进入“逐手预测”直到三手走完且>=1命中
    const p = nextPredLetter();
    setLabelSide(p);
    const pctEl = byId('resultPct');
    if(pctEl) pctEl.textContent = ''; // 门槛阶段也不显示百分比（按你要求：只有开始逐手预测才算“预测”）
    const text = byId('predictionText');
    if(text){
      text.textContent =
        `✅ 第${completedAtRealHand}手(24手)已套完\n` +
        (lastGateLine || `门槛：${fmtHand(upcomingReal)}（25/26/27必须走满3手再判定）`);
    }
    return;
  }

  // phase2：正式逐手预测（这里才是真正“一个一个预测”）
  const p = nextPredLetter();
  setLabelSide(p);
  const pctEl = byId('resultPct');
  if(pctEl) pctEl.textContent = ''; // 你不想要百分比就保持空
  const g = LOOP_GROUPS[loopGroupIdx % LOOP_GROUPS.length];
  const text = byId('predictionText');
  if(text){
    text.textContent =
      `✅ 已过门槛（PBP三手至少中1手）\n` +
      `依次预测：${fmtHand(upcomingReal)}\n` +
      `当前组：${g}（第${loopPos+1}/3）｜本手预测：${p}`;
  }
}

function recomputeFromHistory(arr){
  phase = 0;
  matchIdx = 0;
  completedAtRealHand = 0;

  gateStep = 0;
  gateHits = 0;
  lastGateLine = "";

  loopGroupIdx = 0;
  loopPos = 0;
  phase2StartRealHand = 0;

  gameHistory = [];
  arr.forEach(x=>{
    gameHistory.push(x);
    advanceAfterInput(x);
  });
}

// 按钮
window.recordResult = function(type){
  if(waiting) return;
  if(type !== 'B' && type !== 'P') return;

  waiting = true;
  setButtonsDisabled(true);

  gameHistory.push(type);
  renderHistory();

  advanceAfterInput(type);
  updateView();

  waiting = false;
  setButtonsDisabled(false);
};

window.undoLastMove = function(){
  if(waiting) return;
  const old = [...gameHistory];
  old.pop();
  recomputeFromHistory(old);
  renderHistory();
  updateView();
};

window.resetGame = function(){
  if(waiting) return;
  recomputeFromHistory([]);
  renderHistory();
  showTextOnly(
    '已重置：先套入24手（不预测）→ 套完后门槛PBP三手走满再判定 → 门槛三手至少中1手才开始后面逐手预测（从BBP开始）。'
  );
};

window.toggleInstructions = function(){
  const modal = byId('instModal');
  const text = byId('instText');
  if(text){
    text.textContent =
`【规则说明】
1）套入24手：按顺序命中 8 组三连：
   PBP, BBP, PPB, PBP, BBP, PPB, PBP, PBB
   用最近3手滑动窗口匹配；不命中就继续输入，所以可能到48/50手才套完。
   套入阶段：不预测，只提示当前需要命中哪一组。

2）套完提示：第N手(24手)已套完（N由系统自动判断）。

3）门槛：虚拟25/26/27 对应 PBP。
   必须连续3手走完再判定；
   三手里至少命中1手才“过门槛”，否则继续下一轮门槛三手。

4）过门槛后才开始逐手预测：
   从 BBP 开始按组循环：
   BBP → PPB → PBP → BBP → PPB → PBP → PBB → PBP → ...
   并显示：第真实手数(虚拟手数)。`;
  }
  if(modal) modal.classList.remove('hidden');
};
window.closeInstructions = function(){
  const modal = byId('instModal');
  if(modal) modal.classList.add('hidden');
};

// 初始化
document.addEventListener('DOMContentLoaded', function(){
  renderHistory();
  showTextOnly('就绪：先输入真实结果(B/P)。套入阶段不预测；套完24后门槛三手；过门槛才逐手预测。');
  updateView();
});
