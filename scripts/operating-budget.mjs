// Offline planning only. Rates are the official Firestore billing-example rates,
// not a quote for OLDX's unverified database region. No SDK, network or activation.
export function estimateOperatingBudget({dailyReads,dailyWrites,days=30,usdInr=90,taxFraction=.18,backendUsd=7,reserveInr=250,imageViewsPerDau=20,imageBytes=120000,dau,mediaStorageGb=3,transformations=2000}={}){
 const values={dailyReads,dailyWrites,days,usdInr,taxFraction,backendUsd,reserveInr,imageViewsPerDau,imageBytes,dau,mediaStorageGb,transformations};
 if(Object.values(values).some(v=>!Number.isFinite(v)||v<0)||days<1||days>31||usdInr===0||taxFraction>1)throw Error('Invalid explicit budget assumptions');
 const firestoreUsd=days*(Math.max(0,dailyReads-50000)*.06/100000+Math.max(0,dailyWrites-20000)*.18/100000);
 const mediaGb=dau*imageViewsPerDau*imageBytes*days/1e9,mediaCredits=mediaGb+mediaStorageGb+transformations/1000;
 const subtotalInr=(backendUsd+firestoreUsd)*usdInr*(1+taxFraction)+reserveInr;
 return {firestoreUsd:Number(firestoreUsd.toFixed(6)),subtotalInr:Number(subtotalInr.toFixed(2)),mediaGb,mediaCredits,mediaWithin70Percent:mediaCredits<=17.5,mediaWithinFree:mediaCredits<=25,completeEstimate:false};
}
export function initial2000MauScenarios(){return [200,400,600].map(dau=>{
 // Existing measured mixed Chat lifecycle: 67R/13W per sent message; five/day.
 // Extra journeys: ASSUMED 100 reads/4 writes per DAU; 20% retries/abuse on both.
 const dailyReads=dau*(5*67+100)*1.2,dailyWrites=dau*(5*13+4)*1.2;
 return {dau,dailyReads,dailyWrites,...estimateOperatingBudget({dailyReads,dailyWrites,dau})};
});}
