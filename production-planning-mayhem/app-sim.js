    function sourceAndFeedRates(plan, scenario) {
      const requestedSources={
        river:Math.min(plan.sources.river,scenario.riverCap),
        bore:Math.min(plan.sources.bore,scenario.boreCap),
        import:Math.min(plan.sources.import,scenario.importCap)
      };
      const srcTotal=sum(Object.values(requestedSources));
      const routeRequested=Object.fromEntries(zoneKeys.map(k=>[k,Math.min(plan.feeds[k],storageConfig[k].routeCap)]));
      const routeTotal=sum(Object.values(routeRequested));
      const actualTotal=Math.min(srcTotal,routeTotal);
      const feedScale=routeTotal>0?actualTotal/routeTotal:0;
      const sourceScale=srcTotal>0?actualTotal/srcTotal:0;
      return {
        feeds:Object.fromEntries(zoneKeys.map(k=>[k,routeRequested[k]*feedScale])),
        sources:Object.fromEntries(Object.keys(requestedSources).map(k=>[k,requestedSources[k]*sourceScale])),
        spill:Math.max(0,srcTotal-routeTotal),
        shortRoute:Math.max(0,routeTotal-srcTotal),
        total:actualTotal
      };
    }

    function transferRequests(plan, volumes) {
      const req=[];
      function add(control,a,b,max){
        const v=clamp(control,-max,max);
        if(v>=0) req.push({from:a,to:b,rate:v,key:`${a}-${b}`});
        else req.push({from:b,to:a,rate:-v,key:`${b}-${a}`});
      }
      add(plan.transfers.nc,'north','central',4);
      add(plan.transfers.ce,'central','east',4);
      add(plan.transfers.cs,'central','south',5);
      return req.map(x=>{
        const c=storageConfig[x.from];
        const pct=volumes[x.from]/c.capacity;
        const interlock=clamp((pct-.10)/.12,0,1);
        return {...x,actual:x.rate*interlock};
      });
    }

    function townRequestAt(town,step,scenario,actualDemandMultiplier,intervention) {
      const townFactor=scenario.townMultipliers?.[town.id]||1;
      const demandCut=intervention==='demand'?.93:1;
      const domestic=town.domestic*domesticPattern[step];
      const industrial=town.industrial*industrialPattern[step];
      return (domestic+industrial)*actualDemandMultiplier*townFactor*demandCut;
    }

    function pressureDelivery(town, storage, requestedRate, pressureOffset) {
      const c=storageConfig[town.zone];
      const staticHead=c.emptyLevel+c.depth*(storage.volume/c.capacity)-town.elevation+pressureOffset;
      let q=requestedRate, head=staticHead;
      for(let n=0;n<8;n++){
        const qLs=q*1_000_000/86400;
        head=staticHead-town.lossK*Math.pow(Math.max(0,qLs),1.852);
        const factor=head>=20?1:head<=0?0:Math.sqrt(head/20);
        q=requestedRate*clamp(factor,0,1);
      }
      return {rate:q,head};
    }

    function simulateDay(plan) {
      const scenario=getScenario();
      const rand=seededRandom(game.seed+game.day*7919);
      const forecastError=(rand()*2-1)*scenario.uncertainty;
      const actualDemandMultiplier=scenario.demand*(1+forecastError);
      const rates=sourceAndFeedRates(plan,scenario);
      let volumes=Object.fromEntries(zoneKeys.map(k=>[k,game.storages[k].volume]));
      let ages=Object.fromEntries(zoneKeys.map(k=>[k,game.storages[k].age]));
      const minVolume={...volumes};
      const maxAge={...ages};
      const storageSeries=Object.fromEntries(zoneKeys.map(k=>[k,[volumes[k]/storageConfig[k].capacity*100]]));
      const demandSeries=[], supplySeries=[];
      const townStats=Object.fromEntries(towns.map(t=>[t.id,{required:0,delivered:0,minPressure:999,pressureBreaches:0}]));
      let totalLeak=0,totalCost=0,totalProduction=0,totalTransfers=0,spillVolume=0;
      let pressureCompliantSteps=0, pressureTotalSteps=0;
      const pressureOffset=plan.intervention==='pressure'?-1.5:0;
      const leakageFactor=plan.intervention==='pressure'?.88:1;
      const sourceCosts=sourceConfig;

      for(let step=0;step<STEP_COUNT;step++){
        const stepTown={};
        const zonePotential=Object.fromEntries(zoneKeys.map(k=>[k,0]));
        const zoneHeads=Object.fromEntries(zoneKeys.map(k=>[k,[]]));
        towns.forEach(t=>{
          const req=townRequestAt(t,step,scenario,actualDemandMultiplier,plan.intervention);
          const pd=pressureDelivery(t,{volume:volumes[t.zone]},req,pressureOffset);
          stepTown[t.id]={required:req,potential:pd.rate,head:pd.head};
          zonePotential[t.zone]+=pd.rate;
          zoneHeads[t.zone].push(pd.head);
        });

        const transferList=transferRequests(plan,volumes);
        const transferIn=Object.fromEntries(zoneKeys.map(k=>[k,0]));
        const transferOut=Object.fromEntries(zoneKeys.map(k=>[k,0]));
        const transferAgeVol=Object.fromEntries(zoneKeys.map(k=>[k,0]));
        transferList.forEach(x=>{
          transferOut[x.from]+=x.actual;
          transferIn[x.to]+=x.actual;
          transferAgeVol[x.to]+=x.actual*DT_DAYS*(ages[x.from]+DT_HOURS/2);
          totalTransfers+=x.actual*DT_DAYS;
        });

        const zoneLeak={};
        zoneKeys.forEach(k=>{
          const avgHead=zoneHeads[k].length?sum(zoneHeads[k])/zoneHeads[k].length:20;
          let rate=storageConfig[k].baseLeak*leakageFactor*Math.pow(clamp(avgHead/25,.25,2),.7);
          if(scenario.burst && scenario.burst.zone===k && step>=scenario.burst.start && step<scenario.burst.end){
            const repaired=plan.intervention==='repair' && step>=24;
            if(!repaired) rate+=scenario.burst.rate;
          }
          zoneLeak[k]=rate;
        });

        const townScale={};
        zoneKeys.forEach(k=>{
          const c=storageConfig[k];
          const startV=volumes[k];
          const hubIn=rates.feeds[k]*DT_DAYS;
          const xferIn=transferIn[k]*DT_DAYS;
          const available=startV+hubIn+xferIn;
          const leakVol=Math.min(available,zoneLeak[k]*DT_DAYS);
          const afterLeak=available-leakVol;
          const xferOutVol=Math.min(afterLeak,transferOut[k]*DT_DAYS);
          const afterTransfers=afterLeak-xferOutVol;
          const demandPotentialVol=zonePotential[k]*DT_DAYS;
          const scale=demandPotentialVol>0?clamp(afterTransfers/demandPotentialVol,0,1):1;
          townScale[k]=scale;
          const deliveredVol=demandPotentialVol*scale;
          const newV=clamp(afterTransfers-deliveredVol,0,c.capacity);
          const overflow=Math.max(0,afterTransfers-deliveredVol-c.capacity);
          spillVolume+=overflow;

          const agedMass=startV*(ages[k]+DT_HOURS);
          const mixedVolume=startV+hubIn+xferIn;
          const mixedAge=mixedVolume>0?(agedMass+transferAgeVol[k])/mixedVolume:0;
          volumes[k]=newV;
          ages[k]=newV>0?mixedAge:0;
          minVolume[k]=Math.min(minVolume[k],newV);
          maxAge[k]=Math.max(maxAge[k],ages[k]);
          totalLeak+=leakVol;
          storageSeries[k].push(newV/c.capacity*100);
        });

        let stepRequested=0,stepDelivered=0;
        towns.forEach(t=>{
          const d=stepTown[t.id];
          const delivered=d.potential*townScale[t.zone];
          townStats[t.id].required+=d.required*DT_DAYS;
          townStats[t.id].delivered+=delivered*DT_DAYS;
          townStats[t.id].minPressure=Math.min(townStats[t.id].minPressure,d.head);
          if(d.head<7) townStats[t.id].pressureBreaches++;
          pressureCompliantSteps+=d.head>=7?1:0;
          pressureTotalSteps++;
          stepRequested+=d.required;
          stepDelivered+=delivered;
        });
        demandSeries.push(stepRequested);
        supplySeries.push(rates.total);

        const hour=step/2;
        const peakTariff=(hour>=7&&hour<10)||(hour>=16&&hour<20)?1.22:0.88;
        Object.entries(rates.sources).forEach(([k,v])=>{
          totalCost+=v*DT_DAYS*sourceCosts[k].cost*scenario.energy*peakTariff;
          totalProduction+=v*DT_DAYS;
        });
        totalCost+=sum(transferList.map(x=>x.actual))*DT_DAYS*23*scenario.energy*peakTariff;
        spillVolume+=rates.spill*DT_DAYS;
      }

      const required=sum(Object.values(townStats).map(x=>x.required));
      const delivered=sum(Object.values(townStats).map(x=>x.delivered));
      const servicePct=required>0?delivered/required*100:100;
      const pressurePct=pressureCompliantSteps/pressureTotalSteps*100;
      const storageScoreParts=zoneKeys.map(k=>{
        const c=storageConfig[k], endPct=volumes[k]/c.capacity, minPct=minVolume[k]/c.capacity;
        let val=1;
        if(minPct<.05) val=0;
        else if(minPct<.10) val=.35;
        else if(minPct<.18) val=.65;
        const target=scenarioTarget(scenario);
        const endFactor=endPct<.18?.25:endPct<.28?.65:endPct>0.90?.5:endPct>0.82?.75:1;
        const targetFactor=1-clamp(Math.abs(endPct-target)/.45,0,.5);
        return val*endFactor*targetFactor;
      });
      const serviceScore=55*Math.pow(clamp(servicePct/100,0,1),4);
      const pressureScore=10*clamp(pressurePct/100,0,1);
      const resilienceScore=15*(sum(storageScoreParts)/storageScoreParts.length);
      const benchmarkVolume=required+totalLeak;
      const benchmarkCost=benchmarkVolume*72*scenario.energy;
      const efficiencyScore=10*clamp((1.55-totalCost/Math.max(1,benchmarkCost))/.55,0,1);
      const worstAge=Math.max(...Object.values(maxAge));
      const qualityScore=worstAge<=48?5:worstAge>=96?0:5*(1-(worstAge-48)/48);
      let interventionScore=3;
      if(plan.intervention==='repair') interventionScore=scenario.burst?5:0;
      if(plan.intervention==='pressure') interventionScore=scenario.burst?2.5:4;
      if(plan.intervention==='demand') interventionScore=scenario.demand>=1.12?4.5:2.5;
      if(plan.intervention==='none' && (scenario.burst||scenario.demand>=1.18)) interventionScore=1;
      const rawScore=serviceScore+pressureScore+resilienceScore+efficiencyScore+qualityScore+interventionScore;
      const score=Math.round(clamp(rawScore,0,100));

      return {
        day:game.day,scenario,plan,score,actualDemandMultiplier,forecastError,
        required,delivered,servicePct,pressurePct,totalLeak,totalCost,totalProduction,totalTransfers,spillVolume,
        volumes,ages,minVolume,maxAge,townStats,demandSeries,supplySeries,storageSeries,
        breakdown:{service:serviceScore,pressure:pressureScore,resilience:resilienceScore,efficiency:efficiencyScore,quality:qualityScore,intervention:interventionScore},
        rates
      };
    }

    function scenarioTarget(scenario){ return scenario.qualityFocus?.48:.55; }
