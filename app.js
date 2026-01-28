const GROUPS = ["PBP","BBP","PPB","PBP"];   // 前四组=12手
const LOOP_GROUPS = ["BBP","PPB","PBP","BBP","PPB","PBP","PBB","PBP"];

let gameHistory = [];
let waiting = false;
let phase = 0; // 0=套入 1=门槛 2=预测

let fitGroupIdx = 0;
let fitPos = 0;
let completedAtRealHand = 0;

// 门槛现在是 BBP（13-15手）
const GATE_GROUP = "BBP";
let gateStep = 0;
let gateHits = 0;
let lastGateLine = "";

let loopGroupIdx = 0;
let loopPos = 0;
let phase2StartRealHand = 0;

function byId(id){ return document.getElementById(id); }
function $(sel){ return document.querySelector(sel); }

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

function setLabelAI(){
  const label = byId('resultLabel');
  const pctEl = byId('resultPct');
  if(label){
    label.textContent = 'AI';
    label.classList.remove('player','banker');
  }
  if(pctEl) pctEl.textContent = '';
}

function setLabelSide(side){
  const label = byId('resultLabel');
  if(label){
    label.textContent = side;
    label.classList.remove('player','banker');
    label.classList.add(side === 'B' ? 'banker' : 'player');
  }
}

function showTextOnly(msg){
  setLabelAI();
  const text = byId('predictionText');
  if(text) text.textContent = msg;
}

function advanceAfterInput(actual){

  // ===== 套入阶段 =====
  if(phase === 0){
    const need = GROUPS[fitGroupIdx];
    const expect = need[fitPos];

    if(actual === expect){
      fitPos++;
      if(fitPos >= 3){
        fitPos = 0;
        fitGroupIdx++;
        if(fitGroupIdx >= GROUPS.length){
          completedAtRealHand = gameHistory.length;
          phase = 1;
          gateStep = 0;
          gateHits = 0;
        }
      }
    }
    return;
  }

  // ===== 门槛阶段（13-15 = BBP）=====
  if(phase === 1){
    const target = GATE_GROUP[gateStep];
    if(actual === target) gateHits++;

    const realHand = gameHistory.length;
    lastGateLine =
      `第${realHand}手(${13 + gateStep}手)\n` +
      `门槛BBP 进度 ${gateStep+1}/3 命中${gateHits}`;

    gateStep++;
    if(gateStep < 3) return;

    // 通过门槛
    if(gateHits >= 1){
      phase = 2;
      phase2StartRealHand = gameHistory.length + 1;
      loopGroupIdx = 1; // 从 PPB 开始接
      loopPos = 0;
    }else{
      gateStep = 0;
      gateHits = 0;
    }
    return;
  }

  // ===== 预测推进 =====
  if(phase === 2){
    loopPos++;
    if(loopPos >= 3){
      loopPos = 0;
      loopGroupIdx = (loopGroupIdx + 1) % LOOP_GROUPS.length;
    }
  }
}

function nextPredLetterPhase2(){
  return LOOP_GROUPS[loopGroupIdx][loopPos];
}

function updateView(){
  if(phase === 0){
    const need = GROUPS[fitGroupIdx];
    const expect = need[fitPos];
    showTextOnly(`套入阶段 第${fitGroupIdx+1}/4组 等待 ${expect}`);
    return;
  }

  if(phase === 1){
    showTextOnly(lastGateLine);
    return;
  }

  const p = nextPredLetterPhase2();
  setLabelSide(p);
  const text = byId('predictionText');
  if(text){
    text.textContent =
      `已过门槛\n当前组 ${LOOP_GROUPS[loopGroupIdx]}\n预测 ${p}`;
  }
}

window.recordResult = function(type){
  if(type !== 'B' && type !== 'P') return;
  gameHistory.push(type);
  renderHistory();
  advanceAfterInput(type);
  updateView();
};

window.undoLastMove = function(){
  gameHistory.pop();
  renderHistory();
  updateView();
};

window.resetGame = function(){
  gameHistory = [];
  phase = 0;
  fitGroupIdx = 0;
  fitPos = 0;
  gateStep = 0;
  gateHits = 0;
  loopGroupIdx = 0;
  loopPos = 0;
  renderHistory();
  showTextOnly("已重置");
};

document.addEventListener('DOMContentLoaded', function(){
  renderHistory();
  showTextOnly('就绪');
});
