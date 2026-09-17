import {createTiaChip,AUDIO_CLOCK,TONES,pitch} from './tia.mjs';
export {AUDIO_CLOCK,TONES,pitch};
// The twelve distinct AUDC settings. Real hardware duplicates several of them
// (4 and 5, 6 and 10, 12 and 13, 0 and 11), so only one name is given for each.
export const AUDC=Object.freeze({
 silence:0,
 buzz:1,        // 4-bit poly
 lowBuzz:2,     // div 31 into 4-bit poly
 roughBuzz:3,   // 5-bit poly gating 4-bit poly
 tone:4,        // div 2, the cleanest pure tone
 lowTone:6,     // div 31
 brokenTone:7,  // 5-bit poly gating div 2
 noise:8,       // 9-bit poly, white noise
 hiss:9,        // 5-bit poly
 bass:12,       // div 6
 rumble:14,     // div 93
 brokenBass:15, // 5-bit poly gating div 6
});
const range=(value,max,name)=>{if(!Number.isInteger(value)||value<0||value>max)throw new RangeError(`${name} must be an integer from 0 to ${max}`);return value;};
// Builds the worklet by stringifying the chip, so there is one implementation and
// still no build step. Browsers apply an autoplay policy: the context starts
// suspended, so call resume() from a key press or pointer event before playing.
export async function createSound({context=null,gain=.6,lowPass=10000,highPass=20}={}){
 const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!context&&!Ctx)throw new Error('Web Audio is unavailable in this environment');
 const ctx=context||new Ctx();
 const source=`${createTiaChip}
class TiaProcessor extends AudioWorkletProcessor{
 constructor(options){super();this.chip=createTiaChip(sampleRate,options.processorOptions);
  this.port.onmessage=event=>{if(event.data==='reset')this.chip.reset();else this.chip.write(event.data);};}
 process(inputs,outputs){this.chip.render(outputs[0][0]);return true;}
}
registerProcessor('tia',TiaProcessor);`;
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 try{await ctx.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
 const node=new AudioWorkletNode(ctx,'tia',{numberOfInputs:0,outputChannelCount:[1],processorOptions:{gain,lowPass,highPass}});
 node.connect(ctx.destination);
 const voices=[{control:0,frequency:0,volume:0},{control:0,frequency:0,volume:0}];
 const sound={
  context:ctx,node,
  // Writes the three registers of one channel. Games normally do this once a frame,
  // during vertical blank, exactly as a cartridge would.
  set(channel,{control,frequency,volume}={}){
   const voice=voices[range(channel,1,'channel')];
   if(control!==undefined)voice.control=range(control,15,'control');
   if(frequency!==undefined)voice.frequency=range(frequency,31,'frequency');
   if(volume!==undefined)voice.volume=range(volume,15,'volume');
   node.port.postMessage({channel,...voice});
   return sound;
  },
  // Nearest playable pitch on a pure-tone control. Returns how far off it landed.
  note(channel,control,hz,volume=8){const found=pitch(control,hz);sound.set(channel,{control,frequency:found.frequency,volume});return found;},
  off(channel){return sound.set(channel,{volume:0});},
  silence(){return sound.off(0).off(1);},
  read(channel){return {...voices[range(channel,1,'channel')]};},
  resume(){return ctx.resume();},
  async destroy(){sound.silence();node.port.postMessage('reset');node.disconnect();if(!context)await ctx.close();},
 };
 return sound;
}
