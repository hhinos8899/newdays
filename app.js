/**
 * 最终版 app.js（按你最新规则）
 *
 * A) 套入12手（4组三连按顺序套入）——【顺序匹配，可跳过，不要求连续三手相同】
 *    组顺序：PBP, BBP, PPB, PBP
 *    例如：PBBP 可以完成 PBP；BPPBP 可以完成 BBP
 *    套入阶段：不预测、不显示P/B、不显示百分比
 *
 * B) 套完12手后（套完那一手=虚拟12）：
 *    进入门槛：PBP（虚拟13/14/15），必须连续走满3手才判定
 *    三手里至少命中1手 -> 过门槛；否则继续下一轮门槛(仍当作13/14/15)
 *
 * C) 过门槛后才开始“逐手预测”：
 *    从 BBP 开始按组三连循环：
 *    BBP -> PPB -> PBP -> BBP -> PPB -> PBP -> PBB -> PBP -> ...
 *
 * D) 显示：第真实手(虚拟手)
 */

// ✅ 改：24手(8组) -> 12手(4组)
const GROUPS = ["PBP","BBP","PPB","PBP"];
const LOOP_GROUPS = ["BBP","PPB","PBP","BBP","PPB","PBP","PBB","PBP"]; // 过门槛后从BBP开始

// ================== 状态 ==================
let gameHistory = [];
let waiting = false;
// 0=套入；1=门槛；2=逐手预测
let phase = 0;

// phase0：顺序套入（子序列匹配）
let fitGroupIdx = 0; // 0..3
let fitPos = 0;      // 0..2（当前组内匹配到第几位）

// 套完12发生在真实第几手（那一手 = 虚拟12）
let completedAtRealHand = 0;

// phase1：门槛
let gateStep = 0;  // 0..2 对应门槛三手(13/14/15)
let gateHits = 0;  // 本轮门槛三手命中次数
let lastGateLine = "";

// phase2：逐手预测
let loopGroupIdx = 0;        // LOOP_GROUPS index
let loopPos = 0;             // 0..2
let phase2StartRealHand = 0; // 虚拟16对应的真实手

// ================== DOM 工具 ==================
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

function renderHistory(){
  const box = byId('recordDisplay');
  if(!box) return;
  box.innerHTML = '';
  gameHistory.forEach(x=>{
    const d = document.createElement('div');
    d.className = 'record-item ' + x.toLowerCase();
    d.textContent = x;
    box.appendChild(d);
  });
}

// 只显示 AI（不显示预测）
function setLabelAI(){
  const label = byId('resultLabel');
  const pctEl = byId('resultPct');
  if(label){
    label.textContent = 'AI';
    label.classList.remove('player','banker');
  }
  if(pctEl) pctEl.textContent = '';
}

// 显示预测字母（只在 phase2 用）
function setLabelSide(side){
  const label = byId('resultLabel');
  const pctEl = byId('resultPct');
  if(label){
    label.textContent = side;
    label.classList.remove('player','banker');
    label.classList.add(side === 'B' ? 'banker' : 'player');
  }
  if(pctEl) pctEl.textContent = ''; // 你不需要百分比就保持空
}

function showTextOnly(msg){
  setLabelAI();
  const text = byId('predictionText');
  if(text) text.textContent = msg;
}

// ================== 虚拟手显示 ==================
function virtualHandForUpcoming(){
  // upcomingReal = gameHistory.length + 1
  const upcomingReal = gameHistory.length + 1;
  if(!completedAtRealHand) return null;

  if(phase === 1){
    // ✅ 改：门槛阶段：下一手对应 13+gateStep
    return 13 + gateStep;
  }
  if(phase === 2){
    if(!phase2StartRealHand) return null;
    // ✅ 改：预测阶段从虚拟16开始
    return 16 + (upcomingReal - phase2StartRealHand);
  }
  return null;
}

function fmtUpcomingHand(){
  const upcomingReal = gameHistory.length + 1;
  const v = virtualHandForUpcoming();
  return (v == null) ? `第${upcomingReal}手` : `第${upcomingReal}手(${v}手)`;
}

// ================== 核心推进逻辑 ==================
function advanceAfterInput(actual){
  // -------- phase0：顺序套入（允许跳过，不要求连续）--------
  if(phase === 0){
    const need = GROUPS[fitGroupIdx];      // 当前需要的三连
    const expect = need[fitPos];           // 当前等待的字母

    // 匹配到当前期待字母 -> 推进 fitPos
    if(actual === expect){
      fitPos++;

      // 这一组3个字母都按顺序匹配到了 -> 下一组
      if(fitPos >= 3){
        fitPos = 0;
        fitGroupIdx++;

        // ✅ 改：4组全部完成 -> 套完12
        if(fitGroupIdx >= GROUPS.length){
          completedAtRealHand = gameHistory.length; // 真实第N手完成 = 虚拟12
          phase = 1;

          // 初始化门槛
          gateStep = 0;
          gateHits = 0;

          lastGateLine =
            `✅ 第${completedAtRealHand}手(12手)已套完\n` +
            `开始门槛：下一手(13手)起，PBP必须连续走满3手再判定`;

          // 预置预测阶段
          loopGroupIdx = 0; // 从BBP开始
          loopPos = 0;
          phase2StartRealHand = 0;

          // 重置套入指针（可选）
          fitGroupIdx = 0;
          fitPos = 0;
        }
      }
    }
    return;
  }

  // -------- phase1：门槛（必须连续走满3手再判定）--------
  if(phase === 1){
    const target = "PBP"[gateStep];
    const hit = (actual === target);
    if(hit) gateHits++;

    const realHand = gameHistory.length;
    lastGateLine =
      `✅ 第${completedAtRealHand}手(12手)已套完\n` +
      `门槛阶段：第${realHand}手(${13 + gateStep}手)\n` +
      `本手结果=${actual}｜门槛目标=${target}\n` +
      `进度：${gateStep + 1}/3｜累计命中：${gateHits}/3\n` +
      `（必须走满3手，且三手里至少中1手，才进入后面逐手预测）`;

    gateStep++;

    // 没满3手，绝不进入预测阶段
    if(gateStep < 3) return;

    // 满3手统一判定
    if(gateHits >= 1){
      phase = 2;
      phase2StartRealHand = gameHistory.length + 1; // 下一手=虚拟16
      loopGroupIdx = 0; // BBP
      loopPos = 0;
    } else {
      // 三手全不中：下一组三手继续当作13/14/15
      phase = 1;
      gateStep = 0;
      gateHits = 0;
    }
    return;
  }

  // -------- phase2：逐手预测推进（严格顺序）--------
  if(phase === 2){
    loopPos++;
    if(loopPos >= 3){
      loopPos = 0;
      loopGroupIdx = (loopGroupIdx + 1) % LOOP_GROUPS.length;
    }
  }
}

// ================== 逐手预测：下一手预测字母 ==================
function nextPredLetterPhase2(){
  const g = LOOP_GROUPS[loopGroupIdx % LOOP_GROUPS.length];
  return g[loopPos];
}

// ================== UI 刷新 ==================
function updateView(){
  // phase0：只提示“第几组 + 等什么字母”，不预测
  if(phase === 0){
    const need = GROUPS[fitGroupIdx];
    const expect = need[fitPos];
    showTextOnly(
      `套入12手中（允许跳着套入，不要求连续三手一样）\n` +
      `当前：第${fitGroupIdx + 1}/${GROUPS.length}组 目标=${need}\n` +
      `正在等待：${expect}\n` +
      `说明：只要按顺序凑齐 ${need}（中间夹杂P/B都可以跳过）就算这一组过`
    );
    return;
  }

  // phase1：门槛（不进入逐手预测前，主要显示门槛过程）
  if(phase === 1){
    showTextOnly(lastGateLine || `门槛阶段：必须连续走满3手(13/14/15)再判定`);
    return;
  }

  // phase2：逐手预测（这里才显示大P/B）
  const p = nextPredLetterPhase2();
  const upcoming = fmtUpcomingHand();
  const g = LOOP_GROUPS[loopGroupIdx % LOOP_GROUPS.length];

  setLabelSide(p);
  const text = byId('predictionText');
  if(text){
    text.textContent =
      `✅ 已过门槛（门槛PBP三手至少中1手）\n` +
      `逐手预测：${upcoming}\n` +
      `当前组：${g}（第${loopPos + 1}/3）\n` +
      `本手预测：${p}`;
  }
}

// ================== Back / Reset：整局重算 ==================
function recomputeFromHistory(arr){
  phase = 0;
  fitGroupIdx = 0;
  fitPos = 0;
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

// ================== 按钮函数（给 index.html 调用） ==================
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
    `已重置。\n` +
    `1）先套入12手：按顺序匹配${GROUPS.length}组（三连可跳过，不要求连续）\n` +
    `2）套完后门槛PBP：必须连续走满3手，三手至少中1手\n` +
    `3）过门槛后才逐手预测：从BBP开始循环`
  );
};

// （可选）如果你页面有“使用说明”按钮，就会用到这俩；没有也不影响
window.toggleInstructions = function(){
  const modal = byId('instModal');
  const text = byId('instText');
  if(text){
    text.textContent =
`【规则说明】
A）套入12手（允许跳着套入，不要求连续三手一样）
   顺序：PBP → BBP → PPB → PBP
   每组只要按顺序凑齐3个字母（中间夹杂可跳过）就算该组完成。
B）套完提示：第N手(12手)已套完（N由系统自动判断）。
C）门槛：虚拟13/14/15 对应 PBP
   必须连续走满3手再判定；
   三手里至少中1手才过门槛，否则继续下一轮门槛三手（仍当作13/14/15）。
D）过门槛后才逐手预测：
   从 BBP 开始循环：
   BBP → PPB → PBP → BBP → PPB → PBP → PBB → PBP → ...`;
  }
  if(modal) modal.classList.remove('hidden');
};

window.closeInstructions = function(){
  const modal = byId('instModal');
  if(modal) modal.classList.add('hidden');
};

// ================== 初始化 ==================
document.addEventListener('DOMContentLoaded', function(){
  renderHistory();
  showTextOnly('就绪：请开始输入真实结果(B/P)。\n套入阶段不预测，只按顺序跳着套入4组（共12手）。');
  updateView();
});
