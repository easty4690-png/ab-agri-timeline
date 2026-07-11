    function runDay() {
      const plan=readPlan();
      const result=simulateDay(plan);
      lastResult=result;
      game.storages=Object.fromEntries(zoneKeys.map(k=>[k,{volume:result.volumes[k],age:result.ages[k]}]));
      game.totalScore+=result.score;
      game.history.push({day:game.day,title:result.scenario.title,score:result.score,service:result.servicePct,lowestPressure:Math.min(...Object.values(result.townStats).map(x=>x.minPressure))});
      game.awaitingNext=true;
      saveState();
      renderResult(result);
      renderScenario();
      $('resultsPanel').scrollIntoView({behavior:'smooth',block:'start'});
    }

    function renderResult(r) {
      $('resultsPanel').classList.add('visible');
      $('dayScore').textContent=String(r.score);
      $('scoreRing').style.setProperty('--score-angle',`${r.score*3.6}deg`);
      const grade=r.score>=90?'Exceptional control':r.score>=78?'Strong operational day':r.score>=65?'System held together':r.score>=50?'A difficult shift': 'Major service failure';
      $('resultHeadline').textContent=grade;
      const demandError=r.forecastError*100;
      $('resultSummary').textContent=`Actual demand was ${Math.abs(demandError)<.2?'in line with':`${fmt(Math.abs(demandError))}% ${demandError>0?'above':'below'}`} forecast. You delivered ${fmt(r.servicePct)}% of required town demand and finished with ${fmt(sum(Object.values(r.volumes)))} ML in storage.`;
      const lowest=Math.min(...Object.values(r.townStats).map(x=>x.minPressure));
      const metrics=[
        ['Demand met',`${fmt(r.servicePct)}%`,r.servicePct>=99?'status-good':r.servicePct>=96?'status-warn':'status-bad'],
        ['Lowest pressure',`${fmt(lowest)} m`,lowest>=7?'status-good':'status-bad'],
        ['Leakage',`${fmt(r.totalLeak)} ML`,r.totalLeak<8?'status-good':r.totalLeak<11?'status-warn':'status-bad'],
        ['Operating cost',`£${Math.round(r.totalCost).toLocaleString()}`,''],
        ['End storage',`${fmt(sum(Object.values(r.volumes)))} ML`,'']
      ];
      $('metricsGrid').innerHTML=metrics.map(([l,v,c])=>`<div class="metric"><span>${l}</span><strong class="${c}">${v}</strong></div>`).join('');
      const b=r.breakdown;
      const breakdown=[['Supply',b.service,55],['Pressure',b.pressure,10],['Resilience',b.resilience,15],['Efficiency',b.efficiency,10],['Quality',b.quality,5],['Decision',b.intervention,5]];
      $('scoreBreakdown').innerHTML=breakdown.map(([l,v,m])=>`<div class="breakdown-item"><strong>${fmt(v,0)} / ${m}</strong><span>${l}</span></div>`).join('');
      $('townResults').innerHTML=towns.map(t=>{
        const s=r.townStats[t.id], pct=s.required?100*s.delivered/s.required:100;
        const status=pct>=99&&s.minPressure>=7?'Secure':pct>=96&&s.minPressure>=7?'Stressed':'Failed';
        const cls=status==='Secure'?'status-good':status==='Stressed'?'status-warn':'status-bad';
        return `<tr><td><strong>${t.name}</strong></td><td>${fmt(s.required)} ML</td><td>${fmt(s.delivered)} ML</td><td>${fmt(pct)}%</td><td>${fmt(s.minPressure)} m</td><td class="${cls}">${status}</td></tr>`;
      }).join('');
      drawLineChart($('flowChart'),[
        {name:'Demand',data:r.demandSeries},
        {name:'Production',data:r.supplySeries}
      ],'ML/d');
      drawLineChart($('storageChart'),zoneKeys.map(k=>({name:storageConfig[k].name,data:r.storageSeries[k]})),'%');
      $('nextDayBtn').textContent=game.day>=scenarios.length?'View final campaign result':'Continue to next stage';
    }

    function drawLineChart(canvas,series,unit) {
      const ctx=canvas.getContext('2d');
      const dpr=Math.max(1,window.devicePixelRatio||1);
      const cssW=canvas.clientWidth||650, cssH=canvas.clientHeight||220;
      canvas.width=cssW*dpr; canvas.height=cssH*dpr; ctx.scale(dpr,dpr);
      ctx.clearRect(0,0,cssW,cssH);
      const pad={l:42,r:14,t:18,b:32};
      const vals=series.flatMap(s=>s.data);
      const min=Math.min(0,...vals), max=Math.max(...vals)*1.08||1;
      ctx.strokeStyle='rgba(160,205,225,.16)'; ctx.lineWidth=1;
      ctx.fillStyle='#93b5c5'; ctx.font='11px system-ui';
      for(let i=0;i<=4;i++){
        const y=pad.t+(cssH-pad.t-pad.b)*i/4;
        ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(cssW-pad.r,y);ctx.stroke();
        const v=max-(max-min)*i/4;ctx.fillText(`${Math.round(v)}${unit}`,4,y+4);
      }
      [0,6,12,18,24].forEach(h=>{
        const x=pad.l+(cssW-pad.l-pad.r)*(h/24);ctx.fillText(`${h}:00`,x-12,cssH-9);
      });
      const colours=['#63ddf5','#ffbd5b','#62e6a7','#a98cff','#ff7787','#7aa2ff'];
      series.forEach((s,idx)=>{
        ctx.strokeStyle=colours[idx%colours.length];ctx.lineWidth=2.2;ctx.beginPath();
        s.data.forEach((v,i)=>{
          const x=pad.l+(cssW-pad.l-pad.r)*(i/(s.data.length-1));
          const y=pad.t+(cssH-pad.t-pad.b)*(1-(v-min)/(max-min));
          i?ctx.lineTo(x,y):ctx.moveTo(x,y);
        });ctx.stroke();
        ctx.fillStyle=colours[idx%colours.length];ctx.fillRect(pad.l+idx*120,pad.t-12,10,3);
        ctx.fillStyle='#b7d0dc';ctx.fillText(s.name,pad.l+14+idx*120,pad.t-7);
      });
    }

    function nextDay() {
      if(!game.awaitingNext) return;
      game.awaitingNext=false;
      if(game.day>=scenarios.length){ game.day=scenarios.length+1; saveState(); showCampaignComplete(); return; }
      game.day++;
      lastResult=null;
      saveState();
      buildControls();
      renderScenario();
      $('resultsPanel').classList.remove('visible');
      window.scrollTo({top:0,behavior:'smooth'});
    }

    function showCampaignComplete() {
      const avg=game.history.length?game.totalScore/game.history.length:0;
      const rank=rankForScore(game.totalScore,game.history.length);
      $('scenarioTitle').textContent='Campaign complete';
      $('scenarioBrief').textContent=`You finished all ${scenarios.length} stages with an average score of ${fmt(avg)} and achieved the rank ${rank}.`;
      $('runBtn').disabled=true;$('plannerBtn').disabled=true;
      $('nextDayBtn').textContent='Campaign complete';$('nextDayBtn').disabled=true;
      toast(`Campaign complete — ${rank}, average ${fmt(avg)}.`);
    }

    function rankForScore(total,days) {
      if(!days) return 'Trainee';
      const avg=total/days;
      return avg>=92?'Gold Control Lead':avg>=84?'Regional Optimiser':avg>=74?'Senior Planner':avg>=62?'Production Planner':avg>=50?'Control Room Survivor':'Mayhem Magnet';
    }

    function renderHistory() {
      if(!game.history.length){ $('historyList').innerHTML='<p style="color:var(--muted);margin:0">No shifts completed yet. Your first result will appear here.</p>'; return; }
      $('historyList').innerHTML=[...game.history].reverse().map(h=>`<div class="history-row"><div class="history-day">D${h.day}</div><div><p>${h.title}</p><small>${fmt(h.service)}% demand met · low ${fmt(h.lowestPressure)} m</small></div><div class="history-score ${h.score>=78?'status-good':h.score>=60?'status-warn':'status-bad'}">${h.score}</div></div>`).join('');
    }

    function resetCampaign() {
      if(!confirm('Restart the full campaign and delete saved progress on this device?')) return;
      game=initialState();lastResult=null;saveState();buildControls();renderScenario();$('resultsPanel').classList.remove('visible');$('introModal').classList.add('show');
    }

    function toast(message) {
      const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3200);
    }

    function init() {
      buildControls();renderScenario();setInterventionNote();
      $('interventionSelect').addEventListener('change',()=>{setInterventionNote();updatePlanUI();});
      $('plannerBtn').addEventListener('click',suggestPlan);
      $('runBtn').addEventListener('click',runDay);
      $('nextDayBtn').addEventListener('click',nextDay);
      $('resetBtn').addEventListener('click',resetCampaign);
      $('startBtn').addEventListener('click',()=>{game.introSeen=true;saveState();$('introModal').classList.remove('show');});
      if(!game.introSeen)$('introModal').classList.add('show');
      window.addEventListener('resize',()=>{if(lastResult)renderResult(lastResult);});
      if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }

    init();
