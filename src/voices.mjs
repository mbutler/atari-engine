// Composing effects out of the sound primitives. A cartridge writes its audio
// registers once a frame during vertical blank, so step() belongs in the game loop
// beside update() rather than on a timer of its own.
//
// An effect is either a list of per-frame writes, or `{control, frames, at(frame)}`
// where at returns the writes for that frame. Sweeps and decays are easier as a
// function; short fixed blips are easier as a list.
function shape(effect){
 if(Array.isArray(effect)){
  if(!effect.length)throw new RangeError('An effect needs at least one frame');
  return {frames:effect.length,at:frame=>effect[frame],loop:false,priority:0,control:undefined};
 }
 if(!effect||typeof effect.at!=='function')throw new TypeError('An effect is a list of frames, or an object with at(frame)');
 if(!Number.isInteger(effect.frames)||effect.frames<1)throw new RangeError('An effect needs a positive whole number of frames');
 return {frames:effect.frames,at:effect.at,loop:!!effect.loop,priority:effect.priority||0,control:effect.control};
}
export function createVoices(sound,{channels=[0,1]}={}){
 if(!sound||typeof sound.set!=='function')throw new TypeError('createVoices needs a sound');
 const playing=new Map();
 const writeFrame=(channel,state)=>{
  const step=state.effect.at(state.frame,state.effect.frames);
  if(step)sound.set(channel,{control:state.effect.control,...step});
 };
 const voices={
  // Returns the channel it took, or null when a louder claim keeps it. Games do not
  // want a footstep cutting off an explosion, and the hardware has only two channels.
  play(effect,{channel=null}={}){
   const sounding=shape(effect);
   const first={control:sounding.control,...sounding.at(0,sounding.frames)};
   if(first.control===undefined)throw new RangeError('An effect must set control on the effect itself or on its first frame');
   let target=channel;
   if(target===null){
    target=channels.find(c=>!playing.has(c));
    if(target===undefined){
     const weakest=channels.slice().sort((a,b)=>playing.get(a).effect.priority-playing.get(b).effect.priority)[0];
     if(playing.get(weakest).effect.priority>sounding.priority)return null;
     target=weakest;
    }
   }else{
    if(!channels.includes(target))throw new RangeError(`Channel ${target} is not part of this voice set`);
    const current=playing.get(target);
    if(current&&current.effect.priority>sounding.priority)return null;
   }
   playing.set(target,{effect:sounding,frame:0});
   return target;
  },
  // Advance every sounding channel by one frame. Call once per simulation step.
  step(){
   for(const [channel,state] of [...playing]){
    if(state.frame>=state.effect.frames){
     if(!state.effect.loop){playing.delete(channel);sound.off(channel);continue;}
     state.frame=0;
    }
    writeFrame(channel,state);state.frame++;
   }
   return voices;
  },
  stop(channel){if(playing.delete(channel))sound.off(channel);return voices;},
  silence(){for(const channel of [...playing.keys()])voices.stop(channel);return voices;},
  busy(channel){return playing.has(channel);},
  get active(){return [...playing.keys()];},
 };
 return voices;
}
