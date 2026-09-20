import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createTiaChip,createSound,createVoices,encodeSpeech} from '../src/index.mjs';
const raw=rate=>createTiaChip(rate,{lowPass:0,highPass:0});
test('speech conversion clamps to the sixteen DAC levels and averages when downsampling',()=>{
 const clip=encodeSpeech(new Float32Array([-2,-.5,0,.5,2]),8000);
 assert.deepEqual([...clip.samples],[0,4,8,11,15]);assert.equal(clip.rate,8000);
 assert.deepEqual([...encodeSpeech(new Float32Array([-1,1,-1,1]),16000).samples],[8,8]);
 assert.throws(()=>encodeSpeech(new Float32Array([NaN]),8000),/finite/);
 assert.throws(()=>encodeSpeech(new Float32Array([0]),0),/rates/);
});
test('DAC playback holds each four-bit sample for the requested time and ends at silence',()=>{
 const chip=raw(48000);chip.playSample(new Uint8Array([0,15]),12000);
 const out=new Float32Array(8);chip.render(out);
 assert.deepEqual([...out],[0,0,0,0,.5,.5,.5,.5]);assert.equal(chip.samplePlaying(),false);
 chip.render(out);assert.ok(out.every(v=>v===0));
});
test('scheduled speech exactly matches manual volume writes through the same filters',()=>{
 const scheduled=createTiaChip(48000),manual=createTiaChip(48000);
 const samples=new Uint8Array([0,15,3,8,1,14]);scheduled.playSample(samples,8000);
 const actual=new Float32Array(100);scheduled.render(actual);
 const expected=new Float32Array(100),one=new Float32Array(1);
 for(let i=0;i<100;i++){
  manual.write({channel:0,control:0,frequency:0,volume:i<36?samples[Math.floor(i/6)]:0});manual.render(one);expected[i]=one[0];
 }
 assert.deepEqual(actual,expected);
});
test('non-integer sample timing is independent of audio buffer boundaries',()=>{
 const data=Uint8Array.from({length:137},(_,i)=>i%16);
 const a=createTiaChip(44100),b=createTiaChip(44100);a.playSample(data,8000);b.playSample(data,8000);
 const whole=new Float32Array(1000);a.render(whole);
 const chunks=new Float32Array(1000);for(let i=0;i<1000;i+=37)b.render(chunks.subarray(i,Math.min(1000,i+37)));
 assert.deepEqual(chunks,whole);assert.equal(a.samplePlaying(),false);assert.equal(b.samplePlaying(),false);
});
test('speech owns its channel while the second channel remains available',()=>{
 const chip=raw(48000);chip.playSample(new Uint8Array(40).fill(15),8000,{channel:0});
 chip.write({channel:0,control:8,volume:0});chip.write({channel:1,control:0,volume:6});
 const out=new Float32Array(1);chip.render(out);assert.ok(Math.abs(out[0]-.7)<1e-6);
 chip.stopSample(0);chip.render(out);assert.ok(Math.abs(out[0]-.2)<1e-6);
 chip.playSample(new Uint8Array([4]),8000);chip.reset();assert.equal(chip.samplePlaying(),false);assert.equal(chip.level(),0);
});
test('invalid or caller-mutated samples cannot corrupt an active phrase',()=>{
 const chip=raw(48000),data=new Uint8Array([15,15]);chip.playSample(data,8000);data.fill(0);
 assert.throws(()=>chip.playSample(new Uint8Array([16]),8000),/four-bit/);
 assert.throws(()=>chip.playSample(new Uint8Array([0]),0),/rate/);
 assert.throws(()=>chip.playSample(new Uint8Array([0]),8000,{channel:2}),/channel/);
 const out=new Float32Array(1);chip.render(out);assert.equal(out[0],.5);
});
test('the actual worklet handles completion, replacement, cancellation and effect channel ownership',async()=>{
 const previous=globalThis.AudioWorkletNode;let Processor,node;
 const context={destination:{},resume:async()=>{},audioWorklet:{addModule:async url=>{
  const code=await(await fetch(url)).text();
  vm.runInNewContext(code,{sampleRate:48000,Uint8Array,AudioWorkletProcessor:class{constructor(){this.port={};}},registerProcessor:(name,klass)=>{Processor=klass;}});
 }}};
 globalThis.AudioWorkletNode=class{
  constructor(ctx,name,options){
   node=this;this.processor=new Processor(options);
   this.port={postMessage:data=>this.processor.port.onmessage({data}),close:()=>{}};
   this.processor.port.postMessage=data=>this.port.onmessage?.({data});
  }
  connect(){}disconnect(){}
  render(){this.processor.process([],[[new Float32Array(128)]]);}
 };
 let sound;
 try{
  sound=await createSound({context});
  const clip={samples:new Uint8Array(100).fill(10),rate:8000};
  const old=sound.playSample(clip),current=sound.playSample(clip);
  assert.equal(await old.finished,'replaced');old.stop();assert.equal(sound.samplePlaying(),true);
  const voices=createVoices(sound),effect=[{control:4,frequency:8,volume:8}];
  assert.equal(voices.play(effect,{channel:0}),null);
  assert.equal(voices.play(effect),1);voices.step();assert.equal(sound.read(1).volume,8);
  for(let i=0;i<5;i++)node.render();assert.equal(await current.finished,'ended');assert.equal(sound.samplePlaying(),false);
  voices.play(effect,{channel:0});voices.step();const spoken=sound.playSample(clip);
  voices.step();assert.equal(sound.samplePlaying(),true,'finishing an old effect cannot stop speech');
  sound.silence();assert.equal(await spoken.finished,'stopped');assert.equal(sound.samplePlaying(),false);
  const last=sound.playSample(clip);await sound.destroy();assert.equal(await last.finished,'stopped');
  assert.throws(()=>sound.playSample(clip),/destroyed/);
 }finally{await sound?.destroy();if(previous===undefined)delete globalThis.AudioWorkletNode;else globalThis.AudioWorkletNode=previous;}
});
