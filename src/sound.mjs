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
  this.ids=[null,null];
  this.port.onmessage=event=>{
   const data=event.data;
   if(data==='reset'){this.chip.reset();this.ids=[null,null];}
   else if(data.type==='sample'){this.chip.playSample(data.samples,data.rate,{channel:data.channel});this.ids[data.channel]=data.id;}
   else if(data.type==='stopSample'){this.chip.stopSample(data.channel);this.ids[data.channel]=null;}
   else this.chip.write(data);
  };}
 process(inputs,outputs){
  this.chip.render(outputs[0][0]);
  for(let channel=0;channel<2;channel++)if(this.ids[channel]!==null&&!this.chip.samplePlaying(channel)){
   this.port.postMessage({type:'sampleEnded',channel,id:this.ids[channel]});this.ids[channel]=null;
  }
  return true;
 }
}
registerProcessor('tia',TiaProcessor);`;
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 try{await ctx.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
 const node=new AudioWorkletNode(ctx,'tia',{numberOfInputs:0,outputChannelCount:[1],processorOptions:{gain,lowPass,highPass}});
 node.connect(ctx.destination);
 const voices=[{control:0,frequency:0,volume:0},{control:0,frequency:0,volume:0}];
 const playing=[null,null];let nextId=0,destroyed=false;
 const finish=(channel,reason)=>{
  const active=playing[channel];if(!active)return;
  playing[channel]=null;voices[channel]={control:0,frequency:0,volume:0};active.resolve(reason);
 };
 node.port.onmessage=event=>{
  const data=event.data;
  if(data.type==='sampleEnded'&&playing[data.channel]?.id===data.id)finish(data.channel,'ended');
 };
 const sound={
  context:ctx,node,
  // Writes the three registers of one channel. Games normally do this once a frame,
  // during vertical blank, exactly as a cartridge would.
  set(channel,{control,frequency,volume}={}){
   const voice=voices[range(channel,1,'channel')];
   if(playing[channel])return sound;
   if(control!==undefined)voice.control=range(control,15,'control');
   if(frequency!==undefined)voice.frequency=range(frequency,31,'frequency');
   if(volume!==undefined)voice.volume=range(volume,15,'volume');
   node.port.postMessage({channel,...voice});
   return sound;
  },
  // Nearest playable pitch on a pure-tone control. Returns how far off it landed.
  note(channel,control,hz,volume=8){const found=pitch(control,hz);sound.set(channel,{control,frequency:found.frequency,volume});return found;},
  // An active sample owns one of the two channels; ordinary effect writes to
  // that channel are ignored. off/silence deliberately cancel speech too.
  playSample({samples,rate},{channel=0}={}){
   range(channel,1,'channel');
   if(destroyed)throw new Error('Sound has been destroyed');
   if(!(samples instanceof Uint8Array)||!samples.length||samples.some(v=>v>15))throw new RangeError('Samples must be a nonempty Uint8Array of four-bit values');
   if(!Number.isFinite(rate)||rate<=0||rate>96000)throw new RangeError('Sample rate must be positive and at most 96000 Hz');
   finish(channel,'replaced');
   const id=++nextId;let resolve;
   const finished=new Promise(done=>{resolve=done;});playing[channel]={id,resolve};
   voices[channel]={control:0,frequency:0,volume:samples[0]};
   node.port.postMessage({type:'sample',channel,id,samples:samples.slice(),rate});
   return {finished,stop(){if(playing[channel]?.id===id)sound.stopSample(channel);}};
  },
  samplePlaying(channel=0){return !!playing[range(channel,1,'channel')];},
  stopSample(channel=0){range(channel,1,'channel');if(playing[channel]){node.port.postMessage({type:'stopSample',channel});finish(channel,'stopped');}return sound;},
  off(channel){sound.stopSample(channel);return sound.set(channel,{volume:0});},
  silence(){return sound.off(0).off(1);},
  read(channel){return {...voices[range(channel,1,'channel')]};},
  resume(){return ctx.resume();},
  async destroy(){if(destroyed)return;destroyed=true;sound.silence();node.port.postMessage('reset');node.disconnect();node.port.close();if(!context)await ctx.close();},
 };
 return sound;
}
