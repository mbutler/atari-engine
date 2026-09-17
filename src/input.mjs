const directions={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'action'};
export function createInput({target=document,onCommand=()=>{}}={}){
 const keys=new Set();let actionPending=false;
 const press=code=>{if(code==='Space'&&!keys.has(code))actionPending=true;keys.add(code);},release=code=>keys.delete(code),clear=()=>{keys.clear();actionPending=false;};
 const down=e=>{if(directions[e.code])e.preventDefault();press(e.code);if(!e.repeat){if(e.code==='KeyP')onCommand('pause');if(e.code==='KeyR')onCommand('reset');}};
 const up=e=>release(e.code);target.addEventListener('keydown',down);target.addEventListener('keyup',up);
 return {press,release,clear,read(){const held=name=>Object.entries(directions).some(([key,value])=>value===name&&keys.has(key));const action=held('action')||actionPending;actionPending=false;return {x:Number(held('right'))-Number(held('left')),y:Number(held('down'))-Number(held('up')),action};},destroy(){target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);clear();}};
}
