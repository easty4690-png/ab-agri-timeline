'use strict';

    const STEP_COUNT = 48;
    const DT_DAYS = 1 / STEP_COUNT;
    const DT_HOURS = 24 / STEP_COUNT;
    const SAVE_KEY = 'ppm_game_v1';

    const storageConfig = {
      north: { name: 'North Tower', capacity: 6.5, initial: 4.2, minimum: 0.65, emptyLevel: 74, depth: 8, baseLeak: 1.55, routeCap: 16 },
      central: { name: 'Central SR', capacity: 11, initial: 6.6, minimum: 1.1, emptyLevel: 67, depth: 7, baseLeak: 2.45, routeCap: 22 },
      east: { name: 'East Tower', capacity: 5.5, initial: 3.5, minimum: 0.55, emptyLevel: 78, depth: 9, baseLeak: 1.05, routeCap: 10 },
      south: { name: 'South SR', capacity: 8, initial: 5.2, minimum: 0.8, emptyLevel: 69, depth: 8, baseLeak: 1.55, routeCap: 14 }
    };

    const towns = [
      { id:'northbridge', name:'Northbridge', zone:'north', population:48000, industrial:0.60, elevation:43, lossK:0.0019 },
      { id:'millhaven', name:'Millhaven', zone:'north', population:33000, industrial:0.30, elevation:36, lossK:0.0022 },
      { id:'riverside', name:'Riverside', zone:'central', population:56000, industrial:1.20, elevation:37, lossK:0.0017 },
      { id:'kingsmead', name:'Kingsmead', zone:'central', population:39000, industrial:0.80, elevation:43, lossK:0.0021 },
      { id:'fenwick', name:'Fenwick', zone:'east', population:29000, industrial:0.40, elevation:52, lossK:0.0020 },
      { id:'ashcombe', name:'Ashcombe', zone:'south', population:44000, industrial:0.50, elevation:41, lossK:0.00195 }
    ].map(t => ({...t, domestic: t.population * 140 / 1_000_000, baseDemand: t.population * 140 / 1_000_000 + t.industrial }));

    const sourceConfig = {
      river: { name:'River WTW', max:34, cost:58 },
      bore: { name:'Borehole WTW', max:12, cost:76 },
      import: { name:'Emergency import', max:8, cost:240 }
    };

    const scenarios = [
      { title:'Normal operating day', brief:'A steady start — establish a resilient plan without overspending.', weather:'17°C · Cloudy', demand:1.00, riverCap:34, boreCap:12, importCap:8, uncertainty:.012, energy:1.00, confidence:'High' },
      { title:'Warm Friday uplift', brief:'Garden use and an evening social peak are expected to lift demand.', weather:'24°C · Sunny', demand:1.09, riverCap:34, boreCap:12, importCap:8, uncertainty:.025, energy:1.00, confidence:'High' },
      { title:'Filter wash constraint', brief:'Planned treatment activity reduces River WTW output for the full day.', weather:'19°C · Bright', demand:1.02, riverCap:29, boreCap:12, importCap:8, uncertainty:.02, energy:1.00, confidence:'High' },
      { title:'North trunk-main burst', brief:'A rising night-flow alarm indicates a material loss in the North zone.', weather:'21°C · Dry', demand:1.05, riverCap:34, boreCap:12, importCap:8, uncertainty:.025, energy:1.00, confidence:'Medium', burst:{zone:'north', rate:2.8, start:10, end:48} },
      { title:'Riverside market day', brief:'Town-centre and hospitality demand will rise sharply from late morning.', weather:'20°C · Fair', demand:1.02, riverCap:34, boreCap:12, importCap:8, uncertainty:.035, energy:1.00, confidence:'Medium', townMultipliers:{riverside:1.18,kingsmead:1.10} },
      { title:'Groundwater abstraction cap', brief:'Environmental constraints reduce the available borehole output.', weather:'25°C · Sunny', demand:1.08, riverCap:34, boreCap:8, importCap:8, uncertainty:.025, energy:1.00, confidence:'High' },
      { title:'Telemetry confidence loss', brief:'Demand telemetry is drifting. The forecast may be materially wrong.', weather:'22°C · Changeable', demand:1.05, riverCap:34, boreCap:12, importCap:8, uncertainty:.085, energy:1.00, confidence:'Low' },
      { title:'Turnover and water-age day', brief:'Demand eases. Avoid leaving large, slowly turning-over storage volumes.', weather:'15°C · Rain', demand:.91, riverCap:34, boreCap:12, importCap:8, uncertainty:.02, energy:.96, confidence:'High', qualityFocus:true },
      { title:'Regional heatwave', brief:'Sustained heat creates a large morning peak and prolonged evening use.', weather:'31°C · Hot', demand:1.23, riverCap:34, boreCap:12, importCap:8, uncertainty:.04, energy:1.08, confidence:'Medium' },
      { title:'Peak electricity tariff', brief:'Pumping is expensive today. Meet demand without buying resilience at any cost.', weather:'18°C · Cloudy', demand:1.03, riverCap:34, boreCap:12, importCap:8, uncertainty:.02, energy:1.38, confidence:'High' },
      { title:'South distribution burst', brief:'A burst develops before the morning peak in the South zone.', weather:'23°C · Dry', demand:1.08, riverCap:34, boreCap:12, importCap:8, uncertainty:.03, energy:1.02, confidence:'Medium', burst:{zone:'south', rate:3.2, start:12, end:48} },
      { title:'River WTW process outage', brief:'A major process fault sharply constrains the primary treatment works.', weather:'27°C · Sunny', demand:1.12, riverCap:20, boreCap:12, importCap:8, uncertainty:.035, energy:1.10, confidence:'High' },
      { title:'Recovery and refill window', brief:'Demand is lower. Rebuild resilience without creating excessive water age.', weather:'16°C · Showers', demand:.93, riverCap:34, boreCap:12, importCap:8, uncertainty:.02, energy:.94, confidence:'High', qualityFocus:true },
      { title:'Final compound challenge', brief:'Heat, constrained sources and uncertain demand combine for the final shift.', weather:'29°C · Hot', demand:1.18, riverCap:30, boreCap:10, importCap:8, uncertainty:.055, energy:1.18, confidence:'Low', townMultipliers:{northbridge:1.07,fenwick:1.08} }
    ];

    const domesticPattern = normalisePattern(Array.from({length:STEP_COUNT}, (_,i) => {
      const h = i / 2;
      const morning = 1.25 * Math.exp(-Math.pow((h - 7.5) / 1.75, 2));
      const evening = 1.10 * Math.exp(-Math.pow((h - 18.5) / 2.15, 2));
      const midday = .22 * Math.exp(-Math.pow((h - 13) / 3.2, 2));
      return .48 + morning + evening + midday;
    }));
    const industrialPattern = normalisePattern(Array.from({length:STEP_COUNT}, (_,i) => {
      const h = i / 2;
      return h >= 7 && h < 19 ? 1.35 : .48;
    }));

    function normalisePattern(arr) {
      const avg = arr.reduce((a,b)=>a+b,0) / arr.length;
      return arr.map(v => v / avg);
    }

    function initialState() {
      return {
        day:1,
        totalScore:0,
        rank:'Trainee',
        introSeen:false,
        awaitingNext:false,
        storages:Object.fromEntries(Object.entries(storageConfig).map(([k,v]) => [k,{volume:v.initial,age:18}])),
        history:[],
        seed:Math.floor(Math.random()*1e9)
      };
    }

    let game = loadState();
    let lastResult = null;

    const $ = id => document.getElementById(id);
    const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
    const sum = values => values.reduce((a,b)=>a+b,0);
    const fmt = (v,d=1) => Number(v).toFixed(d);
    const zoneKeys = Object.keys(storageConfig);

    function loadState() {
      try {
        const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (!parsed || !parsed.storages || !Array.isArray(parsed.history)) return initialState();
        return {...initialState(), ...parsed};
      } catch { return initialState(); }
    }

    function saveState() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* Storage can be unavailable in privacy or preview modes. */ } }

    function seededRandom(seed) {
      let t = seed >>> 0;
      return function() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ t >>> 15, 1 | t);
        r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
        return ((r ^ r >>> 14) >>> 0) / 4294967296;
      };
    }

    function getScenario() { return scenarios[Math.min(game.day-1, scenarios.length-1)]; }

    function buildControls() {
      const scenario = getScenario();
      const sourceCaps = {river:scenario.riverCap,bore:scenario.boreCap,import:scenario.importCap};
      const defaults = {river:Math.min(34,scenario.riverCap), bore:Math.min(12,scenario.boreCap), import:0};
      $('sourceControls').innerHTML = Object.keys(sourceConfig).map(key => sliderHTML(`source-${key}`, sourceConfig[key].name, 0, sourceConfig[key].max, .5, defaults[key], `Today: max ${fmt(sourceCaps[key])} ML/d`)).join('');
      const feedDefaults = {north:13,central:17.5,east:6,south:9.5};
      $('feedControls').innerHTML = zoneKeys.map(key => sliderHTML(`feed-${key}`, storageConfig[key].name, 0, storageConfig[key].routeCap, .5, Math.min(feedDefaults[key],storageConfig[key].routeCap), `Pipe limit: ${fmt(storageConfig[key].routeCap)} ML/d`)).join('');
      const transferDefs = [
        {id:'transfer-nc',label:'North → Central',min:-4,max:4,negative:'Central → North',positive:'North → Central'},
        {id:'transfer-ce',label:'Central → East',min:-4,max:4,negative:'East → Central',positive:'Central → East'},
        {id:'transfer-cs',label:'Central → South',min:-5,max:5,negative:'South → Central',positive:'Central → South'}
      ];
      $('transferControls').innerHTML = transferDefs.map(t => `<div class="transfer-row"><div class="slider-label"><span>${t.label}</span><span id="${t.id}-value">0.0 ML/d</span></div><input id="${t.id}" type="range" min="${t.min}" max="${t.max}" step="0.5" value="0"><div class="transfer-scale"><span>${t.negative}</span><span>${t.positive}</span></div></div>`).join('');

      document.querySelectorAll('input[type="range"]').forEach(el => el.addEventListener('input', updatePlanUI));
      updatePlanUI();
    }

    function sliderHTML(id,label,min,max,step,value,note) {
      return `<div class="slider-row"><div class="slider-label"><span>${label}</span><span id="${id}-value">${fmt(value)} ML/d</span></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><div class="cap-note">${note}</div></div>`;
    }

    function readPlan() {
      return {
        sources:{river:+$('source-river').value,bore:+$('source-bore').value,import:+$('source-import').value},
        feeds:Object.fromEntries(zoneKeys.map(k => [k,+$(`feed-${k}`).value])),
        transfers:{nc:+$('transfer-nc').value,ce:+$('transfer-ce').value,cs:+$('transfer-cs').value},
        intervention:$('interventionSelect').value
      };
    }

    function updatePlanUI() {
      if (!$('source-river')) return;
      const p = readPlan();
      Object.entries(p.sources).forEach(([k,v]) => $(`source-${k}-value`).textContent = `${fmt(v)} ML/d`);
      Object.entries(p.feeds).forEach(([k,v]) => $(`feed-${k}-value`).textContent = `${fmt(v)} ML/d`);
      Object.entries(p.transfers).forEach(([k,v]) => $(`transfer-${k}-value`).textContent = `${v > 0 ? '+' : ''}${fmt(v)} ML/d`);
      const scenario = getScenario();
      const cappedSources = Math.min(p.sources.river,scenario.riverCap)+Math.min(p.sources.bore,scenario.boreCap)+Math.min(p.sources.import,scenario.importCap);
      const routeTotal = sum(Object.values(p.feeds));
      const delta = cappedSources-routeTotal;
      let status = 'Balanced', cls='status-good';
      if (Math.abs(delta)>.6) { status = delta>0 ? 'Output above routes' : 'Routes above output'; cls='status-warn'; }
      if (routeTotal<25) { status='Likely under-supply'; cls='status-bad'; }
      $('planState').textContent=status;
      $('planState').className=cls;
      $('balanceBox').innerHTML=`<div class="balance-line"><span>Capped source plan</span><strong>${fmt(cappedSources)} ML/d</strong></div><div class="balance-line"><span>Storage route plan</span><strong>${fmt(routeTotal)} ML/d</strong></div><div class="balance-line"><span>Difference</span><strong class="${cls}">${delta>0?'+':''}${fmt(delta)} ML/d</strong></div>`;
      updateSvgPlan(p, scenario);
    }

    function updateSvgPlan(p,scenario) {
      const sourceVals={river:Math.min(p.sources.river,scenario.riverCap),bore:Math.min(p.sources.bore,scenario.boreCap),import:Math.min(p.sources.import,scenario.importCap)};
      $('svgRiver').textContent=`${fmt(sourceVals.river)} ML/d`;
      $('svgBore').textContent=`${fmt(sourceVals.bore)} ML/d`;
      $('svgImport').textContent=`${fmt(sourceVals.import)} ML/d`;
      $('svgHub').textContent=`${fmt(sum(Object.values(p.feeds)))} ML/d routed`;
      zoneKeys.forEach(k => {
        $(`svg${capital(k)}Feed`).textContent=`${fmt(p.feeds[k])} in`;
        const percent=game.storages[k].volume/storageConfig[k].capacity*100;
        $(`svg${capital(k)}Level`).textContent=`${fmt(percent,0)}% full`;
      });
      $('svgNC').textContent=`${p.transfers.nc>0?'+':''}${fmt(p.transfers.nc)}`;
      $('svgCE').textContent=`${p.transfers.ce>0?'+':''}${fmt(p.transfers.ce)}`;
      $('svgCS').textContent=`${p.transfers.cs>0?'+':''}${fmt(p.transfers.cs)}`;
      const flows={pipeRiver:sourceVals.river,pipeBore:sourceVals.bore,pipeImport:sourceVals.import,pipeFeedNorth:p.feeds.north,pipeFeedCentral:p.feeds.central,pipeFeedEast:p.feeds.east,pipeFeedSouth:p.feeds.south,pipeNC:Math.abs(p.transfers.nc),pipeCE:Math.abs(p.transfers.ce),pipeCS:Math.abs(p.transfers.cs)};
      Object.entries(flows).forEach(([id,v])=>{
        const el=$(id); el.classList.toggle('active',v>.1); el.style.strokeWidth=String(clamp(3+v*.28,3,11));
      });
    }

    function capital(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

    function renderStorageGauges() {
      $('storageGauges').innerHTML=zoneKeys.map(k=>{
        const c=storageConfig[k], s=game.storages[k], pct=s.volume/c.capacity*100;
        const warning=pct<20?'status-bad':pct<35?'status-warn':'status-good';
        return `<div class="gauge-card"><div class="gauge-title"><span>${c.name}</span><span class="${warning}">${fmt(pct,0)}%</span></div><div class="gauge-track"><div class="gauge-fill" style="width:${clamp(pct,0,100)}%"></div></div><div class="gauge-meta"><span>${fmt(s.volume)} / ${fmt(c.capacity)} ML</span><span>Age ${fmt(s.age,0)} h</span></div></div>`;
      }).join('');
    }

    function renderScenario() {
      const s=getScenario();
      $('headerDay').textContent=`${game.day} / ${scenarios.length}`;
      $('headerScore').textContent=String(Math.round(game.totalScore));
      $('headerRank').textContent=rankForScore(game.totalScore,game.history.length);
      $('dayNumber').textContent=`D${game.day}`;
      $('scenarioTitle').textContent=s.title;
      $('scenarioBrief').textContent=s.brief;
      $('weatherText').textContent=s.weather;
      $('forecastDemand').textContent=`${fmt(baseDailyDemand()*s.demand)} ML/d`;
      $('availableOutput').textContent=`${fmt(s.riverCap+s.boreCap+s.importCap)} ML/d`;
      $('forecastConfidence').textContent=s.confidence;
      renderStorageGauges();
      renderHistory();
      $('resultsPanel').classList.toggle('visible',game.awaitingNext && !!lastResult);
      $('runBtn').disabled=game.awaitingNext;
      $('plannerBtn').disabled=game.awaitingNext;
      if (game.day>scenarios.length) showCampaignComplete();
    }

    function baseDailyDemand(){ return sum(towns.map(t=>t.baseDemand)); }

    function setInterventionNote() {
      const notes={
        none:'Save resources and rely on the production plan.',
        repair:'If a burst exists, the crew isolates it at midday. A needless deployment wastes points.',
        pressure:'Reduces background leakage by 12%, but lowers zone pressure by 1.5 m.',
        demand:'Reduces demand by 7%, with a modest customer-reputation penalty.'
      };
      $('interventionNote').textContent=notes[$('interventionSelect').value];
    }

    function suggestPlan() {
      const s=getScenario();
      const zoneDemand=Object.fromEntries(zoneKeys.map(k=>[k,0]));
      towns.forEach(t=>zoneDemand[t.zone]+=t.baseDemand*s.demand*(s.townMultipliers?.[t.id]||1));
      const targetPct=s.qualityFocus?.48:.56;
      const feeds={};
      zoneKeys.forEach(k=>{
        const c=storageConfig[k];
        const refill=(c.capacity*targetPct-game.storages[k].volume);
        feeds[k]=clamp(zoneDemand[k]+c.baseLeak+refill,0,c.routeCap);
      });
      const needed=sum(Object.values(feeds));
      let remaining=needed;
      const sources={river:Math.min(s.riverCap,remaining),bore:0,import:0}; remaining-=sources.river;
      sources.bore=Math.min(s.boreCap,Math.max(0,remaining)); remaining-=sources.bore;
      sources.import=Math.min(s.importCap,Math.max(0,remaining));
      Object.entries(sources).forEach(([k,v])=>$(`source-${k}`).value=Math.round(v*2)/2);
      Object.entries(feeds).forEach(([k,v])=>$(`feed-${k}`).value=Math.round(v*2)/2);
      ['nc','ce','cs'].forEach(k=>$(`transfer-${k}`).value=0);
      updatePlanUI();
      toast('A forecast-based starter plan has been loaded. Actual demand can still differ.');
    }
