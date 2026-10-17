/**
 * ARCVIEW Cinema: display-only command grammar and authorized GPS diagnostics.
 * No commands are permitted to change loads, duty logs, navigation, money,
 * truck electronics, or ELD records.
 */
export const CINEMA_COMMANDS = Object.freeze([
  {id:'map',label:'Show map',examples:['show map','open map','map view']},
  {id:'diagnostics',label:'Show diagnostics',examples:['show diagnostics','vehicle diagnostics','diagnostic panel']},
  {id:'mission',label:'Show mission',examples:['show mission','mission status','shipment details']},
  {id:'center',label:'Recenter map',examples:['center map','recenter map','locate vehicle']},
  {id:'pause',label:'Pause effects',examples:['pause animations','pause motion','disable animations']},
  {id:'resume',label:'Resume effects',examples:['resume animations','resume motion','enable animations']},
  {id:'help',label:'List commands',examples:['help','list commands','what can i say']},
  {id:'exit',label:'Exit cockpit',examples:['exit cockpit','close cockpit','leave cockpit']},
]);
const commandsByPhrase = new Map(CINEMA_COMMANDS.flatMap(command=>
  command.examples.map(phrase=>[phrase,command.id])
));
export function normalizeCinemaCommand(input) {
  return String(input??'').normalize('NFKC').toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').slice(0,120);
}
export function parseCinemaCommand(input) {
  const normalized=normalizeCinemaCommand(input);
  if(!normalized)return {id:null,error:'Enter a display command.'};
  const id=commandsByPhrase.get(normalized);
  return id?{id,error:null}:{id:null,error:'Command not recognized. Try “show map”, “show diagnostics”, or “help”.'};
}
export function cinemaSafety({isDemo=false,speed=null,gpsFresh=false}={}) {
  const n=speed==null?null:Number(speed);
  const moving=!isDemo&&gpsFresh&&Number.isFinite(n)&&n>5;
  // Lack of recent GPS cannot prove the vehicle is parked. For real drivers
  // disable the microphone and attention-demanding interactions if movement
  // cannot be ruled out by a fresh reading with speed <= 5mph.
  const stationaryConfirmed=Boolean(isDemo || (gpsFresh&&Number.isFinite(n)&&n>=0&&n<=5));
  return {moving,stationaryConfirmed,allowVoice:stationaryConfirmed,allowEffects:stationaryConfirmed,
    reason:isDemo?'Sample dashboard':moving?'Vehicle reported in motion':
      stationaryConfirmed?'GPS speed indicates stationary':'Cannot verify stationary vehicle'};
}
export function cinemaDiagnostics(snapshot,source) {
  const raw=source||{};
  const speed=snapshot?.gpsFresh?snapshot.speed:null;
  const signal=snapshot?.gpsFresh && raw.signal_strength!=null &&
    Number.isFinite(Number(raw.signal_strength))?Number(raw.signal_strength):null;
  const temperature=null; // No supported live engine/cabin temperature feed.
  return [
    {id:'position',label:'Position feed',value:snapshot?.gpsFresh?'RECENT':'UNAVAILABLE',good:!!snapshot?.gpsFresh},
    {id:'accuracy',label:'GPS accuracy',value:snapshot?.accuracy==null?'—':Math.round(snapshot.accuracy)+' m'},
    {id:'speed',label:'Reported speed',value:speed==null?'—':Math.round(speed)+' mph'},
    {id:'battery',label:'GPS device battery',value:snapshot?.battery==null?'—':snapshot.battery+'%'},
    {id:'signal',label:'Reported signal strength',value:signal==null?'—':String(signal)},
    {id:'engine',label:'Engine diagnostics',value:'NOT CONNECTED'},
    {id:'cabin',label:'Cabin diagnostics',value:temperature??'NOT CONNECTED'},
    {id:'eld',label:'ELD / HOS engine',value:'NOT CONNECTED'},
  ];
}

/** Permission-aware cockpit entry: real positions only for authenticated drivers.
 * Admin/dispatcher can preview a separate explicitly synthetic cockpit. */
export function cockpitCinemaAccess({isDemo=false,role=''}={}) {
  const liveDriver=!isDemo&&role==='driver';
  const sampleOnly=Boolean(isDemo||role==='admin'||role==='dispatcher');
  return {visible:liveDriver||sampleOnly,liveDriver,sampleOnly};
}
