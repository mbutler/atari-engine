const directions={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'action'};
export function createInput({target=document,onCommand=()=>{}}={}){
 const keys=new Set();let actionPending=false;
 const press=code=>{if(code==='Space'&&!keys.has(code))actionPending=true;keys.add(code);},release=code=>keys.delete(code),clear=()=>{keys.clear();actionPending=false;};
 const down=e=>{if(directions[e.code])e.preventDefault();press(e.code);if(!e.repeat){if(e.code==='KeyP')onCommand('pause');if(e.code==='KeyR')onCommand('reset');}};
 const up=e=>release(e.code);target.addEventListener('keydown',down);target.addEventListener('keyup',up);
 return {press,release,clear,read(){const held=name=>Object.entries(directions).some(([key,value])=>value===name&&keys.has(key));const action=held('action')||actionPending;actionPending=false;return {x:Number(held('right'))-Number(held('left')),y:Number(held('down'))-Number(held('up')),action};},destroy(){target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);clear();}};
}
// Reads several controls as one. The first source with a direction wins, and any of
// them can fire. A cartridge takes this wherever it takes an input.
export function combineInputs(...sources){
 if(!sources.length)throw new RangeError('combineInputs needs at least one source');
 return {
  read(){
   const reads=sources.map(source=>source.read());
   return {x:reads.reduce((v,r)=>v||r.x,0),y:reads.reduce((v,r)=>v||r.y,0),action:reads.some(r=>r.action),
           analog:reads.map(r=>r.analog).find(Boolean)||{x:0,y:0}};
  },
  clear(){for(const source of sources)if(source.clear)source.clear();},
  destroy(){for(const source of sources)if(source.destroy)source.destroy();},
 };
}
