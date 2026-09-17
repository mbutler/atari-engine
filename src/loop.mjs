// Pure clock is independently testable; games own state and all update rules.
export function createClock({hz=120,maxElapsed=.05}={}){
 if(!Number.isFinite(hz)||hz<=0||!Number.isFinite(maxElapsed)||maxElapsed<=0)throw new RangeError('Positive finite clock settings required');
 let accumulator=0;const dt=1/hz;
 return {advance(elapsed,update){accumulator+=Math.min(maxElapsed,Math.max(0,Number.isFinite(elapsed)?elapsed:0));let count=0;while(accumulator+1e-12>=dt){update(dt);accumulator=Math.max(0,accumulator-dt);count++;}return count;},reset(){accumulator=0;}};
}
export function createLoop({input,update,render,onPause=()=>{},hz=120,maxElapsed=.05}){
 const clock=createClock({hz,maxElapsed});let paused=false,running=false,last=null,request=null;
 const setPaused=value=>{paused=!!value;clock.reset();last=null;if(paused)input.clear();onPause(paused);};
 const blur=()=>setPaused(true),visibility=()=>{if(document.hidden)blur();};
 function tick(now){if(!running)return;const elapsed=last===null?0:(now-last)/1000;last=now;if(!paused){clock.advance(elapsed,dt=>update(input.read(),dt));}render();request=requestAnimationFrame(tick);}
 return {get paused(){return paused;},setPaused,togglePause(){setPaused(!paused);},resetClock(){clock.reset();last=null;},start(){if(running)return;running=true;last=null;window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);request=requestAnimationFrame(tick);},destroy(){running=false;cancelAnimationFrame(request);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);clock.reset();}};
}
